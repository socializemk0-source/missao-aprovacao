// CRITICAL-3 — TDD RED suite
//
// Testa os handlers REAIS de api/auth.js e api/data.js (nenhum código de
// produção foi alterado). O banco Postgres é substituído por um dublê
// determinístico (tests/fixtures/fake-db.js) via mock.module nativo do
// Node, para rodar sem infraestrutura externa.
//
// `req.user` simula o resultado que um middleware requireAuth (ainda não
// implementado) teria produzido a partir de um token válido. Os handlers
// atuais nunca leem req.user — só body/query — por isso os testes abaixo
// marcados [RED] falham hoje: comprovam o CRITICAL-3 (IDOR) na prática.
//
// Rodar com:
//   node --experimental-test-module-mocks --test tests/idor-ownership.test.js

import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, resetStore, buildNamedExports } from './fixtures/fake-db.js';
import { makeReq, makeRes } from './fixtures/http.js';

const queriesUrl = new URL('../src/db/queries.ts', import.meta.url).href;

const store = createStore();
mock.module(queriesUrl, { namedExports: buildNamedExports(store) });

const { default: authHandler } = await import('../api/auth.js');
const { default: dataHandler } = await import('../api/data.js');

beforeEach(() => {
  resetStore(store);
});

// ---------------------------------------------------------------------
// 1-2. Ausência de autenticação não é bloqueada (deveria ser 401)
// ---------------------------------------------------------------------

test('[RED] 1. request sem token/identidade ainda retorna 200 (get-profile)', async () => {
  const req = makeReq({ method: 'POST', body: { action: 'get-profile', uid: 'user_A' } }); // sem req.user
  const res = makeRes();
  await authHandler(req, res);
  assert.equal(res.statusCode, 401, `esperado 401 sem autenticação, recebido ${res.statusCode}`);
});

test('[RED] 2. token inválido no header Authorization ainda retorna 200 (get-essays)', async () => {
  const req = makeReq({ query: { action: 'get-essays', userId: 'user_A' } });
  req.headers.authorization = 'Bearer isto-nao-e-um-jwt-valido';
  const res = makeRes();
  await dataHandler(req, res);
  assert.equal(res.statusCode, 401, `esperado 401 com token inválido, recebido ${res.statusCode}`);
});

// ---------------------------------------------------------------------
// 3. Usuário A acessando os próprios dados → permitido
// ---------------------------------------------------------------------

test('3. usuário A acessando os próprios dados (get-essays) → permitido', async () => {
  const req = makeReq({ query: { action: 'get-essays', userId: 'user_A' }, user: { uid: 'user_A' } });
  const res = makeRes();
  await dataHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.ok(
    res.body.essays.some((e) => e.content.includes('redação de A')),
    'usuário A deveria conseguir ler a própria redação'
  );
});

// ---------------------------------------------------------------------
// 4-6. IDOR via body/query.userId apesar de req.user já autenticado
// ---------------------------------------------------------------------

test('[RED] 4. usuário A autenticado enviando userId=B não deve receber dados de B (get-essays)', async () => {
  const req = makeReq({ query: { action: 'get-essays', userId: 'user_B' }, user: { uid: 'user_A' } });
  const res = makeRes();
  await dataHandler(req, res);
  const vazou = (res.body?.essays || []).some((e) => e.content.includes('redação de B'));
  assert.equal(vazou, false, 'CRITICAL-3: usuário A recebeu o conteúdo da redação privada de B');
});

test('[RED] 5. usuário A não deve conseguir gravar progresso de B via body.userId (save-progress)', async () => {
  const req = makeReq({
    body: { action: 'save-progress', userId: 'user_B', totalQuestionsAnswered: 999, correctAnswers: 999 },
    user: { uid: 'user_A' },
  });
  const res = makeRes();
  await dataHandler(req, res);
  assert.notEqual(
    store.progress.user_B.totalQuestionsAnswered,
    999,
    'CRITICAL-3: usuário A conseguiu sobrescrever o progresso de B só enviando body.userId=B'
  );
});

test('[RED] 6. usuário A não deve ler progresso de B via query.userId (get-progress)', async () => {
  const req = makeReq({ query: { action: 'get-progress', userId: 'user_B' }, user: { uid: 'user_A' } });
  const res = makeRes();
  await dataHandler(req, res);
  assert.notEqual(
    res.body?.progress?.userId,
    'user_B',
    'CRITICAL-3: usuário A leu o progresso de B só enviando query.userId=B'
  );
});

// ---------------------------------------------------------------------
// 7-9. Usuário B não pode ler/gravar dados de A
// ---------------------------------------------------------------------

test('[RED] 7. usuário B não deve conseguir atualizar o perfil de A (update-profile)', async () => {
  const req = makeReq({
    body: { action: 'update-profile', uid: 'user_A', fullName: 'Hackeado por B' },
    user: { uid: 'user_B' },
  });
  const res = makeRes();
  await authHandler(req, res);
  assert.notEqual(
    store.profiles.user_A.fullName,
    'Hackeado por B',
    'CRITICAL-3: usuário B alterou o perfil de A enviando body.uid=A'
  );
});

test('[RED] 8. usuário B não deve conseguir gravar progresso de A (save-progress)', async () => {
  const req = makeReq({
    body: { action: 'save-progress', userId: 'user_A', totalQuestionsAnswered: 777, correctAnswers: 777 },
    user: { uid: 'user_B' },
  });
  const res = makeRes();
  await dataHandler(req, res);
  assert.notEqual(
    store.progress.user_A.totalQuestionsAnswered,
    777,
    'CRITICAL-3: usuário B sobrescreveu o progresso de A enviando body.userId=A'
  );
});

test('[RED] 9. usuário B não deve conseguir ler as redações de A (get-essays)', async () => {
  const req = makeReq({ query: { action: 'get-essays', userId: 'user_A' }, user: { uid: 'user_B' } });
  const res = makeRes();
  await dataHandler(req, res);
  const vazou = (res.body?.essays || []).some((e) => e.content.includes('redação de A'));
  assert.equal(vazou, false, 'CRITICAL-3: usuário B leu o conteúdo da redação privada de A');
});
