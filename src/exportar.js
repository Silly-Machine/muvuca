// Exportar um time: transforma a arquitetura montada no construtor em arquivos que outra IA (ou outra pessoa)
// consegue ler e usar fora da Muvuca.
//
//   AGENTS.md              o time em texto: quem é quem, quem responde a quem, como o trabalho anda, as instruções de cada um
//   muvuca-time.json       o time no formato da própria Muvuca, para reabrir aqui ou processar por programa
//   .claude/agents/*.md    um subagente do Claude Code para cada agente que executa, consulta ou revisa
//
// Tudo aqui é texto puro, sem tocar em disco: quem grava ou empacota é o servidor.
import { ARQUITETURAS } from './times.js';
import { nivelPadrao } from './orquestrador.js';

const NOME_ARQ = { unico: 'Agente único', centralizada: 'Supervisor', hierarquica: 'Hierárquica', sequencial: 'Esteira', rede: 'Rede' };
const NOME_FUNCAO = { lider: 'líder', sublider: 'sub-líder', revisor: 'revisor' };
const NOME_FERRAMENTA = { listar: 'listar arquivos', ler: 'ler arquivos', escrever: 'escrever arquivos', rodar: 'rodar os testes' };
const NOME_NIVEL = { baixa: 'leve (tarefas simples)', media: 'intermediário', alta: 'o mais forte (tarefas difíceis e revisão)', auto: 'decidido a cada tarefa por quem planeja' };
// ferramentas da Muvuca -> ferramentas do Claude Code
const NO_CLAUDE = { listar: ['Glob', 'Grep'], ler: ['Read'], escrever: ['Edit', 'Write'], rodar: ['Bash'] };

const funcao = (a) => a.funcao || '';
const executa = (a) => (a.ferramentas || []).includes('escrever');
const papelCurto = (a) => NOME_FUNCAO[funcao(a)] || (executa(a) ? 'executa' : 'consulta');
const nivelDe = (a) => a.complexidade || nivelPadrao(a) || 'auto';
const semQuebra = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const celula = (s) => semQuebra(s).replace(/\|/g, '\\|');

// Quem passa trabalho para quem: [de, para, rótulo]. É o mesmo grafo que a tela desenha.
export function relacoes(time) {
  const ags = time.agentes, lider = ags.find((a) => funcao(a) === 'lider'), revisor = ags.find((a) => funcao(a) === 'revisor');
  const setas = [];
  const arq = time.arquitetura || 'centralizada';
  if (arq === 'centralizada' || arq === 'hierarquica') {
    for (const a of ags) {
      if (a === lider) continue;
      const chefe = arq === 'hierarquica' && a.chefe && ags.some((x) => x.id === a.chefe) ? a.chefe : lider?.id;
      if (!chefe) continue;
      setas.push([chefe, a.id, funcao(a) === 'revisor' ? 'revisa' : funcao(a) === 'sublider' ? 'delega' : executa(a) ? 'executa' : 'consulta']);
    }
  } else if (arq === 'sequencial') {
    const fila = [...ags.filter((a) => funcao(a) !== 'revisor'), ...(revisor ? [revisor] : [])];
    for (let i = 1; i < fila.length; i++) setas.push([fila[i - 1].id, fila[i].id, fila[i] === revisor ? 'revisa' : 'passa para']);
  } else if (arq === 'rede') {
    const outros = ags.filter((a) => funcao(a) !== 'revisor');
    for (const a of outros) for (const id of (Array.isArray(a.conexoes) ? a.conexoes : outros.filter((x) => x !== a).map((x) => x.id))) if (outros.some((x) => x.id === id)) setas.push([a.id, id, 'passa a vez']);
    if (revisor) for (const a of outros) setas.push([a.id, revisor.id, 'revisa']);
  } else if (revisor) setas.push([ags.find((a) => a !== revisor).id, revisor.id, 'revisa']);
  return setas;
}

function comoTrabalha(time, { maxCiclos = 3 } = {}) {
  const arq = time.arquitetura || 'centralizada';
  const ags = time.agentes, lider = ags.find((a) => funcao(a) === 'lider'), revisor = ags.find((a) => funcao(a) === 'revisor');
  const nome = (a) => `**${a.nome}**`;
  const plano = {
    unico: `1. ${nome(ags.find((a) => funcao(a) !== 'revisor'))} recebe o pedido e faz tudo: lê o projeto, escreve o código e os testes.`,
    centralizada: `1. ${lider ? nome(lider) : 'O líder'} lê o pedido e monta um plano: quais etapas, em que ordem e quem faz cada uma. Não escreve código.\n2. Antes de decidir, pode consultar quem só lê (pesquisa, documentação). A consulta volta como texto.\n3. Cada etapa vai para um agente, com a tarefa escrita e o que as etapas anteriores produziram.`,
    hierarquica: `1. ${lider ? nome(lider) : 'O líder'} divide o pedido em frentes e entrega cada frente inteira a um sub-líder. Não entra em detalhe.\n2. Cada sub-líder monta o plano da própria frente e distribui as etapas entre quem responde a ele.\n3. Quem responde direto ao líder recebe as etapas dele.`,
    sequencial: `1. Não há líder. O pedido entra pelo primeiro da lista.\n2. Cada agente faz a sua etapa e passa o resultado, com um resumo, para o seguinte, na ordem da tabela acima.`,
    rede: `1. Não há chefe. O primeiro da lista começa.\n2. Quem termina a sua parte escolhe, entre os agentes com quem tem ligação, quem continua, ou encerra se o pedido estiver completo.\n3. Há um teto de passagens para a conversa não andar em círculo.`,
  }[arq];
  const depois = [
    `**Testes.** Com tudo escrito, os testes do projeto são rodados por quem coordena, não por quem escreveu (\`node --test\`, \`npm test\` ou o comando do projeto). Se falharem, o trabalho volta para o autor do código que quebrou, com a saída dos testes.`,
    revisor ? `**Revisão.** ${nome(revisor)} lê as mudanças e responde "aprovado" ou "devolvido", com arquivo e motivo de cada problema. Só aponta defeito real e não corrige.` : `**Revisão.** Este time não tem revisor: a entrega vale quando os testes passam.`,
    `**Devoluções.** Código devolvido volta para quem escreveu. No máximo ${maxCiclos} devoluç${maxCiclos === 1 ? 'ão' : 'ões'}; passando disso, a entrega sai marcada como não aprovada.`,
    `**Entrega.** No fim, a pessoa recebe a lista de arquivos alterados, com o autor de cada um, e decide se mantém ou descarta. Nada é dado como pronto antes disso.`,
  ];
  const n = plano.split('\n').length;
  return plano + '\n' + depois.map((l, i) => `${n + i + 1}. ${l}`).join('\n');
}

const noMermaid = (id) => 'a_' + String(id).replace(/[^a-zA-Z0-9]/g, '_');
function diagrama(time) {
  const linhas = ['```mermaid', 'flowchart TD'];
  for (const a of time.agentes) linhas.push(`    ${noMermaid(a.id)}["${semQuebra(a.nome).replace(/"/g, "'")}<br/>${papelCurto(a)}"]`);
  const vistas = new Set();
  for (const [de, para, rotulo] of relacoes(time)) {
    // ligação nos dois sentidos com o mesmo rótulo vira uma seta dupla, como na tela
    const volta = relacoes(time).some(([d, p, r]) => d === para && p === de && r === rotulo);
    const chave = volta ? [de, para].sort().join('|') + rotulo : `${de}>${para}`;
    if (vistas.has(chave)) continue; vistas.add(chave);
    linhas.push(`    ${noMermaid(de)} ${volta ? '<-->' : '-->'}|${rotulo}| ${noMermaid(para)}`);
  }
  return [...linhas, '```'].join('\n');
}

// O AGENTS.md: a descrição do time que qualquer IA ou pessoa consegue seguir.
export function agentsMd(time, opcoes = {}) {
  const arq = time.arquitetura || 'centralizada';
  const setas = relacoes(time);
  const respondeA = (a) => setas.filter(([, para]) => para === a.id).map(([de, , r]) => `${time.agentes.find((x) => x.id === de)?.nome} (${r})`);
  const passaPara = (a) => setas.filter(([de]) => de === a.id).map(([, para, r]) => `${time.agentes.find((x) => x.id === para)?.nome} (${r})`);
  const tabela = ['| Agente | Função | Papel | Pode | Modelo sugerido |', '|---|---|---|---|---|',
    ...time.agentes.map((a) => `| ${celula(a.nome)} (\`${a.id}\`) | ${papelCurto(a)} | ${celula(a.papel)} | ${(a.ferramentas || []).map((f) => NOME_FERRAMENTA[f] || f).join(', ') || 'só conversar e decidir'} | ${NOME_NIVEL[nivelDe(a)] || nivelDe(a)} |`)];
  const fichas = time.agentes.map((a) => [
    `### ${a.nome} (\`${a.id}\`)`, '',
    `- **Função:** ${papelCurto(a)}`,
    `- **Papel:** ${semQuebra(a.papel)}`,
    `- **Pode:** ${(a.ferramentas || []).map((f) => NOME_FERRAMENTA[f] || f).join(', ') || 'só conversar e decidir; não mexe em arquivos'}`,
    ...(respondeA(a).length ? [`- **Recebe trabalho de:** ${respondeA(a).join(', ')}`] : []),
    ...(passaPara(a).length ? [`- **Passa trabalho para:** ${passaPara(a).join(', ')}`] : []),
    `- **Modelo sugerido:** ${NOME_NIVEL[nivelDe(a)] || nivelDe(a)}`,
    '', '**Instruções deste agente:**', '', ...String(a.sistema || '(sem instruções próprias)').split('\n').map((l) => `> ${l}`),
  ].join('\n'));
  const subagentes = time.agentes.filter(viraSubagente);
  return `# ${semQuebra(time.nome) || 'Time de agentes'}

${time.descricao ? semQuebra(time.descricao) + '\n\n' : ''}Este arquivo descreve um time de agentes de IA montado na [Muvuca](https://github.com/Silly-Machine/muvuca)${opcoes.versao ? ` ${opcoes.versao}` : ''}${opcoes.data ? `, em ${opcoes.data}` : ''}. Ele foi escrito para ser lido por outra IA: siga-o para trabalhar do mesmo jeito que este time, mesmo sem a Muvuca.

## Arquitetura: ${NOME_ARQ[arq] || arq}

${ARQUITETURAS[arq] || ''}

${diagrama(time)}

## Quem é quem

${tabela.join('\n')}

## Como o trabalho anda

${comoTrabalha(time, opcoes)}

## Regras que valem para todos

- Trabalhe só dentro da pasta do projeto. Não leia nem escreva fora dela.
- Quem escreve código escreve o teste junto e só diz que os testes passam depois de vê-los passar.
- Não instale dependências sem ser pedido. Prefira a biblioteca padrão.
- Responda em frases curtas, dizendo o que fez e em quais arquivos.
- Arquivos \`.env\` e segredos não são lidos nem copiados.

## Os agentes

${fichas.join('\n\n')}

## Como usar este time fora da Muvuca

- **Qualquer IA que leia \`AGENTS.md\`:** este arquivo basta. Faça o papel de quem coordena (${time.agentes.find((a) => funcao(a) === 'lider')?.nome || 'a ordem descrita acima'}) e assuma cada agente na vez dele, com as instruções da ficha.
- **Claude Code:** a pasta \`.claude/agents/\` traz ${subagentes.length} subagente(s) prontos (${subagentes.map((a) => `\`${a.id}\``).join(', ') || 'nenhum'}). A conversa principal faz o papel de quem coordena e chama cada subagente pelo nome. Líder e sub-líderes não viram subagentes, porque um subagente não chama outro; as instruções deles estão nas fichas acima.
- **Outros programas:** \`muvuca-time.json\` traz o mesmo time em JSON: \`arquitetura\`, e em \`agentes\` os campos \`id\`, \`nome\`, \`funcao\`, \`chefe\`, \`conexoes\`, \`papel\`, \`ferramentas\` e \`sistema\` (as instruções).
- **De volta na Muvuca:** copie \`muvuca-time.json\` para a pasta \`times/\` dentro da pasta de dados (\`~/.muvuca/times/\`) e ele aparece na galeria do construtor.
`;
}

const viraSubagente = (a) => !['lider', 'sublider'].includes(funcao(a));

// Um subagente do Claude Code: cabeçalho com nome, descrição, ferramentas e modelo; no corpo, as instruções.
export function subagenteClaude(a, time, { modelos } = {}) {
  const ferramentas = [...new Set((a.ferramentas || []).flatMap((f) => NO_CLAUDE[f] || []))];
  if (!ferramentas.length) ferramentas.push('Read', 'Glob', 'Grep');   // revisor e consulta leem; no Claude Code, sem ferramenta nenhuma não haveria o que fazer
  const modelo = modelos?.[nivelDe(a)] || 'inherit';
  const quando = funcao(a) === 'revisor' ? 'Use depois que o código estiver escrito e os testes passarem, para revisar as mudanças antes de entregar.'
    : executa(a) ? 'Use para executar as etapas de trabalho desta especialidade.' : 'Use para consultar antes de decidir ou planejar; devolve texto e não altera arquivos.';
  const regras = funcao(a) === 'revisor'
    ? ['Leia os arquivos alterados inteiros, não só o resumo.', 'Responda "aprovado" ou "devolvido". Em cada problema, diga o arquivo e o motivo.', 'Só aponte defeito real. Não corrija: quem corrige é o autor.']
    : executa(a)
      ? ['Trabalhe só dentro da pasta do projeto.', 'Escreva o teste junto com o código e rode os testes antes de dizer que terminou; só diga que passam se viu passar.', 'Não instale dependências sem ser pedido.', 'Ao terminar, diga em uma ou duas frases o que fez e em quais arquivos.']
      : ['Não altere arquivos.', 'Responda com a referência mais curta e útil possível, dizendo de onde tirou.'];
  return `---
name: ${a.id}
description: ${JSON.stringify(semQuebra(`${a.nome}: ${a.papel}. ${quando}`))}
tools: ${ferramentas.join(', ')}
model: ${modelo}
---

${String(a.sistema || '').trim() || `Você é ${a.nome}.`}

Você é ${a.nome}, do time "${semQuebra(time.nome)}" (${papelCurto(a)}: ${semQuebra(a.papel)}). Responda em português, em frases curtas.

${regras.map((r) => `- ${r}`).join('\n')}
`;
}

// O time no formato da Muvuca, sem o que só vale nesta máquina (o provedor de cada agente).
export function timeJson(time) {
  const { origem, arquivo, erro, ...resto } = time;
  return JSON.stringify({ ...resto, agentes: time.agentes.map(({ provedor, ...a }) => a) }, null, 2) + '\n';
}

// Todos os arquivos da exportação: [{ caminho, conteudo }].
export function arquivosDoTime(time, opcoes = {}) {
  return [
    { caminho: 'AGENTS.md', conteudo: agentsMd(time, opcoes) },
    { caminho: 'muvuca-time.json', conteudo: timeJson(time) },
    ...time.agentes.filter(viraSubagente).map((a) => ({ caminho: `.claude/agents/${a.id}.md`, conteudo: subagenteClaude(a, time, opcoes) })),
  ];
}

// ---------- pacote .zip (sem compressão: são poucos arquivos de texto, e assim não é preciso nenhuma dependência)
const TABELA_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = TABELA_CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
export function zip(arquivos, quando = new Date()) {
  const hora = ((quando.getHours() << 11) | (quando.getMinutes() << 5) | (quando.getSeconds() >> 1)) & 0xffff;
  const dia = (((quando.getFullYear() - 1980) << 9) | ((quando.getMonth() + 1) << 5) | quando.getDate()) & 0xffff;
  const locais = [], centrais = []; let posicao = 0;
  for (const a of arquivos) {
    const nome = Buffer.from(a.caminho, 'utf8'), dados = Buffer.from(a.conteudo, 'utf8'), crc = crc32(dados);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);   // 0x0800: nomes em UTF-8
    local.writeUInt16LE(0, 8); local.writeUInt16LE(hora, 10); local.writeUInt16LE(dia, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(dados.length, 18); local.writeUInt32LE(dados.length, 22);
    local.writeUInt16LE(nome.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10); central.writeUInt16LE(hora, 12); central.writeUInt16LE(dia, 14);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(dados.length, 20); central.writeUInt32LE(dados.length, 24);
    central.writeUInt16LE(nome.length, 28); central.writeUInt32LE(posicao, 42);
    locais.push(local, nome, dados); centrais.push(central, nome);
    posicao += 30 + nome.length + dados.length;
  }
  const tamanhoCentral = centrais.reduce((n, b) => n + b.length, 0);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(arquivos.length, 8); fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(tamanhoCentral, 12); fim.writeUInt32LE(posicao, 16);
  return Buffer.concat([...locais, ...centrais, fim]);
}
