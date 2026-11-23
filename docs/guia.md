# Guia da Muvuca

Referência completa: como cada parte funciona, o que foi testado e o que ficou de fora. Para instalar e dar os primeiros passos, veja o [README](../README.md). A Buzina, mascote da Muvuca, responde perguntas com base neste guia.

## Formas de abrir e onde ficam os seus dados

| Forma | Como | Porta |
|---|---|---|
| Aplicativo de mesa | instalador de Windows, macOS ou Linux | 43170; se estiver ocupada, uma livre |
| Comando `muvuca` | `npx github:Silly-Machine/muvuca` ou `npm start` no código-fonte | 4317 (`--porta` troca) |
| Só o servidor | `node src/servidor.js` | 4317 (`MUVUCA_PORTA` troca; 0 escolhe uma livre) |

Nas três, o servidor atende só em `127.0.0.1`: outra máquina da rede não alcança. Se já houver uma Muvuca aberta com a mesma pasta de dados, o comando e o aplicativo mostram essa em vez de subir outra.

### Acesso

- **Chave.** Na primeira abertura a Muvuca cria `acesso.token` na pasta de dados. A página e a API só respondem a quem tem essa chave. O link que o comando imprime e que o aplicativo abre leva a chave uma vez (`/?t=...`); o navegador recebe um cookie, e a chave sai da barra de endereço.
- **Abrir pelo endereço puro** (`http://localhost:4317`) num navegador que ainda não tem o cookie mostra uma página explicando como entrar.
- **Programas** mandam a chave no cabeçalho `x-muvuca-token`.
- **Endereço conferido.** Pedidos que chegam por outro nome (um site que aponta o próprio domínio para `127.0.0.1`) são recusados.
- **Política de conteúdo.** A página só carrega arquivos do próprio servidor, não pode ser emoldurada por outra e não busca fontes nem nada mais na internet.
- Quem tem acesso à sua conta do computador tem acesso à chave. Ela protege contra outros usuários da máquina e contra páginas da web, não contra um programa rodando como você.

Tudo o que é seu fica na **pasta de dados**, fora da pasta do aplicativo: `~/.muvuca` (no Windows, `C:\Users\voce\.muvuca`). A variável `MUVUCA_DADOS` ou a opção `--dados` trocam o lugar.

| Arquivo | O que guarda |
|---|---|
| `preferencias.json` | pasta padrão, comando de teste, limites, provedor e modelos escolhidos |
| `projetos.json` | a lista de pastas de projeto |
| `rotinas.json` | os pedidos agendados |
| `conexoes.json`, `.mcp/` | as conexões (servidores MCP), quem pode usar cada uma e a configuração entregue a cada agente |
| `memoria/` | as notas de cada agente, por projeto |
| `times/` | os times salvos pelo construtor |
| `agentes.local.json` | provedores extras seus (opcional) |
| `decisoes.log` | registro de cada "manter" ou "descartar" |
| `conversas/` | o histórico: as 100 conversas mais recentes |
| `acesso.token` | a chave de acesso ao servidor local |
| `aberta.json` | aviso de que há uma Muvuca aberta com esta pasta (some ao fechar) |
| `.pendente/` | ponto de restauração de mudanças que esperam decisão |

Quem usava uma versão anterior, com esses arquivos dentro da pasta do aplicativo, tem tudo copiado para a pasta de dados na primeira abertura.

### Primeira abertura

Enquanto as boas-vindas não forem concluídas, a tela abre com duas escolhas:

1. **Quem faz o trabalho.** "Claude de verdade" aparece liberado quando o aplicativo `claude` (Claude Code) está instalado, logado e tem as opções que a Muvuca usa. A conferência das opções é feita contra a ajuda do próprio aplicativo; se faltar alguma, a tela diz qual e pede para atualizar. "Demonstração" está sempre disponível.
2. **Onde o time trabalha.** A pasta do projeto. Se não existir, a Muvuca cria. No aplicativo de mesa há um botão "Escolher…" com o seletor de pastas do sistema.

Da conta do Claude, a Muvuca só pergunta se há login; e-mail e organização não saem do aplicativo `claude`. Para rever a tela, abra o endereço com `?boasvindas` no fim.

## O que o modo demonstração mostra

O roteiro erra de propósito duas vezes, para exercitar o fluxo inteiro:

1. O líder (Maestro) consulta o Scout antes de decidir.
2. Plano: Chevron faz a rota e o teste, Pixel faz a página.
3. **Portão de testes falha** (falta o `uptime`). O trabalho volta para o Chevron.
4. Portão passa. **Revisor reprova** (falta `Cache-Control: no-store`). Volta para o Chevron.
5. Portão passa de novo, revisor aprova.
6. Diff linha a linha, com o autor de cada arquivo. O humano fica com tudo ou descarta tudo.

## Provedores públicos e privados no mesmo time

Cada agente aponta para um provedor em `config/agentes.json`. Três tipos:

| Tipo | Para quê | Exemplos |
|---|---|---|
| `openai` | qualquer API compatível com OpenAI | Groq gratuito, Ollama local, gateway da empresa |
| `cli` | aplicativo de linha de comando logado na assinatura | `claude`, `codex`, `gemini` |
| `demo` | roteiro fixo | testes e demonstração |

`config/agentes.exemplo-misto.json` traz um time misto (líder e Pixel no Groq, Chevron no Claude, Revisor no Codex). Para usar:

```
set GROQ_API_KEY=...            (PowerShell: $env:GROQ_API_KEY="...")
set MUVUCA_CONFIG=agentes.exemplo-misto.json      (nome de um arquivo de config/, ou um caminho completo)
node src/servidor.js
```

## Projetos e configurações

Duas abas na barra lateral, abaixo do construtor:

- **Projetos** (ícone de pasta): a lista de pastas onde o time pode trabalhar, guardada em `projetos.json`, na pasta de dados. Cada cartão mostra se a pasta existe, quantos arquivos tem e quando mudou. "Usar no palco" põe a pasta no campo do palco, e "Tornar padrão" a deixa como padrão. Tirar da lista não apaga a pasta.
- **Configurações** (engrenagem): gravadas em `preferencias.json`, na pasta de dados.
  - Pasta padrão do projeto. A de fábrica é `~/Muvuca/primeiro-projeto`; para quem roda do código-fonte e tem uma pasta irmã `teste-estudio`, é ela.
  - Comando de teste do portão. Em branco, a Muvuca descobre sozinha.
  - Máximo de devoluções do revisor.
  - Máximo de passos por agente.

A variável `MUVUCA_PROJETO`, se definida, vale no lugar da pasta padrão.

Quem não tem um provedor troca o campo `provedor` do agente por outro. A chave nunca vai no arquivo: só o nome da variável de ambiente.

### Modelo por complexidade

O líder marca cada etapa e cada consulta com `"complexidade": "baixa" | "media" | "alta"`, e o provedor troca o modelo conforme o nível:

```json
"claude-cli": { "tipo": "cli", "modelo": "sonnet", "modelos": { "baixa": "haiku", "media": "sonnet", "alta": "fable" } }
```

- **Ordem de escolha:** `agente.modelos[nível]`, depois `agente.modelo` (fixo), depois `provedor.modelos[nível]`, por fim `provedor.modelo`. Assim, um agente com `modelo` próprio (como o Scout em haiku) ignora o mapa do provedor.
- **Consulta sem nível:** fica em `baixa`. **Etapa sem nível ou com nível inválido:** fica em `media`.
- **Devolução sobe um nível.** Quando o portão ou o revisor devolve, quem errou tenta de novo um nível acima: se o haiku não deu conta, a correção vai com o sonnet.
- **Revisão** roda no nível da parte mais difícil do pedido.
- **Líder** usa o modelo padrão do agente ou do provedor. Para planejar com o modelo forte, ponha `"modelo": "fable"` no agente líder.

A tela mostra o modelo em uso embaixo de cada personagem, o nível no plano e em cada devolução, e o modelo usado em cada "concluiu".

## Mapa do código

| Caminho | Linhas | O que faz |
|---|---|---|
| `src/orquestrador.js` | ~480 | o protocolo: planejar (inclusive sub-líder), esteira, rede, consultar, executar, portão, revisar, devolver; quadro e memória |
| `src/servidor.js` | ~440 | HTTP local, fluxo de eventos, API da tela, rotinas, boas-vindas |
| `src/ferramentas.js` | ~230 | listar, ler, escrever, rodar; foto do projeto, diff, restauração |
| `src/provedores.js` | ~90 | os três tipos de provedor atrás de uma função só |
| `src/times.js` | ~110 | o validador do construtor: regras de cada arquitetura |
| `src/demo.js` | ~190 | o roteiro da demonstração, mais líder e executor genéricos para times do construtor |
| `src/aberta.js` | ~20 | descobre se já há uma Muvuca aberta com a mesma pasta de dados |
| `src/isolamento.js` | ~110 | isolamento dos testes: sonda o Node, monta o ambiente restrito e decide o que dá para isolar |
| `src/conexoes.js` | ~200 | conexões (servidores MCP): validação, configuração sem segredos e teste de conexão |
| `src/ajustes.js`, `memoria.js`, `rotinas.js`, `buzina.js` | ~240 | preferências e anexos, notas dos agentes, agendamento, guia da mascote |
| `public/index.html` | ~230 | a estrutura da página, sem framework |
| `public/css/` | ~520 | `fontes.css`, `estilo.css` (estrutura) e `tema.css` (tema pelúcia) |
| `public/fontes/` | 5 arquivos | Fredoka e Nunito, servidas daqui (licença OFL na mesma pasta) |
| `public/js/` | ~1700 | um módulo por parte da tela, carregados em ordem por `principal.js`: base, personagens, palco, construtor, conversa, buzina, quadro, abas, conexoes, historico, abertas, inicio. `estado.js` guarda o que mais de uma parte altera; `tardias.js`, as chamadas a partes carregadas depois |
| `public/js/regras/` | ~110 | lógica sem tela, com testes: regras das setas e histórico do desfazer |
| `public/bonecos/` | 85 imagens | os personagens, 17 formas em 5 estados |
| `config/agentes.json` | | o time de fábrica e os provedores (demonstração e `claude-cli`) |
| `config/catalogo-agentes.json` | | a biblioteca de agentes básicos do construtor |
| `config/arquiteturas/` | 7 arquivos | os modelos prontos de time |
| `bin/muvuca.js` | ~50 | o comando `muvuca`: sobe o servidor e abre o navegador |
| `electron/` | ~110 | o aplicativo de mesa: janela, seletor de pasta, ícone |
| `test/` | 13 arquivos | 93 testes automáticos; `test/apoio/` tem os aplicativos e o servidor MCP falsos e o apoio que sobe um servidor de teste |
| `scripts/` | | `versao.mjs` (lançar versões), `bateria.mjs` e `arquiteturas-reais.mjs` (testes ao vivo) |
| `assets/personagens/` | | fontes dos personagens e os scripts que geram `public/bonecos/` |

O servidor não tem dependências. `electron` e `electron-builder` são dependências só de desenvolvimento, usadas para o aplicativo de mesa.

## Construtor de times e arquiteturas

O terceiro ícone da barra lateral abre o construtor. Você parte de um modelo, edita os agentes e vê a prévia em grafo com os mesmos personagens do palco. Depois há duas saídas: "Salvar e pôr no palco" (grava em `times/`) ou "Só pôr no palco".

| Arquitetura | Como roda | Modelo pronto |
|---|---|---|
| agente único | Um agente com todas as ferramentas faz tudo; o portão ainda confere. Serve de linha de base para ver se a coordenação compensa. | Agente único (Solo) |
| centralizada (supervisor) | Um líder planeja e distribui; todos respondem a ele. | Time centralizado (Maestro e os quatro) |
| hierárquica | O líder divide o pedido entre sub-líderes. Cada sub-líder planeja para o próprio time, com sessão própria. | Estúdio hierárquico (Diretora → Torre e Prisma → quatro executores) |
| sequencial (esteira) | Sem líder. Cada agente faz a sua etapa, na ordem da lista, sabendo quem vem antes e depois. | Esteira de produção (Analista → Chevron → Testador → Documentador); Dupla com revisão |
| rede | Sem chefe nem plano. O primeiro da lista começa. Cada um faz a sua parte e termina com `{"proximo":"id ou fim"}`, escolhendo entre os vizinhos dele quem continua. Passar para quem não é vizinho encerra a rede. Um teto de passagens (`maxPassagens`, padrão: o dobro de membros, no máximo 12) evita ping-pong. Na tela, é um anel. | Rede completa (todos com todos); Rede personalizada (conexões escolhidas no editor, em "Pode passar a vez para") |

Em todas, o portão de testes e o revisor fecham o ciclo, e a devolução sobe o nível de complexidade.

**Montar arrastando:**
- **Biblioteca de agentes básicos** (`config/catalogo-agentes.json`): 14 agentes, cada um com um boneco diferente. São eles Líder, Sub-líder, Back-end, Front-end, Dados, Testes, Docs, UX, Produto, DevOps, Segurança, Pesquisa, Generalista e Revisor.
- **Adicionar:** clique numa peça ou arraste para a prévia. A função se ajusta à arquitetura: um líder numa esteira vira executor, e o segundo líder numa hierarquia vira sub-líder.
- **Soltar sobre um agente:**
  - na hierarquia, se o agente for líder ou sub-líder, o novo entra no time dele;
  - na rede, o novo já entra ligado a ele.
- **Arrastar um agente da prévia sobre outro:**
  - na hierarquia, muda o chefe (o validador recusa chefia em ciclo);
  - na rede, liga ou desliga a passagem de vez;
  - na esteira e no supervisor, muda a ordem.
- **Lixeira:** remove o agente. **Clique num boneco da prévia:** abre o cartão dele.

**Galeria:** cada modelo mostra um desenho da arquitetura feito a partir da estrutura real do time: um ponto (agente único), estrela (supervisor), pirâmide (hierárquica), linha de pontos (esteira) ou anel (rede). O revisor aparece tracejado.

**Bonecos:** 16 formas, todas em SVG, desenhadas por código e com as mesmas animações de estado: maestro de cartola (líder), engrenagem (back-end), cápsula de batuta (sub-líder), pilha de discos (dados), cristal, esfera de lente, escudo de óculos, monitor de antena, gota, nuvem, cogumelo, polvo, foguete, gato vigia, livro e vaso de planta.

**O que se edita em cada agente:**
- nome, id, função (executor, líder, sub-líder, revisor) e a quem responde;
- papel (é o que o líder lê para escolher), personagem e cor;
- provedor e modelo fixo;
- nível fixo de complexidade (vence a escolha do líder; na esteira, é o nível da etapa);
- ferramentas e instruções.

**Regras de validação** (`times.js`; a tela avisa, mas quem decide é o servidor):
- Liderança: exatamente um líder, exceto na esteira, que não tem líder. Sub-líder só existe na hierárquica e precisa de alguém no time dele. Toda cadeia de chefia chega ao líder. Líder e sub-líder não recebem ferramentas.
- Revisor: no máximo um, e ele só lê.
- Execução: pelo menos um executor que escreve.

**Troca de time e arquivos salvos:**
- A troca é recusada com pedido rodando ou com mudança esperando decisão.
- O time salvo só grava o provedor de quem teve um escolhido de propósito. Assim, ele roda com qualquer configuração.
- Ao reiniciar o servidor, volta o time do arquivo de configuração. O "Time do arquivo" fica sempre na galeria.

Fora por enquanto: rede em que vários agentes trabalham ao mesmo tempo (hoje é um de cada vez, passando a vez) e a edição de provedores pela tela. As chaves continuam só em variável de ambiente.

## O que foi testado e o que não foi

| Item | Situação |
|---|---|
| Fluxo v3 completo, devoluções, limite de ciclos | testado (automático) |
| Descartar restaura a pasta, inclusive arquivo que já existia | testado |
| Parar no meio e ainda entregar o diff | testado |
| Confinamento à pasta, `.env` protegido, comando perigoso pede aprovação | testado |
| Provedor `openai`: ferramentas, chave, nova tentativa após 429 | testado contra um servidor falso local |
| Provedor `cli`: prompt pela entrada padrão, contagem de passos | testado contra um CLI falso |
| Time misto no mesmo pedido | testado com os falsos |
| Tela no navegador | conferida no Chrome, Linux e Windows |
| **Groq, Ollama ou gateway de verdade** | **não testado** (o ambiente de preparação não tem rede para eles) |
| `claude` de verdade (2.1.284, Windows) | testado: pedidos reais, um projeto de ponta a ponta e um caso em cada arquitetura, com as opções do provedor `claude-cli` de `agentes.json` |
| **`codex`, `gemini` de verdade** | **não testado**; as opções em `config/agentes.exemplo-misto.json` vieram de documentação e de guias |
| Windows 11 | testado: é onde o projeto roda desde a versão 0.1.0 |
| Cartão de aprovação na tela | não exercitado no navegador (o roteiro da demonstração não pede comando perigoso) |

## Problemas encontrados na reconstrução

Os cinco primeiros apareceram de verdade enquanto eu construía. Os demais são riscos que o código já mostra e que ainda precisam de teste com modelo real.

**Já aconteceram aqui**

1. **O portão mentiu.** Um `node --test` disparado de dentro de outro `node --test` herda a variável `NODE_TEST_CONTEXT` e sai com código 0 mesmo com teste falhando. O portão aprovou código quebrado. Só apareceu porque havia um teste esperando a falha. Corrigido em `ferramentas.js` (`ambienteLimpo`). É o melhor caso da semana para "o juiz precisa ser testado".
2. **`node --test` roda tudo que está em `test/`.** Um arquivo de apoio dentro da pasta foi executado como teste, ficou esperando a entrada padrão e travou a suíte por mais de 2 minutos. No projeto do aluno o portão vai fazer o mesmo com qualquer arquivo solto em `test/`.
3. **`node --test test/` quebra no Node 22** (interpreta como arquivo). O comando usado é `node --test "test/*.test.js"` (o `npm test`): o padrão de nomes também deixa de fora os arquivos de `test/apoio/`.
4. **Descartar deixava pastas vazias** para trás. Corrigido.
5. **A demonstração só funciona porque o caminho é o mesmo dos provedores reais.** Na primeira versão do desenho o roteiro falso pulava o laço de ferramentas; teria escondido todos os problemas acima.

**Riscos que os alunos vão encontrar**

6. **JSON do líder e do revisor.** Modelo pequeno devolve texto em volta do JSON, ou JSON inválido. O protótipo extrai com tolerância, tenta de novo uma vez e cai num plano de reserva (um agente faz tudo). Sem isso o pedido morre na primeira resposta torta. Veredito ilegível conta como reprovação.
7. **Limite de tokens por minuto.** Um pedido completo faz de 10 a 15 chamadas. Com 8 mil tokens por minuto no Groq gratuito, um time inteiro numa chave só vai bater 429. O protótipo espera e tenta de novo (até 4 vezes), mas a aula fica lenta: uma chave por grupo e modelo pequeno para Scout e consultas.
8. **CLIs no Windows.** Os aplicativos instalados pelo npm são arquivos `.cmd` e só rodam com shell. Passar o prompt como argumento com shell ligado é receita de quebra (aspas, acento, quebra de linha) e de injeção de comando. O protótipo manda o prompt pela entrada padrão. Falta confirmar que os três CLIs aceitam isso.
9. **Parar de verdade.** No Windows, matar o processo do shell não mata o CLI filho; é preciso `taskkill /T`. Está no código, não foi testado.
10. **Agente CLI não passa pelas nossas ferramentas.** Ele edita a pasta por conta própria: o confinamento, a proteção do `.env` e o pedido de aprovação do protótipo **não valem para ele**. A segurança depende das opções do próprio CLI (por isso o exemplo tira o Bash do Claude e usa sandbox de leitura no Codex para o revisor). É o assunto da quinta-feira.
11. **Autoria por foto da pasta.** Para saber quem mexeu em quê, o protótipo compara a pasta antes e depois de cada etapa. Funciona em sequência; com dois agentes em paralelo na mesma pasta não dá para saber quem editou. Paralelo de verdade pede uma pasta por agente (worktree), como no plano da S6.
12. **Para quem volta o erro.** O portão devolve para o autor do arquivo citado na saída do teste; se nenhum for citado, para o último que editou. É uma heurística e vai errar (por exemplo, teste do Chevron quebrando por causa da tela do Pixel).
13. **Sem teste, não passa.** Projeto sem nenhum teste é reprovado no portão e volta para o autor escrever um. Com modelo fraco isso pode consumir os 3 ciclos e terminar "não aprovado". É o comportamento certo, mas a turma vai estranhar.
14. **O líder acumula contexto.** A sessão contínua guarda todos os pedidos e resultados; não há compactação. Em conversa longa estoura a janela (gancho com a S2).
15. **Custo.** Cada devolução é mais uma rodada de agente, mais um portão e mais uma revisão. O limite de 3 ciclos existe para isso.
16. **Tudo ou nada no fim.** O humano fica com tudo ou descarta tudo; o original deixa escolher. Aceitar por arquivo é uma boa fatia bônus.
17. **Servidor local aberto ao navegador.** Qualquer site aberto na máquina poderia tentar mandar um pedido para `localhost:4317`. O protótipo recusa origem estranha e exige JSON, mas não tem senha. Não expor em rede.

## O que ficou de fora (de propósito)

Mascotes 3D e escritório, voz, copiloto de tela, criação de agente pelo painel, medidor de limite das assinaturas, histórico em disco, app desktop. Nada disso muda o protocolo; são fatias bônus para os grupos.

## Personagens e tela

Os cinco personagens são originais (não são os mascotes de marca do vídeo): Maestro é um líder de cartola com gravata-borboleta e batuta, Chevron é uma engrenagem (os dentes giram, mais rápido quando trabalha), Pixel é um cristal lapidado, Scout é uma esfera com olho de lente e Revisor é um escudo de óculos. São SVG desenhados por código em `public/index.html` (objeto `PERSONAGENS`), coloridos a partir do campo `cor` de cada agente; o campo `forma` escolhe o personagem.

Cada estado tem expressão e animação próprias: disponível (respira e pisca), pensando (inclina, olha para cima, bolha de três pontos), trabalhando (olhos de foco, notebook, mãos e pés batucando), concluído (pulo, olhos felizes, estrelinhas) e aguardando aprovação (olhos arregalados, tremida, alerta). O holofote acende em quem está ativo e os demais escurecem.

Para ver os estados sem rodar nada: `http://localhost:4317/?vitrine=disponivel,pensando,trabalhando,concluido,aguardando`.

O time aparece como grafo de hierarquia. O líder fica em cima; embaixo vêm quem executa, quem só é consultado e o revisor, ligados ao líder por arestas com a relação escrita ("executa", "consulta", "revisa", esta tracejada). A aresta de quem está ativo acende na cor do agente e corre. Cada passagem vira uma bolinha na cor de quem manda:

- **Do líder para baixo:** o plano e as consultas descem pela aresta.
- **De volta ao líder:** as respostas e o veredito sobem pela aresta.
- **Entre colegas:** a passagem faz um arco por cima.
- **Devoluções:** vão em vermelho. A do portão de testes faz piscar em vermelho a aresta de quem errou.

As arestas são calculadas a partir da posição dos personagens e se redesenham quando a janela muda de tamanho.

O ícone de pessoas na barra lateral abre as fichas do time (papel, a quem responde, provedor, modelo por complexidade e o que cada agente pode fazer).

## Proteções e avisos da tela

- **Decisão pendente não se perde.** Quando o time muda arquivos, o ponto de restauração do "Descartar" fica guardado em `.pendente/`. Se o servidor cair ou for reiniciado, a decisão volta a aparecer ao subir.
- **Uma pasta por vez.** Com mudanças esperando decisão numa pasta, a Muvuca recusa pedidos em outra. Sem isso, "Descartar" restauraria os arquivos de um projeto dentro do outro.
- **Faixa de decisão.** Enquanto houver mudanças pendentes, a caixa de entrada mostra "Ver", "Manter" e "Descartar".
- **Faixa de andamento.** Durante um pedido, a caixa de entrada mostra quem está trabalhando e há quanto tempo. O título da aba ganha `●` (rodando), `⚠` (um agente espera sua aprovação) ou `✓` (terminou com a aba em segundo plano).
- **Pedido recusado não apaga o texto.** Pasta inexistente, agente inexistente ou servidor fora do ar aparecem como erro embaixo da caixa, e o que você digitou fica.
- **Reconexão sem repetição.** Se a conexão com o servidor cair e voltar, a conversa não aparece duplicada.
- O comando de teste do portão vem só das Configurações: a API de pedido não aceita mais um comando arbitrário.

## Rotinas, quadro de tarefas e memória

Três ideias adaptadas do Grok Bot (xAI) para um app local:

- **Rotinas** (ícone de relógio): um pedido que o time recebe sozinho em dias e hora marcados. Ficam em `rotinas.json`. Disparam só com a Muvuca rodando e até 10 minutos depois da hora, uma vez por dia; com o time ocupado, esperam dentro dessa janela. "Rodar agora" dispara na hora. Cada rotina guarda quando rodou por último e o resultado.
- **Quadro de tarefas** (ícone de colunas): cada etapa do pedido vira um cartão em A fazer, Trabalhando, Bloqueado, Em revisão ou Encerrado (pronto, não aprovado ou parado). "Bloqueado" é o agente esperando você aprovar um comando; o ícone da aba mostra quantos estão assim. Correções pedidas pelo portão ou pelo revisor viram cartões próprios.
- **Memória por agente** (aba Agentes): notas curtas por projeto, em `memoria/`, fora da pasta do projeto. O agente as recebe no começo de cada trabalho. Uma nota nasce de duas formas: o agente termina a resposta com `LEMBRAR: ...`, ou o revisor reprova algo dele. No máximo 20 notas por agente e projeto; dá para apagar cada uma na ficha do agente. Líder e sub-líder não guardam notas.

## O que o "Descartar" cobre

Ao começar um pedido, a Muvuca tira uma foto da pasta do projeto. "Descartar" devolve a pasta a essa foto.

| O quê | Coberto? |
|---|---|
| Arquivos do projeto, incluindo `dist/` e `build/` | sim, até 25 MB por arquivo e 400 MB no total |
| Arquivo maior que 25 MB que foi alterado | não: aparece no diff marcado "não dá para restaurar" |
| Arquivo novo, de qualquer tamanho | sim: é apagado |
| `node_modules/`, `.git/`, `__pycache__/`, `.venv/`, `venv/` | não: se algo mudar no primeiro nível dessas pastas, a tela avisa |
| Projeto com mais de 20.000 arquivos | só os primeiros 20.000, com aviso |
| O que uma conexão (MCP) fez fora da pasta | não |
| Anexos mandados com o pedido descartado | sim: saem junto |

Quando há algo que o descarte não desfaz, o cartão do diff mostra um aviso antes dos botões.

## Isolamento dos testes

O código de teste que um agente escreve é código como outro qualquer, e roda no seu computador. Com o isolamento (ligado de fábrica, em Configurações), o processo dos testes:

| O quê | Com isolamento |
|---|---|
| Ler e escrever dentro da pasta do projeto | sim |
| Criar arquivos temporários (`os.tmpdir()`) | sim, numa pasta criada para aquela execução e apagada depois |
| Ler ou escrever em qualquer outro lugar (sua pasta de usuário, outros projetos) | não: `ERR_ACCESS_DENIED` |
| Abrir outro processo | não |
| Subir um servidor no mesmo processo e chamá-lo | sim |
| Acessar a rede | sim: o Node não restringe, e por isso a leitura fora da pasta é bloqueada |

Como funciona: o isolamento usa o modelo de permissões do próprio Node (`--permission`), passado pela variável `NODE_OPTIONS`. Uma sonda, na primeira vez, confere que o Node instalado aceita as opções e que elas de fato bloqueiam; se não, a tela diz que o isolamento está indisponível e por quê (é preciso o Node 24 ou mais novo).

- **No portão**, vale para `node --test`, direto ou quando é isso que o `npm test` do projeto chama. Qualquer outro comando (pytest, jest, um script composto) roda como antes, e o cartão do portão diz "Sem isolamento" com o motivo.
- **Nos testes que o próprio agente roda**, com o Claude Code: o agente recebe o mesmo ambiente, e a permissão dele vira o comando exato `node --test`. Sem isso, uma opção a mais na linha de comando reabriria tudo.
- **Aplicativo de provedor feito em Node** (instalado pelo npm) não sobe com essas opções. A Muvuca sonda isso; se for o caso, os testes que o agente roda por ele ficam sem isolamento, a conversa avisa, e o portão continua isolado.
- **Teste bloqueado** falha com uma explicação no lugar do erro cru, dizendo como escrever o teste ou como desligar o isolamento.

Testes que abrem outro processo (subir o servidor do projeto com `spawn`, por exemplo) não passam com o isolamento ligado. O caminho é subir o servidor no mesmo processo; os agentes são instruídos a escrever assim.

## Conversas abertas: vários pedidos ao mesmo tempo

A faixa no topo, abaixo do título, mostra as conversas abertas. "+ outra conversa" abre mais uma, até quatro.

- **Cada conversa é independente**: time, pasta do projeto, pedidos, quadro e mudanças esperando decisão. Trocar o time de uma não muda o da outra.
- **Elas trabalham ao mesmo tempo.** O ponto ao lado do nome pisca enquanto a conversa trabalha e fica laranja quando há mudanças esperando decisão.
- **Uma pasta, uma conversa.** Duas conversas não trabalham na mesma pasta, nem enquanto uma tem mudanças pendentes nela: o diff e o "Descartar" de uma atropelariam a outra. O pedido é recusado dizendo qual conversa está com a pasta.
- **Trocar de conversa** recarrega a página no endereço dela (`?conversa=2`). Dá para abrir cada uma numa janela.
- **Fechar** (o "×") manda a conversa para o histórico. Só fecha parada e sem decisão pendente; a principal não fecha.
- **Preferências e conexões valem para todas**, e só mudam com todas paradas.
- Se a Muvuca fechar com mudanças pendentes numa conversa extra, ela reaparece na próxima abertura.

Rotinas disparam sempre na conversa principal.

## Histórico, uso e limites de tempo

- **Histórico.** Ao clicar em "Nova conversa", a conversa que termina vai para o histórico (botão "Histórico", no topo da conversa). Ficam as 100 mais recentes, com os acontecimentos e a lista de arquivos alterados, sem o diff linha a linha.
- **Uso.** Cada pedido termina com uma linha: tempo total e número de chamadas ao provedor. Com o Claude Code aparecem também os tokens e o custo pela tabela da API, que o próprio aplicativo informa. Na assinatura não há cobrança por pedido: o número serve de comparação.
- **Limites de tempo.** Em Configurações: quanto cada agente pode levar por vez (de fábrica, 10 minutos) e quanto os testes podem levar (3 minutos).
- **Ao fechar a Muvuca**, o que ela subiu (o aplicativo do provedor, os testes) é encerrado junto.

## Conexões (servidores MCP)

A aba **Conexões** (ícone de tomada) dá aos agentes acesso a coisas fora da pasta do projeto: documentação atualizada, issues, um banco de dados. Cada conexão é um servidor MCP.

- **Dois tipos.** "Comando neste computador" sobe o servidor por uma linha de comando (por exemplo `npx -y nome-do-servidor`). "Endereço na rede" fala com um servidor HTTP.
- **Testar.** O botão sobe o servidor, pede a lista de ferramentas e encerra. Dá para testar antes de criar.
- **Quem pode usar.** Cada agente só recebe as conexões marcadas para ele. De fábrica, nenhuma.
- **Ferramentas liberadas.** Em branco, o agente pode usar todas as ferramentas do servidor. Com uma lista de nomes, só essas: útil num servidor grande, para deixar só as de consulta.
- **Só agentes que não escrevem arquivos** (líder, pesquisa, revisor). O que um agente faz por uma conexão acontece fora da pasta e **não é desfeito pelo "Descartar"**; por isso quem escreve código fica sem. Na tela, esses agentes aparecem bloqueados, com o motivo.
- **Só com o Claude Code.** O provedor precisa declarar como recebe conexões (campo `argsMcp` em `config/agentes.json`; o `claude-cli` já traz). Em demonstração e nos provedores por API, as conexões não são usadas.
- **Nenhum token é gravado.** Servidor que precisa de chave recebe só o **nome** de uma variável de ambiente; o valor você define no sistema antes de abrir a Muvuca. A tela recusa o que parece ser um valor. Conexão com variável faltando fica de fora do pedido, e a lista avisa qual falta.
- **Na conversa**, cada uso aparece como "Scout usou a conexão cofre: senha_do_dia".
- As conexões ficam em `conexoes.json`, na pasta de dados. A configuração que cada agente recebe é gravada em `.mcp/`, na mesma pasta, só com referências às variáveis.

Um comando de conexão roda neste computador com as suas permissões. Crie conexões só com servidores em que você confia.

Como funciona por baixo: a Muvuca chama o `claude` com `--strict-mcp-config` (ele ignora qualquer servidor configurado na sua máquina), entrega só as conexões do agente (`--mcp-config`) e libera só as ferramentas delas (`--allowedTools`). Conferido com o `claude` 2.1.284: com a permissão, o agente consultou a conexão; sem ela, a chamada foi negada.

Ficou de fora: aprovação ação por ação, conexões para quem escreve código, e suporte nos provedores por API.

## Buzina, a mascote (easter egg)

A Muvuca tem uma mascote escondida: a Buzina, uma salsicha astronauta. Para soltá-la, clique cinco vezes seguidas no logo, ou digite `buzina` em qualquer lugar da página. Repetir os cinco cliques a guarda de novo.

- Ela fica no canto de cima, ao lado do título, e acompanha o humor do time: pensa, trabalha, comemora a entrega aprovada e fica alerta quando algo espera você.
- Clicar nela abre uma conversa sobre o funcionamento da própria Muvuca. Com um provedor de verdade no time, quem responde é o modelo leve dele, usando este guia como guia. No modo demonstração (ou se o modelo falhar), responde o guia embutido em `buzina.js`, sem rede. Ela só explica: não executa nada nem mexe em arquivos.
- No construtor, ela aparece na biblioteca como um agente faz-tudo que pode entrar em qualquer time.
- As imagens estão em `public/bonecos/salsicha-*.webp`, recortadas de `assets/personagens/plush/gpt/buzina_mascote_5_estados.png`.

## Escolha de modelos pela tela

Em **Configurações > Modelos do time** dá para trocar quem responde pelos agentes sem reiniciar o servidor nem editar arquivo.

- A lista junta os provedores de `config/agentes.json` (que já traz o `claude-cli` testado) e os de `agentes.local.json`, na pasta de dados, e diz quais estão prontos. Um aplicativo de linha de comando precisa estar instalado; uma API precisa da variável de ambiente da chave e de endereço e modelo preenchidos.
- Três campos definem o modelo por nível de tarefa: simples, comum e difícil. Em branco, vale o modelo padrão do provedor.
- "Usar no time inteiro" troca todos os agentes do time atual. Agente com modelo fixo de outro provedor perde o fixo. A escolha fica em `preferencias.json` e volta ao subir o servidor.
- Para um agente só, o construtor continua tendo os campos "Provedor" e "Modelo fixo".

### Modelo padrão de cada agente

Cada papel já vem com um modelo padrão, dito como nível (o provedor traduz o nível no modelo dele):

| Papel | Padrão | Com o `claude-cli` |
|---|---|---|
| Líder e sub-líder | tarefa comum | sonnet |
| Revisor | tarefa difícil | fable |
| Quem só consulta (não escreve arquivo) | tarefa simples | haiku |
| Quem escreve código | o líder decide por tarefa | haiku, sonnet ou fable |

Em **Configurações > Modelo de cada agente** dá para trocar o de qualquer agente: um dos três modelos, "automático" ou de volta ao padrão do papel. A escolha vale na hora e fica em `preferencias.json`. Quando um trabalho é devolvido por teste ou revisão, a correção ainda sobe um nível, mesmo com modelo escolhido.

## Bateria de testes

Dois níveis, os dois sem gastar modelo de verdade:

- `npm test`: 93 testes (orquestração, arquiteturas, memória, rotinas, quadro, modelos, Buzina, anexos, instalação, versões, regras e estrutura da tela, conexões, acesso, o que o Descartar cobre, isolamento dos testes e conversas paralelas). Os de instalação sobem um servidor de verdade numa porta livre, com pasta de dados temporária.
- `npm run bateria` (`scripts/bateria.mjs`), com a Muvuca rodando em demonstração: 225 verificações ao vivo, rota por rota. Só trabalha na pasta padrão `teste-estudio`, que precisa estar vazia, e devolve tudo ao estado inicial. O resultado fica em `apoio/bateria-resultado.json`.

### Arquiteturas com casos reais

`node scripts/arquiteturas-reais.mjs`, com a Muvuca rodando e o time num provedor de verdade, roda um caso real em cada uma das 7 arquiteturas prontas, cada um numa subpasta de `casos/` na pasta padrão. Gasta modelo de verdade. O resultado fica em `apoio/arquiteturas-reais-resultado.json`. Passe números para rodar só alguns casos, por exemplo `node apoio/arquiteturas-reais.mjs 1 3`.
