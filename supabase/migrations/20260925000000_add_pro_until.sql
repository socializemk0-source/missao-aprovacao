-- Passe PRO pago por PIX avulso (ABACATEPAY_BILLING_MODE=pass): o PRO passa
-- a ter data de validade. NULL = sem validade (PRO por assinatura recorrente,
-- que é revogado pelo webhook subscription.cancelled).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pro_until timestamptz;
