-- =====================================================================
-- Migração Supabase: Tabela 'users' (faltante) + Assinatura Recorrente
-- (Mercado Pago Preapproval) do Plano PRO
-- =====================================================================
--
-- A tabela public.users é usada pelo backend (src/db/queries.ts) para
-- sincronizar nome, XP, streak e plano do estudante logo após o
-- cadastro/login via Supabase Auth. Ela nunca foi criada por nenhuma
-- migração anterior — sem isto, toda ação "sync-profile" falha.
--
-- As tabelas de assinatura substituem o modelo de pagamento único: o
-- Plano PRO agora é uma cobrança RECORRENTE de R$ 29,90/mês via
-- Mercado Pago Preapproval (assinaturas), não uma Preferência de
-- pagamento único.

-- 1. Tabela public.users
CREATE TABLE IF NOT EXISTS public.users (
  id serial PRIMARY KEY,
  uid text NOT NULL UNIQUE,
  email text NOT NULL,
  name text NOT NULL,
  password_hash text DEFAULT '',
  target_exam text DEFAULT 'Polícia Federal',
  preferred_banca text DEFAULT 'Cebraspe',
  city text DEFAULT 'Brasil',
  whatsapp text DEFAULT '',
  plan text DEFAULT 'free',
  plan_price text DEFAULT 'R$ 29,90',
  xp integer DEFAULT 0,
  streak integer DEFAULT 1,
  hearts integer DEFAULT 5,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own only" ON public.users;
DROP POLICY IF EXISTS "Users insert own only" ON public.users;
DROP POLICY IF EXISTS "Users update own only" ON public.users;

-- Nota: o backend acessa esta tabela por conexão direta ao Postgres
-- (SQL_HOST/SQL_USER — nunca pelo cliente com a anon key), então estas
-- políticas são uma segunda camada de defesa, não o controle de acesso
-- principal (esse é o middleware requireAuth + req.user.uid).
CREATE POLICY "Users select own only"
ON public.users FOR SELECT
USING ((select auth.uid())::text = uid);

CREATE POLICY "Users insert own only"
ON public.users FOR INSERT
WITH CHECK ((select auth.uid())::text = uid);

CREATE POLICY "Users update own only"
ON public.users FOR UPDATE
USING ((select auth.uid())::text = uid)
WITH CHECK ((select auth.uid())::text = uid);

-- =====================================================================
-- 2. Tabela public.subscriptions — estado atual da assinatura do Plano
--    PRO por usuário (1 linha por usuário, atualizada a cada evento de
--    webhook "subscription_preapproval" do Mercado Pago).
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id serial PRIMARY KEY,
  user_id text NOT NULL UNIQUE,
  mp_preapproval_id text UNIQUE,
  status text NOT NULL DEFAULT 'none', -- none | pending | authorized | paused | cancelled
  plan text DEFAULT 'pro',
  amount numeric(10,2) DEFAULT 29.90,
  currency text DEFAULT 'BRL',
  next_payment_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Subscriptions select own only" ON public.subscriptions;

CREATE POLICY "Subscriptions select own only"
ON public.subscriptions FOR SELECT
USING ((select auth.uid())::text = user_id);

-- Sem política de INSERT/UPDATE para o papel "authenticated": só o
-- backend (via conexão direta, fora do RLS de PostgREST) grava aqui,
-- nunca o cliente diretamente — vira PRO só passa pelo webhook do MP.

-- =====================================================================
-- 3. Tabela public.subscription_payments — histórico de cada cobrança
--    recorrente (idempotência pelo mp_payment_id do "authorized_payment"
--    do Mercado Pago; a mesma notificação de webhook pode chegar mais
--    de uma vez e nunca deve ser aplicada duas vezes).
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id serial PRIMARY KEY,
  mp_payment_id text NOT NULL UNIQUE,
  mp_preapproval_id text NOT NULL,
  user_id text NOT NULL,
  status text NOT NULL, -- approved | pending | rejected | ...
  amount numeric(10,2),
  currency text DEFAULT 'BRL',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Subscription payments select own only" ON public.subscription_payments;

CREATE POLICY "Subscription payments select own only"
ON public.subscription_payments FOR SELECT
USING ((select auth.uid())::text = user_id);
