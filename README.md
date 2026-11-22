# Muvuca

Painel local para trabalhar com um time de agentes de IA: um líder planeja, especialistas executam como subagentes, um portão de testes confere e um revisor aprova ou devolve. No fim você vê o diff, com o autor de cada arquivo, e decide se mantém ou descarta tudo.

Node puro, sem dependências. Nasceu como "Estúdio v3", um protótipo de 21/11/2026 para preparar aulas, e continua sendo protótipo: leia "O que foi testado e o que não foi" antes de confiar nele.

Nota do autor: serve também de gabarito do professor para a turma (S6, 23 a 26/11). Não é para distribuir aos alunos antes das disputas.

## Rodar

Precisa só de Node 20 ou mais novo. Sem `npm install`.

```
node servidor.js
```

Abrir http://localhost:4317 e enviar um pedido. A pasta do projeto aparece embaixo da caixa de texto; a de fábrica é uma pasta irmã chamada `teste-estudio` (crie-a vazia). Sai rodando em modo demonstração, sem rede e sem chave.

Para usar o Claude de verdade pelo aplicativo `claude` logado: copie `agentes.exemplo-claude.json` para `agentes.local.json`, reinicie e escolha "claude-cli" em Configurações. Arquivos desta máquina (`agentes.local.json`, `preferencias.json`, `projetos.json`, `rotinas.json`, `memoria/`, `decisoes.log`) ficam fora do repositório.

Testes: `npm test` (38 testes, cerca de 1 minuto). Com o servidor ligado em demonstração e a pasta de teste vazia, `node apoio/bateria.mjs` faz 177 verificações ao vivo.

## O que o modo demonstração mostra

O roteiro erra de propósito duas vezes, para exercitar o fluxo inteiro:

1. O líder (Maestro) consulta o Scout antes de decidir.
2. Plano: Chevron faz a rota e o teste, Pixel faz a página.
3. **Portão de testes falha** (falta o `uptime`). O trabalho volta para o Chevron.
4. Portão passa. **Revisor reprova** (falta `Cache-Control: no-store`). Volta para o Chevron.
5. Portão passa de novo, revisor aprova.
6. Diff linha a linha, com o autor de cada arquivo. O humano fica com tudo ou descarta tudo.

## Provedores públicos e privados no mesmo time

Cada agente aponta para um provedor em `agentes.json`. Três tipos:

| Tipo | Para quê | Exemplos |
|---|---|---|
| `openai` | qualquer API compatível com OpenAI | Groq gratuito, Ollama local, gateway da empresa |
| `cli` | aplicativo de linha de comando logado na assinatura | `claude`, `codex`, `gemini` |
| `demo` | roteiro fixo | testes e demonstração |

`agentes.exemplo-misto.json` traz um time misto (líder e Pixel no Groq, Chevron no Claude, Revisor no Codex). Para usar:

```
set GROQ_API_KEY=...            (PowerShell: $env:GROQ_API_KEY="...")
set MUVUCA_CONFIG=agentes.exemplo-misto.json      (o nome antigo ESTUDIO_CONFIG também funciona)
node servidor.js
```

## Projetos e configurações

Duas abas na barra lateral, abaixo do construtor:

- **Projetos** (ícone de pasta): a lista de pastas onde o time pode trabalhar, guardada em `projetos.json`. Cada cartão mostra se a pasta existe, quantos arquivos tem e quando mudou. "Usar no palco" põe a pasta no campo do palco, e "Tornar padrão" a deixa como padrão. Tirar da lista não apaga a pasta.
- **Configurações** (engrenagem): gravadas em `preferencias.json`.
  - Pasta padrão do projeto. A de fábrica é a irmã `teste-estudio`, ao lado da pasta da Muvuca.
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

| Arquivo | Linhas | O que faz |
|---|---|---|
| `orquestrador.js` | ~340 | o protocolo v3: planejar (inclusive sub-líder), esteira, consultar, executar, portão, revisar, devolver |
| `times.js` | ~90 | o validador do construtor: regras de cada arquitetura |
| `arquiteturas/` | 4 arquivos | os modelos prontos de time |
| `times/` | criada ao salvar | os times salvos pelo construtor |
| `provedores.js` | ~100 | os três tipos de provedor atrás de uma função só |
| `ferramentas.js` | ~210 | listar, ler, escrever, rodar; foto do projeto, diff, restauração |
| `demo.js` | ~180 | o roteiro da demonstração, mais líder e executor genéricos para times do construtor |
| `servidor.js` | ~110 | HTTP local, fluxo de eventos e API do construtor |
| `public/index.html` | ~830 | a tela inteira, sem framework: palco em grafo, fichas, construtor |
| `test/*.test.js` | ~310 | 18 testes: fluxo, complexidade e times |

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
- **Biblioteca de agentes básicos** (`catalogo-agentes.json`): 14 agentes, cada um com um boneco diferente. São eles Líder, Sub-líder, Back-end, Front-end, Dados, Testes, Docs, UX, Produto, DevOps, Segurança, Pesquisa, Generalista e Revisor.
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
| `claude` de verdade (2.1.284, Windows) | testado: pedidos reais, um projeto de ponta a ponta e um caso em cada arquitetura, com as opções de `agentes.exemplo-claude.json` |
| **`codex`, `gemini` de verdade** | **não testado**; as opções em `agentes.exemplo-misto.json` vieram de documentação e de guias |
| Windows 11 | testado: é onde o projeto roda desde a versão 0.1.0 |
| Cartão de aprovação na tela | não exercitado no navegador (o roteiro da demonstração não pede comando perigoso) |

## Problemas encontrados na reconstrução

Os cinco primeiros apareceram de verdade enquanto eu construía. Os demais são riscos que o código já mostra e que ainda precisam de teste com modelo real.

**Já aconteceram aqui**

1. **O portão mentiu.** Um `node --test` disparado de dentro de outro `node --test` herda a variável `NODE_TEST_CONTEXT` e sai com código 0 mesmo com teste falhando. O portão aprovou código quebrado. Só apareceu porque havia um teste esperando a falha. Corrigido em `ferramentas.js` (`ambienteLimpo`). É o melhor caso da semana para "o juiz precisa ser testado".
2. **`node --test` roda tudo que está em `test/`.** Um arquivo de apoio dentro da pasta foi executado como teste, ficou esperando a entrada padrão e travou a suíte por mais de 2 minutos. No projeto do aluno o portão vai fazer o mesmo com qualquer arquivo solto em `test/`.
3. **`node --test test/` quebra no Node 22** (interpreta como arquivo). O comando portátil é `node --test`, sem argumento.
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

## Buzina, a mascote (easter egg)

A Muvuca tem uma mascote escondida: a Buzina, uma salsicha astronauta. Para soltá-la, clique cinco vezes seguidas no logo, ou digite `buzina` em qualquer lugar da página. Repetir os cinco cliques a guarda de novo.

- Ela fica no canto de cima, ao lado do título, e acompanha o humor do time: pensa, trabalha, comemora a entrega aprovada e fica alerta quando algo espera você.
- Clicar nela abre uma conversa sobre o funcionamento da própria Muvuca. Com um provedor de verdade no time, quem responde é o modelo leve dele, usando este README como guia. No modo demonstração (ou se o modelo falhar), responde o guia embutido em `buzina.js`, sem rede. Ela só explica: não executa nada nem mexe em arquivos.
- No construtor, ela aparece na biblioteca como um agente faz-tudo que pode entrar em qualquer time.
- As imagens estão em `public/bonecos/salsicha-*.webp`, recortadas de `sprites/plush/gpt/buzina_mascote_5_estados.png`.

## Escolha de modelos pela tela

Em **Configurações > Modelos do time** dá para trocar quem responde pelos agentes sem reiniciar o servidor nem editar arquivo.

- A lista junta os provedores de `agentes.json` e de `agentes.local.json`, e diz quais estão prontos. Um aplicativo de linha de comando precisa estar instalado; uma API precisa da variável de ambiente da chave e de endereço e modelo preenchidos.
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

- `npm test`: 37 testes do motor (orquestração, arquiteturas, memória, rotinas, quadro, modelos, Buzina).
- `node apoio/bateria.mjs`, com a Muvuca rodando em demonstração: 162 verificações ao vivo, rota por rota. Só trabalha na pasta padrão `teste-estudio`, que precisa estar vazia, e devolve tudo ao estado inicial. O resultado fica em `apoio/bateria-resultado.json`.

### Arquiteturas com casos reais

`node apoio/arquiteturas-reais.mjs`, com a Muvuca rodando e o time num provedor de verdade, roda um caso real em cada uma das 7 arquiteturas prontas, cada um numa subpasta de `casos/` na pasta padrão. Gasta modelo de verdade. O resultado fica em `apoio/arquiteturas-reais-resultado.json`. Passe números para rodar só alguns casos, por exemplo `node apoio/arquiteturas-reais.mjs 1 3`.
