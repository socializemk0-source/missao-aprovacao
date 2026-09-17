// CRITICAL-3 — GREEN suite (após o fix)
//
// Mesma bateria de testes de tests/idor-ownership.test.js (fase RED), agora
// exercitando os handlers reais JÁ protegidos por requireAuth + req.user.uid.
// O Postgres é substituído por um dublê (fake-db.js) e o middleware de auth
// por um dublê determinístico sem rede (fake-auth.js, convenção de token
// "TEST:<uid>") — nenhum código de produção foi alterado pelos testes.
//
// Rodar com:
//   node --experimental-test-module-mocks --test tests/idor-ownership.test.js

import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, resetStore, buildNamedExports } from './fixtures/fake-db.js';
import { makeReq, makeRes } from './fixtures/http.js';

const queriesUrl = new URL('../src/db/queries.ts', import.meta.url).href;
const requireAuthUrl = new URL('../middleware/requireAuth.js', import.meta.url).href;

const store = createStore();
mock.module(queriesUrl, { namedExports: buildNamedExports(store) });
mock.module(requireAuthUrl, {
  namedExports: {
    requireAuth: (await import('./fixtures/fake-auth.js')).requireAuth,
  },
});

const { default: authHandler } = await import('../api/auth.js');
const { default: dataHandler } = await import('../api/data.js');

function authHeader(uid) {
  return { authorization: `Bearer TEST:${uid}` };
}

beforeEach(() => {
  resetStore(store);
});

// ---------------------------------------------------------------------
// 1-2. Ausência de autenticação é bloqueada com 401
// ---------------------------------------------------------------------

test('1. request sem token → 401 (get-profile)', async () => {
  const req = makeReq({ method: 'POST', body: { action: 'get-profile' } }); // sem Authorization
  const res = makeRes();
  await authHandler(req, res);
  assert.equal(res.statusCode, 401);
});

test('2. token inválido no header Authorization → 401 (get-essays)', async () => {
  const req = makeReq({ query: { action: 'get-essays' }, headers: { authorization: 'Bearer isto-nao-e-um-token-valido' } });
  const res = makeRes();
  await dataHandler(req, res);
  assert.equal(res.statusCode, 401);
});

// ---------------------------------------------------------------------
// 3. Usuário A acessando os próprios dados → permitido
// ---------------------------------------------------------------------

test('3. usuário A acessando os próprios dados (get-essays) → permitido', async () => {
  const req = makeReq({ query: { action: 'get-essays' }, headers: authHeader('user_A') });
  const res = makeRes();
  await dataHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.ok(
    res.body.essays.some((e) => e.content.includes('redação de A')),
    'usuário A deveria conseguir ler a própria redação'
  );
});

// ---------------------------------------------------------------------
// 4-6. body/query.userId não tem mais nenhum efeito sobre identidade
// ---------------------------------------------------------------------

test('4. usuário A autenticado enviando userId=B não recebe dados de B (get-essays)', async () => {
  const req = makeReq({ query: { action: 'get-essays', userId: 'user_B' }, headers: authHeader('user_A') });
  const res = makeRes();
  await dataHandler(req, res);
  assert.equal(res.statusCode, 200);
  const vazouDadosDeB = res.body.essays.some((e) => e.content.includes('redação de B'));
  assert.equal(vazouDadosDeB, false, 'usuário A não deveria ver a redação de B');
  assert.ok(res.body.essays.some((e) => e.content.includes('redação de A')), 'deveria ver apenas a própria redação (A)');
});

test('5. usuário A não consegue gravar progresso de B via body.userId (save-progress)', async () => {
  const req = makeReq({
    body: { action: 'save-progress', userId: 'user_B', totalQuestionsAnswered: 999, correctAnswers: 999 },
    headers: authHeader('user_A'),
  });
  const res = makeRes();
  await dataHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.notEqual(store.progress.user_B.totalQuestionsAnswered, 999, 'progresso de B não deveria ter sido alterado');
  assert.equal(store.progress.user_A.totalQuestionsAnswered, 999, 'o progresso deveria ter sido gravado para A (o autenticado), não para B');
});

test('6. usuário A não lê progresso de B via query.userId (get-progress)', async () => {
  const req = makeReq({ query: { action: 'get-progress', userId: 'user_B' }, headers: authHeader('user_A') });
  const res = makeRes();
  await dataHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.progress.userId, 'user_A', 'deveria retornar o progresso do próprio usuário autenticado (A)');
});

// ---------------------------------------------------------------------
// 7-9. Usuário B não pode ler/gravar dados de A
// ---------------------------------------------------------------------

test('7. usuário B não consegue atualizar o perfil de A (update-profile)', async () => {
  const req = makeReq({
    body: { action: 'update-profile', uid: 'user_A', fullName: 'Hackeado por B' },
    headers: authHeader('user_B'),
  });
  const res = makeRes();
  await authHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.notEqual(store.profiles.user_A.fullName, 'Hackeado por B', 'perfil de A não deveria ter sido alterado');
  assert.equal(store.profiles.user_B.fullName, 'Hackeado por B', 'a atualização deveria valer só para B (o autenticado)');
});

test('8. usuário B não consegue gravar progresso de A (save-progress)', async () => {
  const req = makeReq({
    body: { action: 'save-progress', userId: 'user_A', totalQuestionsAnswered: 777, correctAnswers: 777 },
    headers: authHeader('user_B'),
  });
  const res = makeRes();
  await dataHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.notEqual(store.progress.user_A.totalQuestionsAnswered, 777, 'progresso de A não deveria ter sido alterado');
});

test('9. usuário B não consegue ler as redações de A (get-essays)', async () => {
  const req = makeReq({ query: { action: 'get-essays', userId: 'user_A' }, headers: authHeader('user_B') });
  const res = makeRes();
  await dataHandler(req, res);
  assert.equal(res.statusCode, 200);
  const vazouDadosDeA = res.body.essays.some((e) => e.content.includes('redação de A'));
  assert.equal(vazouDadosDeA, false, 'usuário B não deveria ler a redação de A');
});

// ---------------------------------------------------------------------
// 10. CRITICAL-4 — dump agregado exige autenticação e nunca inclui
//     conteúdo de redação de terceiros
// ---------------------------------------------------------------------

test('10. GET /api/data sem action e sem token → 401 (antes vazava tudo)', async () => {
  const req = makeReq({ method: 'GET', query: {} });
  const res = makeRes();
  await dataHandler(req, res);
  assert.equal(res.statusCode, 401);
});

test('11. GET /api/data sem action, autenticado → nunca inclui texto de redação de terceiros', async () => {
  const req = makeReq({ method: 'GET', query: {}, headers: authHeader('user_A') });
  const res = makeRes();
  await dataHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.essays, undefined, 'o dump agregado não deve mais expor o array de redações de terceiros');
});
