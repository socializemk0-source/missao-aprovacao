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
    dailyMissions: {}, // userId -> [{ userId, dateStr, missionId, progress, target, completed, claimed }]
    gameSnapshots: {}, // userId -> { userId, state, xp, updatedAt }
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
    getGameSnapshot: async (userId) => store.gameSnapshots[userId] || null,
    saveGameSnapshot: async (userId, state, xp) => {
      const existing = store.gameSnapshots[userId];
      if (existing && existing.xp > xp) return null; // mesma regra do WHERE real
      store.gameSnapshots[userId] = { userId, state, xp, updatedAt: new Date() };
      return store.gameSnapshots[userId];
    },
    saveEssay: async (data) => {
      if (store.__essayWriteDelayMs) await new Promise((r) => setTimeout(r, store.__essayWriteDelayMs));
      const record = { ...data, createdAt: data.createdAt || new Date() };
      store.essays[data.userId] = store.essays[data.userId] || [];
      store.essays[data.userId].push(record);
      return record;
    },
    // Contar + inserir sem nenhum await no meio = atômico no event loop,
    // o mesmo efeito do pg_advisory_xact_lock da implementação real.
    reserveEssayQuota: async ({ userId, since, limit, essay }) => {
      const list = (store.essays[userId] = store.essays[userId] || []);
      const recent = list.filter((e) => e.createdAt && new Date(e.createdAt).getTime() >= since.getTime()).length;
      if (recent >= limit) return null;
      const record = { ...essay, userId, createdAt: new Date() };
      list.push(record);
      return record;
    },
    completeEssayReservation: async (essayId, fields) => {
      if (store.__essayWriteDelayMs) await new Promise((r) => setTimeout(r, store.__essayWriteDelayMs));
      for (const list of Object.values(store.essays)) {
        const record = list.find((e) => e.essayId === essayId);
        if (record) return Object.assign(record, fields);
      }
      return null;
    },
    releaseEssayReservation: async (essayId) => {
      for (const [userId, list] of Object.entries(store.essays)) {
        store.essays[userId] = list.filter((e) => e.essayId !== essayId);
      }
    },
    getEssaysByUser: async (userId) => store.essays[userId] || [],
    updateDailyMission: async (userId, dateStr, missionId, progress, target, completed, claimed) => {
      const list = (store.dailyMissions[userId] = store.dailyMissions[userId] || []);
      let row = list.find((m) => m.dateStr === dateStr && m.missionId === missionId);
      if (!row) {
        row = { userId, dateStr, missionId };
        list.push(row);
      }
      Object.assign(row, { progress, target, completed, claimed });
      return row;
    },
    getDailyMissions: async (userId, dateStr) =>
      (store.dailyMissions[userId] || []).filter((m) => m.dateStr === dateStr),
    getClaimedMissionIds: async (userId) =>
      (store.dailyMissions[userId] || []).filter((m) => m.claimed).map((m) => m.missionId),
    // Sem await entre checar e marcar = atômico, como o lock da versão real.
    claimMissionReward: async ({ userId, dateStr, missionId, target, xp }) => {
      const row = (store.dailyMissions[userId] || []).find((m) => m.dateStr === dateStr && m.missionId === missionId);
      if (!row || (row.progress || 0) < target) return { status: 'not_completed' };
      if (row.claimed) return { status: 'already_claimed' };
      Object.assign(row, { claimed: 1, completed: 1 });
      store.users[userId].xp = (store.users[userId].xp || 0) + xp;
      return { status: 'claimed', user: store.users[userId] };
    },
    claimBonusChest: async ({ userId, dateStr, chestId, missionIds, requiredCompleted, xp }) => {
      const list = (store.dailyMissions[userId] = store.dailyMissions[userId] || []);
      const rows = list.filter((m) => m.dateStr === dateStr);
      if (rows.some((m) => m.missionId === chestId && m.claimed)) return { status: 'already_claimed' };
      if (rows.filter((m) => missionIds.includes(m.missionId) && m.completed).length < requiredCompleted) {
        return { status: 'not_completed' };
      }
      list.push({ userId, dateStr, missionId: chestId, progress: 1, target: 1, completed: 1, claimed: 1 });
      store.users[userId].xp = (store.users[userId].xp || 0) + xp;
      return { status: 'claimed', user: store.users[userId] };
    },
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
