# Especificações

Trabalho que não cabe num pedido só começa aqui, no formato do Kiro: três arquivos por especificação, escritos e aprovados em ordem.

```
.claude/specs/<nome-em-minusculas-com-hifens>/
  requirements.md   o que precisa ser verdade, e como saber
  design.md         como vai ser feito, e por quê
  tasks.md          os passos, cada um ligado aos requisitos
```

Os nomes dos arquivos são os do Kiro, de propósito: a mesma pasta serve em `.kiro/specs/` sem mudar nada. O conteúdo é em português.

## As três fases

| Fase | Arquivo | Só avança quando |
|---|---|---|
| 1. Requisitos | `requirements.md` | a pessoa aprova os requisitos |
| 2. Desenho | `design.md` | a pessoa aprova o desenho |
| 3. Tarefas | `tasks.md` | a pessoa aprova a lista; aí começa a execução, uma tarefa por vez |

Nenhuma linha de código do programa é escrita antes de as três fases estarem aprovadas. A habilidade `/spec` conduz isso.

## Requisitos: histórias e critérios no formato EARS

Cada requisito tem uma história ("Como ..., quero ..., para ...") e critérios de aceite numerados, uma frase testável cada:

- `QUANDO <acontecimento>, O SISTEMA DEVE <resposta>.`
- `ENQUANTO <estado>, O SISTEMA DEVE <resposta>.`
- `SE <condição indesejada>, ENTÃO O SISTEMA DEVE <resposta>.`
- `O SISTEMA DEVE <resposta>.` (vale sempre)

O número do critério (`2.3` = requisito 2, critério 3) é o que as tarefas citam.

## Tarefas

Lista de caixas de marcar. Cada tarefa é pequena o bastante para um pedido, termina com os testes passando e cita os critérios que atende:

```md
- [ ] 2. Guardar o time em uso ao trocar de time
  - gravar `time-em-uso.json` no POST `/api/time` da conversa principal
  - teste: fecha e reabre o servidor, o time continua
  - _Requisitos: 1.1, 1.2_
```

Marque `[x]` ao terminar, no mesmo commit da mudança. Tarefa opcional leva `*` depois da caixa (`- [ ]* 5. ...`).

## Estado

A primeira linha de `requirements.md` diz o estado: `rascunho`, `aprovada`, `em execução`, `concluída` ou `suspensa`, com a data.

## Relação com a "especificação em etapas" da Muvuca

São coisas diferentes. A especificação em etapas (`src/especificacao.js`) é um recurso do produto, para quem usa a Muvuca. As especificações desta pasta são o processo de desenvolvimento da própria Muvuca.

## Nesta pasta

- [`_modelo/`](_modelo/): ponto de partida para uma especificação nova.
- [`chave-de-api-e-assinatura/`](chave-de-api-e-assinatura/): concluída; serve de exemplo completo.
- [`publicacao-no-npm/`](publicacao-no-npm/): suspensa; a publicação pelo fluxo falhou e a pendência está anotada nas tarefas.
