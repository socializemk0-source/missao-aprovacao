import { verifyWebhookSignature, verifyWebhookSecret } from '../../src/payments/abacatepay.js';
import {
  updateUser,
  syncLeaderboardEntry,
  getSubscriptionByProviderSubscriptionId,
  getSubscriptionByProviderCustomerId,
  getSubscriptionByUserId,
  upsertSubscription,
  getSubscriptionPaymentByProviderPaymentId,
  recordSubscriptionPayment,
} from '../../src/db/queries.js';

const PRO_PLAN_PRICE_LABEL = 'R$ 29,90';

// Lê o corpo BRUTO da requisição — a assinatura HMAC da AbacatePay é sobre
// os bytes exatos recebidos, não sobre um JSON re-serializado (que pode
// ter espaços/ordem de chaves diferentes e invalidar a assinatura). No
// Express (server.js), server.js grava isso em req.rawBody via a opção
// `verify` do express.json(); na Vercel (sem parsing automático), lemos o
// stream da requisição diretamente.
async function getRawBody(req) {
  if (req.rawBody) return req.rawBody.toString('utf8');
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw;
}

// O evento não repete de forma confiável o uid do nosso usuário — tenta,
// em ordem, todo campo plausível que a AbacatePay pode usar para
// identificar a assinatura/customer, sempre contra dados que NÓS mesmos
// gravamos ao criar o checkout (nunca confiando em algo vindo só do corpo).
async function resolveSubscriptionRow(data) {
  // subscription.id (subs_...) é o id definitivo; checkout.id (bill_...) é
  // o que gravamos ao criar o checkout, antes do primeiro webhook.
  for (const id of [data?.subscription?.id, data?.checkout?.id]) {
    if (!id) continue;
    const byId = await getSubscriptionByProviderSubscriptionId(id);
    if (byId) return byId;
  }

  const customerId = data?.customer?.id || data?.subscription?.customerId || data?.customerId;
  if (customerId) {
    const byCustomerId = await getSubscriptionByProviderCustomerId(customerId);
    if (byCustomerId) return byCustomerId;
  }

  const externalId = data?.subscription?.externalId || data?.checkout?.externalId || data?.payment?.externalId || data?.externalId;
  if (externalId) {
    const byUserId = await getSubscriptionByUserId(externalId);
    if (byUserId) return byUserId;
  }

  return null;
}

async function setPlan(userId, plan) {
  const updated = await updateUser(userId, plan === 'pro' ? { plan: 'pro', planPrice: PRO_PLAN_PRICE_LABEL } : { plan: 'free' });
  if (updated) {
    await syncLeaderboardEntry({
      userId,
      name: updated.name,
      targetExam: updated.targetExam || 'Polícia Federal',
      city: updated.city || 'Brasil',
      questionsAnswered: 0,
      streak: updated.streak || 1,
      xp: updated.xp || 0,
      plan,
    }).catch(() => {});
  }
}

/**
 * POST /api/payments/webhook — arquivo próprio (em vez de um sub-caminho
 * despachado por req.path) para que a rota exista de verdade tanto atrás
 * do Express (server.js) quanto no roteamento por arquivo da Vercel.
 *
 * Webhook da AbacatePay: dois fatores de autenticidade, ambos obrigatórios
 * (fail-closed se qualquer um estiver ausente ou não configurado):
 *  - ?webhookSecret= na query string, igual ao cadastrado no painel deles;
 *  - X-Webhook-Signature: HMAC-SHA256 do corpo bruto com a chave pública
 *    da AbacatePay.
 *
 * Eventos de assinatura tratados: subscription.completed/renewed (libera o
 * PRO), subscription.payment_failed (só registra, não revoga — a própria
 * AbacatePay cancela automaticamente após esgotar as tentativas) e
 * subscription.cancelled (revoga o PRO).
 */
export default async function webhookHandler(req, res, deps = {}) {
  const webhookSecret = process.env.ABACATEPAY_WEBHOOK_SECRET;
  const publicKey = process.env.ABACATEPAY_WEBHOOK_PUBLIC_KEY;

  if (!webhookSecret || !publicKey) {
    console.error('[Payments Webhook] ABACATEPAY_WEBHOOK_SECRET/ABACATEPAY_WEBHOOK_PUBLIC_KEY não configurados — recusando notificação (fail-closed).');
    return res.status(401).json({ error: 'Webhook não configurado.' });
  }

  if (!verifyWebhookSecret({ receivedSecret: req.query?.webhookSecret, expectedSecret: webhookSecret })) {
    console.warn('[Payments Webhook] Segredo da query string inválido ou ausente — notificação rejeitada.');
    return res.status(401).json({ error: 'Segredo inválido.' });
  }

  const rawBody = deps.rawBody || await getRawBody(req);
  const signatureHeader = req.headers['x-webhook-signature'];
  if (!verifyWebhookSignature({ rawBody, signatureHeader, publicKey })) {
    console.warn('[Payments Webhook] Assinatura HMAC inválida ou ausente — notificação rejeitada.');
    return res.status(401).json({ error: 'Assinatura inválida.' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Corpo da notificação não é um JSON válido.' });
  }

  const { event, data } = payload || {};

  try {
    if (event === 'subscription.completed' || event === 'subscription.renewed') {
      const row = await resolveSubscriptionRow(data);
      if (!row) {
        console.warn(`[Payments Webhook] ${event} sem assinatura local correspondente — verifique o payload:`, JSON.stringify(data));
        return res.status(200).json({ success: true, ignored: true });
      }

      const subscriptionId = data?.subscription?.id || row.providerSubscriptionId;
      await upsertSubscription({
        userId: row.userId,
        providerCustomerId: row.providerCustomerId,
        providerSubscriptionId: subscriptionId,
        status: 'active',
        amount: data?.subscription?.amount !== undefined ? data.subscription.amount / 100 : undefined,
        currency: data?.subscription?.currency,
      });
      await setPlan(row.userId, 'pro');

      const paymentId = data?.payment?.id;
      if (paymentId) {
        const already = await getSubscriptionPaymentByProviderPaymentId(String(paymentId));
        if (!already) {
          await recordSubscriptionPayment({
            providerPaymentId: String(paymentId),
            providerSubscriptionId: subscriptionId,
            userId: row.userId,
            status: data?.payment?.status,
            amount: data?.payment?.paidAmount !== undefined ? data.payment.paidAmount / 100 : undefined,
            currency: data?.subscription?.currency,
          });
        }
      }

      console.log(`[Payments] ${event} — assinatura ${subscriptionId}, usuário ${row.userId} promovido a PRO.`);
      return res.status(200).json({ success: true });
    }

    if (event === 'subscription.payment_failed') {
      const row = await resolveSubscriptionRow(data);
      if (!row) return res.status(200).json({ success: true, ignored: true });

      await upsertSubscription({
        userId: row.userId,
        providerCustomerId: row.providerCustomerId,
        providerSubscriptionId: row.providerSubscriptionId,
        status: 'payment_failed',
      });
      console.warn(`[Payments] Cobrança falhou para o usuário ${row.userId} (tentativa ${data?.retryNumber ?? '?'}).`);
      return res.status(200).json({ success: true });
    }

    if (event === 'subscription.cancelled') {
      const row = await resolveSubscriptionRow(data);
      if (!row) return res.status(200).json({ success: true, ignored: true });

      await upsertSubscription({
        userId: row.userId,
        providerCustomerId: row.providerCustomerId,
        providerSubscriptionId: row.providerSubscriptionId,
        status: 'cancelled',
      });
      await setPlan(row.userId, 'free');
      console.log(`[Payments] Assinatura cancelada (${data?.subscription?.cancelledDueTo || 'manual'}) — usuário ${row.userId} revertido para o modo gratuito.`);
      return res.status(200).json({ success: true });
    }

    // Outros tópicos (trial_started, etc.) — confirma recebimento sem agir.
    return res.status(200).json({ success: true, ignored: true });
  } catch (err) {
    console.error('[Payments Webhook] Erro ao processar notificação:', err.message);
    // 5xx faz a AbacatePay reenviar depois — correto para falhas transitórias.
    return res.status(500).json({ error: 'Erro ao processar notificação.' });
  }
}
