import { requireAuth } from '../middleware/requireAuth.js';
import { createAbacatePayClient } from '../src/payments/abacatepay.js';
import { getSubscriptionByUserId, upsertSubscription } from '../src/db/queries.js';
import { billingMode, PASSES } from '../src/plan.js';

// Ciclos vendidos. O cliente só escolhe o ciclo; produto e valor são
// sempre decididos aqui (nunca vêm da requisição).
const PLANS = {
  monthly: { productEnv: 'ABACATEPAY_PRODUCT_ID', amount: 29.90, label: 'mensal' },
  annual: { productEnv: 'ABACATEPAY_PRODUCT_ID_ANNUAL', amount: 239.90, label: 'anual' },
};

// Na Vercel req.body já vem parseado; no Express também (express.json).
// Fallback para o stream cru, com limite, se nenhum dos dois aconteceu.
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); } catch { return null; }
  }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 16 * 1024) return null;
  }
  try { return raw ? JSON.parse(raw) : {}; } catch { return null; }
}

async function runRequireAuth(req, res) {
  let authorized = false;
  await requireAuth(req, res, () => { authorized = true; });
  return authorized; // se false, requireAuth já respondeu 401
}

// Sempre usar APP_BASE_URL quando configurada. Fallback via headers
// funciona tanto atrás do Express (server.js) quanto em runtimes
// serverless (Vercel) — nenhum dos dois garante req.protocol.
function resolveAppBaseUrl(req) {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

// Métodos aceitos no checkout da assinatura (ex.: "PIX" ou "PIX,CARD").
// Sem a variável, não mandamos nada e vale o padrão da AbacatePay (só
// CARD) — que é recusado por lojas ainda sem cartão habilitado.
function subscriptionMethods() {
  const methods = (process.env.ABACATEPAY_SUBSCRIPTION_METHODS || '')
    .split(',')
    .map((m) => m.trim().toUpperCase())
    .filter((m) => m === 'PIX' || m === 'CARD');
  return methods.length ? [...new Set(methods)] : undefined;
}

/**
 * POST /api/payments — cria um checkout de ASSINATURA da AbacatePay para o
 * PLANO PRO (mensal R$ 29,90 ou anual R$ 239,90, recorrente — body
 * { cycle: 'monthly' | 'annual' }), sempre vinculada ao usuário
 * autenticado (req.user.uid) — nunca a um uid vindo do cliente.
 *
 * Os produtos (ABACATEPAY_PRODUCT_ID e ABACATEPAY_PRODUCT_ID_ANNUAL) e o
 * webhook (URL + segredo) são
 * configurados uma vez no painel da AbacatePay — não por requisição, como
 * era no Mercado Pago.
 *
 * `deps.abacatePayClient` existe só para os testes injetarem um cliente
 * falso — em produção sempre usa o client real (API key do ambiente).
 */
export default async function paymentsHandler(req, res, deps = {}) {
  // POST-only de propósito: este handler tem efeito colateral real (cria
  // uma assinatura recorrente cobrável na AbacatePay). Sob Vercel, cada
  // arquivo em api/ responde a QUALQUER método HTTP por padrão — sem essa
  // checagem, um GET (bot, prefetch, scanner) chegando direto nesta rota
  // criaria uma assinatura de verdade.
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido.' });
  }

  if (!(await runRequireAuth(req, res))) return;

  const body = await readBody(req);
  const cycle = body?.cycle ?? 'monthly';
  if (!Object.hasOwn(PLANS, cycle)) {
    return res.status(400).json({ success: false, error: 'Plano inválido.' });
  }

  // "subscription": assinatura recorrente (exige cartão ou PIX Automático
  // liberados na loja). "pass": cobrança avulsa por PIX comum que dá 30 ou
  // 365 dias de PRO (ABACATEPAY_BILLING_MODE=pass).
  const mode = billingMode();
  const plan = mode === 'pass' ? PASSES[cycle] : PLANS[cycle];

  const productId = process.env[plan.productEnv];
  if (!productId) {
    console.error(`[Payments] ${plan.productEnv} não configurado no servidor.`);
    return res.status(503).json({ success: false, error: `Plano ${PLANS[cycle].label} indisponível no momento.` });
  }

  let client;
  try {
    client = deps.abacatePayClient || createAbacatePayClient();
  } catch (err) {
    console.error('[Payments] Cliente da AbacatePay não configurado:', err.message);
    return res.status(503).json({ success: false, error: 'Pagamentos indisponíveis no momento.' });
  }

  try {
    // Um customer por usuário — a AbacatePay deduplica por CPF/CNPJ (não
    // por e-mail), então sem reaproveitar o id já criado, toda tentativa
    // de checkout criaria um customer novo do lado deles.
    const existing = await getSubscriptionByUserId(req.user.uid);

    // upsertSubscription guarda UMA linha por usuário: criar uma segunda
    // assinatura aqui SUBSTITUIRIA o providerSubscriptionId da assinatura
    // ativa original por esta nova, perdendo pra sempre a referência
    // necessária pra cancelá-la — ela continuaria sendo cobrada sem
    // ninguém conseguir mais encontrá-la. Uma assinatura 'pending' (nunca
    // confirmada) não tem esse risco, então segue permitindo checkout novo.
    // (No modo passe não há assinatura a perder: comprar de novo só soma dias.)
    if (mode === 'subscription' && existing?.status === 'active') {
      return res.status(409).json({
        success: false,
        error: 'Você já tem uma assinatura PRO ativa.',
      });
    }

    let customerId = existing?.providerCustomerId;
    if (!customerId) {
      const customer = await client.createCustomer({ email: req.user.email });
      customerId = customer.id;
      await upsertSubscription({
        userId: req.user.uid,
        providerCustomerId: customerId,
        status: existing?.status || 'none',
      });
    }

    const baseUrl = resolveAppBaseUrl(req);
    const checkoutArgs = {
      productId,
      customerId,
      completionUrl: `${baseUrl}/?payment=success`,
      externalId: req.user.uid,
    };
    const subscription = mode === 'pass'
      ? await client.createCheckout({ ...checkoutArgs, methods: ['PIX'] })
      : await client.createSubscription({ ...checkoutArgs, methods: subscriptionMethods() });

    // Estado local otimista (pending) — o webhook subscription.completed
    // é quem confirma o pagamento de verdade e libera o PRO.
    await upsertSubscription({
      userId: req.user.uid,
      providerCustomerId: customerId,
      providerSubscriptionId: subscription.id,
      status: 'pending',
      amount: plan.amount,
    });

    return res.status(200).json({
      success: true,
      checkoutUrl: subscription.url,
    });
  } catch (err) {
    console.error('[Payments] Erro ao criar assinatura:', err.message);
    return res.status(502).json({ success: false, error: 'Não foi possível iniciar a assinatura. Tente novamente em instantes.' });
  }
}
