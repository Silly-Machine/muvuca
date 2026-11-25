// Testes das regras da tela que não dependem do navegador (public/js/regras/) e da forma como a tela é dividida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ligarSeta, desligarSeta } from '../public/js/regras/setas.js';
import { criarHistorico } from '../public/js/regras/historico.js';
import * as desenho from '../public/js/regras/desenho.js';

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
  const t = time('centralizada', [ag('batuta', { funcao: 'lider', ferramentas: [] }), ag('back'), ag('front'), ag('revisor', { funcao: 'revisor' })]);
  assert.match(ligarSeta(t, 'batuta', 'back').mensagem, /já responde a Batuta/);
  assert.equal(t.arquitetura, 'centralizada', 'recusa não muda a arquitetura');
  assert.match(desligarSeta(t, 'batuta', 'back').mensagem, /todos respondem ao líder/);
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


// ---------- desenho do time (regras/desenho.js) ----------
// Hierarquia em cadeia: líder → sub1 → sub2 → ... → subN, cada sub-líder com um executor e o último com dois.
function cadeia(niveis) {
  const ags = [ag('lider', { funcao: 'lider', ferramentas: [] })];
  let chefe = 'lider';
  for (let i = 1; i <= niveis; i++) { ags.push(ag(`sub${i}`, { funcao: 'sublider', ferramentas: [], chefe })); ags.push(ag(`exec${i}`, { chefe: `sub${i}` })); chefe = `sub${i}`; }
  ags.push(ag('ultimo', { chefe }), ag('revisor', { funcao: 'revisor', ferramentas: ['ler'] }));
  return time('hierarquica', ags);
}

test('desenho automático: hierarquia funda sem cruzar setas, cada chefe sobre os seus, sempre igual', () => {
  const t = cadeia(7);
  const p = desenho.layoutAutomatico(t);
  assert.deepEqual(desenho.layoutAutomatico(t), p, 'determinístico');
  assert.equal(Object.keys(p).length, t.agentes.length);
  const prof = Math.max(...Object.values(p).map(([, y]) => y));
  assert.ok(prof >= 8, `a cadeia vai até o fim, sem corte de 6 níveis (${prof})`);
  for (const [chefe, sub] of desenho.relacoes(t)) assert.equal(p[sub][1], p[chefe][1] + 1, `${sub} fica uma camada abaixo de ${chefe}`);
  // sem cruzamento: em cada camada, os filhos de chefes diferentes não se intercalam, na mesma ordem dos chefes
  const filhosDe = (id) => desenho.relacoes(t).filter(([c]) => c === id).map(([, s]) => p[s][0]);
  const chefes = [...new Set(desenho.relacoes(t).map(([c]) => c))];
  for (const a of chefes) for (const b of chefes) {
    if (a === b || p[a][1] !== p[b][1] || p[a][0] >= p[b][0]) continue;
    assert.ok(Math.max(...filhosDe(a)) < Math.min(...filhosDe(b)), `filhos de ${a} e de ${b} se cruzariam`);
  }
  for (const c of chefes) { const f = filhosDe(c); assert.ok(p[c][0] >= Math.min(...f) && p[c][0] <= Math.max(...f), `${c} centrado sobre os seus`); }
  // ninguém em cima de ninguém
  const v = Object.values(p);
  v.forEach((a, i) => v.slice(i + 1).forEach((b) => assert.ok(Math.abs(a[0] - b[0]) >= 1 || Math.abs(a[1] - b[1]) >= 1, 'agentes sobrepostos')));
});

test('desenho automático: esteira em linha, rede em anel ou em camadas, revisor fora do anel', () => {
  const est = desenho.layoutAutomatico(time('sequencial', [ag('revisor', { funcao: 'revisor' }), ag('a'), ag('b'), ag('c')]));
  assert.deepEqual(Object.keys(est).sort((x, y) => est[x][0] - est[y][0]), ['a', 'b', 'c', 'revisor'], 'na ordem, revisor no fim');
  assert.ok(Object.values(est).every(([, y]) => y === 0));

  const rede = time('rede', [ag('a', { conexoes: ['b'] }), ag('b', { conexoes: ['c'] }), ag('c', { conexoes: ['d'] }), ag('d', { conexoes: ['a'] }), ag('e', { conexoes: ['a'] }), ag('revisor', { funcao: 'revisor' })]);
  const anel = desenho.layoutAutomatico(rede);
  const membros = ['a', 'b', 'c', 'd', 'e'], cx = membros.reduce((s, id) => s + anel[id][0], 0) / 5;
  assert.ok(Math.abs(anel.a[0] - cx) < 0.01 && membros.every((id) => anel[id][1] >= anel.a[1]), 'quem começa fica no topo do anel');
  assert.ok(membros.every((id) => anel.revisor[1] > anel[id][1]), 'o revisor fica embaixo, fora do anel');

  const cam = desenho.layoutAutomatico(rede, { rede: 'camadas' });
  assert.deepEqual(['a', 'b', 'c', 'd', 'e'].map((id) => cam[id][1]), [0, 1, 2, 3, 4], 'camada = distância a partir de quem começa; "e" ninguém alcança e fica no fim');
  assert.deepEqual(desenho.layoutAutomatico({ ...rede, desenho: { rede: 'camadas' } }), cam, 'a escolha guardada no time vale');
});

test('completar: quem tem posição não sai do lugar; o novo fica perto do chefe ou do ponto pedido, sem cobrir ninguém', () => {
  const t = time('centralizada', [ag('lider', { funcao: 'lider', ferramentas: [], pos: [0, 0] }), ag('a', { pos: [-1, 1] }), ag('b', { pos: [0, 1] }), ag('novo')]);
  const p = desenho.completar(t);
  assert.deepEqual([p.lider, p.a, p.b], [[0, 0], [-1, 1], [0, 1]]);
  assert.equal(p.novo[1], 1, 'na camada embaixo do líder');
  assert.ok(Object.entries(p).every(([id, q]) => id === 'novo' || Math.abs(q[0] - p.novo[0]) >= 1 || Math.abs(q[1] - p.novo[1]) >= 1));
  assert.equal(t.agentes[3].pos, undefined, 'não altera o time recebido');
  assert.deepEqual(desenho.completar(t, { perto: { novo: [5, 3] } }).novo, [5, 3], 'o ponto onde a peça foi solta');
  assert.deepEqual(desenho.completar(t, { perto: { novo: [0.2, 1] } }).novo.length, 2);
  assert.ok(Math.abs(desenho.completar(t, { perto: { novo: [0.2, 1] } }).novo[0] - 0.2) >= 0.8, 'ponto ocupado: vai para o lado');
  // posição inválida conta como sem posição
  const s = time('sequencial', [ag('a', { pos: [0, 0] }), ag('b', { pos: ['x', 1] })]);
  assert.deepEqual(desenho.completar(s).b, [1, 0], 'na esteira, à direita do anterior');
  // ninguém com posição: desenho automático
  const u = time('sequencial', [ag('a'), ag('b')]);
  assert.deepEqual(desenho.completar(u), desenho.layoutAutomatico(u));
});
test('setas quadradas e arredondadas: mesmo ponto de saída e de chegada, só o traço muda', () => {
  const A = { x: 100, topo: 0, base: 80, meio: 40, raio: 30 }, B = { x: 200, topo: 140, base: 220, meio: 180, raio: 30 };
  assert.equal(desenho.rotaDaSeta(A, B), 'M100 80V110H200V140', 'quadrada: do pé de A, cotovelo de cantos vivos, até a cabeça de B');
  assert.equal(desenho.rotaDaSeta(A, B, 'arredondadas'), 'M100 80C100 110 200 110 200 140', 'arredondada: curva entre os mesmos pontos');
  assert.equal(desenho.rotaDaSeta(B, A), 'M200 140V110H100V80', 'B em cima: sobe da cabeça ao pé');
  const C = { x: 260, topo: 10, base: 90, meio: 50, raio: 30 };
  assert.equal(desenho.rotaDaSeta(A, C), 'M128 40H180V50H232', 'lado a lado: de lateral a lateral');
  assert.match(desenho.rotaDaSeta(A, C, 'arredondadas'), /^M128 40C180 40 180 50 232 50$/);
  assert.equal(desenho.rotaDaSeta(A, { ...B, x: 100 }), 'M100 80V140', 'alinhados: reta, nos dois estilos');
  assert.equal(desenho.rotaDaSeta(A, { ...B, x: 100 }, 'arredondadas'), 'M100 80V140');
  // rede: reta, ou curva suave para o lado
  assert.match(desenho.retaDaRede(A, B), /^M[\d.]+ [\d.]+L[\d.]+ [\d.]+$/);
  assert.match(desenho.retaDaRede(A, B, 'arredondadas'), /^M[\d.]+ [\d.]+Q[\d.-]+ [\d.-]+ [\d.]+ [\d.]+$/);
  // o estilo guardado no time; qualquer outra coisa vale como quadradas
  assert.equal(desenho.estiloDaSeta({ setas: 'arredondadas' }), 'arredondadas');
  assert.equal(desenho.estiloDaSeta({ setas: 'tortas' }), 'quadradas');
  assert.equal(desenho.estiloDaSeta(null), 'quadradas');
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
  assert.deepEqual(importacoes('regras/indice.js').sort(), ['./desenho.js', './historico.js', './setas.js']);
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
