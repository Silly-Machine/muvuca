import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Muvuca } from '../src/orquestrador.js';
import { subir } from './apoio/servidor-de-teste.js';
import { validarTime } from '../src/times.js';

process.env.DEMO_ATRASO = '0';
const cfg = JSON.parse(await fs.readFile(new URL('../config/agentes.json', import.meta.url), 'utf8'));
const pastaNova = () => fs.mkdtemp(path.join(os.tmpdir(), 'muvuca-times-'));
const PRONTOS = new URL('../config/arquiteturas/', import.meta.url);
const pronto = async (n) => validarTime(JSON.parse(await fs.readFile(new URL(n, PRONTOS), 'utf8')), cfg.provedores, 'demo');
const comTime = (t) => { const e = new Muvuca(structuredClone(cfg)); e.trocarTime(t); return e; };
const PEDIDO = 'Crie uma página de status com um endpoint /health';

test('todos os modelos prontos passam no validador', async () => {
  const nomes = (await fs.readdir(PRONTOS)).filter((n) => n.endsWith('.json'));
  assert.ok(nomes.length >= 4);
  for (const n of nomes) await pronto(n);
});


test('desenho: posição aceita e arredondada, inválida descartada sem recusar o time; desenho da rede e modelo de origem', () => {
  const base = (extra = {}, agentes) => ({ nome: 'd', arquitetura: 'centralizada', agentes: agentes || [
    { id: 'lider', nome: 'Líder', funcao: 'lider', pos: [0.123, 0] },
    { id: 'dev', nome: 'Dev', ferramentas: ['escrever'], pos: [1, 'x'] },
    { id: 'qa', nome: 'QA', ferramentas: ['escrever'], pos: [-500, 1] },
    { id: 'outro', nome: 'Outro', ferramentas: ['escrever'] }], ...extra });
  const t = validarTime(base({ modelo: 'Supervisor', desenho: { rede: 'camadas' } }), cfg.provedores, 'demo');
  assert.deepStrictEqual(t.agentes.map((a) => a.pos), [[0.12, 0], undefined, undefined, undefined]);
  assert.strictEqual(t.modelo, 'Supervisor');
  assert.strictEqual(t.desenho, undefined, 'o desenho da rede só vale na rede');
  const r = validarTime(base({ arquitetura: 'rede', desenho: { rede: 'camadas' } }, [{ id: 'a', nome: 'A', ferramentas: ['escrever'] }, { id: 'b', nome: 'B' }]), cfg.provedores, 'demo');
  assert.deepStrictEqual(r.desenho, { rede: 'camadas' });
  assert.strictEqual(validarTime(base({ arquitetura: 'rede', desenho: { rede: 'espiral' } }, [{ id: 'a', nome: 'A', ferramentas: ['escrever'] }]), cfg.provedores, 'demo').desenho, undefined);
  // estilo das setas: arredondadas fica guardado em qualquer arquitetura; quadradas é o padrão e não ocupa espaço
  assert.deepStrictEqual(validarTime(base({ desenho: { setas: 'arredondadas' } }), cfg.provedores, 'demo').desenho, { setas: 'arredondadas' });
  assert.strictEqual(validarTime(base({ desenho: { setas: 'quadradas' } }), cfg.provedores, 'demo').desenho, undefined);
  assert.strictEqual(validarTime(base({ desenho: { setas: 'tortas' } }), cfg.provedores, 'demo').desenho, undefined);
  assert.deepStrictEqual(validarTime(base({ arquitetura: 'rede', desenho: { rede: 'anel', setas: 'arredondadas' } }, [{ id: 'a', nome: 'A', ferramentas: ['escrever'] }, { id: 'b', nome: 'B' }]), cfg.provedores, 'demo').desenho, { rede: 'anel', setas: 'arredondadas' });
});

test('modelos prontos trazem o desenho base: todo agente com posição e ninguém em cima de ninguém', async () => {
  for (const n of (await fs.readdir(PRONTOS)).filter((x) => x.endsWith('.json'))) {
    const t = await pronto(n);
    for (const a of t.agentes) assert.ok(a.pos, `${n}: ${a.id} sem posição`);
    t.agentes.forEach((a, i) => t.agentes.slice(i + 1).forEach((b) => assert.ok(Math.abs(a.pos[0] - b.pos[0]) >= 1 || Math.abs(a.pos[1] - b.pos[1]) >= 0.85, `${n}: ${a.id} cobre ${b.id}`)));
  }
});
test('biblioteca de agentes básicos: formas válidas, sem repetir boneco, e cada um vira time sozinho', async () => {
  const { agentes } = JSON.parse(await fs.readFile(new URL('../config/catalogo-agentes.json', import.meta.url), 'utf8'));
  const { FORMAS } = await import('../src/times.js');
  assert.ok(agentes.length >= 12);
  for (const a of agentes) assert.ok(FORMAS.includes(a.forma), `${a.id}: forma ${a.forma}`);
  const executores = agentes.filter((a) => !a.funcao && a.forma !== 'lente');
  assert.strictEqual(new Set(agentes.map((a) => a.forma)).size, agentes.length, 'cada agente básico tem um boneco próprio');
  // qualquer executor da biblioteca forma um agente único válido
  for (const a of executores.filter((x) => (x.ferramentas || []).includes('escrever'))) validarTime({ arquitetura: 'unico', agentes: [a] }, cfg.provedores, 'demo');
});

test('validador: recusa time quebrado com mensagem que diz o que fazer', () => {
  const v = (t) => () => validarTime(t, cfg.provedores, 'demo');
  const ex = { id: 'ex', nome: 'Ex', ferramentas: ['escrever'] };
  assert.throws(v({ agentes: [] }), /pelo menos um agente/);
  assert.throws(v({ agentes: [ex] }), /exatamente um líder/);
  assert.throws(v({ arquitetura: 'sequencial', agentes: [{ ...ex, funcao: 'lider' }, ex] }), /esteira não tem líder|repetid|dois agentes/);
  assert.throws(v({ arquitetura: 'sequencial', agentes: [{ id: 'so', nome: 'Só lê', ferramentas: ['ler'] }] }), /executor que possa escrever/);
  assert.throws(v({ agentes: [{ id: 'l', nome: 'L', funcao: 'lider' }, ex, { id: 'r', nome: 'R', funcao: 'revisor', ferramentas: ['escrever'] }] }), /revisor só lê/);
  assert.throws(v({ agentes: [{ id: 'Mai Úsculo', nome: 'X' }] }), /id .* inválido/);
  assert.throws(v({ agentes: [{ id: 'l', nome: 'L', funcao: 'lider' }, { ...ex, provedor: 'nao-existe' }] }), /provedor "nao-existe" não existe/);
  assert.throws(v({ arquitetura: 'hierarquica', agentes: [{ id: 'l', nome: 'L', funcao: 'lider' }, { id: 's', nome: 'S', funcao: 'sublider' }, ex] }), /sub-líder S não tem ninguém/);
  assert.throws(v({ arquitetura: 'hierarquica', agentes: [{ id: 'l', nome: 'L', funcao: 'lider' }, { ...ex, chefe: 'ninguem' }] }), /não é líder nem sub-líder/);
  assert.throws(v({ arquitetura: 'hierarquica', agentes: [{ id: 'l', nome: 'L', funcao: 'lider' }, { id: 'a', nome: 'A', funcao: 'sublider', chefe: 'b' }, { id: 'b', nome: 'B', funcao: 'sublider', chefe: 'a' }, { ...ex, chefe: 'a' }, { id: 'ey', nome: 'Ey', ferramentas: ['escrever'], chefe: 'b' }] }), /não chega ao líder/);
  // líder não executa: ferramentas somem; centralizada põe todo mundo respondendo ao líder
  const ok = validarTime({ agentes: [{ id: 'l', nome: 'L', funcao: 'lider', ferramentas: ['escrever'] }, { ...ex, chefe: 'outro' }] }, cfg.provedores, 'demo');
  assert.deepStrictEqual(ok.agentes[0].ferramentas, []);
  assert.strictEqual(ok.agentes[1].chefe, 'l');
  assert.strictEqual(ok.agentes[1].provedor, 'demo', 'sem provedor, usa o padrão');
});

test('hierárquica: a diretora divide, cada sub-líder planeja para o próprio time', async () => {
  const projeto = await pastaNova();
  const e = comTime(await pronto('2-hierarquica.json'));
  await e.pedido({ texto: PEDIDO, projeto });
  const planos = e.eventos.filter((x) => x.tipo === 'plano').map((p) => [p.agente, p.etapas.map((s) => s.agente)]);
  assert.deepStrictEqual(planos, [['diretora', ['torre', 'prisma']], ['torre', ['chevron', 'dados']], ['prisma', ['pixel', 'tinta']]]);
  const quem = e.eventos.filter((x) => x.tipo === 'concluiu').map((x) => x.agente);
  assert.deepStrictEqual(quem.slice(0, 4), ['chevron', 'dados', 'pixel', 'tinta'], 'executores trabalham na ordem das frentes');
  assert.ok(!quem.includes('torre') && !quem.includes('diretora'), 'líderes não executam');
  assert.strictEqual(e.eventos.find((x) => x.tipo === 'concluiu' && x.agente === 'tinta').complexidade, 'baixa', 'nível fixo do agente vence o do sub-líder');
  const final = e.eventos.find((x) => x.tipo === 'final');
  assert.strictEqual(final.aprovado, true);
  const dif = e.eventos.find((x) => x.tipo === 'diff');
  assert.strictEqual(dif.autores['notas/dados.md'], 'dados');
  assert.strictEqual(dif.autores['public/status.html'], 'pixel');
  await e.decidir('descartar');
  assert.deepStrictEqual(await fs.readdir(projeto), []);
});

test('esteira: sem líder, na ordem da lista, cada etapa no seu nível', async () => {
  const projeto = await pastaNova();
  const e = comTime(await pronto('3-esteira.json'));
  await e.pedido({ texto: PEDIDO, projeto });
  assert.ok(!e.eventos.some((x) => x.tipo === 'plano'), 'esteira não tem plano de líder');
  assert.deepStrictEqual(e.eventos.find((x) => x.tipo === 'esteira').etapas.map((s) => [s.agente, s.complexidade]),
    [['analista', 'media'], ['chevron', 'alta'], ['testador', 'media'], ['documentador', 'baixa']]);
  assert.deepStrictEqual(e.eventos.filter((x) => x.tipo === 'passagem').slice(0, 3).map((p) => [p.de, p.para]),
    [['analista', 'chevron'], ['chevron', 'testador'], ['testador', 'documentador']]);
  assert.strictEqual(e.eventos.find((x) => x.tipo === 'final').aprovado, true);
  assert.deepStrictEqual(e.lider, [], 'esteira não mexe na sessão de líder');
  await e.decidir('descartar');
});

test('rede completa: cada um passa a vez para quem falta, e a linha de JSON não vai para a conversa', async () => {
  const projeto = await pastaNova();
  const e = comTime(await pronto('5-rede-completa.json'));
  await e.pedido({ texto: PEDIDO, projeto });
  assert.strictEqual(e.eventos.find((x) => x.tipo === 'rede').entrada, 'back');
  assert.deepStrictEqual(e.eventos.filter((x) => x.tipo === 'passagem' && x.para !== 'revisor').map((p) => [p.de, p.para]),
    [['back', 'front'], ['front', 'testes'], ['testes', 'docs']]);
  assert.ok(!e.eventos.some((x) => x.tipo === 'fala' && /"proximo"/.test(x.texto)), 'o JSON de passagem fica fora da fala');
  assert.ok(e.eventos.some((x) => x.tipo === 'aviso' && /Docs encerrou a rede/.test(x.texto)));
  assert.strictEqual(e.eventos.find((x) => x.tipo === 'final').aprovado, true);
  await e.decidir('descartar');
});

test('rede personalizada: só passa a vez por uma conexão que existe', async () => {
  const projeto = await pastaNova();
  const e = comTime(await pronto('6-rede-personalizada.json'));
  await e.pedido({ texto: PEDIDO, projeto });
  const passagens = e.eventos.filter((x) => x.tipo === 'passagem' && x.para !== 'revisor').map((p) => [p.de, p.para]);
  assert.deepStrictEqual(passagens, [['produto', 'back'], ['back', 'front'], ['front', 'testes']]);
  const t = (await pronto('6-rede-personalizada.json'));
  for (const [de, para] of passagens) assert.ok(t.agentes.find((a) => a.id === de).conexoes.includes(para), `${de} → ${para} é uma conexão declarada`);
  await e.decidir('descartar');
  // conexão para fora da rede é recusada
  const ruim = structuredClone(t); ruim.agentes[0].conexoes = ['revisor'];
  assert.throws(() => validarTime(ruim, cfg.provedores, 'demo'), /não é membro da rede/);
});

test('agente único: um agente faz tudo e o portão ainda confere', async () => {
  const projeto = await pastaNova();
  const e = comTime(await pronto('0-agente-unico.json'));
  await e.pedido({ texto: PEDIDO, projeto });
  assert.deepStrictEqual([...new Set(e.eventos.filter((x) => x.tipo === 'concluiu').map((x) => x.agente))], ['solo']);
  assert.ok(e.eventos.some((x) => x.tipo === 'portao' && x.ok));
  assert.strictEqual(e.eventos.find((x) => x.tipo === 'final').aprovado, true);
  assert.throws(() => validarTime({ arquitetura: 'unico', agentes: [{ id: 'a', nome: 'A', ferramentas: ['escrever'] }, { id: 'b', nome: 'B', ferramentas: ['escrever'] }] }, cfg.provedores, 'demo'), /exatamente um agente/);
  await e.decidir('descartar');
});

test('trocar o time: recusa com pedido rodando ou mudança pendente', async () => {
  const projeto = await pastaNova();
  const e = new Muvuca(structuredClone(cfg));
  await e.pedido({ texto: PEDIDO, projeto });
  const dupla = await pronto('4-dupla.json');
  assert.throws(() => e.trocarTime(dupla), (err) => err.codigo === 'decisao' && /espera sua decisão/.test(err.message));
  await e.decidir('descartar');
  e.trocarTime(dupla);
  assert.strictEqual(e.arquitetura, 'sequencial');
  assert.deepStrictEqual(e.eventos.map((x) => x.tipo), ['time']);
  await e.pedido({ texto: PEDIDO, projeto });
  assert.strictEqual(e.eventos.find((x) => x.tipo === 'final').aprovado, true);
  await e.decidir('descartar');
});

test('mudança pendente numa pasta: recusa pedido em outra pasta e não mistura os projetos', async () => {
  const a = await pastaNova(), b = await pastaNova();
  await fs.writeFile(path.join(b, 'meu.txt'), 'não mexa');
  const e = new Muvuca(structuredClone(cfg));
  await e.pedido({ texto: PEDIDO, projeto: a });
  await assert.rejects(e.pedido({ texto: PEDIDO, projeto: b }), (err) => err.codigo === 'decisao' && /outra pasta/.test(err.message));
  assert.strictEqual(e.rodando, false);
  await assert.rejects(e.decidir('talvez'), /decisão desconhecida/);
  await e.decidir('descartar');
  assert.strictEqual(await fs.readFile(path.join(b, 'meu.txt'), 'utf8'), 'não mexa');
  assert.deepStrictEqual(await fs.readdir(a), []);
});

test('pedido direto para agente que não existe é recusado antes de começar', async () => {
  const e = new Muvuca(structuredClone(cfg));
  await assert.rejects(e.pedido({ texto: 'oi', projeto: await pastaNova(), para: 'fantasma' }), /não existe neste time/);
  assert.strictEqual(e.rodando, false);
  assert.strictEqual(e.foto, null);
});

test('o time em uso volta quando a Muvuca reabre (a Buzina não some do palco)', async () => {
  const dados = await fs.mkdtemp(path.join(os.tmpdir(), 'muvuca-time-em-uso-'));
  const servidores = [];
  try {
    let s = await subir(dados); servidores.push(s);
    const time = { nome: 'Time com a Buzina', arquitetura: 'centralizada', agentes: [
      { id: 'lider', nome: 'Líder', funcao: 'lider', forma: 'cartola', papel: 'coordena' },
      { id: 'buzina', nome: 'Buzina', funcao: '', forma: 'salsicha', papel: 'farejar bugs', ferramentas: ['listar', 'ler', 'escrever', 'rodar'] }] };
    assert.equal((await s.post('/api/time', { time, salvar: false })).s, 200);
    await s.parar();
    s = await subir(dados); servidores.push(s);
    const c = await s.get('/api/config');
    assert.deepEqual(c.agentes.map((a) => a.id), ['lider', 'buzina']);
    assert.equal(c.agentes.find((a) => a.id === 'buzina').forma, 'salsicha');
    // time guardado que não vale mais: sobe com o do arquivo e guarda o arquivo ruim de lado
    await s.parar();
    await fs.writeFile(path.join(dados, 'time-em-uso.json'), JSON.stringify({ time: { nome: 'x', agentes: [] } }));
    s = await subir(dados); servidores.push(s);
    assert.ok((await s.get('/api/config')).agentes.length >= 2);
    assert.ok(await fs.stat(path.join(dados, 'time-em-uso.json.invalido')));
  } finally {
    // servidor que ficou de pé por um erro no meio do teste não pode prender o processo
    for (const x of servidores) await Promise.race([x.parar(), new Promise((r) => setTimeout(r, 3000))]);
    await fs.rm(dados, { recursive: true, force: true });
  }
});

test('mover os bonecos no palco muda só o lugar deles, e o lugar novo volta quando a Muvuca reabre', async () => {
  const dados = await fs.mkdtemp(path.join(os.tmpdir(), 'muvuca-palco-livre-'));
  const servidores = [];
  try {
    let s = await subir(dados); servidores.push(s);
    const antes = await s.get('/api/config');
    const [a, b] = antes.agentes;
    const r = await s.post('/api/desenho', { pos: { [a.id]: [2.345, -1], [b.id]: [-3, 4] } });
    assert.equal(r.s, 200, JSON.stringify(r));
    let c = await s.get('/api/config');
    assert.deepEqual(c.agentes.find((x) => x.id === a.id).pos, [2.35, -1], 'arredondado');
    assert.deepEqual(c.agentes.find((x) => x.id === b.id).pos, [-3, 4]);
    // o time não muda: mesmos agentes, mesmas funções e chefes
    const semPos = (lista) => lista.map(({ pos, ...x }) => x);
    assert.deepEqual(semPos(c.agentes), semPos(antes.agentes));
    // entradas ruins: recusadas com uma frase, sem mudar nada
    assert.equal((await s.post('/api/desenho', { pos: { fantasma: [0, 0] } })).s, 400);
    assert.equal((await s.post('/api/desenho', { pos: { [a.id]: [0, 999] } })).s, 400);
    assert.equal((await s.post('/api/desenho', { pos: [] })).s, 400);
    assert.equal((await s.post('/api/desenho', {})).s, 400);
    assert.deepEqual((await s.get('/api/config')).agentes.find((x) => x.id === a.id).pos, [2.35, -1]);
    await s.parar();
    s = await subir(dados); servidores.push(s);
    c = await s.get('/api/config');
    assert.deepEqual(c.agentes.find((x) => x.id === a.id).pos, [2.35, -1], 'o lugar novo sobrevive a reabrir');
    assert.deepEqual(semPos(c.agentes), semPos(antes.agentes));
  } finally {
    for (const x of servidores) await Promise.race([x.parar(), new Promise((r) => setTimeout(r, 3000))]);
    await fs.rm(dados, { recursive: true, force: true });
  }
});
