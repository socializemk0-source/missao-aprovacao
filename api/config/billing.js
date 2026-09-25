// GET /api/config/billing — modo de cobrança do Plano PRO, para a tela de
// planos mostrar os textos certos: "pass" (pagamento único no PIX ou cartão
// que dá 30/365 dias) ou "subscription" (assinatura recorrente no cartão). Arquivo próprio para existir como
// função no roteamento por arquivo da Vercel.
import { billingMode } from '../../src/plan.js';

export default function billingConfigHandler(req, res) {
  return res.status(200).json({ mode: billingMode() });
}
