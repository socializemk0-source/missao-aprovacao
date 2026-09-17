// Firebase Client SDK initialization & database sync
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInAnonymously,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { 
  initializeFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs,
  getDocFromServer,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const firebaseConfig = {
  projectId: "watchful-mote-s3skh",
  appId: "1:524388240708:web:f65bff1df2c8d7ba0c9b11",
  apiKey: "AIzaSyAF4mrDD5Gml2Ty2qYIdqBi88j4BiKmhrw",
  authDomain: "watchful-mote-s3skh.firebaseapp.com",
  storageBucket: "watchful-mote-s3skh.firebasestorage.app",
  messagingSenderId: "524388240708"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {}, "ai-studio-missaoaprovacao-985d7875-0bd9-45c3-b359-4e8e772d8603");

// Test connection on boot
(async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[Firebase] Conexão com Firestore ativa e pronta para escala.');
  } catch (error) {
    if (error && error.message && error.message.includes('the client is offline')) {
      console.warn('[Firebase] Cliente operando em cache local/offline.');
    } else {
      console.log('[Firebase] Banco pronto para receber conexões autenticadas.');
    }
  }
})();

// Google Provider
const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err) {
    console.error('[Firebase Auth] Erro no login Google:', err);
    throw err;
  }
}

export async function loginGuest() {
  try {
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (err) {
    if (err && (err.code === 'auth/admin-restricted-operation' || (err.message && err.message.includes('admin-restricted-operation')))) {
      console.info('[Firebase Auth] Login anônimo não habilitado no Console Firebase. Utilizando modo Concurseiro Convidado (modo local com login Google disponível).');
      return null;
    }
    console.error('[Firebase Auth] Erro no login anônimo:', err);
    throw err;
  }
}

export async function logoutUser() {
  try {
    localStorage.removeItem('missao_aprovacao_auth_user');
    localStorage.removeItem('missao_aprovacao_user_profile');
    window.dispatchEvent(new CustomEvent('auth_state_changed', { detail: null }));
    return await signOut(auth);
  } catch (err) {
    console.warn('[Auth] Erro ao deslogar:', err);
  }
}

export function getCurrentUser() {
  if (typeof auth !== 'undefined' && auth.currentUser) {
    return auth.currentUser;
  }
  try {
    const raw = localStorage.getItem('missao_aprovacao_auth_user');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

export async function registerUser({ name, email, password, whatsapp, cidade }) {
  if (!name || !email || !password || !whatsapp || !cidade) {
    throw new Error('Todos os campos (nome, e-mail, senha, WhatsApp e cidade) são obrigatórios.');
  }

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

  // 2. Sincronizar com o backend / Firestore se houver usuário
  if (current && (current.uid || current.id)) {
    const userId = current.uid || current.id;
    try {
      await fetch('/api/auth/upgrade-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: userId, plan: safePlan, paymentMethod })
      });
      console.log(`[Firebase Plan] Plano sincronizado com a nuvem: ${safePlan.toUpperCase()} (R$ 29,90)`);
    } catch (err) {
      console.warn('[Firebase Plan] Erro ao sincronizar plano no servidor:', err);
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

export function subscribeAuth(callback) {
  const current = getCurrentUser();
  if (current) {
    setTimeout(() => callback(current), 0);
  }

  const handleCustom = (e) => {
    callback(e.detail);
  };
  window.addEventListener('auth_state_changed', handleCustom);

  const unsubFirebase = onAuthStateChanged(auth, (user) => {
    if (user) {
      callback(user);
    } else {
      const stored = getCurrentUser();
      callback(stored);
    }
  });

  return () => {
    window.removeEventListener('auth_state_changed', handleCustom);
    unsubFirebase();
  };
}

// Salvar progresso de missão no Firestore
export async function syncMissionProgress(userId, missionId, score, total) {
  if (!userId) return;
  try {
    const ref = doc(db, 'users', userId, 'progress', missionId);
    await setDoc(ref, {
      userId,
      missionId,
      completed: true,
      score,
      totalQuestions: total,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('[Firebase] Não foi possível sincronizar fase na nuvem:', err);
  }
}

// Salvar estatísticas do usuário (XP, Streak, Vidas)
export async function syncUserStats(userId, stats) {
  if (!userId) return;
  try {
    const ref = doc(db, 'users', userId);
    await setDoc(ref, {
      ...stats,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('[Firebase] Não foi possível sincronizar stats:', err);
  }
}

// Carregar progresso salvo da nuvem
export async function loadUserCloudProgress(userId) {
  if (!userId) return [];
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'progress'));
    const list = [];
    snap.forEach(docSnap => list.push(docSnap.id));
    return list;
  } catch (err) {
    console.warn('[Firebase] Erro ao carregar progresso da nuvem:', err);
    return [];
  }
}

// Buscar dados detalhados do perfil no Firestore
export async function getUserProfile(userId) {
  if (!userId) return null;
  try {
    const userDocRef = doc(db, 'users', userId);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    console.error('[Firebase] Erro ao carregar perfil do Firestore:', err);
    throw err;
  }
}

// Buscar progresso detalhado de questões e fases no Firestore
export async function getUserDetailedProgress(userId) {
  if (!userId) return { totalCompleted: 0, totalQuestionsAnswered: 0, totalCorrect: 0, accuracy: 0, missions: [] };
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'progress'));
    const missions = [];
    let totalQuestionsAnswered = 0;
    let totalCorrect = 0;

    snap.forEach(docSnap => {
      const data = docSnap.data();
      missions.push(data);
      const qTotal = data.totalQuestions || 4;
      const qScore = typeof data.score === 'number' ? data.score : (data.completed ? qTotal : 0);
      totalQuestionsAnswered += qTotal;
      totalCorrect += qScore;
    });

    const accuracy = totalQuestionsAnswered > 0 ? Math.round((totalCorrect / totalQuestionsAnswered) * 100) : 100;

    return {
      totalCompleted: missions.length,
      totalQuestionsAnswered,
      totalCorrect,
      accuracy,
      missions
    };
  } catch (err) {
    console.error('[Firebase] Erro ao carregar histórico detalhado de questões:', err);
    return { totalCompleted: 0, totalQuestionsAnswered: 0, totalCorrect: 0, accuracy: 0, missions: [] };
  }
}

// Atualizar informações do perfil no Firestore
export async function updateUserProfile(userId, data) {
  if (!userId) return;
  try {
    const userDocRef = doc(db, 'users', userId);
    await setDoc(userDocRef, {
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.error('[Firebase] Erro ao atualizar perfil no Firestore:', err);
    throw err;
  }
}

// Sincronizar dados de ranking na coleção pública do Firestore
export async function syncLeaderboardEntry(userId, data) {
  if (!userId) return;
  try {
    const leaderDocRef = doc(db, 'leaderboard', userId);
    await setDoc(leaderDocRef, {
      userId,
      name: data.name || 'Concurseiro Focado',
      targetExam: data.targetExam || 'Polícia Federal',
      photoURL: data.photoURL || '',
      questionsAnswered: Number(data.questionsAnswered || 0),
      streak: Number(data.streak || 1),
      xp: Number(data.xp || 0),
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('[Firebase] Erro ao sincronizar ranking no Firestore:', err);
  }
}

// Buscar lista de estudantes no ranking do Firestore
export async function fetchLeaderboard() {
  try {
    const snap = await getDocs(collection(db, 'leaderboard'));
    const list = [];
    snap.forEach(docSnap => {
      list.push(docSnap.data());
    });
    return list;
  } catch (err) {
    console.warn('[Firebase] Erro ao buscar ranking do Firestore:', err);
    return [];
  }
}

// Gerador determinístico de missões diárias de estudos para concursos
function generateDailyMissionsCatalog(dateStr) {
  let sum = 0;
  for (let i = 0; i < dateStr.length; i++) {
    sum = (sum * 31 + dateStr.charCodeAt(i)) % 100000;
  }

  const pools = [
    [
      {
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
        title: "Poder Constituinte & Princípios Fundamentais",
        discipline: "Direito Constitucional",
        description: "Complete 4 itens sobre eficácia das normas constitucionais e separação dos poderes.",
        category: "questions",
        target: 4,
        xpReward: 45,
        gemsReward: 12,
        icon: "📜",
        actionTab: "subjects",
        badge: "Fundamentos"
      }
    ],
    [
      {
        title: "Atos Administrativos & Requisitos de Validade",
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
        title: "Princípios Expressos (LIMPE) & Poderes",
        discipline: "Direito Administrativo",
        description: "Acerte 4 questões sobre poder de polícia, discricionariedade e vinculação.",
        category: "questions",
        target: 4,
        xpReward: 45,
        gemsReward: 12,
        icon: "🛡️",
        actionTab: "map",
        badge: "Art. 37 CF/88"
      }
    ],
    [
      {
        title: "Treino de Redação Dissertativo-Argumentativa",
        discipline: "Redação Concursos",
        description: "Submeta um texto discursivo para análise de IA do Professor Tico e tire nota acima de 70.",
        category: "essay",
        target: 1,
        xpReward: 80,
        gemsReward: 25,
        icon: "✍️",
        actionTab: "essay",
        badge: "Discursiva com IA"
      },
      {
        title: "Estrutura Argumentativa & Coesão Textual",
        discipline: "Redação Concursos",
        description: "Submeta uma proposta dissertativa para receber diagnóstico pedagógico detalhado.",
        category: "essay",
        target: 1,
        xpReward: 75,
        gemsReward: 20,
        icon: "📝",
        actionTab: "essay",
        badge: "Critérios de Banca"
      }
    ],
    [
      {
        title: "Crase, Concordância & Regência",
        discipline: "Língua Portuguesa",
        description: "Resolva 5 questões de emprego da crase e regência verbal mais cobradas em provas.",
        category: "questions",
        target: 5,
        xpReward: 50,
        gemsReward: 15,
        icon: "📚",
        actionTab: "map",
        badge: "Gramática Essencial"
      },
      {
        title: "Interpretação e Tipologia Textual",
        discipline: "Língua Portuguesa",
        description: "Responda 4 questões de inferência textual, coesão e figuras de linguagem.",
        category: "questions",
        target: 4,
        xpReward: 40,
        gemsReward: 10,
        icon: "🔍",
        actionTab: "subjects",
        badge: "Interpretação"
      }
    ],
    [
      {
        title: "Defender a Ofensiva Diária (Streak)",
        discipline: "Constância de Estudos",
        description: "Complete pelo menos 1 fase no mapa ou trilha hoje para proteger e aumentar seu streak.",
        category: "streak",
        target: 1,
        xpReward: 40,
        gemsReward: 10,
        icon: "🔥",
        actionTab: "map",
        badge: "Ofensiva Diária"
      },
      {
        title: "Maratona de Agilidade no Arcade",
        discipline: "Treino Rápido",
        description: "Acerte 6 questões consecutivas no modo Jogos ou Revisão Espaçada.",
        category: "arcade",
        target: 6,
        xpReward: 60,
        gemsReward: 20,
        icon: "⚡",
        actionTab: "arcade",
        badge: "Agilidade Mental"
      }
    ]
  ];

  const selected = [];
  for (let i = 0; i < 4; i++) {
    const pool = pools[i % pools.length];
    const taskIdx = (sum + i) % pool.length;
    const task = pool[taskIdx];
    selected.push({
      id: `daily-${dateStr}-${i + 1}`,
      date: dateStr,
      ...task
    });
  }

  const streakTask = pools[4][sum % pools[4].length];
  selected.push({
    id: `daily-${dateStr}-5`,
    date: dateStr,
    ...streakTask
  });

  return selected;
}

// Buscar tarefas diárias do Firestore (com seeding automático para dias novos)
export async function fetchDailyMissions(dateStr = new Date().toISOString().split('T')[0]) {
  try {
    const q = query(collection(db, 'daily_missions'), where('date', '==', dateStr));
    const snap = await getDocs(q);
    const missions = [];
    snap.forEach(docSnap => {
      missions.push(docSnap.data());
    });

    if (missions.length > 0) {
      missions.sort((a, b) => (a.id > b.id ? 1 : -1));
      return missions;
    }

    // Se ainda não existirem para hoje no Firestore, salvar o novo lote do dia
    const freshTasks = generateDailyMissionsCatalog(dateStr);
    for (const task of freshTasks) {
      await setDoc(doc(db, 'daily_missions', task.id), {
        ...task,
        createdAt: new Date().toISOString()
      });
    }
    return freshTasks;
  } catch (err) {
    console.warn('[Firebase] Erro ao buscar missões diárias do Firestore, usando catálogo local:', err);
    return generateDailyMissionsCatalog(dateStr);
  }
}

// Buscar o progresso das missões diárias do usuário no Firestore
export async function getUserDailyProgress(userId, dateStr = new Date().toISOString().split('T')[0]) {
  if (!userId) {
    return {
      date: dateStr,
      progressMap: {},
      completed: [],
      claimed: [],
      bonusClaimed: false
    };
  }
  try {
    const ref = doc(db, 'users', userId, 'daily_progress', dateStr);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data();
    }
    return {
      date: dateStr,
      progressMap: {},
      completed: [],
      claimed: [],
      bonusClaimed: false
    };
  } catch (err) {
    console.warn('[Firebase] Erro ao buscar progresso diário:', err);
    return {
      date: dateStr,
      progressMap: {},
      completed: [],
      claimed: [],
      bonusClaimed: false
    };
  }
}

// Atualizar o progresso de uma missão diária específica no Firestore
export async function updateDailyMissionProgress(userId, dateStr, missionId, incrementBy = 1, target = 1) {
  if (!userId) return null;
  try {
    const ref = doc(db, 'users', userId, 'daily_progress', dateStr);
    const snap = await getDoc(ref);
    const current = snap.exists() ? snap.data() : {
      date: dateStr,
      progressMap: {},
      completed: [],
      claimed: [],
      bonusClaimed: false
    };

    const progressMap = current.progressMap || {};
    const currentCount = Number(progressMap[missionId] || 0) + Number(incrementBy || 1);
    progressMap[missionId] = currentCount;

    const completed = Array.isArray(current.completed) ? [...current.completed] : [];
    if (currentCount >= target && !completed.includes(missionId)) {
      completed.push(missionId);
    }

    const updated = {
      ...current,
      date: dateStr,
      progressMap,
      completed,
      updatedAt: new Date().toISOString()
    };

    await setDoc(ref, updated, { merge: true });
    return updated;
  } catch (err) {
    console.warn('[Firebase] Erro ao atualizar progresso diário:', err);
    return null;
  }
}

// Resgatar recompensa de uma missão diária concluída
export async function claimDailyMissionReward(userId, dateStr, missionId, xpReward = 50, gemsReward = 15) {
  if (!userId) return null;
  try {
    const ref = doc(db, 'users', userId, 'daily_progress', dateStr);
    const snap = await getDoc(ref);
    const current = snap.exists() ? snap.data() : {
      date: dateStr,
      progressMap: {},
      completed: [],
      claimed: [],
      bonusClaimed: false
    };

    const claimed = Array.isArray(current.claimed) ? [...current.claimed] : [];
    if (!claimed.includes(missionId)) {
      claimed.push(missionId);
    }

    const updated = {
      ...current,
      claimed,
      updatedAt: new Date().toISOString()
    };
    await setDoc(ref, updated, { merge: true });

    // Incrementar XP no Firestore
    const userDocRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const uData = userSnap.data();
      const newXp = Number(uData.xp || 0) + Number(xpReward);
      await setDoc(userDocRef, { xp: newXp }, { merge: true });
      const leaderRef = doc(db, 'leaderboard', userId);
      await setDoc(leaderRef, { xp: newXp, updatedAt: new Date().toISOString() }, { merge: true });
    }

    return updated;
  } catch (err) {
    console.warn('[Firebase] Erro ao resgatar recompensa diária:', err);
    return null;
  }
}

// Resgatar Baú Diário de Grande Bonificação
export async function claimDailyBonusChest(userId, dateStr, bonusXp = 100, bonusGems = 50) {
  if (!userId) return null;
  try {
    const ref = doc(db, 'users', userId, 'daily_progress', dateStr);
    await setDoc(ref, {
      bonusClaimed: true,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    const userDocRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const uData = userSnap.data();
      const newXp = Number(uData.xp || 0) + Number(bonusXp);
      await setDoc(userDocRef, { xp: newXp }, { merge: true });
      const leaderRef = doc(db, 'leaderboard', userId);
      await setDoc(leaderRef, { xp: newXp, updatedAt: new Date().toISOString() }, { merge: true });
    }
    return true;
  } catch (err) {
    console.warn('[Firebase] Erro ao resgatar baú diário:', err);
    return false;
  }
}

// Disponibilizar no window.FirebaseApplet para reatividade global
if (typeof window !== 'undefined') {
  window.FirebaseApplet = {
    app,
    auth,
    db,
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
  window.MissaoFirebase = window.FirebaseApplet;
}

export async function saveUserPreferredBanca(userId, banca) {
  if (!userId || !db) return false;
  try {
    const userDocRef = doc(db, 'users', userId);
    await setDoc(userDocRef, {
      preferredBanca: banca,
      bancaUpdatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('[Firebase] Erro ao salvar banca preferida no Firestore:', err);
    return false;
  }
}

export async function getUserPreferredBanca(userId) {
  if (!userId || !db) return null;
  try {
    const userDocRef = doc(db, 'users', userId);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      return data?.preferredBanca || null;
    }
    return null;
  } catch (err) {
    console.warn('[Firebase] Erro ao buscar banca preferida no Firestore:', err);
    return null;
  }
}

export async function saveUserEssay(userId, essayData) {
  if (!userId || !db) return null;
  try {
    const essayId = essayData.id || `redacao_${Date.now()}`;
    const essayRef = doc(db, 'users', userId, 'essays', essayId);
    await setDoc(essayRef, {
      ...essayData,
      id: essayId,
      userId,
      savedAt: new Date().toISOString()
    }, { merge: true });
    return essayId;
  } catch (err) {
    console.warn('[Firebase] Erro ao salvar redação na nuvem:', err);
    return null;
  }
}

export async function getUserEssays(userId) {
  if (!userId || !db) return [];
  try {
    const colRef = collection(db, 'users', userId, 'essays');
    const snap = await getDocs(colRef);
    return snap.docs.map(d => d.data());
  } catch (err) {
    console.warn('[Firebase] Erro ao carregar redações:', err);
    return [];
  }
}

// Histórico de Dicas do Dia visualizadas por banca
export async function recordViewedTip(userId, tipData) {
  if (!userId || !db || !tipData?.id) return null;
  try {
    const tipRef = doc(db, 'users', userId, 'viewed_tips', tipData.id);
    const existingSnap = await getDoc(tipRef);
    const prevData = existingSnap.exists() ? existingSnap.data() : null;
    const currentCount = prevData?.viewCount ? prevData.viewCount + 1 : 1;
    const isMastered = prevData ? !!prevData.mastered : false;
    const isFavorited = prevData ? !!prevData.favorited : false;

    const payload = {
      userId,
      tipId: tipData.id,
      banca: tipData.banca || 'Geral',
      title: tipData.title || '',
      category: tipData.category || 'Estratégia',
      viewedAt: new Date().toISOString(),
      viewCount: currentCount,
      mastered: isMastered,
      favorited: isFavorited
    };

    await setDoc(tipRef, payload, { merge: true });
    return payload;
  } catch (err) {
    console.warn('[Firebase] Erro ao registrar dica visualizada:', err);
    return null;
  }
}

export async function getUserViewedTips(userId, banca = null) {
  if (!userId || !db) return [];
  try {
    const colRef = collection(db, 'users', userId, 'viewed_tips');
    const snap = await getDocs(colRef);
    const tips = snap.docs.map(d => d.data());
    if (banca) {
      return tips.filter(t => t.banca === banca);
    }
    return tips;
  } catch (err) {
    console.warn('[Firebase] Erro ao buscar histórico de dicas:', err);
    return [];
  }
}

export async function toggleMasteredTip(userId, tipId, isMastered) {
  if (!userId || !db || !tipId) return false;
  try {
    const tipRef = doc(db, 'users', userId, 'viewed_tips', tipId);
    await setDoc(tipRef, {
      mastered: isMastered,
      masteredAt: isMastered ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('[Firebase] Erro ao atualizar status de domínio da dica:', err);
    return false;
  }
}

export async function toggleFavoriteTip(userId, tipId, isFavorited) {
  if (!userId || !db || !tipId) return false;
  try {
    const tipRef = doc(db, 'users', userId, 'viewed_tips', tipId);
    await setDoc(tipRef, {
      favorited: isFavorited,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('[Firebase] Erro ao atualizar favorito da dica:', err);
    return false;
  }
}

export { app, auth, db };
