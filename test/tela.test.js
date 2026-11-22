// Testes das regras da tela que não dependem do navegador (public/js/regras/) e da forma como a tela é dividida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ligarSeta, desligarSeta } from '../public/js/regras/setas.js';
import { criarHistorico } from '../public/js/regras/historico.js';

const PUBLIC = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'public');
const ag = (id, extra = {}) => ({ id, nome: id[0].toUpperCase() + id.slice(1), ferramentas: ['ler', 'escrever'], ...extra });
const time = (arquitetura, agentes) => ({ nome: 'teste', arquitetura, agentes });
const ids = (t) => t.agentes.map((a) => a.id);

test('setas na rede: ligar acrescenta, repetir avisa, desligar tira; sem lista, o agente fala com todos', () => {
  const t = time('rede', [ag('back', { conexoes: ['front'] }), ag('front', { conexoes: [] }), ag('testes'), ag('revisor', { funcao: 'revisor' })]);
  assert.deepEqual(ligarSeta(t, 'front', 'back'), { mudou: true, mensagem: 'Front agora passa a vez para Back.' });
  assert.deepEqual(t.agentes[1].conexoes, ['back']);
  assert.equal(ligarSeta(t, 'front', 'back').mudou, false, 'seta repetida não muda nada');
  assert.match(ligarSeta(t, 'back', 'revisor').mensagem, /revisor fica fora das setas/);
  assert.match(ligarSeta(t, 'revisor', 'back').mensagem, /revisor fica fora das setas/);
  // "testes" não tem lista: vale "todos menos ele e o revisor"
  assert.equal(ligarSeta(t, 'testes', 'back').mudou, false, 'já fala com todos');
  assert.equal(desligarSeta(t, 'testes', 'back').mudou, true);
  assert.deepEqual(t.agentes[2].conexoes, ['front'], 'a lista implícita vira explícita, sem o que saiu e sem o revisor');
  assert.equal(desligarSeta(t, 'back', 'front').mudou, true);
  assert.deepEqual(t.agentes[0].conexoes, []);
});

test('setas na esteira: o destino passa a vir logo depois da origem', () => {
  const t = time('sequencial', [ag('analise'), ag('codigo'), ag('testes'), ag('docs')]);
  assert.equal(ligarSeta(t, 'analise', 'docs').mudou, true);
  assert.deepEqual(ids(t), ['analise', 'docs', 'codigo', 'testes']);
  assert.equal(ligarSeta(t, 'testes', 'analise').mudou, true);
  assert.deepEqual(ids(t), ['docs', 'codigo', 'testes', 'analise']);
  const r = desligarSeta(t, 'docs', 'codigo');
  assert.equal(r.mudou, false); assert.match(r.mensagem, /a ordem é a da lista/);
  assert.deepEqual(ids(t), ['docs', 'codigo', 'testes', 'analise'], 'recusa não mexe na ordem');
});

test('setas no supervisor: seta entre dois agentes cria um sub-líder e o time vira hierárquico', () => {
  const t = time('centralizada', [ag('maestro', { funcao: 'lider', ferramentas: [] }), ag('back'), ag('front'), ag('revisor', { funcao: 'revisor' })]);
  assert.match(ligarSeta(t, 'maestro', 'back').mensagem, /já responde a Maestro/);
  assert.equal(t.arquitetura, 'centralizada', 'recusa não muda a arquitetura');
  assert.match(desligarSeta(t, 'maestro', 'back').mensagem, /todos respondem ao líder/);
  const r = ligarSeta(t, 'back', 'front');
  assert.equal(r.mudou, true);
  assert.match(r.mensagem, /Front agora responde a Back\. Back virou sub-líder.*A arquitetura virou hierárquica\./);
  assert.equal(t.arquitetura, 'hierarquica');
  assert.deepEqual([t.agentes[1].funcao, t.agentes[1].ferramentas, t.agentes[2].chefe], ['sublider', [], 'back']);
});

test('setas na hierárquica: sem chefia em círculo, o líder não responde a ninguém, e tirar devolve ao líder', () => {
  const t = time('hierarquica', [ag('dir', { funcao: 'lider', ferramentas: [] }), ag('subA', { funcao: 'sublider', ferramentas: [] }), ag('subB', { funcao: 'sublider', ferramentas: [], chefe: 'subA' }), ag('exec', { chefe: 'subB' }), ag('revisor', { funcao: 'revisor' })]);
  assert.match(ligarSeta(t, 'subA', 'dir').mensagem, /líder não responde a ninguém/);
  assert.match(ligarSeta(t, 'subB', 'subA').mensagem, /daria uma volta/);
  assert.match(ligarSeta(t, 'exec', 'subA').mensagem, /daria uma volta/, 'círculo de três níveis também');
  assert.equal(t.agentes[3].funcao, undefined, 'recusa não promove ninguém');
  assert.equal(ligarSeta(t, 'subA', 'exec').mudou, true);
  assert.equal(t.agentes[3].chefe, 'subA');
  assert.equal(ligarSeta(t, 'dir', 'exec').mudou, true);
  assert.equal(t.agentes[3].chefe, '', 'seta do líder tira o chefe intermediário');
  t.agentes[3].chefe = 'subB';
  assert.deepEqual(desligarSeta(t, 'subB', 'exec'), { mudou: true, mensagem: 'Exec voltou a responder direto ao líder.' });
  assert.equal(t.agentes[3].chefe, '');
  assert.match(desligarSeta(t, 'dir', 'subA').mensagem, /Todo mundo responde a alguém/);
  assert.match(desligarSeta(t, 'dir', 'revisor').mensagem, /revisor sempre responde ao líder/);
});

test('setas: agente único não tem setas; agente inexistente ou seta para si mesmo não faz nada', () => {
  const t = time('unico', [ag('solo'), ag('revisor', { funcao: 'revisor' })]);
  assert.match(ligarSeta(t, 'solo', 'revisor').mensagem, /um agente só/);
  const antes = JSON.stringify(t);
  assert.equal(ligarSeta(t, 'solo', 'solo'), null);
  assert.equal(ligarSeta(t, 'solo', 'fantasma'), null);
  assert.equal(desligarSeta(t, 'fantasma', 'solo'), null);
  assert.equal(JSON.stringify(t), antes);
});

test('histórico: desfazer e refazer andam pelos estados; mudança nova apaga o que havia para refazer', () => {
  const h = criarHistorico();
  assert.equal(h.desfazer('a'), null, 'sem passado, nada a desfazer');
  h.registrar('a'); h.registrar('a'); h.registrar('b'); h.registrar('c');
  assert.equal(h.passos, 2, 'estado repetido não vira passo');
  assert.equal(h.desfazer('c'), 'b');
  assert.equal(h.desfazer('b'), 'a');
  assert.equal(h.desfazer('a'), null);
  assert.deepEqual([h.podeDesfazer, h.podeRefazer], [false, true]);
  assert.equal(h.refazer('a'), 'b');
  assert.equal(h.refazer('b'), 'c');
  assert.equal(h.refazer('c'), null);
  // desfaz um passo, faz uma mudança nova: o "c" não pode mais voltar
  assert.equal(h.desfazer('c'), 'b');
  assert.equal(h.refazer('x'), null, 'a mudança ainda não registrada conta, e apaga o refazer');
  assert.equal(h.desfazer('x'), 'b');
  h.limpar();
  assert.deepEqual([h.podeDesfazer, h.podeRefazer, h.desfazer('z')], [false, false, null]);
});

test('histórico: guarda no máximo o limite de passos, descartando os mais antigos', () => {
  const h = criarHistorico(3);
  for (const e of ['0', '1', '2', '3', '4', '5']) h.registrar(e);
  assert.equal(h.passos, 3);
  assert.deepEqual([h.desfazer('5'), h.desfazer('4'), h.desfazer('3'), h.desfazer('2')], ['4', '3', '2', null]);
});

test('tela dividida: todo arquivo que o index.html pede existe, e nenhum script fica de fora', () => {
  const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
  const pedidos = [...html.matchAll(/(?:src|href)="\/((?:js|css)\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(pedidos.length >= 10, 'o index.html carrega os estilos e os scripts');
  for (const p of pedidos) {
    assert.ok(fs.existsSync(path.join(PUBLIC, p)), `falta public/${p}`);
    assert.match('/' + p, /^\/(css\/[a-z0-9-]+\.css|js\/(?:[a-z0-9-]+\/)?[a-z0-9-]+\.js)$/, `o servidor não serviria ${p}`);
  }
  const noDisco = fs.readdirSync(path.join(PUBLIC, 'js')).filter((n) => n.endsWith('.js')).map((n) => 'js/' + n);
  assert.deepEqual(noDisco.filter((n) => !pedidos.includes(n)), [], 'script em public/js/ que o index.html não carrega');
  assert.equal(/<script>(?!\s*<\/script>)/.test(html), false, 'sem script embutido no index.html');
  assert.equal(/<style>/.test(html), false, 'sem estilo embutido no index.html');
  assert.equal(pedidos.findIndex((p) => p === 'js/regras/ponte.js') < pedidos.findIndex((p) => p === 'js/base.js'), true, 'as regras entram antes da tela');
  assert.equal(pedidos.filter((p) => p.startsWith('js/')).at(-1), 'js/inicio.js', 'inicio.js é o último');
});
