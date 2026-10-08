// Migrações rodam no SQL Editor do Supabase, que lê "SELECT ... INTO x" como
// criação da tabela "x" e enfia um "ALTER TABLE x ENABLE ROW LEVEL SECURITY"
// no meio do bloco DO $$ ... $$ — o script quebra ("unterminated
// dollar-quoted string"). Dentro de blocos, use atribuição: x := (SELECT ...).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const DIR = 'supabase/migrations';
const semComentarios = (sql) => sql.replace(/--.*$/gm, '');

test('nenhuma migração usa SELECT ... INTO (quebra no SQL Editor do Supabase)', () => {
  for (const arquivo of readdirSync(DIR).filter((f) => f.endsWith('.sql'))) {
    const sql = semComentarios(readFileSync(`${DIR}/${arquivo}`, 'utf8'));
    for (const comando of sql.split(';')) {
      if (/\bINSERT\s+INTO\b/i.test(comando)) continue;
      assert.ok(!/\bSELECT\b[\s\S]*\bINTO\b/i.test(comando), `${arquivo}: "SELECT ... INTO" — use "x := (SELECT ...)"`);
    }
  }
});
