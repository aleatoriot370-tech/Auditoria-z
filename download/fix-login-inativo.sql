-- ============================================================================
--  LAMOIA AUDIT — Fix "Usuário inativo" para usuários com Status = 'a'
-- ============================================================================
--  PROBLEMA:
--  Ao tentar logar com um usuário que tem Status='a' no banco, o sistema
--  retorna "Usuário inativo. Contate o administrador."
--
--  CAUSAS POSSÍVEIS (3 cenários):
--  1. Login duplicado: A tabela Users original NÃO tem UNIQUE em "Login".
--     Se houver 2+ linhas com Login='Admin' (uma ativa, outra inativa),
--     o `LIMIT 1` do Postgres é não-determinístico — pode retornar a inativa.
--  2. Case sensitivity: `!= 'a'` diferencia maiúsculas. Se Status='A' (maiúsculo),
--     a comparação falha.
--  3. Whitespace: 'a ' ou ' a' (com espaços) também quebram a comparação.
--
--  COMO USAR ESTE ARQUIVO:
--  1. Cole TODO este conteúdo no SQL Editor do Supabase.
--  2. Rode. Ele é IDEMPOTENTE (pode rodar várias vezes sem efeito colateral).
--  3. Veja a saída do bloco de diagnóstico para identificar a causa exata.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PASSO 1: DIAGNÓSTICO — rode e veja a saída para identificar o problema
-- ----------------------------------------------------------------------------
-- Lista todos os logins duplicados ou com Status fora do padrão 'a' exato.
SELECT
  "Login",
  COUNT(*)                                 AS total_linhas,
  COUNT(*) FILTER (WHERE "Status" = 'a')   AS ativos_padrao,
  COUNT(*) FILTER (WHERE "Status" != 'a'
                     AND "Status" IS NOT NULL
                     AND lower(trim("Status")) = 'a') AS ativos_nao_padrao, -- ex: 'A', 'a ', ' a'
  COUNT(*) FILTER (WHERE "Status" IS NULL OR lower(trim(coalesce("Status", ''))) != 'a') AS inativos,
  string_agg(DISTINCT "Status", ', ' ORDER BY "Status") AS status_distintos,
  string_agg(id_user::text, ', ')          AS ids_afetados
FROM public."Users"
WHERE "Login" IS NOT NULL
GROUP BY "Login"
HAVING COUNT(*) > 1                                      -- login duplicado
    OR COUNT(*) FILTER (WHERE "Status" != 'a'
                         AND "Status" IS NOT NULL
                         AND lower(trim("Status")) = 'a') > 0  -- Status "quase ativo" (case/whitespace)
    OR COUNT(*) FILTER (WHERE "Status" IS NULL OR lower(trim(coalesce("Status", ''))) != 'a') = COUNT(*) -- todos inativos
ORDER BY "Login";

-- ----------------------------------------------------------------------------
-- PASSO 2: APLIQUE ESTA CORREÇÃO AUTOMÁTICA NOS DADOS
-- ----------------------------------------------------------------------------
-- Normaliza TODOS os Status para 'a' exato (lowercase, sem whitespace) quando
-- o valor original já era uma variação de ativo (qualquer variação de 'a').
-- Linhas realmente inativas (Status != 'a' em qualquer forma) são preservadas.

UPDATE public."Users"
SET "Status" = 'a'
WHERE "Status" IS NOT NULL
  AND lower(trim("Status")) = 'a'
  AND "Status" != 'a';

-- Verificação pós-migração (deve mostrar 0 linhas "não padrão"):
SELECT
  COUNT(*) AS linhas_status_nao_padrao,
  COUNT(*) FILTER (WHERE "Status" IS NULL) AS linhas_status_nulo
FROM public."Users"
WHERE "Login" IS NOT NULL
  AND (
    ("Status" IS NOT NULL AND lower(trim("Status")) = 'a' AND "Status" != 'a')
    OR "Status" IS NULL
  );

-- ----------------------------------------------------------------------------
-- PASSO 3: REESCREVA A FUNÇÃO validar_login COM VERSÃO ROBUSTA
-- ----------------------------------------------------------------------------
-- Esta versão:
--   • Ordena por Status ativo primeiro (resolve o problema de login duplicado)
--   • Compara Status com trim() + lower() (resolve case/whitespace)
--   • Mantém as MESMAS mensagens de erro do sistema original (segurança)

create or replace function public.validar_login(p_login text, p_senha text)
returns json
language plpgsql
security definer
as $$
DECLARE
  user_record public."Users";
  is_valid BOOLEAN;
  v_hash_text TEXT;
  v_status_norm TEXT;
BEGIN
  -- 1. Busca o usuário pelo login, PREFERINDO Status='a' (case-insensitive, trimmed)
  --    quando há múltiplas linhas com o mesmo Login (Login pode não ser UNIQUE).
  SELECT * INTO user_record
  FROM public."Users"
  WHERE "Login" = p_login
  ORDER BY
    CASE
      WHEN trim(coalesce("Status", '')) ILIKE 'a' THEN 0
      ELSE 1
    END ASC,
    id_user ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Login e senha inválidos.');
  END IF;

  -- 2. Status ativo — robusto a case/whitespace
  v_status_norm := lower(trim(coalesce(user_record."Status", '')));
  IF v_status_norm != 'a' THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Usuário inativo. Contate o administrador.');
  END IF;

  -- 3. Validação de senha (igual à função original — bcrypt com fallback plaintext)
  IF user_record."Senha" LIKE '$2a$%' OR user_record."Senha" LIKE '$2b$%' OR user_record."Senha" LIKE '$2y$%' THEN
    v_hash_text := user_record."Senha";
    IF v_hash_text LIKE '$2b$%' OR v_hash_text LIKE '$2y$%' THEN
      v_hash_text := '$2a$' || SUBSTRING(v_hash_text FROM 5);
    END IF;
    is_valid := (v_hash_text = crypt(p_senha, v_hash_text));
  ELSE
    is_valid := (user_record."Senha" = p_senha);
  END IF;

  IF is_valid THEN
    -- Migração silenciosa para Bcrypt $2a$ se a senha estiver em texto puro
    IF user_record."Senha" NOT LIKE '$2a$%' AND user_record."Senha" NOT LIKE '$2b$%' AND user_record."Senha" NOT LIKE '$2y$%' THEN
      UPDATE public."Users"
      SET "Senha" = crypt(p_senha, gen_salt('bf', 10))
      WHERE "id_user" = user_record."id_user";
    END IF;

    RETURN json_build_object(
      'sucesso', true,
      'usuario', json_build_object(
        'id_user', user_record."id_user",
        'Nome', user_record."Nome",
        'Login', user_record."Login",
        'Tipo', user_record."Tipo",
        'Status', user_record."Status"
      )
    );
  ELSE
    RETURN json_build_object('sucesso', false, 'mensagem', 'Login e senha inválidos.');
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- PASSO 4 (opcional, recomendado): torne "Login" UNIQUE para evitar duplicatas futuras
-- ----------------------------------------------------------------------------
-- ⚠️ RODE APÓS LIMPAR DUPLICATAS MANUALMENTE.
-- Este bloco é desativado por padrão. Descomente e rode somente se o Passo 1
-- não mostrou nenhum login duplicado, OU após você deletar/consolidar as
-- duplicatas manualmente.

-- BEGIN
--   ALTER TABLE public."Users" ADD CONSTRAINT users_login_unique UNIQUE ("Login");
--   RAISE NOTICE 'Constraint UNIQUE adicionada em Users.Login';
-- EXCEPTION WHEN duplicate_object THEN
--   RAISE NOTICE 'Constraint UNIQUE já existe';
-- EXCEPTION WHEN unique_violation THEN
--   RAISE EXCEPTION 'Não foi possível adicionar UNIQUE porque existem logins duplicados. Limpe as duplicatas primeiro.';
-- END;

-- ----------------------------------------------------------------------------
-- PASSO 5 (opcional): função de diagnóstico reutilizável
-- ----------------------------------------------------------------------------
-- Rode a qualquer momento para auditar a tabela Users:
--   SELECT * FROM public.diagnostic_users_por_login();
create or replace function public.diagnostic_users_por_login()
returns table (
  login text,
  total_rows bigint,
  ativos bigint,
  inativos bigint,
  status_distinct text,
  user_ids text
)
language sql
security definer
as $$
  SELECT
    "Login" AS login,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE lower(trim(coalesce("Status", ''))) = 'a') AS ativos,
    COUNT(*) FILTER (WHERE lower(trim(coalesce("Status", ''))) != 'a') AS inativos,
    string_agg(DISTINCT "Status", ', ') AS status_distinct,
    string_agg(id_user::text, ', ') AS user_ids
  FROM public."Users"
  WHERE "Login" IS NOT NULL
  GROUP BY "Login"
  ORDER BY "Login";
$$;
