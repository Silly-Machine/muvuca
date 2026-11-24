---
name: spec
description: Conduz uma especificação no padrão do Kiro (requisitos, desenho, tarefas) em .claude/specs/. Use quando o trabalho não cabe num pedido só, quando a pessoa pedir "spec", "especificação", "requisitos", "desenho" ou "tarefas" de um recurso da Muvuca, ou para continuar a execução de uma especificação já aprovada.
argument-hint: "<nome-da-especificação> [requisitos|desenho|tarefas|executar]"
---

# Especificação em três fases

Leia antes: `.claude/specs/README.md` (formato) e os modelos em `.claude/specs/_modelo/`.

A regra que não se quebra: **cada fase só começa depois que a pessoa aprova a anterior**, e nenhum arquivo do programa muda antes de `tasks.md` estar aprovado.

## Descobrir onde está

1. O nome vem do argumento, em minúsculas com hífens. Sem argumento, liste as pastas de `.claude/specs/` com o estado de cada uma (primeira linha de `requirements.md`) e pergunte qual.
2. Se a pasta não existe, é uma especificação nova: comece na fase 1.
3. Se existe, a fase atual é o primeiro arquivo que falta ou que ainda não foi aprovado.

## Fase 1: requisitos (`requirements.md`)

- Leia o código envolvido antes de escrever: requisito que contradiz o que o programa já faz é retrabalho.
- Escreva a introdução, o que fica **fora do escopo**, e os requisitos: história e critérios numerados no formato EARS (`QUANDO ... O SISTEMA DEVE ...`). Cada critério precisa ser verificável por um teste ou por uma conferência descrita.
- Confira contra `.claude/rules/produto.md`: algum critério quebra uma promessa do produto?
- O que você não sabe vai para "Perguntas em aberto", não vira suposição.
- Pare e peça aprovação. Mostre o resumo dos requisitos e as perguntas.

## Fase 2: desenho (`design.md`)

- Siga o modelo: visão geral, onde mexe, dados, comportamento, erros, testes, alternativas descartadas, riscos.
- A tabela de testes liga cada critério a um teste. Critério sem teste possível diz como será conferido ao vivo.
- Respeite `.claude/rules/tecnologia.md`: sem dependência nova no servidor, sem framework na tela.
- Pare e peça aprovação.

## Fase 3: tarefas (`tasks.md`)

- Tarefas pequenas, em ordem de dependência, cada uma terminando com `npm test` passando e citando os critérios (`_Requisitos: 1.2, 2.1_`).
- Todo critério aparece em pelo menos uma tarefa. Confira antes de mostrar.
- A última tarefa obrigatória é documentar (`CHANGELOG.md`, `docs/guia.md`).
- Pare e peça aprovação. Ao aprovar, troque o estado em `requirements.md` para `aprovada`.

## Executar

- **Uma tarefa por vez.** Leia os três arquivos, faça a primeira tarefa em aberto, rode `npm test`, marque `[x]` e pare para a pessoa conferir. Só emende a seguinte se ela pedir para seguir direto.
- Ao começar a primeira tarefa, estado `em execução`; ao marcar a última, `concluída`, com a data.
- Se a execução mostrar que o desenho estava errado, volte e corrija `design.md` (e os requisitos, se for o caso) antes de continuar, e diga à pessoa o que mudou.
- Commit, push e lançamento seguem a regra geral: só quando a pessoa pedir.

## Compatibilidade com o Kiro

Os nomes dos arquivos são os do Kiro. Para abrir uma especificação no Kiro, copie a pasta para `.kiro/specs/`. As regras de `.claude/rules/` equivalem ao `.kiro/steering/`: o cabeçalho `paths:` daqui é o `inclusion: fileMatch` de lá.
