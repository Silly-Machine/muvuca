---
paths:
  - "public/**"
---

# Ao mexer na tela (`public/`)

- **Sem framework, sem build, nada no escopo global.** `index.html` traz a estrutura; `css/` os estilos (`estilo.css` estrutura, `tema.css` tema); `js/` um módulo por parte da tela.
- **Ordem de carga:** `principal.js` importa os módulos em ordem. Um módulo só importa dos carregados **antes** dele. Para chamar algo carregado depois, registre em `tardias.js` (`Object.assign(depois, { ... })`).
- **Estado que mais de uma parte altera** fica em `estado.js`.
- **Lógica que não precisa do navegador** vai para `public/js/regras/`, com teste em `test/tela.test.js`. Esse teste também confere as regras de estrutura acima: rode-o depois de criar ou mover módulo.
- **Elemento escondido:** se uma regra de `display` venceria o atributo `hidden`, acrescente a regra `[hidden] { display:none !important; }` para aquele bloco.
- **Texto da tela** em português, falando com quem usa; erro diz a causa e o próximo passo.
- **A Buzina** (mascote salsicha) e os personagens do time são parte do produto: nenhuma mudança de layout pode escondê-los.
- **Confira no navegador** antes de dizer que terminou: suba a Muvuca com outra pasta de dados (`npm start -- --dados ./dados-de-teste --porta 4320`), abra pelo endereço com a chave e olhe o console. Arquivos de `public/` são lidos do disco: basta recarregar.
