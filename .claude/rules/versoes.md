---
paths:
  - "CHANGELOG.md"
  - "package.json"
  - "scripts/versao.mjs"
  - ".github/workflows/**"
  - "docs/versoes.md"
---

# Versões e lançamentos

O processo completo está em `docs/versoes.md`. O essencial:

- **Cada mudança que quem usa nota** ganha uma linha na seção `## Em andamento` no topo do `CHANGELOG.md`, escrita para quem usa: o que acontecia, o que acontece agora. Se a seção não existe, crie.
- **Nunca edite o número da versão à mão** em `package.json`, `package-lock.json` ou no README. Quem faz isso é `npm run lancar -- correcao|menor|maior`.
- **Não mova tag publicada.** Erro no programa pede versão de correção.
- **Lançar só quando a pessoa pedir**, com a habilidade `/lancar`: enviar ao `main`, esperar o fluxo "Testes" ficar verde nos três sistemas, e só então lançar com `--enviar`.
- A tag `v*` dispara o fluxo "Instaladores", que confere a versão, gera os instaladores e publica em Releases.
- O `prepublishOnly` do npm roda `node scripts/versao.mjs conferir && npm test`. Login e código de dois fatores do npm são de quem publica.
- Mudança só de documentação (`**.md`, `docs/`) não roda o CI e não pede versão nova.
