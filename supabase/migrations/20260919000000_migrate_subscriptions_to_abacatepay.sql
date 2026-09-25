-- Migração da assinatura recorrente do Plano PRO de Mercado Pago (Preapproval)
-- para AbacatePay (Subscriptions). Os nomes de coluna eram específicos do
-- Mercado Pago (mp_preapproval_id, mp_payment_id) — renomeados para nomes
-- neutros de provedor, e uma nova coluna guarda o id do "customer" na
-- AbacatePay (criado uma vez por usuário, reaproveitado em toda tentativa
-- de assinatura, para não gerar clientes duplicados na conta deles).
--
-- Assinaturas em andamento no Mercado Pago (se houver) não são migradas
-- automaticamente: o valor antigo de mp_preapproval_id fica preservado na
-- coluna renomeada, mas não corresponde a nenhuma assinatura real na
-- AbacatePay. Cancele manualmente qualquer assinatura ativa no Mercado
-- Pago antes de aplicar esta migração em produção.

alter table public.subscriptions
  rename column mp_preapproval_id to provider_subscription_id;

alter table public.subscriptions
  add column if not exists provider_customer_id text;

alter table public.subscription_payments
  rename column mp_payment_id to provider_payment_id;

alter table public.subscription_payments
  rename column mp_preapproval_id to provider_subscription_id;
