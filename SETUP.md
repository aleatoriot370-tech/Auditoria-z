# Setup rápido — Windows / Linux / macOS

Requisitos: **Node.js 20+** e **npm** (ou **bun**).
Baixe em: https://nodejs.org/ (versão LTS 20.x ou superior).

## Passo a passo

```powershell
# 1. Descompacte o lamoia-audit.zip em uma pasta, ex:
#    C:\Users\jpereira\Desktop\Auditoria\lamoia-audit

# 2. Entre na pasta
cd C:\Users\jpereira\Desktop\Auditoria\lamoia-audit

# 3. Instale as dependências (use npm OU bun)
npm install
# ou
bun install

# 4. Configure o ambiente
#    Edite o arquivo .env e preencha as variáveis do Supabase:
#      NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
#      NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
#      SUPABASE_SERVICE_ROLE_KEY=eyJ...
#    Deixe-as vazias para usar o SQLite local (modo sandbox).

# 5. (Somente se estiver usando SQLite local) Crie o banco e popule com dados de exemplo
npm run db:push
npm run seed
#    Credenciais de exemplo criadas: admin / admin123

# 6. (Somente se for usar Supabase) Rode o script supabase.sql no SQL Editor
#    do seu projeto Supabase, para criar as tabelas + função validar_login + admin user.

# 7. Inicie o servidor de desenvolvimento
npm run dev

# 8. Abra http://localhost:3000 no navegador.
```

## Scripts disponíveis

| Comando              | Descrição                                                              |
| -------------------- | --------------------------------------------------------------------- |
| `npm run dev`        | Inicia o servidor Next.js em http://localhost:3000                    |
| `npm run lint`       | Verifica a qualidade do código com ESLint                             |
| `npm run build`      | Gera build de produção em `.next/standalone` (uso no Netlify)         |
| `npm run db:push`    | Cria/atualiza o SQLite local a partir do `prisma/schema.prisma`       |
| `npm run seed`       | Popula o SQLite local com usuário admin + dados de exemplo            |
| `npm run seed:ts`    | Mesmo que `seed`, mas via TypeScript (requer `bun`)                   |

## Deploy no Netlify

1. Faça commit/push do projeto para GitHub/GitLab.
2. Em https://app.netlify.com → **Add new site → Import existing project**.
3. Selecione o repo. O `netlify.toml` já configura:
   - Build command: `npm run build` (Netlify instala `npm` automaticamente)
   - Publish: `.next`
   - Plugin: `@netlify/plugin-nextjs`
4. Em **Site settings → Environment variables**, configure:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```
5. Trigger novo deploy. Pronto!

## Troubleshooting — Windows

- **`'tee' não é reconhecido`** — Resolvido nesta versão. Os scripts `dev`/`start` não usam mais `tee`.
- **`'cp' não é reconhecido`** — Resolvido nesta versão. O script `build` usa `cross-env-shell` + `cp -r` (funciona no Git Bash instalado junto com o Node no Windows).
  - Se ainda assim falhar, instale o Git for Windows (https://git-scm.com) que inclui o `bash` + `cp`.
- **`bun: command not found`** — Use `npm` no lugar. Todos os scripts funcionam com `npm`.
- **`prisma: command not found`** — Rode `npx prisma db push` ou instale globalmente com `npm install -g prisma`.
- **Porta 3000 em uso** — Edite o script `dev` no `package.json` para outra porta, ex: `next dev -p 3001`.
