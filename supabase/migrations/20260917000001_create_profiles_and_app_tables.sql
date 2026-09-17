-- =====================================================================
-- Migração Supabase: Tabela 'profiles' e Tabelas Essenciais da Aplicação
-- Correção de Permissão & Resiliência de Colunas (id / user_id)
-- =====================================================================

-- 1. Garante que a tabela public.profiles exista e possua a coluna 'id'
DO $$
DECLARE
  v_id_type text := 'uuid';
BEGIN
  -- Detecta o tipo do id em auth.users (uuid no Supabase)
  SELECT data_type INTO v_id_type
  FROM information_schema.columns
  WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'id';

  -- Se a tabela profiles não existe, cria com id vinculado a auth.users
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    IF v_id_type = 'uuid' THEN
      EXECUTE '
        CREATE TABLE public.profiles (
          id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
          full_name text NOT NULL DEFAULT ''Estudante Concurseiro'',
          bio text DEFAULT '''',
          avatar_url text DEFAULT '''',
          target_exam text DEFAULT ''Polícia Federal'',
          preferred_banca text DEFAULT ''Cebraspe'',
          city text DEFAULT ''Brasil'',
          phone text DEFAULT '''',
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        )';
    ELSE
      EXECUTE '
        CREATE TABLE public.profiles (
          id text PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
          full_name text NOT NULL DEFAULT ''Estudante Concurseiro'',
          bio text DEFAULT '''',
          avatar_url text DEFAULT '''',
          target_exam text DEFAULT ''Polícia Federal'',
          preferred_banca text DEFAULT ''Cebraspe'',
          city text DEFAULT ''Brasil'',
          phone text DEFAULT '''',
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        )';
    END IF;
  ELSE
    -- Se a tabela profiles já existia anteriormente, verifica e ajusta a coluna de identificação
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id') THEN
        ALTER TABLE public.profiles RENAME COLUMN user_id TO id;
      ELSE
        ALTER TABLE public.profiles ADD COLUMN id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
      END IF;
    END IF;
  END IF;
END $$;

-- 2. Garante todas as colunas necessárias na tabela public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text DEFAULT 'Estudante Concurseiro';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_exam text DEFAULT 'Polícia Federal';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_banca text DEFAULT 'Cebraspe';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city text DEFAULT 'Brasil';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 3. Tabela public.user_progress (Progresso na trilha de 37 capítulos e 111 fases)
CREATE TABLE IF NOT EXISTS public.user_progress (
  id serial PRIMARY KEY,
  user_id text NOT NULL,
  completed_phases text DEFAULT '[]',
  total_questions_answered integer DEFAULT 0,
  correct_answers integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- 4. Tabela public.leaderboard (Quadro de Honra e Ranking Geral de Concurseiros)
CREATE TABLE IF NOT EXISTS public.leaderboard (
  id serial PRIMARY KEY,
  user_id text NOT NULL UNIQUE,
  name text NOT NULL,
  target_exam text DEFAULT 'Polícia Federal',
  city text DEFAULT 'Brasil',
  questions_answered integer DEFAULT 0,
  streak integer DEFAULT 1,
  xp integer DEFAULT 0,
  plan text DEFAULT 'free',
  photo_url text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

-- 5. Tabela public.essays (Redações Discursivas Avaliadas com IA)
CREATE TABLE IF NOT EXISTS public.essays (
  id serial PRIMARY KEY,
  essay_id text NOT NULL UNIQUE,
  user_id text NOT NULL,
  topic text NOT NULL,
  banca text DEFAULT 'Cebraspe',
  content text NOT NULL,
  score integer DEFAULT 0,
  feedback text DEFAULT '',
  criterios text DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- 6. Tabela public.daily_missions (Missões Diárias de Aprendizagem)
CREATE TABLE IF NOT EXISTS public.daily_missions (
  id serial PRIMARY KEY,
  user_id text NOT NULL,
  date_str text NOT NULL,
  mission_id text NOT NULL,
  progress integer DEFAULT 0,
  target integer DEFAULT 1,
  completed integer DEFAULT 0,
  claimed integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- 7. Tabela public.viewed_tips (Dicas e Macetes das Bancas Examinadoras)
CREATE TABLE IF NOT EXISTS public.viewed_tips (
  id serial PRIMARY KEY,
  user_id text NOT NULL,
  tip_id text NOT NULL,
  title text NOT NULL,
  banca text DEFAULT 'Geral',
  view_count integer DEFAULT 1,
  mastered integer DEFAULT 0,
  favorited integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- =====================================================================
-- HABILITAÇÃO DO ROW LEVEL SECURITY (RLS) EM TODAS AS TABELAS
-- =====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.essays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewed_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- POLÍTICAS RLS PARA PROFILES (Leitura estrita apenas pelo próprio usuário)
-- =====================================================================

DROP POLICY IF EXISTS "Profiles select own only" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insert own only" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update own only" ON public.profiles;
DROP POLICY IF EXISTS "Profiles delete own only" ON public.profiles;

CREATE POLICY "Profiles select own only"
ON public.profiles FOR SELECT
USING (
  (select auth.uid())::text = id::text
);

CREATE POLICY "Profiles insert own only"
ON public.profiles FOR INSERT
WITH CHECK (
  (select auth.uid())::text = id::text
);

CREATE POLICY "Profiles update own only"
ON public.profiles FOR UPDATE
USING (
  (select auth.uid())::text = id::text
)
WITH CHECK (
  (select auth.uid())::text = id::text
);

CREATE POLICY "Profiles delete own only"
ON public.profiles FOR DELETE
USING (
  (select auth.uid())::text = id::text
);

-- =====================================================================
-- POLÍTICAS RLS PARA USER_PROGRESS
-- =====================================================================

DROP POLICY IF EXISTS "User progress select own only" ON public.user_progress;
DROP POLICY IF EXISTS "User progress insert own only" ON public.user_progress;
DROP POLICY IF EXISTS "User progress update own only" ON public.user_progress;
DROP POLICY IF EXISTS "User progress delete own only" ON public.user_progress;

CREATE POLICY "User progress select own only"
ON public.user_progress FOR SELECT
USING (
  (select auth.uid())::text = user_id::text
);

CREATE POLICY "User progress insert own only"
ON public.user_progress FOR INSERT
WITH CHECK (
  (select auth.uid())::text = user_id::text
);

CREATE POLICY "User progress update own only"
ON public.user_progress FOR UPDATE
USING (
  (select auth.uid())::text = user_id::text
)
WITH CHECK (
  (select auth.uid())::text = user_id::text
);

CREATE POLICY "User progress delete own only"
ON public.user_progress FOR DELETE
USING (
  (select auth.uid())::text = user_id::text
);

-- =====================================================================
-- POLÍTICAS RLS PARA ESSAYS
-- =====================================================================

DROP POLICY IF EXISTS "Essays select own only" ON public.essays;
DROP POLICY IF EXISTS "Essays insert own only" ON public.essays;
DROP POLICY IF EXISTS "Essays update own only" ON public.essays;

CREATE POLICY "Essays select own only"
ON public.essays FOR SELECT
USING (
  (select auth.uid())::text = user_id::text
);

CREATE POLICY "Essays insert own only"
ON public.essays FOR INSERT
WITH CHECK (
  (select auth.uid())::text = user_id::text
);

CREATE POLICY "Essays update own only"
ON public.essays FOR UPDATE
USING (
  (select auth.uid())::text = user_id::text
)
WITH CHECK (
  (select auth.uid())::text = user_id::text
);

-- =====================================================================
-- POLÍTICAS RLS PARA DAILY_MISSIONS
-- =====================================================================

DROP POLICY IF EXISTS "Missions select own only" ON public.daily_missions;
DROP POLICY IF EXISTS "Missions insert own only" ON public.daily_missions;
DROP POLICY IF EXISTS "Missions update own only" ON public.daily_missions;

CREATE POLICY "Missions select own only"
ON public.daily_missions FOR SELECT
USING (
  (select auth.uid())::text = user_id::text
);

CREATE POLICY "Missions insert own only"
ON public.daily_missions FOR INSERT
WITH CHECK (
  (select auth.uid())::text = user_id::text
);

CREATE POLICY "Missions update own only"
ON public.daily_missions FOR UPDATE
USING (
  (select auth.uid())::text = user_id::text
)
WITH CHECK (
  (select auth.uid())::text = user_id::text
);

-- =====================================================================
-- POLÍTICAS RLS PARA VIEWED_TIPS
-- =====================================================================

DROP POLICY IF EXISTS "Tips select own only" ON public.viewed_tips;
DROP POLICY IF EXISTS "Tips insert own only" ON public.viewed_tips;
DROP POLICY IF EXISTS "Tips update own only" ON public.viewed_tips;

CREATE POLICY "Tips select own only"
ON public.viewed_tips FOR SELECT
USING (
  (select auth.uid())::text = user_id::text
);

CREATE POLICY "Tips insert own only"
ON public.viewed_tips FOR INSERT
WITH CHECK (
  (select auth.uid())::text = user_id::text
);

CREATE POLICY "Tips update own only"
ON public.viewed_tips FOR UPDATE
USING (
  (select auth.uid())::text = user_id::text
)
WITH CHECK (
  (select auth.uid())::text = user_id::text
);

-- =====================================================================
-- POLÍTICAS RLS PARA LEADERBOARD (Leitura pública, escrita autenticada)
-- =====================================================================

DROP POLICY IF EXISTS "Leaderboard public view" ON public.leaderboard;
DROP POLICY IF EXISTS "Leaderboard user insert" ON public.leaderboard;
DROP POLICY IF EXISTS "Leaderboard user update" ON public.leaderboard;

CREATE POLICY "Leaderboard public view"
ON public.leaderboard FOR SELECT
USING (true);

CREATE POLICY "Leaderboard user insert"
ON public.leaderboard FOR INSERT
WITH CHECK (
  (select auth.uid())::text = user_id::text
);

CREATE POLICY "Leaderboard user update"
ON public.leaderboard FOR UPDATE
USING (
  (select auth.uid())::text = user_id::text
)
WITH CHECK (
  (select auth.uid())::text = user_id::text
);
