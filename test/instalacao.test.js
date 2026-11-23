// O que precisa valer para a Muvuca ser instalada em qualquer máquina: dados fora da pasta do app,
// primeira abertura guiada, porta livre e o comando "muvuca".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizarPreferencias } from '../src/ajustes.js';

import { subir, RAIZ } from './apoio/servidor-de-teste.js';

test('preferências: a pasta de fábrica pode vir de fora e as boas-vindas começam por fazer', () => {
  const raiz = path.resolve('/apps/muvuca'), padrao = path.resolve('/casa/Muvuca/primeiro-projeto');
  const p = normalizarPreferencias({}, { raiz, padrao });
  assert.equal(p.projetoPadrao, padrao);
  assert.equal(p.inicioFeito, false);
  assert.equal(normalizarPreferencias({ inicioFeito: true }, { raiz, padrao }).inicioFeito, true);
  assert.equal(normalizarPreferencias({ inicioFeito: 'sim' }, { raiz, padrao }).inicioFeito, false, 'só o verdadeiro de verdade conta');
  const escolhida = path.resolve('/x/meu-app');
  assert.equal(normalizarPreferencias({ projetoPadrao: escolhida }, { raiz, padrao }).projetoPadrao, escolhida, 'a escolha do usuário vence a de fábrica');
});

test('primeira abertura: dados na pasta escolhida, boas-vindas criam a pasta do projeto e nada é escrito na pasta do app', async () => {
  const dados = await fs.mkdtemp(path.join(os.tmpdir(), 'muvuca-dados-'));
  const projetos = await fs.mkdtemp(path.join(os.tmpdir(), 'muvuca-casa-'));
  const antes = (await fs.readdir(RAIZ)).sort().join();
  const s = await subir(dados);
  try {
    assert.match(s.saida(), /dados em /);
    assert.notEqual(s.porta, 4317, 'porta 0 escolhe uma livre');
    const i = await s.get('/api/inicio');
    assert.equal(i.feito, false);
    assert.equal(path.resolve(i.pastaDados), path.resolve(dados));
    assert.equal(typeof i.claude.instalado, 'boolean');
    assert.ok(path.isAbsolute(i.pasta));
    assert.equal(JSON.stringify(i).includes('@'), false, 'nada de e-mail da conta na resposta');

    assert.equal((await s.post('/api/inicio', { pasta: 'relativa/pasta', provedor: 'demo' })).s, 400);
    assert.equal((await s.post('/api/inicio', { pasta: '', provedor: 'demo' })).s, 400);
    const arquivo = path.join(projetos, 'sou-arquivo.txt'); await fs.writeFile(arquivo, 'x');
    assert.equal((await s.post('/api/inicio', { pasta: arquivo, provedor: 'demo' })).s, 400, 'arquivo não serve de pasta');
    assert.equal((await s.get('/api/inicio')).feito, false, 'recusa não conclui as boas-vindas');

    const alvo = path.join(projetos, 'novo', 'meu-projeto');
    const r = await s.post('/api/inicio', { pasta: alvo, provedor: 'demo' });
    assert.equal(r.s, 200, JSON.stringify(r.j));
    assert.deepEqual([r.j.criada, r.j.provedor, path.resolve(r.j.pasta)], [true, 'demo', alvo]);
    assert.equal((await fs.stat(alvo)).isDirectory(), true);

    const depois = await s.get('/api/inicio');
    assert.deepEqual([depois.feito, path.resolve(depois.pasta), depois.pastaExiste], [true, alvo, true]);
    const gravado = JSON.parse(await fs.readFile(path.join(dados, 'preferencias.json'), 'utf8'));
    assert.deepEqual([gravado.inicioFeito, gravado.projetoPadrao, gravado.provedorTime], [true, alvo, 'demo']);
    assert.equal((await s.get('/api/projetos')).projetos.some((p) => path.resolve(p.caminho) === alvo), true, 'a pasta entra na lista de projetos');
    assert.equal(path.resolve((await s.get('/api/config')).projetoPadrao), alvo);
    // a Buzina solta fica na pasta de dados: vale para o navegador e para o aplicativo de mesa, que têm endereços diferentes
    assert.equal((await s.get('/api/config')).buzina, false);
    assert.deepEqual((await s.post('/api/buzina/solta', { solta: true })).j, { ok: true, solta: true });
    assert.equal((await s.get('/api/config')).buzina, true);
    assert.equal((await s.post('/api/buzina/solta', { solta: 'sim' })).j.solta, false, 'só o verdadeiro de verdade solta');
    await s.post('/api/buzina/solta', { solta: true });
    const ruim = await s.post('/api/inicio', { pasta: alvo, provedor: 'nao-existe' });
    assert.ok(ruim.s === 400 && /não encontrado/.test(ruim.j.erro), JSON.stringify(ruim.j));
  } finally { await s.parar(); }
  assert.equal((await fs.readdir(RAIZ)).sort().join(), antes, 'a pasta do app fica como estava');

  // segunda abertura: lembra de tudo
  const s2 = await subir(dados);
  try {
    assert.equal((await s2.get('/api/inicio')).feito, true);
    assert.equal((await s2.get('/api/config')).buzina, true, 'a Buzina continua solta depois de reabrir');
  } finally { await s2.parar(); }
});

test('quem já tinha preferências de antes das boas-vindas não passa por elas', async () => {
  const dados = await fs.mkdtemp(path.join(os.tmpdir(), 'muvuca-dados-'));
  const pasta = await fs.mkdtemp(path.join(os.tmpdir(), 'muvuca-proj-'));
  await fs.writeFile(path.join(dados, 'preferencias.json'), JSON.stringify({ projetoPadrao: pasta, maxCiclos: 2 }));
  const s = await subir(dados);
  try {
    const i = await s.get('/api/inicio');
    assert.deepEqual([i.feito, path.resolve(i.pasta)], [true, pasta]);
  } finally { await s.parar(); }
});

test('porta ocupada: o servidor avisa em português e sai, em vez de morrer com erro cru', async () => {
  const dados = await fs.mkdtemp(path.join(os.tmpdir(), 'muvuca-dados-'));
  const s = await subir(dados);
  try {
    const r = spawnSync(process.execPath, [path.join(RAIZ, 'src', 'servidor.js')], { env: { ...process.env, MUVUCA_DADOS: dados, MUVUCA_PORTA: String(s.porta), NODE_TEST_CONTEXT: '' }, encoding: 'utf8', timeout: 30000 });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /já está em uso/);
  } finally { await s.parar(); }
});

test('comando muvuca: versão, ajuda e porta inválida', () => {
  const rodar = (...a) => spawnSync(process.execPath, [path.join(RAIZ, 'bin', 'muvuca.js'), ...a], { encoding: 'utf8', timeout: 30000 });
  const v = rodar('--versao');
  assert.equal(v.status, 0); assert.match(v.stdout.trim(), /^\d+\.\d+\.\d+$/);
  const h = rodar('--ajuda');
  assert.equal(h.status, 0); assert.match(h.stdout, /--porta/); assert.match(h.stdout, /--dados/);
  const p = rodar('--porta', 'abc');
  assert.equal(p.status, 2); assert.match(p.stderr, /Porta inválida/);
});
