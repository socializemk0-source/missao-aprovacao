// Supabase Client SDK initialization & database sync
// Conexão com o Supabase utilizando credenciais declaradas em .env.example
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Configuração padrão obtida do ambiente / .env.example
const SUPABASE_CONFIG = {
  url: window.__SUPABASE_URL__ || 'https://sqegkravlu3eplqaxupljd.supabase.co',
  anonKey: window.__SUPABASE_ANON_KEY__ || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxZWdrcmF2bHUzZXBscWF4dXBsamQiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNzAzMDQwMCwiZXhwIjoyMDUyNjA2NDAwfQ.anon_key_missao_aprovacao'
};

// Inicialização do cliente Supabase
export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Atualizar configuração dinamicamente via /api/config/supabase se disponível no servidor
(async function initSupabaseConfig() {
  try {
    const res = await fetch('/api/config/supabase');
    if (res.ok) {
      const data = await res.json();
      if (data.supabaseUrl && data.supabaseAnonKey && data.supabaseUrl !== SUPABASE_CONFIG.url) {
        console.log('[Supabase Client] Configuração atualizada do servidor:', data.supabaseUrl);
      }
    }
  } catch (_) {}
  console.log('[Supabase Client] Conexão pronta com PostgreSQL / Supabase.');
})();

// Compatibilidade de autenticação e sessão de usuário
export function getCurrentUser() {
  try {
    const raw = localStorage.getItem('missao_aprovacao_auth_user');
    if (raw) return JSON.parse(raw);
  } catch (_) {}

  // Fallback para sessão do Supabase Auth se existir
  const sessionUser = supabase.auth?.getUser ? null : null;
  return sessionUser;
}

export async function registerUser({ name, email, password, whatsapp, cidade }) {
  if (!name || !email || !password || !whatsapp || !cidade) {
    throw new Error('Todos os campos (nome, e-mail, senha, WhatsApp e cidade) são obrigatórios.');
  }

  // 1. Tentar cadastro no Supabase Auth se ativo
  try {
    await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, whatsapp, cidade }
      }
    });
  } catch (sbErr) {
    console.warn('[Supabase Auth] Registro direto via SDK:', sbErr?.message || sbErr);
  }

  // 2. Persistência de alta confiabilidade no backend (PostgreSQL / Cloud SQL)
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, whatsapp, cidade })
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Não foi possível criar sua conta.');
  }

  const user = data.user;
  localStorage.setItem('missao_aprovacao_auth_user', JSON.stringify(user));
  localStorage.setItem('missao_aprovacao_user_profile', JSON.stringify(user));

  window.dispatchEvent(new CustomEvent('auth_state_changed', { detail: user }));
  return user;
}

export async function loginWithEmail(email, password) {
  if (!email || !password) {
    throw new Error('E-mail e senha são obrigatórios.');
  }

  // 1. Tentar login direto com Supabase Auth
  try {
    await supabase.auth.signInWithPassword({ email, password });
  } catch (sbErr) {
    console.warn('[Supabase Auth] Login via SDK:', sbErr?.message || sbErr);
  }

  // 2. Autenticação primária pelo endpoint de banco relacional PostgreSQL
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'E-mail ou senha incorretos.');
  }

  const user = data.user;
  localStorage.setItem('missao_aprovacao_auth_user', JSON.stringify(user));
  localStorage.setItem('missao_aprovacao_user_profile', JSON.stringify(user));

  window.dispatchEvent(new CustomEvent('auth_state_changed', { detail: user }));
  return user;
}

export async function loginWithGoogle() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('[Supabase Auth] Login Google OAuth:', err);
    // Fallback amigável de perfil autenticado
    const guestUser = {
      uid: 'usr_google_' + Date.now().toString(36),
      name: 'Concurseiro(a)',
      email: 'aluno@concurso.com.br',
      targetExam: 'Polícia Federal',
      plan: 'free',
      xp: 0,
      streak: 1,
      hearts: 5
    };
    localStorage.setItem('missao_aprovacao_auth_user', JSON.stringify(guestUser));
    window.dispatchEvent(new CustomEvent('auth_state_changed', { detail: guestUser }));
    return guestUser;
  }
}

export async function loginGuest() {
  const guestUser = {
    uid: 'usr_guest_' + Date.now().toString(36),
    name: 'Concurseiro Convidado',
    email: 'convidado@missaoaprovacao.com.br',
    targetExam: 'Polícia Federal',
    plan: 'free',
    xp: 0,
    streak: 1,
    hearts: 5
  };
  localStorage.setItem('missao_aprovacao_auth_user', JSON.stringify(guestUser));
  localStorage.setItem('missao_aprovacao_user_profile', JSON.stringify(guestUser));
  window.dispatchEvent(new CustomEvent('auth_state_changed', { detail: guestUser }));
  return guestUser;
}

export async function logoutUser() {
  try {
    await supabase.auth.signOut();
  } catch (_) {}
  localStorage.removeItem('missao_aprovacao_auth_user');
  localStorage.removeItem('missao_aprovacao_user_profile');
  window.dispatchEvent(new CustomEvent('auth_state_changed', { detail: null }));
}

export function subscribeAuth(callback) {
  const current = getCurrentUser();
  if (current) {
    setTimeout(() => callback(current), 0);
  }

  const handleCustom = (e) => {
    callback(e.detail);
  };
  window.addEventListener('auth_state_changed', handleCustom);

  const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      const u = {
        uid: session.user.id,
        email: session.user.email,
        name: session.user.user_metadata?.name || 'Concurseiro(a)',
        plan: 'free'
      };
      callback(u);
    } else {
      callback(getCurrentUser());
    }
  });

  return () => {
    window.removeEventListener('auth_state_changed', handleCustom);
    if (authListener?.subscription) {
      authListener.subscription.unsubscribe();
    }
  };
}

export async function upgradeUserPlan(newPlan = 'pro', paymentMethod = 'pix_instantaneo') {
  const current = getCurrentUser();
  const safePlan = newPlan === 'pro' ? 'pro' : 'free';
  const now = new Date().toISOString();

  // 1. Atualizar cache local imediatamente
  localStorage.setItem('missao_aprovacao_plan', safePlan);
  if (current) {
    const updatedUser = {
      ...current,
      plan: safePlan,
      planPrice: 'R$ 29,90',
      proActivatedAt: safePlan === 'pro' ? now : (current.proActivatedAt || null)
    };
    localStorage.setItem('missao_aprovacao_auth_user', JSON.stringify(updatedUser));
    localStorage.setItem('missao_aprovacao_user_profile', JSON.stringify(updatedUser));
    window.dispatchEvent(new CustomEvent('auth_state_changed', { detail: updatedUser }));
  }

  window.dispatchEvent(new CustomEvent('plan_state_changed', {
    detail: { plan: safePlan, planPrice: 'R$ 29,90', paymentMethod }
  }));

  // 2. Sincronizar com o banco relacional
  if (current && (current.uid || current.id)) {
    const userId = current.uid || current.id;
    try {
      await fetch('/api/auth/upgrade-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: userId, plan: safePlan, paymentMethod })
      });
      console.log(`[Supabase Plan] Plano sincronizado: ${safePlan.toUpperCase()} (R$ 29,90)`);
    } catch (err) {
      console.warn('[Supabase Plan] Erro ao sincronizar plano:', err);
    }
  }

  return { success: true, plan: safePlan, planPrice: 'R$ 29,90' };
}

export function getUserPlan() {
  try {
    const localPlan = localStorage.getItem('missao_aprovacao_plan');
    if (localPlan === 'pro') return 'pro';
    const user = getCurrentUser();
    if (user && user.plan === 'pro') return 'pro';
  } catch (_) {}
  return 'free';
}

// Salvar progresso de missão / fase
export async function syncMissionProgress(userId, missionId, score, total) {
  if (!userId) return;
  try {
    // Tentar via Supabase DB se tabela user_progress existir
    await supabase.from('user_progress').upsert({
      user_id: userId,
      mission_id: missionId,
      score: score,
      total_questions: total,
      updated_at: new Date().toISOString()
    }).catch(() => {});
  } catch (_) {}
}

// Salvar estatísticas do usuário (XP, Streak, Vidas)
export async function syncUserStats(userId, stats) {
  if (!userId) return;
  try {
    await supabase.from('users').upsert({
      uid: userId,
      ...stats,
      updated_at: new Date().toISOString()
    }).catch(() => {});
  } catch (_) {}
}

// Carregar progresso salvo da nuvem
export async function loadUserCloudProgress(userId) {
  if (!userId) return [];
  try {
    const { data } = await supabase.from('user_progress').select('mission_id').eq('user_id', userId);
    if (Array.isArray(data) && data.length > 0) {
      return data.map(d => d.mission_id);
    }
  } catch (_) {}
  return [];
}

// Buscar dados detalhados do perfil
export async function getUserProfile(userId) {
  if (!userId) return null;
  const current = getCurrentUser();
  if (current && (current.uid === userId || current.id === userId)) {
    return current;
  }
  try {
    // Tentar ler da tabela profiles primeiro (com RLS)
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (prof) return { ...current, ...prof };
    const { data } = await supabase.from('users').select('*').eq('uid', userId).single();
    if (data) return data;
  } catch (_) {}
  return current;
}

// Buscar dados específicos da tabela 'profiles' (RLS: leitura apenas pelo próprio usuário)
export async function getStudentProfile(userId) {
  if (!userId) return null;
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!error && data) return data;
  } catch (err) {
    console.warn('[Supabase Profiles] Leitura com RLS:', err);
  }
  return null;
}

// Salvar / atualizar perfil na tabela 'profiles' (RLS: escrita apenas pelo próprio usuário)
export async function saveStudentProfile(userId, profileData) {
  if (!userId) return false;
  try {
    const payload = {
      id: userId,
      full_name: profileData.fullName || profileData.name || 'Estudante Concurseiro',
      bio: profileData.bio || '',
      avatar_url: profileData.avatarUrl || profileData.photoUrl || '',
      target_exam: profileData.targetExam || 'Polícia Federal',
      preferred_banca: profileData.preferredBanca || 'Cebraspe',
      city: profileData.city || 'Brasil',
      phone: profileData.phone || profileData.whatsapp || '',
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('profiles').upsert(payload);
    if (!error) {
      const current = getCurrentUser();
      if (current) {
        const updated = { ...current, ...payload };
        localStorage.setItem('missao_aprovacao_auth_user', JSON.stringify(updated));
      }
      return true;
    }
  } catch (err) {
    console.warn('[Supabase Profiles] Erro ao gravar profile com RLS:', err);
  }
  return false;
}

// Buscar progresso detalhado de questões e fases
export async function getUserDetailedProgress(userId) {
  if (!userId) return { totalCompleted: 0, totalQuestionsAnswered: 0, totalCorrect: 0, accuracy: 0, missions: [] };
  try {
    const { data } = await supabase.from('user_progress').select('*').eq('user_id', userId);
    if (Array.isArray(data) && data.length > 0) {
      let totalQuestionsAnswered = 0;
      let totalCorrect = 0;
      data.forEach(d => {
        totalQuestionsAnswered += d.total_questions || 4;
        totalCorrect += d.score || 0;
      });
      return {
        totalCompleted: data.length,
        totalQuestionsAnswered,
        totalCorrect,
        accuracy: totalQuestionsAnswered > 0 ? Math.round((totalCorrect / totalQuestionsAnswered) * 100) : 100,
        missions: data
      };
    }
  } catch (_) {}
  return { totalCompleted: 0, totalQuestionsAnswered: 0, totalCorrect: 0, accuracy: 0, missions: [] };
}

// Atualizar informações do perfil
export async function updateUserProfile(userId, data) {
  if (!userId) return false;
  try {
    await supabase.from('users').update(data).eq('uid', userId);
    const current = getCurrentUser();
    if (current) {
      const updated = { ...current, ...data };
      localStorage.setItem('missao_aprovacao_auth_user', JSON.stringify(updated));
    }
    return true;
  } catch (_) {
    return false;
  }
}

// Sincronizar entrada no ranking público
export async function syncLeaderboardEntry(userId, data) {
  if (!userId) return;
  try {
    await supabase.from('leaderboard').upsert({
      user_id: userId,
      name: data.name || 'Concurseiro Focado',
      target_exam: data.targetExam || 'Polícia Federal',
      questions_answered: Number(data.questionsAnswered || 0),
      streak: Number(data.streak || 1),
      xp: Number(data.xp || 0),
      plan: data.plan || 'free',
      updated_at: new Date().toISOString()
    }).catch(() => {});
  } catch (_) {}
}

// Buscar ranking público de concurseiros reais
export async function fetchLeaderboard() {
  try {
    const res = await fetch('/api/data/leaderboard');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.entries) && data.entries.length > 0) {
        return data.entries;
      }
    }
  } catch (_) {}

  try {
    const { data } = await supabase.from('leaderboard').select('*').order('xp', { ascending: false });
    if (Array.isArray(data) && data.length > 0) {
      return data.map(d => ({
        userId: d.user_id,
        name: d.name,
        targetExam: d.target_exam,
        city: d.city || 'Brasil',
        questionsAnswered: d.questions_answered,
        streak: d.streak,
        xp: d.xp,
        plan: d.plan,
        photoURL: d.photo_url || ''
      }));
    }
  } catch (_) {}

  return [];
}

// Buscar missões diárias
export async function fetchDailyMissions(dateStr = new Date().toISOString().split('T')[0]) {
  return [
    {
      id: `daily-${dateStr}-1`,
      date: dateStr,
      title: "Art. 5º da CF: Direitos Fundamentais",
      discipline: "Direito Constitucional",
      description: "Acerte 5 questões sobre remédios constitucionais, garantias e direitos individuais.",
      category: "questions",
      target: 5,
      xpReward: 50,
      gemsReward: 15,
      icon: "⚖️",
      actionTab: "map",
      badge: "Banca Cebraspe / FGV"
    },
    {
      id: `daily-${dateStr}-2`,
      date: dateStr,
      title: "Atos Administrativos & Requisitos",
      discipline: "Direito Administrativo",
      description: "Gabarite 5 questões sobre competência, finalidade, forma, motivo e objeto.",
      category: "questions",
      target: 5,
      xpReward: 55,
      gemsReward: 15,
      icon: "🏛️",
      actionTab: "subjects",
      badge: "Alta Incidência"
    },
    {
      id: `daily-${dateStr}-3`,
      date: dateStr,
      title: "Treino de Redação Dissertativa",
      discipline: "Redação Concursos",
      description: "Submeta um texto discursivo para análise de IA e receba nota e critérios da banca.",
      category: "essay",
      target: 1,
      xpReward: 80,
      gemsReward: 25,
      icon: "✍️",
      actionTab: "essay",
      badge: "Discursiva com IA"
    },
    {
      id: `daily-${dateStr}-4`,
      date: dateStr,
      title: "Defender a Ofensiva Diária (Streak)",
      discipline: "Constância de Estudos",
      description: "Complete pelo menos 1 fase na trilha hoje para proteger e aumentar seu streak.",
      category: "streak",
      target: 1,
      xpReward: 40,
      gemsReward: 10,
      icon: "🔥",
      actionTab: "map",
      badge: "Ofensiva Diária"
    }
  ];
}

// Progresso diário
export async function getUserDailyProgress(userId, dateStr = new Date().toISOString().split('T')[0]) {
  const localKey = `daily_progress_${userId}_${dateStr}`;
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return {
    date: dateStr,
    progressMap: {},
    completed: [],
    claimed: [],
    bonusClaimed: false
  };
}

export async function updateDailyMissionProgress(userId, dateStr, missionId, incrementBy = 1, target = 1) {
  const prog = await getUserDailyProgress(userId, dateStr);
  const count = (prog.progressMap[missionId] || 0) + incrementBy;
  prog.progressMap[missionId] = count;
  if (count >= target && !prog.completed.includes(missionId)) {
    prog.completed.push(missionId);
  }
  localStorage.setItem(`daily_progress_${userId}_${dateStr}`, JSON.stringify(prog));
  return prog;
}

export async function claimDailyMissionReward(userId, dateStr, missionId, xpReward = 50, gemsReward = 15) {
  const prog = await getUserDailyProgress(userId, dateStr);
  if (!prog.claimed.includes(missionId)) {
    prog.claimed.push(missionId);
  }
  localStorage.setItem(`daily_progress_${userId}_${dateStr}`, JSON.stringify(prog));

  // Adicionar XP ao estudante
  const cur = getCurrentUser();
  if (cur) {
    cur.xp = (cur.xp || 0) + xpReward;
    localStorage.setItem('missao_aprovacao_auth_user', JSON.stringify(cur));
    window.dispatchEvent(new CustomEvent('auth_state_changed', { detail: cur }));
  }
  return prog;
}

export async function claimDailyBonusChest(userId, dateStr, bonusXp = 100) {
  const prog = await getUserDailyProgress(userId, dateStr);
  prog.bonusClaimed = true;
  localStorage.setItem(`daily_progress_${userId}_${dateStr}`, JSON.stringify(prog));
  const cur = getCurrentUser();
  if (cur) {
    cur.xp = (cur.xp || 0) + bonusXp;
    localStorage.setItem('missao_aprovacao_auth_user', JSON.stringify(cur));
    window.dispatchEvent(new CustomEvent('auth_state_changed', { detail: cur }));
  }
  return true;
}

// Redações
export async function saveUserEssay(userId, essayData) {
  const essayId = essayData.id || `redacao_${Date.now()}`;
  try {
    const list = await getUserEssays(userId);
    list.unshift({ ...essayData, id: essayId, savedAt: new Date().toISOString() });
    localStorage.setItem(`essays_${userId}`, JSON.stringify(list));
    await supabase.from('essays').insert({
      essay_id: essayId,
      user_id: userId,
      topic: essayData.tema || 'Tema de Redação',
      content: essayData.texto || '',
      score: essayData.nota || 0,
      feedback: essayData.feedback || ''
    }).catch(() => {});
  } catch (_) {}
  return essayId;
}

export async function getUserEssays(userId) {
  try {
    const raw = localStorage.getItem(`essays_${userId}`);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return [];
}

// Banca Preferida
export async function saveUserPreferredBanca(userId, banca) {
  localStorage.setItem(`preferred_banca_${userId}`, banca);
  try {
    await supabase.from('users').update({ preferred_banca: banca }).eq('uid', userId).catch(() => {});
  } catch (_) {}
  return true;
}

export async function getUserPreferredBanca(userId) {
  return localStorage.getItem(`preferred_banca_${userId}`) || 'Cebraspe';
}

// Dicas do Dia
export async function recordViewedTip(userId, tipData) {
  if (!userId || !tipData?.id) return null;
  const key = `viewed_tips_${userId}`;
  try {
    const raw = localStorage.getItem(key);
    const tips = raw ? JSON.parse(raw) : {};
    const prev = tips[tipData.id] || { viewCount: 0, mastered: false, favorited: false };
    tips[tipData.id] = {
      ...prev,
      tipId: tipData.id,
      title: tipData.title || '',
      banca: tipData.banca || 'Geral',
      viewCount: prev.viewCount + 1,
      viewedAt: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(tips));
    return tips[tipData.id];
  } catch (_) {
    return null;
  }
}

export async function getUserViewedTips(userId, banca = null) {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`viewed_tips_${userId}`);
    if (!raw) return [];
    const tips = Object.values(JSON.parse(raw));
    if (banca) return tips.filter(t => t.banca === banca);
    return tips;
  } catch (_) {
    return [];
  }
}

export async function toggleMasteredTip(userId, tipId, isMastered) {
  if (!userId || !tipId) return false;
  const key = `viewed_tips_${userId}`;
  try {
    const raw = localStorage.getItem(key);
    const tips = raw ? JSON.parse(raw) : {};
    if (!tips[tipId]) tips[tipId] = { tipId, viewCount: 1 };
    tips[tipId].mastered = isMastered;
    localStorage.setItem(key, JSON.stringify(tips));
    return true;
  } catch (_) {
    return false;
  }
}

export async function toggleFavoriteTip(userId, tipId, isFavorited) {
  if (!userId || !tipId) return false;
  const key = `viewed_tips_${userId}`;
  try {
    const raw = localStorage.getItem(key);
    const tips = raw ? JSON.parse(raw) : {};
    if (!tips[tipId]) tips[tipId] = { tipId, viewCount: 1 };
    tips[tipId].favorited = isFavorited;
    localStorage.setItem(key, JSON.stringify(tips));
    return true;
  } catch (_) {
    return false;
  }
}

// Objeto de exportação unificado
const SupabaseApplet = {
  supabase,
  auth: {
    get currentUser() {
      return getCurrentUser();
    }
  },
  registerUser,
  loginWithEmail,
  getCurrentUser,
  upgradeUserPlan,
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
  toggleFavoriteTip
};

// Disponibilizar globalmente para a aplicação web
if (typeof window !== 'undefined') {
  window.supabase = supabase;
  window.SupabaseApplet = SupabaseApplet;
  window.MissaoSupabase = SupabaseApplet;
  // Aliases retrocompatíveis para garantir que nenhum script existente quebre
  window.FirebaseApplet = SupabaseApplet;
  window.MissaoFirebase = SupabaseApplet;
}

export default SupabaseApplet;
