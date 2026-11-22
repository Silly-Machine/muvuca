# Como contribuir

Obrigado pelo interesse na Muvuca. Este arquivo mostra como rodar o projeto, o que conferir antes de mandar uma mudança e as convenções do código.

## Rodar

Precisa de Node 22 ou mais novo.

```sh
git clone https://github.com/Silly-Machine/muvuca.git
cd muvuca
npm start
```

O servidor não tem dependências, então `npm install` só é necessário para o aplicativo de mesa:

```sh
npm install
npm run app            # abre o aplicativo de mesa em modo de desenvolvimento
npm run instalador     # gera o instalador do sistema em que você está (pasta dist/)
```

A tela (`public/index.html`) é lida do disco a cada pedido: basta recarregar a página. Mudanças nos arquivos do servidor pedem reinício.

Para não misturar testes com os seus dados, use outra pasta de dados: `npm start -- --dados ./dados-de-teste --porta 4320`.

## Onde fica cada coisa

| Pasta | O que tem |
|---|---|
| `src/` | o programa: servidor, orquestração, ferramentas, provedores |
| `public/` | a tela e as imagens dos personagens |
| `config/` | time de fábrica (`agentes.json`), biblioteca de agentes e modelos prontos de time |
| `bin/`, `electron/` | o comando `muvuca` e o aplicativo de mesa |
| `test/` | testes automáticos; `test/apoio/` tem os aplicativos falsos que eles usam |
| `scripts/` | lançamento de versões e roteiros de teste ao vivo |
| `assets/` | fontes dos personagens e os scripts que geram `public/bonecos/` |
| `docs/` | guia, processo de versões e imagens da documentação |

Rode os testes com `npm test`, não com `node --test` puro: sem o padrão de nomes, o Node executaria também os arquivos de `test/apoio/` como se fossem testes.

## Antes de mandar

1. `npm test` passa. São 43 testes, cerca de 1 minuto.
2. Se a mudança mexe em rotas do servidor, rode a bateria ao vivo: com o servidor em modo demonstração e a pasta padrão vazia, `npm run bateria`.
3. Se a mudança aparece na tela, abra e confira no navegador. Diga no pull request o que você conferiu.
4. Comportamento novo vem com teste. Correção de erro vem com um teste que falhava antes.
5. Atualize o `CHANGELOG.md` e, quando o comportamento muda para quem usa, o `docs/guia.md`.

## Convenções

- **Português do Brasil** em nomes, comentários, mensagens e documentação, com todos os acentos.
- **Sem dependências no servidor.** Só módulos do próprio Node. Dependência nova, só de desenvolvimento e com motivo.
- **Sem framework na tela.** HTML, CSS e JavaScript num arquivo só.
- **Comentário explica o porquê**, não repete o que a linha faz.
- **Nenhuma chave em arquivo.** Provedores por API leem a chave de uma variável de ambiente.
- **O time só escreve na pasta do projeto.** Toda ferramenta nova passa pela função `dentro()` de `src/ferramentas.js`.

## Relatar um erro

Abra uma issue com: o que você fez, o que esperava, o que aconteceu, a versão (aparece ao lado do título, na tela), o sistema operacional e, se usou o Claude de verdade, a saída de `claude --version`. Se o erro apareceu na conversa, copie o texto dele.

Para falhas de segurança, não abra issue pública: escreva para os mantenedores pela aba Security do repositório.

## Versões

O número segue `maior.menor.correção`. Cada mudança que quem usa vai notar ganha uma linha na seção "Em andamento" do `CHANGELOG.md`. Para lançar: `npm run lancar -- correcao` (ou `menor`, `maior`). A tag criada dispara a geração dos instaladores e a publicação na página de Releases. O processo completo está em [docs/versoes.md](docs/versoes.md).
