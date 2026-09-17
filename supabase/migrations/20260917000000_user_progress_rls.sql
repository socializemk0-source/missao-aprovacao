-- Supabase Row Level Security (RLS) Policies para public.user_progress
-- Garante que usuários autenticados só possam acessar e manipular seus próprios dados de progresso na trilha de estudos.
-- Nota: No Supabase, as funções auth.uid() e o schema auth são gerenciados nativamente pela plataforma.

-- 1. Habilitação de Row Level Security (RLS) na tabela de progresso
ALTER TABLE IF EXISTS public.user_progress ENABLE ROW LEVEL SECURITY;

-- 2. Remoção de políticas pré-existentes para garantir idempotência
DROP POLICY IF EXISTS "Enable read access for own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Enable insert access for own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Enable update access for own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Enable delete access for own progress" ON public.user_progress;
DROP POLICY IF EXISTS "User progress select own only" ON public.user_progress;
DROP POLICY IF EXISTS "User progress insert own only" ON public.user_progress;
DROP POLICY IF EXISTS "User progress update own only" ON public.user_progress;
DROP POLICY IF EXISTS "User progress delete own only" ON public.user_progress;

-- 3. Política de Leitura (SELECT): Usuários autenticados só podem ler o próprio progresso
CREATE POLICY "User progress select own only"
ON public.user_progress
FOR SELECT
TO authenticated
USING (
  (select auth.uid())::text = user_id::text
);

-- 4. Política de Inserção (INSERT): Usuários autenticados só podem inserir o próprio progresso
CREATE POLICY "User progress insert own only"
ON public.user_progress
FOR INSERT
TO authenticated
WITH CHECK (
  (select auth.uid())::text = user_id::text
);

-- 5. Política de Atualização (UPDATE): Usuários autenticados só podem atualizar o próprio progresso
CREATE POLICY "User progress update own only"
ON public.user_progress
FOR UPDATE
TO authenticated
USING (
  (select auth.uid())::text = user_id::text
)
WITH CHECK (
  (select auth.uid())::text = user_id::text
);

-- 6. Política de Exclusão (DELETE): Usuários autenticados só podem deletar o próprio progresso
CREATE POLICY "User progress delete own only"
ON public.user_progress
FOR DELETE
TO authenticated
USING (
  (select auth.uid())::text = user_id::text
);
