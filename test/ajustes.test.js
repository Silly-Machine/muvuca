import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { normalizarPreferencias, normalizarProjetos, infoProjeto, pastaPadrao } from '../ajustes.js';

test('preferências: padrão de fábrica é a irmã teste-estudio e os limites ficam na faixa', () => {
  const raiz = path.resolve('/apps/muvuca');
  const p = normalizarPreferencias({}, { raiz, cfg: { maxCiclos: 3, maxPassos: 12 } });
  assert.equal(p.projetoPadrao, pastaPadrao(raiz));
  assert.equal(p.projetoPadrao, path.resolve('/apps/teste-estudio'));
  assert.deepEqual([p.maxCiclos, p.maxPassos, p.comandoTeste], [3, 12, '']);
  const q = normalizarPreferencias({ maxCiclos: 99, maxPassos: -4, comandoTeste: '  npm test  ' }, { raiz });
  assert.deepEqual([q.maxCiclos, q.maxPassos, q.comandoTeste], [10, 1, 'npm test']);
});

test('projetos: exige caminho completo, tira repetidos e põe nome pela pasta', () => {
  const abs = path.resolve('/x/meu-app');
  const l = normalizarProjetos([{ caminho: abs }, { nome: 'outro', caminho: abs.toUpperCase() === abs ? abs : abs }]);
  assert.deepEqual(l, [{ nome: 'meu-app', caminho: abs }]);
  assert.throws(() => normalizarProjetos([{ caminho: 'relativo/pasta' }]), /caminho completo/);
  assert.throws(() => normalizarProjetos([{ nome: 'sem caminho' }]), /falta o caminho/);
});

test('infoProjeto conta arquivos e ignora node_modules', async () => {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), 'muvuca-proj-'));
  await fs.mkdir(path.join(d, 'src')); await fs.mkdir(path.join(d, 'node_modules'));
  await fs.writeFile(path.join(d, 'src', 'a.js'), 'x'); await fs.writeFile(path.join(d, 'node_modules', 'b.js'), 'y');
  const i = await infoProjeto(d);
  assert.equal(i.existe, true); assert.equal(i.arquivos, 1);
  assert.deepEqual(await infoProjeto(path.join(d, 'nao-existe')), { existe: false });
});

test('ponto de restauração: salvar e carregar a foto devolve os mesmos arquivos, e null apaga', async () => {
  const { fotografar, salvarFoto, carregarFoto, restaurar } = await import('../ferramentas.js');
  const proj = await fs.mkdtemp(path.join(os.tmpdir(), 'muvuca-foto-'));
  const dir = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'muvuca-pend-')), '.pendente');
  await fs.mkdir(path.join(proj, 'src')); await fs.writeFile(path.join(proj, 'src', 'a.txt'), 'original');
  await salvarFoto(dir, proj, await fotografar(proj));
  await fs.writeFile(path.join(proj, 'src', 'a.txt'), 'mudou'); await fs.writeFile(path.join(proj, 'novo.txt'), 'x');
  const g = await carregarFoto(dir);
  assert.equal(g.projeto, proj);
  await restaurar(proj, g.foto);   // descartar depois de um "reinício"
  assert.equal(await fs.readFile(path.join(proj, 'src', 'a.txt'), 'utf8'), 'original');
  assert.deepEqual((await fs.readdir(proj)).sort(), ['src']);
  await salvarFoto(dir, proj, null);
  assert.equal(await carregarFoto(dir), null);
});

test('anexos: caminho seguro dentro de anexos/, sem sair da pasta nem levar arquivo protegido', async () => {
  const { caminhoAnexo } = await import('../ajustes.js');
  assert.equal(caminhoAnexo('foto.png'), 'anexos/foto.png');
  assert.equal(caminhoAnexo('minha pasta\\sub/relatório final.pdf'), 'anexos/minha pasta/sub/relatório final.pdf');
  assert.equal(caminhoAnexo('/abs/arquivo.txt'), 'anexos/abs/arquivo.txt', 'barra inicial não vira caminho absoluto');
  assert.equal(caminhoAnexo('C:\\Users\\x\\a.txt'), 'anexos/C/Users/x/a.txt', 'letra de unidade vira pasta comum');
  assert.equal(caminhoAnexo('nome<>:"|?*.txt'), 'anexos/nome.txt');
  assert.throws(() => caminhoAnexo('../../fora.txt'), /inválido/);
  assert.throws(() => caminhoAnexo('pasta/../../fora.txt'), /inválido/);
  assert.throws(() => caminhoAnexo('..\\..\\fora.txt'), /inválido/, 'com barra invertida também');
  assert.throws(() => caminhoAnexo('pasta/.env'), /não pode ser anexado/);
  assert.throws(() => caminhoAnexo('proj/node_modules/x.js'), /não pode ser anexado/);
  assert.throws(() => caminhoAnexo(''), /sem nome/);
  assert.throws(() => caminhoAnexo('a/b/c/d/e/f/g/h/i.txt'), /funda demais/);
});
