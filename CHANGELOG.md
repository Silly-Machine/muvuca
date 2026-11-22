# Histórico de mudanças

As versões seguem `maior.menor.correção`, da mais nova para a mais antiga. O que ainda não foi lançado fica em "Em andamento". Como lançar: [docs/versoes.md](docs/versoes.md).

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
