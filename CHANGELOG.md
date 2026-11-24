# Histórico de mudanças

As versões seguem `maior.menor.correção`, da mais nova para a mais antiga. O que ainda não foi lançado fica em "Em andamento". Como lançar: [docs/versoes.md](docs/versoes.md).

## 1.0.3 (24/11/2026): o npm acompanha as versões

- **Cada versão lançada vai sozinha para o npm.** O mesmo fluxo que gera os instaladores publica o pacote, sem token guardado e com o selo de procedência. Antes, o npm dependia de alguém publicar à mão e ficava para trás.

## 1.0.2 (24/11/2026): a chave de API não passa na frente da assinatura

- **Chave de API no ambiente não derruba mais o time.** Quem tinha `ANTHROPIC_API_KEY` no terminal (no `~/.bashrc`, por exemplo) e abria a Muvuca dali via o Claude Code usar essa chave, cobrada à parte, em vez da assinatura; com a chave sem crédito, todo pedido falhava em "Credit balance is too low". Agora, quando há login de assinatura, a Muvuca chama o `claude` sem a chave. Sem login de assinatura a chave continua valendo, e se ela estiver sem crédito o erro diz qual variável é e o que fazer. Para usar a chave de propósito, ponha `"usarChaveDeApi": true` no provedor.

## 1.0.1 (23/11/2026)

- **O time em uso volta quando a Muvuca reabre.** Antes, o time montado no construtor vivia só na memória: fechar, reiniciar ou atualizar a Muvuca voltava ao time do arquivo, e um agente como a Buzina sumia do palco. Agora o time da conversa principal fica em `time-em-uso.json`, na pasta de dados. Se ele deixar de valer numa versão nova, a Muvuca sobe com o time do arquivo e guarda o antigo como `time-em-uso.json.invalido`.

## 1.0.0 (23/11/2026)

A primeira versão estável, e a primeira com o repositório aberto. Não traz função nova em relação à 0.9.0: traz a prova, com o Claude de verdade, dos fluxos que só tinham rodado em demonstração, e a correção do que essa prova encontrou. O que ainda falta para um produto maduro está no roteiro do README: instaladores assinados, atualização automática e publicação no npm.

- **Vigia de "mudança" não se confunde mais com o relógio.** Tempos de execução na saída do comando (como os do `node --test`) deixaram de contar como mudança; antes, um vigia desse tipo sobre um comando de teste chamaria o time em toda verificação. O cartão do vigia passa a resumir pelo placar dos testes.

### Conferido com o Claude de verdade em 23/11/2026

Quatro provas com o time real (Maestro, Chevron no haiku, Revisor no fable), na pasta de teste, com o isolamento dos testes ligado:

- **Pedido completo do time:** plano, três arquivos escritos, portão `npm test` isolado e revisão aprovada, em 40 s.
- **Dois pedidos ao mesmo tempo:** duas conversas trabalhando juntas, cada uma na própria pasta, sem misturar arquivos nem conversa.
- **Especificação em etapas:** o líder planejou duas etapas e o time cumpriu as duas, cada uma com portão e revisão, em 100 s.
- **Vigia chamando o time:** com uma fórmula quebrada de propósito, o vigia percebeu a falha em 21 s e chamou o time, que consertou; depois do conserto, não chamou de novo.

Ainda sem prova com o Claude: o login vencendo no meio de um pedido, uma etapa de especificação que falha e pausa, e a aprovação de comandos por um agente.

## 0.9.0 (23/11/2026)

Três ideias trazidas da análise do Kiro Crew.

- **Especificação em etapas.** Para um trabalho grande, marque "em etapas" ao enviar: quem lidera quebra a especificação em até 12 etapas e o time faz uma de cada vez, cada uma como um pedido completo (com portão de testes e revisão). Um painel no topo da conversa mostra o andamento e deixa pausar, retomar, pular a etapa que travou ou cancelar. O progresso fica gravado: se a Muvuca fechar no meio, a especificação volta pausada. As mudanças de todas as etapas esperam uma decisão só, no fim.
- **Vigias.** Um tipo novo de rotina: em vez de dia e hora, um comando que a Muvuca roda de tempos em tempos na pasta do projeto, sem gastar modelo. O time só recebe o pedido quando o comando falha (ou quando a saída muda), e uma vez só enquanto a situação durar. "Verificar agora" roda o comando na hora e mostra o resultado.
- **Lições do time.** Regras de um projeto que todo agente recebe antes de trabalhar, inclusive quem planeja. Entram pela aba Agentes ou pelo motivo escrito ao descartar uma entrega ("Vai descartar? Diga por quê").
- Conferido em demonstração, pela tela e pela bateria ao vivo (243 verificações). Ainda sem prova com o Claude de verdade: uma especificação em etapas inteira e um vigia chamando o time.

## 0.8.0 (23/11/2026): exportar o time para outra IA

- **Botão "Exportar…" no construtor.** A arquitetura montada sai em arquivos que outra IA consegue usar: `AGENTS.md` (o time em texto, com diagrama, regras de trabalho e as instruções de cada agente), `muvuca-time.json` (o time em JSON) e um subagente do Claude Code por agente em `.claude/agents/`.
- **Dois jeitos de salvar:** baixar um `.zip` ou gravar direto na pasta do projeto. Arquivo que já existe com outro conteúdo só é trocado com confirmação.
- Conferido com o Claude Code: ele reconheceu os subagentes exportados e entendeu a arquitetura lendo só o `AGENTS.md`.

### Conferido com o Claude de verdade em 23/11/2026

Nada mudou no programa. Fica o registro do que foi provado em 23/11/2026, depois de refeito o login do Claude Code:

- **Entrar com o Claude:** o botão abriu a página de login, o login foi feito no navegador e a tela percebeu sozinha e se fechou.
- **Isolamento nos testes que o agente roda** (o item que a 0.6.0 deixou como "não conferido"): com a permissão do comando exato, o Claude rodou `node --test`; as formas `node --test --allow-fs-write=*` e `node --allow-child-process --test .` foram negadas; e o teste que ele rodou não conseguiu ler nem escrever fora da pasta.

Ainda sem prova com o Claude: dois pedidos reais ao mesmo tempo, e um pedido completo do time com um agente escrevendo e rodando testes isolados.

## 0.7.0 (23/11/2026): entrar com o Claude

- **Botão "Entrar com o Claude".** Quando o Claude Code está instalado mas sem login, a Muvuca mostra uma tela com o botão, que abre a página de login do Claude no navegador e percebe sozinha quando o login termina. Aparece nas boas-vindas, ao abrir a Muvuca sem login e quando o login vence no meio de um pedido. A senha é digitada na página da Anthropic; a Muvuca não vê nem guarda o acesso.
- **Login vencido deixa de aparecer como resposta do agente.** O pedido para com a mensagem "O login do Claude Code venceu ou ainda não foi feito", em vez do erro cru do aplicativo.

## 0.6.3 (23/11/2026): ajustes do isolamento e das conversas

- O isolamento dos testes reconhece mais uma forma do caminho do projeto no Windows (pasta que é um link, dentro de um caminho com nome abreviado).
- A faixa de conversas mostra o pedido de uma conversa assim que ela começa a trabalhar; antes havia um instante em que aparecia sem texto.
- As versões 0.6.0 a 0.6.2 foram marcadas, mas não tiveram instaladores publicados: os testes automáticos no GitHub barraram as três, cada vez por um motivo que só aparecia noutro sistema.

## 0.6.2 (23/11/2026): isolamento no macOS

- **O isolamento dos testes funciona no macOS e em projetos acessados por link simbólico.** O Node confere a permissão pelo caminho verdadeiro da pasta, e a Muvuca liberava só o caminho como foi escrito. No macOS a pasta temporária fica atrás de um atalho, então todo teste era bloqueado. Achado pelos testes automáticos no GitHub; por isso a 0.6.1 também não chegou a ter instaladores publicados.

## 0.6.1 (23/11/2026): isolamento no Node 22

- **O isolamento dos testes passa a funcionar no Node 22**, no portão. Na 0.6.0 ele só ligava no Node 24, e os testes automáticos do próprio projeto falhavam no Node 22 (por isso a 0.6.0 não chegou a ter instaladores publicados). Os testes que o agente roda por conta própria continuam isolados só a partir do Node 24; no Node 22 a conversa avisa.

## 0.6.0 (23/11/2026): testes isolados, conversas paralelas e tela em módulos

### Novo

- **Testes isolados.** O código de teste que um agente escreve só lê e escreve dentro da pasta do projeto e de uma pasta temporária, e não abre outros processos. Vale para `node --test`, no portão e nos testes que o próprio agente roda. Outros comandos de teste rodam como antes, e o cartão do portão avisa. Liga e desliga em Configurações.
- **Vários pedidos ao mesmo tempo.** A faixa "Conversas abertas", no topo, abre até quatro conversas. Cada uma tem o próprio time, a própria pasta e os próprios pedidos, e elas trabalham em paralelo. Duas conversas não usam a mesma pasta.
- A Buzina responde pelo guia embutido quando o aplicativo do provedor falha (login vencido, por exemplo), em vez de mostrar o erro dele.

### Mudou

- **A tela virou um conjunto de módulos.** Os scripts que dividiam um escopo só passaram a ter cada um o seu, com importações explícitas e sem ciclos. Nada mais vai para o escopo global do navegador. Para quem usa, nada muda.
- Com o isolamento ligado, os agentes do Claude Code rodam os testes só com `node --test`; `npm test` deixa de ser aceito para eles.
- Testes de projeto que abrem outro processo não passam com o isolamento ligado.

### Não conferido

- O isolamento **nos testes que o agente roda pelo Claude Code** foi verificado só em partes: o `claude` funciona com o ambiente restrito, e o Node bloqueia como esperado. O caminho completo (o agente rodando `node --test` e sendo bloqueado ao tentar outra forma) não foi exercitado, porque o login do Claude Code na máquina de desenvolvimento estava vencido.

## 0.5.0 (22/11/2026): revisão de segurança e de uso

Resultado de uma rodada de busca por falhas. Três foram confirmadas com teste e corrigidas; o resto são reforços e melhorias.

### Corrigido

- **O "Descartar" não restaurava tudo.** Arquivos acima de 512 KB e as pastas `dist/` e `build/` ficavam como o time deixou, sem aparecer no diff. Agora entram na foto do projeto (até 25 MB por arquivo) e voltam ao que eram. O que continua de fora (`node_modules/`, `.git/`, arquivos enormes) gera um aviso no cartão do diff.
- **Um site aberto no navegador conseguia ler a conversa.** O servidor passou a conferir o endereço pelo qual foi chamado.
- **Qualquer programa do computador comandava a Muvuca.** A página e a API agora pedem uma chave de acesso, guardada na pasta de dados. O link que a Muvuca abre leva a chave; quem abrir o endereço puro num navegador novo vê uma página explicando como entrar.
- **Gravação de arquivos de dados.** Uma queda no meio da gravação deixava o JSON pela metade, e as preferências voltavam ao padrão. A gravação agora troca o arquivo de uma vez.
- **Ctrl+C ou fechar a janela deixava processos rodando.** O que a Muvuca subiu é encerrado junto com ela.

### Novo

- **Histórico de conversas**, no botão "Histórico": as 100 conversas mais recentes.
- **Tempo e uso de cada pedido**: tempo total, chamadas ao provedor e, com o Claude Code, tokens e custo pela tabela da API.
- **Limites de tempo nas Configurações**, para cada agente e para os testes.
- **Conexões com ferramentas escolhidas**: dá para liberar só algumas ferramentas de um servidor.
- **Uma Muvuca por pasta de dados**: se já há uma aberta, o comando e o aplicativo mostram essa em vez de subir outra.
- **Anexos de um pedido descartado saem junto.**
- **Avisos de falha na tela**: quando o servidor não responde ou devolve erro, aparece um aviso em vez de a tela quebrar em silêncio.

### Mudou

- **A página não busca mais nada na internet.** As fontes passaram a vir do próprio servidor, e uma política de conteúdo impede carregar qualquer coisa de fora.
- **Quem usa a API por programa** precisa mandar o cabeçalho `x-muvuca-token`. A bateria já faz isso.
- A ligação de conexões não guarda mais agentes que escrevem arquivos.
- O README deixou de afirmar que os agentes só escrevem dentro da pasta: os testes que eles escrevem rodam sem isolamento.

### Continua pendente

- Isolar a execução dos testes escritos pelos agentes.
- Mais de um pedido ao mesmo tempo, tela para celular e testes automáticos da tela.
- Instaladores assinados e atualização automática.

## 0.4.1 (22/11/2026): conexões com muitas ferramentas

- **O teste de uma conexão conta todas as ferramentas.** Antes a lista era cortada em 100, e um servidor grande aparecia com o número errado. Agora a tela mostra o total, as 12 primeiras e quantas ficaram de fora; o nome de todas aparece ao passar o mouse.

## 0.4.0 (22/11/2026): conexões (MCP)

- **Aba Conexões.** Os agentes passam a alcançar o que está fora da pasta do projeto por servidores MCP: documentação, issues, um banco de dados. Uma conexão pode ser um comando neste computador ou um endereço na rede, e o botão "Testar" mostra as ferramentas que ela oferece.
- **Uma conexão por agente.** Você marca quem pode usar cada uma; de fábrica, ninguém usa nenhuma.
- **Só agentes que não escrevem arquivos.** O que uma conexão faz fora da pasta não é desfeito pelo "Descartar", então líder, pesquisa e revisor podem usar, e quem escreve código não.
- **Nenhum token é gravado.** A conexão guarda só o nome da variável de ambiente; a tela recusa o que parece ser o valor.
- **Cada uso aparece na conversa**, com o agente, a conexão e a ferramenta.
- Funciona com o Claude Code. Em demonstração e nos provedores por API, as conexões não são usadas.
- Fica para depois: aprovação ação por ação e conexões para quem escreve código.

## 0.3.2 (22/11/2026): pronta para o npm

- **Pacote preparado para publicação no npm.** Saiu a trava que impedia publicar, e antes de cada publicação o pacote confere a versão e roda os testes. Depois de publicado, quem tem Node 22 roda com `npx muvuca`.
- A barra de linguagens do GitHub deixou de contar as fontes dos personagens como código.

## 0.3.1 (22/11/2026): a tela deixou de ser um arquivo só

Nada muda no que você vê nem no jeito de usar.

- **A tela foi dividida.** O `index.html` tinha 2.335 linhas com tudo dentro; agora tem 229, só com a estrutura da página. Os estilos foram para `public/css/` (2 arquivos) e o programa para `public/js/` (9 arquivos, um por parte da tela). Continua sem framework e sem etapa de build.
- **Primeiros testes da tela.** As regras das setas do construtor e o histórico do desfazer saíram do meio do código da tela e viraram módulos em `public/js/regras/`, com 8 testes.
- **Refazer mais correto.** Depois de desfazer e fazer uma mudança nova, Ctrl+Y não traz mais de volta um estado antigo que já não fazia sentido.
- O servidor passou a servir os estilos e os scripts da tela, só de `css/` e `js/`, com o tipo de arquivo declarado.

## 0.3.0 (22/11/2026): repositório reorganizado

Nada muda na tela nem no jeito de usar. Muda onde cada arquivo fica.

- **Estrutura nova de pastas.** O programa foi para `src/`; o time de fábrica, a biblioteca de agentes e os modelos prontos, para `config/`; as ferramentas de versão e os testes ao vivo, para `scripts/`; as fontes dos personagens, para `assets/personagens/`; os aplicativos falsos usados nos testes, para `test/apoio/`. A raiz caiu de 20 arquivos para 7.
- **Quem roda do código-fonte:** o servidor agora é `node src/servidor.js` (`npm start` continua igual). A variável `MUVUCA_CONFIG` passa a procurar o arquivo em `config/`; caminho completo continua valendo.
- **Node 22 ou mais novo** para rodar do código-fonte ou pelo `npx`. O Node 20 saiu de suporte, e o comando de teste usa um recurso que ele não tem. O aplicativo de mesa não é afetado: traz o próprio Node.
- `npm run bateria` roda a bateria ao vivo.
- Pendência registrada no roteiro: tirar do repositório as imagens-fonte dos personagens, que são 41 MB dos 48 MB.

## 0.2.2 (22/11/2026): a Buzina não some mais

- **A Buzina continua solta no aplicativo de mesa.** A escolha ficava guardada só no navegador, e o aplicativo, que abria num endereço novo a cada vez, não a encontrava. Agora ela fica na pasta de dados e vale para o navegador e para o aplicativo.
- **O aplicativo de mesa abre sempre no mesmo endereço** (porta 43170; se estiver ocupada, usa uma livre). Com isso, a pasta de projeto escolhida e a conversa recolhida também são lembradas entre uma abertura e outra.
- **O comando de lançar roda os testes de verdade.** Na 0.2.1 essa etapa terminava sem executar nenhum teste e seguia em frente. Agora ela conta os testes que rodaram e para se a conta der zero ou se algum falhar.

## 0.2.1 (22/11/2026): controle de versões

- **Lançar uma versão virou um comando só:** `npm run lancar -- correcao` (ou `menor`, `maior`, ou a versão por extenso). Ele roda os testes, fecha a seção "Em andamento" deste arquivo com o número e a data, atualiza `package.json`, `package-lock.json` e o selo do README, e cria o commit e a tag. Com `--enviar`, já publica.
- **As notas da página de Releases saem deste arquivo**, da seção da versão, seguidas da tabela de instaladores e do aviso de assinatura.
- **A geração dos instaladores confere a tag antes de começar:** ela tem de bater com o `package.json`, e a versão tem de ter notas aqui.
- **Soma de verificação:** cada versão publica um `SHA256SUMS.txt` com o SHA-256 de cada instalador.
- **Pré-lançamento:** versão com sufixo, como `1.0.0-beta.1`, é publicada marcada como pré-lançamento e não vira a "mais recente".
- Este histórico passou a ficar em ordem, da versão mais nova para a mais antiga, e um teste garante isso.
- O processo está descrito em `docs/versoes.md`.

## 0.2.0 (22/11/2026): instalável e pronta para compartilhar

### Novo

- **Aplicativo de mesa** (Electron) para Windows, macOS e Linux. Sobe o mesmo servidor local numa porta livre e mostra a tela numa janela, com seletor de pasta do sistema e aviso ao fechar no meio de um pedido. Os instaladores são gerados pelo GitHub Actions a cada tag de versão.
- **Comando `muvuca`**: `npx github:Silly-Machine/muvuca` ou `npm start` sobem o servidor e abrem o navegador. Opções `--porta`, `--dados`, `--sem-abrir`.
- **Boas-vindas na primeira abertura**: duas escolhas, quem faz o trabalho (Claude de verdade ou demonstração) e a pasta do projeto, que a Muvuca cria se não existir.
- **O Claude Code já vem configurado.** O provedor `claude-cli` testado faz parte de `agentes.json`; não é mais preciso copiar arquivo à mão.
- **Conferência da versão do `claude`**: a Muvuca compara as opções que usa com a ajuda do aplicativo instalado e, se faltar alguma, diz qual em vez de falhar no meio do pedido. Também avisa quando ele está instalado mas sem login.
- Testes automáticos em Windows, macOS e Linux a cada envio.

### Mudou

- **Seus dados saíram da pasta do aplicativo** e foram para `~/.muvuca` (preferências, projetos, rotinas, memória, times salvos, `agentes.local.json`). Na primeira abertura, o que existia na pasta antiga é copiado. `MUVUCA_DADOS` ou `--dados` trocam o lugar.
- A pasta de projeto de fábrica passou a ser `~/Muvuca/primeiro-projeto` (quem roda do código-fonte com a pasta irmã `teste-estudio` continua nela).
- `MUVUCA_PORTA` escolhe a porta (0 pega uma livre); porta ocupada vira um aviso claro.
- README reescrito; o conteúdo técnico foi para `docs/guia.md`, que a Buzina usa para responder.
- Licença MIT.

### Limitações conhecidas

- Os instaladores não são assinados: Windows e macOS avisam na primeira abertura.
- Sem atualização automática: para atualizar, baixe o instalador novo.
- O pacote ainda não está no npm.

## 0.1.6 (22/11/2026): rodada de testes e publicação

- Rodada de testes antes de publicar: 38 testes automáticos, 177 verificações ao vivo (15 novas, de anexos), a tela no navegador e pedidos com o Claude de verdade. Pela primeira vez exercitados: pedido real com anexo, o botão "Corrigir ressalvas", rotina disparando na hora marcada e arrastar da biblioteca no construtor.
- A conversa diz "Entrega aprovada de primeira." quando não houve devolução, e acerta o plural quando houve.
- `agentes.exemplo-claude.json`: a configuração do aplicativo `claude` que foi testada, pronta para copiar para `agentes.local.json`.
- README com o começo reescrito e a tabela do que foi testado em dia.
- Limitação conhecida: descartar as mudanças não apaga a pasta `anexos/`, porque os anexos são seus, não do time.

## 0.1.5 (22/11/2026): borracha

- **Borracha no construtor**, ao lado de "Desenhar setas". Com ela ligada, um clique numa seta a apaga e um clique num agente o tira do time. O ponteiro vira uma borracha, e o que pode ser apagado fica rosa ao passar o mouse. Esc sai do modo, e Ctrl+Z traz de volta o que foi apagado.

## 0.1.4 (22/11/2026): setas mais fáceis e desfazer

- **Desenhar arrastando.** Com "Desenhar setas" ligado, arraste de um agente até outro: uma linha tracejada segue o ponteiro e a seta nasce ao soltar. Clicar na origem e depois no destino continua valendo.
- **Tirar setas de três jeitos.** Com o modo ligado, cada seta que pode sair mostra um "×". Com o modo desligado, clique na seta para selecioná-la e use a tecla Delete, ou o "×" que aparece. Setas que são da própria arquitetura (todos respondem ao líder, ordem da esteira) não mostram "×", e a tela explica por quê.
- **Desfazer e refazer** no construtor: Ctrl+Z e Ctrl+Y (ou Ctrl+Shift+Z), e os botões ao lado de "Desenhar setas". Vale para setas, agentes adicionados ou removidos, ordem, campos e troca de modelo de time. Até 80 passos. Dentro de um campo de texto, vale o desfazer do próprio campo.

## 0.1.3 (22/11/2026): setas no construtor

- **Desenhar setas na prévia.** O botão "Desenhar setas", em cima da prévia do construtor, liga um modo em que você clica num agente (origem) e depois em outro (destino) para criar a seta, e clica numa seta para tirá-la. Numa seta de mão dupla, cada metade vale pelo sentido que chega naquela ponta. Esc cancela.
- O significado da seta acompanha a arquitetura: na rede é "passa a vez para"; na hierárquica é "chefia"; na esteira é "vem logo depois".
- No supervisor, desenhar uma seta entre dois agentes transforma o time em hierárquico: a origem vira sub-líder. A tela avisa o que mudou.
- O revisor fica fora das setas, e a tela recusa chefia em círculo.

## 0.1.2 (22/11/2026): caixa de pedidos

- **Anexos.** O botão "+" embaixo da caixa de texto adiciona arquivos (Ctrl+U) ou uma pasta inteira. Também dá para arrastar arquivos e pastas para a caixa, ou colar uma imagem. Os anexos vão para `anexos/` dentro da pasta do projeto e o pedido avisa o time de onde estão. Limites: 8 MB por arquivo, 30 MB e 300 arquivos por pedido; `node_modules`, `.git` e `.env` ficam de fora.
- **Projeto e provedor embaixo da caixa de texto.** A pasta do projeto saiu do topo e virou um seletor; do outro lado fica o provedor do time, que leva às Configurações.
- **Caixa de texto maior**, com o botão "Enviar" centralizado ao lado.
- **Conversa retrátil.** Um botão no canto de cima esconde e mostra o painel da conversa; com ele escondido, uma bolinha avisa quando chega mensagem nova. A escolha fica lembrada.
- A versão aparece ao lado do título, e o navegador não guarda mais imagens antigas dos bonecos.

## 0.1.1 (22/11/2026): patch de correções

Correções que saíram dos testes com o Claude de verdade (um projeto de ponta a ponta e um caso real em cada uma das 7 arquiteturas).

### Corrigido

- **Agentes do `claude-cli` agora rodam os testes.** Antes eles escreviam código sem conseguir executar nada, e só a Muvuca testava depois. Agora podem rodar `node --test` e `npm test`; qualquer outro comando continua negado. Vale para `agentes.local.json`.
- **Ressalvas de uma aprovação não somem mais.** Quando o revisor aprova apontando algo menor, a conversa mostra um cartão com as ressalvas e o botão "Corrigir ressalvas", que manda o time corrigir.
- **O revisor sabe quando o resumo das mudanças veio cortado.** Ele recebe a lista de arquivos alterados e um aviso para ler os arquivos completos.
- **Notas da demonstração não entram mais na memória do trabalho real.** Ficam guardadas em separado.
- **O autor de cada arquivo é mantido** quando as mudanças de vários pedidos se acumulam antes da decisão.
- **Fim da "passagem" de um agente para ele mesmo** quando ele tem duas etapas seguidas.
- **Recorte dos bonecos por pedaços ligados.** Um pedaço que invade a coluna do vizinho (cabo da lupa, balão) sai inteiro. Corrige o cabo da Lente trabalhando e o balão da Buzina pensando.
- **Prévia do construtor:** as setas aparecem na hora mesmo com a aba em segundo plano.
- **Buzina:** responde todas as perguntas que ela mesma sugere.

### Novo

- `decisoes.log`: registro de cada "manter" ou "descartar", com data e pasta.
- `apoio/bateria.mjs`: 162 verificações ao vivo em modo demonstração.
- `apoio/arquiteturas-reais.mjs`: um caso real em cada arquitetura, com provedor de verdade.

### Conferido neste patch

- 37 testes automáticos passando.
- Com o Claude de verdade: queda e reinício do servidor com mudança pendente num projeto de 43 arquivos. A pendência voltou e o descarte removeu só o arquivo novo.

### Limitações conhecidas

- Um pedido não pode ser restrito a uma subpasta: para isso, aponte a pasta do projeto direto para a subpasta.
- Memória e modelo escolhido são guardados pelo identificador do agente; um agente com o mesmo identificador em outro time herda os dois.
- O balão de fala cobre o nome do boneco enquanto aparece.
- Sem teste: arrastar e soltar no construtor, rotina disparando na hora marcada e a coluna "Bloqueado" do quadro.

## 0.1.0

Primeira versão: orquestração com líder, subagentes, portão de testes e revisor; construtor de times com 5 arquiteturas; rotinas, quadro de tarefas e memória; escolha de provedor e modelos pela tela; bonecos de pelúcia e a mascote Buzina.
