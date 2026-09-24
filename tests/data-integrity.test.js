// P1 da revisão de 20/09/2026: "XP e recompensas são controlados pelo
// cliente". O jogo roda no navegador (as questões e o gabarito vêm no
// bundle), então o XP ganho respondendo continua sendo informado pelo
// cliente — mas agora com regras de integridade no servidor. Já as
// recompensas de missão e do baú passam a ser concedidas SÓ pelo
// servidor, com valor definido no servidor e uma única vez por dia.

import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, resetStore, buildNamedExports } from './fixtures/fake-db.js';
import { makeReq, makeRes } from './fixtures/http.js';

const queriesUrl = new URL('../src/db/queries.js', import.meta.url).href;
const requireAuthUrl = new URL('../middleware/requireAuth.js', import.meta.url).href;
const leaderboardUrl = new URL('../src/leaderboard.js', import.meta.url).href;

const store = createStore();
mock.module(queriesUrl, { namedExports: buildNamedExports(store) });
mock.module(requireAuthUrl, {
  namedExports: { requireAuth: (await import('./fixtures/fake-auth.js')).requireAuth },
});
mock.module(leaderboardUrl, { namedExports: { queryLeaderboardEntries: async () => [] } });

const { default: dataHandler } = await import('../api/data.js');

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const today = () => new Date().toISOString().split('T')[0];

beforeEach(() => {
  resetStore(store);
  store.users.user_A = {
    uid: 'user_A', name: 'Aluno A', plan: 'free', xp: 100, streak: 3, hearts: 5,
    createdAt: new Date(Date.now() - 10 * DAY), updatedAt: new Date(Date.now() - MINUTE),
  };
});

async function call(body) {
  const req = makeReq({ method: 'POST', body, headers: { authorization: 'Bearer TEST:user_A' } });
  const res = makeRes();
  await dataHandler(req, res);
  return res;
}

// ------------------------------------------------------------------ save-stats

test('save-stats: XP absurdo (999.999.999) é cortado a um ganho plausível para o tempo decorrido', async () => {
  const res = await call({ action: 'save-stats', xp: 999999999 });
  assert.equal(res.statusCode, 200);
  assert.ok(store.users.user_A.xp < 2000, `xp=${store.users.user_A.xp} deveria ter sido limitado`);
  assert.ok(store.users.user_A.xp > 100, 'um ganho plausível ainda precisa entrar');
});

test('save-stats: ganho legítimo de XP (100 → 300 depois de 1 minuto) entra inteiro', async () => {
  await call({ action: 'save-stats', xp: 300 });
  assert.equal(store.users.user_A.xp, 300);
});

test('save-stats: um sync com XP MENOR (ex.: outro aparelho) não apaga o XP da nuvem', async () => {
  await call({ action: 'save-stats', xp: 20 });
  assert.equal(store.users.user_A.xp, 100);
});

test('save-stats: vidas fora da faixa são limitadas a 0–5 (nada de -50 ou 99)', async () => {
  await call({ action: 'save-stats', hearts: -50 });
  assert.equal(store.users.user_A.hearts, 0);
  await call({ action: 'save-stats', hearts: 99 });
  assert.equal(store.users.user_A.hearts, 5);
});

test('save-stats: streak não pode passar da idade da conta em dias', async () => {
  await call({ action: 'save-stats', streak: 5000 });
  assert.ok(store.users.user_A.streak <= 11, `streak=${store.users.user_A.streak}`);
});

test('save-stats: XP já concedido por recompensas não é apagado pelo sync do jogo', async () => {
  const date = today();
  store.dailyMissions.user_A = [
    { userId: 'user_A', dateStr: date, missionId: `daily-${date}-1`, progress: 5, target: 5, completed: 1, claimed: 1 },
  ];
  store.users.user_A.xp = 150; // 100 do jogo + 50 da missão 1
  store.users.user_A.updatedAt = new Date(Date.now() - 5 * MINUTE);

  await call({ action: 'save-stats', xp: 130 }); // jogo foi de 100 para 130
  assert.equal(store.users.user_A.xp, 180);
});

// ---------------------------------------------------------------- claim-mission

test('claim-mission: missão concluída concede o XP definido no SERVIDOR (ignora xpReward do cliente)', async () => {
  const date = today();
  store.dailyMissions.user_A = [
    { userId: 'user_A', dateStr: date, missionId: `daily-${date}-1`, progress: 5, target: 5, completed: 1, claimed: 0 },
  ];
  const res = await call({ action: 'claim-mission', dateStr: date, missionId: `daily-${date}-1`, xpReward: 999999 });
  assert.equal(res.statusCode, 200);
  assert.equal(store.users.user_A.xp, 150);
});

test('claim-mission: a mesma recompensa não pode ser resgatada duas vezes', async () => {
  const date = today();
  store.dailyMissions.user_A = [
    { userId: 'user_A', dateStr: date, missionId: `daily-${date}-1`, progress: 5, target: 5, completed: 1, claimed: 0 },
  ];
  await call({ action: 'claim-mission', dateStr: date, missionId: `daily-${date}-1` });
  const second = await call({ action: 'claim-mission', dateStr: date, missionId: `daily-${date}-1` });
  assert.equal(second.statusCode, 409);
  assert.equal(store.users.user_A.xp, 150);
});

test('claim-mission: missão ainda não concluída não concede nada', async () => {
  const date = today();
  store.dailyMissions.user_A = [
    { userId: 'user_A', dateStr: date, missionId: `daily-${date}-1`, progress: 2, target: 5, completed: 0, claimed: 0 },
  ];
  const res = await call({ action: 'claim-mission', dateStr: date, missionId: `daily-${date}-1` });
  assert.equal(res.statusCode, 409);
  assert.equal(store.users.user_A.xp, 100);
});

test('claim-mission: não dá pra resgatar missões de outros dias (farm de XP trocando a data)', async () => {
  const old = new Date(Date.now() - 10 * DAY).toISOString().split('T')[0];
  store.dailyMissions.user_A = [
    { userId: 'user_A', dateStr: old, missionId: `daily-${old}-1`, progress: 5, target: 5, completed: 1, claimed: 0 },
  ];
  const res = await call({ action: 'claim-mission', dateStr: old, missionId: `daily-${old}-1` });
  assert.equal(res.statusCode, 400);
  assert.equal(store.users.user_A.xp, 100);
});

// ------------------------------------------------------------------ claim-chest

test('claim-chest: exige 3 missões concluídas', async () => {
  const date = today();
  store.dailyMissions.user_A = [1, 2].map((n) => ({
    userId: 'user_A', dateStr: date, missionId: `daily-${date}-${n}`, progress: 5, target: 5, completed: 1, claimed: 0,
  }));
  const res = await call({ action: 'claim-chest', dateStr: date });
  assert.equal(res.statusCode, 409);
  assert.equal(store.users.user_A.xp, 100);
});

test('claim-chest: com 3 missões concluídas concede +100 uma única vez', async () => {
  const date = today();
  store.dailyMissions.user_A = [1, 2, 3].map((n) => ({
    userId: 'user_A', dateStr: date, missionId: `daily-${date}-${n}`, progress: 5, target: 5, completed: 1, claimed: 0,
  }));
  const first = await call({ action: 'claim-chest', dateStr: date });
  const second = await call({ action: 'claim-chest', dateStr: date });
  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 409);
  assert.equal(store.users.user_A.xp, 200);
});

// ---------------------------------------------------------------- save-mission

test('save-mission: o cliente não consegue se marcar como "resgatado" nem "concluído" sem progresso', async () => {
  const date = today();
  const res = await call({
    action: 'save-mission', dateStr: date, missionId: `daily-${date}-1`, progress: 1, target: 1, completed: 1, claimed: 1,
  });
  assert.equal(res.statusCode, 200);
  const row = store.dailyMissions.user_A.find((m) => m.missionId === `daily-${date}-1`);
  assert.equal(row.claimed, 0, 'claimed só muda via claim-mission');
  assert.equal(row.completed, 0, 'a meta dessa missão é 5 no servidor, não 1');
});

test('save-mission: id de missão desconhecido é recusado', async () => {
  const res = await call({ action: 'save-mission', dateStr: today(), missionId: 'qualquer-coisa', progress: 1 });
  assert.equal(res.statusCode, 400);
});

// ------------------------------------------------------------------ save-essay

test('save-essay não existe mais — correções só são gravadas por /api/redacao (sem nota forjada pelo cliente)', async () => {
  const res = await call({ action: 'save-essay', essayId: 'x', content: 'texto', score: 100, feedback: 'perfeito' });
  assert.notEqual(res.statusCode, 200);
  assert.equal((store.essays.user_A || []).some((e) => e.essayId === 'x'), false);
});
