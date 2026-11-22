// Buzina, a mascote: responde perguntas sobre o funcionamento da própria Muvuca.
// Com um provedor de verdade no time, quem responde é o modelo, com o README como guia.
// No modo demonstração (ou se o modelo falhar), responde este guia curado, sem rede.

const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Cada tema: palavras que o identificam (sem acento) e a resposta. Palavra mais longa pesa mais.
export const GUIA = [
  { titulo: 'Como começar', chaves: ['comec', 'comeco', 'usar', 'uso', 'funciona', 'primeiro', 'inicio', 'pedido', 'pedir', 'enviar', 'o que e a muvuca', 'o que faz'],
    resposta: 'A Muvuca é um time de agentes de IA que trabalha numa pasta do seu computador.\n1. Confira a "Pasta do projeto" no topo.\n2. Escreva o pedido na caixa de baixo e aperte Enter.\n3. O líder monta o plano, os agentes executam, os testes rodam e o revisor confere.\n4. No fim você vê os arquivos alterados e escolhe "Manter" ou "Descartar".\nPara falar com um agente só, clique no nome dele acima da caixa de texto.' },
  { titulo: 'Manter ou descartar mudanças', chaves: ['manter', 'descartar', 'desfazer', 'mudanca', 'alterad', 'arquivos alterados', 'decisao', 'voltar atras', 'restaurar', 'pendente'],
    resposta: 'Nada do que o time escreve é definitivo até você decidir. Ao fim do pedido aparece a lista de arquivos alterados, com o que mudou em cada um.\n- "Manter" fica com as mudanças.\n- "Descartar" devolve a pasta ao que era antes.\nEnquanto houver decisão pendente, a caixa de entrada mostra uma faixa com "Ver", "Manter" e "Descartar". A decisão sobrevive a um reinício do servidor.' },
  { titulo: 'Montar um time', chaves: ['construtor', 'mont', 'time', 'equipe', 'criar time', 'novo time', 'time novo', 'adicionar agente', 'arrastar', 'modelo de time', 'galeria', 'biblioteca'],
    resposta: 'Use a aba "Construtor de times" (ícone de três bolinhas ligadas).\n- Comece por um modelo pronto da galeria, ou do zero.\n- Arraste agentes básicos da biblioteca para a prévia, ou clique neles.\n- Na prévia, arraste um agente sobre outro para mudar o chefe, ligar os dois ou trocar a ordem.\n- "Salvar e pôr no palco" guarda o time em times/ e já o coloca para trabalhar.' },
  { titulo: 'Arquiteturas', chaves: ['arquitetura', 'supervisor', 'hierarqu', 'esteira', 'rede', 'sequencial', 'unico', 'centralizada', 'sub-lider', 'sublider', 'sem chefe'],
    resposta: 'Um time pode trabalhar de cinco jeitos:\n- Agente único: um agente faz tudo.\n- Supervisor: um líder planeja e distribui.\n- Hierárquica: o líder divide entre sub-líderes, e cada um planeja para a própria frente.\n- Esteira: sem líder; cada agente faz a sua etapa, na ordem da lista.\n- Rede: sem chefe; cada agente faz a sua parte e escolhe quem continua.\nVocê escolhe a arquitetura no construtor.' },
  { titulo: 'Modelos e provedores', chaves: ['modelo', 'provedor', 'claude', 'haiku', 'sonnet', 'fable', 'groq', 'ollama', 'api', 'chave', 'ia de verdade', 'real', 'custo', 'caro', 'barato'],
    resposta: 'Em Configurações > "Modelos do time" você escolhe quem responde pelos agentes (demonstração, o aplicativo claude logado no computador, ou uma API) e clica em "Usar no time inteiro".\n- Três campos dizem o modelo para tarefa simples, comum e difícil.\n- Cada papel tem um padrão: líder usa o comum, revisor o difícil, quem só consulta o simples, e para quem escreve código o líder decide a cada tarefa.\n- Em "Modelo de cada agente" você troca o de qualquer um.\nChaves de API ficam em variáveis de ambiente, nunca em arquivo.' },
  { titulo: 'Modo demonstração', chaves: ['demonstracao', 'demo', 'simulado', 'de mentira', 'sem gastar', 'teste gratis'],
    resposta: 'No modo demonstração os agentes seguem um roteiro fixo, sem chamar nenhuma IA e sem custo. Serve para ver a orquestração funcionando: plano, execução, testes, reprovação do revisor e correção.\nPara usar IA de verdade, vá em Configurações > "Modelos do time", escolha um provedor pronto (por exemplo claude-cli) e clique em "Usar no time inteiro".' },
  { titulo: 'Rotinas', chaves: ['rotina', 'agendar', 'agendad', 'horario', 'todo dia', 'automatic', 'sozinho', 'relogio', 'hora marcada'],
    resposta: 'Rotina é um pedido que o time recebe sozinho em dias e hora marcados. Fica na aba "Rotinas" (ícone de relógio).\n- Dê um nome, a hora, os dias da semana e o pedido.\n- Ela dispara só com a Muvuca rodando, até 10 minutos depois da hora, uma vez por dia.\n- "Rodar agora" dispara na hora; "Pausar" desliga sem apagar.\nAs mudanças de uma rotina também esperam a sua decisão.' },
  { titulo: 'Quadro de tarefas', chaves: ['quadro', 'tarefa', 'kanban', 'bloquead', 'coluna', 'andamento', 'acompanhar', 'progresso'],
    resposta: 'A aba "Quadro de tarefas" (ícone de colunas) mostra cada etapa do pedido como um cartão: A fazer, Trabalhando, Bloqueado, Em revisão e Encerrado.\n"Bloqueado" quer dizer que um agente espera você aprovar um comando; o ícone da aba mostra quantos estão assim. Correções pedidas pelos testes ou pelo revisor viram cartões próprios.' },
  { titulo: 'Memória dos agentes', chaves: ['memoria', 'nota', 'lembrar', 'lembra', 'aprende', 'esquece', 'anot'],
    resposta: 'Cada agente guarda notas curtas por projeto e as relê no começo de cada trabalho. Uma nota nasce quando o agente termina a resposta com "LEMBRAR: ..." ou quando o revisor reprova algo dele.\nAs notas aparecem na ficha do agente, na aba "Agentes", com um botão para apagar cada uma. São no máximo 20 por agente e projeto, e ficam fora da pasta do projeto.' },
  { titulo: 'Projetos e pastas', chaves: ['projeto', 'pasta', 'diretorio', 'caminho', 'onde trabalha', 'trocar de pasta', 'pasta padrao'],
    resposta: 'O time só mexe na pasta indicada em "Pasta do projeto", no topo.\n- A aba "Projetos" (ícone de pasta) guarda a lista de pastas: "Usar no palco" troca a pasta atual e "Tornar padrão" define a que abre sempre.\n- A pasta padrão também pode ser trocada em Configurações.\nCom mudanças esperando decisão numa pasta, a Muvuca não aceita pedido em outra.' },
  { titulo: 'Aprovação de comandos e segurança', chaves: ['aprovar', 'aprovacao', 'comando', 'seguranca', 'seguro', 'perigos', 'permiss', 'rodar comando', 'negar'],
    resposta: 'Os agentes só leem e escrevem dentro da pasta do projeto. Comandos de teste conhecidos (npm test, node --test, pytest) rodam direto; qualquer outro comando para e pede a sua aprovação, com "Aprovar comando" ou "Negar". Enquanto espera, o agente fica em "Aguarda você" e o cartão dele vai para "Bloqueado" no quadro.' },
  { titulo: 'Testes e revisão', chaves: ['test', 'testa', 'teste', 'portao', 'revisor', 'revisao', 'reprov', 'devolu', 'aprovad', 'qualidade', 'bug'],
    resposta: 'Depois que o time termina, a própria Muvuca roda os testes do projeto: a palavra do agente não conta. Se falharem, o trabalho volta para quem errou, num modelo um nível mais forte. Passando, o revisor lê as mudanças e aprova ou reprova, dizendo o arquivo e o problema. O número máximo de devoluções fica em Configurações > "Limites do time".' },
  { titulo: 'Parar um pedido', chaves: ['parar', 'interromp', 'cancelar', 'travou', 'demorando', 'nova conversa'],
    resposta: 'Durante um pedido aparece o botão "Parar" ao lado de "Enviar": ele interrompe o time na hora. O que já foi escrito aparece nos arquivos alterados, para você manter ou descartar. "Nova conversa", no alto à direita, limpa a conversa e a memória do líder.' },
  { titulo: 'As abas', chaves: ['aba', 'menu', 'lateral', 'icone', 'onde fica', 'onde acho', 'navega'],
    resposta: 'Na barra lateral, de cima para baixo:\n- Time: o palco e a caixa de pedidos.\n- Quadro de tarefas: as etapas do pedido em colunas.\n- Agentes: quem está no time, os agentes básicos e a memória de cada um.\n- Construtor de times: montar e trocar o time.\n- Projetos: as pastas de trabalho.\n- Rotinas: pedidos agendados.\n- Configurações (engrenagem, embaixo): pasta padrão, limites e modelos.' },
  { titulo: 'Quem é a Buzina', chaves: ['buzina', 'voce', 'mascote', 'cachorr', 'salsicha', 'easter', 'quem e', 'seu nome'],
    resposta: 'Au! Eu sou a Buzina, a salsicha astronauta mascote da Muvuca. Fico neste canto acompanhando o humor do time e respondo dúvidas sobre como a Muvuca funciona. Também estou na biblioteca do construtor como agente faz-tudo. Cinco cliques no logo me guardam ou me soltam.' },
];

export const SUGESTOES = ['Como começo?', 'Como uso IA de verdade?', 'O que são rotinas?', 'Como monto um time?'];

// Resposta sem rede: o tema do guia com mais palavras em comum com a pergunta.
export function responderOffline(pergunta) {
  // a chave tem que começar uma palavra da pergunta: "api" não pode casar com "capital"
  const p = ' ' + semAcento(pergunta).replace(/[^a-z0-9]+/g, ' ') + ' ';
  let melhor = null, pontos = 0;
  for (const tema of GUIA) {
    const n = tema.chaves.reduce((s, c) => s + (p.includes(' ' + c.replace(/[^a-z0-9]+/g, ' ')) ? Math.max(1, Math.round(c.length / 4)) : 0), 0);
    if (n > pontos) { pontos = n; melhor = tema; }
  }
  if (melhor) return { titulo: melhor.titulo, texto: melhor.resposta };
  return { titulo: null, texto: 'Essa eu não sei responder sem um modelo de verdade ligado. Posso falar sobre: ' + GUIA.map((t) => t.titulo.toLowerCase()).join(', ') + '.' };
}

// Instrução para quando um modelo de verdade responde: o README é a fonte.
export function sistemaBuzina(readme) {
  return 'Você é a Buzina, uma cadela salsicha astronauta, mascote do aplicativo Muvuca (um painel local de times de agentes de IA).\n' +
    'Responda SOMENTE dúvidas sobre como usar e como funciona a Muvuca, com base no guia abaixo. Se a resposta não estiver no guia, diga que não sabe e sugira onde olhar na tela.\n' +
    'Se a pergunta não for sobre a Muvuca, diga com simpatia que você só cuida desse assunto.\n' +
    'Responda em português do Brasil, em até 6 linhas, com passos numerados quando for um "como fazer". Use os nomes das abas e dos botões como aparecem na tela. Um "Au!" de vez em quando, sem exagerar.\n' +
    'Você não executa nada nem mexe em arquivos: só explica.\n\n=== GUIA DA MUVUCA ===\n' + String(readme || '').slice(0, 30000);
}
