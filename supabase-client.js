// Supabase Client SDK — identidade, sessão e sincronização de dados.
// O Supabase Auth é a ÚNICA fonte de identidade: toda chamada a uma rota
// privada de /api/* leva o access token da sessão no header Authorization.
// O backend valida esse token (middleware/requireAuth.js) e nunca confia
// em uid/userId enviado pelo cliente.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_CONFIG = {
  url: window.__SUPABASE_URL__ || '',
  anonKey: window.__SUPABASE_ANON_KEY__ || '',
};

// Busca a configuração real do servidor ANTES de inicializar o client —
// top-level await (este script é type="module"), para nunca criar o
// client do Supabase com uma URL/chave placeholder que seria descartada
// depois sem efeito nenhum.
if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
  try {
    const res = await fetch('/api/config/supabase');
    if (res.ok) {
      const data = await res.json();
      if (data.supabaseUrl) SUPABASE_CONFIG.url = data.supabaseUrl;
      if (data.supabaseAnonKey) SUPABASE_CONFIG.anonKey = data.supabaseAnonKey;
    }
  } catch (err) {
    console.error('[Supabase Client] Não foi possível carregar a configuração do servidor:', err);
  }
}

const isConfigured = Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);
if (!isConfigured) {
  console.error('[Supabase Client] SUPABASE_URL/SUPABASE_ANON_KEY ausentes — login e sincronização com a nuvem ficarão indisponíveis.');
}

// createClient('', '') lança "supabaseUrl is required" — e como este é um
// module script sem try/catch em volta, isso derrubava a AVALIAÇÃO INTEIRA
// deste módulo (nenhum export existiria, window.MissaoFirebase nunca
// seria definido) sempre que a configuração do servidor faltasse. Sem
// configuração, usamos um stub com a mesma forma de auth.* que todo o
// resto deste arquivo já espera — cada chamador já trata `error` de
// signUp/signInWithPassword/etc. como uma falha explícita (ver
// registerUser/loginWithEmail), então isto vira uma mensagem clara de
// "serviço indisponível" em vez de quebrar a página inteira.
function createUnconfiguredSupabaseStub() {
  const configError = { message: 'Serviço de contas indisponível no momento. Tente novamente mais tarde.' };
  return {
    auth: {
      async getSession() { return { data: { session: null }, error: null }; },
      onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
      async signUp() { return { data: { user: null, session: null }, error: configError }; },
      async signInWithPassword() { return { data: { user: null, session: null }, error: configError }; },
      async signInWithOAuth() { return { data: null, error: configError }; },
      async signOut() { return { error: null }; },
    },
  };
}

export const supabase = isConfigured
  ? createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : createUnconfiguredSupabaseStub();

// -----------------------------------------------------------------------
// Sessão e token de acesso
// -----------------------------------------------------------------------

export async function getAccessToken() {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch (_) {
    return null;
  }
}

// A Oficina de Redação (React, bundle pré-compilado sem pipeline de build
// neste repositório) chama fetch('/api/redacao', ...) sem nenhum header —
// ela nunca soube que a correção passou a exigir login (necessário para
// aplicar o limite semanal do plano Grátis). Como não há como recompilar
// o bundle, interceptamos só essa chamada específica e anexamos o
// Authorization: Bearer <token> por fora, de forma transparente.
const nativeFetch = window.fetch.bind(window);
window.fetch = async function (input, init = {}) {
  const url = typeof input === 'string' ? input : input?.url || '';
  const method = (init?.method || 'GET').toUpperCase();
  if (url === '/api/redacao' && method === 'POST') {
    const token = await getAccessToken();
    if (token) {
      init = { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } };
    }
  }
  return nativeFetch(input, init);
};

// fetch com Authorization: Bearer <token> anexado automaticamente. Toda
// rota privada de /api/auth e /api/data deve ser chamada por aqui — nunca
// via fetch() cru, para nunca esquecer o token.
export async function authFetch(url, options = {}) {
  const token = await getAccessToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}

async function callApiData(action, payload = {}, method = 'POST') {
  const url = method === 'GET'
    ? `/api/data?action=${encodeURIComponent(action)}&${new URLSearchParams(payload).toString()}`
    : '/api/data';
  const res = await authFetch(url, {
    method,
    body: method === 'GET' ? undefined : JSON.stringify({ action, ...payload }),
  });
  return res.json().catch(() => ({}));
}

// -----------------------------------------------------------------------
// Identidade local (cache de UX — nunca é a fonte de autoridade de acesso)
// -----------------------------------------------------------------------

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem('missao_aprovacao_auth_user');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

function persistUser(user) {
  localStorage.setItem('missao_aprovacao_auth_user', JSON.stringify(user));
  localStorage.setItem('missao_aprovacao_user_profile', JSON.stringify(user));
  window.dispatchEvent(new CustomEvent('auth_state_changed', { detail: user }));
}

// Busca (e autorrecupera, se for a primeira vez) o perfil de um usuário que
// já está autenticado no Supabase mas ainda não tem nada em cache local —
// o caso de um login via OAuth por redirecionamento (ex.: Google): o
// Supabase autentica a sessão sozinho ao carregar a página de volta, mas
// sem isto a pessoa fica autenticada "por dentro" e o app nunca percebe.
//
// De propósito NÃO usa authFetch/getAccessToken aqui: essas funções chamam
// supabase.auth.getSession(), e esta função roda de dentro do callback do
// onAuthStateChange (subscribeAuth, mais abaixo) — chamar qualquer método
// de supabase.auth de DENTRO desse callback é o deadlock documentado pelo
// próprio Supabase (https://supabase.com/docs/guides/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0).
// O `session` recebido como parâmetro já tem o access_token pronto, então
// montamos a chamada autenticada na mão.
async function hydrateSessionUser(session) {
  const token = session?.access_token;
  if (!token) return null;
  try {
    const res = await fetch('/api/auth?action=get-profile', {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      // Erro explícito: uma falha real do servidor NUNCA deve virar
      // silenciosamente um perfil padrão gratuito persistido como se
      // tivesse dado certo.
      console.error('[Auth] Falha ao buscar perfil após autenticação:', res.status);
      return null;
    }
    const payload = await res.json().catch(() => ({}));
    const user = {
      uid: session.user.id,
      email: session.user.email,
      name: session.user.user_metadata?.name || 'Concurseiro(a)',
      plan: 'free',
      ...(payload?.profile || {}),
    };
    persistUser(user);
    return user;
  } catch (err) {
    console.error('[Auth] Erro de rede ao buscar perfil após autenticação:', err.message);
    return null;
  }
}

// -----------------------------------------------------------------------
// Cadastro / login — sempre via Supabase Auth (nunca senha no nosso backend)
// -----------------------------------------------------------------------

export async function registerUser({ name, email, password, whatsapp, cidade }) {
  if (!name || !email || !password || !whatsapp || !cidade) {
    throw new Error('Todos os campos (nome, e-mail, senha, WhatsApp e cidade) são obrigatórios.');
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, whatsapp, cidade } },
  });

  if (error) {
    throw new Error(error.message || 'Não foi possível criar sua conta.');
  }
  // Por segurança contra enumeração de e-mails, o Supabase Auth NUNCA
  // devolve um erro quando o e-mail já está cadastrado — ele responde com
  // a mesma forma de um cadastro novo (session: null), só que com
  // `identities: []`. Sem checar isso, todo re-cadastro com um e-mail já
  // existente parecia ter dado certo ("confirme seu e-mail"), mas nada era
  // criado de verdade — nem no Auth nem o perfil na nossa tabela.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('Este e-mail já está cadastrado. Faça login ou use "Esqueci minha senha".');
  }
  if (!data.session) {
    throw new Error('Cadastro criado! Confirme seu e-mail e depois faça login para continuar.');
  }

  const res = await authFetch('/api/auth', {
    method: 'POST',
    body: JSON.stringify({ action: 'sync-profile', name, whatsapp, cidade }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload.success) {
    throw new Error(payload.error || 'Não foi possível concluir o cadastro.');
  }

  const user = { ...payload.user, uid: data.user.id, email: data.user.email };
  persistUser(user);
  return user;
}

export async function loginWithEmail(email, password) {
  if (!email || !password) {
    throw new Error('E-mail e senha são obrigatórios.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(error?.message || 'E-mail ou senha incorretos.');
  }

  const res = await authFetch('/api/auth?action=get-profile');
  if (!res.ok) {
    // Login no Supabase funcionou, mas buscar o perfil falhou de verdade —
    // não finge sucesso com um perfil padrão gratuito inventado na hora.
    throw new Error('Login feito, mas não foi possível carregar seu perfil agora. Tente novamente em instantes.');
  }
  const payload = await res.json().catch(() => ({}));

  const user = {
    uid: data.user.id,
    email: data.user.email,
    name: data.user.user_metadata?.name || 'Concurseiro(a)',
    plan: 'free',
    ...(payload?.profile || {}),
  };
  persistUser(user);
  return user;
}

// Modo convidado: pseudo-conta 100% local (sem sessão no Supabase Auth).
// Não tem acesso a nenhuma rota privada do backend (authFetch simplesmente
// não terá token) — é só para deixar explorar a UI sem cadastro.
export async function loginGuest() {
  const guestUser = {
    uid: 'guest_' + Date.now().toString(36),
    name: 'Concurseiro Convidado',
    email: '',
    isGuest: true,
    isAnonymous: true, // usado pelo bundle React pra decidir o texto de "sessão temporária" no perfil
    targetExam: 'Polícia Federal',
    plan: 'free',
    xp: 0,
    streak: 1,
    hearts: 5,
  };
  persistUser(guestUser);
  return guestUser;
}

export async function loginWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
  return data;
}

export async function logoutUser() {
  try {
    await supabase.auth.signOut();
  } catch (_) {}
  localStorage.removeItem('missao_aprovacao_auth_user');
  localStorage.removeItem('missao_aprovacao_user_profile');
  localStorage.removeItem('missao_aprovacao_plan');
  window.dispatchEvent(new CustomEvent('auth_state_changed', { detail: null }));
}

export function subscribeAuth(callback) {
  const current = getCurrentUser();
  if (current) {
    setTimeout(() => callback(current), 0);
  }

  const handleCustom = (e) => callback(e.detail);
  window.addEventListener('auth_state_changed', handleCustom);

  const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT' || !session?.user) {
      if (event === 'SIGNED_OUT') persistUser(null);
      return;
    }
    // Sessão renovada/restaurada: não sobrescreve o perfil já em cache,
    // só garante que subscribers recebam o usuário atual.
    const current = getCurrentUser();
    if (current && current.uid === session.user.id) {
      callback(current);
      return;
    }
    // Sessão nova sem nada em cache local ainda (ex.: outra aba acabou de
    // logar, ou o carregamento inicial da página ainda não tinha rodado
    // quando este listener foi registrado).
    const user = await hydrateSessionUser(session);
    if (user) callback(user);
  });

  return () => {
    window.removeEventListener('auth_state_changed', handleCustom);
    authListener?.subscription?.unsubscribe();
  };
}

// -----------------------------------------------------------------------
// Plano (grátis/PRO) — o servidor é a fonte de verdade; o cache local em
// localStorage é só otimização de UX e nunca decide autorização real.
// -----------------------------------------------------------------------

// Só existe um jeito de virar PRO: pagar via AbacatePay. Cria a
// preferência de checkout autenticada (o servidor usa req.user.uid — o
// que a gente manda aqui não importa) e redireciona para lá. O plano só
// muda de verdade quando o webhook confirmar o pagamento no servidor.
export async function startProCheckout() {
  const res = await authFetch('/api/payments', { method: 'POST', body: JSON.stringify({}) });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload.success || !payload.checkoutUrl) {
    throw new Error(payload.error || 'Não foi possível iniciar o pagamento. Tente novamente.');
  }
  window.location.href = payload.checkoutUrl;
}

// Busca o plano/perfil de verdade no servidor (nunca confia em
// localStorage nem em query params do retorno do checkout) e atualiza o
// cache local de UX.
export async function refreshPlanFromServer() {
  const res = await authFetch('/api/auth?action=get-profile');
  const payload = await res.json().catch(() => ({}));
  if (payload?.profile) {
    const current = getCurrentUser();
    persistUser({ ...(current || {}), ...payload.profile });
  }
  return payload?.profile || null;
}

export async function upgradeUserPlan(newPlan = 'pro') {
  if (newPlan === 'pro') {
    return startProCheckout(); // navega para a AbacatePay — não retorna
  }

  const res = await authFetch('/api/auth', {
    method: 'POST',
    body: JSON.stringify({ action: 'downgrade-to-free' }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload.success) {
    throw new Error(payload.error || 'Não foi possível atualizar seu plano.');
  }

  const current = getCurrentUser();
  if (current) persistUser({ ...current, plan: payload.plan, planPrice: payload.planPrice });
  localStorage.setItem('missao_aprovacao_plan', payload.plan);
  window.dispatchEvent(new CustomEvent('plan_state_changed', { detail: { plan: payload.plan, planPrice: payload.planPrice } }));

  return { success: true, plan: payload.plan, planPrice: payload.planPrice };
}

export function getUserPlan() {
  // Cache de UX apenas — nenhuma rota privada do backend confia neste
  // valor; toda ação sensível é reautorizada no servidor via req.user.uid.
  const user = getCurrentUser();
  return user?.plan === 'pro' ? 'pro' : 'free';
}

// -----------------------------------------------------------------------
// Perfil / progresso / redações / dicas — tudo autenticado via authFetch
// -----------------------------------------------------------------------

export async function getUserProfile(userId) {
  const current = getCurrentUser();
  if (current && current.uid === userId) return current;
  const res = await authFetch('/api/auth?action=get-profile');
  const payload = await res.json().catch(() => ({}));
  return payload?.profile || current;
}

export async function updateUserProfile(_userId, data) {
  const res = await authFetch('/api/auth', {
    method: 'POST',
    body: JSON.stringify({ action: 'update-profile', ...data }),
  });
  const payload = await res.json().catch(() => ({}));
  if (payload?.success) {
    const current = getCurrentUser();
    if (current) persistUser({ ...current, ...payload.profile });
    return true;
  }
  return false;
}

export async function syncUserStats(_userId, stats) {
  try {
    const payload = await callApiData('save-stats', stats);
    if (payload?.user) {
      const current = getCurrentUser();
      if (current) persistUser({ ...current, ...payload.user });
    }
  } catch (_) {}
}

export async function syncMissionProgress(_userId, missionId, score, total) {
  try {
    await callApiData('save-mission', { dateStr: new Date().toISOString().split('T')[0], missionId, progress: score, target: total, completed: 1 });
  } catch (_) {}
}

export async function loadUserCloudProgress(_userId) {
  try {
    const payload = await callApiData('get-progress', {}, 'GET');
    const phases = payload?.progress?.completedPhases;
    if (typeof phases === 'string') return JSON.parse(phases);
    if (Array.isArray(phases)) return phases;
  } catch (_) {}
  return [];
}

export async function getUserDetailedProgress(_userId) {
  try {
    const payload = await callApiData('get-progress', {}, 'GET');
    const p = payload?.progress;
    if (p) {
      const total = p.totalQuestionsAnswered || 0;
      const correct = p.correctAnswers || 0;
      return {
        totalCompleted: Array.isArray(p.completedPhases) ? p.completedPhases.length : 0,
        totalQuestionsAnswered: total,
        totalCorrect: correct,
        accuracy: total > 0 ? Math.round((correct / total) * 100) : 100,
        missions: [],
      };
    }
  } catch (_) {}
  return { totalCompleted: 0, totalQuestionsAnswered: 0, totalCorrect: 0, accuracy: 0, missions: [] };
}

// -----------------------------------------------------------------------
// Ranking público — leitura sem autenticação (é intencionalmente público),
// mas com payload já reduzido no backend (ver api/data.js).
// -----------------------------------------------------------------------

export async function syncLeaderboardEntry() {
  // O ranking é recalculado no servidor a partir de save-stats/save-progress;
  // não há mais escrita direta do cliente na tabela pública.
}

export async function fetchLeaderboard() {
  try {
    const res = await fetch('/api/data/leaderboard');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.entries)) return data.entries;
    }
  } catch (_) {}
  return [];
}

// -----------------------------------------------------------------------
// Missões diárias
// -----------------------------------------------------------------------

export async function fetchDailyMissions(dateStr = new Date().toISOString().split('T')[0]) {
  return [
    { id: `daily-${dateStr}-1`, date: dateStr, title: 'Art. 5º da CF: Direitos Fundamentais', discipline: 'Direito Constitucional', description: 'Acerte 5 questões sobre remédios constitucionais, garantias e direitos individuais.', category: 'questions', target: 5, xpReward: 50, gemsReward: 15, icon: '⚖️', actionTab: 'map', badge: 'Banca Cebraspe / FGV' },
    { id: `daily-${dateStr}-2`, date: dateStr, title: 'Atos Administrativos & Requisitos', discipline: 'Direito Administrativo', description: 'Gabarite 5 questões sobre competência, finalidade, forma, motivo e objeto.', category: 'questions', target: 5, xpReward: 55, gemsReward: 15, icon: '🏛️', actionTab: 'subjects', badge: 'Alta Incidência' },
    { id: `daily-${dateStr}-3`, date: dateStr, title: 'Treino de Redação Dissertativa', discipline: 'Redação Concursos', description: 'Submeta um texto discursivo para análise de IA e receba nota e critérios da banca.', category: 'essay', target: 1, xpReward: 80, gemsReward: 25, icon: '✍️', actionTab: 'essay', badge: 'Discursiva com IA' },
    { id: `daily-${dateStr}-4`, date: dateStr, title: 'Defender a Ofensiva Diária (Streak)', discipline: 'Constância de Estudos', description: 'Complete pelo menos 1 fase na trilha hoje para proteger e aumentar seu streak.', category: 'streak', target: 1, xpReward: 40, gemsReward: 10, icon: '🔥', actionTab: 'map', badge: 'Ofensiva Diária' },
  ];
}

export async function getUserDailyProgress(userId, dateStr = new Date().toISOString().split('T')[0]) {
  try {
    const payload = await callApiData('get-missions', { dateStr }, 'GET');
    const missions = payload?.missions || [];
    const progressMap = {};
    const completed = [];
    const claimed = [];
    missions.forEach((m) => {
      progressMap[m.missionId] = m.progress;
      if (m.completed) completed.push(m.missionId);
      if (m.claimed) claimed.push(m.missionId);
    });
    return { date: dateStr, progressMap, completed, claimed, bonusClaimed: false };
  } catch (_) {
    return { date: dateStr, progressMap: {}, completed: [], claimed: [], bonusClaimed: false };
  }
}

export async function updateDailyMissionProgress(_userId, dateStr, missionId, incrementBy = 1, target = 1) {
  const prog = await getUserDailyProgress(_userId, dateStr);
  const count = (prog.progressMap[missionId] || 0) + incrementBy;
  const completed = count >= target ? 1 : 0;
  try {
    await callApiData('save-mission', { dateStr, missionId, progress: count, target, completed, claimed: prog.claimed.includes(missionId) ? 1 : 0 });
  } catch (_) {}
  prog.progressMap[missionId] = count;
  if (completed && !prog.completed.includes(missionId)) prog.completed.push(missionId);
  return prog;
}

export async function claimDailyMissionReward(userId, dateStr, missionId, xpReward = 50) {
  const prog = await getUserDailyProgress(userId, dateStr);
  try {
    await callApiData('save-mission', { dateStr, missionId, progress: prog.progressMap[missionId] || 1, target: 1, completed: 1, claimed: 1 });
  } catch (_) {}
  if (!prog.claimed.includes(missionId)) prog.claimed.push(missionId);

  const cur = getCurrentUser();
  if (cur) {
    const newXp = (cur.xp || 0) + xpReward;
    await syncUserStats(cur.uid, { xp: newXp });
  }
  return prog;
}

export async function claimDailyBonusChest(_userId, _dateStr, bonusXp = 100) {
  const cur = getCurrentUser();
  if (cur) {
    const newXp = (cur.xp || 0) + bonusXp;
    await syncUserStats(cur.uid, { xp: newXp });
  }
  return true;
}

// -----------------------------------------------------------------------
// Redações
// -----------------------------------------------------------------------

export async function saveUserEssay(_userId, essayData) {
  const essayId = essayData.id || `redacao_${Date.now()}`;
  try {
    await callApiData('save-essay', {
      essayId,
      topic: essayData.tema || 'Tema de Redação',
      banca: essayData.banca,
      content: essayData.texto || '',
      score: essayData.nota || 0,
      feedback: essayData.feedback || '',
    });
  } catch (_) {}
  return essayId;
}

export async function getUserEssays(_userId) {
  try {
    const payload = await callApiData('get-essays', {}, 'GET');
    return payload?.essays || [];
  } catch (_) {
    return [];
  }
}

// -----------------------------------------------------------------------
// Banca preferida (parte do perfil)
// -----------------------------------------------------------------------

export async function saveUserPreferredBanca(_userId, banca) {
  return updateUserProfile(null, { preferredBanca: banca });
}

export async function getUserPreferredBanca(_userId) {
  const profile = await getUserProfile(null);
  return profile?.preferredBanca || 'Cebraspe';
}

// -----------------------------------------------------------------------
// Dicas do dia
// -----------------------------------------------------------------------

export async function recordViewedTip(_userId, tipData) {
  if (!tipData?.id) return null;
  try {
    const payload = await callApiData('save-tip', {
      tipId: tipData.id,
      title: tipData.title || '',
      banca: tipData.banca || 'Geral',
      mastered: 0,
      favorited: 0,
    });
    return payload?.tip || null;
  } catch (_) {
    return null;
  }
}

export async function getUserViewedTips(_userId, banca = null) {
  try {
    const payload = await callApiData('get-tips', {}, 'GET');
    const tips = payload?.tips || [];
    return banca ? tips.filter((t) => t.banca === banca) : tips;
  } catch (_) {
    return [];
  }
}

export async function toggleMasteredTip(_userId, tipId, isMastered) {
  try {
    await callApiData('save-tip', { tipId, mastered: isMastered ? 1 : 0 });
    return true;
  } catch (_) {
    return false;
  }
}

export async function toggleFavoriteTip(_userId, tipId, isFavorited) {
  try {
    await callApiData('save-tip', { tipId, favorited: isFavorited ? 1 : 0 });
    return true;
  } catch (_) {
    return false;
  }
}

// -----------------------------------------------------------------------
// Objeto de exportação unificado (compatibilidade com scripts vanilla)
// -----------------------------------------------------------------------

const SupabaseApplet = {
  supabase,
  auth: { get currentUser() { return getCurrentUser(); } },
  getAccessToken,
  authFetch,
  registerUser,
  loginWithEmail,
  getCurrentUser,
  upgradeUserPlan,
  startProCheckout,
  refreshPlanFromServer,
  getUserPlan,
  loginWithGoogle,
  loginGuest,
  logoutUser,
  subscribeAuth,
  getUserProfile,
  getUserDetailedProgress,
  updateUserProfile,
  syncUserStats,
  syncMissionProgress,
  loadUserCloudProgress,
  syncLeaderboardEntry,
  fetchLeaderboard,
  fetchDailyMissions,
  getUserDailyProgress,
  updateDailyMissionProgress,
  claimDailyMissionReward,
  claimDailyBonusChest,
  saveUserEssay,
  getUserEssays,
  saveUserPreferredBanca,
  getUserPreferredBanca,
  recordViewedTip,
  getUserViewedTips,
  toggleMasteredTip,
  toggleFavoriteTip,
};

if (typeof window !== 'undefined') {
  window.supabase = supabase;
  window.SupabaseApplet = SupabaseApplet;
  window.MissaoSupabase = SupabaseApplet;
  window.FirebaseApplet = SupabaseApplet; // alias retrocompatível para tico-*.js
  window.MissaoFirebase = SupabaseApplet;
}

// -----------------------------------------------------------------------
// Login por OAuth (Google) volta pra página inicial após o redirecionamento
// do provedor — não passa por /cadastro nem /entrar, então nenhum código
// desses formulários roda. Sem isto, quem loga com Google fica autenticado
// no Supabase mas o app nunca chega a perceber (subscribeAuth só é
// escutado por quem chama, e a landing page não chama). Roda uma vez, sem
// depender de nenhum componente pedir isso.
(async function hydrateFreshSessionOnLoad() {
  try {
    if (getCurrentUser()) return; // já tem cache local — nada a fazer aqui
    const { data } = await supabase.auth.getSession();
    if (!data?.session?.user) return;
    const user = await hydrateSessionUser(data.session);
    if (user && window.location.pathname === '/') {
      window.location.href = '/jogar';
    }
  } catch (_) {
    // Sem sessão válida ainda (ou servidor indisponível) — segue normal.
  }
})();

export default SupabaseApplet;
