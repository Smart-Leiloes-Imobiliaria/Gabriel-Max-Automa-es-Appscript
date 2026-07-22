# Smart Leilões — Agendamentos de Parceiros

Plataforma para agendamento de videoconferências entre parceiros e gerentes das agências Smart Leilões, com fluxo de tratativas (envio de minuta, validação, contrato assinado) e integrações com Bitrix24, Pipedrive, Gmail e ChatApp (WhatsApp).

## Stack

- **Frontend:** React 18 + Vite 5 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Lovable Cloud (Supabase) — Postgres, Auth, Storage, Edge Functions (Deno)
- **Integrações:** Bitrix24 (chat/disk/imopenlines), Pipedrive, Gmail API, ChatApp

## Estrutura

```
src/
  pages/          # Auth, Agendar, Painel, Tratativas, Admin, AdminDashboard, Confirmacao
  components/     # AppHeader, ProtectedRoute, ErrorBoundary, admin/*
  lib/            # auth, db, agencies (regras de UF e dias úteis por agência)
  integrations/   # cliente Supabase (auto-gerado)
supabase/
  functions/      # Edge Functions (envios, integrações, admin)
  migrations/     # schema, RLS, policies
```

## Rodando localmente

```bash
npm install
npm run dev
```

O arquivo `.env` já traz as chaves públicas do backend Lovable Cloud.

## Principais Edge Functions

- `criar-reuniao-agendamento` — cria a reunião e dispara envios (Gmail, WhatsApp, Bitrix)
- `enviar-minuta-validacao` / `enviar-contrato-assinatura` — notificações de tratativa
- `bitrix-enviar-mensagem-cliente` / `bitrix-enviar-documento-cliente` — chat do cliente no Bitrix (via imopenlines + Disk)
- `pipedrive-criar-atividade` — cria atividade no negócio do imóvel
- `enviar-mensagem-chatapp` — WhatsApp via ChatApp
- `alerta-minuta-pendente` — cron de alerta para minutas não validadas
- `manage-users` / `create-admin` — administração de usuários

## Regras de negócio (resumo)

- Cada UF é atendida por uma agência (ver `src/lib/agencies.ts`).
- Agências possuem dias úteis fixos, com suporte a `WORKING_DAYS_OVERRIDES` para períodos especiais.
- Fluxo de tratativa: parceiro envia minuta → gerente valida/retorna → parceiro envia contrato assinado → gerente confirma.
- Cada envio dispara notificação para Cliente, Parceiro e Gerente nos canais correspondentes.

## Segurança

- RLS habilitado em todas as tabelas públicas com policies por agência/owner.
- Roles em tabela separada (`user_roles`) com função `has_role` SECURITY DEFINER.
- Edge Functions autenticadas via JWT; chamadas internas usam `x-internal-auth` com service role.
- Credenciais de terceiros (Bitrix, Pipedrive, ChatApp, Gmail) armazenadas como Secrets.

## Deploy

O projeto é hospedado pela Lovable. Push no GitHub sincroniza automaticamente com a plataforma.
