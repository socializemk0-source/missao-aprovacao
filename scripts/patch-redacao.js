import fs from 'fs';

const ALL_TOPICS = [
  {
    id: "cebraspe-seguranca",
    bank: "Cebraspe",
    badge: "Estilo Cebraspe · Tópicos Espelho",
    title: "A integração das forças de segurança e o combate às organizações criminosas",
    prompt: "Considerando que o texto acima tem caráter unicamente motivador, redija um texto dissertativo acerca da integração das forças de segurança pública no Brasil. Ao elaborar seu texto, aborde, necessariamente, os seguintes aspectos: 1. A importância da inteligência e da cooperação interestadual [9,50 pts]; 2. O papel da tecnologia no monitoramento e controle de fronteiras [9,50 pts]; 3. A garantia dos direitos fundamentais na atuação ostensiva [10,00 pts].",
    support: "O combate ao crime organizado exige ações coordenadas que superem divisões federativas. O compartilhamento de dados e operações conjuntas entre Polícia Federal, Polícia Rodoviária Federal e polícias estaduais têm se mostrado decisivos para desarticular rotas logísticas e financeiras.",
    questions: [
      "Aborde o Tópico 1 em parágrafo específico com conectivo de início.",
      "Desenvolva o Tópico 2 detalhando ferramentas tecnológicas e vigilância integrada.",
      "Dedique o terceiro parágrafo ao Tópico 3, fundamentando a legalidade e dignidade humana."
    ]
  },
  {
    id: "cebraspe-governanca",
    bank: "Cebraspe",
    badge: "Estilo Cebraspe · Controle & Compliance",
    title: "Governança pública, transparência e compliance no combate à corrupção",
    prompt: "Redija um texto dissertativo acerca da governança e da integridade na administração pública. Em seu texto, atenda obrigatoriamente aos seguintes tópicos: 1. O papel dos órgãos de controle interno e externo na fiscalização [9,50 pts]; 2. A relevância dos programas de integridade (compliance) e canais de denúncia [9,50 pts]; 3. O impacto da transparência ativa na confiança do cidadão nas instituições [10,00 pts].",
    support: "A administração pública contemporânea adota modelos de conformidade e integridade inspirados nas melhores práticas globais, fortalecendo a prestação de contas (accountability) e mitigando desvios.",
    questions: [
      "Responda ao Tópico 1 destacando Tribunais de Contas e controladorias.",
      "Conecte o Tópico 2 à proteção do denunciante e cultura ética institucional.",
      "Encerre respondendo ao Tópico 3 com dados de transparência ativa."
    ]
  },
  {
    id: "fgv-ia-administracao",
    bank: "FGV",
    badge: "Estilo FGV · Tese & Tecnologia",
    title: "Inteligência Artificial e os limites da discricionariedade administrativa",
    prompt: "A automação de processos decisórios pelo poder público promete celeridade, mas suscita debates sobre a impessoalidade e a devida motivação dos atos administrativos. Redija um texto dissertativo-argumentativo posicionando-se sobre os limites éticos e jurídicos do uso de algoritmos na tomada de decisões pelo Estado.",
    support: "O uso de sistemas automatizados e modelos de IA para análise de benefícios, fiscalização tributária e triagem judicial expande-se rapidamente. Críticos alertam para riscos de 'caixa-preta' algorítmica e discriminação sistêmica.",
    questions: [
      "Defina sua tese claramente na introdução: a IA deve ser ferramenta de apoio ou decisora final?",
      "Fundamente com princípios constitucionais (Art. 37 da CF/88).",
      "Evite fórmulas prontas; elabore uma conclusão reflexiva e crítica."
    ]
  },
  {
    id: "fgv-reforma-tributaria",
    bank: "FGV",
    badge: "Estilo FGV · Densidade Argumentativa",
    title: "Reforma tributária, justiça fiscal e o pacto federativo",
    prompt: "Redija um texto dissertativo-argumentativo discutindo como conciliar a necessária simplificação do sistema tributário brasileiro com a garantia da autonomia de Estados e Municípios e a redução da regressividade fiscal.",
    support: "O modelo tributário sobre o consumo historicamente onerou as camadas mais vulneráveis e gerou insegurança jurídica decorrente da guerra fiscal federativa.",
    questions: [
      "Apresente um posicionamento contundente sobre a simplificação tributária.",
      "Articule os desafios do pacto federativo sem perder a coesão vocabular culta.",
      "Sustente a necessidade de justiça fiscal redistributiva com argumentos sólidos."
    ]
  },
  {
    id: "fcc-trabalho-dignidade",
    bank: "FCC",
    badge: "Estilo FCC · Filosofia e Direitos",
    title: "A dignidade da pessoa humana e as novas relações de trabalho por plataformas",
    prompt: "Com base na leitura reflexiva da realidade contemporânea, redija um texto dissertativo analisando as transformações do mundo do trabalho sob o império dos algoritmos, confrontando a flexibilidade prometida com a imperatividade da proteção social e da dignidade humana.",
    support: "Para muitos, o trabalho por aplicativo representa autonomia e oportunidade de renda; para outros, trata-se de precarização sem direitos básicos e subordinação a métricas invisíveis.",
    questions: [
      "Mobilize autores e conceitos sociológicos ou jurídicos (ex.: Bauman, Byung-Chul Han, valor social do trabalho).",
      "Evite juízos de senso comum ou maniqueísmos superficiais.",
      "Analise a responsabilidade das instituições e do Judiciário Trabalhista na garantia do patamar civilizatório mínimo."
    ]
  },
  {
    id: "fcc-justica-cidadania",
    bank: "FCC",
    badge: "Estilo FCC · Reflexão Tribunais",
    title: "O acesso à justiça como instrumento de efetivação da cidadania plena",
    prompt: "Redija um texto dissertativo-argumentativo refletindo sobre o alcance do Poder Judiciário na redução das desigualdades estruturais brasileiras e na materialização das promessas constitucionais de cidadania.",
    support: "A judicialização de demandas por saúde, educação e moradia reflete ao mesmo tempo a confiança da sociedade na Justiça e os limites das políticas públicas do Executivo.",
    questions: [
      "Examine a tensão entre ativismo judicial, separação de poderes e garantia de direitos sociais.",
      "Explore o conceito de cidadania ativa e dignidade coletiva.",
      "Conclua com uma síntese que amarre coerentemente as premissas reflexivas adotadas."
    ]
  },
  {
    id: "vunesp-cameras-seguranca",
    bank: "Vunesp",
    badge: "Estilo VUNESP · Pergunta-Problema",
    title: "Câmeras corporais na atividade policial: garantia de transparência ou limitação operacional?",
    prompt: "A partir dos textos de apoio e de seus conhecimentos, redija um texto dissertativo-argumentativo em norma-padrão da língua portuguesa respondendo ao seguinte questionamento: o uso obrigatório de câmeras corporais por policiais militares fortalece a segurança pública e os direitos fundamentais ou compromete a pronta resposta e a autonomia operacional das corporações?",
    support: "Estudos indicam redução de letalidade policial e de mortes de policiais em batalhões que adotaram câmeras; por outro lado, vozes no meio policial argumentam receio de hesitação em momentos de legítima defesa.",
    questions: [
      "Responda diretamente à pergunta central da proposta logo na introdução com tese explícita.",
      "Desenvolva argumentos sustentando sua escolha e refute contra-argumentos de forma fundamentada.",
      "Mantenha coerência lógica e conclua reafirmando a posição defendida."
    ]
  },
  {
    id: "vunesp-privatizacao-servicos",
    bank: "Vunesp",
    badge: "Estilo VUNESP · Dilema Social",
    title: "A concessão de serviços essenciais à iniciativa privada: eficiência ou risco à universalidade?",
    prompt: "Redija um texto dissertativo-argumentativo em norma culta posicionando-se de maneira clara sobre a seguinte questão: a delegação de serviços públicos essenciais (como água, saneamento e transporte) à iniciativa privada assegura modernização e investimentos ou compromete o acesso universal das populações de baixa renda?",
    support: "Defensores apontam investimentos robustos e metas contratuais de atendimento; opositores alertam para reajustes tarifários e negligência em regiões periféricas de baixa rentabilidade.",
    questions: [
      "Tome partido explícito frente ao dilema da proposta, sem dubiedade.",
      "Fundamente com exemplos concretos de concessões e regulação estatal (agências reguladoras).",
      "Elabore uma conclusão consistente que amarre todo o raciocínio."
    ]
  },
  {
    id: "cesgranrio-equidade-cnu",
    bank: "Cesgranrio",
    badge: "Estilo Cesgranrio · Políticas Públicas CNU",
    title: "Políticas de cotas e equidade racial no fortalecimento do serviço público",
    prompt: "Considerando o papel do Estado como indutor da justiça social, redija um texto dissertativo acerca da relevância das ações afirmativas e da diversidade na composição do quadro de servidores públicos brasileiros para a formulação de políticas mais representativas.",
    support: "A Lei de Cotas no serviço público completou uma década, ampliando a representatividade em carreiras federais, embora ainda haja sub-representação nos postos de alta liderança governamental.",
    questions: [
      "Destaque o princípio da isonomia material e a reparação histórica.",
      "Discuta como servidores diversos compreendem melhor as dores da população usuária.",
      "Proponha medidas viáveis para consolidação de lideranças inclusivas na gestão pública."
    ]
  },
  {
    id: "cesgranrio-governo-digital",
    bank: "Cesgranrio",
    badge: "Estilo Cesgranrio · Governo Digital",
    title: "Governo digital e a garantia de acesso para cidadãos em vulnerabilidade",
    prompt: "Redija um texto dissertativo-argumentativo analisando os avanços da plataforma Gov.br e os desafios para assegurar que a digitalização dos serviços públicos não crie novas formas de exclusão social e desamparo ao cidadão.",
    support: "Milhões de brasileiros realizam serviços públicos pelo celular, mas quase 30 milhões de pessoas ainda não possuem acesso estável à internet ou letramento digital suficiente.",
    questions: [
      "Contextualize o salto de eficiência administrativa propiciado pela tecnologia.",
      "Aponte os obstáculos enfrentados por idosos e populações de baixa renda.",
      "Apresente propostas práticas de atendimento híbrido (presencial + digital) humanizado."
    ]
  },
  {
    id: "digital",
    bank: "Treino geral",
    badge: "Treino Geral · Inclusão",
    title: "Inclusão digital no acesso aos serviços públicos",
    prompt: "Discuta como ampliar os serviços digitais sem excluir cidadãos com dificuldades de acesso à tecnologia.",
    support: "Situação fictícia: um município passou a agendar atendimentos pela internet. Parte dos moradores não dispõe de conexão ou tem dificuldade para usar o sistema. A equipe precisa conciliar agilidade e acesso.",
    questions: [
      "Qual problema merece prioridade?",
      "Que consequências atingem o cidadão?",
      "Como sustentar uma solução viável?"
    ]
  },
  {
    id: "atendimento",
    bank: "Treino geral",
    badge: "Treino Geral · Atendimento",
    title: "Atendimento humanizado e eficiência",
    prompt: "Discuta como conciliar eficiência administrativa e atendimento humanizado ao cidadão.",
    support: "Situação fictícia: uma unidade deseja reduzir filas. A equipe debate como agilizar o atendimento sem deixar de explicar procedimentos às pessoas que precisam de orientação.",
    questions: [
      "Rapidez é suficiente para definir qualidade?",
      "Que práticas podem atender às duas necessidades?",
      "Quais obstáculos precisam ser enfrentados?"
    ]
  },
  {
    id: "dados",
    bank: "Treino geral",
    badge: "Treino Geral · Dados",
    title: "Uso responsável de dados no serviço público",
    prompt: "Analise desafios do uso de dados para melhorar serviços e preservar a confiança dos cidadãos.",
    support: "Situação fictícia: setores de uma instituição pretendem compartilhar informações para evitar solicitações repetidas de documentos. A proposta exige discutir finalidade, acesso e cuidados.",
    questions: [
      "Qual benefício você defenderá?",
      "Que risco precisa ser considerado?",
      "Como relacionar cuidado e confiança?"
    ]
  },
  {
    id: "comunicacao",
    bank: "Treino geral",
    badge: "Treino Geral · Comunicação",
    title: "Linguagem clara na comunicação pública",
    prompt: "Discuta a importância da linguagem clara para o acesso do cidadão aos serviços públicos.",
    support: "Situação fictícia: um comunicado sobre inscrição recebeu muitas dúvidas. Embora trouxesse informações essenciais, utilizava siglas e expressões pouco conhecidas pelo público.",
    questions: [
      "Como a forma de escrever pode criar barreiras?",
      "Que exemplo sustenta sua tese?",
      "Como melhorar sem perder precisão?"
    ]
  },
  {
    id: "sustentabilidade",
    bank: "Treino geral",
    badge: "Treino Geral · Sustentabilidade",
    title: "Sustentabilidade na rotina administrativa",
    prompt: "Discuta como práticas sustentáveis podem ser incorporadas à rotina de uma instituição pública.",
    support: "Situação fictícia: uma equipe avalia consumo de papel, energia e materiais. O desafio é propor mudanças que possam ser acompanhadas ao longo do tempo.",
    questions: [
      "Qual prática teria impacto concreto?",
      "Como evitar uma discussão genérica?",
      "Como acompanhar os resultados?"
    ]
  },
  {
    id: "capacitacao",
    bank: "Treino geral",
    badge: "Treino Geral · Capacitação",
    title: "Capacitação contínua dos servidores",
    prompt: "Analise o papel da capacitação contínua na melhoria dos serviços prestados à sociedade.",
    support: "Situação fictícia: um setor implantou um novo sistema, mas a equipe recebeu pouco tempo para aprender a utilizá-lo. Surgiram retrabalho e dúvidas de atendimento.",
    questions: [
      "Qual relação existe entre formação e qualidade?",
      "Que dificuldade de implementação merece atenção?",
      "Como concluir sem apenas repetir a introdução?"
    ]
  }
];

const newOmStr = 'var om=["Treino geral","Cebraspe","FGV","FCC","Vunesp","Cesgranrio"];';
const newSmStr = 'var sm=[{id:`tema`,label:`Tema e tese`,max:20,description:`Responde ao tema e apresenta um posicionamento claro.`},{id:`argumentos`,label:`Argumentação`,max:30,description:`Desenvolve razões, exemplos e relações que sustentam a tese.`},{id:`organizacao`,label:`Organização e coesão`,max:20,description:`Articula parágrafos e ideias com progressão e conexão.`},{id:`linguagem`,label:`Norma-padrão e clareza`,max:30,description:`Emprega concordância, pontuação, ortografia e vocabulário adequados.`}];';
const newCmStr = 'var cm=' + JSON.stringify(ALL_TOPICS) + ';';

const newMmStr = `function mm(){let[e,t]=(0,C.useState)(cm[0].id),[n,r]=(0,C.useState)(om[0]),[i,a]=(0,C.useState)(\`treino\`),[o,s]=(0,C.useState)({drafts:{},history:[]}),[c,l]=(0,C.useState)(!1),[u,d]=(0,C.useState)(!1),[f,p]=(0,C.useState)(null),[m,h]=(0,C.useState)(\`\`),[g,_]=(0,C.useState)(0),[v,y]=(0,C.useState)(!1),[b,x]=(0,C.useState)(\`\`),[S,w]=(0,C.useState)(!1),[T,E]=(0,C.useState)(null),D=(0,C.useRef)(!1),O=(0,C.useRef)(!1),k=(0,C.useRef)(null),M=n+\`::\`+e,N=o.drafts[M]??\`\`,P=cm.find(t=>t.id===e)||cm[0]||{id:e,title:\`Proposta de Redação\`,prompt:\`\`,support:\`\`,questions:[]},F=o.history.filter(t=>t.topicId===e&&t.bank===n),I=F.find(e=>e.id===T)??F[0],L=I?F[F.indexOf(I)+1]:void 0;(0,C.useEffect)(()=>{try{let e=lm(localStorage.getItem(pm));e?s(e):(O.current=!0,d(!0))}catch{O.current=!0,d(!0)}return l(!0),()=>k.current?.abort()},[]),(0,C.useEffect)(()=>{let e=!0;p(null),h(\`\`);let t=new AbortController,n=setTimeout(()=>t.abort(),15e3);return fetch(\`/api/redacao\`,{signal:t.signal}).then(am).then(t=>{e&&p(t)}).catch(t=>{e&&h(t instanceof Error&&t.name!==\`AbortError\`?t.message:\`Não foi possível conectar ao servidor. Tente verificar novamente.\`)}),()=>{e=!1,clearTimeout(n),t.abort()}},[g]),(0,C.useEffect)(()=>{if(!(!c||O.current))try{localStorage.setItem(pm,JSON.stringify(o)),d(!1)}catch{d(!0)}},[o,c]);function R(e){s(t=>({...t,drafts:{...t.drafts,[M]:e}}))}async function z(){if(D.current||!f||!S||dm(N)<80)return;D.current=!0,y(!0),x(\`\`);let t={text:N,topicId:e,bank:n};k.current=new AbortController;let r=setTimeout(()=>k.current?.abort(),6e4);try{let e=await fetch(\`/api/redacao\`,{method:\`POST\`,headers:{"Content-Type":\`application/json\`},body:JSON.stringify(t),signal:k.current.signal}),n=await e.json();if(!e.ok)throw Error(n.error||\`Não foi possível corrigir agora.\`);if(!fm(n.report,t.text))throw Error(\`A correção recebida não pôde ser validada.\`);let r={...t,report:n.report,id:crypto.randomUUID(),date:new Date().toISOString()};s(e=>({...e,history:[r,...e.history].slice(0,12)})),E(r.id)}catch(e){k.current?.signal.aborted?x(\`A correção demorou além do esperado. Seu rascunho foi preservado.\`):x(e instanceof Error?e.message:\`Falha de conexão. Tente novamente.\`)}finally{clearTimeout(r),D.current=!1,y(!1)}}function ee(){let t=new Blob([\`\${P?P.title:"Redacao"}\\nObjetivo: \${n}\\n\\n\${N}\`],{type:\`text/plain;charset=utf-8\`}),r=URL.createObjectURL(t),i=document.createElement(\`a\`);i.href=r,i.download=\`redacao-\${e}.txt\`,i.click(),setTimeout(()=>URL.revokeObjectURL(r),1e3)}return(0,G.jsxs)(\`section\`,{className:\`essay-page\`,children:[(0,G.jsxs)(\`header\`,{className:\`essay-hero\`,children:[(0,G.jsxs)(\`div\`,{children:[(0,G.jsx)(\`span\`,{className:\`eyebrow\`,children:\`OFICINA DE REDAÇÃO\`}),(0,G.jsx)(\`h1\`,{children:\`Sua próxima conquista começa com uma ideia.\`}),(0,G.jsx)(\`p\`,{children:\`Escreva, revise e encontre sua voz. Tico acompanha cada versão.\`}),(0,G.jsxs)(\`span\`,{className:\`essay-chip\`,children:[(0,G.jsx)(he,{size:16}),\` Dissertativo-argumentativo · área administrativa\`]})]}),(0,G.jsx)(Le,{pose:0,size:160})]}),(0,G.jsx)(\`div\`,{id:\`tico-banca-slot\`}),u&&(0,G.jsx)(\`p\`,{className:\`essay-error\`,role:\`alert\`,children:\`Não foi possível salvar com segurança. Baixe seu texto antes de sair; os dados anteriores não serão substituídos se não puderem ser lidos.\`}),(0,G.jsxs)(\`div\`,{className:\`essay-setup\`,children:[(0,G.jsxs)(\`label\`,{children:[\`Banca como objetivo\`,(0,G.jsx)(\`select\`,{disabled:v,value:n,onChange:e=>{r(e.target.value),E(null),x(\`\`)},children:om.map(e=>(0,G.jsx)(\`option\`,{children:e},e))})]}),(0,G.jsxs)(\`label\`,{children:[\`Seu ritmo\`,(0,G.jsxs)(\`select\`,{disabled:v,value:i,onChange:e=>a(e.target.value),children:[(0,G.jsx)(\`option\`,{value:\`treino\`,children:\`Treino com orientações\`}),(0,G.jsx)(\`option\`,{value:\`simulado\`,children:\`Escrita sem dicas\`})]})]})]}),(0,G.jsxs)(\`p\`,{className:\`essay-rubric-notice\`,children:[(0,G.jsx)(j,{size:18}),(0,G.jsxs)(\`span\`,{children:[(0,G.jsx)(\`strong\`,{children:\`Rubrica geral de treino, de 0 a 100.\`}),\` A escolha da banca organiza seu objetivo e histórico. Os critérios são os mesmos nesta versão e não reproduzem a correção oficial de um edital.\`]})]}),(0,G.jsxs)(\`div\`,{className:\`essay-workspace\`,children:[(0,G.jsxs)(\`aside\`,{className:\`essay-proposal\`,children:[(0,G.jsx)(\`div\`,{id:\`tico-proposal-banner-slot\`}),(0,G.jsx)(\`label\`,{htmlFor:\`essay-topic\`,children:\`Escolha sua proposta\`}),(0,G.jsx)(\`select\`,{id:\`essay-topic\`,value:e,disabled:v,onChange:e=>{t(e.target.value),E(null),x(\`\`)},children:cm.map(e=>(0,G.jsx)(\`option\`,{value:e.id,children:(e.bank&&e.bank!==\`Treino geral\`?\`[\`+e.bank+\`] \`:\`\`)+e.title},e.id))}),(0,G.jsx)(\`h2\`,{children:P?P.title:\`\`}),(0,G.jsx)(\`p\`,{children:P?P.prompt:\`\`}),(0,G.jsxs)(\`div\`,{className:\`essay-support\`,children:[(0,G.jsx)(\`strong\`,{children:\`Para iniciar a reflexão\`}),(0,G.jsx)(\`p\`,{children:P?P.support:\`\`}),(0,G.jsx)(\`small\`,{children:\`Texto de apoio autoral. Não é uma questão oficial.\`})]}),i===\`treino\`&&(0,G.jsxs)(\`div\`,{className:\`essay-tips\`,children:[(0,G.jsx)(\`h3\`,{children:\`Antes de escrever\`}),(0,G.jsx)(\`ul\`,{children:(P&&Array.isArray(P.questions)?P.questions:[]).map(e=>(0,G.jsx)(\`li\`,{children:e},e))}),(0,G.jsx)(\`p\`,{children:\`Apresente sua tese, desenvolva argumentos e conclua de forma coerente. Use exemplos que consiga explicar.\`})]}),(0,G.jsxs)(\`details\`,{children:[(0,G.jsx)(\`summary\`,{children:\`Como a redação será avaliada\`}),sm.map(e=>(0,G.jsxs)(\`p\`,{children:[(0,G.jsxs)(\`strong\`,{children:[e.label,\` · \`,e.max,\` pontos\`]}),(0,G.jsx)(\`br\`,{}),e.description]},e.id))]})]}),(0,G.jsxs)(\`div\`,{className:\`essay-writing\`,children:[(0,G.jsxs)(\`div\`,{className:\`essay-editor-heading\`,children:[(0,G.jsx)(\`h2\`,{children:\`Seu texto\`}),(0,G.jsxs)(\`span\`,{"aria-live":\`polite\`,children:[(0,G.jsx)(ye,{size:14}),c?u?\`Falha ao salvar\`:\`Salvo neste navegador\`:\`Carregando…\`]})]}),(0,G.jsx)(\`div\`,{id:\`tico-editor-bar-slot\`}),(0,G.jsx)(\`label\`,{className:\`sr-only\`,htmlFor:\`essay-text\`,children:\`Escreva sua redação\`}),(0,G.jsxs)(\`div\`,{className:\`tico-ruled-sheet-wrapper\`,children:[(0,G.jsx)(\`div\`,{className:\`tico-line-ruler\`,id:\`tico-line-ruler\`,children:Array.from({length:30},(_,k)=>(0,G.jsx)(\`div\`,{className:\`ruler-line-num\`,"data-line":k+1,children:k<9?\`0\`+(k+1):k+1},k))}),(0,G.jsx)(\`textarea\`,{id:\`essay-text\`,disabled:!c||v,maxLength:1e4,value:N,onChange:e=>R(e.target.value),placeholder:\`Comece apresentando a ideia que você vai defender…\`,spellCheck:i===\`treino\`})]}),(0,G.jsxs)(\`div\`,{className:\`essay-count\`,children:[(0,G.jsxs)(\`span\`,{children:[dm(N),\` palavras · \`,N.length,\`/10.000 caracteres\`]}),(0,G.jsxs)(\`button\`,{disabled:!N,onClick:ee,children:[(0,G.jsx)(V,{size:15}),\` Baixar texto\`]})]}),(0,G.jsx)(\`p\`,{className:\`essay-small\`,children:\`Para solicitar correção: pelo menos 80 palavras. Este limite é do treino, não de uma banca. A quantidade de linhas depende da folha e não é simulada aqui.\`}),(0,G.jsxs)(\`div\`,{className:\`essay-send\`,children:[m?(0,G.jsxs)(\`div\`,{role:\`alert\`,children:[(0,G.jsx)(\`p\`,{className:\`essay-error\`,children:m}),(0,G.jsx)(\`button\`,{className:\`essay-rewrite\`,onClick:()=>_(e=>e+1),children:\`Verificar novamente\`})]}):f===null?(0,G.jsx)(\`p\`,{children:\`Verificando disponibilidade da correção…\`}):f?(0,G.jsx)(G.Fragment,{children:(0,G.jsxs)(\`label\`,{className:\`essay-consent\`,children:[(0,G.jsx)(\`input\`,{type:\`checkbox\`,checked:S,onChange:e=>w(e.target.checked),disabled:v}),(0,G.jsx)(\`span\`,{children:\`Enviar este texto à OpenAI para receber uma avaliação estimada por IA. Evite incluir dados pessoais.\`})]}) }):(0,G.jsx)(\`p\`,{children:\`A correção não está disponível neste momento. Seu texto continua salvo; você pode continuar escrevendo e baixar uma cópia.\`}),(0,G.jsxs)(\`button\`,{className:\`primary-button\`,disabled:!c||!f||v||!S||dm(N)<80,onClick:z,children:[(0,G.jsx)(Te,{size:18}),v?\`Lendo e avaliando seu texto…\`:\`Receber avaliação por IA\`]}),(0,G.jsx)(\`p\`,{className:\`essay-small\`,children:\`Nota pedagógica estimada. Pode conter erros e não substitui a correção de um professor ou da banca.\`}),b&&(0,G.jsx)(\`p\`,{className:\`essay-error\`,role:\`alert\`,children:b})]})]})]}),(0,G.jsxs)(\`section\`,{className:\`essay-history\`,children:[(0,G.jsxs)(\`div\`,{className:\`essay-editor-heading\`,children:[(0,G.jsx)(\`h2\`,{children:\`Seu percurso de escrita\`}),(0,G.jsx)(\`span\`,{children:\`Até 12 avaliações neste navegador\`})]}),F.length?(0,G.jsxs)(G.Fragment,{children:[(0,G.jsx)(\`div\`,{className:\`essay-version-tabs\`,children:F.map((e,t)=>(0,G.jsxs)(\`button\`,{disabled:v,"aria-pressed":I?.id===e.id,onClick:()=>E(e.id),children:[new Date(e.date).toLocaleDateString(\`pt-BR\`),\` ·\`,\` \`,um(e.report),\`/100 \`,t===0?\`· mais recente\`:\`\`]},e.id))}),I&&(0,G.jsxs)(\`div\`,{className:\`essay-report\`,children:[(0,G.jsxs)(\`div\`,{className:\`essay-score\`,children:[(0,G.jsxs)(\`span\`,{children:[(0,G.jsx)(\`strong\`,{children:um(I.report)}),\`/100\`]}),(0,G.jsxs)(\`div\`,{children:[(0,G.jsx)(\`h3\`,{children:\`Avaliação estimada por IA\`}),(0,G.jsx)(\`p\`,{children:I.report.summary}),L&&(0,G.jsxs)(\`p\`,{children:[\`Variação em relação à versão anterior:\`,\` \`,(0,G.jsxs)(\`strong\`,{children:[um(I.report)-um(L.report)>0?\`+\`:\`\`,um(I.report)-um(L.report),\` \`,\`pontos\`]}),\`. A nota pode variar; confira as justificativas.\`]})]})]}),(0,G.jsx)(\`div\`,{className:\`essay-criteria\`,children:sm.map(e=>{let t=I.report.criteria.find(t=>t.id===e.id);return(0,G.jsxs)(\`article\`,{children:[(0,G.jsxs)(\`strong\`,{children:[e.label,\` \`,(0,G.jsxs)(\`span\`,{children:[t.score,\`/\`,e.max]})]}),(0,G.jsx)(\`p\`,{children:t.reason})]},e.id)})}),(0,G.jsx)(\`h3\`,{children:\`Trechos para revisar\`}),I.report.annotations.length?I.report.annotations.map((e,t)=>(0,G.jsxs)(\`article\`,{className:\`essay-annotation\`,children:[(0,G.jsx)(\`blockquote\`,{children:e.quote}),(0,G.jsxs)(\`p\`,{children:[(0,G.jsx)(\`strong\`,{children:\`O que observar:\`}),\` \`,e.issue]}),(0,G.jsxs)(\`p\`,{children:[(0,G.jsx)(\`strong\`,{children:\`Como melhorar:\`}),\` \`,e.suggestion]})]},t)):(0,G.jsx)(\`p\`,{children:\`A avaliação não indicou trechos específicos. Confira os critérios e próximos passos.\`}),(0,G.jsxs)(\`div\`,{className:\`essay-criteria\`,children:[(0,G.jsxs)(\`article\`,{children:[(0,G.jsx)(\`h3\`,{children:\`Pontos fortes\`}),(0,G.jsx)(\`ul\`,{children:I.report.strengths.map((e,t)=>(0,G.jsx)(\`li\`,{children:e},t))})]}),(0,G.jsxs)(\`article\`,{children:[(0,G.jsx)(\`h3\`,{children:\`Seu próximo passo\`}),(0,G.jsx)(\`ol\`,{children:I.report.nextSteps.map((e,t)=>(0,G.jsx)(\`li\`,{children:e},t))})]})]}),(0,G.jsxs)(\`details\`,{children:[(0,G.jsx)(\`summary\`,{children:\`Ler o texto que recebeu esta avaliação\`}),(0,G.jsx)(\`p\`,{className:\`essay-original\`,children:I.text})]}),(0,G.jsxs)(\`button\`,{className:\`essay-rewrite\`,disabled:v,onClick:()=>{R(N||I.text),document.getElementById(\`essay-text\`)?.focus(),document.getElementById(\`essay-text\`)?.scrollIntoView({block:\`center\`})},children:[(0,G.jsx)(ve,{size:17}),\` Continuar a reescrita\`,\` \`,(0,G.jsx)(A,{size:17})]}),(0,G.jsx)(\`p\`,{className:\`essay-small\`,children:\`Editar o rascunho não altera a avaliação desta versão. Envie novamente para avaliar a reescrita.\`})]})]}):(0,G.jsxs)(\`div\`,{className:\`essay-empty\`,children:[(0,G.jsx)(he,{size:30}),(0,G.jsx)(\`p\`,{children:\`Sua primeira avaliação aparecerá aqui, com pontos fortes, trechos para revisar e próximos passos.\`})]})]})]})}`;

for (const p of ['public/assets/index-Dl2uwfPA.js', 'assets/index-Dl2uwfPA.js']) {
  if (!fs.existsSync(p)) continue;
  let code = fs.readFileSync(p, 'utf8');

  // 1. Replace om, sm, and cm
  const omStart = code.indexOf('var om=[');
  const lmStart = code.indexOf('function lm(');
  if (omStart !== -1 && lmStart !== -1) {
    const replacement = newOmStr + newSmStr + newCmStr;
    code = code.substring(0, omStart) + replacement + code.substring(lmStart);
    console.log(`[${p}] Replaced om, sm, and cm`);
  }

  // 2. Replace mm()
  const mmStart = code.indexOf('function mm(){');
  const gmStart = code.indexOf('var hm=');
  if (mmStart !== -1 && gmStart !== -1) {
    code = code.substring(0, mmStart) + newMmStr + ';' + code.substring(gmStart);
    console.log(`[${p}] Replaced mm()`);
  }

  fs.writeFileSync(p, code, 'utf8');
  console.log(`[${p}] Successfully updated`);
}
