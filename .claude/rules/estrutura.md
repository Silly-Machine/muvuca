# Estrutura

| Caminho | O que tem |
|---|---|
| `src/orquestrador.js` | o protocolo: planejar, executar, portão, revisar, devolver; quadro e memória |
| `src/servidor.js` | HTTP local, eventos, API da tela, rotinas, boas-vindas, login |
| `src/ferramentas.js` | listar, ler, escrever, rodar; foto do projeto, diff, restauração; `dentro()` |
| `src/provedores.js` | os tipos de provedor atrás de `chamar`; leitura da saída dos aplicativos |
| `src/times.js` | validador do construtor: regras de cada arquitetura |
| `src/isolamento.js` | isolamento dos testes do portão e dos agentes |
| `src/especificacao.js` | especificação em etapas |
| `src/rotinas.js`, `memoria.js`, `conexoes.js`, `ajustes.js`, `exportar.js`, `buzina.js`, `demo.js`, `aberta.js` | uma responsabilidade por arquivo |
| `public/index.html`, `public/css/`, `public/js/` | a tela: um módulo por parte, carregados em ordem por `principal.js` |
| `public/js/regras/` | lógica da tela que não precisa do navegador, com teste |
| `config/` | time de fábrica, biblioteca de agentes, modelos prontos de time |
| `bin/muvuca.js`, `electron/` | o comando `muvuca` e o aplicativo de mesa |
| `test/` | `*.test.js`; `test/apoio/` tem aplicativos falsos e o servidor de teste |
| `scripts/` | `versao.mjs` (lançamentos), `bateria.mjs` e roteiros de teste ao vivo |
| `docs/` | `guia.md` (como funciona e como usar) e `versoes.md` (como lançar) |
| `.claude/` | orientação para a IA: `rules/`, `specs/`, `skills/` |

## Onde uma mudança costuma tocar

- **Rota nova:** `src/servidor.js`, teste em `test/`, uma seção em `scripts/bateria.mjs`, e a parte da tela em `public/js/`.
- **Ferramenta nova do time:** `src/ferramentas.js`, sempre passando por `dentro()`.
- **Provedor novo:** `config/agentes.json` e, se precisar, `src/provedores.js`.
- **Dado novo guardado em disco:** um arquivo na pasta de dados, lido com `lerJson` e gravado com `gravarJson`, entrando na tabela de dados do `docs/guia.md`.

## Arquivos que não vão para o repositório

`agentes.local.json`, `preferencias.json`, `projetos.json`, `rotinas.json`, `decisoes.log`, `memoria/`, `times/`, `dist/`, `.claude/settings.local.json`. São desta máquina.

## O que vai para o npm

Só o que está em `files` no `package.json`: `bin/`, `src/`, `public/`, `config/`, `docs/guia.md`, `README.md`, `CHANGELOG.md`, `LICENSE`. Testes, scripts e `.claude/` não vão.
