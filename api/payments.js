import { requireAuth } from '../middleware/requireAuth.js';
import { createAbacatePayClient } from '../src/payments/abacatepay.js';
import { getSubscriptionByUserId, upsertSubscription } from '../src/db/queries.js';

const PRO_PLAN_PRICE = 29.90;

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

/**
 * POST /api/payments — cria um checkout de ASSINATURA da AbacatePay para o
 * PLANO PRO (R$ 29,90/mês, recorrente), sempre vinculada ao usuário
 * autenticado (req.user.uid) — nunca a um uid vindo do cliente.
 *
 * O produto (id em ABACATEPAY_PRODUCT_ID) e o webhook (URL + segredo) são
 * configurados uma vez no painel da AbacatePay — não por requisição, como
 * era no Mercado Pago.
 *
 * `deps.abacatePayClient` existe só para os testes injetarem um cliente
 * falso — em produção sempre usa o client real (API key do ambiente).
 */
export default async function paymentsHandler(req, res, deps = {}) {
  if (!(await runRequireAuth(req, res))) return;

  const productId = process.env.ABACATEPAY_PRODUCT_ID;
  if (!productId) {
    console.error('[Payments] ABACATEPAY_PRODUCT_ID não configurado no servidor.');
    return res.status(503).json({ success: false, error: 'Pagamentos indisponíveis no momento.' });
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
    const subscription = await client.createSubscription({
      productId,
      customerId,
      completionUrl: `${baseUrl}/?payment=success`,
      externalId: req.user.uid,
    });

    // Estado local otimista (pending) — o webhook subscription.completed
    // é quem confirma o pagamento de verdade e libera o PRO.
    await upsertSubscription({
      userId: req.user.uid,
      providerCustomerId: customerId,
      providerSubscriptionId: subscription.id,
      status: 'pending',
      amount: PRO_PLAN_PRICE,
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
