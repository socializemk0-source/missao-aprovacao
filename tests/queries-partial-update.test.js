// Testa src/db/queries.js DE VERDADE (não o dublê de tests/fixtures/fake-db.js,
// que sempre fez merge parcial correto e por isso nunca teria pego este bug).
// getOrCreateUser e upsertProfile usam .onConflictDoUpdate() do Drizzle; o
// defeito da revisão de 20/09/2026 estava exatamente nesse SET: campos
// ausentes do chamador entravam com um valor-default e apagavam dados reais
// em conflito (linha já existente). Este dublê de `db` reproduz o
// comportamento real de INSERT ... ON CONFLICT DO UPDATE SET, o suficiente
// para pegar essa classe de bug sem precisar de Postgres de verdade.
//
// Rodar com:
//   node --experimental-test-module-mocks --test tests/queries-partial-update.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { users, profiles } from '../src/db/schema.js';

function createFakeDb() {
  const tables = new Map([[users, new Map()], [profiles, new Map()]]);
  const pkOf = new Map([[users, 'uid'], [profiles, 'id']]);

  return {
    insert(table) {
      const store = tables.get(table);
      const pk = pkOf.get(table);
      return {
        values(vals) {
          let conflictSet = null;
          const builder = {
            onConflictDoUpdate({ set }) {
              conflictSet = set;
              return builder;
            },
            async returning() {
              const key = vals[pk];
              const existing = store.get(key);
              if (existing && conflictSet) {
                const updated = { ...existing, ...conflictSet };
                store.set(key, updated);
                return [updated];
              }
              const row = { ...vals };
              store.set(key, row);
              return [row];
            },
          };
          return builder;
        },
      };
    },
  };
}

const fakeDb = createFakeDb();
const dbIndexUrl = new URL('../src/db/index.js', import.meta.url).href;
mock.module(dbIndexUrl, { namedExports: { db: fakeDb, createPool: () => ({}) } });

const { getOrCreateUser, upsertProfile } = await import('../src/db/queries.js');

test('1. getOrCreateUser não sobrescreve um usuário PRO com xp acumulado ao repetir a criação', async () => {
  // Estado real: usuário já existe, virou PRO e acumulou XP jogando.
  await fakeDb.insert(users).values({
    uid: 'u2', email: 'b@b.com', name: 'Ciclana',
    plan: 'pro', xp: 4200, streak: 30, hearts: 5,
  }).returning();

  // Repetir a "criação" (ex.: sync-profile chamado de novo, ou get-profile
  // self-heal correndo numa corrida) manda os valores de cadastro padrão.
  const result = await getOrCreateUser({
    uid: 'u2', email: 'b@b.com', name: 'Ciclana',
    plan: 'free', xp: 0, streak: 1,
  });

  assert.equal(result.plan, 'pro', 'plan PRO não pode ser resetado para free ao repetir a criação');
  assert.equal(result.xp, 4200, 'XP acumulado não pode ser zerado ao repetir a criação');
  assert.equal(result.streak, 30, 'streak não pode ser resetado ao repetir a criação');
});

test('2. getOrCreateUser insere normalmente na primeira chamada (uid inédito)', async () => {
  const result = await getOrCreateUser({
    uid: 'u_new', email: 'novo@x.com', name: 'Novo Aluno',
    city: 'Salvador', whatsapp: '71988887777', plan: 'free', xp: 0, streak: 1, hearts: 5,
  });

  assert.equal(result.uid, 'u_new');
  assert.equal(result.name, 'Novo Aluno');
  assert.equal(result.city, 'Salvador');
  assert.equal(result.plan, 'free');
});

test('3. upsertProfile com apenas um campo não apaga os demais já preenchidos', async () => {
  await fakeDb.insert(profiles).values({
    id: 'u3', fullName: 'Beltrano', bio: 'Bio original', city: 'Recife',
    avatarUrl: 'https://x/foto.png', phone: '81999999999', targetExam: 'TRF5', preferredBanca: 'Cebraspe',
  }).returning();

  const updated = await upsertProfile('u3', { preferredBanca: 'FGV' });

  assert.equal(updated.preferredBanca, 'FGV');
  assert.equal(updated.fullName, 'Beltrano');
  assert.equal(updated.bio, 'Bio original');
  assert.equal(updated.city, 'Recife');
  assert.equal(updated.avatarUrl, 'https://x/foto.png');
  assert.equal(updated.phone, '81999999999');
  assert.equal(updated.targetExam, 'TRF5');
});

test('4. upsertProfile cria um perfil novo com defaults sensatos quando nada existia', async () => {
  const created = await upsertProfile('u4', { fullName: 'Recém-chegado' });

  assert.equal(created.fullName, 'Recém-chegado');
  assert.equal(created.city, 'Brasil');
  assert.equal(created.bio, '');
});
