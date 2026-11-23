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

// A tela é feita de módulos: cada arquivo tem o próprio escopo e declara o que importa. Estes testes conferem a
// estrutura sem navegador: quem importa quem, em que ordem, e que nada escapa para o escopo global.
const JS = path.join(PUBLIC, 'js');
const modulos = () => fs.readdirSync(JS).filter((n) => n.endsWith('.js'));
const importacoes = (arq) => [...fs.readFileSync(path.join(JS, arq), 'utf8').matchAll(/^(?:import|export)\s+(?:[^'"]*?from\s+)?['"]([^'"]+)['"];?\s*$/gm)].map((m) => m[1]);
const ordemDeCarga = () => importacoes('principal.js').map((c) => c.replace('./', ''));

test('tela em módulos: o index.html carrega uma entrada só, sem script nem estilo embutido', () => {
  const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1].trim());
  assert.deepEqual(scripts, ['type="module" src="/js/principal.js"']);
  assert.equal(/<script\b[^>]*>\s*[^<\s]/.test(html), false, 'sem script embutido');
  assert.equal(/<style>/.test(html), false, 'sem estilo embutido');
  for (const m of html.matchAll(/(?:src|href)="\/((?:js|css|fontes)\/[^"]+)"/g)) assert.ok(fs.existsSync(path.join(PUBLIC, m[1])), `falta public/${m[1]}`);
});

test('tela em módulos: a entrada carrega todas as partes, com inicio.js por último', () => {
  const ordem = ordemDeCarga();
  const apoio = ['principal.js', 'estado.js', 'tardias.js'];   // a entrada e os dois módulos que só guardam objetos
  assert.deepEqual(modulos().filter((n) => !apoio.includes(n) && !ordem.includes(n)), [], 'parte da tela que a entrada não carrega');
  assert.deepEqual(ordem.filter((n) => !fs.existsSync(path.join(JS, n))), [], 'a entrada pede arquivo que não existe');
  assert.equal(ordem.at(-1), 'inicio.js'); assert.equal(ordem[0], 'base.js');
  assert.equal(new Set(ordem).size, ordem.length, 'nenhuma parte carregada duas vezes');
});

test('tela em módulos: cada parte só importa das anteriores (sem ciclos), e todo arquivo importado existe e é servido', () => {
  const ordem = ordemDeCarga();
  const livres = ['./estado.js', './tardias.js', './regras/indice.js'];
  for (const [k, arq] of ordem.entries()) {
    for (const de of importacoes(arq)) {
      assert.ok(fs.existsSync(path.join(JS, de)), `${arq} importa ${de}, que não existe`);
      assert.match('/js/' + de.replace('./', ''), /^\/js\/(?:[a-z0-9-]+\/)?[a-z0-9-]+\.js$/, `o servidor não serviria ${de}`);
      if (livres.includes(de)) continue;
      const j = ordem.indexOf(de.replace('./', ''));
      assert.ok(j >= 0 && j < k, `${arq} importa ${de}, que é carregado depois dele: isso criaria um ciclo`);
    }
  }
  for (const arq of ['estado.js', 'tardias.js']) assert.deepEqual(importacoes(arq), [], `${arq} não depende de ninguém`);
  assert.deepEqual(importacoes('regras/indice.js').sort(), ['./historico.js', './setas.js']);
});

test('tela em módulos: nada vai para o escopo global, e o que um módulo usa de outro vem por importação', () => {
  const globais = [];
  for (const arq of modulos()) {
    const s = fs.readFileSync(path.join(JS, arq), 'utf8');
    for (const m of s.matchAll(/\b(?:window|globalThis)\.([A-Za-z_$][\w$]*)\s*=[^=]/g)) globais.push(`${arq}: ${m[1]}`);
  }
  assert.deepEqual(globais, ['inicio.js: muvucaAbrirBoasVindas'], 'a única porta para fora é a do modo de captura');
  // o que é exportado por um módulo é importado por alguém: exportação sem uso é sinal de dependência esquecida
  const usados = new Set(modulos().flatMap((a) => [...fs.readFileSync(path.join(JS, a), 'utf8').matchAll(/^import\s+\{([^}]+)\}\s+from/gm)].flatMap((m) => m[1].split(',').map((x) => x.trim()))));
  for (const arq of ordemDeCarga()) {
    const exp = /^export \{([^}]+)\};?\s*$/m.exec(fs.readFileSync(path.join(JS, arq), 'utf8'));
    for (const n of (exp ? exp[1].split(',').map((x) => x.trim()) : [])) assert.ok(usados.has(n), `${arq} exporta ${n}, que ninguém importa`);
  }
  // funções "de depois": toda chamada por depois.x tem um módulo que registra x
  const registradas = new Set(modulos().flatMap((a) => [...fs.readFileSync(path.join(JS, a), 'utf8').matchAll(/Object\.assign\(depois, \{([^}]+)\}\)/g)].flatMap((m) => m[1].split(',').map((x) => x.trim()))));
  for (const arq of modulos()) for (const m of fs.readFileSync(path.join(JS, arq), 'utf8').matchAll(/\bdepois\.([A-Za-z_$][\w$]*)/g)) assert.ok(registradas.has(m[1]), `${arq} chama depois.${m[1]}, que nenhum módulo registra`);
  // e quem registra uma função "de depois" vem, na ordem de carga, depois de quem a chama
  const ordem = ordemDeCarga();
  for (const arq of ordem) for (const m of fs.readFileSync(path.join(JS, arq), 'utf8').matchAll(/\bdepois\.([A-Za-z_$][\w$]*)\s*\(/g)) {
    const dona = ordem.find((a) => new RegExp(`Object\\.assign\\(depois, \\{[^}]*\\b${m[1]}\\b`).test(fs.readFileSync(path.join(JS, a), 'utf8')));
    assert.ok(ordem.indexOf(dona) > ordem.indexOf(arq), `${arq} chama depois.${m[1]}, mas ${dona} é carregado antes: devia ser importação direta`);
  }
});
