-- Schema public (V1): a chave pública (anon) não acessa nada; quem está logado
-- só LÊ o que é seu. Idempotente e independente do que foi feito no dashboard.
--
-- Por quê: o site do V1 foi desligado (04/10/2026); as tabelas ficam só como
-- histórico. O V2 não usa o schema public (tudo dele está em v2.*, acessado
-- só pelo servidor). Então o mínimo necessário é: anon sem nada; logado lê os
-- próprios dados; ninguém grava pela Data API.
--
-- Para CADA tabela do public (inclusive as criadas só no dashboard, como
-- practice_backups e user_settings):
--   1. liga a RLS;
--   2. apaga TODAS as políticas existentes (inclusive as de dashboard, como a
--      antiga leitura pública do leaderboard) e cria as explícitas abaixo;
--   3. tira de anon todas as permissões; de authenticated, tudo menos SELECT
--      (TRUNCATE, por exemplo, não passa pela RLS);
--   4. políticas explícitas por comando:
--        SELECT  — authenticated: só a linha cujo dono é auth.uid()
--                  (dono = user_id, ou uid, ou o id do profiles);
--                  anon: negado (restritiva, false);
--                  tabela sem coluna de dono: negado para todos.
--        INSERT, UPDATE, DELETE — anon e authenticated: negados (restritivas, false).
-- Funções do public: EXECUTE tirado de PUBLIC e anon (inclusive das futuras).
-- O servidor (service_role e o dono das tabelas) não é afetado.

DO $$
DECLARE
  t record;
  pol record;
  dono text;
  expr text;
  papeis_existem boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
                        AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated');
BEGIN
  IF NOT papeis_existem THEN
    RAISE NOTICE 'papéis anon/authenticated não existem: nada a fazer';
    RETURN;
  END IF;

  FOR t IN
    SELECT c.relname
    FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p')
    ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);

    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t.relname LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t.relname);
    END LOOP;

    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t.relname);
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t.relname);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t.relname);

    -- Coluna de dono. Atribuição (:=), não "SELECT ... INTO": o SQL Editor do
    -- Supabase lê "SELECT ... INTO dono" como criação da tabela "dono" e enfia
    -- um ALTER TABLE no meio do bloco, quebrando o script.
    dono := CASE
             WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.relname AND column_name = 'user_id') THEN 'user_id'
             WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.relname AND column_name = 'uid') THEN 'uid'
             WHEN t.relname = 'profiles' AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.relname AND column_name = 'id') THEN 'id'
             ELSE NULL
           END;

    IF dono IS NOT NULL THEN
      expr := format('((select auth.uid())::text = %I::text)', dono);
      EXECUTE format('CREATE POLICY "select: dono le os proprios dados" ON public.%I FOR SELECT TO authenticated USING %s', t.relname, expr);
    ELSE
      EXECUTE format('CREATE POLICY "select: sem dono, ninguem le" ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (false)', t.relname);
    END IF;
    EXECUTE format('CREATE POLICY "select: anon nao le" ON public.%I AS RESTRICTIVE FOR SELECT TO anon USING (false)', t.relname);
    EXECUTE format('CREATE POLICY "insert: ninguem grava pela api" ON public.%I AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false)', t.relname);
    EXECUTE format('CREATE POLICY "update: ninguem altera pela api" ON public.%I AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false)', t.relname);
    EXECUTE format('CREATE POLICY "delete: ninguem apaga pela api" ON public.%I AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false)', t.relname);
  END LOOP;

  -- Sequências e funções: anon sem nada.
  REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
  REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
END $$;
