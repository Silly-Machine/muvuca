# Desenho: publicação automática no npm

## Visão geral

Um trabalho novo, `npm`, no fluxo `.github/workflows/instaladores.yml`, que já roda a cada tag `v*`, já confere a versão e já roda os testes nos três sistemas. A autenticação é a publicação confiável do npm: o GitHub emite um token de identidade (OIDC) para aquele fluxo, e o npm o aceita porque o pacote foi configurado para confiar nele.

## Onde mexe

| Arquivo | Mudança |
|---|---|
| `.github/workflows/instaladores.yml` | trabalho `npm`, depois de `instalador` |
| `docs/versoes.md` | seção "O que o GitHub faz com a tag" ganha o passo do npm; nota sobre documentação |
| `README.md` | roteiro: publicação automática |
| `CHANGELOG.md` | linha em "Em andamento" |

## Comportamento

```yaml
  npm:
    name: Publicar no npm
    if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')
    needs: instalador
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
      id-token: write          # o token de identidade que o npm confere
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24     # a publicação confiável pede npm 11.5.1 ou mais novo
          registry-url: https://registry.npmjs.org
      - name: Publicar, se a versão ainda não está lá
        run: |
          VERSAO="${GITHUB_REF_NAME#v}"
          if npm view "muvuca@$VERSAO" version > /dev/null 2>&1; then
            echo "muvuca@$VERSAO já está no npm."; exit 0
          fi
          case "$VERSAO" in *-*) ETIQUETA=next ;; *) ETIQUETA=latest ;; esac
          npm publish --tag "$ETIQUETA"
```

- `needs: instalador` garante conferência e testes nos três sistemas antes (critérios 1.1 e 1.2).
- O `prepublishOnly` roda `versao.mjs conferir` e `npm test` mais uma vez, no Linux.
- Em repositório público, a publicação confiável gera o selo de procedência sozinha (critério 2.2).
- A condição `github.event_name == 'push'` cobre o critério 1.5: a publicação confiável não vale para execução manual.

## Configuração fora do repositório

Uma vez, pelo dono do pacote, em npmjs.com → `muvuca` → Settings → Trusted Publisher → GitHub Actions: organização `Silly-Machine`, repositório `muvuca`, fluxo `instaladores.yml`. O cadastro vence se não houver publicação em pouco tempo depois de criado: fazer logo antes do primeiro lançamento.

## Erros e mensagens

- Cadastro ausente ou vencido: o `npm publish` falha com erro de autenticação. O trabalho `release` não depende do `npm`, então os instaladores saem do mesmo jeito; a correção é refazer o cadastro e rodar de novo só o trabalho que falhou.

## Testes

Não há como testar a publicação sem publicar. A prova é o primeiro lançamento: conferir `npm view muvuca version` e o selo de procedência na página do pacote. Rodar o fluxo de novo para a mesma tag prova o critério 1.4.

## Alternativas descartadas

- **Token `NPM_TOKEN` nos segredos.** Funciona, mas é segredo de longa duração e contorna os dois fatores.
- **Fluxo separado só para o npm.** Repetiria a conferência e os testes; e o cadastro da publicação confiável aponta para um arquivo de fluxo só.
- **Publicar a cada commit no `main`.** Exigiria versão automática por commit; o projeto numera versões de propósito.

## Riscos

- Publicação no npm não se desfaz (só se marca como obsoleta). Por isso ela vem depois de todos os testes.
- Mudança de nome para `@silly-machine/muvuca` exigirá refazer o cadastro.
