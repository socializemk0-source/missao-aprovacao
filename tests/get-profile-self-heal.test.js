// get-profile deve se AUTORRECUPERAR quando o usuário já está autenticado
// no Supabase Auth (token válido) mas nunca teve a linha de dados da
// aplicação criada — o cenário real é: signUp() com confirmação de e-mail
// exigida devolve session:null, então registerUser() nunca chama
// sync-profile; o primeiro login bem-sucedido (get-profile) é a única
// chance de criar a linha antes que o perfil pareça "sumido" para sempre.
//
// Rodar com:
//   node --experimental-test-module-mocks --test tests/get-profile-self-heal.test.js

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

test('1. get-profile para um uid autenticado sem linha em users/profiles cria o perfil em vez de devolver null', async () => {
  const uid = 'user_never_synced';
  assert.equal(store.users[uid], undefined); // confirma que não existe de antemão

  const req = makeReq({ method: 'POST', body: { action: 'get-profile' }, headers: authHeader(uid) });
  const res = makeRes();
  await authHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.notEqual(res.body.profile, null);
  assert.equal(res.body.profile.uid, uid);
  // Autocriado com um nome de fallback (nunca undefined/vazio) e plano grátis.
  assert.equal(typeof res.body.profile.name, 'string');
  assert.ok(res.body.profile.name.length > 0);
  assert.equal(res.body.profile.plan, 'free');

  // A linha agora existe de verdade no "banco" — não é só um valor calculado
  // na resposta desta chamada.
  assert.notEqual(store.users[uid], undefined);
});

test('2. get-profile chamado de novo para o mesmo uid não duplica nem apaga dados já personalizados', async () => {
  const uid = 'user_already_customized';
  // Simula um perfil que o próprio usuário já editou (nome customizado).
  store.users[uid] = { uid, name: 'Nome Escolhido Pelo Usuário', plan: 'pro' };
  store.profiles[uid] = { id: uid, fullName: 'Nome Escolhido Pelo Usuário', bio: 'Bio própria' };

  const req = makeReq({ method: 'POST', body: { action: 'get-profile' }, headers: authHeader(uid) });
  const res = makeRes();
  await authHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.profile.name, 'Nome Escolhido Pelo Usuário');
  assert.equal(res.body.profile.plan, 'pro'); // autorrecuperação não pode resetar o plano PRO
});
