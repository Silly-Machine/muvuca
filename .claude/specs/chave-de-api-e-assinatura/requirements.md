Estado: concluída (24/11/2026)

# Requisitos: chave de API e assinatura

## Introdução

Uma pessoa instalou a Muvuca pelo npm e nenhum pedido funcionava: "Credit balance is too low". O terminal dela tinha `ANTHROPIC_API_KEY` no `~/.bashrc`; a Muvuca herdava a variável e a repassava ao `claude`, que então usava a chave de API (cobrada à parte, sem crédito) em vez da assinatura logada. Nada na tela dizia isso.

## Fora do escopo

- Gerenciar ou guardar chaves de API.
- Mexer no `~/.bashrc` de quem usa.
- Outros aplicativos (`codex`, `gemini`), além de deixar o caminho aberto para eles.

## Requisitos

### Requisito 1: a assinatura vence a chave herdada

**História:** Como quem usa a assinatura do Claude, quero que a Muvuca use a assinatura mesmo havendo uma chave de API no meu terminal, para não ser cobrado à parte nem ficar parado.

#### Critérios de aceite

1. QUANDO o ambiente tem `ANTHROPIC_API_KEY` ou `ANTHROPIC_AUTH_TOKEN` e há login de assinatura, O SISTEMA DEVE chamar o `claude` sem essas variáveis.
2. QUANDO o ambiente não tem essas variáveis, O SISTEMA DEVE chamar o `claude` como antes, sem verificação a mais.
3. O SISTEMA DEVE descobrir se há login de assinatura perguntando ao próprio aplicativo, sem ler arquivos de credenciais.

### Requisito 2: quem só tem a chave continua trabalhando

**História:** Como quem usa o Claude Code só com chave de API, quero que a Muvuca continue usando a minha chave, para não perder o que já funcionava.

#### Critérios de aceite

1. QUANDO há chave no ambiente e não há login de assinatura, O SISTEMA DEVE manter a chave ao chamar o aplicativo.
2. QUANDO o provedor tem `"usarChaveDeApi": true`, O SISTEMA DEVE manter a chave mesmo havendo assinatura.

### Requisito 3: o erro de crédito se explica

**História:** Como quem usa a Muvuca, quero entender por que o time parou, para resolver sozinho.

#### Critérios de aceite

1. SE o aplicativo falhar por falta de crédito e houver chave no ambiente, ENTÃO O SISTEMA DEVE dizer o nome da variável e o que fazer (entrar com a assinatura, pôr crédito ou abrir sem a variável).
2. O SISTEMA DEVE nunca mostrar o valor da chave.
