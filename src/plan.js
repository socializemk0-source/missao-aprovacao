// Regra única de "este usuário é PRO agora?". Com proUntil preenchido (passe
// PIX, ou assinatura cancelada que ainda tem período pago) vale até a data;
// PRO por assinatura ativa (proUntil vazio) vale até o cancelamento.
export function isProActive(user, now = Date.now()) {
  if (user?.plan !== 'pro') return false;
  if (!user.proUntil) return true;
  return new Date(user.proUntil).getTime() > now;
}

// Ciclos vendidos. O cliente só escolhe o ciclo; valor e duração são sempre
// decididos aqui (nunca vêm da requisição).
//  - modo "pass": pagamento único (PIX ou cartão) que dá `days` de PRO;
//  - modo "subscription": assinatura recorrente no cartão a cada `months`.
export const PLANS = {
  monthly: {
    amount: 29.90,
    days: 30,
    months: 1,
    passLabel: 'Passe PRO 30 dias',
    passTitle: 'Missão Aprovação PRO — 30 dias',
    subscriptionLabel: 'R$ 29,90/mês',
    subscriptionReason: 'Missão Aprovação PRO — mensal',
  },
  annual: {
    amount: 239.90,
    days: 365,
    months: 12,
    passLabel: 'Passe PRO anual',
    passTitle: 'Missão Aprovação PRO — 1 ano',
    subscriptionLabel: 'R$ 239,90/ano',
    subscriptionReason: 'Missão Aprovação PRO — anual',
  },
};

// "pass" (padrão): PIX comum ou cartão, sem renovação automática.
// "subscription": assinatura recorrente — no Mercado Pago só aceita cartão.
export function billingMode() {
  return process.env.MERCADOPAGO_BILLING_MODE === 'subscription' ? 'subscription' : 'pass';
}

// external_reference que mandamos ao Mercado Pago em cada cobrança: diz de
// quem é e o que foi comprado. Só vale o que volta da API do Mercado Pago
// (consultada com o nosso token), nunca o corpo de uma notificação.
const KINDS = new Set(['pass', 'sub']);

export function buildExternalReference(kind, cycle, userId) {
  return `${kind}:${cycle}:${userId}`;
}

export function parseExternalReference(ref) {
  if (typeof ref !== 'string') return null;
  const [kind, cycle, ...rest] = ref.split(':');
  const userId = rest.join(':');
  if (!KINDS.has(kind) || !Object.hasOwn(PLANS, cycle) || !userId) return null;
  return { kind, cycle, userId };
}
