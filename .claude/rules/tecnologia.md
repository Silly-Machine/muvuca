# Tecnologia

## Base

- **Node 22 ou mais novo**, módulos ES (`"type": "module"`). O CI roda em Windows, macOS e Linux com Node 22, e em Linux com Node 24.
- **Servidor sem dependências.** Só módulos do próprio Node (`node:http`, `node:fs/promises`, `node:child_process`, `node:test`). Dependência nova, só de desenvolvimento e com motivo escrito.
- **Tela sem framework e sem build.** HTML, CSS e módulos ES lidos do disco a cada pedido.
- `electron` e `electron-builder` são as únicas dependências, e só para o aplicativo de mesa.

## Como o programa conversa

- HTTP local em `localhost`, com eventos por SSE para a tela.
- Acesso por chave: cabeçalho `x-muvuca-token`, ou cookie criado ao abrir `/?t=<chave>`. A chave fica em `acesso.token`, na pasta de dados.
- Pasta de dados: `~/.muvuca`, ou a de `MUVUCA_DADOS`. Porta: `MUVUCA_PORTA`.

## Provedores

Três tipos atrás da função `chamar` de `src/provedores.js`: `demo` (roteiro fixo), `cli` (aplicativo logado na assinatura: `claude`, `codex`, `gemini`) e API (chave em variável de ambiente, nunca em arquivo). Os provedores ficam em `config/agentes.json`; o arquivo local de cada máquina é `agentes.local.json`.

## Cuidados que já custaram caro

- **Windows primeiro.** Aplicativos instalados pelo npm são `.cmd` e só rodam pelo shell; caminhos têm espaço e barra invertida. Use a função `rodar` de `src/ferramentas.js` em vez de chamar `spawn` direto.
- **Ambiente dos processos filhos.** `NODE_TEST_CONTEXT` herdado faz um `node --test` filho sair com código 0 mesmo falhando: use `ambienteLimpo()`. Chaves de API herdadas passam na frente da assinatura: veja `chavesARetirar` em `src/provedores.js`.
- **Processos que ficam de pé.** Todo processo filho tem tempo-limite e é morto junto com a árvore (`taskkill /T` no Windows).
- **Quebras de linha.** O repositório normaliza por `.gitattributes`; compare saídas trocando `\r\n` por `\n`.
- **Tempos em saídas.** Nada que dependa de duração entra em comparação ou em marca (hash).

## Estilo do código

- Nomes, comentários e mensagens em português, com acentos. Identificadores sem acento.
- Comentário explica o porquê, não repete a linha.
- Funções pequenas exportadas para poder testar (por exemplo `argsDoCli`, `chavesARetirar`), em vez de testar por dentro de uma função grande.
