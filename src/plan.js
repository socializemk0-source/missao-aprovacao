// Regra única de "este usuário é PRO agora?". Um passe (proUntil preenchido)
// vale até a data; PRO por assinatura (proUntil vazio) vale até o webhook de
// cancelamento reverter o plano.
export function isProActive(user, now = Date.now()) {
  if (user?.plan !== 'pro') return false;
  if (!user.proUntil) return true;
  return new Date(user.proUntil).getTime() > now;
}

// Passes vendidos no modo ABACATEPAY_BILLING_MODE=pass (PIX avulso).
export const PASSES = {
  monthly: { productEnv: 'ABACATEPAY_PASS_PRODUCT_ID', days: 30, amount: 29.90, label: 'Passe PRO 30 dias' },
  annual: { productEnv: 'ABACATEPAY_PASS_PRODUCT_ID_ANNUAL', days: 365, amount: 239.90, label: 'Passe PRO anual' },
};

// Qual passe um produto pago representa — só produtos que nós configuramos.
export function passForProductId(productId) {
  if (!productId) return null;
  return Object.values(PASSES).find((p) => process.env[p.productEnv] && process.env[p.productEnv] === productId) || null;
}

export function billingMode() {
  return process.env.ABACATEPAY_BILLING_MODE === 'pass' ? 'pass' : 'subscription';
}
