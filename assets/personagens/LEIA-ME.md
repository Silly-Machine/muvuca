# Personagens da Muvuca: pacote para redesenho

São 16 personagens desenhados em SVG por código, cada um com 5 estados animados. Este pacote serve para alguém (pessoa ou IA) melhorar o visual e devolver num formato que volte para a Muvuca sem quebrar nada.

## O que tem aqui

| Arquivo | Para quê |
|---|---|
| `folha.png` e `folha.html` | Todos os personagens nos 5 estados, para ver de uma vez. O `.html` mostra as animações. |
| `*.svg` (16) | Um personagem por arquivo, já animado, que funciona sozinho. O estado é o atributo `data-estado` da raiz. |
| `png/*.png` (16) | O mesmo personagem em PNG com fundo transparente, no estado "disponível", para quem trabalha só com imagem. |
| `personagens.js` | **O código-fonte de verdade.** É esta forma que volta para a Muvuca. |
| `animacoes.css` | As animações e os estados. Os SVGs já trazem uma cópia embutida. |

## Personagens e para quem são

| Arquivo | Personagem | Agente |
|---|---|---|
| `cartola` | Maestro de cartola | líder |
| `regente` | Cápsula de batuta | sub-líder |
| `engrenagem` | Engrenagem (os dentes giram) | back-end |
| `cristal` | Cristal lapidado | front-end |
| `pilha` | Pilha de discos | dados |
| `polvo` | Polvo | testes |
| `livro` | Livro | documentação |
| `nuvem` | Nuvem | UX |
| `cogumelo` | Cogumelo | produto |
| `foguete` | Foguete | DevOps |
| `gato` | Gato vigia | segurança |
| `lente` | Esfera de lente | pesquisa |
| `planta` | Vaso de planta | generalista |
| `escudo` | Escudo de óculos | revisor |
| `tela` | Monitor de antena | (livre) |
| `gota` | Gota | (livre) |

## Os 5 estados

| `data-estado` | Como aparece |
|---|---|
| `disponivel` | Respira, pisca e balança a antena ou o topete. |
| `pensando` | Inclina, olha para cima, mostra a bolha de três pontos. |
| `trabalhando` | Olhos de foco, boca reta, notebook na frente, mãos e pés batucando. |
| `concluido` | Pula, faz olhos felizes, ganha bochechas e estrelinhas. |
| `aguardando` | Olhos arregalados, tremidinha, alerta vermelho. |

## Como devolver (o contrato)

A Muvuca troca o trecho `/* ---------- personagens ---------- */` do `public/index.html` pelo conteúdo de `personagens.js`. Para isso funcionar:

1. **Uma função por personagem**, em `PERSONAGENS[nome] = (c) => "...svg..."`, devolvendo só o miolo do desenho (sem a tag `<svg>`). Os nomes das chaves não mudam, porque os arquivos de time usam esses nomes.
2. **Área de desenho de 160 × 170.** O chão fica perto de y = 158, onde está a sombra. O boneco precisa caber sem cortar a bolha de pensamento (canto superior direito, por volta de x 104–150, y 6–28) nem o alerta (por volta de x 130, y 20).
3. **Cores vêm de `c`.** Use `c.cor` (cor base), `c.cla` (mais clara), `c.esc` (mais escura) e o gradiente `url(#${c.g})`. A cor de cada agente é escolhida pelo usuário, então não fixe a cor do corpo. Detalhes neutros (branco, `TINTA` para olhos e boca) podem ser fixos.
4. **Rosto pela função `rosto(x1, x2, y, r)`.** Ela já traz as cinco expressões (normal, foco, feliz, susto, boca curva, reta e aberta, bochechas). Se a outra IA desenhar um rosto próprio, ele precisa manter estas classes, cada uma com o seu papel:
   - `o-normal`, `o-foco`, `o-feliz`, `o-susto` (olhos);
   - `b-curva`, `b-reta`, `b-aberta` (boca);
   - `bochecha`.
5. **Classes que a animação procura.** Sem elas o boneco fica parado em algum estado:

   | Classe | Comportamento |
   |---|---|
   | `mao-e`, `mao-d` | Batucam ao trabalhar (use `maos(c, x1, x2, y)`). |
   | `pe-e`, `pe-d` | Batucam ao trabalhar (use `pes(c, x1, x2, y)`). |
   | `antena`, `tufo` | Balançam (o pivô é a base). |
   | `led` | Pisca. |
   | `giro` | Gira; mais rápido trabalhando. |
   | `faceta-brilho` | Brilha devagar. |
   | `pupila` | Olha para os lados. |

6. **Sem bibliotecas nem imagens externas.** Só SVG em texto. Os bonecos aparecem do tamanho de 46 px (biblioteca) até 190 px (palco), então detalhe muito fino some no pequeno.
7. **O resto do desenho fica com a função `mascote()`**: a sombra, o notebook, a bolha, o alerta e as estrelinhas. Pode ajustar, mas sem tirar as classes `notebook`, `digitando`, `alerta`, `estrelas`, `corpo` e `sombra`.

## Como conferir

Abra `folha.html` no navegador. Para ver uma versão nova:
1. Troque o trecho dos personagens no `public/index.html`.
2. Gere tudo de novo com `node assets/personagens/gerar.cjs`, rodado na pasta da Muvuca. Os PNGs saem pelo Edge sem janela; os comandos estão na conversa que gerou este pacote.
3. Ou abra `http://localhost:4317/?vitrine=disponivel,pensando,trabalhando,concluido,aguardando` com a Muvuca rodando.

