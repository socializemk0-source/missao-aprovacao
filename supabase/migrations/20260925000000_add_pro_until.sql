-- PRO com data de validade: passe pago uma vez (PIX ou cartão) ou assinatura
-- cancelada que ainda tem período pago. NULL = sem validade (assinatura
-- recorrente ativa).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pro_until timestamptz;
