---
name: testar-ao-vivo
description: Sobe a Muvuca com dados de teste e confere uma mudança de verdade, na tela ou pela API, em modo demonstração ou com o Claude real. Use depois de mexer em rotas do servidor ou na tela, ou quando a pessoa pedir para ver funcionando, rodar a bateria ou provar com o Claude de verdade.
---

# Testar ao vivo

Os testes automáticos (`npm test`) vêm primeiro. Isto é o passo seguinte: ver a mudança funcionando no programa de pé.

## Regras

- **Nunca use os dados de quem está na máquina.** Suba sempre com outra pasta de dados e outra porta.
- **A pasta de projeto do teste é descartável** e nunca é o repositório da Muvuca. Se a pessoa indicou uma pasta de teste, use só ela e devolva-a como estava.
- **Pare o servidor no fim.**

## Subir

```sh
MUVUCA_DADOS="$TMPDIR/muvuca-dados-teste" MUVUCA_PORTA=4320 node src/servidor.js
```

(No Windows, pelo Git Bash, use `$TEMP`.) Rode em segundo plano. A chave de acesso fica em `acesso.token`, dentro da pasta de dados:

- no navegador: `http://localhost:4320/?t=<chave>`;
- na API: cabeçalho `x-muvuca-token: <chave>`.

Mudou arquivo de `src/`, reinicie o servidor. Mudou `public/`, basta recarregar a página.

## O que conferir

| Mudança | Como |
|---|---|
| tela | abrir no navegador, usar o recurso, olhar o console; conferir também em janela estreita |
| rota | chamar pela API e ver a resposta e o arquivo gravado na pasta de dados |
| várias rotas | `npm run bateria`, com o servidor em modo demonstração e a pasta de dados nova (`MUVUCA_DADOS` apontando para ela) |
| algo que só o provedor real mostra | time no provedor `claude-cli`, com o Claude Code logado; use o modelo mais barato e um pedido pequeno |

## Modo demonstração ou Claude de verdade

A preferência `provedorTime` decide: `demo` (roteiro fixo, sem custo) ou `claude-cli`. Comece pela demonstração. Vá ao Claude real quando a mudança toca a chamada do aplicativo, a leitura da saída dele, o login ou o isolamento dos testes, e diga no relato qual dos dois foi usado.

## Relato

Diga o que foi conferido, em qual modo e em qual sistema, e o que **não** foi. Se algo só foi provado em demonstração, escreva isso.

## Parar

No Windows: `Get-NetTCPConnection -LocalPort 4320 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`. Nos outros: encerre o processo que você iniciou.
