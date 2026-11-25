// Entrar com o Claude: o servidor aciona o login do Claude Code e acompanha; e um pedido que falha por login
// vencido chega à tela como erro de login, não como resposta do agente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { subir } from './apoio/servidor-de-teste.js';
import { chamar, FALHA_DE_LOGIN } from '../src/provedores.js';
import { Muvuca } from '../src/orquestrador.js';

const pasta = (p) => fs.mkdtemp(path.join(os.tmpdir(), p));
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const cfg = JSON.parse(await fs.readFile(new URL('../config/agentes.json', import.meta.url), 'utf8'));
const SEM_LOGIN = fileURLToPath(new URL('./apoio/falso-cli-sem-login.js', import.meta.url));
// um "claude auth login" de mentira: imprime o endereço de login, espera um pouco e termina
const loginFalso = (codigo, espera = 1200) => `"${process.execPath}" -e "console.log('Abra https://exemplo.test/login?codigo=abc para entrar'); setTimeout(() => process.exit(${codigo}), ${espera})"`;

test('entrar com o Claude: o servidor aciona o login, repassa o endereço e avisa quando o processo termina', async () => {
  const s = await subir(await pasta('muvuca-dados-'), { MUVUCA_LOGIN_CLAUDE: loginFalso(0, 5000) });
  try {
    const antes = await s.get('/api/claude/entrar');
    assert.deepEqual([antes.andamento, typeof antes.logado, antes.link, antes.erro], [false, 'boolean', undefined, undefined]);
    assert.equal((await s.post('/api/claude/entrar', {})).s, 200);
    assert.equal((await s.post('/api/claude/entrar', {})).s, 200, 'clicar duas vezes não abre dois logins');
    let durante; for (let i = 0; i < 30; i++) { durante = await s.get('/api/claude/entrar'); if (durante.link) break; await dormir(100); }
    assert.equal(durante.andamento, true);
    assert.equal(durante.link, 'https://exemplo.test/login?codigo=abc', 'o endereço que o Claude Code imprime vira o link de reserva da tela');
    let depois; for (let i = 0; i < 150; i++) { depois = await s.get('/api/claude/entrar'); if (!depois.andamento) break; await dormir(100); }
    assert.equal(depois.andamento, false);
    assert.equal(depois.erro, undefined, 'processo que terminou bem não vira erro');
    // sem a chave de acesso, ninguém aciona o login
    assert.equal((await s.cru('/api/claude/entrar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 401);
    // a resposta nunca traz e-mail nem dados da conta
    assert.equal(JSON.stringify(depois).includes('@'), false);
  } finally { await s.parar(); }
});

test('entrar com o Claude: login que o Claude Code não conclui aparece como erro, e dá para tentar de novo', async () => {
  const s = await subir(await pasta('muvuca-dados-'), { MUVUCA_LOGIN_CLAUDE: loginFalso(1, 300) });
  try {
    await s.post('/api/claude/entrar', {});
    let r; for (let i = 0; i < 60; i++) { r = await s.get('/api/claude/entrar'); if (!r.andamento) break; await dormir(100); }
    assert.equal(r.andamento, false);
    assert.match(r.erro, /não concluiu o login/);
    assert.equal((await s.post('/api/claude/entrar', {})).s, 200);
    assert.equal((await s.get('/api/claude/entrar')).andamento, true, 'nova tentativa começa do zero');
  } finally { await s.parar(); }
});

test('login vencido no meio de um pedido: vira erro de login com nome, não resposta do agente', async () => {
  for (const frase of ['Failed to authenticate: OAuth session expired and could not be refreshed', 'Invalid API key · Please run /login', 'authentication_error']) assert.match(frase, FALHA_DE_LOGIN, frase);
  for (const frase of ['Arquivo criado.', 'O teste de autenticação do projeto passou.', 'login.html pronto']) assert.equal(FALHA_DE_LOGIN.test(frase), false, frase);
  const prov = { tipo: 'cli', comando: process.execPath, args: [SEM_LOGIN], argsLeitura: [SEM_LOGIN] };
  await assert.rejects(chamar(prov, { sistema: 's', mensagens: [{ role: 'user', content: 'oi' }], ferramentas: ['ler'], cwd: os.tmpdir() }), (e) => e.codigo === 'login' && /venceu ou ainda não foi feito/.test(e.message));

  const c = structuredClone(cfg);
  c.provedores.cli = prov;
  for (const a of c.agentes) a.provedor = 'cli';
  const e = new Muvuca(c);
  await e.pedido({ texto: 'Crie o arquivo', projeto: await pasta('muvuca-'), para: 'catraca' });
  const erro = e.eventos.find((x) => x.tipo === 'erro');
  assert.equal(erro?.codigo, 'login', JSON.stringify(e.eventos.map((x) => x.tipo)));
  assert.match(erro.texto, /Entre de novo/);
  assert.equal(e.eventos.some((x) => x.tipo === 'fala' && /Failed to authenticate/.test(x.texto || '')), false, 'a mensagem crua do aplicativo não aparece como fala do agente');
  assert.equal(e.rodando, false);
});
