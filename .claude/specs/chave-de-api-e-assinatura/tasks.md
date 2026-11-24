# Tarefas: chave de API e assinatura

- [x] 1. Decidir o que tirar do ambiente
  - `chavesARetirar`, `temAssinatura` e a tabela `CHAVES_DO_CLI` em `src/provedores.js`
  - teste: com e sem assinatura, com `usarChaveDeApi`, sem a variável
  - _Requisitos: 1.1, 1.2, 1.3, 2.1, 2.2_

- [x] 2. Aplicar na chamada do aplicativo
  - `cli()` passa as variáveis retiradas como `undefined` no `env` de `rodar`
  - teste: o aplicativo falso responde `SEM-CHAVE`
  - _Requisitos: 1.1_

- [x] 3. Traduzir o erro de crédito
  - `SEM_CREDITO` e a mensagem com o nome da variável
  - teste: o erro cita a variável e não o valor
  - _Requisitos: 3.1, 3.2_

- [x] 4. Provar com o Claude de verdade
  - chave inválida no ambiente, assinatura logada: o pedido responde
  - _Requisitos: 1.1_

- [x] 5. Documentar
  - `CHANGELOG.md` e a seção "Entrar com o Claude" do `docs/guia.md`
  - _Requisitos: todos_
