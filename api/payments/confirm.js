import { createMercadoPagoClient } from '../../src/payments/mercadopago.js';
import { applyPassPayment, applyPreapproval } from '../../src/payments/sync.js';
import { readBody, runRequireAuth } from '../../src/payments/http.js';
import { parseExternalReference, isProActive } from '../../src/plan.js';
import { getUserByUid } from '../../src/db/queries.js';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * POST /api/payments/confirm — chamado pela tela ao voltar do checkout do
 * Mercado Pago, com o id que ele acrescenta na URL de retorno
 * ({ paymentId } no passe, { preapprovalId } na assinatura). Não depende do
 * webhook chegar: re-consulta o recurso na API do Mercado Pago e aplica o
 * mesmo processamento do webhook (idempotente).
 *
 * Só aceita recursos cujo external_reference aponta para o próprio usuário
 * logado — ninguém confirma (nem descobre) o pagamento de outra pessoa.
 */
export default async function confirmPaymentHandler(req, res, deps = {}) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido.' });
  }
  if (!(await runRequireAuth(req, res))) return;

  const body = (await readBody(req)) || {};
  const paymentId = body.paymentId != null ? String(body.paymentId) : null;
  const preapprovalId = body.preapprovalId != null ? String(body.preapprovalId) : null;
  const id = paymentId || preapprovalId;
  if (!id || !ID_PATTERN.test(id)) {
    return res.status(400).json({ success: false, error: 'Pagamento inválido.' });
  }

  let client;
  try {
    client = deps.mercadoPagoClient || createMercadoPagoClient();
  } catch (err) {
    console.error('[Payments Confirm] Cliente do Mercado Pago não configurado:', err.message);
    return res.status(503).json({ success: false, error: 'Pagamentos indisponíveis no momento.' });
  }

  try {
    const resource = paymentId ? await client.getPayment(paymentId) : await client.getPreapproval(preapprovalId);
    const ref = parseExternalReference(resource?.external_reference);
    if (!ref || ref.userId !== req.user.uid || ref.kind !== (paymentId ? 'pass' : 'sub')) {
      return res.status(404).json({ success: false, error: 'Pagamento não encontrado.' });
    }

    const result = paymentId ? await applyPassPayment(resource) : await applyPreapproval(client, resource);
    const user = await getUserByUid(req.user.uid);
    return res.status(200).json({
      success: true,
      result: result.status,
      plan: isProActive(user) ? 'pro' : 'free',
      proUntil: user?.proUntil ?? null,
    });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ success: false, error: 'Pagamento não encontrado.' });
    }
    console.error('[Payments Confirm] Erro ao confirmar pagamento:', err.message);
    return res.status(502).json({ success: false, error: 'Não foi possível confirmar o pagamento agora.' });
  }
}
