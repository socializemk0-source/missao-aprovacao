// Remove todo texto voltado ao usuário que ainda menciona Firebase/Firestore
// no bundle React pré-compilado (não há pipeline de build neste repo — ver
// scripts/patch-account.js e scripts/patch-redacao.js para o mesmo padrão
// de patch por substituição de string exata).
//
// NÃO toca em `window.FirebaseApplet` / `fb.` — esse é só o nome global de
// compatibilidade que public/supabase-client.js expõe (o bundle não tem
// código-fonte editável para renomear a referência em si).
import fs from 'fs';

const replacements = [
  ['METAS DIÁRIAS · FIRESTORE AO VIVO', 'METAS DIÁRIAS · AO VIVO'],
  ['COMPETIÇÃO SAUDÁVEL · BANCO DE QUESTÕES FIRESTORE', 'COMPETIÇÃO SAUDÁVEL · RANKING EM TEMPO REAL'],
  ['BASE DE DADOS CLOUD FIRESTORE', 'SEU PROGRESSO NA NUVEM'],
  ['PERSONALIZAÇÃO NO FIRESTORE', 'PERSONALIZAÇÃO DO PERFIL'],
  ['Missões e progresso diário atualizados com o Firestore!', 'Missões e progresso diário atualizados!'],
  ['Tarefas frescas puxadas do Firestore todos os dias para manter o foco, disciplina e constância na sua aprovação.', 'Tarefas frescas todos os dias para manter o foco, disciplina e constância na sua aprovação.'],
  ['Atualizar tarefas do Firestore', 'Atualizar tarefas'],
  ['Registrar avanço no Firestore', 'Registrar avanço'],
  ['[Firestore Leaderboard] Erro ao carregar:', '[Ranking] Erro ao carregar:'],
  ['Classificação do Firestore sincronizada!', 'Classificação sincronizada!'],
  ['`Firestore: `,loading?`Carregando...`:`Ao Vivo`', '`Ranking: `,loading?`Carregando...`:`Ao Vivo`'],
  ['Atualizar ranking do Firestore', 'Atualizar ranking'],
  ['[Firestore Profile] Erro ao carregar dados:', '[Perfil] Erro ao carregar dados:'],
  ['Concurso-alvo salvo no Firestore!', 'Concurso-alvo salvo!'],
  [
    '(user?.isAnonymous?`Sessão temporária no Firestore (conecte com Google para fixar)`:`Conectado ao Firebase Auth`)',
    '(user?.isAnonymous?`Sessão temporária (conecte-se com Google para fixar)`:`Conta sincronizada na nuvem`)',
  ],
  [
    '`Cloud Firestore: ai-studio-missaoaprovacao... `,\n            loading?`(carregando...)`:`(ativo e sincronizado)`',
    'loading?`Sincronizando...`:`Sincronizado na nuvem`',
  ],
  ['Meta diária ativa no Firestore! Pratique 1 fase todo dia para não perder a sequência.', 'Meta diária ativa! Pratique 1 fase todo dia para não perder a sequência.'],
  ['[Firebase] Falha no login anônimo:', '[Sessão] Falha no login local:'],
];

// strict=true: falha se alguma string não existir (usar no arquivo que a
// public/index.html de fato serve). strict=false: aplica o que existir e
// avisa o resto — usado só na cópia duplicada da raiz, que não é servida
// (public/ tem prioridade no static do Express) e pode ter ficado de um
// build diferente.
function patchFile(filePath, { strict = true } = {}) {
  let code = fs.readFileSync(filePath, 'utf8');
  let appliedCount = 0;

  for (const [from, to] of replacements) {
    if (!code.includes(from)) {
      if (strict) {
        throw new Error(`String esperada não encontrada em ${filePath}: ${JSON.stringify(from.slice(0, 60))}`);
      }
      console.warn(`(pulado, não encontrado em ${filePath}): ${JSON.stringify(from.slice(0, 60))}`);
      continue;
    }
    code = code.split(from).join(to);
    appliedCount++;
  }

  fs.writeFileSync(filePath, code, 'utf8');
  console.log(`Successfully patched ${filePath} (${appliedCount}/${replacements.length} substituições)`);
}

patchFile('public/assets/index-Dl2uwfPA.js', { strict: true });
patchFile('assets/index-Dl2uwfPA.js', { strict: false });
