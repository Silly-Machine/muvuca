# Muvuca

Painel local para trabalhar com um time de agentes de IA: líder, subagentes, portão de testes e revisor. Node puro, sem dependências no servidor, sem framework e sem build na tela. Tudo em português do Brasil, com todos os acentos.

## Comandos

```sh
npm test                                   # todos os testes (use sempre este, nunca "node --test" puro)
node --test test/times.test.js             # um arquivo só
npm start -- --dados ./dados-de-teste --porta 4320   # sobe a Muvuca sem tocar nos seus dados
npm run bateria                            # bateria ao vivo contra um servidor em modo demonstração
node scripts/versao.mjs conferir           # package.json, lock e CHANGELOG batem?
```

## Onde está a orientação para a IA

Esta pasta segue o padrão do Kiro (direção, especificações e habilidades), nos lugares que o Claude Code lê sozinho:

| No Kiro | Aqui | Quando entra no contexto |
|---|---|---|
| `.kiro/steering/` sempre incluído | `.claude/rules/produto.md`, `tecnologia.md`, `estrutura.md` | em toda sessão |
| `.kiro/steering/` por arquivo (`fileMatch`) | `.claude/rules/` com `paths:` no cabeçalho | ao mexer nos arquivos que casam |
| `.kiro/steering/` manual | `.claude/skills/` | quando a tarefa pede, ou com `/nome` |
| `.kiro/specs/<nome>/` | `.claude/specs/<nome>/` (`requirements.md`, `design.md`, `tasks.md`) | pela habilidade `/spec` |

Trabalho que não cabe num pedido só começa por uma especificação: `/spec <nome>`. Leia [.claude/specs/README.md](.claude/specs/README.md).

## Antes de dizer que terminou

1. `npm test` passa.
2. Comportamento novo tem teste; correção tem um teste que falhava antes.
3. Mudança que quem usa nota tem uma linha em "Em andamento" no `CHANGELOG.md` e, se muda o uso, no `docs/guia.md`.
4. Mudança na tela foi aberta e conferida no navegador.
5. Não faça commit, push nem lançamento sem a pessoa pedir.
