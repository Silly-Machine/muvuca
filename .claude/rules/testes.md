---
paths:
  - "test/**"
  - "scripts/bateria.mjs"
---

# Ao mexer nos testes

- Rode com `npm test`. `node --test` puro executaria também `test/apoio/` como se fossem testes.
- `node:test` e `node:assert/strict`, sem biblioteca de teste.
- **Pastas temporárias em `os.tmpdir()`** (`fs.mkdtemp`), apagadas no `finally`. Teste nunca toca em `~/.muvuca` nem na pasta do repositório.
- **Servidor de teste:** `subir(dados)` de `test/apoio/servidor-de-teste.js` devolve `get`, `post` e `parar`. Pare o servidor no `finally`, com tempo-limite: uma asserção que falha com o servidor de pé trava a suíte inteira.
- **Provedor falso:** os aplicativos de `test/apoio/falso-cli*.js` fazem o papel do `claude`. Para um comportamento novo do aplicativo, crie outro falso pequeno em vez de complicar um existente.
- **Variáveis de ambiente** alteradas no teste voltam ao valor anterior no `finally`.
- **Nome do teste** diz o comportamento em português, como frase: "o time em uso volta quando a Muvuca reabre".
- **Nada de tempo** em asserção (duração, data de hoje sem relógio falso).
- Os três sistemas do CI precisam passar: cuidado com separador de caminho, quebra de linha e aspas.
- Rota nova ganha também uma seção em `scripts/bateria.mjs`, antes de "Estado final".
