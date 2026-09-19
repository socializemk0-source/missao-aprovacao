// Dublê determinístico de src/db/queries.js para os testes de autorização.
// Reproduz o comportamento real de escopo por userId (as queries reais já
// filtram corretamente por eq(table.userId, userId) — o bug auditado está
// em QUEM decide qual userId é passado para essas funções, não nelas).

export function createStore() {
  return {
    users: {
      user_A: { uid: 'user_A', name: 'Aluno A', plan: 'free' },
      user_B: { uid: 'user_B', name: 'Aluno B', plan: 'free' },
    },
    profiles: {
      user_A: { id: 'user_A', fullName: 'Aluno A', bio: 'bio original de A', city: 'Cidade A' },
      user_B: { id: 'user_B', fullName: 'Aluno B', bio: 'bio original de B', city: 'Cidade B' },
    },
    essays: {
      user_A: [{ essayId: 'essayA1', userId: 'user_A', topic: 'Tema A', content: 'Texto sigiloso da redação de A' }],
      user_B: [{ essayId: 'essayB1', userId: 'user_B', topic: 'Tema B', content: 'Texto sigiloso da redação de B' }],
    },
    progress: {
      user_A: { userId: 'user_A', completedPhases: '[]', totalQuestionsAnswered: 10, correctAnswers: 8 },
      user_B: { userId: 'user_B', completedPhases: '[]', totalQuestionsAnswered: 20, correctAnswers: 15 },
    },
    tips: {
      user_A: [],
      user_B: [],
    },
    subscriptions: {}, // userId -> { userId, providerCustomerId, providerSubscriptionId, status, ... }
    subscriptionPayments: [], // { providerPaymentId, providerSubscriptionId, userId, status, ... }
  };
}

// Reseta o CONTEÚDO do store mantendo a identidade do objeto (necessário
// porque os closures de buildNamedExports capturam a referência do store).
export function resetStore(store) {
  const fresh = createStore();
  for (const key of Object.keys(store)) delete store[key];
  Object.assign(store, fresh);
}

export function buildNamedExports(store) {
  return {
    // usados por api/auth.js
    getOrCreateUser: async (data) => {
      store.users[data.uid] = { ...(store.users[data.uid] || {}), ...data };
      return store.users[data.uid];
    },
    getUserByEmail: async () => null,
    getUserByUid: async (uid) => store.users[uid] || null,
    updateUser: async (uid, fields) => {
      store.users[uid] = { ...(store.users[uid] || {}), ...fields };
      return store.users[uid];
    },
    syncLeaderboardEntry: async () => ({}),
    getProfileByUserId: async (uid) => store.profiles[uid] || null,
    upsertProfile: async (uid, data) => {
      store.profiles[uid] = { ...(store.profiles[uid] || { id: uid }), ...data };
      return store.profiles[uid];
    },

    // usados por api/data.js
    getLeaderboard: async () => {
      if (store.__forceLeaderboardError) throw store.__forceLeaderboardError;
      return Object.values(store.users);
    },
    getAllUsers: async () => Object.values(store.users),
    saveUserProgress: async (userId, completedPhases, totalQuestionsAnswered, correctAnswers) => {
      store.progress[userId] = { userId, completedPhases, totalQuestionsAnswered, correctAnswers };
      return store.progress[userId];
    },
    getUserProgress: async (userId) => store.progress[userId] || null,
    saveEssay: async (data) => {
      const record = { ...data, createdAt: data.createdAt || new Date() };
      store.essays[data.userId] = store.essays[data.userId] || [];
      store.essays[data.userId].push(record);
      return record;
    },
    getEssaysByUser: async (userId) => store.essays[userId] || [],
    countRecentEssaysByUser: async (userId, since) => {
      const list = store.essays[userId] || [];
      return list.filter((e) => e.createdAt && new Date(e.createdAt).getTime() >= since.getTime()).length;
    },
    updateDailyMission: async () => ({}),
    getDailyMissions: async () => [],
    recordViewedTipInDb: async () => ({}),
    getViewedTipsByUserId: async (userId) => store.tips[userId] || [],

    // usados por api/payments.js, api/payments/webhook.js e api/auth.js (downgrade)
    getSubscriptionByUserId: async (userId) => store.subscriptions[userId] || null,
    getSubscriptionByProviderSubscriptionId: async (providerSubscriptionId) =>
      Object.values(store.subscriptions).find((s) => s.providerSubscriptionId === providerSubscriptionId) || null,
    getSubscriptionByProviderCustomerId: async (providerCustomerId) =>
      Object.values(store.subscriptions).find((s) => s.providerCustomerId === providerCustomerId) || null,
    upsertSubscription: async (data) => {
      const existing = store.subscriptions[data.userId] || {};
      store.subscriptions[data.userId] = { ...existing, ...data };
      return store.subscriptions[data.userId];
    },
    getSubscriptionPaymentByProviderPaymentId: async (providerPaymentId) =>
      store.subscriptionPayments.find((p) => p.providerPaymentId === providerPaymentId) || null,
    recordSubscriptionPayment: async (data) => {
      if (store.subscriptionPayments.some((p) => p.providerPaymentId === data.providerPaymentId)) {
        return null; // onConflictDoNothing real correspondente
      }
      const record = { ...data };
      store.subscriptionPayments.push(record);
      return record;
    },
  };
}
