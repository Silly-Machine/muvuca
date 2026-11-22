# Versões e lançamentos

Como a Muvuca numera as versões, onde ficam as notas e como uma versão chega à página de [Releases](https://github.com/Silly-Machine/muvuca/releases).

## Numeração

`maior.menor.correção`, por exemplo `0.2.1`.

| Parte | Sobe quando | Comando |
|---|---|---|
| correção | só conserta ou ajusta, sem recurso novo | `npm run lancar -- correcao` |
| menor | entra recurso novo, sem quebrar o que existe | `npm run lancar -- menor` |
| maior | algo deixa de funcionar como antes (dados, comandos, arquivos de configuração) | `npm run lancar -- maior` |

Enquanto a versão começa com `0.`, a Muvuca é protótipo e a parte "menor" pode trazer mudanças que quebram.

Versão com sufixo, como `1.0.0-beta.1`, é um **pré-lançamento**: sai na página de Releases marcada como tal e não vira a "mais recente". Para lançar uma, escreva a versão por extenso: `npm run lancar -- 1.0.0-beta.1`.

## No dia a dia

Cada mudança que quem usa vai notar ganha uma linha na seção **"Em andamento"**, no topo do `CHANGELOG.md`. Se a seção não existir, crie:

```md
## Em andamento: resumo curto do que vem

- **O que mudou**, dito para quem usa.
```

O texto depois dos dois-pontos é opcional e vira o subtítulo da versão.

## Lançar

Com tudo no ramo `main` e sem mudanças por fazer commit (só o `CHANGELOG.md` pode estar alterado):

```sh
npm run lancar -- correcao            # prepara neste computador
git push origin main && git push origin v0.2.1
```

ou, de uma vez:

```sh
npm run lancar -- correcao --enviar
```

O comando, nesta ordem:

1. confere o ramo, a tag e se a versão nova é maior que a atual;
2. roda os testes (`--sem-testes` pula; use só se acabou de rodar);
3. troca o título "Em andamento" pelo número e a data de hoje;
4. atualiza a versão em `package.json`, `package-lock.json` e no README;
5. cria o commit `Muvuca X.Y.Z` e a tag `vX.Y.Z`, com as notas dentro.

Se algo estiver errado, ele para antes de alterar qualquer arquivo e diz o motivo. Sem `--enviar`, nada sai do seu computador, e o próprio comando mostra como desistir.

## O que o GitHub faz com a tag

O fluxo [Instaladores](../.github/workflows/instaladores.yml) roda a cada tag `v*`:

1. **Confere** se a tag bate com o `package.json` e se a versão tem notas no `CHANGELOG.md`. Se não bater, para aqui.
2. **Gera os instaladores** de Windows, macOS (Apple Silicon e Intel) e Linux, rodando os testes em cada sistema antes.
3. **Publica** na página de Releases: os instaladores, um `SHA256SUMS.txt` e as notas da versão, tiradas do `CHANGELOG.md`.

Leva cerca de 5 minutos. Rodar o fluxo de novo para a mesma tag troca os arquivos e as notas da versão que já existe.

Para só gerar os instaladores, sem publicar, rode o fluxo à mão pela aba Actions ("Run workflow").

## Comandos de apoio

```sh
node scripts/versao.mjs notas           # notas da versão atual, como vão para a página de Releases
node scripts/versao.mjs notas 0.2.0     # de uma versão específica
node scripts/versao.mjs conferir        # package.json, package-lock.json e CHANGELOG batem?
```

## Corrigir uma versão publicada

- **Erro nas notas:** edite o texto na página de Releases e corrija também o `CHANGELOG.md`.
- **Erro no programa:** lance uma versão de correção. Não mova uma tag que já foi publicada: quem baixou ficaria com um arquivo diferente sob o mesmo número.
- **Versão que não devia ter saído:** apague a release e a tag no GitHub (`gh release delete vX.Y.Z --cleanup-tag`) e lance a correção.

## Limites atuais

- Os instaladores não são assinados.
- Não há atualização automática.
- O pacote não está no npm; `npx github:Silly-Machine/muvuca` usa sempre o que está no ramo `main`. Para uma versão específica: `npx github:Silly-Machine/muvuca#v0.2.1`.
