// Aplica no nosso banco o estado de um pagamento/assinatura do Mercado Pago.
// Usado pelo webhook e pela confirmação na volta do checkout — os dois
// entregam aqui o recurso RE-CONSULTADO na API do Mercado Pago (com o nosso
// token), nunca o corpo de uma notificação.
//
// Regras que corrigem a revisão de 25/09/2026:
//  - evento de assinatura só mexe na linha cuja assinatura é EXATAMENTE a
//    do evento (nada de "achar pelo usuário": uma assinatura antiga
//    cancelada não pode derrubar a atual);
//  - uma segunda assinatura autorizada enquanto outra está viva é
//    cancelada na hora (o aluno não paga duas vezes);
//  - cancelamento mantém o PRO até o fim do período já pago;
//  - ativar uma assinatura limpa o proUntil de um passe antigo vencido.

import {
  getUserByUid,
  updateUser,
  syncLeaderboardEntry,
  getSubscriptionByUserId,
  getSubscriptionByProviderSubscriptionId,
  upsertSubscription,
  recordSubscriptionPayment,
  grantProPass,
  revokeProPass,
} from '../db/queries.js';
import { PLANS, parseExternalReference } from '../plan.js';

// Assinatura que ainda gera cobrança (ativa ou tentando cobrar de novo).
export const LIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'payment_failed']);

export function futureDate(value, now = Date.now()) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date.getTime() <= now ? null : date;
}

function validDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

async function publishPlan(user) {
  if (!user) return;
  await syncLeaderboardEntry({
    userId: user.uid,
    name: user.name,
    targetExam: user.targetExam || 'Polícia Federal',
    city: user.city || 'Brasil',
    questionsAnswered: 0,
    streak: user.streak || 1,
    xp: user.xp || 0,
    plan: user.plan,
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Passe PRO (Checkout Pro, pagamento único por PIX ou cartão)
// ---------------------------------------------------------------------------
export async function applyPassPayment(payment) {
  const ref = parseExternalReference(payment?.external_reference);
  if (!ref || ref.kind !== 'pass' || !payment?.id) return { status: 'ignored' };
  const plan = PLANS[ref.cycle];
  const paymentId = String(payment.id);

  if (payment.status === 'approved') {
    const amount = Number(payment.transaction_amount);
    if (payment.currency_id !== 'BRL' || !(amount >= plan.amount - 0.005)) {
      console.warn(`[Payments] Pagamento ${paymentId} com valor/moeda inesperados (${payment.currency_id} ${payment.transaction_amount}) — PRO não liberado.`);
      return { status: 'ignored', userId: ref.userId };
    }
    const result = await grantProPass({ userId: ref.userId, paymentId, days: plan.days, amount, label: plan.passLabel });
    if (result.status === 'granted') {
      const row = await getSubscriptionByUserId(ref.userId);
      if (!row || !['active', 'payment_failed', 'pending'].includes(row.status)) {
        await upsertSubscription({ userId: ref.userId, status: 'pass_active', amount: plan.amount });
      }
      await publishPlan(result.user);
    }
    return { status: result.status, userId: ref.userId };
  }

  if (payment.status === 'refunded' || payment.status === 'charged_back') {
    const result = await revokeProPass({ userId: ref.userId, paymentId, days: plan.days });
    if (result.user) await publishPlan(result.user);
    return { status: result.status, userId: ref.userId };
  }

  // pending / in_process (PIX aguardando), rejected, cancelled: nada muda.
  return { status: 'pending', userId: ref.userId };
}

// ---------------------------------------------------------------------------
// Assinatura recorrente (preapproval)
// ---------------------------------------------------------------------------
export async function applyPreapproval(client, preapproval) {
  if (!preapproval?.id) return { status: 'ignored' };
  const ref = parseExternalReference(preapproval.external_reference);

  let row = await getSubscriptionByProviderSubscriptionId(preapproval.id);
  if (!row) {
    // Assinatura que não é a registrada para ninguém. Só uma recém
    // AUTORIZADA interessa (o aluno pagou um link nosso); qualquer outro
    // estado de uma assinatura que não é a atual é ignorado.
    if (!ref || ref.kind !== 'sub' || preapproval.status !== 'authorized') return { status: 'ignored' };
    row = await getSubscriptionByUserId(ref.userId);
    if (row && LIVE_SUBSCRIPTION_STATUSES.has(row.status) && row.providerSubscriptionId !== preapproval.id) {
      await client.cancelPreapproval(preapproval.id);
      console.warn(`[Payments] Assinatura duplicada ${preapproval.id} do usuário ${ref.userId} cancelada — a ${row.providerSubscriptionId} continua valendo.`);
      return { status: 'duplicate_cancelled', userId: ref.userId };
    }
  }

  const userId = row?.userId || ref.userId;

  if (preapproval.status === 'authorized') {
    const months = Number(preapproval.auto_recurring?.frequency);
    const plan = ref ? PLANS[ref.cycle] : (months === 12 ? PLANS.annual : PLANS.monthly);
    await upsertSubscription({
      userId,
      providerSubscriptionId: preapproval.id,
      status: 'active',
      amount: preapproval.auto_recurring?.transaction_amount ?? plan.amount,
      nextPaymentDate: validDate(preapproval.next_payment_date),
    });
    const user = await updateUser(userId, { plan: 'pro', planPrice: plan.subscriptionLabel, proUntil: null });
    await publishPlan(user);
    return { status: 'active', userId };
  }

  if (preapproval.status === 'cancelled' || preapproval.status === 'paused') {
    if (!row || row.status === 'cancelled') return { status: 'ignored', userId };
    const previousStatus = row.status;
    await upsertSubscription({ userId, providerSubscriptionId: preapproval.id, status: 'cancelled' });

    // Só mexe no plano se o PRO atual vem desta assinatura (sem data de
    // fim). Quem tem passe ou já está no período final não perde nada.
    const user = await getUserByUid(userId);
    if (user?.plan === 'pro' && !user.proUntil) {
      const periodEnd = previousStatus === 'active'
        ? futureDate(preapproval.next_payment_date) || futureDate(row.nextPaymentDate)
        : null;
      const updated = await updateUser(userId, periodEnd ? { proUntil: periodEnd } : { plan: 'free', proUntil: null });
      await publishPlan(updated);
      return { status: periodEnd ? 'cancelled_until_period_end' : 'cancelled', userId };
    }
    return { status: 'cancelled', userId };
  }

  return { status: 'pending', userId };
}

// Cada cobrança de uma assinatura (authorized_payment / "fatura").
export async function applyAuthorizedPayment(client, invoice) {
  const row = invoice?.preapproval_id ? await getSubscriptionByProviderSubscriptionId(invoice.preapproval_id) : null;
  if (!row) return { status: 'ignored' };
  const payment = invoice.payment || {};

  if (payment.status === 'approved') {
    await recordSubscriptionPayment({
      providerPaymentId: String(payment.id || `invoice-${invoice.id}`),
      providerSubscriptionId: row.providerSubscriptionId,
      userId: row.userId,
      status: 'approved',
      amount: invoice.transaction_amount,
      currency: invoice.currency_id,
    });
    if (row.status === 'cancelled') return { status: 'recorded', userId: row.userId };
    // Estado e próxima cobrança vêm da assinatura em si.
    return applyPreapproval(client, await client.getPreapproval(row.providerSubscriptionId));
  }

  if (payment.status === 'rejected' || invoice.status === 'recycling') {
    if (row.status === 'active') {
      await upsertSubscription({ userId: row.userId, providerSubscriptionId: row.providerSubscriptionId, status: 'payment_failed' });
    }
    console.warn(`[Payments] Cobrança da assinatura ${row.providerSubscriptionId} recusada (tentativa ${invoice.retry_attempt ?? '?'}) — usuário ${row.userId}.`);
    return { status: 'payment_failed', userId: row.userId };
  }

  return { status: 'pending', userId: row.userId };
}
