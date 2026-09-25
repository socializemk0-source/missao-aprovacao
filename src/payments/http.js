// Utilitários HTTP das rotas de pagamento (fora de api/ para não virar rota
// na Vercel).
import { requireAuth } from '../../middleware/requireAuth.js';

// Na Vercel req.body já vem parseado; no Express também (express.json).
// Fallback para o stream cru, com limite, se nenhum dos dois aconteceu.
export async function readBody(req) {
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

export async function runRequireAuth(req, res) {
  let authorized = false;
  await requireAuth(req, res, () => { authorized = true; });
  return authorized; // se false, requireAuth já respondeu 401
}

// Sempre usar APP_BASE_URL quando configurada. Fallback via headers
// funciona tanto atrás do Express (server.js) quanto em runtimes
// serverless (Vercel) — nenhum dos dois garante req.protocol.
export function resolveAppBaseUrl(req) {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}
