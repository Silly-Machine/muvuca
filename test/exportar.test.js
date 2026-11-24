// Exportar o time: a arquitetura montada vira arquivos que outra IA consegue usar (AGENTS.md, JSON e subagentes do Claude Code).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { relacoes, agentsMd, subagenteClaude, timeJson, arquivosDoTime, zip, crc32 } from '../src/exportar.js';
import { validarTime } from '../src/times.js';
import { subir } from './apoio/servidor-de-teste.js';

const cfg = JSON.parse(await fs.readFile(new URL('../config/agentes.json', import.meta.url), 'utf8'));
const PRONTOS = new URL('../config/arquiteturas/', import.meta.url);
const pronto = async (arq) => { const b = JSON.parse(await fs.readFile(new URL(arq, PRONTOS), 'utf8')); return { ...validarTime(b, cfg.provedores, 'demo'), descricao: b.descricao }; };
const pasta = (p) => fs.mkdtemp(path.join(os.tmpdir(), p));
const setas = (t) => relacoes(t).map(([de, para, r]) => `${de}>${para}:${r}`);

// Lê um .zip sem compressão de volta, conferindo a soma de cada arquivo: [{ caminho, conteudo }].
function lerZip(buf) {
  const fim = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(fim >= 0, 'fim do diretório central');
  const total = buf.readUInt16LE(fim + 10); let p = buf.readUInt32LE(fim + 16); const saida = [];
  for (let i = 0; i < total; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50);
    const crc = buf.readUInt32LE(p + 16), tam = buf.readUInt32LE(p + 20), nNome = buf.readUInt16LE(p + 28), local = buf.readUInt32LE(p + 42);
    const caminho = buf.subarray(p + 46, p + 46 + nNome).toString('utf8');
    assert.equal(buf.readUInt32LE(local), 0x04034b50);
    const inicio = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const dados = buf.subarray(inicio, inicio + tam);
    assert.equal(crc32(dados), crc, `soma de ${caminho}`);
    saida.push({ caminho, conteudo: dados.toString('utf8') });
    p += 46 + nNome + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return saida;
}

test('relações do time: o mesmo grafo que a tela desenha, em cada arquitetura', async () => {
  assert.deepEqual(setas(await pronto('1-centralizada.json')).filter((s) => s.endsWith(':revisa')).length, 1);
  const h = setas(await pronto('2-hierarquica.json'));
  assert.deepEqual(h, ['diretora>torre:delega', 'diretora>prisma:delega', 'torre>chevron:executa', 'torre>dados:executa', 'prisma>pixel:executa', 'prisma>tinta:executa', 'diretora>revisor:revisa']);
  const e = await pronto('3-esteira.json'); const ids = e.agentes.map((a) => a.id);
  assert.deepEqual(setas(e).map((s) => s.split(':')[0]), ids.slice(1).map((id, i) => `${ids[i]}>${id}`), 'esteira: cada um passa para o seguinte, na ordem');
  assert.equal(setas(e).at(-1).endsWith(':revisa'), true);
  const r = await pronto('6-rede-personalizada.json');
  const esperadas = r.agentes.filter((a) => a.funcao !== 'revisor').flatMap((a) => (a.conexoes || []).map((c) => `${a.id}>${c}:passa a vez`));
  assert.deepEqual(setas(r).filter((s) => s.endsWith(':passa a vez')).sort(), esperadas.sort(), 'rede: as ligações são as conexões de cada agente');
  assert.deepEqual(setas(await pronto('0-agente-unico.json')).length <= 1, true);
});

test('AGENTS.md: descreve arquitetura, quem é quem, como o trabalho anda e as instruções de cada agente', async () => {
  const t = await pronto('2-hierarquica.json');
  const md = agentsMd(t, { versao: '9.9.9', data: '01/02/2030', maxCiclos: 2 });
  assert.match(md, /^# Estúdio hierárquico\n/);
  assert.match(md, /montado na \[Muvuca\]\([^)]+\) 9\.9\.9, em 01\/02\/2030/);
  assert.match(md, /## Arquitetura: Hierárquica/);
  for (const s of ['## Quem é quem', '## Como o trabalho anda', '## Regras que valem para todos', '## Os agentes', '## Como usar este time fora da Muvuca']) assert.ok(md.includes(s), s);
  for (const a of t.agentes) { assert.ok(md.includes(`### ${a.nome} (\`${a.id}\`)`), a.id); assert.ok(md.includes(`> ${a.sistema.split('\n')[0]}`), `instruções de ${a.id}`); }
  assert.match(md, /No máximo 2 devoluções/);
  assert.match(md, /a_torre -->\|executa\| a_chevron/);
  assert.match(md, /- \*\*Recebe trabalho de:\*\* Torre \(executa\)/);
  assert.match(md, /- \*\*Passa trabalho para:\*\* Chevron \(executa\), Dados \(executa\)/);
  assert.match(md, /Líder e sub-líderes não viram subagentes/);
  // nada de provedor desta máquina nem de caminho local no texto
  assert.equal(/claude-cli|\bdemo\b|C:\\\\|\/Users\//.test(md), false);
  // time sem revisor diz isso, em vez de citar um revisor que não existe
  const dupla = { nome: 'Sem revisor', arquitetura: 'unico', agentes: [{ id: 'solo', nome: 'Solo', papel: 'faz tudo', ferramentas: ['ler', 'escrever'], sistema: 'Você faz tudo.' }] };
  assert.match(agentsMd(dupla), /Este time não tem revisor/);
});

test('todos os modelos prontos exportam, com um diagrama válido e um arquivo por agente que não coordena', async () => {
  for (const arq of (await fs.readdir(PRONTOS)).filter((n) => n.endsWith('.json'))) {
    const t = await pronto(arq);
    const arquivos = arquivosDoTime(t, { versao: '1.0.0', modelos: { baixa: 'haiku', media: 'sonnet', alta: 'opus' } });
    assert.deepEqual(arquivos.slice(0, 2).map((a) => a.caminho), ['AGENTS.md', 'muvuca-time.json'], arq);
    const esperados = t.agentes.filter((a) => !['lider', 'sublider'].includes(a.funcao || '')).map((a) => `.claude/agents/${a.id}.md`);
    assert.deepEqual(arquivos.slice(2).map((a) => a.caminho), esperados, arq);
    const bloco = /```mermaid\n([\s\S]*?)\n```/.exec(arquivos[0].conteudo)[1].split('\n');
    assert.equal(bloco[0], 'flowchart TD');
    const nos = new Set(bloco.filter((l) => /^\s+a_\w+\["/.test(l)).map((l) => /^\s+(a_\w+)\[/.exec(l)[1]));
    assert.equal(nos.size, t.agentes.length, `${arq}: um nó por agente`);
    for (const l of bloco.filter((x) => /-->|<-->/.test(x))) { const m = /^\s+(a_\w+) (?:-->|<-->)\|[^|]+\| (a_\w+)$/.exec(l); assert.ok(m && nos.has(m[1]) && nos.has(m[2]), `${arq}: seta malformada: ${l}`); }
    assert.equal(arquivos.every((a) => a.conteudo.endsWith('\n') && a.conteudo.length > 50), true);
  }
});

test('subagente do Claude Code: cabeçalho com nome, descrição, ferramentas e modelo; instruções no corpo', async () => {
  const t = await pronto('2-hierarquica.json');
  const ag = (id) => t.agentes.find((a) => a.id === id);
  const modelos = { baixa: 'haiku', media: 'sonnet', alta: 'opus' };
  const escritor = subagenteClaude(ag('tinta'), t, { modelos });
  const cab = /^---\n([\s\S]*?)\n---\n/.exec(escritor)[1].split('\n');
  assert.equal(cab[0], 'name: tinta');
  assert.equal(cab[2], 'tools: Glob, Grep, Read, Edit, Write, Bash');
  assert.equal(cab[3], `model: ${modelos[ag('tinta').complexidade || 'baixa']}`);
  assert.equal(JSON.parse(cab[1].replace(/^description: /, '')).startsWith('Tinta: '), true, 'a descrição é uma linha só, entre aspas (tem dois-pontos)');
  assert.ok(escritor.includes(ag('tinta').sistema)); assert.match(escritor, /rode os testes antes de dizer que terminou/);
  const revisor = subagenteClaude(ag('revisor'), t, { modelos });
  assert.match(revisor, /\ntools: Glob, Grep, Read\n/, 'revisor só lê');
  assert.match(revisor, /\nmodel: opus\n/); assert.match(revisor, /Não corrija/);
  assert.equal(/Edit|Write|Bash/.test(/\ntools: (.*)\n/.exec(revisor)[1]), false);
  // sem tabela de modelos, ou com nível decidido por tarefa, o subagente herda o modelo da conversa
  assert.match(subagenteClaude(ag('chevron'), t, { modelos }), /\nmodel: inherit\n/);
  assert.match(subagenteClaude(ag('revisor'), t), /\nmodel: inherit\n/);
});

test('JSON do time: reabre na Muvuca e não leva o provedor desta máquina', async () => {
  const t = await pronto('5-rede-completa.json');
  const j = JSON.parse(timeJson({ ...t, origem: 'pronto', arquivo: 'x.json', agentes: t.agentes.map((a) => ({ ...a, provedor: 'claude-cli' })) }));
  assert.deepEqual([j.origem, j.arquivo], [undefined, undefined]);
  assert.equal(j.agentes.some((a) => 'provedor' in a), false);
  const de_volta = validarTime(j, cfg.provedores, 'demo');
  assert.deepEqual(de_volta.agentes.map((a) => [a.id, a.sistema]), t.agentes.map((a) => [a.id, a.sistema]));
  assert.equal(de_volta.arquitetura, t.arquitetura);
});

test('pacote .zip: os arquivos voltam inteiros, com acentos no conteúdo e pastas no caminho', async () => {
  const arquivos = arquivosDoTime(await pronto('2-hierarquica.json'), {});
  const pacote = zip(arquivos, new Date(2026, 10, 23, 9, 30, 0));
  assert.equal(pacote.subarray(0, 4).toString('latin1'), 'PK\u0003\u0004');
  assert.deepEqual(lerZip(pacote), arquivos);
  assert.deepEqual(lerZip(zip([{ caminho: 'pasta/ação.txt', conteudo: 'coração ✓\n' }])), [{ caminho: 'pasta/ação.txt', conteudo: 'coração ✓\n' }]);
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926, 'soma de verificação padrão');
});

test('servidor: prévia, baixar o .zip e gravar na pasta do projeto, sem atropelar arquivo que já existe', async () => {
  const s = await subir(await pasta('muvuca-dados-'), { DEMO_ATRASO: '80' });
  const projeto = await pasta('muvuca-exp-');
  const time = (await s.get('/api/times')).times.find((t) => t.origem === 'pronto' && t.arquitetura === 'hierarquica');
  try {
    const previa = await s.post('/api/exportar', { time, formato: 'previa' });
    assert.equal(previa.s, 200);
    assert.deepEqual(previa.j.arquivos.slice(0, 2).map((a) => a.caminho), ['AGENTS.md', 'muvuca-time.json']);
    assert.ok(previa.j.arquivos.every((a) => a.tamanho > 50)); assert.match(previa.j.agentsMd, /^# /);
    assert.equal(existsSync(path.join(projeto, 'AGENTS.md')), false, 'a prévia não grava nada');

    const z = await fetch(s.base + '/api/exportar', { method: 'POST', headers: { 'content-type': 'application/json', 'x-muvuca-token': s.token }, body: JSON.stringify({ time, formato: 'zip' }) });
    assert.equal(z.status, 200); assert.equal(z.headers.get('content-type'), 'application/zip');
    assert.match(z.headers.get('content-disposition'), /attachment; filename="[a-z0-9-]+-muvuca\.zip"/);
    const noPacote = lerZip(Buffer.from(await z.arrayBuffer()));
    assert.deepEqual(noPacote.map((a) => a.caminho), previa.j.arquivos.map((a) => a.caminho));
    assert.equal(noPacote[0].conteudo, previa.j.agentsMd);

    const g = await s.post('/api/exportar', { time, formato: 'pasta', projeto });
    assert.equal(g.s, 200, JSON.stringify(g.j));
    assert.deepEqual(g.j.gravados, previa.j.arquivos.map((a) => a.caminho)); assert.deepEqual(g.j.sobrescritos, []);
    assert.equal(await fs.readFile(path.join(projeto, 'AGENTS.md'), 'utf8'), previa.j.agentsMd);
    assert.equal(existsSync(path.join(projeto, '.claude', 'agents', 'revisor.md')), true);
    assert.equal((await s.post('/api/exportar', { time, formato: 'pasta', projeto })).s, 200, 'gravar de novo o mesmo conteúdo não é conflito');

    // AGENTS.md que já existe com outro conteúdo (escrito pela pessoa, por exemplo) só é trocado com confirmação
    await fs.writeFile(path.join(projeto, 'AGENTS.md'), '# Meu arquivo\n');
    const conflito = await s.post('/api/exportar', { time, formato: 'pasta', projeto });
    assert.deepEqual([conflito.s, conflito.j.codigo, conflito.j.existentes], [409, 'existe', ['AGENTS.md']]);
    assert.equal(await fs.readFile(path.join(projeto, 'AGENTS.md'), 'utf8'), '# Meu arquivo\n', 'recusa não mexe em nada');
    const troca = await s.post('/api/exportar', { time, formato: 'pasta', projeto, sobrescrever: true });
    assert.deepEqual([troca.s, troca.j.sobrescritos], [200, ['AGENTS.md']]);

    // recusas: time inválido, pasta que não existe, sem a chave
    assert.equal((await s.post('/api/exportar', { time: { nome: 'x', agentes: [] }, formato: 'previa' })).s, 400);
    assert.equal((await s.post('/api/exportar', { time, formato: 'pasta', projeto: path.join(projeto, 'nao-existe') })).s, 400);
    assert.equal((await s.cru('/api/exportar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ time, formato: 'zip' }) })).status, 401);

    // com o time trabalhando na pasta, gravar é recusado: os arquivos entrariam no diff como se fossem do time
    const outro = await pasta('muvuca-exp2-');
    await s.post('/api/pedido', { texto: 'Crie uma página de status com um endpoint /health', projeto: outro });
    const ocupada = await s.post('/api/exportar', { time, formato: 'pasta', projeto: outro });
    assert.deepEqual([ocupada.s, ocupada.j.codigo], [409, 'pasta']);
    assert.equal((await s.post('/api/exportar', { time, formato: 'previa' })).s, 200, 'a prévia e o .zip continuam valendo com o time ocupado');
    await s.post('/api/parar', {});
  } finally { await s.parar(); }
});

test('muvuca-time.json leva o desenho: lugar de cada agente, desenho da rede e modelo de origem', () => {
  const t = { nome: 'R', arquitetura: 'rede', desenho: { rede: 'camadas' }, modelo: 'Rede completa', agentes: [{ id: 'a', nome: 'A', provedor: 'demo', ferramentas: ['escrever'], pos: [1.5, 0] }] };
  const j = JSON.parse(timeJson(t));
  assert.deepEqual([j.agentes[0].pos, j.desenho, j.modelo, j.agentes[0].provedor], [[1.5, 0], { rede: 'camadas' }, 'Rede completa', undefined]);
});
