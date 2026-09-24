// P1 da revisão de 20/09/2026: "Progresso na nuvem não está conectado ao
// progresso do jogo". O servidor passa a guardar o snapshot completo do
// estado do jogo (get-game / save-game) e nunca aceita um snapshot com
// menos XP do que o salvo.

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

const HOUR = 60 * 60 * 1000;

beforeEach(() => {
  resetStore(store);
  store.users.user_A = {
    uid: 'user_A', name: 'Aluno A', plan: 'free', xp: 0, streak: 1, hearts: 5,
    createdAt: new Date(Date.now() - 48 * HOUR), updatedAt: new Date(Date.now() - HOUR),
  };
});

function gameState({ xp, completed = [], records = {} }) {
  return JSON.stringify({ version: 1, xp, completed, records, settings: { sound: true, motion: true, ambience: false } });
}

async function call(body, uid = 'user_A') {
  const req = makeReq({ method: 'POST', body, headers: { authorization: `Bearer TEST:${uid}` } });
  const res = makeRes();
  await dataHandler(req, res);
  return res;
}

test('save-game guarda o snapshot e get-game devolve o mesmo estado', async () => {
  const state = gameState({ xp: 30, completed: ['numeros-1'], records: { q1: { attempts: 1, earned: 10, lastCorrect: true } } });
  const saved = await call({ action: 'save-game', state });
  assert.equal(saved.statusCode, 200);
  assert.equal(saved.body.accepted, true);

  const got = await call({ action: 'get-game' });
  assert.equal(got.body.snapshot.state, state);
  assert.equal(got.body.snapshot.xp, 30);
});

test('um snapshot com MENOS XP (aparelho novo/vazio) nunca sobrescreve a nuvem', async () => {
  const rich = gameState({ xp: 500, completed: ['numeros-1', 'numeros-2'] });
  await call({ action: 'save-game', state: rich });

  const empty = await call({ action: 'save-game', state: gameState({ xp: 0 }) });
  assert.equal(empty.statusCode, 200);
  assert.equal(empty.body.accepted, false);
  assert.equal(empty.body.snapshot.xp, 500);

  const got = await call({ action: 'get-game' });
  assert.equal(got.body.snapshot.state, rich);
});

test('snapshot de um usuário nunca aparece para outro', async () => {
  await call({ action: 'save-game', state: gameState({ xp: 40 }) });
  const other = await call({ action: 'get-game' }, 'user_B');
  assert.equal(other.body.snapshot, null);
});

test('save-game também atualiza o resumo de progresso e o XP do ranking (com as regras de save-stats)', async () => {
  const records = {
    q1: { attempts: 1, earned: 10, lastCorrect: true },
    q2: { attempts: 2, earned: 5, lastCorrect: true },
    q3: { attempts: 1, earned: 0, lastCorrect: false },
  };
  await call({ action: 'save-game', state: gameState({ xp: 15, completed: ['numeros-1'], records }) });

  const progress = store.progress.user_A;
  assert.deepEqual(JSON.parse(progress.completedPhases), ['numeros-1']);
  assert.equal(progress.totalQuestionsAnswered, 4);
  assert.equal(progress.correctAnswers, 2);
  assert.equal(store.users.user_A.xp, 15);
});

test('save-game recusa estado inválido ou grande demais', async () => {
  assert.equal((await call({ action: 'save-game', state: 'não é json' })).statusCode, 400);
  assert.equal((await call({ action: 'save-game', state: JSON.stringify({ version: 2, xp: 1 }) })).statusCode, 400);
  assert.equal((await call({ action: 'save-game', state: gameState({ xp: -5 }) })).statusCode, 400);
  assert.equal((await call({ action: 'save-game', state: 'x'.repeat(300000) })).statusCode, 413);
  assert.equal(store.gameSnapshots.user_A, undefined);
});
