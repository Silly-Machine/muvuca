// Vários pedidos ao mesmo tempo: cada conversa aberta tem o próprio time, a própria pasta e os próprios acontecimentos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { subir } from './apoio/servidor-de-teste.js';

const pasta = (p) => fs.mkdtemp(path.join(os.tmpdir(), p));
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const PEDIDO = 'Crie uma página de status com um endpoint /health';
const esperar = async (c, oque = (x) => !x.rodando) => { for (let i = 0; i < 600; i++) { const x = await c.get('/api/config'); if (oque(x)) return x; await dormir(100); } throw new Error('não chegou ao estado esperado'); };
async function eventosDe(s, conversa) {
  const ctl = new AbortController(); const r = await fetch(`${s.base}/api/eventos?conversa=${conversa}`, { headers: { 'x-muvuca-token': s.token }, signal: ctl.signal });
  const leitor = r.body.getReader(); const dec = new TextDecoder(); let buf = ''; const fim = Date.now() + 600;
  while (Date.now() < fim) { const p = await Promise.race([leitor.read(), dormir(200).then(() => null)]); if (p?.value) buf += dec.decode(p.value); }
  ctl.abort(); return buf.split('\n').filter((l) => l.startsWith('data: ')).map((l) => JSON.parse(l.slice(6)));
}

test('abrir e fechar conversas: começa com a principal, abre até quatro, e a principal não fecha', async () => {
  const s = await subir(await pasta('muvuca-dados-'), { DEMO_ATRASO: '0' });
  try {
    const ini = await s.get('/api/sessoes');
    assert.deepEqual(ini.conversas.map((c) => [c.id, c.rodando, c.pendente]), [['1', false, false]]);
    assert.equal(ini.maximo, 4);
    assert.deepEqual([(await s.post('/api/sessoes', { acao: 'abrir' })).j.id, (await s.post('/api/sessoes', { acao: 'abrir' })).j.id, (await s.post('/api/sessoes', { acao: 'abrir' })).j.id], ['2', '3', '4']);
    const cheia = await s.post('/api/sessoes', { acao: 'abrir' });
    assert.equal(cheia.s, 400); assert.match(cheia.j.erro, /no máximo 4 conversas/);
    assert.equal((await s.post('/api/sessoes', { acao: 'fechar', id: '1' })).s, 400, 'a principal não fecha');
    assert.equal((await s.post('/api/sessoes', { acao: 'fechar', id: '9' })).s, 404);
    assert.equal((await s.post('/api/sessoes', { acao: 'fechar', id: '3' })).s, 200);
    assert.deepEqual((await s.get('/api/sessoes')).conversas.map((c) => c.id), ['1', '2', '4']);
    assert.equal((await s.post('/api/sessoes', { acao: 'abrir' })).j.id, '3', 'o número que ficou vago é reaproveitado');
    // chamada para uma conversa que não está aberta é recusada, em vez de cair na principal sem avisar
    const fantasma = await s.de('7').post('/api/nova', {});
    assert.deepEqual([fantasma.s, fantasma.j.codigo], [404, 'conversa']);
    // conversa nova nasce com o time de fábrica, e trocar o time de uma não muda o da outra
    const t2 = (await s.de('2').get('/api/config')).agentes.map((a) => a.id);
    assert.deepEqual(t2, (await s.get('/api/config')).agentes.map((a) => a.id));
    const prontos = (await s.get('/api/times')).times.find((t) => t.origem === 'pronto' && t.agentes.length === 1);
    assert.equal((await s.de('2').post('/api/time', { time: prontos, salvar: false })).s, 200);
    assert.equal((await s.de('2').get('/api/config')).agentes.length, 1);
    assert.equal((await s.get('/api/config')).agentes.length, t2.length, 'a principal continua com o time dela');
  } finally { await s.parar(); }
});

test('dois pedidos ao mesmo tempo, em pastas diferentes: os dois andam juntos e não se misturam', async () => {
  const s = await subir(await pasta('muvuca-dados-'), { DEMO_ATRASO: '120' });   // devagar o bastante para os dois se cruzarem
  const projA = await pasta('muvuca-a-'), projB = await pasta('muvuca-b-');
  try {
    await s.post('/api/sessoes', { acao: 'abrir' });
    const c1 = s.de('1'), c2 = s.de('2');
    assert.equal((await c1.post('/api/pedido', { texto: PEDIDO + ' (A)', projeto: projA })).s, 202);
    assert.equal((await c2.post('/api/pedido', { texto: PEDIDO + ' (B)', projeto: projB })).s, 202);
    const juntos = (await s.get('/api/sessoes')).conversas;
    assert.deepEqual(juntos.map((c) => [c.id, c.rodando]), [['1', true], ['2', true]], 'as duas conversas trabalham ao mesmo tempo');
    assert.deepEqual(juntos.map((c) => c.titulo), [PEDIDO + ' (A)', PEDIDO + ' (B)']);
    // a mesma conversa não aceita um segundo pedido enquanto trabalha
    assert.equal((await c1.post('/api/pedido', { texto: 'outro', projeto: projA })).s, 409);
    // preferências valem para todas: não mudam com alguma conversa trabalhando
    const pr = await s.post('/api/preferencias', { preferencias: { maxCiclos: 2 } });
    assert.equal(pr.s, 409); assert.match(pr.j.erro, /alguma conversa/);
    // parar uma não para a outra
    await esperar(c1); await esperar(c2);
    const e1 = await eventosDe(s, '1'), e2 = await eventosDe(s, '2');
    assert.deepEqual(e1.filter((e) => e.tipo === 'pedido').map((e) => e.texto), [PEDIDO + ' (A)']);
    assert.deepEqual(e2.filter((e) => e.tipo === 'pedido').map((e) => e.texto), [PEDIDO + ' (B)']);
    for (const [ev, proj] of [[e1, projA], [e2, projB]]) {
      assert.equal(ev.find((e) => e.tipo === 'final')?.aprovado, true);
      assert.equal(path.resolve(ev.find((e) => e.tipo === 'pedido').projeto), proj);
      assert.equal(existsSync(path.join(proj, 'src', 'health.js')), true);
    }
    assert.deepEqual((await s.get('/api/sessoes')).conversas.map((c) => [c.rodando, c.pendente]), [[false, true], [false, true]]);
    // cada uma decide o seu: descartar a B não toca na A
    assert.equal((await c2.post('/api/decidir', { acao: 'descartar' })).s, 200);
    assert.deepEqual(await fs.readdir(projB), []);
    assert.equal(existsSync(path.join(projA, 'src', 'health.js')), true);
    assert.deepEqual((await s.get('/api/sessoes')).conversas.map((c) => c.pendente), [true, false]);
  } finally { await s.parar(); }
});

test('duas conversas não trabalham na mesma pasta, nem com mudanças pendentes nela', async () => {
  const s = await subir(await pasta('muvuca-dados-'), { DEMO_ATRASO: '60' });
  const proj = await pasta('muvuca-p-'), outra = await pasta('muvuca-q-');
  try {
    await s.post('/api/sessoes', { acao: 'abrir' });
    const c1 = s.de('1'), c2 = s.de('2');
    assert.equal((await c1.post('/api/pedido', { texto: PEDIDO, projeto: proj })).s, 202);
    const durante = await c2.post('/api/pedido', { texto: PEDIDO, projeto: proj });
    assert.deepEqual([durante.s, durante.j.codigo], [409, 'pasta']); assert.match(durante.j.erro, /em uso na conversa 1 \(trabalhando\)/);
    // parar uma conversa não mexe na outra
    assert.equal((await c2.post('/api/pedido', { texto: PEDIDO, projeto: outra })).s, 202);
    await c1.post('/api/parar', {});
    await esperar(c1);
    assert.equal((await c2.get('/api/config')).rodando, true, 'a conversa 2 segue trabalhando');
    await esperar(c2);
    assert.equal((await eventosDe(s, '2')).find((e) => e.tipo === 'final')?.aprovado, true);
    assert.equal((await eventosDe(s, '1')).some((e) => e.tipo === 'parado'), true);
    // com mudanças pendentes na conversa 1, a pasta continua reservada
    await c2.post('/api/decidir', { acao: 'aceitar' });   // a conversa 2 resolve o que fez na outra pasta
    // (a conversa 1 foi parada no meio: pode ou não ter chegado a escrever algo)
    if ((await s.get('/api/sessoes')).conversas[0].pendente) {
      const depois = await c2.post('/api/pedido', { texto: PEDIDO, projeto: proj });
      assert.equal(depois.s, 409); assert.match(depois.j.erro, /mudanças esperando decisão/);
      // fechar conversa com decisão pendente é recusado; depois de decidir, fecha
      await c1.post('/api/decidir', { acao: 'descartar' });
    }
    assert.equal((await c2.post('/api/pedido', { texto: PEDIDO, projeto: proj })).s, 202, 'liberada a pasta, a outra conversa pode usar');
    const fecharOcupada = await s.post('/api/sessoes', { acao: 'fechar', id: '2' });
    assert.equal(fecharOcupada.s, 409);
    await esperar(c2);
    const fecharPendente = await s.post('/api/sessoes', { acao: 'fechar', id: '2' });
    assert.deepEqual([fecharPendente.s, fecharPendente.j.codigo], [400, 'decisao']);
    await c2.post('/api/decidir', { acao: 'aceitar' });
    assert.equal((await s.post('/api/sessoes', { acao: 'fechar', id: '2' })).s, 200);
    // a conversa fechada foi para o histórico
    let historico = []; for (let i = 0; i < 40 && historico.length < 1; i++) { await dormir(100); historico = (await s.get('/api/conversas')).conversas; }
    assert.ok(historico.length >= 1);
  } finally { await s.parar(); }
});

test('mudanças pendentes numa segunda conversa voltam junto com o servidor', async () => {
  const dados = await pasta('muvuca-dados-'), proj = await pasta('muvuca-r-');
  const s = await subir(dados, { DEMO_ATRASO: '0' });
  try {
    await s.post('/api/sessoes', { acao: 'abrir' });
    await s.de('2').post('/api/pedido', { texto: PEDIDO, projeto: proj });
    await esperar(s.de('2'));
    assert.equal((await s.get('/api/sessoes')).conversas[1].pendente, true);
  } finally { await s.parar(); }
  const s2 = await subir(dados, { DEMO_ATRASO: '0' });
  try {
    const lista = (await s2.get('/api/sessoes')).conversas;
    assert.deepEqual(lista.map((c) => [c.id, c.pendente]), [['1', false], ['2', true]], 'a conversa 2 reaparece, com a decisão esperando');
    assert.equal(path.resolve(lista[1].projeto), proj);
    assert.equal((await eventosDe(s2, '2')).some((e) => e.tipo === 'diff' && e.arquivos.length >= 1), true);
    assert.equal((await s2.de('2').post('/api/decidir', { acao: 'descartar' })).s, 200);
    assert.deepEqual(await fs.readdir(proj), []);
  } finally { await s2.parar(); }
  // decidido, a conversa extra não volta de novo
  const s3 = await subir(dados, { DEMO_ATRASO: '0' });
  try { assert.deepEqual((await s3.get('/api/sessoes')).conversas.map((c) => c.id), ['1']); } finally { await s3.parar(); }
});
