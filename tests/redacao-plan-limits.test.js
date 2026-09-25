// api/redacao.js — a correção por IA agora exige login (para saber QUEM
// pediu e aplicar o limite por plano) e aplica um limite semanal no
// Plano Grátis (1 correção a cada 7 dias); o Plano PRO não tem limite.
// `deps.send` substitui o fetch real — nenhuma chamada de rede à OpenAI
// acontece aqui.

import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeReq, makeRes } from './fixtures/http.js';
import { createStore, resetStore, buildNamedExports } from './fixtures/fake-db.js';

process.env.OPENAI_API_KEY = 'test-key-para-habilitar-a-rota';

const queriesUrl = new URL('../src/db/queries.js', import.meta.url).href;
const requireAuthUrl = new URL('../middleware/requireAuth.js', import.meta.url).href;

const store = createStore();
mock.module(queriesUrl, { namedExports: buildNamedExports(store) });
mock.module(requireAuthUrl, {
  namedExports: { requireAuth: (await import('./fixtures/fake-auth.js')).requireAuth },
});

beforeEach(() => resetStore(store));

const { default: redacaoHandler } = await import('../api/redacao.js');

const TOPIC_ID = 'digital';
const BANK = 'Treino geral';
const STUDENT_TEXT =
  'A inclusão digital no acesso aos serviços públicos exige planejamento cuidadoso por parte do poder público. ' +
  'Ademais, é preciso ampliar a conectividade e capacitar os cidadãos para usar as plataformas com segurança e autonomia, evitando exclusão. ' +
  'Muitos municípios brasileiros ainda enfrentam dificuldades estruturais para oferecer internet estável às populações mais vulneráveis, o que amplia as desigualdades já existentes na sociedade. ' +
  'Por isso, cabe ao poder público investir em infraestrutura de conectividade, capacitação digital continuada e manutenção de canais presenciais de atendimento para quem ainda não domina os meios eletrônicos. ' +
  'Somente assim será possível conciliar a modernização administrativa com a garantia efetiva de acesso universal aos serviços essenciais oferecidos pelo Estado.';

function fakeOpenAiResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      status: 'completed',
      output: [{
        content: [{
          type: 'output_text',
          text: JSON.stringify({
            summary: 'Texto coerente, com boa progressão e tese clara.',
            criteria: [
              { id: 'tema', score: 15, reason: 'Atende ao tema proposto.' },
              { id: 'argumentos', score: 20, reason: 'Argumentação consistente.' },
              { id: 'organizacao', score: 15, reason: 'Boa estrutura em parágrafos.' },
              { id: 'linguagem', score: 25, reason: 'Poucos desvios de norma-padrão.' },
            ],
            annotations: [],
            strengths: ['Boa tese inicial.'],
            nextSteps: ['Revisar a conclusão para reforçar a tese.'],
          }),
        }],
      }],
    }),
  };
}

// Cada chamada usa um IP diferente: o rate-limit por IP em handleEssay é
// uma preocupação separada do limite por plano/usuário que estes testes
// verificam, e ambos compartilham o mesmo módulo (estado do rate-limit
// não é resetado por beforeEach) — sem isso, os testes se atrapalhariam
// entre si.
let ipCounter = 0;
function postEssay(uid) {
  ipCounter += 1;
  const send = mock.fn(async () => fakeOpenAiResponse());
  const req = makeReq({
    method: 'POST',
    body: { topicId: TOPIC_ID, bank: BANK, text: STUDENT_TEXT },
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer TEST:${uid}`,
      'x-forwarded-for': `198.51.100.${ipCounter}`,
    },
  });
  const res = makeRes();
  return redacaoHandler(req, res, { send }).then(() => ({ res, body: JSON.parse(res.body), send }));
}

test('POST /api/redacao sem token → 401, nunca chama a OpenAI', async () => {
  const send = mock.fn(async () => fakeOpenAiResponse());
  const req = makeReq({
    method: 'POST',
    body: { topicId: TOPIC_ID, bank: BANK, text: STUDENT_TEXT },
    headers: { 'content-type': 'application/json' },
  });
  const res = makeRes();
  await redacaoHandler(req, res, { send });

  assert.equal(res.statusCode, 401);
  assert.equal(send.mock.calls.length, 0);
});

test('Plano Grátis: primeira correção da semana é aceita e fica registrada', async () => {
  const { res, body } = await postEssay('user_A');

  assert.equal(res.statusCode, 200, `esperava 200, recebeu ${res.statusCode} (${JSON.stringify(body)})`);
  assert.ok(body.report);
  assert.equal(store.essays.user_A.filter((e) => e.topic).length >= 1, true, 'a correção deve ficar registrada para valer no limite');
});

test('Plano Grátis: segunda correção dentro de 7 dias é bloqueada ANTES de chamar a OpenAI', async () => {
  const first = await postEssay('user_A');
  assert.equal(first.res.statusCode, 200);

  const second = await postEssay('user_A');

  assert.equal(second.res.statusCode, 403);
  assert.equal(second.body.code, 'LIMITE_PLANO_GRATIS');
  assert.equal(second.send.mock.calls.length, 0, 'não deve gastar a API da OpenAI numa solicitação já sabida recusada');
});

test('Plano PRO: sem limite, várias correções na mesma semana são todas aceitas', async () => {
  store.users.user_A.plan = 'pro';

  const first = await postEssay('user_A');
  const second = await postEssay('user_A');
  const third = await postEssay('user_A');

  assert.equal(first.res.statusCode, 200);
  assert.equal(second.res.statusCode, 200);
  assert.equal(third.res.statusCode, 200);
});

test('Plano Grátis: uma correção de mais de 7 dias atrás não conta para o limite atual', async () => {
  store.essays.user_A = [{
    essayId: 'antiga-1',
    userId: 'user_A',
    topic: 'Tema antigo',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // há 10 dias
  }];

  const { res, body } = await postEssay('user_A');

  assert.equal(res.statusCode, 200, `esperava 200, recebeu ${res.statusCode} (${JSON.stringify(body)})`);
});

// P1 da revisão de 20/09/2026: a cota era só CONTADA antes da chamada à
// IA, nunca reservada — duas requisições simultâneas do mesmo usuário
// grátis viam "0 correções" e as duas passavam.
function postEssayWithSlowAi(uid, { ok = true } = {}) {
  ipCounter += 1;
  const send = mock.fn(async () => {
    await new Promise((r) => setTimeout(r, 30));
    return ok ? fakeOpenAiResponse() : { ok: false, status: 500, json: async () => ({}) };
  });
  const req = makeReq({
    method: 'POST',
    body: { topicId: TOPIC_ID, bank: BANK, text: STUDENT_TEXT },
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer TEST:${uid}`,
      'x-forwarded-for': `198.51.100.${ipCounter}`,
    },
  });
  const res = makeRes();
  return redacaoHandler(req, res, { send }).then(() => ({ res, body: JSON.parse(res.body), send }));
}

test('Plano Grátis: duas correções SIMULTÂNEAS — só uma passa, a OpenAI é chamada uma única vez', async () => {
  const [a, b] = await Promise.all([postEssayWithSlowAi('user_A'), postEssayWithSlowAi('user_A')]);

  const statuses = [a.res.statusCode, b.res.statusCode].sort();
  assert.deepEqual(statuses, [200, 403], `esperava uma aceita e uma bloqueada, recebeu ${statuses}`);
  assert.equal(a.send.mock.calls.length + b.send.mock.calls.length, 1, 'a OpenAI só pode ser chamada para a requisição que reservou a vaga');
});

test('Plano Grátis: falha da IA libera a vaga — a próxima tentativa ainda pode corrigir', async () => {
  const failed = await postEssayWithSlowAi('user_A', { ok: false });
  assert.notEqual(failed.res.statusCode, 200);

  const retry = await postEssayWithSlowAi('user_A');
  assert.equal(retry.res.statusCode, 200, `uma correção que falhou não pode consumir a cota (${JSON.stringify(retry.body)})`);
});

test('a correção é gravada ANTES da resposta terminar (sem gravação solta, que se perde em serverless)', async () => {
  store.__essayWriteDelayMs = 40;
  const { res } = await postEssay('user_A');
  assert.equal(res.statusCode, 200);

  const saved = (store.essays.user_A || []).find((e) => e.feedback);
  assert.ok(saved, 'quando o handler retorna, a correção já precisa estar persistida com o feedback');
  assert.equal(saved.score, 75);
});

test('Plano PRO: a correção também é gravada antes da resposta terminar', async () => {
  store.users.user_A.plan = 'pro';
  store.__essayWriteDelayMs = 40;
  const { res } = await postEssay('user_A');
  assert.equal(res.statusCode, 200);
  assert.ok((store.essays.user_A || []).some((e) => e.feedback), 'correção do PRO também precisa estar persistida');
});

test('passe PRO vencido volta a valer o limite do Plano Grátis', async () => {
  store.users.user_A.plan = 'pro';
  store.users.user_A.proUntil = new Date(Date.now() - 60 * 1000); // venceu há 1 minuto
  const first = await postEssay('user_A');
  const second = await postEssay('user_A');
  assert.equal(first.res.statusCode, 200);
  assert.equal(second.res.statusCode, 403);
});

test('passe PRO dentro da validade continua ilimitado', async () => {
  store.users.user_A.plan = 'pro';
  store.users.user_A.proUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
  assert.equal((await postEssay('user_A')).res.statusCode, 200);
  assert.equal((await postEssay('user_A')).res.statusCode, 200);
});

test('GET /api/redacao (consulta de bancas/temas) continua público, sem exigir login', async () => {
  const req = makeReq({ method: 'GET', headers: {} });
  const res = makeRes();
  await redacaoHandler(req, res, {});

  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.enabled, true);
});

// Falha passageira da OpenAI (5xx): tenta mais uma vez antes de desistir,
// e quando desiste diz qual status a OpenAI devolveu (antes só aparecia
// IA_SERVICO_INDISPONIVEL, sem como saber a causa).
function postEssayWith(uid, responses) {
  ipCounter += 1;
  let call = 0;
  const send = mock.fn(async () => {
    const r = responses[Math.min(call++, responses.length - 1)];
    return r === 'ok' ? fakeOpenAiResponse() : { ok: false, status: r, json: async () => ({ error: { message: `falha ${r}`, type: 'server_error' } }), text: async () => JSON.stringify({ error: { message: `falha ${r}`, type: 'server_error' } }) };
  });
  const req = makeReq({
    method: 'POST',
    body: { topicId: TOPIC_ID, bank: BANK, text: STUDENT_TEXT },
    headers: { 'content-type': 'application/json', authorization: `Bearer TEST:${uid}`, 'x-forwarded-for': `198.51.100.${ipCounter}` },
  });
  const res = makeRes();
  return redacaoHandler(req, res, { send }).then(() => ({ res, body: JSON.parse(res.body), send }));
}

test('OpenAI com erro 503 uma vez: tenta de novo e a correção sai', async () => {
  const { res, send } = await postEssayWith('user_A', [503, 'ok']);
  assert.equal(res.statusCode, 200);
  assert.equal(send.mock.calls.length, 2);
});

test('OpenAI com 500 nas duas tentativas: 502 com o status da OpenAI na mensagem, e a vaga do grátis volta', async () => {
  const { res, body, send } = await postEssayWith('user_A', [500, 500]);
  assert.equal(res.statusCode, 502);
  assert.equal(body.code, 'IA_SERVICO_INDISPONIVEL');
  assert.match(body.error, /OpenAI respondeu 500/);
  assert.equal(send.mock.calls.length, 2);
  const retry = await postEssayWith('user_A', ['ok']);
  assert.equal(retry.res.statusCode, 200, 'falha da IA não pode gastar a correção da semana');
});

test('erro de configuração (400) não é repetido', async () => {
  const { body, send } = await postEssayWith('user_A', [400]);
  assert.equal(body.code, 'IA_CONFIGURACAO');
  assert.equal(send.mock.calls.length, 1);
});

// A IA precisa copiar trechos EXATOS do texto nas anotações. Ela às vezes
// troca aspas/traços, quebra de linha ou corta o trecho com "..." — antes
// isso derrubava a avaliação inteira (IA_TRECHO_DIVERGENTE), de forma
// aleatória. Agora cada trecho é localizado no texto do aluno com
// tolerância e devolvido EXATAMENTE como está no texto (o jogo confere com
// includes() literal); só um trecho que não existe é descartado.
const TEXT_WITH_QUOTES = 'O "governo digital" precisa incluir todos — inclusive idosos.\nSem isso, a exclusão cresce. ' + STUDENT_TEXT;

function aiWithAnnotations(annotations, extra = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      status: 'completed',
      output: [{ content: [{ type: 'output_text', text: JSON.stringify({
        summary: 'Resumo.',
        criteria: [
          { id: 'tema', score: 15, reason: 'ok' },
          { id: 'argumentos', score: 20, reason: 'ok' },
          { id: 'organizacao', score: 15, reason: 'ok' },
          { id: 'linguagem', score: 25, reason: 'ok' },
        ],
        annotations,
        strengths: ['Bom.'],
        nextSteps: ['Revisar.'],
        ...extra,
      }) }] }],
    }),
  };
}

async function postWithAi(uid, aiResponse, text = TEXT_WITH_QUOTES) {
  ipCounter += 1;
  const send = mock.fn(async () => aiResponse);
  const req = makeReq({
    method: 'POST',
    body: { topicId: TOPIC_ID, bank: BANK, text },
    headers: { 'content-type': 'application/json', authorization: `Bearer TEST:${uid}`, 'x-forwarded-for': `198.51.100.${ipCounter}` },
  });
  const res = makeRes();
  await redacaoHandler(req, res, { send });
  return { res, body: JSON.parse(res.body) };
}

const note = (quote) => ({ quote, issue: 'Problema.', suggestion: 'Sugestão.' });

test('trecho com aspas/travessão trocados, quebra de linha e maiúsculas diferentes é aceito e volta EXATO', async () => {
  const { res, body } = await postWithAi('user_A', aiWithAnnotations([
    note('o “governo digital” precisa incluir todos - inclusive idosos. Sem isso'),
  ]));
  assert.equal(res.statusCode, 200, JSON.stringify(body));
  assert.equal(body.report.annotations.length, 1);
  const quote = body.report.annotations[0].quote;
  assert.ok(TEXT_WITH_QUOTES.includes(quote), `o trecho devolvido precisa existir literalmente no texto: ${quote}`);
  assert.equal(quote, 'O "governo digital" precisa incluir todos — inclusive idosos.\nSem isso');
});

test('trecho cortado com reticências é localizado', async () => {
  const { res, body } = await postWithAi('user_A', aiWithAnnotations([note('...precisa incluir todos — inclusive idosos…')]));
  assert.equal(res.statusCode, 200);
  assert.equal(body.report.annotations[0].quote, 'precisa incluir todos — inclusive idosos');
});

test('trecho inventado é descartado, mas a avaliação (notas) continua valendo', async () => {
  const { res, body } = await postWithAi('user_A', aiWithAnnotations([
    note('Esta frase não existe no texto do aluno.'),
    note('Sem isso, a exclusão cresce.'),
  ]));
  assert.equal(res.statusCode, 200, JSON.stringify(body));
  assert.deepEqual(body.report.annotations.map((a) => a.quote), ['Sem isso, a exclusão cresce.']);
  assert.equal(body.report.criteria.reduce((s, c) => s + c.score, 0), 75);
});

test('listas acima do limite são cortadas em vez de derrubar a avaliação', async () => {
  const many = Array.from({ length: 6 }, (_, i) => `Ponto ${i}.`);
  const { res, body } = await postWithAi('user_A', aiWithAnnotations([], { strengths: many, nextSteps: many }));
  assert.equal(res.statusCode, 200, JSON.stringify(body));
  assert.equal(body.report.strengths.length, 4);
  assert.equal(body.report.nextSteps.length, 4);
});

test('nota acima do máximo do critério é limitada ao máximo em vez de derrubar a avaliação', async () => {
  const ai = aiWithAnnotations([]);
  const original = await ai.json();
  const report = JSON.parse(original.output[0].content[0].text);
  report.criteria[0].score = 999; // tema vale no máximo 20
  const { res, body } = await postWithAi('user_A', { ok: true, status: 200, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(report) }] }] }) });
  assert.equal(res.statusCode, 200, JSON.stringify(body));
  assert.equal(body.report.criteria.find((c) => c.id === 'tema').score, 20);
});
