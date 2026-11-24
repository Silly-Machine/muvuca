# Desenho: desenho de arquitetura no construtor de times

Este arquivo cresce fase a fase: cada fase ganha a sua seção antes de começar. Hoje está escrita a **fase 1 (1.1.0)**.

## Fase 1: a base do desenho livre

### Visão geral

A prévia e o palco deixam de montar o time em linhas HTML (`.nivel` com flex) e passam a pôr cada agente numa **coordenada**. As coordenadas ficam no próprio agente (`pos: [x, y]`), em **unidades de desenho**: uma unidade na horizontal é a largura de um agente, uma na vertical é a altura de uma camada. Cada vista converte unidades em pixels com a sua escala (a prévia é pequena e o palco é grande), então o mesmo desenho serve às duas. Quem calcula as posições automáticas é uma função pura nova, `public/js/regras/desenho.js`. Ela completa só os agentes sem posição e nunca mexe nos que já têm. Sobre o desenho, a prévia ganha uma camada "mundo" com deslocamento e zoom.

### Onde mexe

| Arquivo | Mudança |
|---|---|
| `public/js/regras/desenho.js` (novo) | `layoutAutomatico(time, opcoes)`, `completar(time, opcoes)`, `lugarLivre(ocupados, alvo)`, `caixa(posicoes)`, `relacoes(time)`: funções puras, sem DOM |
| `public/js/regras/indice.js` | exporta `desenho` |
| `public/js/palco.js` | `montarGrafo` posiciona cada agente pela coordenada (sem `.nivel`); as rotas das setas passam a servir a qualquer posição (`rota`); `.rel` no meio da seta |
| `public/js/construtor.js` | arrastar agente por ponteiro (move; solto sobre outro agente, mantém o comportamento de hoje; solto na lixeira, remove); deslocar e zoom; "caber na tela"; "reorganizar"; "voltar ao desenho do modelo"; a peça solta no vazio fica onde caiu; miniatura da galeria pelas posições |
| `public/index.html` | barra da prévia: zoom (−, %, +), caber, reorganizar (com anel ou camadas na rede) e voltar ao modelo |
| `public/css/estilo.css`, `tema.css` | `#previa` vira janela de altura fixa com `.mundo` dentro; tamanhos por `data-nivel` no `.agente`; tiram as regras de `.nivel` |
| `src/times.js` | aceita `pos` em cada agente, `desenho.rede` (`anel` ou `camadas`) e `modelo` (nome do modelo de origem) |
| `config/arquiteturas/*.json` | cada agente ganha `pos`, gerada uma vez pelo layout automático e gravada |
| `test/tela.test.js`, `test/times.test.js` | testes novos (tabela abaixo) |

### Dados

- **Agente:** `pos: [x, y]`, opcional, com dois números finitos entre −200 e 200. O servidor arredonda para duas casas e ignora valores fora disso, sem recusar o time. Times antigos, sem `pos`, continuam válidos e ganham o layout automático ao serem desenhados.
- **Time:** `desenho: { rede: 'anel' | 'camadas' }`, opcional; vale só na rede, como escolha do "reorganizar". Também `modelo`: o nome do modelo pronto de onde o time veio, até 40 caracteres, opcional.
- O JSON exportado (`timeJson`) já leva os campos do agente e do time, então `pos`, `desenho` e `modelo` vão junto sem mudança.
- Os modelos de fábrica trazem `pos` gravada e não são escritos nunca: a galeria só lê `config/arquiteturas/`.

### Comportamento

**Layout automático** (`layoutAutomatico`), sempre determinístico:

- *Supervisor e hierárquica:* a chefia é uma árvore (o validador já garante). Uso o layout de árvore arrumada: as folhas recebem colunas em sequência, e cada chefe fica centrado sobre o primeiro e o último subordinado. Numa árvore isso não cruza setas, em qualquer profundidade, então o Sugiyama completo não é necessário. A ordem entre irmãos é a de hoje (coordena, executa, consulta, revisa). Quem fica sem chefe válido vai para uma linha embaixo.
- *Esteira e agente único:* uma linha na ordem da lista, com o revisor no fim.
- *Rede em anel:* os membros num círculo, com o primeiro no topo, e o revisor embaixo, fora do anel.
- *Rede em camadas:* camadas por distância (busca em largura a partir do primeiro membro, seguindo quem passa a vez), com duas passadas de baricentro para reduzir cruzamentos, e o revisor embaixo.
- O resultado é centrado em x = 0 e começa em y = 0.

**Completar** (`completar`): quem já tem `pos` fica onde está. Se ninguém tem, todos recebem o layout automático. Se só alguns não têm, cada um recebe um ponto preferido e depois o lugar livre mais próximo dele (`lugarLivre`, busca em espiral numa grade de meia unidade, sem ficar a menos de uma unidade de outro agente). O ponto preferido é:
- o ponto onde a peça foi solta, quando há um;
- senão, embaixo do chefe (supervisor e hierárquica);
- senão, à direita do anterior na lista (esteira);
- senão, ao lado de um vizinho (rede);
- senão, embaixo de tudo.

**Prévia:**
- `atualizarPrevia` chama `completar` no rascunho e grava as posições nele. Assim o histórico (que compara o JSON do rascunho) registra cada mudança de posição como um passo, e o time aplicado leva o desenho.
- Arrastar um agente move só o DOM enquanto o ponteiro anda (setas redesenhadas a cada quadro). Ao soltar:
  - sobre outro agente: aplica `moverNo` como hoje (troca de chefe, ordem ou passagem de vez) e tira a `pos` do agente, que volta a ficar perto do novo chefe;
  - sobre a lixeira: remove o agente;
  - no vazio: grava a `pos`. É um passo só no desfazer.
- Um clique sem arrastar continua abrindo o cartão. A biblioteca continua com o arrastar nativo do navegador: solta sobre um agente, liga como hoje; solta no vazio, o agente nasce naquele ponto.
- Deslocar e zoom: o `.mundo` recebe `translate(tx, ty) scale(z)`, com z entre 0,25 e 3.
  - Ctrl + roda (e a pinça do trackpad, que chega como roda com Ctrl) aproxima ou afasta em volta do ponteiro.
  - Arrastar o fundo, ou segurar espaço e arrastar, desloca.
  - Com dois dedos numa tela de toque, aproxima, afasta e desloca.
  - Shift+1 ou o botão fazem "caber na tela".
  - O zoom só muda sozinho quando um time novo é aberto (galeria; desfazer não conta) e ao reorganizar ou voltar ao desenho do modelo, que enquadram o resultado. Decidido durante a execução: depois de refazer o desenho inteiro, o zoom antigo costuma deixar parte dele fora da vista.
  - O mundo começa no agente mais à esquerda e mais acima. Quando um arrasto muda esse canto, a vista compensa, e o desenho não pula.
- Todas as coordenadas de ponteiro passam por `paraMundo(clientX, clientY)`: a seta elástica, o ponto de soltar e o arrasto.
- "Reorganizar": apaga as posições e chama `layoutAutomatico` (na rede, com a escolha anel ou camadas, guardada em `desenho.rede`). É um passo no desfazer.
- "Voltar ao desenho do modelo": aparece quando `rascunho.modelo` casa com um modelo pronto da galeria. Copia as `pos` do modelo para os agentes de mesmo id e completa o resto.

**Palco:** usa as mesmas posições (`completar` numa cópia, sem gravar) com a escala dele, e continua cabendo no espaço com `ajustarEscala`.

**Setas em qualquer posição** (`rota(A, B)`):
- destino abaixo da origem: cotovelo de hoje, do pé de um até a cabeça do outro;
- destino acima: o mesmo cotovelo, subindo;
- lado a lado: cotovelo horizontal, de lateral a lateral.

A rede continua em linha reta, e a "viagem" usa a mesma rota.

### Erros e mensagens

- Posição inválida vinda de arquivo é ignorada em silêncio: o agente ganha o layout automático, e o time não deixa de abrir por causa do desenho.
- Arrastar para fora da prévia sem ser na lixeira devolve o agente para onde estava, com a dica "Solte dentro da prévia para mover, ou na lixeira para tirar do time."

### Testes

| Critério | Teste |
|---|---|
| 1.1, 1.4 | `tela.test.js`: hierarquia de 8 níveis sem cruzamento (cada chefe acima e centrado; filhos de chefes diferentes não se intercalam); duas chamadas dão o mesmo resultado |
| 1.2 | `tela.test.js`: rede em anel (todos à mesma distância do centro) e em camadas (o primeiro no topo; camada = distância) |
| 1.3, 1.5 | `tela.test.js`: `completar` não move quem tem `pos`; o novo fica perto do chefe ou do ponto pedido e não cobre ninguém |
| 2.2 | ao vivo: arrastar não muda `chefe`, `conexoes` nem a ordem (conferido pelo JSON exportado) |
| 2.3 | `times.test.js`: `pos` aceita, arredondada, e a inválida é descartada; `desenho` e `modelo` aceitos; time sem `pos` continua válido |
| 2.4, 2.5 | ao vivo: um arrasto é um Ctrl+Z; "reorganizar" se desfaz |
| 2.6, 2.7 | `times.test.js`: todo modelo de fábrica tem `pos` em todos os agentes e nenhum par a menos de uma unidade; ao vivo: "voltar ao desenho do modelo" |
| 2.8 | ao vivo: o palco mostra o desenho aplicado |
| 3.1 a 3.6 | ao vivo, no navegador do painel: zoom ancorado, deslocar, caber, limites, setas e borracha com zoom |

### Acréscimo: quadro, miniaturas e setas (requisito 3a)

- **Setas:** o traço sai de `rotaDaSeta(A, B, estilo)` e `retaDaRede(A, B, estilo)` em `regras/desenho.js`, com teste. Quadradas: `V`/`H` puros, sem curva nos cantos. Arredondadas: Bézier cúbica entre os mesmos pontos de saída e chegada (na rede, uma curva quadrática leve para o lado). O estilo é `desenho.setas`; o servidor guarda só `'arredondadas'` (quadradas é o padrão e não ocupa espaço), em qualquer arquitetura. "Reorganizar" na rede mantém o estilo.
- **Miniaturas:** só CSS na prévia (cartão com fundo, borda na cor do agente). `posicao()`, na prévia, usa a caixa do cartão, então a seta encosta na borda dele.
- **Seleção:** um `Set` de ids no construtor, refeito a cada desenho (some quem saiu do time). O arrasto leva junto os outros selecionados e grava todas as posições antes de redesenhar, então o desfazer vê um passo só. `removerVarios(ids)` faz o mesmo para tirar do time. A caixa de seleção é Shift + arrastar o fundo; sem Shift, arrastar o fundo continua deslocando a vista.
- **Maximizar:** a `.previa-caixa` vira `position:fixed` na janela, e a biblioteca muda de lugar no DOM (para dentro do quadro, numa faixa) e volta ao sair. Abrir o construtor de novo sempre começa sem maximizar.

### Alternativas descartadas

- **dagre:** não respeita posições fixadas e adiciona 17 KB. A chefia é uma árvore, e o layout de árvore resolve sem cruzamentos.
- **Guardar as posições em pixels:** a prévia e o palco têm tamanhos diferentes. Com unidades, o mesmo desenho serve aos dois.
- **Posições num mapa do time (`desenho.posicoes[id]`):** o id muda pelo cartão, e o mapa teria de acompanhar. No agente, a posição vai junto.
- **Manter o arrastar nativo do navegador para mover agentes:** ele não dá o ponto exato nem permite redesenhar as setas durante o arrasto.

### Riscos

- **A prévia muda de altura.** Ela passa a ter altura fixa (com zoom), e a coluna do construtor pode ficar diferente em telas pequenas. Confiro em 1280 px e em 1000 px.
- **Testes e roteiros que procuram `.nivel`.** Procuro e ajusto (`scripts/`, `test/`).
- **Palco com times antigos.** Times sem `pos` são completados na hora, sem gravar, e o desenho deles fica igual ao de agora em estrutura.
