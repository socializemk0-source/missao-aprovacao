export const essayBanks = [
  'Treino geral',
  'Cebraspe',
  'FGV',
  'FCC',
  'Vunesp',
  'Cesgranrio',
] as const;
export const essayCriteria = [
  {
    id: 'tema',
    label: 'Tema e tese',
    max: 20,
    description: 'Responde ao tema e apresenta um posicionamento claro de acordo com a banca.',
  },
  {
    id: 'argumentos',
    label: 'Argumentação e Conteúdo',
    max: 30,
    description: 'Desenvolve razões, exemplos, tópicos exigidos e repertório que sustentam a proposta.',
  },
  {
    id: 'organizacao',
    label: 'Estrutura e Coesão',
    max: 20,
    description: 'Articula parágrafos com conectivos adequados, progressão textual e padrão estrutural da banca.',
  },
  {
    id: 'linguagem',
    label: 'Norma-padrão e Precisão',
    max: 30,
    description:
      'Emprega concordância, regência, pontuação, ortografia e vocabulário formal apropriado.',
  },
] as const;
export const essayTopics = [
  {
    id: 'cebraspe-seguranca',
    bank: 'Cebraspe',
    title: 'A integração das forças de segurança e o combate às organizações criminosas',
    prompt:
      'Considerando que o texto acima tem caráter unicamente motivador, redija um texto dissertativo acerca da integração das forças de segurança pública no Brasil. Ao elaborar seu texto, aborde, necessariamente, os seguintes aspectos: 1. A importância da inteligência e da cooperação interestadual [9,50 pts]; 2. O papel da tecnologia no monitoramento e controle de fronteiras [9,50 pts]; 3. A garantia dos direitos fundamentais na atuação ostensiva [10,00 pts].',
    support:
      'O combate ao crime organizado exige ações coordenadas que superem divisões federativas. O compartilhamento de dados e operações conjuntas entre Polícia Federal, Polícia Rodoviária Federal e polícias estaduais têm se mostrado decisivos para desarticular rotas logísticas e financeiras.',
    questions: [
      'Aborde o Tópico 1 em parágrafo específico com conectivo de início.',
      'Desenvolva o Tópico 2 detalhando ferramentas tecnológicas e vigilância integrada.',
      'Dedique o terceiro parágrafo ao Tópico 3, fundamentando a legalidade e dignidade humana.',
    ],
  },
  {
    id: 'cebraspe-governanca',
    bank: 'Cebraspe',
    title: 'Governança pública, transparência e compliance no combate à corrupção',
    prompt:
      'Redija um texto dissertativo acerca da governança e da integridade na administração pública. Em seu texto, atenda obrigatoriamente aos seguintes tópicos: 1. O papel dos órgãos de controle interno e externo na fiscalização [9,50 pts]; 2. A relevância dos programas de integridade (compliance) e canais de denúncia [9,50 pts]; 3. O impacto da transparência ativa na confiança do cidadão nas instituições [10,00 pts].',
    support:
      'A administração pública contemporânea adota modelos de conformidade e integridade inspirados nas melhores práticas globais, fortalecendo a prestação de contas (accountability) e mitigando desvios.',
    questions: [
      'Responda ao Tópico 1 destacando Tribunais de Contas e controladorias.',
      'Conecte o Tópico 2 à proteção do denunciante e cultura ética institucional.',
      'Encerre respondendo ao Tópico 3 com dados de transparência ativa.',
    ],
  },
  {
    id: 'fgv-ia-administracao',
    bank: 'FGV',
    title: 'Inteligência Artificial e os limites da discricionariedade administrativa',
    prompt:
      'A automação de processos decisórios pelo poder público promete celeridade, mas suscita debates sobre a impessoalidade e a devida motivação dos atos administrativos. Redija um texto dissertativo-argumentativo posicionando-se sobre os limites éticos e jurídicos do uso de algoritmos na tomada de decisões pelo Estado.',
    support:
      'O uso de sistemas automatizados e modelos de IA para análise de benefícios, fiscalização tributária e triagem judicial expande-se rapidamente. Críticos alertam para riscos de "caixa-preta" algorítmica e discriminação sistêmica.',
    questions: [
      'Defina sua tese claramente na introdução: a IA deve ser ferramenta de apoio ou decisora final?',
      'Fundamente com princípios constitucionais (Art. 37 da CF/88).',
      'Evite fórmulas prontas; elabore uma conclusão reflexiva e crítica.',
    ],
  },
  {
    id: 'fgv-reforma-tributaria',
    bank: 'FGV',
    title: 'Reforma tributária, justiça fiscal e o pacto federativo',
    prompt:
      'Redija um texto dissertativo-argumentativo discutindo como conciliar a necessária simplificação do sistema tributário brasileiro com a garantia da autonomia de Estados e Municípios e a redução da regressividade fiscal.',
    support:
      'O modelo tributário sobre o consumo historicamente onerou as camadas mais vulneráveis e gerou insegurança jurídica decorrente da guerra fiscal federativa.',
    questions: [
      'Apresente um posicionamento contundente sobre a simplificação tributária.',
      'Articule os desafios do pacto federativo sem perder a coesão vocabular culta.',
      'Sustente a necessidade de justiça fiscal redistributiva com argumentos sólidos.',
    ],
  },
  {
    id: 'fcc-trabalho-dignidade',
    bank: 'FCC',
    title: 'A dignidade da pessoa humana e as novas relações de trabalho por plataformas',
    prompt:
      'Com base na leitura reflexiva da realidade contemporânea, redija um texto dissertativo analisando as transformações do mundo do trabalho sob o império dos algoritmos, confrontando a flexibilidade prometida com a imperatividade da proteção social e da dignidade humana.',
    support:
      'Para muitos, o trabalho por aplicativo representa autonomia e oportunidade de renda; para outros, trata-se de precarização sem direitos básicos e subordinação a métricas invisíveis.',
    questions: [
      'Mobilize autores e conceitos sociológicos ou jurídicos.',
      'Evite juízos de senso comum ou maniqueísmos superficiais.',
      'Analise a responsabilidade das instituições na garantia do patamar civilizatório mínimo.',
    ],
  },
  {
    id: 'fcc-justica-cidadania',
    bank: 'FCC',
    title: 'O acesso à justiça como instrumento de efetivação da cidadania plena',
    prompt:
      'Redija um texto dissertativo-argumentativo refletindo sobre o alcance do Poder Judiciário na redução das desigualdades estruturais brasileiras e na materialização das promessas constitucionais de cidadania.',
    support:
      'A judicialização de demandas por saúde, educação e moradia reflete ao mesmo tempo a confiança da sociedade na Justiça e os limites das políticas públicas do Executivo.',
    questions: [
      'Examine a tensão entre ativismo judicial, separação de poderes e garantia de direitos sociais.',
      'Explore o conceito de cidadania ativa e dignidade coletiva.',
      'Conclua com uma síntese que amarre coerentemente as premissas reflexivas adotadas.',
    ],
  },
  {
    id: 'vunesp-cameras-seguranca',
    bank: 'Vunesp',
    title: 'Câmeras corporais na atividade policial: garantia de transparência ou limitação operacional?',
    prompt:
      'A partir dos textos de apoio e de seus conhecimentos, redija um texto dissertativo-argumentativo em norma-padrão da língua portuguesa respondendo ao seguinte questionamento: o uso obrigatório de câmeras corporais por policiais militares fortalece a segurança pública e os direitos fundamentais ou compromete a pronta resposta e a autonomia operacional das corporações?',
    support:
      'Estudos indicam redução de letalidade policial e de mortes de policiais em batalhões que adotaram câmeras; por outro lado, vozes no meio policial argumentam receio de hesitação em momentos de legítima defesa.',
    questions: [
      'Responda diretamente à pergunta central da proposta logo na introdução com tese explícita.',
      'Desenvolva argumentos sustentando sua escolha e refute contra-argumentos de forma fundamentada.',
      'Mantenha coerência lógica e conclua reafirmando a posição defendida.',
    ],
  },
  {
    id: 'vunesp-privatizacao-servicos',
    bank: 'Vunesp',
    title: 'A concessão de serviços essenciais à iniciativa privada: eficiência ou risco à universalidade?',
    prompt:
      'Redija um texto dissertativo-argumentativo em norma culta posicionando-se de maneira clara sobre a seguinte questão: a delegação de serviços públicos essenciais (como água, saneamento e transporte) à iniciativa privada assegura modernização e investimentos ou compromete o acesso universal das populações de baixa renda?',
    support:
      'Defensores apontam investimentos robustos e metas contratuais de atendimento; opositores alertam para reajustes tarifários e negligência em regiões periféricas de baixa rentabilidade.',
    questions: [
      'Tome partido explícito frente ao dilema da proposta, sem dubiedade.',
      'Fundamente com exemplos concretos de concessões e regulação estatal.',
      'Elabore uma conclusão consistente que amarre todo o raciocínio.',
    ],
  },
  {
    id: 'cesgranrio-equidade-cnu',
    bank: 'Cesgranrio',
    title: 'Políticas de cotas e equidade racial no fortalecimento do serviço público',
    prompt:
      'Considerando o papel do Estado como indutor da justiça social, redija um texto dissertativo acerca da relevância das ações afirmativas e da diversidade na composição do quadro de servidores públicos brasileiros para a formulação de políticas mais representativas.',
    support:
      'A Lei de Cotas no serviço público completou uma década, ampliando a representatividade em carreiras federais, embora ainda haja sub-representação nos postos de alta liderança governamental.',
    questions: [
      'Destaque o princípio da isonomia material e a reparação histórica.',
      'Discuta como servidores diversos compreendem melhor as dores da população usuária.',
      'Proponha medidas viáveis para consolidação de lideranças inclusivas na gestão pública.',
    ],
  },
  {
    id: 'cesgranrio-governo-digital',
    bank: 'Cesgranrio',
    title: 'Governo digital e a garantia de acesso para cidadãos em vulnerabilidade',
    prompt:
      'Redija um texto dissertativo-argumentativo analisando os avanços da plataforma Gov.br e os desafios para assegurar que a digitalização dos serviços públicos não crie novas formas de exclusão social e desamparo ao cidadão.',
    support:
      'Milhões de brasileiros realizam serviços públicos pelo celular, mas quase 30 milhões de pessoas ainda não possuem acesso estável à internet ou letramento digital suficiente.',
    questions: [
      'Contextualize o salto de eficiência administrativa propiciado pela tecnologia.',
      'Aponte os obstáculos enfrentados por idosos e populações de baixa renda.',
      'Apresente propostas práticas de atendimento híbrido (presencial + digital) humanizado.',
    ],
  },
  {
    id: 'digital',
    title: 'Inclusão digital no acesso aos serviços públicos',
    prompt:
      'Discuta como ampliar os serviços digitais sem excluir cidadãos com dificuldades de acesso à tecnologia.',
    support:
      'Situação fictícia: um município passou a agendar atendimentos pela internet. Parte dos moradores não dispõe de conexão ou tem dificuldade para usar o sistema. A equipe precisa conciliar agilidade e acesso.',
    questions: [
      'Qual problema merece prioridade?',
      'Que consequências atingem o cidadão?',
      'Como sustentar uma solução viável?',
    ],
  },
  {
    id: 'atendimento',
    title: 'Atendimento humanizado e eficiência',
    prompt:
      'Discuta como conciliar eficiência administrativa e atendimento humanizado ao cidadão.',
    support:
      'Situação fictícia: uma unidade deseja reduzir filas. A equipe debate como agilizar o atendimento sem deixar de explicar procedimentos às pessoas que precisam de orientação.',
    questions: [
      'Rapidez é suficiente para definir qualidade?',
      'Que práticas podem atender às duas necessidades?',
      'Quais obstáculos precisam ser enfrentados?',
    ],
  },
  {
    id: 'dados',
    title: 'Uso responsável de dados no serviço público',
    prompt:
      'Analise desafios do uso de dados para melhorar serviços e preservar a confiança dos cidadãos.',
    support:
      'Situação fictícia: setores de uma instituição pretendem compartilhar informações para evitar solicitações repetidas de documentos. A proposta exige discutir finalidade, acesso e cuidados.',
    questions: [
      'Qual benefício você defenderá?',
      'Que risco precisa ser considerado?',
      'Como relacionar cuidado e confiança?',
    ],
  },
  {
    id: 'comunicacao',
    title: 'Linguagem clara na comunicação pública',
    prompt:
      'Discuta a importância da linguagem clara para o acesso do cidadão aos serviços públicos.',
    support:
      'Situação fictícia: um comunicado sobre inscrição recebeu muitas dúvidas. Embora trouxesse informações essenciais, utilizava siglas e expressões pouco conhecidas pelo público.',
    questions: [
      'Como a forma de escrever pode criar barreiras?',
      'Que exemplo sustenta sua tese?',
      'Como melhorar sem perder precisão?',
    ],
  },
  {
    id: 'sustentabilidade',
    title: 'Sustentabilidade na rotina administrativa',
    prompt:
      'Discuta como práticas sustentáveis podem ser incorporadas à rotina de uma instituição pública.',
    support:
      'Situação fictícia: uma equipe avalia consumo de papel, energia e materiais. O desafio é propor mudanças que possam ser acompanhadas ao longo do tempo.',
    questions: [
      'Qual prática teria impacto concreto?',
      'Como evitar uma discussão genérica?',
      'Como acompanhar os resultados?',
    ],
  },
  {
    id: 'capacitacao',
    title: 'Capacitação contínua dos servidores',
    prompt:
      'Analise o papel da capacitação contínua na melhoria dos serviços prestados à sociedade.',
    support:
      'Situação fictícia: um setor implantou um novo sistema, mas a equipe recebeu pouco tempo para aprender a utilizá-lo. Surgiram retrabalho e dúvidas de atendimento.',
    questions: [
      'Qual relação existe entre formação e qualidade?',
      'Que dificuldade de implementação merece atenção?',
      'Como concluir sem apenas repetir a introdução?',
    ],
  },
];
export type EssayReport = {
  summary: string;
  criteria: { id: string; score: number; reason: string }[];
  annotations: { quote: string; issue: string; suggestion: string }[];
  strengths: string[];
  nextSteps: string[];
};
export type EssayVersion = {
  id: string;
  date: string;
  topicId: string;
  bank: string;
  text: string;
  report: EssayReport;
};
export type EssayNotebook = {
  drafts: Record<string, string>;
  history: EssayVersion[];
};
export function restoreEssayNotebook(raw: string | null): EssayNotebook | null {
  if (!raw) return { drafts: {}, history: [] };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return null;
    const draftData =
      parsed.drafts &&
      typeof parsed.drafts === 'object' &&
      !Array.isArray(parsed.drafts)
        ? parsed.drafts
        : {};
    const drafts = Object.fromEntries(
      Object.entries(draftData).filter(
        ([k, v]) =>
          essayBanks.some((b) =>
            essayTopics.some((t) => k === b + '::' + t.id),
          ) &&
          typeof v === 'string' &&
          v.length <= 10000,
      ),
    ) as Record<string, string>;
    const history = (Array.isArray(parsed.history) ? parsed.history : [])
      .filter(
        (v: EssayVersion) =>
          v &&
          typeof v.id === 'string' &&
          typeof v.date === 'string' &&
          Number.isFinite(Date.parse(v.date)) &&
          essayTopics.some((t) => t.id === v.topicId) &&
          essayBanks.some((b) => b === v.bank) &&
          typeof v.text === 'string' &&
          v.text.length <= 10000 &&
          validEssayReport(v.report, v.text),
      )
      .slice(0, 12);
    return { drafts, history };
  } catch {
    return null;
  }
}
export const essayScore = (r: EssayReport) =>
  r.criteria.reduce((n, c) => n + c.score, 0);
export const wordCount = (text: string) =>
  text.trim() ? text.trim().split(/\s+/u).length : 0;
export function validEssayReport(
  value: unknown,
  text: string,
): value is EssayReport {
  const r = value as EssayReport;
  const str = (v: unknown) =>
    typeof v === 'string' && v.length > 0 && v.length <= 1800;
  return (
    !!r &&
    str(r.summary) &&
    Array.isArray(r.criteria) &&
    r.criteria.length === 4 &&
    essayCriteria.every((c) => {
      const found = r.criteria.filter((x) => x && x.id === c.id);
      return (
        found.length === 1 &&
        Number.isInteger(found[0].score) &&
        found[0].score >= 0 &&
        found[0].score <= c.max &&
        str(found[0].reason)
      );
    }) &&
    Array.isArray(r.annotations) &&
    r.annotations.length <= 8 &&
    r.annotations.every(
      (a) =>
        !!a &&
        str(a.quote) &&
        text.includes(a.quote) &&
        str(a.issue) &&
        str(a.suggestion),
    ) &&
    Array.isArray(r.strengths) &&
    r.strengths.length <= 4 &&
    r.strengths.every(str) &&
    Array.isArray(r.nextSteps) &&
    r.nextSteps.length >= 1 &&
    r.nextSteps.length <= 4 &&
    r.nextSteps.every(str)
  );
}
