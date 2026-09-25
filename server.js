import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import redacaoHandler from './api/redacao.js';
import authHandler from './api/auth.js';
import dataHandler from './api/data.js';
import leaderboardHandler from './api/data/leaderboard.js';
import paymentsHandler from './api/payments.js';
import paymentsWebhookHandler from './api/payments/webhook.js';
import supabaseConfigHandler from './api/config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Previne quedas inesperadas do processo Node.js por exceções assíncronas não tratadas
process.on('uncaughtException', (err) => {
  console.error('[Process Guard] Exceção capturada sem derrubar o servidor:', err?.message || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Process Guard] Rejeição de Promise capturada:', reason);
});

const app = express();
const PORT = 3000;
const publicDir = path.join(__dirname, 'public');

// 1. Cabeçalhos de Segurança HTTP (Blindagem contra MIME sniffing, XSS e vazamento de versão)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
});

// 2. Proteção de Body com limite de tamanho rigoroso (bloqueia DoS por exaustão de memória)
// `verify` guarda os bytes brutos em req.rawBody — o webhook da AbacatePay
// assina o corpo bruto (HMAC), não um JSON re-serializado por nós.
app.use(express.json({ limit: '256kb', verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

// 3. Middleware de captura de erros de parsing JSON (evita crash do Express em JSONs malformados)
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Formato JSON da requisição é inválido.' });
  }
  if (err.status === 413 || err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Tamanho da requisição excede o limite de segurança (256KB).' });
  }
  next(err);
});

// 4. Rate Limiter deslizante em memória com limpeza automática de TTL (proteção contra força bruta e DDoS)
const ipRequestWindows = new Map();
const RATE_LIMIT_CLEANUP_INTERVAL = 60 * 1000; // 1 minuto

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of ipRequestWindows.entries()) {
    if (now - record.startTime > 60000) {
      ipRequestWindows.delete(key);
    }
  }
}, RATE_LIMIT_CLEANUP_INTERVAL);

function createRateLimiter(windowMs, maxRequests, routeTag) {
  return (req, res, next) => {
    // Obter IP do cliente respeitando cabeçalhos de proxy reverso
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const key = `${routeTag}:${ip}`;
    const now = Date.now();

    let record = ipRequestWindows.get(key);
    if (!record || now - record.startTime > windowMs) {
      record = { startTime: now, count: 1 };
      ipRequestWindows.set(key, record);
    } else {
      record.count++;
    }

    if (record.count > maxRequests) {
      res.setHeader('Retry-After', Math.ceil((windowMs - (now - record.startTime)) / 1000));
      return res.status(429).json({
        error: 'Muitas tentativas detectadas. Por favor, aguarde alguns segundos antes de tentar novamente.'
      });
    }

    next();
  };
}

const authLimiter = createRateLimiter(60 * 1000, 20, 'auth'); // máx 20 req/min para autenticação
const redacaoLimiter = createRateLimiter(60 * 1000, 8, 'redacao'); // máx 8 correções/min
const apiGeneralLimiter = createRateLimiter(60 * 1000, 120, 'api_general'); // máx 120 req/min

// 5. Rotas de API protegidas
app.use('/api/auth', authLimiter, (req, res) => {
  authHandler(req, res);
});

app.all('/api/redacao', redacaoLimiter, (req, res) => {
  redacaoHandler(req, res);
});

// API de dados da plataforma (progresso, redações, ranking) — PostgreSQL
// Rotas específicas SEMPRE antes da genérica (Express casa por ordem de
// registro) — mesma topologia de arquivos que a Vercel usa em produção.
app.get('/api/data/leaderboard', apiGeneralLimiter, (req, res) => {
  leaderboardHandler(req, res);
});
app.use('/api/data', apiGeneralLimiter, (req, res) => {
  dataHandler(req, res);
});

// Pagamentos (AbacatePay) — criação de checkout de assinatura (autenticada)
// e webhook de confirmação (público, protegido por segredo + assinatura HMAC própria)
app.post('/api/payments/webhook', apiGeneralLimiter, (req, res) => {
  paymentsWebhookHandler(req, res);
});
app.post('/api/payments', apiGeneralLimiter, (req, res) => {
  paymentsHandler(req, res);
});

// Configuração pública do Supabase Client para inicialização no navegador
app.get('/api/config/supabase', apiGeneralLimiter, (req, res) => {
  supabaseConfigHandler(req, res);
});

// 6. SPA main HTML routes (ensure the latest index.html is always served)
const spaRoutes = ['/', '/jogar', '/redacao', '/cadastro', '/entrar', '/privacidade', '/missoes', '/ranking', '/dados'];
app.get(spaRoutes, (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// 7. Otimização de entrega estática com Cache-Control amigável ao mobile (assets em cache, html sempre fresco)
const staticOptions = {
  index: false,
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else if (filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.png') || filePath.endsWith('.svg')) {
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    }
  }
};

app.use(express.static(publicDir, staticOptions));
app.use(express.static(__dirname, staticOptions));

// Fallback for assets in case referenced directly
app.use('/assets', express.static(path.join(publicDir, 'assets'), staticOptions));
app.use('/assets', express.static(path.join(__dirname, 'assets'), staticOptions));

// SPA fallback for all other HTML GET routes (excluding /api)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    return res.sendFile(path.join(publicDir, 'index.html'));
  }
  next();
});

// Middleware final para captura de qualquer erro 500 não tratado em rotas
app.use((err, req, res, next) => {
  console.error('[Server Internal Error]:', err?.message || err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
