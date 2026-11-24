# Produto

A Muvuca é um painel local: roda no computador de quem usa, abre no navegador (ou no aplicativo de mesa) e coordena um time de agentes de IA sobre **uma pasta de projeto**.

## Para quem

Pessoas que já usam uma assinatura de IA pela linha de comando (Claude Code, principalmente) e querem ver um time trabalhando: plano, execução, testes e revisão, com tudo visível e reversível. Parte do público é de alunos; a tela precisa se explicar sozinha.

## O protocolo de um pedido

1. O **líder** planeja e distribui as tarefas (conforme a arquitetura do time: centralizada, esteira, rede, com sub-líder).
2. Os **subagentes** executam, escrevendo só na pasta do projeto.
3. O **portão de testes** roda os testes do projeto, isolados; reprovou, volta para correção.
4. O **revisor** aprova ou devolve.
5. A pessoa vê o diff e escolhe **manter** ou **descartar**.

Em volta disso: construtor de times, especificação em etapas, rotinas e vigias, memória e lições do time, conexões (MCP), várias conversas ao mesmo tempo, exportação do time e a Buzina (a mascote salsicha, que não pode sumir).

## Promessas que não se quebram

- **O time só escreve na pasta do projeto.** Nada fora dela, nunca.
- **Nenhuma chave em arquivo.** Chaves vêm de variáveis de ambiente; logins ficam com o aplicativo do provedor.
- **Tudo local.** O servidor escuta só em `localhost` e pede a chave de acesso (`acesso.token`).
- **Nada some sem aviso.** O que a pessoa montou (time, projetos, preferências, memória) sobrevive a fechar, reiniciar e atualizar.
- **Erro diz o que fazer.** Mensagem para quem usa explica a causa e o próximo passo, em português, sem jargão.
- **O modo demonstração funciona sem IA nenhuma**, sem custo, e mostra o protocolo inteiro.

## Tom

Texto de tela e documentação: direto, em português do Brasil, falando com quem usa ("você"). Nada de inglês onde há palavra em português.
