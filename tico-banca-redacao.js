// tico-banca-redacao.js - Experiência Completa de Redação por Banca de Concurso
(function() {
  'use strict';

  const BANCA_DATA = {
    Cebraspe: {
      id: 'Cebraspe',
      name: 'Cebraspe (CESPE)',
      tag: 'Tópicos Objetivos',
      icon: '🎯',
      badge: 'Padrão de Resposta em Tópicos · Sem Título · 30 Linhas',
      color: '#1e5a80',
      bgLight: '#eef8ff',
      borderLight: '#cce5f6',
      idealLines: '25 a 30 linhas (mínimo de 20 linhas na maioria dos editais)',
      titleRule: 'NÃO coloque título (desperdiça linhas e não pontua no Cebraspe)',
      formula: 'NPD = NC - 2 × (NE / TL) — [Nota da Prova Discursiva = Nota de Conteúdo - 2 × (Erros / Total de Linhas)]',
      structure: [
        { label: '§1 Introdução Concisa', desc: 'Breve apresentação do tema central (2 a 3 linhas). É opcional ou curta, pois a pontuação real está nos tópicos.' },
        { label: '§2 Tópico 1 (Espelho)', desc: 'Conectivo obrigatório: "Inicialmente, no tocante a [Tópico 1]...". Responda de forma direta e técnica.' },
        { label: '§3 Tópico 2 (Espelho)', desc: 'Conectivo: "Ademais, no que diz respeito a [Tópico 2]...". Traga exemplos práticos, dispositivos de leis ou da CF/88.' },
        { label: '§4 Tópico 3 (Espelho)', desc: 'Conectivo: "Por fim, acerca de [Tópico 3]...". Responda integralmente e faça o fecho da dissertação.' }
      ],
      loves: [
        'Responder pontualmente a CADA subitem do comando em parágrafos separados.',
        'Conectivos interparágrafos explícitos ("Inicialmente...", "Ademais...", "Por fim...").',
        'Letra legível e preenchimento até o final da linha, respeitando as margens.',
        'Citação precisa de princípios constitucionais (Art. 37, Art. 5º da CF/88) e leis de regência.'
      ],
      avoids: [
        'NUNCA insira título (o Cebraspe não exige título e você perde linha útil).',
        'Evite introduções longas que não abordam os tópicos da folha de resposta.',
        'Não ultrapasse a linha 30 e jamais escreva fora dos limites da margem.',
        'Em caso de erro, passe um risco simples e continue. Não rasure.'
      ],
      skeleton: `Em análise da questão proposta, cabe destacar a relevância de [tema central].

Inicialmente, no tocante a [Tópico 1 do espelho], verifica-se que [argumento técnico com fundamento legal ou factual]. Desse modo, evidencia-se que [consequência ou desdobramento prático].

Ademais, no que concerne a [Tópico 2 do espelho], constata-se que [análise técnica e mecanismos de implementação]. Nesse contexto, a atuação do Estado se faz imprescindível para [resultado esperado].

Por fim, no que se refere a [Tópico 3 do espelho], é fundamental ressaltar que [fechamento com garantia de direitos e impacto positivo na sociedade].`
    },

    FGV: {
      id: 'FGV',
      name: 'Fundação Getulio Vargas (FGV)',
      tag: 'Tese & Densidade',
      icon: '⚖️',
      badge: 'Tese Contundente · Rigor Vocabular · Densidade Argumentativa',
      color: '#4f46e5',
      bgLight: '#eef2ff',
      borderLight: '#c7d2fe',
      idealLines: '25 a 30 linhas',
      titleRule: 'Título opcional (recomenda-se omitir para priorizar espaço de argumentação)',
      formula: 'Parte I: Estrutura Textual e Conteúdo (60%) + Parte II: Correção Gramatical e Vocabular (40%)',
      structure: [
        { label: '§1 Introdução com Tese Explícita', desc: 'Apresente o tema e crava seu posicionamento claro e incontornável logo nas primeiras linhas.' },
        { label: '§2 D1 - Argumento Principal', desc: 'Desenvolvimento fundamentado com dados, doutrina, princípios ou fatos notórios. Sem clichês.' },
        { label: '§3 D2 - Aprofundamento Crítico', desc: 'Confronte contra-argumentos ou aprofunde os impactos institucionais e sociais.' },
        { label: '§4 Conclusão Reflexiva', desc: 'Retome a tese reafirmando o posicionamento crítico. Evite receitas prontas no formato ENEM.' }
      ],
      loves: [
        'Tese clara, explícita e defensável já no primeiro parágrafo.',
        'Vocabulário formal, culto e preciso (elimine termos genéricos como "coisa", "fazer", "algo").',
        'Articulação coesiva refinada entre orações e parágrafos.',
        'Progressão lógica com causa, consequência e análise crítica real.'
      ],
      avoids: [
        'Evite chavões e clichês ("desde os primórdios", "atualmente vivemos", "nos dias de hoje").',
        'Evite neutralidade ou ficar "em cima do muro": a FGV exige posicionamento firme.',
        'Evite parágrafos com períodos monótonos ou sentenças isoladas sem conexão.',
        'Evite propostas de intervenção ingênuas ou paternalistas.'
      ],
      skeleton: `A questão relativa a [tema em debate] suscita reflexões essenciais acerca de [aspecto central]. Nesse cenário, torna-se evidente que [sua tese explícita e firme], sobretudo diante dos desafios impostos por [causa ou contexto].

Em primeiro plano, cabe sublinhar que [argumento 1 com densidade conceitual]. De acordo com [autor/princípio/legislação], a ausência de mecanismos eficientes resulta em [consequência direta]. Logo, a consolidação de [medida técnica] revela-se imperativa.

Outrossim, é imperioso analisar que [argumento 2 / contra-análise]. Embora se alegue comumente que [ponto de vista oposto], a realidade fática demonstra que [refutação consistente]. Desse modo, perpetua-se um quadro de vulnerabilidade que demanda resposta institucional.

Infere-se, portanto, que a superação desse impasse perpassa por [síntese do raciocínio]. Somente mediante [desfecho reflexivo e articulação ética] será possível assegurar a efetividade do interesse público.`
    },

    FCC: {
      id: 'FCC',
      name: 'Fundação Carlos Chagas (FCC)',
      tag: 'Filosofia & Cidadania',
      icon: '🏛️',
      badge: 'Maturidade Filosófica · Tribunais · Fuga do Senso Comum',
      color: '#0d9488',
      bgLight: '#f0fdfa',
      borderLight: '#99f6e4',
      idealLines: '25 a 30 linhas',
      titleRule: 'Título dispensável (salvo expressa exigência na folha de prova)',
      formula: 'Conteúdo (40 a 50 pts) + Estrutura (30 a 40 pts) + Expressão/Gramática (20 a 30 pts)',
      structure: [
        { label: '§1 Introdução Problematizadora', desc: 'Contextualize o tema conectando-o à condição humana, ética ou desafios da sociedade moderna.' },
        { label: '§2 Desenvolvimento Teórico', desc: 'Mobilize repertório legítimo (sociologia, filosofia, história, direitos fundamentais).' },
        { label: '§3 Desenvolvimento Prático', desc: 'Traga a reflexão para o contexto das instituições brasileiras e da cidadania ativa.' },
        { label: '§4 Conclusão Síntese', desc: 'Fechamento que amarre a dignidade humana com o avanço civilizatório coletivo.' }
      ],
      loves: [
        'Repertório sociocultural legitimado (filósofos, sociólogos, literatura, CF/88).',
        'Profundidade analítica e fuga absoluta de respostas fáceis ou moralistas.',
        'Linguagem elegante, culta e períodos bem dosados com subordinação correta.',
        'Enxergar o tema sob a ótica da dignidade da pessoa humana e justiça social.'
      ],
      avoids: [
        'Evite argumentos superficiais de senso comum ("as pessoas precisam se conscientizar").',
        'Evite listar autores sem articular o pensamento deles ao tema da redação.',
        'Evite informalidade, gírias ou simplificações maniqueístas (bem versus mal).',
        'Evite tangenciar a reflexão filosófica proposta no texto motivador.'
      ],
      skeleton: `Ao refletir sobre [tema proposto], depara-se com um dos dilemas mais profundos da sociedade contemporânea: [tensão central entre valores ou direitos]. Nesse sentido, impõe-se reconhecer que [sua reflexão de fundo / tese humanística], sob pena de comprometer o próprio patamar civilizatório.

Sob essa ótica, convém evocar a perspectiva de [autor ou conceito filosófico/sociológico], para quem [ideia-chave teórica]. Transportada essa reflexão para o contexto brasileiro, observa-se que [análise crítica das relações sociais ou do serviço público]. A consequência imediata dessa dinâmica manifesta-se em [impacto na cidadania].

Ademais, a dimensão ética do problema exige compreender que [segundo desdobramento analítico]. Longe de constituir um fenômeno isolado, a questão vincula-se à garantia dos direitos fundamentais consagrados na ordem constitucional. Quando as instituições falham em mediar tais conflitos, aprofundam-se as assimetrias sociais.

Torna-se forçoso concluir, assim, que a construção de uma ordem mais justa depende de [fecho reflexivo]. Mais do que ajustes procedimentais, trata-se de reafirmar a centralidade da pessoa humana como vetor orientador de toda ação estatal.`
    },

    Vunesp: {
      id: 'Vunesp',
      name: 'Fundação VUNESP',
      tag: 'Pergunta-Problema',
      icon: '📝',
      badge: 'Pergunta-Problema · Resposta Direta · Coesão e Clareza',
      color: '#ea580c',
      bgLight: '#fff7ed',
      borderLight: '#fed7aa',
      idealLines: '25 a 30 linhas',
      titleRule: 'Título opcional (ocupa a linha 1 se colocado)',
      formula: 'Critério A (Tema e Tese: 30%) + Critério B (Estrutura e Coesão: 30%) + Critério C (Expressão: 40%)',
      structure: [
        { label: '§1 Introdução com Resposta Direta', desc: 'Responda imediatamente à pergunta formulada pela banca e defina sua posição.' },
        { label: '§2 Argumento de Sustentação', desc: 'Apresente os motivos sólidos que confirmam a escolha do seu posicionamento.' },
        { label: '§3 Contra-argumentação ou Impactos', desc: 'Aborde o contraponto com maturidade, demonstrando por que sua tese é superior.' },
        { label: '§4 Conclusão de Reafirmação', desc: 'Reafirme a resposta dada à questão inicial com desfecho coerente.' }
      ],
      loves: [
        'Responder explicitamente à pergunta-problema elaborada na proposta.',
        'Tomar partido claro, coerente e sem ambiguidades.',
        'Parágrafos bem equilibrados (cerca de 6 a 7 linhas cada).',
        'Coerência interna e repertório conectado à realidade brasileira.'
      ],
      avoids: [
        'Ficar "em cima do muro" ou dar respostas dúbias ("tem lados bons e lados ruins").',
        'Copiar frases dos textos motivadores (desconto drástico de pontuação).',
        'Erros gramaticais de concordância, regência e crase.',
        'Fuga do tema ou abordagem de assunto secundário.'
      ],
      skeleton: `Diante da indagação sobre se [pergunta formulada pela banca], é forçoso responder [afirmativamente / negativamente]: [sua tese explícita e direta]. Embora o tema divida opiniões, [motivo central que sustenta seu posicionamento].

Em primeiro lugar, destaca-se que [argumento 1 com justificativa e dados ou legislação]. A experiência demonstra que [exemplo prático ou desdobramento observável]. Por conseguinte, desconsiderar tal realidade implica fragilizar [aspecto protegido pelo seu ponto de vista].

Por outro lado, embora vozes contrárias sustentem que [apresentação do contra-argumento], tal perspectiva não se sustenta diante de [refutação técnica e fática]. A mitigação de eventuais riscos operacionais pode ser obtida por meio de [solução de equilíbrio], sem abdicar da diretriz principal.

Depreende-se, em suma, que [reafirmação enfática da tese em resposta à pergunta da banca]. O aprimoramento desse cenário demanda [conclusão coesa], consolidando um modelo equilibrado e eficaz para toda a coletividade.`
    },

    Cesgranrio: {
      id: 'Cesgranrio',
      name: 'Fundação Cesgranrio (CNU / Bancos)',
      tag: 'Políticas Públicas',
      icon: '🌐',
      badge: 'Políticas Públicas · Cidadania & Inclusão · Viabilidade Prática',
      color: '#2563eb',
      bgLight: '#eff6ff',
      borderLight: '#bfdbfe',
      idealLines: '25 a 30 linhas (mínimo de 20 linhas)',
      titleRule: 'Título dispensável (foco no conteúdo e preenchimento das linhas)',
      formula: 'Adequação ao Tema (30 pts) + Domínio Técnico e Estrutura (40 pts) + Norma-Padrão (30 pts)',
      structure: [
        { label: '§1 Desafio da Gestão Pública', desc: 'Contextualize o problema à luz da função social do Estado e do atendimento ao cidadão.' },
        { label: '§2 Desafios e Causas', desc: 'Aponte barreiras enfrentadas pela população vulnerável e gargalos da administração.' },
        { label: '§3 Ações Viáveis e Ética', desc: 'Apresente caminhos executáveis, citando leis (LGPD, Estatuto da Igualdade Racial, CF/88).' },
        { label: '§4 Proposta Integrada', desc: 'Conclua com medidas coordenadas entre Estado e sociedade visando equidade.' }
      ],
      loves: [
        'Foco na função social do Estado e na dignidade do usuário dos serviços públicos.',
        'Propostas realistas, éticas, sustentáveis e orçamentariamente viáveis.',
        'Menção a marcos legais fundamentais (CF/88, leis de inclusão, transparência).',
        'Linguagem clara, objetiva, inclusiva e acessível.'
      ],
      avoids: [
        'Propostas mágicas ou inviáveis ("criar um novo órgão para cada problema").',
        'Desconsiderar os cidadãos em situação de vulnerabilidade ou exclusão digital.',
        'Discursos puramente teóricos desconectados da realidade prática do serviço público.',
        'Desvios gramaticais e períodos truncados.'
      ],
      skeleton: `A consolidação de serviços públicos eficientes e universais representa um dos pilares centrais da cidadania brasileira, conforme preceitua a Constituição Federal de 1988. No entanto, a discussão em torno de [tema central] revela que [tese voltada à função social do Estado e inclusão].

Nesse prisma, cumpre destacar que [diagnóstico do problema e impacto no cidadão]. A despeito dos avanços observados, parcelas significativas da sociedade enfrentam [barreiras práticas de acesso]. Desse modo, o poder público não pode limitar sua atuação a critérios estritamente formais, devendo assegurar a isonomia material.

Paralelamente, a formulação de respostas efetivas requer [medida viável e articulação intersetorial]. A integração entre [órgãos competentes ou instrumentos tecnológicos e humanos] possibilita mitigar disparidades históricas. Ademais, a capacitação continuada dos servidores surge como vetor indispensável para humanizar o atendimento.

Conclui-se, portanto, que a superação das barreiras em relação a [tema] demanda um compromisso conjunto e continuado. Mediante políticas públicas estruturadas e controle social participativo, o Estado reafirma sua missão precípua de promover o bem de todos com equidade e transparência.`
    },

    'Treino geral': {
      id: 'Treino geral',
      name: 'Treino Geral de Concursos',
      tag: 'Fundamentos',
      icon: '💡',
      badge: 'Fundamentos da Dissertação · Argumentação Sólida · Coesão',
      color: '#16a34a',
      bgLight: '#f0fdf4',
      borderLight: '#bbf7d0',
      idealLines: '20 a 30 linhas',
      titleRule: 'Título opcional',
      formula: 'Tema (20 pts) + Argumentação (30 pts) + Organização (20 pts) + Linguagem (30 pts)',
      structure: [
        { label: '§1 Introdução e Tese', desc: 'Apresentação do assunto e declaração do ponto de vista a ser defendido.' },
        { label: '§2 Primeiro Argumento', desc: 'Desenvolvimento do primeiro motivo, com exemplos ou dados comprobatórios.' },
        { label: '§3 Segundo Argumento', desc: 'Desenvolvimento do segundo motivo, aprofundando as causas ou consequências.' },
        { label: '§4 Conclusão Síntese', desc: 'Retomada dos argumentos principais e considerações finais.' }
      ],
      loves: [
        'Clareza e objetividade na exposição das ideias.',
        'Conectivos variados entre períodos e parágrafos.',
        'Divisão equilibrada dos 4 parágrafos.',
        'Uso correto da norma culta e pontuação precisa.'
      ],
      avoids: [
        'Fuga parcial ou total do tema.',
        'Textos muito curtos com menos de 15 a 20 linhas.',
        'Repetição de ideias sem acréscimo de conteúdo novo.',
        'Gírias e traços de linguagem oral.'
      ],
      skeleton: `A temática de [tema em questão] adquire crescente relevância no cenário brasileiro contemporâneo. Diante disso, convém analisar como [tese e aspectos que serão examinados nos parágrafos seguintes], visando compreender suas repercussões sociais e institucionais.

Em primeiro lugar, é preciso considerar que [argumento 1 e justificativa]. Esse fator evidencia que [desdobramento prático]. Assim sendo, a observância de [princípio ou procedimento] mostra-se indispensável para assegurar a consistência das ações adotadas.

Em segundo lugar, cabe pontuar que [argumento 2 e causas/consequências]. Tal perspectiva reforça a urgência de aprimorar [gestão, processos ou capacitação]. Quando esses elementos convergem, amplia-se a probabilidade de êxito e transparência.

Em suma, verifica-se que [tema] exige atenção contínua e integrada. Ao articular [medidas apontadas na argumentação], constrói-se um caminho propício para o fortalecimento da gestão e o atendimento satisfatório às necessidades da coletividade.`
    }
  };

  // BANCA SPECIFIC TOPICS CATALOG
  const BANCA_TOPICS = [
    {
      id: 'cebraspe-seguranca',
      bank: 'Cebraspe',
      badge: 'Estilo Cebraspe · Tópicos Espelho',
      title: 'A integração das forças de segurança e o combate às organizações criminosas',
      prompt: 'Considerando que o texto acima tem caráter unicamente motivador, redija um texto dissertativo acerca da integração das forças de segurança pública no Brasil. Ao elaborar seu texto, aborde, necessariamente, os seguintes aspectos: 1. A importância da inteligência e da cooperação interestadual [9,50 pts]; 2. O papel da tecnologia no monitoramento e controle de fronteiras [9,50 pts]; 3. A garantia dos direitos fundamentais na atuação ostensiva [10,00 pts].',
      support: 'O combate ao crime organizado exige ações coordenadas que superem divisões federativas. O compartilhamento de dados e operações conjuntas entre Polícia Federal, PRF e polícias estaduais têm se mostrado decisivos para desarticular rotas logísticas e financeiras ilícitas.',
      questions: [
        'Aborde o Tópico 1 em parágrafo específico com conectivo de início ("Inicialmente, no tocante à cooperação...")',
        'Desenvolva o Tópico 2 detalhando ferramentas tecnológicas e vigilância integrada.',
        'Dedique o terceiro parágrafo ao Tópico 3, fundamentando a legalidade e dignidade humana.'
      ]
    },
    {
      id: 'cebraspe-governanca',
      bank: 'Cebraspe',
      badge: 'Estilo Cebraspe · Tópicos Espelho',
      title: 'Governança pública, transparência e compliance no combate à corrupção',
      prompt: 'Redija um texto dissertativo acerca da governança e da integridade na administração pública. Em seu texto, atenda obrigatoriamente aos seguintes tópicos: 1. O papel dos órgãos de controle interno e externo na fiscalização [9,50 pts]; 2. A relevância dos programas de integridade (compliance) e canais de denúncia [9,50 pts]; 3. O impacto da transparência ativa na confiança do cidadão nas instituições [10,00 pts].',
      support: 'A administração pública contemporânea adota modelos de conformidade e integridade inspirados nas melhores práticas globais, fortalecendo a prestação de contas (accountability) e mitigando desvios.',
      questions: [
        'Responda ao Tópico 1 destacando Tribunais de Contas e controladorias.',
        'Conecte o Tópico 2 à proteção do denunciante e cultura ética institucional.',
        'Encerre respondendo ao Tópico 3 com dados de transparência ativa.'
      ]
    },
    {
      id: 'fgv-ia-administracao',
      bank: 'FGV',
      badge: 'Estilo FGV · Densidade Conceitual',
      title: 'Inteligência Artificial e os limites da discricionariedade administrativa',
      prompt: 'A automação de processos decisórios pelo poder público promete celeridade, mas suscita debates sobre a impessoalidade e a devida motivação dos atos administrativos. Redija um texto dissertativo-argumentativo posicionando-se sobre os limites éticos e jurídicos do uso de algoritmos na tomada de decisões pelo Estado.',
      support: 'O uso de sistemas automatizados e modelos de IA para análise de benefícios, fiscalização tributária e triagem judicial expande-se rapidamente. Críticos alertam para riscos de "caixa-preta" algorítmica e discriminação sistêmica.',
      questions: [
        'Defina sua tese claramente na introdução: a IA deve ser ferramenta de apoio ou decisora final?',
        'Fundamente com princípios constitucionais (Art. 37 da CF/88: publicidade, moralidade, eficiência).',
        'Evite fórmulas prontas; elabore uma conclusão reflexiva e crítica.'
      ]
    },
    {
      id: 'fgv-reforma-tributaria',
      bank: 'FGV',
      badge: 'Estilo FGV · Análise Crítica',
      title: 'Reforma tributária, justiça fiscal e o pacto federativo',
      prompt: 'Redija um texto dissertativo-argumentativo discutindo como conciliar a necessária simplificação do sistema tributário brasileiro com a garantia da autonomia de Estados e Municípios e a redução da regressividade fiscal.',
      support: 'O modelo tributário sobre o consumo historicamente onerou as camadas mais vulneráveis e gerou insegurança jurídica decorrente da guerra fiscal federativa.',
      questions: [
        'Apresente um posicionamento contundente sobre a simplificação tributária.',
        'Articule os desafios do pacto federativo sem perder a coesão vocabular culta.',
        'Sustente a necessidade de justiça fiscal redistributiva com argumentos sólidos.'
      ]
    },
    {
      id: 'fcc-trabalho-dignidade',
      bank: 'FCC',
      badge: 'Estilo FCC · Filosofia e Direitos',
      title: 'A dignidade da pessoa humana e as novas relações de trabalho por plataformas',
      prompt: 'Com base na leitura reflexiva da realidade contemporânea, redija um texto dissertativo analisando as transformações do mundo do trabalho sob o império dos algoritmos, confrontando a flexibilidade prometida com a imperatividade da proteção social e da dignidade humana.',
      support: 'Para muitos, o trabalho por aplicativo representa autonomia e oportunidade de renda; para outros, trata-se de precarização sem direitos básicos e subordinação a métricas invisíveis.',
      questions: [
        'Mobilize autores e conceitos sociológicos ou jurídicos (ex.: Bauman, Byung-Chul Han, valor social do trabalho).',
        'Evite juízos de senso comum ou maniqueísmos superficiais.',
        'Analise a responsabilidade das instituições e do Judiciário Trabalhista na garantia do patamar civilizatório mínimo.'
      ]
    },
    {
      id: 'fcc-justica-cidadania',
      bank: 'FCC',
      badge: 'Estilo FCC · Reflexão Tribunais',
      title: 'O acesso à justiça como instrumento de efetivação da cidadania plena',
      prompt: 'Redija um texto dissertativo-argumentativo refletindo sobre o alcance do Poder Judiciário na redução das desigualdades estruturais brasileiras e na materialização das promessas constitucionais de cidadania.',
      support: 'A judicialização de demandas por saúde, educação e moradia reflete ao mesmo tempo a confiança da sociedade na Justiça e os limites das políticas públicas do Executivo.',
      questions: [
        'Examine a tensão entre ativismo judicial, separação de poderes e garantia de direitos sociais.',
        'Explore o conceito de cidadania ativa e dignidade coletiva.',
        'Conclua com uma síntese que amarre coerentemente as premissas reflexivas adotadas.'
      ]
    },
    {
      id: 'vunesp-cameras-seguranca',
      bank: 'Vunesp',
      badge: 'Estilo VUNESP · Pergunta-Problema',
      title: 'Câmeras corporais na atividade policial: transparência ou limitação?',
      prompt: 'A partir dos textos de apoio e de seus conhecimentos, redija um texto dissertativo-argumentativo em norma-padrão da língua portuguesa respondendo ao seguinte questionamento: o uso obrigatório de câmeras corporais por policiais militares fortalece a segurança pública e os direitos fundamentais ou compromete a pronta resposta e a autonomia operacional das corporações?',
      support: 'Estudos indicam redução de letalidade policial e de mortes de policiais em batalhões que adotaram câmeras; por outro lado, vozes no meio policial argumentam receio de hesitação em momentos de legítima defesa.',
      questions: [
        'Responda diretamente à pergunta central da proposta logo na introdução com tese explícita.',
        'Desenvolva argumentos sustentando sua escolha e refute contra-argumentos de forma fundamentada.',
        'Mantenha coerência lógica e conclua reafirmando a posição defendida.'
      ]
    },
    {
      id: 'vunesp-privatizacao-servicos',
      bank: 'Vunesp',
      badge: 'Estilo VUNESP · Dilema Social',
      title: 'A concessão de serviços essenciais à iniciativa privada: eficiência ou risco?',
      prompt: 'Redija um texto dissertativo-argumentativo em norma culta posicionando-se de maneira clara sobre a seguinte questão: a delegação de serviços públicos essenciais (como água, saneamento e transporte) à iniciativa privada assegura modernização e investimentos ou compromete o acesso universal das populações de baixa renda?',
      support: 'Defensores apontam investimentos robustos e metas contratuais de atendimento; opositores alertam para reajustes tarifários e negligência em regiões periféricas de baixa rentabilidade.',
      questions: [
        'Tome partido explícito frente ao dilema da proposta, sem dubiedade.',
        'Fundamente com exemplos concretos de concessões e regulação estatal (agências reguladoras).',
        'Elabore uma conclusão consistente que amarre todo o raciocínio.'
      ]
    },
    {
      id: 'cesgranrio-equidade-cnu',
      bank: 'Cesgranrio',
      badge: 'Estilo Cesgranrio · Políticas Públicas CNU',
      title: 'Políticas de cotas e equidade racial no fortalecimento do serviço público',
      prompt: 'Considerando o papel do Estado como indutor da justiça social, redija um texto dissertativo acerca da relevância das ações afirmativas e da diversidade na composição do quadro de servidores públicos brasileiros para a formulação de políticas mais representativas.',
      support: 'A Lei de Cotas no serviço público completou uma década, ampliando a representatividade em carreiras federais, embora ainda haja sub-representação nos postos de alta liderança governamental.',
      questions: [
        'Destaque o princípio da isonomia material e a reparação histórica.',
        'Discuta como servidores diversos compreendem melhor as dores da população usuária.',
        'Proponha medidas viáveis para consolidação de lideranças inclusivas na gestão pública.'
      ]
    },
    {
      id: 'cesgranrio-governo-digital',
      bank: 'Cesgranrio',
      badge: 'Estilo Cesgranrio · Governo Digital',
      title: 'Governo digital e a garantia de acesso para cidadãos em vulnerabilidade',
      prompt: 'Redija um texto dissertativo-argumentativo analisando os avanços da plataforma Gov.br e os desafios para assegurar que a digitalização dos serviços públicos não crie novas formas de exclusão social e desamparo ao cidadão.',
      support: 'Milhões de brasileiros realizam serviços públicos pelo celular, mas quase 30 milhões de pessoas ainda não possuem acesso estável à internet ou letramento digital suficiente.',
      questions: [
        'Contextualize o salto de eficiência administrativa propiciado pela tecnologia.',
        'Aponte os obstáculos enfrentados por idosos e populações de baixa renda.',
        'Apresente propostas práticas de atendimento híbrido (presencial + digital) humanizado.'
      ]
    },
    {
      id: 'digital',
      bank: 'Treino geral',
      badge: 'Treino Geral · Inclusão',
      title: 'Inclusão digital no acesso aos serviços públicos',
      prompt: 'Discuta como ampliar os serviços digitais sem excluir cidadãos com dificuldades de acesso à tecnologia.',
      support: 'Situação fictícia: um município passou a agendar atendimentos pela internet. Parte dos moradores não dispõe de conexão ou tem dificuldade para usar o sistema. A equipe precisa conciliar agilidade e acesso.',
      questions: [
        'Qual problema merece prioridade?',
        'Que consequências atingem o cidadão?',
        'Como sustentar uma solução viável?'
      ]
    },
    {
      id: 'atendimento',
      bank: 'Treino geral',
      badge: 'Treino Geral · Atendimento',
      title: 'Atendimento humanizado e eficiência',
      prompt: 'Discuta como conciliar eficiência administrativa e atendimento humanizado ao cidadão.',
      support: 'Situação fictícia: uma unidade deseja reduzir filas. A equipe debate como agilizar o atendimento sem deixar de explicar procedimentos às pessoas que precisam de orientação.',
      questions: [
        'Rapidez é suficiente para definir qualidade?',
        'Que práticas podem atender às duas necessidades?',
        'Quais obstáculos precisam ser enfrentados?'
      ]
    }
  ];

  // BANCA-SPECIFIC DAILY STRATEGIC TIPS CATALOG
  const BANCA_TIPS = {
    Cebraspe: [
      {
        id: 'ceb-topicos-espelho',
        banca: 'Cebraspe',
        category: 'Estrutura & Critério',
        icon: '🎯',
        title: 'Tópicos Espelho: 100% no Padrão de Resposta',
        badge: 'Critério Ouro Cebraspe',
        summary: 'A banca Cebraspe pontua estritamente se você respondeu a cada aspecto do espelho.',
        explanation: 'Os corretores do Cebraspe corrigem com uma grade-espelho na mão. Para garantir a nota máxima de conteúdo, abra um parágrafo exclusivo para cada subtópico do comando e utilize os mesmos termos da banca logo na abertura do parágrafo.',
        exampleSnippet: 'Inicialmente, no tocante a [Tópico 1], cabe ressaltar que a atuação integrada dos órgãos de segurança pública viabiliza...',
        keyTakeaway: 'Inicie cada parágrafo com a expressão exata do tópico do espelho de resposta.'
      },
      {
        id: 'ceb-formula-penalidade',
        banca: 'Cebraspe',
        category: 'Fórmula da Nota',
        icon: '🧮',
        title: 'A Regra das 30 Linhas: Dilua a Penalidade de Erros',
        badge: 'Estratégia de Pontuação',
        summary: 'A fórmula NPD = NC - 2 × (NE / TL) penaliza mais quem escreve poucas linhas.',
        explanation: 'O Total de Linhas (TL) é o divisor no desconto dos erros gramaticais (NE). Quatro desvios em 20 linhas tiram 0,40 ponto. Os mesmos 4 desvios em 30 linhas tiram apenas 0,26 ponto! Escrever entre 28 e 30 linhas protege diretamente sua nota final.',
        exampleSnippet: 'Meta de Linhas: Introdução (3 linhas) + Tópico 1 (8 linhas) + Tópico 2 (8 linhas) + Tópico 3 (8 linhas) = 27 a 30 linhas preenchidas.',
        keyTakeaway: 'Aproxime-se da linha 30 para diluir o impacto matemático de qualquer erro formal.'
      },
      {
        id: 'ceb-sem-titulo',
        banca: 'Cebraspe',
        category: 'Otimização de Linhas',
        icon: '🚫',
        title: 'Nunca gaste linha com Título no Cebraspe',
        badge: 'Economia Tática',
        summary: 'No Cebraspe, o título não é pontuado e consome linhas vitais de conteúdo.',
        explanation: 'Salvo menção explícita no caderno de prova, o Cebraspe não exige título. Colocar título consome a linha 1 e obriga a pular a linha 2, deixando você com apenas 28 linhas para fundamentar os tópicos do espelho.',
        exampleSnippet: 'Inicie diretamente na Linha 1 da folha de resposta com a contextualização do tema ou o primeiro tópico espelho.',
        keyTakeaway: 'Aproveite 100% das 30 linhas para argumentação e fundamentação legal.'
      },
      {
        id: 'ceb-conectivos-padrao',
        banca: 'Cebraspe',
        category: 'Coesão Interparágrafos',
        icon: '🔗',
        title: 'Tríade de Conectivos Interparágrafos Cebraspe',
        badge: 'Apresentação & Coesão',
        summary: 'Apresentação e coesão interparágrafos são avaliadas de modo objetivo.',
        explanation: 'Para garantir a coesão sem floreios, adote a clássica progressão do Cebraspe: §1 Introdução concisa, §2 "Inicialmente, no tocante a [Tópico 1]...", §3 "Ademais, no que diz respeito a [Tópico 2]...", §4 "Por fim, no que se refere a [Tópico 3]...".',
        exampleSnippet: '§2: "Inicialmente, no tocante ao controle interno..."\n§3: "Ademais, no que tange à transparência pública..."\n§4: "Por fim, quanto aos canais de compliance..."',
        keyTakeaway: 'Conectivos claros no início de cada parágrafo guiam o olho do examinador ao espelho.'
      }
    ],
    FGV: [
      {
        id: 'fgv-densidade-vocabular',
        banca: 'FGV',
        category: 'Vocabulário & Densidade',
        icon: '⚖️',
        title: 'Adeus às Fórmulas Prontas: Rigor e Vocabulário Culto',
        badge: 'Padrão FGV',
        summary: 'A FGV zera modelos prontos estilo ENEM e preza por erudição e criticidade.',
        explanation: 'A FGV rejeita clichês ("desde a antiguidade", "é de suma importância", "cabe ao governo conscientizar"). A banca busca densidade conceitual, vocabulário formal preciso e raciocínio crítico maduro.',
        exampleSnippet: 'Evite: "O governo precisa fazer coisas para a saúde pública."\nPrefira: "Incumbe ao Estado implementar políticas redistributivas eficazes de atenção básica à saúde."',
        keyTakeaway: 'Troque verbos vagos (fazer, ter, ser) por termos técnicos e substantivos precisos.'
      },
      {
        id: 'fgv-tese-antecipada',
        banca: 'FGV',
        category: 'Estrutura & Tese',
        icon: '🎯',
        title: 'Tese Incontornável nas Primeiras 5 Linhas',
        badge: 'Impacto Inicial',
        summary: 'A introdução na FGV deve declarar imediatamente seu posicionamento crítico.',
        explanation: 'A FGV não tolera introduções neutras ou meramente expositivas. O candidato deve delimitar a problemática e cravá-la na tese logo nas primeiras 5 linhas, sinalizando os rumos da argumentação.',
        exampleSnippet: 'Nesse prisma, constata-se que a automação decisória estatal deve configurar mero subsídio procedimental, e jamais substituir o juízo ético da autoridade pública competente.',
        keyTakeaway: 'Posicione-se com clareza e firmeza desde o primeiro parágrafo.'
      },
      {
        id: 'fgv-contra-argumentacao',
        banca: 'FGV',
        category: 'Argumentação Avançada',
        icon: '🧠',
        title: 'O Poder da Contra-argumentação Qualificada',
        badge: 'Nota Máxima em Conteúdo',
        summary: 'Antecipar e refutar o ponto de vista oposto demonstra alta maturidade intelectual.',
        explanation: 'Para alcançar nota máxima no Critério de Conteúdo da FGV, dedique um dos parágrafos de desenvolvimento para desconstruir um contra-argumento. Isso comprova domínio analítico da complexidade do tema.',
        exampleSnippet: 'Embora correntes liberais sustentem que a desregulamentação irrestrita fomenta a inovação econômica, a experiência recente atesta que a ausência de supervisão regulatória aprofunda assimetrias concorrenciais.',
        keyTakeaway: 'Use "Embora se alegue que X, a realidade comprova Y" para elevar a complexidade do texto.'
      },
      {
        id: 'fgv-periodos-curtos',
        banca: 'FGV',
        category: 'Morfossintaxe',
        icon: '✂️',
        title: 'Evite Períodos-Centopeia: Pontuação Cirúrgica',
        badge: 'Correção Gramatical',
        summary: 'Períodos de 5 ou mais linhas sem ponto final causam desconto severo de pontuação.',
        explanation: 'A FGV pune quebra de paralelismo sintático, ambiguidades e truncamento decorrentes de períodos longos. Cada parágrafo deve conter de 3 a 4 períodos bem articulados por conectivos pontuais.',
        exampleSnippet: 'Parágrafo ideal FGV: Período 1 (Tópico frasal, 2 linhas). Período 2 (Fundamentação teórica, 3 linhas). Período 3 (Desdobramento prático, 2 linhas).',
        keyTakeaway: 'Limite suas frases a no máximo 2 a 3 linhas antes de inserir ponto final.'
      }
    ],
    FCC: [
      {
        id: 'fcc-filosofia-repertorio',
        banca: 'FCC',
        category: 'Repertório Sociológico',
        icon: '🏛️',
        title: 'Repertório Filosófico e Humanista Articulado',
        badge: 'Identidade FCC',
        summary: 'A FCC valoriza conexões orgânicas com pensadores e reflexão ética.',
        explanation: 'Diferente de bancas técnicas puras, a FCC valoriza reflexões éticas e sociológicas (Zygmunt Bauman, Byung-Chul Han, Hannah Arendt, Sérgio Buarque de Holanda). Mas atenção: o autor deve estar articulado ao debate!',
        exampleSnippet: 'Sob a perspectiva de Zygmunt Bauman, a modernidade líquida fragiliza os laços de solidariedade, dinâmica que reverbera diretamente na precarização das relações contemporâneas de trabalho.',
        keyTakeaway: 'Apresente o pensador e explique em seguida a ligação direta com a realidade em debate.'
      },
      {
        id: 'fcc-conclusao-reflexiva',
        banca: 'FCC',
        category: 'Conclusão Síntese',
        icon: '✨',
        title: 'Conclusão Síntese: Fuja de "Proposta de Intervenção"',
        badge: 'Diferencial Competitivo',
        summary: 'A FCC não busca medidas burocráticas ou projetos na conclusão.',
        explanation: 'Candidatos acostumados com o ENEM erram na FCC listando ações governamentais na conclusão. Na FCC, a conclusão ideal é uma síntese reflexiva: reafirma a tese, amarra o valor da dignidade humana e aponta o horizonte civilizatório.',
        exampleSnippet: 'Infere-se, destarte, que o fortalecimento democrático exige transcender o mero cumprimento formal das normas, consolidando a dignidade humana como critério balizador de toda ordem jurídica.',
        keyTakeaway: 'Conclua com síntese reflexiva e valorativa, em vez de passos operacionais.'
      },
      {
        id: 'fcc-tribunais-ponderacao',
        banca: 'FCC',
        category: 'Equilíbrio Analítico',
        icon: '⚖️',
        title: 'Ponderação de Princípios em Concursos de Tribunais',
        badge: 'Maturidade Analítica',
        summary: 'Examinadores da FCC apreciam a ponderação entre garantias concorrentes.',
        explanation: 'Evite maniqueísmos (bem contra o mal). Em redações de tribunais, demonstre capacidade de harmonizar princípios constitucionais em conflito: por exemplo, eficiência e celeridade versus devido processo legal.',
        exampleSnippet: 'O desafio não reside na mitigação de garantias em prol da celeridade, mas na busca de uma harmonização prática entre o tempo razoável do processo e o contraditório substancial.',
        keyTakeaway: 'Demonstre a colisão de princípios e defenda uma harmonização equilibrada.'
      }
    ],
    Vunesp: [
      {
        id: 'vun-pergunta-problema',
        banca: 'Vunesp',
        category: 'Estrutura & Tese',
        icon: '❓',
        title: 'Respondendo à Pergunta-Problema sem Rodeios',
        badge: 'Regra de Ouro VUNESP',
        summary: 'O tema da Vunesp é uma indagação: sua resposta deve ser explícita.',
        explanation: 'A proposta da Vunesp quase sempre formula uma pergunta direta (ex: "X: avanço ou retrocesso?"). Se você não responder de forma clara e contundente logo na introdução, perderá pontos no Critério A (Tema e Tese).',
        exampleSnippet: 'Diante do questionamento proposto, resta indubitável que o uso de câmeras corporais fortalece a segurança pública e resguarda os direitos fundamentais do cidadão e do próprio agente policial.',
        keyTakeaway: 'Responda textualmente à pergunta da proposta logo na tese da introdução.'
      },
      {
        id: 'vun-textos-apoio',
        banca: 'Vunesp',
        category: 'Interpretação Textual',
        icon: '📖',
        title: 'Como Usar os Textos Motivadores sem Sofrer Desconto',
        badge: 'Uso Legítimo',
        summary: 'A cópia de trechos dos textos de apoio acarreta anulação de linhas e penalidade severa.',
        explanation: 'A Vunesp fornece textos motivadores com perspectivas contrastantes. Você deve extrair os dados e parafraseá-los com suas palavras, articulando-os ao seu repertório individual sem copiar frases literais.',
        exampleSnippet: 'Em vez de copiar: "o estudo do instituto apontou queda de 60%...", escreva: "Evidências empíricas recentes confirmam que a supervisão qualificada reduziu em mais de metade os incidentes..."',
        keyTakeaway: 'Nunca copie trechos literais. Parafraseie dados e cite a fonte genérica.'
      },
      {
        id: 'vun-gramatica-rigorosa',
        banca: 'Vunesp',
        category: 'Morfossintaxe',
        icon: '🔍',
        title: 'Atenção Crítica à Gramática VUNESP: Crase e Regência',
        badge: 'Critério C (40%)',
        summary: '40% da nota da Vunesp provém da estrita correção morfossintática.',
        explanation: 'Erros de crase antes de verbos ou palavras masculinas, regência de "visar", "assistir" e "implicar" são rigorosamente fiscalizados na Vunesp. Revise esses três pontos antes de passar a limpo.',
        exampleSnippet: 'Correto: "A política visa a garantir..." (visar com sentido de objetivar rege preposição A). "A omissão implica sanções..." (implicar no sentido de acarretar não admite preposição "em").',
        keyTakeaway: 'Reserve os 10 minutos finais da prova exclusivamente para revisão gramatical e crase.'
      }
    ],
    Cesgranrio: [
      {
        id: 'ces-politicas-publicas',
        banca: 'Cesgranrio',
        category: 'Temas CNU & Gestão',
        icon: '🏛️',
        title: 'Foco no Ciclo de Políticas Públicas e Art. 37 da CF',
        badge: 'Estilo CNU',
        summary: 'A Cesgranrio prioriza temas de governança, inclusão e modernização do Estado.',
        explanation: 'A Cesgranrio (banca do CNU) premia textos que evidenciem o papel do servidor como garantidor de equidade e direitos fundamentais, sempre fundamentados nos princípios do Art. 37 da CF/88.',
        exampleSnippet: 'Em consonância com o princípio da eficiência estatuído no Artigo 37 da Constituição Federal, a modernização dos serviços estatais deve atuar como instrumento de inclusão, e não de segregação.',
        keyTakeaway: 'Fundamente argumentos nos princípios da Administração Pública e na equidade social.'
      },
      {
        id: 'ces-propostas-viaveis',
        banca: 'Cesgranrio',
        category: 'Soluções Operacionais',
        icon: '🛠️',
        title: 'Propostas com Atores Claros e Viabilidade Concreta',
        badge: 'Nota em Propostas',
        summary: 'A banca avalia quem faz, como faz e para quem se destina a ação pública.',
        explanation: 'Ao sugerir soluções no desenvolvimento ou conclusão, aponte os órgãos governamentais competentes (Ministérios, Secretarias) e os meios institucionais cabíveis (capacitação de servidores, interoperabilidade, atendimento assistido).',
        exampleSnippet: 'Incumbe ao Ministério da Gestão, em articulação com os entes subnacionais, estruturar polos de atendimento assistido para garantir o acesso equitativo à cidadania digital.',
        keyTakeaway: 'Especifique o agente público executor e os meios institucionais de realização.'
      },
      {
        id: 'ces-linguagem-clara',
        banca: 'Cesgranrio',
        category: 'Clareza & Comunicação',
        icon: '💡',
        title: 'Linguagem Direta, Inclusiva e Livre de Pedantismo',
        badge: 'Comunicação Pública',
        summary: 'A linguagem deve ser culta, porém cristalina e orientada ao cidadão.',
        explanation: 'Evite construções arcaicas ou rebuscadas em excesso. O serviço público contemporâneo preza pela linguagem simples (plain language). Seja direto, coeso e fundamente cada afirmação.',
        exampleSnippet: 'Empregue períodos diretos em ordem canônica (sujeito + verbo + predicado) para conferir máxima fluidez à leitura do examinador.',
        keyTakeaway: 'Clareza argumentativa supera erudição artificial em bancas de políticas públicas.'
      }
    ],
    'Treino geral': [
      {
        id: 'geral-tempo-75min',
        banca: 'Treino geral',
        category: 'Gestão de Tempo',
        icon: '⏱️',
        title: 'Método dos 75 Minutos para Concursos',
        badge: 'Estratégia de Prova',
        summary: 'Como dividir o tempo de redação sem comprometer a prova objetiva.',
        explanation: 'Divida seu tempo em 4 blocos rigorosos: 1) Leitura e Brainstorming no rascunho (15 min); 2) Redação do rascunho (35 min); 3) Caça a desvios gramaticais (10 min); 4) Transcrição definitiva na folha oficial (15 min).',
        exampleSnippet: 'Nunca passe a limpo enquanto cria o texto: separe a fase criativa da fase de caligrafia e transcrição.',
        keyTakeaway: 'Cronometre 75 minutos totais para redação em todos os simulados semanais.'
      },
      {
        id: 'geral-conectivos-coringa',
        banca: 'Treino geral',
        category: 'Coesão Coringa',
        icon: '🧰',
        title: 'Arsenal de Conectivos de Alta Pontuação',
        badge: 'Vocabulário Estratégico',
        summary: 'Conectivos elegantes que enriquecem qualquer texto dissertativo.',
        explanation: 'Diversifique seus conectores lógicos para demonstrar domínio da língua padrão culta: Causa ("haja vista que", "porquanto"), Concessão ("conquanto", "não obstante"), Conclusão ("destarte", "por conseguinte", "em suma").',
        exampleSnippet: '"Conquanto haja avanços legislativos, persistem desafios operacionais..."\n"Destarte, impõe-se a atuação diligente dos órgãos fiscalizadores."',
        keyTakeaway: 'Evite repetir "portanto", "mas" e "porque". Alterne com conectivos formais.'
      },
      {
        id: 'geral-margens-estetica',
        banca: 'Treino geral',
        category: 'Apresentação Visual',
        icon: '📐',
        title: 'Alinhamento Justificado e Translineação Perfeita',
        badge: 'Estética da Folha',
        summary: 'Uma folha limpa e bem diagramada predispõe o corretor a dar nota mais alta.',
        explanation: 'Mantenha recuo de parágrafo constante (1,5 a 2 cm). Escreva até o limite da margem direita sem invadi-la. Ao separar sílabas no final da linha (translineação), use hífen ao lado da letra ou embaixo, nunca em cima.',
        exampleSnippet: 'Deixe a folha visualmente harmônica: 4 blocos visíveis e linhas preenchidas de ponta a ponta.',
        keyTakeaway: 'Estética impecável evita desconto em legibilidade e apresentação.'
      }
    ]
  };

  // TIPS PERSISTENCE STATE & CACHE
  let currentTipIndex = 0;
  let viewedTipsCache = {};
  let activeHistoryFilter = 'all';

  function loadViewedTipsFromStorage() {
    try {
      const stored = localStorage.getItem('missao_viewed_tips');
      if (stored) {
        viewedTipsCache = JSON.parse(stored) || {};
      }
    } catch (e) {
      viewedTipsCache = {};
    }
  }

  function saveViewedTipsToStorage() {
    try {
      localStorage.setItem('missao_viewed_tips', JSON.stringify(viewedTipsCache));
    } catch (e) {
      console.warn('[Storage] Erro ao salvar dicas localmente:', e);
    }
  }

  loadViewedTipsFromStorage();

  async function loadViewedTipsFromFirestore() {
    try {
      const user = window.FirebaseApplet?.auth?.currentUser;
      if (!user || !window.FirebaseApplet?.getUserViewedTips) return;

      const firestoreTips = await window.FirebaseApplet.getUserViewedTips(user.uid);
      if (Array.isArray(firestoreTips) && firestoreTips.length > 0) {
        firestoreTips.forEach(item => {
          if (item && item.tipId) {
            viewedTipsCache[item.tipId] = {
              ...(viewedTipsCache[item.tipId] || {}),
              ...item
            };
          }
        });
        saveViewedTipsToStorage();
        renderDailyTipUI();
      }
    } catch (err) {
      console.warn('[Firebase] Não foi possível carregar histórico de dicas:', err);
    }
  }

  async function recordTipView(tip) {
    if (!tip || !tip.id) return;
    const now = new Date().toISOString();
    const existing = viewedTipsCache[tip.id] || {};
    const count = (existing.viewCount || 0) + 1;

    viewedTipsCache[tip.id] = {
      ...existing,
      tipId: tip.id,
      banca: tip.banca || currentSelectedBanca,
      title: tip.title,
      category: tip.category,
      viewedAt: now,
      viewCount: count,
      mastered: !!existing.mastered,
      favorited: !!existing.favorited
    };
    saveViewedTipsToStorage();

    try {
      const user = window.FirebaseApplet?.auth?.currentUser;
      if (user && window.FirebaseApplet?.recordViewedTip) {
        await window.FirebaseApplet.recordViewedTip(user.uid, tip);
      }
    } catch (err) {
      console.warn('[Firebase] Não foi possível registrar visualização no Firestore:', err);
    }
  }

  async function toggleMasteredTip(tipId) {
    const existing = viewedTipsCache[tipId] || {};
    const newState = !existing.mastered;
    viewedTipsCache[tipId] = {
      ...existing,
      tipId,
      banca: existing.banca || currentSelectedBanca,
      mastered: newState,
      masteredAt: newState ? new Date().toISOString() : null
    };
    saveViewedTipsToStorage();
    renderDailyTipUI();

    if (newState && window.TicoMascot && window.TicoMascot.say) {
      window.TicoMascot.say(`Sensacional! Você dominou a estratégia "${existing.title || 'da banca'}". Menos chances de perder pontos! ⭐`);
    }

    try {
      const user = window.FirebaseApplet?.auth?.currentUser;
      if (user && window.FirebaseApplet?.toggleMasteredTip) {
        await window.FirebaseApplet.toggleMasteredTip(user.uid, tipId, newState);
      }
    } catch (err) {
      console.warn('[Firebase] Erro ao sincronizar status de domínio no Firestore:', err);
    }
  }

  async function toggleFavoriteTip(tipId) {
    const existing = viewedTipsCache[tipId] || {};
    const newState = !existing.favorited;
    viewedTipsCache[tipId] = {
      ...existing,
      tipId,
      banca: existing.banca || currentSelectedBanca,
      favorited: newState
    };
    saveViewedTipsToStorage();
    renderDailyTipUI();

    try {
      const user = window.FirebaseApplet?.auth?.currentUser;
      if (user && window.FirebaseApplet?.toggleFavoriteTip) {
        await window.FirebaseApplet.toggleFavoriteTip(user.uid, tipId, newState);
      }
    } catch (err) {
      console.warn('[Firebase] Erro ao sincronizar favorito no Firestore:', err);
    }
  }

  function insertTipSnippetToEssay(snippet) {
    if (!snippet) return;
    const textarea = document.querySelector('textarea#essay-text');
    if (!textarea) return;

    const start = textarea.selectionStart || textarea.value.length;
    const end = textarea.selectionEnd || textarea.value.length;
    const textBefore = textarea.value.substring(0, start);
    const textAfter = textarea.value.substring(end);

    const prefix = (textBefore.length > 0 && !textBefore.endsWith('\n\n')) ? (textBefore.endsWith('\n') ? '\n' : '\n\n') : '';
    textarea.value = textBefore + prefix + snippet + textAfter;
    textarea.focus();

    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    if (window.TicoMascot && window.TicoMascot.say) {
      window.TicoMascot.say('Trecho prático inserido na sua folha de redação! Adapte com os dados do seu tema.');
    }
  }

  function renderDailyTipUI() {
    const container = document.getElementById('tico-daily-tips-container');
    if (!container) return;

    const tips = BANCA_TIPS[currentSelectedBanca] || BANCA_TIPS['Cebraspe'];
    if (!tips || tips.length === 0) {
      container.innerHTML = '';
      return;
    }

    if (currentTipIndex >= tips.length) currentTipIndex = 0;
    if (currentTipIndex < 0) currentTipIndex = tips.length - 1;

    const tip = tips[currentTipIndex];
    const bancaInfo = BANCA_DATA[currentSelectedBanca] || BANCA_DATA['Cebraspe'];

    // Auto-record tip view
    recordTipView(tip);

    const tipState = viewedTipsCache[tip.id] || {};
    const isMastered = !!tipState.mastered;
    const isFavorited = !!tipState.favorited;
    const viewCount = tipState.viewCount || 1;

    const bancaViewedTips = Object.values(viewedTipsCache).filter(t => t.banca === currentSelectedBanca);
    const masteredCount = bancaViewedTips.filter(t => t.mastered).length;
    const isUserAuth = !!window.FirebaseApplet?.auth?.currentUser;

    container.style.setProperty('--banca-accent', bancaInfo.color || '#1e5a80');

    container.innerHTML = `
      <div class="tico-daily-tip-card" id="card-daily-tip-${tip.id}">
        <div class="tico-tip-topbar">
          <div class="tico-tip-badge-group">
            <span class="tico-tip-main-badge" style="color: ${bancaInfo.color}; border-color: ${bancaInfo.borderLight}; background: ${bancaInfo.bgLight};">
              💡 Dica Estratégica do Dia · ${bancaInfo.name}
            </span>
            <span class="tico-tip-category-badge">
              ${tip.icon || '📌'} ${tip.category}
            </span>
            <span class="tico-tip-category-badge" style="background: #fff8e6; color: #a16207; border: 1px solid #fde68a; font-weight: 800;">
              ${tip.badge}
            </span>
          </div>
          <button type="button" class="tico-tip-history-btn" id="btn-open-tips-history">
            <span>📜 Histórico no Firestore</span>
            <strong style="background: #74c939; color: #fff; padding: 2px 8px; border-radius: 20px; font-size: 11px; box-shadow: 0 1px #58a722;">
              ${bancaViewedTips.length}
            </strong>
          </button>
        </div>

        <div class="tico-tip-title-row">
          <h3 class="tico-tip-title">
            <span>${tip.icon}</span>
            <span>${tip.title}</span>
          </h3>
          <div class="tico-tip-actions">
            <button type="button" 
              class="tico-tip-action-btn ${isMastered ? 'mastered' : ''}" 
              id="btn-toggle-mastered-tip" 
              title="${isMastered ? 'Estratégia Dominada!' : 'Marcar como dominada'}">
              <span>${isMastered ? '⭐ Dominada' : '☆ Dominar'}</span>
            </button>
            <button type="button" 
              class="tico-tip-action-btn ${isFavorited ? 'favorited' : ''}" 
              id="btn-toggle-favorited-tip" 
              title="${isFavorited ? 'Remover dos favoritos' : 'Favoritar dica'}">
              <span>${isFavorited ? '❤️ Favorita' : '🤍 Favoritar'}</span>
            </button>
          </div>
        </div>

        <p class="tico-tip-explanation">${tip.explanation}</p>

        <div class="tico-tip-example-box">
          <div class="tico-tip-example-header">
            <span class="tico-tip-example-label">📌 Aplicação Prática / Modelo Recomendado</span>
            <button type="button" class="tico-tip-insert-btn" id="btn-insert-tip-example">
              📋 Inserir na Redação
            </button>
          </div>
          <div class="tico-tip-example-text">${tip.exampleSnippet}</div>
        </div>

        <div class="tico-tip-footer">
          <div class="tico-tip-stats-cloud">
            <span>${isUserAuth ? '☁️ Sincronizado no Firestore' : '💾 Salvo localmente'}</span>
            <span>·</span>
            <span>👁️ Visualizada ${viewCount}x</span>
            ${masteredCount > 0 ? `<span>·</span> <span style="color: #ca8a04; font-weight: 700;">⭐ ${masteredCount} de ${tips.length} dominadas nesta banca</span>` : ''}
          </div>

          <div class="tico-tip-pagination">
            <button type="button" class="tico-tip-nav-btn" id="btn-prev-tip" ${currentTipIndex === 0 ? 'disabled' : ''} title="Dica anterior">
              ◀
            </button>
            <span class="tico-tip-page-indicator">Dica ${currentTipIndex + 1} de ${tips.length}</span>
            <button type="button" class="tico-tip-nav-btn" id="btn-next-tip" ${currentTipIndex === tips.length - 1 ? 'disabled' : ''} title="Próxima dica">
              ▶
            </button>
          </div>
        </div>
      </div>
    `;

    // Attach event listeners
    const prevBtn = container.querySelector('#btn-prev-tip');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentTipIndex > 0) {
          currentTipIndex--;
          renderDailyTipUI();
        }
      });
    }

    const nextBtn = container.querySelector('#btn-next-tip');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (currentTipIndex < tips.length - 1) {
          currentTipIndex++;
          renderDailyTipUI();
        }
      });
    }

    const masterBtn = container.querySelector('#btn-toggle-mastered-tip');
    if (masterBtn) {
      masterBtn.addEventListener('click', () => {
        toggleMasteredTip(tip.id);
      });
    }

    const favBtn = container.querySelector('#btn-toggle-favorited-tip');
    if (favBtn) {
      favBtn.addEventListener('click', () => {
        toggleFavoriteTip(tip.id);
      });
    }

    const insertBtn = container.querySelector('#btn-insert-tip-example');
    if (insertBtn) {
      insertBtn.addEventListener('click', () => {
        insertTipSnippetToEssay(tip.exampleSnippet);
      });
    }

    const historyBtn = container.querySelector('#btn-open-tips-history');
    if (historyBtn) {
      historyBtn.addEventListener('click', () => {
        openTipsHistoryModal();
      });
    }
  }

  function openTipsHistoryModal() {
    const existingModal = document.getElementById('tico-tips-history-modal');
    if (existingModal) existingModal.remove();

    const tips = BANCA_TIPS[currentSelectedBanca] || BANCA_TIPS['Cebraspe'];
    const bancaInfo = BANCA_DATA[currentSelectedBanca] || BANCA_DATA['Cebraspe'];
    const allHistory = Object.values(viewedTipsCache).filter(t => t.banca === currentSelectedBanca);

    const modalBackdrop = document.createElement('div');
    modalBackdrop.id = 'tico-tips-history-modal';
    modalBackdrop.className = 'tico-history-modal-backdrop';

    function renderModalContent() {
      const totalCount = allHistory.length;
      const masteredCount = allHistory.filter(t => t.mastered).length;
      const favoritedCount = allHistory.filter(t => t.favorited).length;

      let filteredItems = allHistory;
      if (activeHistoryFilter === 'mastered') {
        filteredItems = allHistory.filter(t => t.mastered);
      } else if (activeHistoryFilter === 'favorited') {
        filteredItems = allHistory.filter(t => t.favorited);
      }

      modalBackdrop.innerHTML = `
        <div class="tico-history-modal-content">
          <div class="tico-history-modal-header">
            <h3 class="tico-history-modal-title">
              <span>📜</span>
              <span>Histórico de Dicas no Firestore · ${bancaInfo.name}</span>
            </h3>
            <button type="button" class="tico-history-modal-close" id="btn-close-tips-history" title="Fechar">&times;</button>
          </div>

          <div class="tico-history-modal-body">
            <div class="tico-history-stats-banner">
              <div class="tico-history-stat-box">
                <span class="tico-history-stat-num">${totalCount}</span>
                <span class="tico-history-stat-lbl">Visualizadas no Firestore</span>
              </div>
              <div class="tico-history-stat-box" style="border-color: #fde047; background: #fefce8;">
                <span class="tico-history-stat-num" style="color: #a16207;">${masteredCount}</span>
                <span class="tico-history-stat-lbl" style="color: #854d0e;">Dominadas ⭐</span>
              </div>
              <div class="tico-history-stat-box" style="border-color: #fbcfe8; background: #fdf2f8;">
                <span class="tico-history-stat-num" style="color: #db2777;">${favoritedCount}</span>
                <span class="tico-history-stat-lbl" style="color: #9d174d;">Favoritas ❤️</span>
              </div>
            </div>

            <div class="tico-history-filter-pills">
              <button type="button" class="tico-history-filter-pill ${activeHistoryFilter === 'all' ? 'active' : ''}" data-filter="all">
                Todas (${totalCount})
              </button>
              <button type="button" class="tico-history-filter-pill ${activeHistoryFilter === 'mastered' ? 'active' : ''}" data-filter="mastered">
                ⭐ Dominadas (${masteredCount})
              </button>
              <button type="button" class="tico-history-filter-pill ${activeHistoryFilter === 'favorited' ? 'active' : ''}" data-filter="favorited">
                ❤️ Favoritas (${favoritedCount})
              </button>
            </div>

            <div class="tico-history-list">
              ${filteredItems.length === 0 ? `
                <div class="tico-history-empty">
                  <p>Nenhuma dica encontrada nesta categoria.</p>
                  <p style="font-size: 12px; color: #94a3b8;">Explore as dicas diárias da banca e marque como dominada para acompanhar seu avanço!</p>
                </div>
              ` : filteredItems.map(item => {
                const dateStr = item.viewedAt ? new Date(item.viewedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Recentemente';
                return `
                  <div class="tico-history-item ${item.mastered ? 'mastered' : ''}" data-tip-id="${item.tipId}">
                    <div class="tico-history-item-left">
                      <div class="tico-history-item-title">${item.title}</div>
                      <div class="tico-history-item-meta">
                        <span>🏷️ ${item.category || 'Estratégia'}</span>
                        <span>👁️ Vista ${item.viewCount || 1}x</span>
                        <span>🕒 ${dateStr}</span>
                        ${item.mastered ? '<span style="color: #ca8a04; font-weight: 700;">⭐ Dominada</span>' : ''}
                        ${item.favorited ? '<span style="color: #db2777; font-weight: 700;">❤️ Favorita</span>' : ''}
                      </div>
                    </div>
                    <button type="button" class="tico-tip-nav-btn" style="width: 28px; height: 28px; font-size: 11px;" title="Ver esta dica">
                      ➜
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;

      modalBackdrop.querySelector('#btn-close-tips-history').addEventListener('click', () => {
        modalBackdrop.remove();
      });

      modalBackdrop.querySelectorAll('.tico-history-filter-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          activeHistoryFilter = btn.getAttribute('data-filter');
          renderModalContent();
        });
      });

      modalBackdrop.querySelectorAll('.tico-history-item').forEach(itemEl => {
        itemEl.addEventListener('click', () => {
          const tId = itemEl.getAttribute('data-tip-id');
          const idx = tips.findIndex(t => t.id === tId);
          if (idx !== -1) {
            currentTipIndex = idx;
            renderDailyTipUI();
          }
          modalBackdrop.remove();
        });
      });
    }

    renderModalContent();

    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) {
        modalBackdrop.remove();
      }
    });

    document.body.appendChild(modalBackdrop);
  }

  let currentSelectedBanca = localStorage.getItem('missao_banca_preferida') || 'Cebraspe';
  let activeTabGuide = 'estrategia'; // 'estrategia' | 'estrutura' | 'esqueleto'

  function initBancaRedacao() {
    try {
      const essayPage = document.querySelector('.essay-page');
      if (!essayPage) return;

      const topicSelect = essayPage.querySelector('#essay-topic');
      const textarea = essayPage.querySelector('textarea#essay-text');
      // Ensure key elements are mounted before enhancing
      if (!topicSelect || !textarea) return;

      if (essayPage.dataset.bancaEnhanced === 'true') {
        updateLineCountersOnly();
        return;
      }
      essayPage.dataset.bancaEnhanced = 'true';

      // 1. Locate Native Select for Bank
      const bankSelect = essayPage.querySelector('.essay-setup select');
      if (bankSelect) {
        // Ensure Cesgranrio option is present in select if not there
        const hasCesgranrio = Array.from(bankSelect.options).some(o => o.value === 'Cesgranrio');
        if (!hasCesgranrio) {
          const opt = document.createElement('option');
          opt.value = 'Cesgranrio';
          opt.textContent = 'Cesgranrio';
          bankSelect.appendChild(opt);
        }

        if (bankSelect.value && BANCA_DATA[bankSelect.value]) {
          currentSelectedBanca = bankSelect.value;
        } else {
          bankSelect.value = currentSelectedBanca;
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
          if (nativeSetter) {
            nativeSetter.call(bankSelect, currentSelectedBanca);
          }
          bankSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      // 2. Inject Banca Selector UI & Guide
      injectBancaSelectorUI(essayPage);

      // 3. Enhance Textarea with Ruled Sheet & Action Bar
      enhanceEssayWorkspace(essayPage);

      // 4. Listen to native select changes if user changes via native select
      if (bankSelect && !bankSelect.dataset.bancaSyncBound) {
        bankSelect.dataset.bancaSyncBound = 'true';
        bankSelect.addEventListener('change', () => {
          if (bankSelect.value && BANCA_DATA[bankSelect.value] && bankSelect.value !== currentSelectedBanca) {
            selectBanca(bankSelect.value, true);
          }
        });
      }

      // 5. Initial sync of topics and guide
      renderBancaGuideUI();
      renderDailyTipUI();
      syncBancaTopics();
      updateLineCountersOnly();

      // 6. Connect with Firestore to load/sync user preference and tips
      loadBancaPreferenceFromFirestore();
      loadViewedTipsFromFirestore();

      // Listen to Firebase Auth state if available
      if (!essayPage.dataset.authSubscribed && window.FirebaseApplet && window.FirebaseApplet.subscribeAuth) {
        essayPage.dataset.authSubscribed = 'true';
        window.FirebaseApplet.subscribeAuth((user) => {
          if (user) {
            loadBancaPreferenceFromFirestore();
            loadViewedTipsFromFirestore();
          }
        });
      }
    } catch (err) {
      console.warn('[Banca Redação] Erro não-bloqueante na inicialização:', err);
    }
  }

  function injectBancaSelectorUI(essayPage) {
    const slot = essayPage.querySelector('#tico-banca-slot');
    const existingContainer = essayPage.querySelector('#tico-banca-container');
    if (existingContainer) existingContainer.remove();

    const container = document.createElement('div');
    container.id = 'tico-banca-container';
    container.className = 'tico-banca-experience';

    // Build Banca Cards HTML
    const bancas = Object.keys(BANCA_DATA);
    let cardsHtml = '';
    bancas.forEach(bId => {
      const b = BANCA_DATA[bId];
      const isSelected = bId === currentSelectedBanca;
      cardsHtml += `
        <button type="button" 
          class="tico-banca-card ${isSelected ? 'active' : ''}" 
          data-banca="${b.id}"
          id="btn-banca-${b.id.toLowerCase().replace(/[^a-z0-9]/g, '')}">
          <span class="tico-banca-icon">${b.icon}</span>
          <div class="tico-banca-info">
            <strong class="tico-banca-title">${b.name}</strong>
            <span class="tico-banca-tag">${b.tag}</span>
          </div>
          ${isSelected ? '<span class="tico-banca-active-badge">✓ Ativa</span>' : ''}
        </button>
      `;
    });

    container.innerHTML = `
      <div class="tico-banca-header">
        <div class="tico-banca-header-text">
          <span class="tico-banca-eyebrow">🎯 OFICINA DE REDAÇÃO · PERSONALIZAÇÃO POR BANCA</span>
          <h2 class="tico-banca-main-title">Qual é o seu objetivo de aprovação?</h2>
          <p class="tico-banca-subtitle">Ajuste o método, critérios e folha de redação para a banca do seu concurso dos sonhos.</p>
        </div>
        <div class="tico-banca-header-right">
          <span id="tico-banca-sync-badge" class="tico-banca-sync-badge">
            <span class="sync-icon">☁️</span> <span class="sync-text">Preferência salva na nuvem</span>
          </span>
        </div>
      </div>

      <div class="tico-banca-carousel" id="tico-banca-carousel">
        ${cardsHtml}
      </div>

      <div class="tico-daily-tips-wrapper" id="tico-daily-tips-container">
        <!-- Rendered dynamically -->
      </div>

      <div class="tico-banca-guide-panel" id="tico-banca-guide-panel">
        <!-- Rendered dynamically -->
      </div>
    `;

    // Mount inside slot if available, otherwise insert before setup
    if (slot) {
      slot.innerHTML = '';
      slot.appendChild(container);
    } else {
      const hero = essayPage.querySelector('.essay-hero');
      if (hero && hero.nextSibling) {
        essayPage.insertBefore(container, hero.nextSibling);
      } else {
        essayPage.prepend(container);
      }
    }

    // Attach click events on banca cards
    const cards = container.querySelectorAll('.tico-banca-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const bId = card.getAttribute('data-banca');
        selectBanca(bId, true);
      });
    });
  }

  async function selectBanca(bId, shouldPersist = true) {
    if (!BANCA_DATA[bId]) return;
    currentSelectedBanca = bId;
    currentTipIndex = 0;
    localStorage.setItem('missao_banca_preferida', bId);

    // Update active class on cards
    const cards = document.querySelectorAll('.tico-banca-card');
    cards.forEach(c => {
      const active = c.getAttribute('data-banca') === bId;
      c.classList.toggle('active', active);
      const existingBadge = c.querySelector('.tico-banca-active-badge');
      if (active) {
        if (!existingBadge) {
          const badge = document.createElement('span');
          badge.className = 'tico-banca-active-badge';
          badge.textContent = '✓ Ativa';
          c.appendChild(badge);
        }
      } else if (existingBadge) {
        existingBadge.remove();
      }
    });

    // Update native select
    const essayPage = document.querySelector('.essay-page');
    if (essayPage) {
      const bankSelect = essayPage.querySelector('.essay-setup select');
      if (bankSelect && bankSelect.value !== bId) {
        // Ensure option exists
        if (!Array.from(bankSelect.options).some(o => o.value === bId)) {
          const opt = document.createElement('option');
          opt.value = bId;
          opt.textContent = bId;
          bankSelect.appendChild(opt);
        }
        bankSelect.value = bId;
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(bankSelect, bId);
        }
        bankSelect.dispatchEvent(new Event('change', { bubbles: true }));
        bankSelect.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    renderBancaGuideUI();
    renderDailyTipUI();
    syncBancaTopics();

    // Persist to Firestore user document
    if (shouldPersist) {
      await persistBancaPreferenceToFirestore(bId);
    }

    // Notify user via friendly banner or Tico animation
    if (window.TicoMascot && window.TicoMascot.say) {
      window.TicoMascot.say(`Modo ${bId} ativado! Dicas, critérios e folha ajustados para esta banca.`);
    }
  }

  async function persistBancaPreferenceToFirestore(bId) {
    const statusBadge = document.getElementById('tico-banca-sync-badge');
    if (statusBadge) {
      statusBadge.className = 'tico-banca-sync-badge saving';
      statusBadge.innerHTML = `<span class="sync-icon">🔄</span> <span class="sync-text">Salvando no Firestore...</span>`;
    }

    try {
      const user = window.FirebaseApplet?.auth?.currentUser;
      if (user && window.FirebaseApplet?.saveUserPreferredBanca) {
        const ok = await window.FirebaseApplet.saveUserPreferredBanca(user.uid, bId);
        if (ok && statusBadge) {
          statusBadge.className = 'tico-banca-sync-badge';
          statusBadge.innerHTML = `<span class="sync-icon">☁️</span> <span class="sync-text">Banca salva no perfil (${bId})</span>`;
          return;
        }
      }

      // If user is not yet logged in or offline:
      if (statusBadge) {
        statusBadge.className = 'tico-banca-sync-badge local';
        statusBadge.innerHTML = `<span class="sync-icon">💾</span> <span class="sync-text">Salvo localmente (${bId})</span>`;
      }
    } catch (err) {
      console.warn('[Firebase] Erro ao persistir banca no Firestore:', err);
      if (statusBadge) {
        statusBadge.className = 'tico-banca-sync-badge local';
        statusBadge.innerHTML = `<span class="sync-icon">💾</span> <span class="sync-text">Salvo localmente</span>`;
      }
    }
  }

  async function loadBancaPreferenceFromFirestore() {
    const statusBadge = document.getElementById('tico-banca-sync-badge');
    try {
      const user = window.FirebaseApplet?.auth?.currentUser;
      if (!user || !window.FirebaseApplet?.getUserPreferredBanca) {
        if (statusBadge) {
          statusBadge.className = 'tico-banca-sync-badge local';
          statusBadge.innerHTML = `<span class="sync-icon">💾</span> <span class="sync-text">Salvo localmente (${currentSelectedBanca})</span>`;
        }
        return;
      }

      const savedBanca = await window.FirebaseApplet.getUserPreferredBanca(user.uid);
      if (savedBanca && BANCA_DATA[savedBanca]) {
        if (savedBanca !== currentSelectedBanca) {
          selectBanca(savedBanca, false);
        }
        if (statusBadge) {
          statusBadge.className = 'tico-banca-sync-badge';
          statusBadge.innerHTML = `<span class="sync-icon">☁️</span> <span class="sync-text">Banca do perfil: ${savedBanca}</span>`;
        }
      } else if (currentSelectedBanca) {
        // First time in Firestore -> save user's initial selection
        persistBancaPreferenceToFirestore(currentSelectedBanca);
      }
    } catch (err) {
      console.warn('[Firebase] Não foi possível carregar banca do Firestore:', err);
    }
  }

  function renderBancaGuideUI() {
    const panel = document.getElementById('tico-banca-guide-panel');
    if (!panel) return;

    const b = BANCA_DATA[currentSelectedBanca] || BANCA_DATA['Cebraspe'];

    panel.innerHTML = `
      <div class="tico-guide-card" >
        <div class="tico-guide-header">
          <div class="tico-guide-badge-row">
            <span class="tico-guide-pill" style="background: ${b.bgLight}; color: ${b.color}; border: 1px solid ${b.borderLight};">
              ${b.icon} ${b.badge}
            </span>
            <span class="tico-guide-lines-pill">📏 Extensão: <strong>${b.idealLines}</strong></span>
            <span class="tico-guide-title-pill">🏷️ ${b.titleRule}</span>
          </div>

          <div class="tico-guide-tabs">
            <button type="button" class="tico-guide-tab ${activeTabGuide === 'estrategia' ? 'active' : ''}" data-tab="estrategia">
              🎯 O que mais pontua
            </button>
            <button type="button" class="tico-guide-tab ${activeTabGuide === 'estrutura' ? 'active' : ''}" data-tab="estrutura">
              📐 Estrutura em 4 Parágrafos
            </button>
            <button type="button" class="tico-guide-tab ${activeTabGuide === 'esqueleto' ? 'active' : ''}" data-tab="esqueleto">
              💡 Esqueleto Modelo
            </button>
            <button type="button" class="tico-guide-tab ${activeTabGuide === 'pontuacao' ? 'active' : ''}" data-tab="pontuacao">
              🧮 Cálculo da Nota
            </button>
          </div>
        </div>

        <div class="tico-guide-body">
          ${renderTabContent(b)}
        </div>
      </div>
    `;

    // Tab buttons
    panel.querySelectorAll('.tico-guide-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        activeTabGuide = tabBtn.getAttribute('data-tab');
        renderBancaGuideUI();
      });
    });

    // Skeleton insert button inside guide tab
    const insBtn = panel.querySelector('#btn-insert-skeleton-guide');
    if (insBtn) {
      insBtn.addEventListener('click', () => {
        insertSkeletonIntoEditor(b.skeleton);
      });
    }
  }

  function renderTabContent(b) {
    if (activeTabGuide === 'estrategia') {
      return `
        <div class="tico-tab-pane">
          <div class="tico-dos-donts-grid">
            <div class="tico-do-box">
              <h4 class="tico-do-title">✅ O que o ${b.name} mais valoriza:</h4>
              <ul class="tico-list-checks">
                ${b.loves.map(item => `<li><span class="check-icon">✓</span> <span>${item}</span></li>`).join('')}
              </ul>
            </div>
            <div class="tico-dont-box">
              <h4 class="tico-dont-title">❌ O que essa banca penaliza com rigor:</h4>
              <ul class="tico-list-warns">
                ${b.avoids.map(item => `<li><span class="warn-icon">⚠️</span> <span>${item}</span></li>`).join('')}
              </ul>
            </div>
          </div>
        </div>
      `;
    }

    if (activeTabGuide === 'estrutura') {
      return `
        <div class="tico-tab-pane">
          <h4 class="tico-pane-heading">Estrutura recomendada de parágrafos para ${b.name}:</h4>
          <div class="tico-paragraph-steps">
            ${b.structure.map((s, idx) => `
              <div class="tico-step-card">
                <div class="tico-step-number">${idx + 1}</div>
                <div class="tico-step-content">
                  <strong>${s.label}</strong>
                  <p>${s.desc}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (activeTabGuide === 'esqueleto') {
      return `
        <div class="tico-tab-pane">
          <div class="tico-skeleton-box">
            <div class="tico-skeleton-header">
              <h4>Esqueleto Estrutural Pronto (${b.name})</h4>
              <button type="button" id="btn-insert-skeleton-guide" class="tico-btn-insert-skeleton">
                ✍️ Copiar para minha folha de redação
              </button>
            </div>
            <pre class="tico-skeleton-pre">${b.skeleton}</pre>
            <p class="tico-skeleton-tip">💡 Dica: Substitua os termos entre colchetes <code>[...]</code> pelos argumentos e dispositivos legais da sua proposta.</p>
          </div>
        </div>
      `;
    }

    if (activeTabGuide === 'pontuacao') {
      return `
        <div class="tico-tab-pane">
          <div class="tico-formula-card">
            <h4>Fórmula Oficial e Critérios de Correção</h4>
            <div class="tico-formula-display">${b.formula}</div>
            <p class="tico-formula-desc">
              Ao enviar sua redação para correção nesta plataforma, a Inteligência Artificial orientadora emula os pesos específicos e exigências formais de <strong>${b.name}</strong>, detalhando os descontos gramaticais e a aderência aos tópicos de conteúdo.
            </p>
          </div>
        </div>
      `;
    }

    return '';
  }

  function syncBancaTopics() {
    const topicSelect = document.getElementById('essay-topic');
    if (!topicSelect) return;

    // Filter topics for the current banca first, then generic ones
    const relevantTopics = BANCA_TOPICS.filter(t => t.bank === currentSelectedBanca || t.bank === 'Treino geral');
    const bancaSpecific = relevantTopics.filter(t => t.bank === currentSelectedBanca);

    // If options are missing in select, populate them
    if (topicSelect.options.length === 0) {
      let html = '';
      if (bancaSpecific.length > 0) {
        html += `<optgroup label="⭐ Temas Específicos para ${currentSelectedBanca}">`;
        bancaSpecific.forEach(t => {
          html += `<option value="${t.id}">${t.title}</option>`;
        });
        html += `</optgroup>`;
      }
      html += `<optgroup label="💡 Temas Gerais de Concursos">`;
      relevantTopics.filter(t => t.bank === 'Treino geral').forEach(t => {
        html += `<option value="${t.id}">${t.title}</option>`;
      });
      html += `</optgroup>`;
      topicSelect.innerHTML = html;
    }

    // Check if current value already belongs to current banca
    const currentVal = topicSelect.value;
    const currentTopicObj = BANCA_TOPICS.find(t => t.id === currentVal);
    const matchesCurrentBanca = currentTopicObj && (currentTopicObj.bank === currentSelectedBanca);

    if (!matchesCurrentBanca && bancaSpecific.length > 0) {
      const targetVal = bancaSpecific[0].id;
      if (topicSelect.value !== targetVal) {
        topicSelect.value = targetVal;
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(topicSelect, targetVal);
        }
        topicSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    updateProposalDisplay(topicSelect.value);
  }

  function updateProposalDisplay(topicId) {
    const t = BANCA_TOPICS.find(x => x.id === topicId) || BANCA_TOPICS[0];
    if (!t) return;

    const proposalAside = document.querySelector('.essay-proposal');
    if (!proposalAside) return;

    const bannerSlot = proposalAside.querySelector('#tico-proposal-banner-slot');
    let banner = proposalAside.querySelector('.tico-banca-topic-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'tico-banca-topic-banner';
      if (bannerSlot) {
        bannerSlot.appendChild(banner);
      } else {
        proposalAside.prepend(banner);
      }
    }

    banner.innerHTML = `
      <div class="tico-topic-badge">${t.badge || currentSelectedBanca}</div>
      <div class="tico-topic-meta-tip">
        <span>Banca: <strong>${t.bank}</strong></span>
        <span>•</span>
        <span>Folha: <strong>30 Linhas</strong></span>
      </div>
    `;
  }

  function enhanceEssayWorkspace(essayPage) {
    const workspace = essayPage.querySelector('.essay-workspace');
    if (!workspace) return;

    const textarea = essayPage.querySelector('textarea#essay-text');
    if (!textarea) return;

    const editorContainer = textarea.closest('.essay-writing') || textarea.closest('.essay-editor') || textarea.parentElement;

    // Line counter & actions bar
    const barSlot = essayPage.querySelector('#tico-editor-bar-slot');
    let bar = essayPage.querySelector('.tico-editor-action-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'tico-editor-action-bar';
      bar.innerHTML = `
        <div class="tico-line-status" id="tico-line-status">
          <span class="tico-line-meter" id="tico-line-meter">0 / 30 linhas</span>
          <span class="tico-status-tag" id="tico-status-tag">Em branco</span>
        </div>
        <div class="tico-editor-btns">
          <button type="button" class="tico-btn-tool" id="btn-quick-skeleton" title="Inserir esqueleto da banca selecionada">
            💡 Esqueleto ${currentSelectedBanca}
          </button>
          <button type="button" class="tico-btn-tool" id="btn-clear-essay" title="Limpar folha">
            🗑️ Limpar
          </button>
        </div>
      `;
      if (barSlot) {
        barSlot.innerHTML = '';
        barSlot.appendChild(bar);
      } else {
        const targetWrapper = essayPage.querySelector('.tico-ruled-sheet-wrapper') || textarea;
        targetWrapper.parentNode.insertBefore(bar, targetWrapper);
      }

      // Quick skeleton click
      bar.querySelector('#btn-quick-skeleton')?.addEventListener('click', () => {
        const b = BANCA_DATA[currentSelectedBanca] || BANCA_DATA['Cebraspe'];
        insertSkeletonIntoEditor(b.skeleton);
      });

      // Clear click
      bar.querySelector('#btn-clear-essay')?.addEventListener('click', () => {
        if (confirm('Deseja limpar o texto da folha de redação?')) {
          textarea.value = '';
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
          updateLineCountersOnly();
        }
      });
    }

    // Check if line ruler already exists (either rendered by React or wrapper)
    const existingWrapper = editorContainer.querySelector('.tico-ruled-sheet-wrapper');
    if (!existingWrapper) {
      const wrapper = document.createElement('div');
      wrapper.className = 'tico-ruled-sheet-wrapper';

      const lineRuler = document.createElement('div');
      lineRuler.className = 'tico-line-ruler';
      lineRuler.id = 'tico-line-ruler';
      
      let rulerHtml = '';
      for (let i = 1; i <= 30; i++) {
        rulerHtml += `<div class="ruler-line-num" data-line="${i}">${i < 10 ? '0' + i : i}</div>`;
      }
      lineRuler.innerHTML = rulerHtml;

      textarea.parentNode.insertBefore(wrapper, textarea);
      wrapper.appendChild(lineRuler);
      wrapper.appendChild(textarea);
    }

    // Sync scrolling of textarea and ruler
    const lineRuler = essayPage.querySelector('#tico-line-ruler');
    if (lineRuler && !textarea.dataset.scrollBound) {
      textarea.dataset.scrollBound = 'true';
      textarea.addEventListener('scroll', () => {
        lineRuler.scrollTop = textarea.scrollTop;
      });
    }

    // Input listener to update line counter in real-time
    if (!textarea.dataset.inputBound) {
      textarea.dataset.inputBound = 'true';
      textarea.addEventListener('input', () => {
        updateLineCountersOnly();
        triggerFirestoreAutosave();
      });
    }

    // Proposal select change
    const topicSelect = document.getElementById('essay-topic');
    if (topicSelect && !topicSelect.dataset.proposalBound) {
      topicSelect.dataset.proposalBound = 'true';
      topicSelect.addEventListener('change', () => {
        updateProposalDisplay(topicSelect.value);
      });
    }

    // Monitor essay send button to also save to Firestore
    const sendBtn = essayPage.querySelector('button.primary-button') || essayPage.querySelector('button.essay-send');
    if (sendBtn && !sendBtn.dataset.cloudAttached) {
      sendBtn.dataset.cloudAttached = 'true';
      sendBtn.addEventListener('click', () => {
        triggerFirestoreSaveOnSend();
      });
    }
  }

  function insertSkeletonIntoEditor(skeletonText) {
    const textarea = document.querySelector('textarea#essay-text');
    if (!textarea) return;

    if (textarea.value.trim().length > 10) {
      if (!confirm('Já existe um texto na folha. Deseja substituir pelo esqueleto da banca?')) {
        return;
      }
    }

    textarea.value = skeletonText;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    updateLineCountersOnly();

    // Scroll to top
    textarea.scrollTop = 0;
    textarea.focus();

    if (window.TicoMascot && window.TicoMascot.say) {
      window.TicoMascot.say(`Esqueleto da banca ${currentSelectedBanca} inserido! Complete os argumentos em cada parágrafo.`);
    }
  }

  function estimateLines(text) {
    if (!text || !text.trim()) return 0;
    
    // Average line length for A4 / exam ruled sheet is approx 65-75 chars
    const paragraphs = text.split('\n');
    let totalLines = 0;

    paragraphs.forEach(p => {
      if (!p.trim()) {
        totalLines += 1;
      } else {
        const chars = p.length;
        const est = Math.ceil(chars / 70);
        totalLines += Math.max(1, est);
      }
    });

    return totalLines;
  }

  function updateLineCountersOnly() {
    const textarea = document.querySelector('textarea#essay-text');
    const meter = document.getElementById('tico-line-meter');
    const tag = document.getElementById('tico-status-tag');
    const ruler = document.getElementById('tico-line-ruler');

    if (!textarea || !meter || !tag) return;

    const count = estimateLines(textarea.value);
    meter.textContent = `${count} / 30 linhas estimadas`;

    if (count === 0) {
      tag.textContent = 'Em branco';
      tag.className = 'tico-status-tag tag-empty';
    } else if (count < 15) {
      tag.textContent = '🔴 Insuficiente (Risco de eliminação)';
      tag.className = 'tico-status-tag tag-danger';
    } else if (count < 20) {
      tag.textContent = '🟡 Regular (Mínimo de alguns editais)';
      tag.className = 'tico-status-tag tag-warn';
    } else if (count <= 30) {
      tag.textContent = '🟢 Zona Ideal de Nota Máxima';
      tag.className = 'tico-status-tag tag-ideal';
    } else {
      tag.textContent = '⚠️ Excedeu a folha de 30 linhas';
      tag.className = 'tico-status-tag tag-overflow';
    }

    // Highlight current line numbers in ruler
    if (ruler) {
      const items = ruler.querySelectorAll('.ruler-line-num');
      items.forEach((item, idx) => {
        const lineNum = idx + 1;
        item.classList.toggle('active-line', lineNum <= count);
        item.classList.toggle('overflow-line', lineNum > 30);
      });
    }
  }

  // FIREBASE CLOUD PERSISTENCE
  let autosaveTimer = null;
  function triggerFirestoreAutosave() {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      saveEssayToCloud(false);
    }, 4000);
  }

  function triggerFirestoreSaveOnSend() {
    setTimeout(() => {
      saveEssayToCloud(true);
    }, 1000);
  }

  async function saveEssayToCloud(isSubmission) {
    if (!window.FirebaseApplet || !window.FirebaseApplet.saveUserEssay) return;

    const auth = window.FirebaseApplet.auth;
    const user = auth ? auth.currentUser : null;
    if (!user) return; // Only saves if user is logged in or guest

    const textarea = document.querySelector('textarea#essay-text');
    const topicSelect = document.getElementById('essay-topic');
    if (!textarea || !textarea.value.trim()) return;

    const topicId = topicSelect ? topicSelect.value : 'geral';
    const text = textarea.value;
    const lines = estimateLines(text);

    const essayData = {
      bank: currentSelectedBanca,
      topicId,
      text,
      estimatedLines: lines,
      isSubmission: !!isSubmission,
      lastUpdated: new Date().toISOString()
    };

    try {
      await window.FirebaseApplet.saveUserEssay(user.uid, essayData);
      console.log('[Firebase] Redação salva com sucesso na nuvem Firestore.');
    } catch (e) {
      console.warn('[Firebase] Não foi possível salvar rascunho de redação:', e);
    }
  }

  // Observer to detect when .essay-page is mounted
  let initRaf = null;
  const observer = new MutationObserver(() => {
    if (document.querySelector('.essay-page')) {
      if (!initRaf) {
        initRaf = requestAnimationFrame(() => {
          initRaf = null;
          initBancaRedacao();
        });
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Initial check
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBancaRedacao);
  } else {
    initBancaRedacao();
  }

})();
