# Desenho: chave de API e assinatura

## Visão geral

Antes de chamar o aplicativo de um provedor `cli`, a Muvuca decide quais variáveis de chave tirar do ambiente do processo filho. A decisão vem de uma pergunta ao próprio aplicativo (`claude auth status`) feita **sem** as chaves: se ele responde que há login, é a assinatura, e as chaves saem.

## Onde mexe

| Arquivo | Mudança |
|---|---|
| `src/provedores.js` | `chavesARetirar(prov, env)`, `esquecerAssinatura()`, `SEM_CREDITO`; `cli()` aplica as retiradas e traduz o erro de crédito |
| `test/chave-api.test.js` | os cinco casos |
| `test/apoio/falso-cli-chave.js` | aplicativo falso: responde a `auth status` e diz se recebeu a chave |
| `docs/guia.md`, `CHANGELOG.md` | explicação para quem usa |

## Comportamento

1. `chavesDe(prov)`: as variáveis de chave do aplicativo. Vêm de `prov.variaveisDeChave` ou, por comando, da tabela `CHAVES_DO_CLI` (`claude` → `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`).
2. `chavesARetirar`: devolve `[]` se `usarChaveDeApi` é `true` ou se nenhuma das variáveis está no ambiente. Senão pergunta `temAssinatura` e devolve as presentes quando há login.
3. `temAssinatura`: roda `<comando> auth status` (ou `prov.argsStatus`) com as chaves fora do ambiente e lê `loggedIn` do JSON. Resposta positiva fica guardada enquanto o processo vive; negativa, por 60 segundos (a pessoa pode entrar pela tela logo depois).
4. `rodar` recebe as variáveis com valor `undefined`: o Node não as passa ao filho. Não é preciso mudar `rodar`.

## Erros e mensagens

Saída com "Credit balance is too low" e código diferente de zero vira erro com o nome da variável presente e as três saídas possíveis. Sem variável no ambiente, a mensagem manda conferir `auth status`.

## Testes

| Critério | Teste |
|---|---|
| 1.1 | "com assinatura logada, a chave de API fica de fora e o time usa a assinatura" |
| 1.2 | "sem a variável no ambiente, nada muda" |
| 2.1 | "sem assinatura logada, a chave de API continua indo para o aplicativo" |
| 2.2 | "\"usarChaveDeApi\" mantém a chave mesmo com assinatura" |
| 3.1 | "chave sem crédito e sem assinatura: o erro diz qual variável e o que fazer" |

Ao vivo, com o `claude` real: chave inválida no ambiente e assinatura logada, o pedido responde normalmente.

## Alternativas descartadas

- **Tirar a chave sempre.** Quebraria quem só tem a chave (requisito 2).
- **Só avisar na tela.** A pessoa continuaria parada até mexer no terminal.
- **Ler o arquivo de credenciais do Claude Code.** Formato não é contrato, e a Muvuca promete não ver o acesso.

## Riscos

- O `auth status` de uma versão futura mudar de formato: sem `loggedIn`, a Muvuca conclui "sem assinatura" e mantém a chave, que é o comportamento de antes.
