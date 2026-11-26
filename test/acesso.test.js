// Quem pode falar com o servidor local: a chave de acesso, o endereço pedido, a origem e os cabeçalhos de segurança.
// Também: gravação que não corrompe arquivo e o aviso de "já está aberta".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { subir, RAIZ } from './apoio/servidor-de-teste.js';
import { gravarJson, lerJson, normalizarPreferencias } from '../src/ajustes.js';
import { muvucaAberta, versaoDiferente } from '../src/aberta.js';

const pastaDados = () => fs.mkdtemp(path.join(os.tmpdir(), 'muvuca-dados-'));

// fetch não deixa trocar o cabeçalho Host; para forjar o endereço, a requisição vai pelo módulo http
const comHost = (porta, caminho, host, cabecalhos = {}) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port: porta, path: caminho, method: 'GET', headers: { host, ...cabecalhos } }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
  req.on('error', reject); req.end();
});

test('sem a chave de acesso: a API e a página recusam; com a chave no endereço, o navegador ganha um cookie', async () => {
  const s = await subir(await pastaDados());
  try {
    assert.match(s.token, /^[a-f0-9]{48}$/);
    assert.match(s.saida(), new RegExp(`\\?t=${s.token}`), 'o link impresso leva a chave');
    for (const rota of ['/api/config', '/api/eventos', '/api/memoria', '/api/conexoes', '/api/preferencias']) assert.equal((await s.cru(rota)).status, 401, rota);
    const semChave = await s.cru('/api/conexoes/testar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ conexao: { nome: 'x', comando: 'node -v' } }) });
    assert.equal(semChave.status, 401, 'sem a chave, ninguém manda rodar comando');
    assert.equal((await s.cru('/api/config', { headers: { 'x-muvuca-token': 'a'.repeat(48) } })).status, 401, 'chave errada');
    assert.equal((await s.cru('/api/config', { headers: { 'x-muvuca-token': s.token.slice(0, 20) } })).status, 401, 'pedaço da chave');

    const pagina = await s.cru('/');
    assert.equal(pagina.status, 401);
    const texto = await pagina.text();
    assert.match(texto, /ainda não tem acesso/); assert.equal(texto.includes(s.token), false, 'a página de recusa não entrega a chave');
    assert.equal((await s.cru('/?t=errada')).status, 401);

    const entrada = await s.cru(`/?t=${s.token}`);
    assert.equal(entrada.status, 200);
    const cookie = entrada.headers.get('set-cookie') || '';
    assert.match(cookie, new RegExp(`^muvuca_${s.porta}=${s.token};`));
    for (const marca of ['HttpOnly', 'SameSite=Strict', 'Path=/']) assert.ok(cookie.includes(marca), marca);
    assert.match(await entrada.text(), /<title>Muvuca<\/title>/);
    const comCookie = { cookie: cookie.split(';')[0] };
    assert.equal((await s.cru('/api/config', { headers: comCookie })).status, 200, 'o cookie abre a API');
    assert.equal((await s.cru('/', { headers: comCookie })).status, 200, 'e a página, sem a chave no endereço');
    assert.equal((await s.cru('/api/config', { headers: { cookie: `muvuca_${s.porta + 1}=${s.token}` } })).status, 401, 'cookie de outra porta não vale');

    // estilos, scripts e imagens não têm segredo: abrem sem chave (a página de recusa não depende deles, mas a tela sim)
    assert.equal((await s.cru('/css/tema.css')).status, 200);
    assert.equal((await s.cru('/js/inicio.js')).status, 200);
  } finally { await s.parar(); }
});

test('a chave fica na pasta de dados e é a mesma depois de reabrir', async () => {
  const dados = await pastaDados();
  const a = await subir(dados); const primeira = a.token; await a.parar();
  const b = await subir(dados);
  try { assert.equal(b.token, primeira); } finally { await b.parar(); }
  await fs.writeFile(path.join(dados, 'acesso.token'), 'estragado');
  const c = await subir(dados);
  try { assert.match(c.token, /^[a-f0-9]{48}$/); assert.notEqual(c.token, 'estragado', 'chave inválida no arquivo é trocada por uma nova'); } finally { await c.parar(); }
});

test('endereço forjado é recusado, mesmo com a chave; origem de fora não manda comandos', async () => {
  const s = await subir(await pastaDados());
  const chave = { 'x-muvuca-token': s.token };
  try {
    assert.equal(await comHost(s.porta, '/api/config', `127.0.0.1:${s.porta}`, chave), 200);
    assert.equal(await comHost(s.porta, '/api/config', `localhost:${s.porta}`, chave), 200);
    assert.equal(await comHost(s.porta, '/api/config', `site-malicioso.com:${s.porta}`, chave), 403, 'outro nome apontando para cá');
    assert.equal(await comHost(s.porta, '/api/eventos', 'site-malicioso.com', chave), 403);
    assert.equal(await comHost(s.porta, '/', 'localhost.site-malicioso.com', chave), 403);
    assert.equal(await comHost(s.porta, '/css/tema.css', 'site-malicioso.com'), 403, 'nem os arquivos da tela');
    const deFora = await s.cru('/api/nova', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://site-malicioso.com', ...chave }, body: '{}' });
    assert.equal(deFora.status, 403);
    const semJson = await s.cru('/api/nova', { method: 'POST', headers: { 'content-type': 'text/plain', ...chave }, body: 'x=1' });
    assert.equal(semJson.status, 415);
  } finally { await s.parar(); }
});

test('cabeçalhos de segurança: a página só carrega o que vem do próprio servidor e não pode ser emoldurada', async () => {
  const s = await subir(await pastaDados());
  try {
    const p = await s.cru(`/?t=${s.token}`);
    const politica = p.headers.get('content-security-policy') || '';
    for (const regra of ["default-src 'self'", "script-src 'self'", "frame-ancestors 'none'", "connect-src 'self'", "font-src 'self'"]) assert.ok(politica.includes(regra), regra);
    assert.equal(/script-src[^;]*unsafe-inline/.test(politica), false, 'nada de script embutido');
    const html = await p.text();
    assert.deepEqual(html.match(/(?:src|href)\s*=\s*["']?(?:https?:)?\/\/[^"'\s>]+/g) || [], [], 'a página não busca nada fora deste computador');
    const estilos = await Promise.all(['/css/fontes.css', '/css/estilo.css', '/css/tema.css'].map(async (c) => (await s.cru(c)).text()));
    assert.deepEqual(estilos.join('\n').match(/url\(\s*["']?(?:https?:)?\/\/[^)]+/g) || [], [], 'nem os estilos');
    assert.equal((await s.cru('/fontes/nunito-latin-400-normal.woff2')).headers.get('content-type'), 'font/woff2', 'as fontes vêm daqui');
    for (const rota of [`/?t=${s.token}`, '/css/tema.css', '/api/config']) {
      const r = await s.cru(rota, { headers: { 'x-muvuca-token': s.token } });
      assert.equal(r.headers.get('x-content-type-options'), 'nosniff', rota);
      assert.equal(r.headers.get('x-frame-options'), 'DENY', rota);
      assert.equal(r.headers.get('referrer-policy'), 'no-referrer', rota);
    }
  } finally { await s.parar(); }
});

test('gravação de JSON: troca o arquivo de uma vez e não deixa sobra', async () => {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), 'muvuca-json-'));
  const arq = path.join(d, 'preferencias.json');
  await gravarJson(arq, { a: 1 });
  await Promise.all(Array.from({ length: 20 }, (_, i) => gravarJson(arq, { a: i, texto: 'x'.repeat(5000) })));
  const lido = await lerJson(arq, null);
  assert.equal(typeof lido.a, 'number', 'depois de várias gravações juntas, o arquivo continua sendo JSON inteiro');
  assert.deepEqual((await fs.readdir(d)).sort(), ['preferencias.json'], 'nenhum arquivo provisório fica para trás');
  await assert.rejects(gravarJson(path.join(d, 'nao-existe', 'x.json'), {}));
  const p = normalizarPreferencias({ limiteAgenteMin: 999, limiteTestesMin: 0 }, { raiz: d });
  assert.deepEqual([p.limiteAgenteMin, p.limiteTestesMin], [180, 1]);
  assert.deepEqual([normalizarPreferencias({}, { raiz: d }).limiteAgenteMin, normalizarPreferencias({}, { raiz: d }).limiteTestesMin], [10, 3]);
});

test('Muvuca já aberta: quem chega depois acha a que está rodando, e o aviso some quando ela fecha', async () => {
  const dados = await pastaDados();
  assert.equal(await muvucaAberta(dados), null, 'pasta nova: ninguém aberto');
  const s = await subir(dados);
  try {
    const achou = await muvucaAberta(dados);
    const versao = JSON.parse(await fs.readFile(path.join(RAIZ, 'package.json'), 'utf8')).version;
    assert.deepEqual(achou, { porta: s.porta, token: s.token, endereco: `http://127.0.0.1:${s.porta}`, versao, pid: s.pid, raiz: RAIZ }, "a aberta diz quem é: processo e onde está instalada");
    // o comando "muvuca" na mesma pasta de dados não sobe outra: aponta para a que já existe e sai
    const r = spawnSync(process.execPath, [path.join(RAIZ, 'bin', 'muvuca.js'), '--sem-abrir', '--dados', dados], { encoding: 'utf8', timeout: 30000, env: { ...process.env, NODE_TEST_CONTEXT: '' } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, new RegExp(`já está aberta: http://localhost:${s.porta}/\\?t=${s.token}`));
  } finally { await s.parar(); }
  // versão diferente aberta: quem chega depois não aproveita a outra sem avisar
  assert.equal(versaoDiferente(null, '1.1.0'), '', 'ninguém aberto: nada a avisar');
  assert.equal(versaoDiferente({ versao: '1.1.0' }, '1.1.0'), '', 'mesma versão: aproveita');
  const msg = versaoDiferente({ versao: '1.0.1' }, '1.1.0');
  assert.match(msg, /1.0.1 aberta/); assert.match(msg, /esta é a 1.1.0/); assert.match(msg, /feche a outra/); assert.match(msg, /muvuca --encerrar/);
  assert.match(versaoDiferente({ versao: '1.0.0', pid: 5102, raiz: '/opt/muvuca' }, '1.1.0'), /processo 5102, instalada em \/opt\/muvuca/);
  // processo morto: mesmo que o aviso tenha ficado no disco, ninguém é dado como aberto
  await fs.writeFile(path.join(dados, 'aberta.json'), JSON.stringify({ pid: s.pid, porta: s.porta }));
  assert.equal(await muvucaAberta(dados), null);
  await fs.writeFile(path.join(dados, 'aberta.json'), 'lixo');
  assert.equal(await muvucaAberta(dados), null);
});

test('comando "muvuca" com outra versão aberta na mesma pasta de dados: avisa e não mistura as duas', async () => {
  const dados = await pastaDados();
  await fs.writeFile(path.join(dados, 'acesso.token'), 'chave-de-teste');
  // uma "Muvuca" de outra versão, de mentira: só responde a configuração
  const falsa = http.createServer((req, res) => {
    if (req.headers['x-muvuca-token'] !== 'chave-de-teste') { res.writeHead(401); return res.end(); }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ versao: '0.0.1' }));
  });
  await new Promise((ok) => falsa.listen(0, '127.0.0.1', ok));
  try {
    await fs.writeFile(path.join(dados, 'aberta.json'), JSON.stringify({ pid: process.pid, porta: falsa.address().port }));
    // assíncrono: com spawnSync o teste ficaria parado e a Muvuca falsa não conseguiria responder
    const filho = spawn(process.execPath, [path.join(RAIZ, 'bin', 'muvuca.js'), '--sem-abrir', '--dados', dados], { env: { ...process.env, NODE_TEST_CONTEXT: '' } });
    let stderr = ''; filho.stderr.on('data', (d) => { stderr += d; });
    const prazo = setTimeout(() => filho.kill(), 20000);
    const r = { status: await new Promise((ok) => filho.on('close', ok)), stderr }; clearTimeout(prazo);
    assert.equal(r.status, 1, 'não sobe outra nem aponta para a de outra versão');
    assert.match(r.stderr, /Muvuca 0\.0\.1 aberta/);
    assert.match(r.stderr, /feche a outra/);
    assert.match(r.stderr, /muvuca --encerrar/);
  } finally { await new Promise((ok) => falsa.close(ok)); }
});

test('comando "muvuca --encerrar": fecha a Muvuca aberta com a mesma pasta de dados, sem precisar caçar o processo', async () => {
  const dados = await pastaDados();
  const s = await subir(dados);
  const rodarCmd = (...a) => new Promise((ok) => {
    const filho = spawn(process.execPath, [path.join(RAIZ, 'bin', 'muvuca.js'), '--sem-abrir', '--dados', dados, ...a], { env: { ...process.env, NODE_TEST_CONTEXT: '' } });
    let out = ''; filho.stdout.on('data', (d) => { out += d; }); filho.stderr.on('data', (d) => { out += d; });
    filho.on('close', (status) => ok({ status, out }));
  });
  let saiu = false;
  try {
    assert.match(s.saida(), /^Muvuca \d+\.\d+\.\d+ em http:\/\/localhost:/m, 'a linha de início diz a versão');
    const r = await rodarCmd('--encerrar');
    assert.equal(r.status, 0, r.out); assert.ok(r.out.includes(`processo ${s.pid}) encerrada`), r.out);
    saiu = true;
    assert.equal(await muvucaAberta(dados), null, 'depois de encerrar, ninguém está aberto');
    const de2 = await rodarCmd('--encerrar');
    assert.equal(de2.status, 0); assert.match(de2.out, /Nenhuma Muvuca aberta/);
  } finally { if (!saiu) await Promise.race([s.parar(), new Promise((r) => setTimeout(r, 3000))]); }
});
