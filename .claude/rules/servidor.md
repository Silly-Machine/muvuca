---
paths:
  - "src/**"
  - "bin/**"
---

# Ao mexer no servidor (`src/`, `bin/`)

- **Escrita só dentro do projeto.** Toda ferramenta que recebe caminho passa por `dentro()` de `src/ferramentas.js`. Não há exceção.
- **Nenhuma chave em arquivo nem em resposta da API.** Chave vem de `process.env`; o que vai para a tela diz só se a variável existe.
- **Processo filho:** use `rodar` (tempo-limite, morte da árvore, aspas no Windows) e parta de `ambienteLimpo()`. Para o aplicativo de um provedor, respeite `chavesARetirar`.
- **Rotas:** toda rota de `/api/` exige a chave de acesso. Entrada do corpo é validada antes de usar; erro de validação responde 400 com uma frase que a tela pode mostrar.
- **Estado que precisa sobreviver** a fechar a Muvuca vai para um arquivo na pasta de dados. Arquivo guardado é validado de novo ao ler; se não valer mais, é renomeado para `.invalido` (nunca apagado) e o programa sobe com o valor de fábrica.
- **Várias conversas ao mesmo tempo:** nada de estado global por pedido; o estado é da sessão.
- **Mudou arquivo do servidor, reinicie-o** para testar ao vivo (a tela não precisa).
- Teste novo de rota usa `subir()` de `test/apoio/servidor-de-teste.js`, com pasta de dados em `os.tmpdir()`.
