// api/redacao.js — validação anti-invenção dos trechos citados (a.quote)
// pela IA. Bug real observado em produção: um aluno escreveu um texto com
// quebra de linha entre frases (comum em textarea) e a IA citou a mesma
// frase substituindo a quebra de linha por um espaço — a comparação
// original (`text.includes(a.quote)`) rejeitava isso como "trecho
// divergente" mesmo sendo o texto certo, só com espaçamento diferente.
//
// `deps.send` substitui o fetch real — nenhuma chamada de rede à OpenAI
// acontece aqui.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeReq, makeRes } from './fixtures/http.js';

process.env.OPENAI_API_KEY = 'test-key-para-habilitar-a-rota';

const { default: redacaoHandler } = await import('../api/redacao.js');

const TOPIC_ID = 'digital'; // ver essayTopics em api/redacao.js
const BANK = 'Treino geral';
const STUDENT_TEXT =
  'A inclusão digital no acesso aos serviços públicos exige planejamento.\n' +
  'Ademais, é preciso ampliar a conectividade e capacitar os cidadãos para usar as plataformas com segurança e autonomia, evitando exclusão. ' +
  'Muitos municípios brasileiros ainda enfrentam dificuldades estruturais para oferecer internet estável às populações mais vulneráveis, o que amplia as desigualdades já existentes na sociedade. ' +
  'Por isso, cabe ao poder público investir em infraestrutura de conectividade, capacitação digital continuada e manutenção de canais presenciais de atendimento para quem ainda não domina os meios eletrônicos. ' +
  'Somente assim será possível conciliar a modernização administrativa com a garantia efetiva de acesso universal aos serviços essenciais oferecidos pelo Estado.';

function fakeOpenAiResponse(reportObj) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      status: 'completed',
      output: [{ content: [{ type: 'output_text', text: JSON.stringify(reportObj) }] }],
    }),
  };
}

function validReportWithQuote(quote) {
  return {
    summary: 'Texto coerente, com boa progressão e tese clara.',
    criteria: [
      { id: 'tema', score: 15, reason: 'Atende ao tema proposto.' },
      { id: 'argumentos', score: 20, reason: 'Argumentação consistente.' },
      { id: 'organizacao', score: 15, reason: 'Boa estrutura em parágrafos.' },
      { id: 'linguagem', score: 25, reason: 'Poucos desvios de norma-padrão.' },
    ],
    annotations: [
      { quote, issue: 'Poderia detalhar melhor esse trecho.', suggestion: 'Adicione um exemplo concreto aqui.' },
    ],
    strengths: ['Boa tese inicial.'],
    nextSteps: ['Revisar a conclusão para reforçar a tese.'],
  };
}

function postEssay(send) {
  const req = makeReq({
    method: 'POST',
    body: { topicId: TOPIC_ID, bank: BANK, text: STUDENT_TEXT },
    headers: { 'content-type': 'application/json' },
  });
  const res = makeRes();
  return redacaoHandler(req, res, { send }).then(() => ({ res, body: JSON.parse(res.body) }));
}

test('trecho citado igual ao texto do aluno, mas com quebra de linha trocada por espaço, ainda é aceito (mesmo conteúdo)', async () => {
  // A frase é uma só no texto do aluno, mas está partida por um "\n" no meio
  // ("...planejamento.\nAdemais,..."); a IA a citou substituindo por espaço.
  const quoteWithSpaceInsteadOfNewline =
    'A inclusão digital no acesso aos serviços públicos exige planejamento. Ademais, é preciso ampliar a conectividade';
  const send = async () => fakeOpenAiResponse(validReportWithQuote(quoteWithSpaceInsteadOfNewline));

  const { res, body } = await postEssay(send);

  assert.equal(res.statusCode, 200, `esperava 200, recebeu ${res.statusCode} (${JSON.stringify(body)})`);
  assert.ok(body.report, 'deve retornar a avaliação, não um erro de trecho divergente');
});

test('trecho citado com acentuação Unicode decomposta (mesmo texto visível, representação diferente) ainda é aceito', async () => {
  // "é" como é (composto, o que o navegador normalmente envia) vs.
  // "e" + acento agudo combinante ́ (decomposto) — visualmente
  // idêntico, mas `String.prototype.includes` bruto os trata como
  // diferentes. Modelos de IA às vezes devolvem a forma decomposta.
  const decomposedQuote = 'A inclusão digital no acesso aos serviços públicos exige planejamento.';
  const send = async () => fakeOpenAiResponse(validReportWithQuote(decomposedQuote));

  const { res, body } = await postEssay(send);

  assert.equal(res.statusCode, 200, `esperava 200, recebeu ${res.statusCode} (${JSON.stringify(body)})`);
  assert.ok(body.report, 'deve retornar a avaliação, não um erro de trecho divergente');
});

test('[guarda-corpo intacto] trecho inventado (que não existe de forma alguma no texto) ainda é rejeitado', async () => {
  const send = async () => fakeOpenAiResponse(validReportWithQuote('frase completamente inventada pela IA que o aluno nunca escreveu'));

  const { res, body } = await postEssay(send);

  assert.equal(res.statusCode, 502);
  assert.equal(body.code, 'IA_TRECHO_DIVERGENTE');
});
