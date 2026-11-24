---
name: lancar
description: Lança uma versão da Muvuca (correção, menor ou maior) pelo processo do projeto. Só quando a pessoa pedir o lançamento.
argument-hint: "correcao|menor|maior"
disable-model-invocation: true
---

# Lançar uma versão

O processo completo está em `docs/versoes.md`. Lançamento sai do computador e não se desfaz bem: siga a ordem.

1. **Árvore limpa no `main`.** `git status --short` vazio (só o `CHANGELOG.md` pode estar alterado).
2. **Notas prontas.** O `CHANGELOG.md` tem a seção `## Em andamento` com o que mudou, escrito para quem usa. Sem ela, pare e escreva com a pessoa.
3. **Tipo certo.** `correcao` só conserta; `menor` traz recurso novo; `maior` quebra algo. Se o argumento não bate com o que está nas notas, pergunte.
4. **Testes aqui:** `npm test`.
5. **Enviar ao `main` e esperar o CI:** `git push origin main`, depois acompanhar o fluxo "Testes" do commit até ficar verde em Windows, macOS e Linux (`gh run list --workflow testes.yml --commit <sha>` e `gh run watch <id> --exit-status`). Vermelho: pare, corrija, recomece.
6. **Lançar:** `npm run lancar -- <tipo> --enviar`. O comando troca "Em andamento" pelo número e a data, atualiza as versões, cria o commit `Muvuca X.Y.Z` e a tag, e envia.
7. **Conferir:** o fluxo "Instaladores" da tag (cerca de 5 minutos) e a página de Releases com os instaladores e o `SHA256SUMS.txt`.
8. **npm:** enquanto a publicação automática não existir (veja `.claude/specs/publicacao-no-npm/`), quem publica é a pessoa, com `npm publish` na pasta do projeto; o código de dois fatores é dela. Diga isso no fim.

Nunca: mover uma tag publicada, editar o número da versão à mão, pular os testes sem a pessoa pedir.
