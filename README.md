<div align="center">

<img src="docs/img/logo.png" alt="Logo da Muvuca: dois círculos, um cinza-escuro e um laranja" width="112">

# Muvuca

**Um time de agentes de IA trabalhando no seu projeto, na sua máquina, com você no comando.**

[![Testes](https://github.com/Silly-Machine/muvuca/actions/workflows/testes.yml/badge.svg)](https://github.com/Silly-Machine/muvuca/actions/workflows/testes.yml)
[![Instaladores](https://github.com/Silly-Machine/muvuca/actions/workflows/instaladores.yml/badge.svg)](https://github.com/Silly-Machine/muvuca/actions/workflows/instaladores.yml)
![Versão](https://img.shields.io/badge/vers%C3%A3o-1.0.0-f28a2e)
![Node](https://img.shields.io/badge/node-%E2%89%A5%2022-5f565c)
![Dependências](https://img.shields.io/badge/depend%C3%AAncias%20do%20servidor-0-5f565c)
[![Licença](https://img.shields.io/badge/licen%C3%A7a-MIT-f28a2e)](LICENSE)

<img src="docs/img/palco.png" alt="Tela da Muvuca: o líder Maestro no topo e quatro especialistas abaixo, ligados por setas" width="880">

</div>

## O que é

A Muvuca é um painel local para trabalhar com um time de agentes de IA. Você escreve um pedido; um líder monta o plano, especialistas executam, os testes rodam e um revisor confere. No fim você vê o que mudou, arquivo por arquivo e com o autor de cada um, e decide se mantém ou descarta tudo.

Ela roda no seu computador e usa o **seu** Claude: o aplicativo `claude` (Claude Code) já logado na sua assinatura. Nenhuma chave de API é necessária, e nada do seu projeto passa por um servidor da Muvuca, porque não existe um.

> **Estado do projeto:** versão 1.0.0, a primeira estável. Os fluxos principais foram provados com o Claude de verdade e há testes automáticos nos três sistemas. Dois avisos honestos: os instaladores ainda não são assinados (o Windows e o macOS mostram um aviso ao abrir) e não há atualização automática. Leia [o que foi testado e o que não foi](docs/guia.md#o-que-foi-testado-e-o-que-não-foi) antes de apontá-la para um projeto importante.

## Destaques

- **Você decide o que fica.** O time escreve só dentro da pasta do projeto. Cada pedido termina num diff, com "Manter" ou "Descartar"; descartar devolve a pasta ao que era.
- **Portão de testes e revisor.** Os testes são rodados pela Muvuca, não pelo agente que escreveu o código. O que não passa volta para quem fez, até um limite de devoluções.
- **Cinco arquiteturas de time**, com sete modelos prontos: agente único, supervisor, hierárquica, esteira e rede.
- **Construtor visual.** Monte o time arrastando agentes, desenhe as setas de quem responde a quem, apague com a borracha, desfaça com Ctrl+Z.
- **Exportar para outra IA.** A arquitetura montada sai como `AGENTS.md`, JSON e subagentes do Claude Code, para ser usada fora da Muvuca.
- **Modelo certo para cada tarefa.** Tarefa simples vai para o modelo leve, revisão vai para o mais forte. Cada agente pode ter o seu.
- **Especificação em etapas.** Um trabalho grande vira um plano de etapas que o time cumpre uma a uma, com pausa, retomada e progresso guardado.
- **Rotinas, vigias, quadro de tarefas e memória.** Pedidos agendados, vigias que chamam o time quando um comando falha, um quadro com o andamento de cada tarefa, notas que cada agente guarda por projeto e lições que valem para o time inteiro.
- **Anexos.** Arraste arquivos ou pastas para a caixa do pedido.
- **Vários pedidos ao mesmo tempo.** Abra até quatro conversas, cada uma com o próprio time e a própria pasta, e alterne entre elas enquanto trabalham.
- **Histórico e uso.** As conversas encerradas ficam guardadas para reler, e cada pedido termina dizendo quanto tempo levou e, com o Claude Code, quantos tokens usou.
- **Conexões (MCP).** Dê aos agentes de leitura acesso a documentação, issues ou um banco de dados, uma conexão por agente, sem gravar nenhum token.
- **Modo demonstração.** Um roteiro simulado, sem conta e sem custo, para conhecer a tela.

<div align="center">
<img src="docs/img/construtor.png" alt="Galeria de modelos de time do construtor" width="430">
<img src="docs/img/boas-vindas.png" alt="Tela de boas-vindas com as duas escolhas iniciais" width="430">
</div>

## Instalação

Para usar o Claude de verdade, instale antes o [Claude Code](https://claude.com/claude-code). O login você faz pela própria Muvuca: o botão **"Entrar com o Claude"** abre a página de login no navegador. Sem o Claude Code, a Muvuca funciona em modo demonstração.

### 1. Aplicativo de mesa (Windows, macOS e Linux)

Baixe o instalador do seu sistema na página de [Releases](https://github.com/Silly-Machine/muvuca/releases):

| Sistema | Arquivo |
|---|---|
| Windows | `Muvuca.Setup.x.y.z.exe` |
| macOS | `Muvuca-x.y.z-arm64.dmg` (Apple Silicon) ou `Muvuca-x.y.z.dmg` (Intel) |
| Linux | `Muvuca-x.y.z.AppImage` |

Os instaladores ainda não são assinados. Na primeira abertura, o Windows mostra o aviso do SmartScreen ("Mais informações" e depois "Executar assim mesmo") e o macOS pede para abrir com o botão direito e "Abrir".

### 2. Pelo terminal, sem instalar

Precisa de Node 22 ou mais novo.

```sh
npx github:Silly-Machine/muvuca
```

O comando sobe o servidor local e abre a tela no navegador. Opções: `--porta 4318`, `--dados PASTA`, `--sem-abrir`, `--ajuda`.

### 3. Do código-fonte

```sh
git clone https://github.com/Silly-Machine/muvuca.git
cd muvuca
npm start            # servidor + navegador; não precisa de "npm install"
```

Para o aplicativo de mesa em modo de desenvolvimento: `npm install` e depois `npm run app`.

## Primeiros passos

1. **Boas-vindas.** Na primeira abertura, escolha quem faz o trabalho (Claude de verdade ou demonstração) e a pasta do projeto.
2. **Peça.** Escreva o pedido na caixa de texto, por exemplo: "Crie uma página de status com um endpoint /health".
3. **Acompanhe.** O palco mostra quem está pensando, trabalhando ou esperando; o quadro mostra cada tarefa.
4. **Decida.** Leia o diff e escolha "Manter mudanças" ou "Descartar".

Comece por uma pasta vazia ou por um projeto com cópia de segurança (um repositório git, por exemplo).

## Como funciona

```mermaid
flowchart LR
    P([Seu pedido]) --> L[Líder<br/>monta o plano]
    L --> E[Especialistas<br/>executam]
    E --> T{Portão<br/>de testes}
    T -- falhou --> E
    T -- passou --> R{Revisor}
    R -- devolve --> E
    R -- aprova --> D([Diff para você<br/>manter ou descartar])
```

O desenho acima é o do supervisor. As outras arquiteturas mudam quem planeja e quem passa o trabalho para quem:

| Arquitetura | Como o trabalho anda |
|---|---|
| Agente único | um agente faz tudo; o portão de testes ainda confere |
| Supervisor | um líder planeja e distribui; todos respondem a ele |
| Hierárquica | o líder divide entre sub-líderes, e cada um planeja para o próprio time |
| Esteira | sem líder: cada etapa passa o trabalho para a seguinte |
| Rede | sem chefe: quem termina a sua parte escolhe quem continua |

O [guia](docs/guia.md) explica cada parte em detalhe: provedores, construtor, rotinas, memória, proteções e limites.

## Estrutura do repositório

```sh
muvuca
    ├── src/                 : o programa (servidor local e orquestração do time)
    │   ├── servidor.js      : servidor HTTP local e API da tela
    │   ├── orquestrador.js  : o protocolo do time (plano, execução, portão, revisão)
    │   ├── ferramentas.js   : arquivos, comandos, foto do projeto e restauração
    │   ├── provedores.js    : Claude Code, APIs compatíveis com OpenAI e demonstração
    │   └── ...              : times, rotinas, memória, preferências, Buzina
    ├── public/              : a tela, sem framework
    │   ├── index.html       : a estrutura da página
    │   ├── css/             : estrutura e tema
    │   ├── js/              : um módulo por parte da tela; js/regras/ tem a lógica com testes
    │   └── bonecos/         : os personagens
    ├── config/              : time de fábrica, biblioteca de agentes e modelos prontos de time
    ├── bin/                 : o comando "muvuca"
    ├── electron/            : o aplicativo de mesa
    ├── test/                : testes automáticos
    ├── scripts/             : lançamento de versões e testes ao vivo
    ├── assets/              : fontes dos personagens (não vão no aplicativo)
    └── docs/                : guia completo, processo de versões e imagens
```

Seus dados (preferências, projetos, rotinas, memória, times salvos) ficam em `~/.muvuca`, fora do repositório e fora da pasta do aplicativo.

## Testes

```sh
npm test                    # 104 testes automáticos, cerca de 1 minuto
npm run bateria             # 225 verificações ao vivo, com o servidor em demonstração
```

Os testes automáticos rodam no GitHub Actions em Windows, macOS e Linux a cada envio. Detalhes em [Bateria de testes](docs/guia.md#bateria-de-testes).

## Segurança

- **Só o seu computador alcança o servidor.** Ele atende em `127.0.0.1` e recusa pedidos feitos por outro nome de endereço, o que impede um site aberto no navegador de ler a sua conversa.
- **Chave de acesso.** A API e a página pedem uma chave guardada na pasta de dados, que só a sua conta do computador lê. O link que a Muvuca abre leva a chave uma vez, e o navegador segue com um cookie.
- **A página não busca nada na internet.** Fontes, estilos e scripts vêm do próprio servidor, e uma política de conteúdo impede carregar qualquer coisa de fora.
- **Os agentes usam as ferramentas de arquivo só dentro da pasta do projeto.** Arquivos `.env` ficam protegidos. Com o Claude Code, quem escreve só consegue rodar `node --test` e `npm test`.
- **Os testes rodam isolados.** O código de teste que um agente escreve só lê e escreve dentro da pasta do projeto e de uma pasta temporária, e não consegue abrir outros processos. Vale para `node --test`; outros comandos de teste rodam como antes, e a tela avisa. A rede não é bloqueada.
- **Nenhuma chave de API fica em arquivo.** Provedores por API e conexões leem a chave de uma variável de ambiente.
- **Conexões (MCP) vêm desligadas**, só chegam aos agentes que você marcar e nunca a quem escreve arquivos. Dá para liberar só algumas ferramentas de cada uma.
- **O "Descartar" avisa o que não cobre.** Ele restaura o projeto inteiro, incluindo `dist/` e `build/`. Ficam de fora `node_modules/`, `.git/`, ambientes virtuais do Python e arquivos acima de 25 MB; quando algo disso muda, a tela diz.

## Roteiro

- [x] Dados do usuário fora da pasta do aplicativo e primeira abertura guiada
- [x] Comando `muvuca` e aplicativo de mesa para Windows, macOS e Linux
- [ ] Instaladores assinados e atualização automática
- [x] Isolar a execução dos testes escritos pelos agentes
- [ ] Isolar também a rede e os comandos de teste que não são `node --test`
- [ ] Aprovação ação por ação nas conexões, e conexões para quem escreve código
- [x] Mais de um pedido ao mesmo tempo, em conversas paralelas
- [x] Especificação em etapas, vigias e lições do time
- [ ] Tela para celular e testes automáticos da tela
- [x] Publicação no npm (`npx muvuca`)
- [ ] Tirar do repositório as imagens-fonte dos personagens (`assets/personagens/plush/gpt/`, 41 MB dos 48 MB) e guardá-las como anexo de uma versão
- [ ] Celular como controle remoto da Muvuca do computador (PWA com pareamento)

## Contribuir

Ideias, relatos de erro e correções são bem-vindos. Veja [CONTRIBUTING.md](CONTRIBUTING.md) para rodar o projeto e os testes, o [histórico de mudanças](CHANGELOG.md) para o que já entrou e [como as versões são lançadas](docs/versoes.md).

## Licença

[MIT](LICENSE) © Silly Machine.

A Muvuca é um projeto independente e não é afiliada à Anthropic. "Claude" e "Claude Code" são marcas da Anthropic.
