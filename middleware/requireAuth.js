// Middleware de autenticação — valida o access token do Supabase Auth e
// popula req.user.uid como ÚNICA fonte confiável de identidade.
//
// Nenhuma rota protegida por este middleware pode voltar a ler
// req.body.uid / req.body.userId / req.query.uid / req.query.userId para
// decidir "quem é o usuário" (ver auditoria CRITICAL-3).
//
// Testável sem rede: use createRequireAuth(verifyToken) com um verificador
// injetado (ver tests/require-auth-middleware.test.js). O import do SDK do
// Supabase é preguiçoso (dynamic import) para que testar este módulo nunca
// exija node_modules instalado nem acesso à rede.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://missao-aprovacao.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

let cachedClientPromise = null;
function getSupabaseClient() {
  if (!cachedClientPromise) {
    cachedClientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
    );
  }
  return cachedClientPromise;
}

// Verificador padrão: valida o JWT chamando o servidor de Auth do Supabase
// (supabase.auth.getUser), que confere assinatura, expiração e revogação
// sem que o backend precise guardar nenhum segredo de assinatura.
async function defaultVerifyToken(token) {
  if (!SUPABASE_ANON_KEY) {
    console.error('[requireAuth] SUPABASE_ANON_KEY não configurada — recusando autenticação (fail-closed).');
    return null;
  }
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  // user_metadata vem do que foi passado em supabase.auth.signUp({options:{data}})
  // no cadastro — usado só como fallback para AUTORRECUPERAR o perfil de
  // aplicação de um usuário já confirmado que nunca teve essa linha criada
  // (ver api/auth.js, ação get-profile). Nunca é a fonte de autorização.
  const metadata = data.user.user_metadata || {};
  return {
    uid: data.user.id,
    email: data.user.email || null,
    name: typeof metadata.name === 'string' ? metadata.name : null,
    whatsapp: typeof metadata.whatsapp === 'string' ? metadata.whatsapp : null,
    cidade: typeof metadata.cidade === 'string' ? metadata.cidade : null,
  };
}

// Extrai o token do header "Authorization: Bearer <token>".
function extractBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  return match ? match[1].trim() : null;
}

// Fábrica: permite injetar um verifyToken de teste (sem rede/sem Supabase real).
export function createRequireAuth(verifyToken = defaultVerifyToken) {
  return async function requireAuth(req, res, next) {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Autenticação necessária. Faça login novamente.' });
    }

    let identity = null;
    try {
      identity = await verifyToken(token);
    } catch (err) {
      console.warn('[requireAuth] Falha ao verificar token:', err?.message || err);
      identity = null;
    }

    if (!identity || !identity.uid) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
    }

    req.user = identity;
    return next();
  };
}

export const requireAuth = createRequireAuth();
export default requireAuth;
