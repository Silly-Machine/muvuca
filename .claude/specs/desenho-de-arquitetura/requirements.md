Estado: em execução (24/11/2026). Aprovada com as decisões 1 a 4; fase 1 em andamento.

# Requisitos: desenho de arquitetura no construtor de times

## Introdução

O construtor monta o time, mas o desenho dele é só uma prévia: cabe na caixa ou não cabe, as setas não dizem o que significam, os avisos são um parágrafo, ninguém escolhe onde cada agente fica, e o time só sai da Muvuca como texto. A pesquisa ([pesquisa.md](pesquisa.md)) levantou o que Excalidraw, draw.io e editores de agentes (n8n, Dify, Flowise, LangGraph Studio, AutoGen Studio) fazem e que serve para desenhar um time de agentes. Esta especificação traz esses recursos, sem dependências e sem build, em cinco fases lançadas uma a uma.

## Decisões

1. **Desenho livre.** Cada agente tem posição própria e a pessoa arrasta para onde quiser. Os modelos de time trazem um desenho base fixo; quem aplica um modelo pode mudar o desenho à vontade, e o modelo original não muda.
2. **Bibliotecas: nenhuma.** O layout automático, o Mermaid e a imagem com o time embutido são feitos à mão, como funções puras com teste. Motivo principal: com o desenho livre, o layout precisa respeitar os agentes que a pessoa já posicionou, e o dagre não sabe fazer isso. Os times são pequenos (dezenas de agentes), então um algoritmo de camadas próprio basta e fica sob controle. O dagre (MIT, 17 KB gzip) só volta se os testes de cruzamento mostrarem resultado ruim.
3. **Versões em sequência, sem pular números.** Cada fase é uma versão menor: 1.1.0, 1.2.0, 1.3.0, 1.4.0 e 1.5.0, nessa ordem. Correções no meio do caminho saem como 1.1.1, 1.1.2 e assim por diante.
4. **Execução no grafo pelo caminho do n8n**, numa spec própria (`execucao-no-grafo`), que começa depois da 1.5.0 e sai como 1.6.0. Ela usa o desenho desta spec como base. Detalhes no fim deste arquivo.

## Fora do escopo

- Estilo à mão (rough.js), minimapa, camadas, várias páginas, tags, colaboração e link de compartilhamento.
- Roteamento de setas que desvia de obstáculos (A\*). As setas usam o cotovelo simples entre os lados mais próximos.
- Texto para diagrama com IA. Fica para uma spec própria.
- **Execução no grafo**: última rodada por agente, histórico projetado, aprovação humana, reexecutar a partir de um agente (decisão 4).
- Mudanças no protocolo dos pedidos. Tudo aqui é desenho e edição; o que roda continua igual.

## Fase 1 (1.1.0): a base do desenho livre

### Requisito 1: layout automático como ponto de partida

**História:** Como quem cria ou abre um time, quero que ele já apareça organizado, para só ajustar o que quiser.

#### Critérios de aceite

1. QUANDO um time não tem posições guardadas, O SISTEMA DEVE posicionar os agentes por camadas (líder no topo), reduzindo cruzamentos de setas, sem limite de níveis.
2. NA rede, O SISTEMA DEVE oferecer o desenho em anel ou em camadas.
3. QUANDO um agente novo entra no time, O SISTEMA DEVE pô-lo perto de onde foi criado ou solto, sem cobrir outro agente e sem mexer nos que já estão posicionados.
4. O SISTEMA DEVE produzir sempre o mesmo desenho para o mesmo time (sem aleatoriedade).
5. O cálculo DEVE ser uma função pura em `public/js/regras/`, com testes, que recebe as posições já fixadas e as respeita.

### Requisito 2: arrastar para onde quiser

**História:** Como quem desenha a arquitetura, quero pôr cada agente onde faz sentido para mim, para o desenho contar a história do meu jeito.

#### Critérios de aceite

1. QUANDO a pessoa arrasta um agente, O SISTEMA DEVE movê-lo, e as setas DEVEM acompanhar.
2. Mover um agente DEVE mudar só o desenho, nunca o time (quem responde a quem, funções, ferramentas).
3. O SISTEMA DEVE guardar as posições no time salvo e no JSON exportado; o servidor DEVE aceitar times com e sem posições.
4. Mover DEVE entrar no desfazer e refazer, um passo por arrasto.
5. O SISTEMA DEVE oferecer "reorganizar", que refaz o layout automático do time inteiro e pode ser desfeito.
6. QUANDO a pessoa aplica um modelo da galeria, O SISTEMA DEVE usar o desenho base do modelo; QUANDO o time veio de um modelo, O SISTEMA DEVE oferecer "voltar ao desenho do modelo".
7. Os modelos de fábrica (`config/`) DEVEM trazer o desenho base gravado, e nenhuma edição da pessoa pode alterá-los.
8. O palco, durante a execução, DEVE mostrar o time no mesmo desenho do construtor.

### Requisito 3: aproximar, afastar e mover a vista

**História:** Como quem monta um time grande, quero aproximar, afastar e arrastar a vista, para trabalhar num pedaço sem perder o resto.

#### Critérios de aceite

1. QUANDO a pessoa usa Ctrl + roda do mouse (ou a pinça do trackpad), O SISTEMA DEVE aproximar ou afastar mantendo fixo o ponto sob o cursor.
2. QUANDO a pessoa arrasta o fundo (ou segura espaço e arrasta), O SISTEMA DEVE mover a vista.
3. QUANDO a pessoa usa dois dedos numa tela de toque, O SISTEMA DEVE aproximar, afastar e mover.
4. O SISTEMA DEVE oferecer "caber na tela" (botão e Shift+1) e indicar o nível de zoom, entre 25% e 300%.
5. O SISTEMA DEVE manter o zoom escolhido quando o time muda; só "caber na tela" muda o zoom sozinho.
6. O SISTEMA DEVE manter funcionando o arrastar da biblioteca, o modo setas, a borracha e a lixeira em qualquer zoom.

### Requisito 3a: quadro, miniaturas e setas (pedido em 24/11/2026, durante a fase 1)

**História:** Como quem desenha o time, quero um quadro grande, agentes compactos que eu possa selecionar, e escolher o traço das setas, para o desenho ficar do meu jeito.

O número 3a mantém a numeração das fases seguintes. Os critérios 3 a 5 adiantam parte do requisito 12 (fase 4); a barra flutuante do 12.3 continua lá.

#### Critérios de aceite

1. QUANDO a pessoa aciona "Maximizar" (ou Esc para voltar), O SISTEMA DEVE abrir o quadro de desenho na janela inteira, com a biblioteca dentro dele, e enquadrar o time.
2. NA prévia, O SISTEMA DEVE mostrar cada agente como uma miniatura (cartão pequeno com o personagem e o nome), com as setas encostando na borda do cartão.
3. QUANDO a pessoa clica num agente, O SISTEMA DEVE selecioná-lo (e abrir o cartão, como antes); Shift ou Ctrl + clique DEVE somar ou tirar da seleção; Shift + arrastar no fundo DEVE selecionar por caixa; clique no fundo ou Esc DEVE desmarcar.
4. QUANDO a pessoa arrasta um agente selecionado, O SISTEMA DEVE mover a seleção inteira, num passo só do desfazer.
5. QUANDO há seleção e a pessoa aperta Delete (ou solta a seleção na lixeira), O SISTEMA DEVE tirar todos do time, num passo só do desfazer.
6. O SISTEMA DEVE oferecer setas quadradas (cotovelo de cantos vivos, o padrão) e arredondadas (curva suave), guardar a escolha no desenho do time (`desenho.setas`) e usá-la também no palco, no time salvo e no exportado.
7. O quadro grande DEVE ser fácil de achar: um botão no topo do construtor, outro na prévia e o clique duplo no fundo dela; aberto, mostra título e "Fechar".
8. QUANDO a pessoa arrasta um boneco no palco, O SISTEMA DEVE mudar só o lugar dele, guardar no time em uso e manter o lugar ao reabrir, mesmo durante um pedido.

## Fase 2 (1.2.0): ligar sem atrito

### Requisito 4: criar já ligado

**História:** Como quem monta um time, quero criar o próximo agente a partir de um que já existe, para não ter de criar e depois ligar.

#### Critérios de aceite

1. QUANDO o ponteiro para sobre um agente, O SISTEMA DEVE mostrar atalhos "+" nas direções que fazem sentido na arquitetura: subordinado (supervisor e hierárquica), próximo da esteira, vizinho (rede).
2. QUANDO a pessoa clica num atalho "+", O SISTEMA DEVE abrir a biblioteca junto do atalho e, escolhida a peça, criar o agente já ligado, posicionado naquela direção.
3. QUANDO a pessoa arrasta um atalho "+" até outro agente, O SISTEMA DEVE criar a ligação, como no modo setas.
4. QUANDO a pessoa, no modo setas, solta a seta no vazio, O SISTEMA DEVE abrir a biblioteca ali e criar o agente escolhido já ligado, naquele ponto.
5. SE a arquitetura não permite a ligação (por exemplo, subordinado de um executor no supervisor), ENTÃO O SISTEMA DEVE não mostrar aquele atalho.

### Requisito 5: a seta diz se vai dar certo antes de soltar

**História:** Como quem desenha, quero saber se a ligação é aceita enquanto ainda estou puxando a seta, para não descobrir só depois.

#### Critérios de aceite

1. ENQUANTO a pessoa puxa uma seta sobre um agente, O SISTEMA DEVE marcar a linha como aceita ou recusada, com cor e com forma (não só cor).
2. QUANDO a ligação seria recusada, O SISTEMA DEVE mostrar o motivo junto do ponteiro, com o mesmo texto que apareceria ao soltar.
3. QUANDO a ligação muda a arquitetura (supervisor que vira hierárquica) ou a função de alguém (executor que vira sub-líder), O SISTEMA DEVE avisar isso antes de soltar.
4. O SISTEMA DEVE decidir com as mesmas regras de `public/js/regras/setas.js`, sem alterar o rascunho enquanto a pessoa não soltar.

### Requisito 6: problemas que levam ao agente

**História:** Como quem monta um time, quero ver cada problema ligado ao agente que o causa, para corrigir sem procurar.

#### Critérios de aceite

1. O SISTEMA DEVE mostrar os avisos como uma lista, um item por problema, com a quantidade no título.
2. QUANDO o problema é de um agente, O SISTEMA DEVE marcar esse agente no desenho; QUANDO a pessoa clica no item, O SISTEMA DEVE trazer o agente para a vista, destacá-lo e abrir o cartão dele.
3. O SISTEMA DEVE separar o que impede aplicar o time (erro) do que só é recomendação (aviso, como "sem revisor").
4. O SISTEMA DEVE continuar deixando a decisão final com o servidor (`src/times.js`); a lista da tela não pode aceitar um time que o servidor recusa.

## Fase 3 (1.3.0): ler a arquitetura no desenho

### Requisito 7: setas com significado

**História:** Como quem olha o desenho (inclusive alunos), quero entender o que cada seta quer dizer sem ler a documentação.

#### Critérios de aceite

1. O SISTEMA DEVE mostrar, em cada seta, um rótulo curto conforme a relação: "delega" (chefe para subordinado), "depois" (esteira), "passa a vez" (rede), "revisa" (revisor).
2. O SISTEMA DEVE dar estilos diferentes às relações (por exemplo, a do revisor tracejada) e mostrar uma legenda da arquitetura atual.
3. O SISTEMA DEVE permitir esconder os rótulos, e lembrar a escolha.
4. SE dois rótulos se sobrepõem, ENTÃO O SISTEMA DEVE deslocar um deles ao longo da seta.

### Requisito 8: o agente mostra o que pode fazer

**História:** Como quem monta um time, quero ver no próprio personagem as ferramentas e o modelo, para conferir o time sem abrir cartão por cartão.

#### Critérios de aceite

1. O SISTEMA DEVE mostrar, junto do personagem, fichas das ferramentas (listar, ler, escrever, rodar) e o modelo ou nível fixo, quando houver.
2. QUANDO a pessoa clica numa ficha de ferramenta, O SISTEMA DEVE ligar ou desligar aquela ferramenta, respeitando as regras (revisor não escreve; líder e sub-líder não têm ferramentas).
3. O SISTEMA DEVE manter as fichas legíveis no zoom padrão e escondê-las quando o zoom for pequeno demais para lê-las.

### Requisito 9: sub-times em moldura

**História:** Como quem monta uma hierarquia, quero ver cada sub-líder com o time dele dentro de uma moldura, para enxergar as equipes.

#### Critérios de aceite

1. NA arquitetura hierárquica, O SISTEMA DEVE desenhar uma moldura com o nome do sub-líder em volta dele e de quem responde a ele, acompanhando os agentes onde estiverem.
2. QUANDO a pessoa arrasta a moldura, O SISTEMA DEVE mover o sub-time inteiro.
3. QUANDO a pessoa solta uma peça da biblioteca dentro da moldura, O SISTEMA DEVE pôr o agente no time daquele sub-líder.
4. QUANDO a pessoa dobra a moldura, O SISTEMA DEVE mostrar só o sub-líder com a quantidade de membros; desdobrar volta ao normal. Dobrar não muda o time.

### Requisito 10: notas no desenho

**História:** Como quem desenha ou ensina, quero deixar notas no desenho, para registrar por que o time é assim.

#### Critérios de aceite

1. O SISTEMA DEVE permitir criar, editar, mover e apagar notas curtas, presas a um agente ou soltas no desenho.
2. O SISTEMA DEVE guardar as notas no time salvo e no JSON exportado, e o servidor DEVE aceitar times com e sem notas.
3. O SISTEMA DEVE incluir as notas no AGENTS.md exportado, numa seção própria.
4. As notas DEVEM entrar no desfazer e refazer.

### Requisito 11: ensaio do caminho

**História:** Como quem aprende ou explica arquiteturas, quero ver por onde um pedido passaria no time desenhado, sem gastar nada.

#### Critérios de aceite

1. QUANDO a pessoa aciona "ensaiar", O SISTEMA DEVE animar no desenho o caminho de um pedido naquela arquitetura: plano, execução, portão de testes, revisão e, se houver, a devolução para correção.
2. O ensaio DEVE ser só visual: nada é chamado, nada é gravado.
3. O SISTEMA DEVE narrar cada passo em texto (também para leitor de tela) e permitir pausar e parar.

## Fase 4 (1.4.0): editar mais rápido

### Requisito 12: selecionar vários e agir sobre eles

**História:** Como quem reorganiza um time, quero selecionar vários agentes de uma vez, para mover, remover ou duplicar em bloco.

#### Critérios de aceite

1. O SISTEMA DEVE selecionar com clique, acrescentar com Shift + clique e selecionar por caixa arrastando no fundo com Shift.
2. QUANDO a pessoa arrasta um agente selecionado, O SISTEMA DEVE mover toda a seleção junto.
3. QUANDO há seleção, O SISTEMA DEVE mostrar uma barra flutuante com duplicar, remover, alinhar e editar (abre o cartão; com vários, o primeiro).
4. QUANDO a pessoa remove ou move vários, O SISTEMA DEVE desfazer tudo com um só Ctrl+Z.

### Requisito 13: alinhar, distribuir e encaixar

**História:** Como quem quer um desenho caprichado, quero alinhar os agentes sem acertar pixel por pixel.

#### Critérios de aceite

1. ENQUANTO a pessoa arrasta, O SISTEMA DEVE mostrar guias quando o agente se alinha a outro (centro ou bordas) e encaixar nelas; segurar Alt DEVE desligar o encaixe.
2. O SISTEMA DEVE alinhar a seleção (esquerda, centro, direita, topo, meio, base) e distribuir com espaço igual, na horizontal e na vertical.
3. O SISTEMA DEVE oferecer uma grade opcional, e lembrar a escolha.

### Requisito 14: copiar, colar e duplicar com as ligações

**História:** Como quem monta vários times, quero copiar um pedaço de um time e colar em outro, para reaproveitar equipes prontas.

#### Critérios de aceite

1. QUANDO a pessoa copia (Ctrl+C) uma seleção, O SISTEMA DEVE pôr na área de transferência o trecho do time em JSON, num formato reconhecível pela Muvuca e legível como texto.
2. QUANDO a pessoa cola (Ctrl+V) esse trecho, O SISTEMA DEVE criar os agentes com ids novos quando os ids já existem, mantendo as ligações entre eles e o desenho relativo, perto do ponteiro.
3. QUANDO a pessoa duplica (Ctrl+D) um sub-líder, O SISTEMA DEVE duplicar também o time dele, com as ligações.
4. SE o trecho colado não cabe na arquitetura (por exemplo, um sub-líder numa esteira), ENTÃO O SISTEMA DEVE ajustar as funções como já faz ao adicionar da biblioteca, e dizer o que ajustou.

### Requisito 15: teclado, paleta de comandos e acessibilidade

**História:** Como quem prefere o teclado, ou usa leitor de tela, quero montar e percorrer o time sem mouse.

#### Critérios de aceite

1. QUANDO a pessoa entra no desenho com Tab, O SISTEMA DEVE focar um agente; as setas do teclado DEVEM mover o foco para o agente mais próximo naquela direção, e Shift + setas DEVE mover o agente focado.
2. QUANDO a pessoa usa Alt + seta num agente focado, O SISTEMA DEVE criar o próximo agente ligado naquela direção, como no requisito 4.
3. O SISTEMA DEVE dar a cada agente um nome acessível com nome, função, a quem responde e quantas ligações tem, e anunciar as mudanças numa região `aria-live`.
4. QUANDO a pessoa usa Ctrl+K, O SISTEMA DEVE abrir uma paleta de comandos com busca que ignora acentos: adicionar peça, trocar arquitetura, buscar agente, reorganizar, caber na tela, exportar, desfazer.
5. QUANDO a pessoa aperta `?` fora de um campo, O SISTEMA DEVE mostrar todos os atalhos do construtor, tirados do mesmo mapa que os executa.

## Fase 5 (1.5.0): o time sai e volta

### Requisito 16: exportar como Mermaid

**História:** Como quem documenta um projeto, quero o time como diagrama Mermaid, para colar no README e o GitHub desenhar.

#### Critérios de aceite

1. O SISTEMA DEVE oferecer "Mermaid" na exportação, com copiar e baixar, gerando um `flowchart` com um nó por agente, as ligações da arquitetura e o revisor tracejado.
2. O SISTEMA DEVE colorir por função (`classDef`) e agrupar sub-times (`subgraph`) na hierárquica.
3. O SISTEMA DEVE incluir o time completo, com o desenho, num comentário `%%` do próprio Mermaid, para que a importação recupere tudo.
4. O SISTEMA DEVE incluir o Mermaid no AGENTS.md exportado.

### Requisito 17: importar time

**História:** Como quem recebeu um time de outra pessoa, quero trazê-lo para o construtor colando ou soltando um arquivo.

#### Critérios de aceite

1. QUANDO a pessoa cola ou solta no construtor um Mermaid gerado pela Muvuca, O SISTEMA DEVE recriar o time e o desenho exatamente.
2. QUANDO a pessoa cola um `flowchart` comum (sem o comentário da Muvuca), O SISTEMA DEVE criar os agentes pelos nós e as ligações pelas arestas, deduzir a arquitetura (árvore: centralizada ou hierárquica; linha: esteira; ciclo: rede), aplicar o layout automático e dizer o que deduziu.
3. SE o texto tem algo fora do que a Muvuca entende, ENTÃO O SISTEMA DEVE recusar com o número da linha e o motivo, sem mudar o rascunho.
4. QUANDO a pessoa solta um arquivo `.json` de time (o exportado pela Muvuca), O SISTEMA DEVE abri-lo como rascunho.
5. O time importado DEVE entrar como rascunho, passar pelas mesmas validações e poder ser desfeito com Ctrl+Z.

### Requisito 18: imagem que carrega o time

**História:** Como quem compartilha um time, quero baixar uma imagem dele que, solta de volta na Muvuca, vira o time editável.

#### Critérios de aceite

1. O SISTEMA DEVE exportar o desenho como SVG e como PNG, com os personagens, as setas, os rótulos, as notas e o nome do time.
2. O SISTEMA DEVE embutir o time em JSON, com o desenho, na própria imagem (comentário no SVG; trecho de texto no PNG).
3. QUANDO a pessoa solta no construtor uma imagem exportada pela Muvuca, O SISTEMA DEVE abrir o time dela como rascunho.
4. SE a imagem não traz um time, ENTÃO O SISTEMA DEVE dizer isso e não mudar nada.
5. A imagem DEVE abrir em qualquer visualizador, sem depender de fontes ou arquivos de fora.

## Depois desta spec: execução no grafo (decisão 4)

Decidido em 24/11/2026: seguir o caminho do n8n, em que o desenho serve também para examinar e controlar o que o time já fez. Isso mexe no servidor e no protocolo (guardar a saída de cada agente, pausar um pedido), por isso fica na spec `execucao-no-grafo`, aberta depois da 1.5.0. Ponto de partida para os requisitos dela:

| No n8n | Na Muvuca |
|---|---|
| Cada nó mostra no canvas como foi a última execução (sucesso, erro, quantidade de itens) | Cada agente mostra a última rodada: concluiu, falhou, foi devolvido; tempo e custo |
| Painel do nó com entrada e saída lado a lado | Clicar no agente abre o que ele recebeu, o que respondeu e os arquivos que mexeu |
| Aba "Executions": abrir uma execução antiga mostra o fluxo como estava, pintado, só leitura | Abrir um pedido antigo mostra o time daquele momento, pintado com o resultado de cada agente |
| *Pin data*: fixar a saída de um nó para testar o resto sem rodar de novo | Fixar a saída de um agente (por exemplo, o plano do líder) para não gastar ao ajustar os seguintes |
| Executar até um nó, ou a partir dele | Refazer a partir de um agente, reaproveitando as saídas anteriores |
| Repetir uma execução que falhou a partir do nó que falhou | Repetir um pedido a partir do agente que falhou |
| Nó de espera e "enviar e esperar resposta" | Pausa de aprovação humana como peça do desenho (por exemplo, depois do plano) |
