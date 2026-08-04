# Lamoia Audit — Sistema de Auditoria de Rota de Vendas

Aplicação web (Next.js 16 + TypeScript + Tailwind + shadcn/ui) para auditoria e acompanhamento de rota de vendas do **Grupo Lamoia**.

## ✨ Funcionalidades

| Módulo | Descrição |
|---|---|
| **Login** | Autenticação por `Users.Login` + `Senha` (bcrypt), validando `Status = 'a'` e `Tipo` autorizado (`Admin Senior`, `Admin Junior`, `Comercial`). |
| **Dashboard** | Cards de indicadores, gráfico de linha (Agendas × Auditorias), gráfico de barras (visitas por status) e tabela de últimas auditorias. Filtros por mês-referência, período, gestor e vendedor. Usuário `Comercial` é automaticamente filtrado pelo próprio ID. |
| **Auditoria** | Busca por data + vendedor. Cards (gestor, vendedor, placa, contagens, eficiência). Campos de horário início/fim/total com checkbox de almoço. Tabela editável das visitas (status + observação). Botão "Ver" abre mapa + galeria. Bloqueia edição se já finalizada ou data ≤ hoje. |
| **Cadastro de Agenda** | Manual (tabela interativa com lookup de cliente por código + Enter) ou Importação de planilha Excel (`data_agenda` + `codigo_cliente`). Validação de todos os códigos e datas antes de salvar. |
| **Lista de Agendas** | Filtros por período/mês-referência, gestor e vendedor. Tabela com checkbox (apenas admin), popup de detalhe com inclusão/exclusão de visitas (apenas agendas Pendentes e admin). |

## 🚀 Como rodar localmente

```bash
bun install
bun run db:push      # cria/atualiza SQLite local (sandbox)
bun run scripts/seed.ts  # popula usuário admin + dados de demonstração
bun run dev          # http://localhost:3000
```

### Credenciais de demonstração (sandbox)

| Login | Senha | Tipo |
|---|---|---|
| `admin` | `admin123` | Admin Senior |
| `junior` | `admin123` | Admin Junior |
| `comercial1` | `admin123` | Comercial |
| `qualidade` | `admin123` | Qualidade (acesso negado) |
| `inativo` | `admin123` | Inativo (acesso negado) |

## 🗄️ Arquitetura de dados (duas vias)

A aplicação usa uma **camada de abstração única** (`src/lib/datasource.ts`) que decide em runtime qual backend usar:

- **Sem variáveis Supabase** → usa **Prisma + SQLite** local (sandbox/dev).
- **Com variáveis Supabase** → usa **Supabase JS client** (`@supabase/supabase-js`).

Isso permite testar tudo no sandbox sem custo e, no deploy para Netlify, basta configurar as env vars para apontar para o Supabase de produção. **Nenhuma linha de código muda entre os dois modos.**

## 🌐 Deploy no Netlify + Supabase

### 1. Criar projeto no Supabase

1. Acesse https://app.supabase.com e crie um novo projeto.
2. Vá em **SQL Editor** e cole o conteúdo de `supabase.sql` (raiz do repo).
3. Execute. Isso cria as tabelas `Users`, `Clientes`, `ag_agenda`, `ag_agenda_diaria`, índices, a função `validar_login` e insere o usuário `admin / admin123`.

### 2. Obter credenciais Supabase

Em **Project Settings → API**:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (mantenha em segredo!)

### 3. Deploy no Netlify

1. Push o repo para GitHub/GitLab.
2. Em https://app.netlify.com → **Add new site → Import existing project**.
3. Selecione o repositório. O `netlify.toml` já configura:
   - Build command: `bun run build`
   - Publish: `.next`
   - Plugin: `@netlify/plugin-nextjs` (instalado automaticamente).
4. Em **Site settings → Environment variables**, configure:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```
5. Trigger novo deploy. Pronto! 🎉

## 📁 Estrutura principal

```
src/
├── app/
│   ├── api/                       # API routes (route handlers)
│   │   ├── auth/{login,logout,session}/
│   │   ├── dashboard/
│   │   ├── auditoria/{search,save}/
│   │   ├── agenda/{create,import,list,[id],delete-batch}/
│   │   ├── users/{vendedores,gestores}/
│   │   └── clientes/search/
│   ├── globals.css                # paleta Lamoia (#132999 + #AEF544)
│   ├── layout.tsx
│   └── page.tsx                   # SPA principal
├── components/
│   ├── lamoia/                    # telas e módulos do sistema
│   │   ├── LoginScreen.tsx
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Auditoria.tsx
│   │   ├── CadastroAgenda.tsx
│   │   ├── ListaAgendas.tsx
│   │   └── StatCard.tsx
│   └── ui/                        # shadcn/ui components
├── lib/
│   ├── datasource.ts              # ← abstração Prisma/Supabase (núcleo)
│   ├── supabase.ts                # Supabase client (server-side)
│   ├── auth.ts                    # sessão (cookie httpOnly)
│   ├── types.ts                   # tipos compartilhados
│   └── db.ts                      # Prisma client
└── prisma/schema.prisma           # schema SQLite espelhando Supabase

scripts/seed.ts                    # seed do SQLite local
supabase.sql                       # DDL + função + seed para Supabase
netlify.toml                       # config de deploy
```

## 🔒 Segurança

- Sessão: cookie `httpOnly` + `sameSite=lax`, expira em 8h.
- Senhas: bcrypt ($2a$ com cost 10). Compatível com `crypt()` do Postgres.
- Login migra silenciosamente senhas plaintext para bcrypt na primeira validação.
- `Tipo` não autorizado → mensagem genérica "usuário não autorizado".
- `Status != 'a'` → "usuário inativo".
- Auditoria só pode ser salva para datas futuras (data_agenda > hoje) e status não finalizado.

## 🧰 Stack

- Next.js 16 (App Router, Turbopack)
- TypeScript 5
- Tailwind CSS 4 + shadcn/ui
- Recharts (gráficos)
- `@supabase/supabase-js` (Supabase)
- `bcryptjs` (hashing)
- `xlsx` (parsing Excel)
- Prisma 6 (SQLite sandbox)

## 📝 Próximos passos sugeridos

- **1.5 — Acompanhamento** e **1.6 — Usuários** (não construídos conforme especificação).
- Tabela `fotos_vis` para galeria de fotos (Fachada / Antes / Depois) com `localizacao`.
- WS / SSE para auditoria colaborativa em tempo real.
- Logs de auditoria (quem alterou o quê, quando).
