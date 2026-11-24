# Tarefas: desenho de arquitetura no construtor de times

Aprovadas em 24/11/2026 ("pode seguir pro desenvolvimento"). Uma tarefa por vez; cada uma termina com `npm test` passando. As fases seguintes ganham tarefas quando o `design.md` delas for escrito.

## Fase 1 (1.1.0): a base do desenho livre

- [x] 1. Layout automático e completar, como funções puras
  - `public/js/regras/desenho.js`: `relacoes`, `layoutAutomatico` (árvore, linha, anel, camadas), `completar`, `lugarLivre`, `caixa`; exportado em `regras/indice.js`
  - teste: profundidade 8 sem cruzamento, determinismo, anel e camadas, `completar` respeita quem tem posição e não sobrepõe
  - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Posição, desenho e modelo no time
  - `src/times.js` aceita `pos`, `desenho.rede` e `modelo`; os modelos de `config/arquiteturas/` ganham `pos` gerada pelo layout
  - teste: aceita, arredonda e descarta; time sem `pos` continua válido; todo modelo tem `pos` sem agentes sobrepostos
  - _Requisitos: 2.3, 2.7_

- [x] 3. Desenho em coordenadas na prévia e no palco
  - `montarGrafo` por coordenada; `rota` para setas em qualquer posição; estilos por `data-nivel`; o palco cabe no espaço
  - conferência ao vivo: os sete modelos na prévia e no palco, sem setas tortas nem agentes sobrepostos
  - _Requisitos: 1.1, 2.8_

- [x] 4. Arrastar, reorganizar e voltar ao modelo
  - arrasto por ponteiro (mover, soltar sobre agente, lixeira, fora), peça da biblioteca solta no ponto, reorganizar (anel ou camadas), voltar ao desenho do modelo, miniatura da galeria pelas posições
  - conferência ao vivo: um arrasto é um Ctrl+Z; mover não muda o time
  - _Requisitos: 1.3, 2.1, 2.2, 2.4, 2.5, 2.6_

- [x] 5. Deslocar e zoom
  - `.mundo` com translate e scale; Ctrl + roda ancorada; arrastar o fundo e espaço; dois dedos; caber (botão e Shift+1); indicador de 25% a 300%
  - conferência ao vivo: setas, borracha, biblioteca e lixeira em 50% e 200%
  - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 6. Documentar
  - "Em andamento" no `CHANGELOG.md`; construtor no `docs/guia.md` (arrastar, zoom, reorganizar)
  - _Requisitos: todos da fase 1_

- [x] 7. Quadro maximizado, miniaturas selecionáveis e estilo das setas (pedido durante a fase)
  - `rotaDaSeta` e `retaDaRede` em `regras/desenho.js`; `desenho.setas` aceito em `src/times.js`; botão "Maximizar", seleção (clique, Shift, caixa), mover e tirar vários num passo; miniaturas por CSS
  - teste: traço das duas setas e estilo padrão (`tela.test.js`); estilo aceito, padrão não gravado e inválido descartado (`times.test.js`)
  - conferência ao vivo: maximizar e Esc, biblioteca dentro do quadro, Shift + clique, caixa de seleção, mover dois juntos com um Ctrl+Z, Delete em três com um Ctrl+Z, setas arredondadas no palco
  - _Requisitos: 3a.1 a 3a.6_

- [x] 8. Quadro grande fácil de achar e bonecos soltos no palco
  - botões "Abrir quadro de desenho" e "Quadro grande", clique duplo, cabeçalho com "Fechar"; `POST /api/desenho` (só o lugar, guardado no time em uso) e arrasto no palco
  - teste: rota recusa agente de fora e lugar inválido, não muda o time e o lugar sobrevive a reabrir (`times.test.js`); seção na bateria
  - _Requisitos: 3a.7, 3a.8_

Conferido ao vivo em 24/11/2026 (Muvuca com pasta de dados descartável, 1440 e 1000 px): os nove modelos sem agentes sobrepostos e inteiros na vista; arrastar, soltar sobre outro agente (mudou o chefe), lixeira, peça solta no vazio, um Ctrl+Z por arrasto, reorganizar (anel e camadas), desenho do modelo, zoom ancorado e limites, Shift+1, deslocar pelo fundo, seta elástica com zoom e borracha em 300%; o time aplicado chegou ao palco com `pos`, `desenho` e `modelo`. Sem conferência ao vivo: a "viagem" animada durante um pedido (rodar o pedido de demonstração foi barrado nesta sessão) e os dois dedos numa tela de toque.
