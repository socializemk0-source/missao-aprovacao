// P1 da revisão de 20/09/2026: "Alterar apenas a banca apaga dados do
// perfil". public/supabase-client.js manda `{action:'update-profile',
// preferredBanca}` sozinho (ex.: trocar a banca preferida na oficina de
// redação) — api/auth.js NUNCA pode inventar defaults para os campos que
// não vieram no corpo da requisição, senão apaga bio/avatar/cidade/
// telefone já preenchidos.
//
// Também cobre o P1 "Sincronização de cadastro pode retirar PRO e zerar
// XP": chamar getOrCreateUser de novo para um uid que já existe (ex.:
// sync-profile repetido) nunca pode resetar plan/xp/streak.
//
// Rodar com:
//   node --experimental-test-module-mocks --test tests/profile-partial-update.test.js

import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, resetStore, buildNamedExports } from './fixtures/fake-db.js';
import { makeReq, makeRes } from './fixtures/http.js';

const queriesUrl = new URL('../src/db/queries.js', import.meta.url).href;
const requireAuthUrl = new URL('../middleware/requireAuth.js', import.meta.url).href;

const store = createStore();
mock.module(queriesUrl, { namedExports: buildNamedExports(store) });
mock.module(requireAuthUrl, {
  namedExports: {
    requireAuth: (await import('./fixtures/fake-auth.js')).requireAuth,
  },
});

const { default: authHandler } = await import('../api/auth.js');

beforeEach(() => {
  resetStore(store);
});

function authHeader(uid) {
  return { authorization: `Bearer TEST:${uid}` };
}

test('1. update-profile só com preferredBanca não apaga bio/cidade/avatar já preenchidos', async () => {
  const uid = 'user_A';
  store.profiles[uid] = {
    id: uid,
    fullName: 'Fulano de Tal',
    bio: 'Bio escrita com carinho',
    avatarUrl: 'https://exemplo.com/foto.png',
    city: 'Recife',
    phone: '81999999999',
    targetExam: 'TRF5',
    preferredBanca: 'Cebraspe',
  };

  const req = makeReq({
    method: 'POST',
    body: { action: 'update-profile', preferredBanca: 'FGV' },
    headers: authHeader(uid),
  });
  const res = makeRes();
  await authHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.profile.preferredBanca, 'FGV');
  // Nada mais deveria ter mudado.
  assert.equal(res.body.profile.fullName, 'Fulano de Tal');
  assert.equal(res.body.profile.bio, 'Bio escrita com carinho');
  assert.equal(res.body.profile.avatarUrl, 'https://exemplo.com/foto.png');
  assert.equal(res.body.profile.city, 'Recife');
  assert.equal(res.body.profile.phone, '81999999999');
  assert.equal(res.body.profile.targetExam, 'TRF5');
});

test('2. update-profile sem nenhum campo reconhecido devolve 400 em vez de zerar o perfil', async () => {
  const uid = 'user_A';
  store.profiles[uid] = { id: uid, fullName: 'Fulano de Tal', bio: 'Bio original' };

  const req = makeReq({ method: 'POST', body: { action: 'update-profile' }, headers: authHeader(uid) });
  const res = makeRes();
  await authHandler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(store.profiles[uid].bio, 'Bio original');
});

test('3. update-profile com nome vazio é rejeitado (não grava perfil sem nome)', async () => {
  const uid = 'user_A';
  store.profiles[uid] = { id: uid, fullName: 'Fulano de Tal' };

  const req = makeReq({
    method: 'POST',
    body: { action: 'update-profile', fullName: '   ' },
    headers: authHeader(uid),
  });
  const res = makeRes();
  await authHandler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(store.profiles[uid].fullName, 'Fulano de Tal');
});
