# Pesquisa: o que trazer de Excalidraw, draw.io e editores de agentes

Feita em 24/11/2026, lendo código e documentação de:

- **Excalidraw**: `excalidraw/excalidraw` e `excalidraw/mermaid-to-excalidraw`, com clone e leitura do código. Licença MIT.
- **draw.io**: `jgraph/drawio` (grapheditor, diagramly, plugins) e `maxGraph/maxGraph` (layouts e estilos de aresta). Licença Apache-2.0.
- **Editores de agentes e fluxos**: React Flow (xyflow), n8n, Dify, Flowise (Agentflow V2), Langflow, LangGraph Studio, AutoGen Studio, Rivet e ComfyUI. O CrewAI Studio ficou sem verificação.
- **Bibliotecas leves**: dagre, elkjs, d3-hierarchy, d3-force, WebCola, rough.js, perfect-freehand, libavoid-js, Mermaid, D2 e PlantUML. Tamanhos medidos com `gzip -9`.

## Ponto de partida: o que o construtor já tem

| Recurso | Onde |
|---|---|
| Prévia em camadas: líder no topo, até 6 níveis; anel na rede | `public/js/palco.js` (`camadas`, `montarGrafo`, `dispor`) |
| Arestas em cotovelo (hierarquia), arco e reta (rede), seta (esteira) | `palco.js` (`cotovelo`, `arco`, `reta`) |
| Modo setas (clicar ou arrastar), borracha, lixeira, seta selecionada com Delete | `public/js/construtor.js` |
| Significado da seta por arquitetura, com testes | `public/js/regras/setas.js` |
| Desfazer e refazer (80 passos) | `public/js/regras/historico.js` |
| Biblioteca arrastável, galeria com miniaturas, cartões de edição | `construtor.js` |
| Avisos em texto corrido; quem decide é o servidor | `construtor.js` (`avisos`), `src/times.js` |
| Exportação: AGENTS.md, JSON, subagentes do Claude Code, .zip | `src/exportar.js` |
| Execução ao vivo no **palco**: estado por agente, aresta ativa, "viagem" animada, balões | `palco.js` (`estado`, `marcarAresta`, `viagem`) |

Faltam pan e zoom, posição livre, teclado no grafo, rótulos nas setas, grupos, importação e imagem exportável.

## Catálogo

Utilidade é para desenhar arquitetura de times de agentes. Esforço é em JS puro, sem dependências: P (pequeno), M (médio), G (grande).

### Navegação e teclado

| Recurso | De onde | Utilidade | Esforço | Decisão |
|---|---|---|---|---|
| Ctrl + roda ancorado no cursor, pinça, espaço + arrastar, zoom para caber (Shift+1) | Excalidraw (`App.wheel.ts`, `App.pan.ts`) | alta | P | entra (R3) |
| Paleta de comandos com busca sem acentos; `?` abre os atalhos; mapa único de ações | Excalidraw (`CommandPalette/`, `actions/shortcuts.ts`) | alta | M | entra (R15) |
| Montar pelo teclado: Alt + setas cria um ligado ou navega | Excalidraw (`flowchart.ts`) | alta | M | entra (R15) |
| Grafo como widget com *roving tabindex*, `aria-label` por agente, `aria-live` | guia de acessibilidade do React Flow | alta | M | entra (R15). Em SVG/HTML, a Muvuca leva vantagem sobre o `<canvas>` do Excalidraw |
| Busca no canvas (Ctrl+F) | Excalidraw, draw.io | média | P | entra na paleta |
| Minimapa | Excalidraw, draw.io, React Flow | baixa: times cabem na tela | P | fora |

### Criar e ligar

| Recurso | De onde | Utilidade | Esforço | Decisão |
|---|---|---|---|---|
| Setas de atalho ao passar o mouse: clicar cria o próximo já ligado, arrastar liga | draw.io (`HoverIcons`, `Graph.connectVertex`) | alta | M | entra (R4) |
| Soltar a seta no vazio abre a biblioteca e cria o agente já ligado | React Flow (*add node on edge drop*), Dify | alta | M | entra (R4) |
| Validação enquanto se puxa a seta: linha marcada como válida ou recusada, com o motivo | React Flow (`isValidConnection`, `connectionStatus`) | alta | P | entra (R5), reaproveitando `regras/setas.js` |
| Arrastar ficha de ferramenta ou de modelo para cima do agente | AutoGen Studio | média | M | fora desta etapa |

### Ler a arquitetura no desenho

| Recurso | De onde | Utilidade | Esforço | Decisão |
|---|---|---|---|---|
| Rótulo na seta ("delega", "passa a vez", "depois", "revisa") | Excalidraw (texto vinculado), draw.io | alta | P | entra (R7) |
| Estilo com significado: revisor tracejado; ponta diferente por relação; legenda | draw.io (`dashed`), Excalidraw (`Arrowhead`) | alta | P | entra (R7) |
| Fichas no nó: ferramentas, modelo, nível | n8n (`CanvasNodeAgentChips.vue`), draw.io (placeholders `%campo%`) | alta | P | entra (R8) |
| Moldura por sub-time (contêiner do sub-líder), dobrar e desdobrar | draw.io (swimlane, `childLayout`, plugin Trees), Excalidraw (frames) | alta | M | entra (R9) |
| Notas adesivas | n8n, Dify | média: anotar decisões, ótimo em aula | P | entra (R10) |
| Animação de fluxo na aresta (tracejado ou pontos andando) | draw.io (`flowAnimation`), React Flow (`animated`) | alta: didático | P | entra como "ensaio do caminho" (R11) |
| Tags por agente com filtro | draw.io | média | P | fora |
| Estilo à mão (rough.js 4.6.6, MIT, 8,9 KB gzip, ESM único) | Excalidraw | baixa: os personagens já dão identidade | P | fora |

### Editar mais rápido

| Recurso | De onde | Utilidade | Esforço | Decisão |
|---|---|---|---|---|
| Seleção múltipla: Shift + clique e caixa | Excalidraw, draw.io | média | P | entra (R12) |
| Copiar e colar com JSON tipado em dois formatos (próprio e `text/plain`) | Excalidraw (`clipboard.ts`) | alta | P | entra (R14) |
| Duplicar um sub-time inteiro com as relações, ids remapeados | Excalidraw (`duplicate.ts`, `fixDuplicatedBindingsAfterDuplication`) | alta | M | entra (R14) |
| Barra flutuante do nó (duplicar, remover, editar) | React Flow (`NodeToolbar`) | alta | P | entra (R12) |
| Lista de problemas que leva ao nó, e nó marcado | Dify (`header/checklist/`) | alta | P | entra (R6) |
| Agente desligado sem apagar | n8n | média | P | fora: muda o protocolo |
| Posição livre, alinhar, distribuir, encaixe e guias | Excalidraw (`snapping.ts`), draw.io | alta: decisão de 24/11, desenho livre | M | entra (R2 arrastar; R13 alinhar, distribuir, encaixe e guias) |

### Trocar com o mundo

| Recurso | De onde | Utilidade | Esforço | Decisão |
|---|---|---|---|---|
| Exportar o time como Mermaid `flowchart` para README; o GitHub desenha | mermaid-to-excalidraw, draw.io | alta | P | entra (R16) |
| Importar um subconjunto de Mermaid (colar ou arquivo), com erro na linha | Excalidraw (cola texto Mermaid e vira diagrama), draw.io (`parseMermaidDiagram`) | alta | M | entra (R17), com parser próprio de cerca de 150 linhas |
| SVG com o time embutido (comentário em base64) | Excalidraw (`scene/export.ts`), draw.io (atributo `content`) | alta | P | entra (R18) |
| PNG com o time embutido (chunk `tEXt`, CRC32 à mão) | Excalidraw (`data/image.ts`), draw.io (`writeGraphModelToPng`) | alta | M | entra (R18), com cerca de 70 linhas |
| Importar time de arquivo JSON na galeria | AutoGen Studio (galerias importáveis), Flowise (`marketplaces/`) | alta | P | entra (R17) |
| CSV com cabeçalho de diretivas | draw.io (`importCsv`) | média | M | fora |
| Link com o time comprimido no `#` | Excalidraw (o servidor nunca vê o fragmento) | média | P | fora: painel local |
| Texto para diagrama com IA | Excalidraw (`TTDDialog`), draw.io (`ChatWindow.generate`) | alta | M | fora: spec própria. O time da Muvuca pode gerar o JSON do time |
| D2, PlantUML, Structurizr, renderizar Mermaid no navegador | — | baixa | — | fora: pesado (Mermaid tem 1,58 MB gzip), licença ou servidor |

### Layout

| Recurso | De onde | Utilidade | Esforço | Decisão |
|---|---|---|---|---|
| Sugiyama simplificado (quebra de ciclos, camadas, baricentro, coordenadas) | maxGraph (`hierarchical/`, Apache-2.0), dagre (MIT, 17 KB gzip, ESM único) | alta | M | entra (R1), à mão, com cerca de 200 linhas e função pura testável que respeita posições fixadas (o dagre não faz isso); dagre só se os testes de cruzamento falharem |
| Rede em anel ou em camadas, à escolha | draw.io (círculo, orgânico) | média | P | entra (R1) |
| Roteamento ortogonal desviando de formas (A\* em grade) | Excalidraw (`elbowArrow.ts`), maxGraph (`Manhattan.ts`) | média | M–G | fora: com camadas, o cotovelo pelo corredor basta |
| ELK, libavoid | draw.io | — | — | não usar: 477 KB gzip, EPL/GPL; WASM, LGPL |

## Frente separada: execução no grafo

Os editores de agentes ligam o desenho ao que o time fez. A Muvuca já mostra a execução ao vivo no palco. O que falta lá é outra spec, e não desenho:

1. Clicar no agente e ver a **última rodada** dele: entrada, saída, arquivos, tempo, tokens e custo (Dify "Last Run", Langflow "Inspect", AutoGen).
2. **Histórico projetado no grafo**: abrir um pedido antigo e ver cada agente pintado com o resultado (LangGraph Studio, n8n).
3. **Aprovação humana** como peça do desenho: pausa depois do plano, ou antes de escrever ou rodar (Flowise Human Input, LangGraph interrupt).
4. **Reexecutar a partir de um agente**, reaproveitando as saídas anteriores (LangGraph fork, n8n pin data, Langflow freeze). Esforço grande: o servidor precisa guardar a saída de cada agente.
5. **Laço revisor e executor com contador** visível (Flowise Loop, com `Max Loop Count`).

## Fontes principais

- Excalidraw: `packages/excalidraw/{App.wheel.ts, App.pan.ts, clipboard.ts, data/image.ts, scene/export.ts, mermaid.ts, components/CommandPalette/}`, `packages/element/src/{binding.ts, elbowArrow.ts, flowchart.ts, duplicate.ts, frame.ts, groups.ts}`.
- draw.io: `grapheditor/Graph.js` (HoverIcons, `connectVertex`, `addFlowAnimationToNode`, `replacePlaceholders`), `diagramly/{ElkLayout.js, EditorUi.js (importCsv, parseMermaidDiagram), Editor.js (writeGraphModelToPng), Pages.js}`; maxGraph `view/layout/hierarchical/`, `view/style/edge/Manhattan.ts`.
- Agentes: reactflow.dev (examples e accessibility), `langgenius/dify` `web/app/components/workflow/`, `n8n-io/n8n` `editor-ui/.../canvas/`, docs.flowiseai.com (Agentflow V2), docs.langchain.com (Studio), AutoGen Studio, docs.langflow.org.
- Bibliotecas: npm e GitHub de cada uma; tamanhos medidos dos arquivos do jsDelivr.
