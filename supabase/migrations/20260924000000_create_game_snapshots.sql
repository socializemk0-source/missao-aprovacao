-- Progresso da trilha na nuvem: o snapshot completo do estado do jogo
-- (o mesmo JSON que o jogo grava no localStorage), um por usuário.
--
-- O jogo valida o próprio estado com rigor ao carregar (o XP precisa bater
-- com a soma dos acertos registrados), então o servidor não mescla campos:
-- guarda o snapshot inteiro e só o substitui por outro com XP maior ou
-- igual — um aparelho com menos progresso nunca sobrescreve a nuvem.
CREATE TABLE IF NOT EXISTS public.game_snapshots (
  user_id text PRIMARY KEY,
  state text NOT NULL,
  xp integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.game_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Game snapshots select own only" ON public.game_snapshots;

CREATE POLICY "Game snapshots select own only"
ON public.game_snapshots FOR SELECT
USING ((select auth.uid())::text = user_id);

-- Sem política de INSERT/UPDATE para o papel "authenticated": só o
-- backend (conexão direta, fora do RLS de PostgREST) grava aqui, aplicando
-- a regra de "nunca regredir".
