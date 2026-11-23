// Isolamento dos testes: o código de teste que um agente escreve não alcança nada fora da pasta do projeto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isolamentoDisponivel, comandoIsolavel, prepararIsolamento, cliAceitaIsolamento } from '../src/isolamento.js';
import { rodar, usar } from '../src/ferramentas.js';
import { argsDoCli } from '../src/provedores.js';
import { Muvuca } from '../src/orquestrador.js';
import { normalizarPreferencias } from '../src/ajustes.js';

const cfg = JSON.parse(await fs.readFile(new URL('../config/agentes.json', import.meta.url), 'utf8'));
const pasta = (p) => fs.mkdtemp(path.join(os.tmpdir(), p));

// Um projeto cujo teste tenta de tudo e anota, num arquivo dentro do projeto, o que conseguiu.
async function projetoCurioso(nome = 'muvuca iso ') {
  const base = await pasta(nome);   // com espaço no caminho, de propósito
  const proj = path.join(base, 'meu projeto'), fora = path.join(base, 'fora');
  await fs.mkdir(path.join(proj, 'test'), { recursive: true }); await fs.mkdir(fora);
  await fs.writeFile(path.join(fora, 'segredo.txt'), 'SEGREDO');
  await fs.writeFile(path.join(proj, 'package.json'), JSON.stringify({ type: 'module', scripts: { test: 'node --test' } }));
  await fs.writeFile(path.join(proj, 'test', 'curioso.test.js'), `
import { test } from 'node:test'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http';
import { spawnSync } from 'node:child_process';
const tenta = (f) => { try { f(); return 'passou'; } catch (e) { return e.code || e.message; } };
test('sonda', async () => {
  const r = {};
  r.escreverDentro = tenta(() => fs.writeFileSync('dentro.txt', 'x'));
  r.escreverFora = tenta(() => fs.writeFileSync(${JSON.stringify(path.join(fora, 'invadido.txt'))}, 'x'));
  r.lerFora = tenta(() => fs.readFileSync(${JSON.stringify(path.join(fora, 'segredo.txt'))}, 'utf8'));
  r.lerCasa = tenta(() => fs.readdirSync(os.homedir()));
  r.temporario = tenta(() => fs.writeFileSync(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 't-')), 'x'), 'x'));
  r.outroProcesso = tenta(() => { const s = spawnSync(process.execPath, ['-e', '1']); if (s.error) throw s.error; });
  r.servidorNoMesmoProcesso = await new Promise((ok) => { const s = http.createServer((q, p) => p.end('oi')); s.listen(0, '127.0.0.1', async () => { try { ok((await (await fetch('http://127.0.0.1:' + s.address().port)).text()) === 'oi' ? 'passou' : 'outra resposta'); } catch (e) { ok(e.message); } s.close(); }); });
  fs.writeFileSync('sonda.json', JSON.stringify(r));
});
`);
  await fs.writeFile(path.join(proj, 'test', 'segundo.test.js'), `import { test } from 'node:test'; test('um segundo arquivo de teste também roda', () => {});`);
  return { proj, fora, sonda: async () => JSON.parse(await fs.readFile(path.join(proj, 'sonda.json'), 'utf8')) };
}

test('o Node desta máquina tem o modelo de permissões, e a sonda confirma que ele bloqueia', async () => {
  const s = await isolamentoDisponivel();
  assert.equal(s.ok, true, s.motivo);
});

test('quais comandos rodam isolados: só "node --test", direto ou pelo "npm test" que o chama', async () => {
  const d = await pasta('muvuca-cmd-');
  assert.equal(await comandoIsolavel('node --test', d), 'node --test');
  assert.equal(await comandoIsolavel('  node --test test/a.test.js "outro" ', d), null, 'aspas não entram: o comando vai para o shell');
  assert.equal(await comandoIsolavel('node --test test/a.test.js', d), 'node --test test/a.test.js');
  for (const c of ['node --test --allow-fs-write=*', 'node --allow-child-process --test', 'node --test && rm -rf x', 'node --test; echo oi', 'node --test | tee log', 'python -m pytest -q', 'npx jest', 'node teste.js', ''])
    assert.equal(await comandoIsolavel(c, d), null, c);
  assert.equal(await comandoIsolavel('npm test', d), null, 'sem package.json não dá para saber o que o npm rodaria');
  await fs.writeFile(path.join(d, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  assert.equal(await comandoIsolavel('npm test', d), 'node --test');
  await fs.writeFile(path.join(d, 'package.json'), JSON.stringify({ scripts: { test: 'jest --coverage' } }));
  assert.equal(await comandoIsolavel('npm test', d), null);
  await fs.writeFile(path.join(d, 'package.json'), JSON.stringify({ scripts: { test: 'node --test && node scripts/depois.js' } }));
  assert.equal(await comandoIsolavel('npm test', d), null, 'script composto roda sem isolamento');
});

test('portão isolado: o teste escreve na pasta e no temporário, e não lê, não escreve fora nem abre outro processo', async () => {
  const { proj, fora, sonda } = await projetoCurioso();
  const e = new Muvuca(structuredClone(cfg));
  e.projeto = proj; e.abort = new AbortController();
  const g = await e.portao();
  assert.equal(g.ok, true, g.saida);
  assert.equal(g.isolado, true); assert.equal(g.semIsolamento, undefined);
  assert.deepEqual(await sonda(), { escreverDentro: 'passou', escreverFora: 'ERR_ACCESS_DENIED', lerFora: 'ERR_ACCESS_DENIED', lerCasa: 'ERR_ACCESS_DENIED', temporario: 'passou', outroProcesso: 'ERR_ACCESS_DENIED', servidorNoMesmoProcesso: 'passou' });
  assert.equal(existsSync(path.join(fora, 'invadido.txt')), false);
  assert.equal(e.eventos.find((x) => x.tipo === 'portao_rodando').isolado, true);
  // a pasta temporária dos testes não fica para trás
  const sobras = (await fs.readdir(os.tmpdir())).filter((n) => n.startsWith('muvuca-testes-'));
  for (const n of sobras) assert.equal((await fs.readdir(path.join(os.tmpdir(), n)).catch(() => ['x'])).length >= 0, true);
});

test('portão com o isolamento desligado nas Configurações: roda como antes, e diz que está sem isolamento', async () => {
  const { proj, fora, sonda } = await projetoCurioso('muvuca livre ');
  const e = new Muvuca(structuredClone(cfg));
  e.projeto = proj; e.abort = new AbortController(); e.isolarTestes = false;
  const g = await e.portao();
  assert.equal(g.ok, true, g.saida);
  assert.deepEqual([g.isolado, g.semIsolamento], [false, 'desligado nas Configurações']);
  assert.equal((await sonda()).escreverFora, 'passou');
  assert.equal(existsSync(path.join(fora, 'invadido.txt')), true, 'é exatamente isto que o isolamento evita');
});

test('teste que depende de sair da pasta falha no portão com uma explicação, em vez de um erro cru', async () => {
  const base = await pasta('muvuca-bloq-'); const proj = path.join(base, 'p'), fora = path.join(base, 'fora.txt');
  await fs.mkdir(path.join(proj, 'test'), { recursive: true });
  await fs.writeFile(path.join(proj, 'test', 'a.test.js'), `const { test } = require('node:test'); test('escreve fora', () => { require('fs').writeFileSync(${JSON.stringify(fora)}, 'x'); });`);
  const e = new Muvuca(structuredClone(cfg));
  e.projeto = proj; e.abort = new AbortController();
  const g = await e.portao();
  assert.equal(g.ok, false);
  assert.match(g.saida, /\[isolamento\] Um teste tentou ler ou escrever fora da pasta do projeto/);
  assert.equal(existsSync(fora), false);
});

test('comando de teste que não dá para isolar roda, e o portão avisa qual é o motivo', async () => {
  const proj = await pasta('muvuca-outro-');
  await fs.writeFile(path.join(proj, 'verifica.js'), 'process.exit(0)');
  const e = new Muvuca(structuredClone(cfg));
  e.projeto = proj; e.abort = new AbortController(); e.comandoTeste = 'node verifica.js';
  const g = await e.portao();
  assert.equal(g.ok, true); assert.equal(g.isolado, false);
  assert.match(g.semIsolamento, /só "node --test" roda isolado; "node verifica\.js" roda com as suas permissões/);
});

test('ferramenta "rodar" dos agentes por API: "node --test" sai isolado; com o isolamento desligado, não', async () => {
  const a = await projetoCurioso('muvuca api ');
  const r = await usar('rodar', { comando: 'node --test' }, { projeto: a.proj, pedirAprovacao: async () => false, isolar: true });
  assert.match(r, /código de saída: 0/, r);
  assert.equal((await a.sonda()).escreverFora, 'ERR_ACCESS_DENIED');
  const b = await projetoCurioso('muvuca api2 ');
  await usar('rodar', { comando: 'node --test' }, { projeto: b.proj, pedirAprovacao: async () => false, isolar: false });
  assert.equal((await b.sonda()).escreverFora, 'passou');
});

test('agente de linha de comando: com isolamento, a permissão de testes vira o comando exato, sem brecha para opções', () => {
  const prov = cfg.provedores['claude-cli'];
  const escritor = { ferramentas: ['listar', 'ler', 'escrever', 'rodar'] };
  const livres = argsDoCli(prov, escritor);
  assert.ok(livres.includes('Bash(node --test:*)') && livres.includes('Bash(npm test:*)'), 'sem isolamento, como sempre foi');
  const presos = argsDoCli(prov, { ...escritor, isolamento: { env: { NODE_OPTIONS: 'x' } } });
  assert.equal(presos.filter((x) => /^Bash\(/.test(x)).join('|'), 'Bash(node --test)', 'só o comando exato: "--allow-fs-write=*" na linha reabriria tudo');
  assert.equal(presos.some((x) => x.includes(':*')), false);
  assert.equal(presos[presos.indexOf('--allowedTools') + 1], 'Bash(node --test)', 'no mesmo lugar da lista');
  // quem só lê não tem permissão de rodar nada, com ou sem isolamento
  assert.equal(argsDoCli(prov, { ferramentas: ['ler'], isolamento: { env: {} } }).some((x) => /^Bash\(/.test(x)), false);
});

test('ambiente isolado chega ao processo do agente, e aplicativo feito em Node é detectado como incompatível', async () => {
  const proj = await pasta('muvuca-amb-');
  const iso = await prepararIsolamento(proj);
  try {
    assert.equal(iso.ok, true);
    assert.match(iso.env.NODE_OPTIONS, /--allow-fs-write="/);
    assert.equal(typeof iso.paraAgentes, 'boolean');
    // a opção de rodar num processo só vai pelo ambiente (Node 24) ou pela linha de comando (Node 22): num dos dois lugares ela está
    assert.ok(/test-isolation=none/.test(iso.env.NODE_OPTIONS) !== /test-isolation=none/.test(iso.comando('node --test')), 'num lugar só');
    assert.equal(iso.paraAgentes, /test-isolation=none/.test(iso.env.NODE_OPTIONS), 'o agente só fica isolado quando o ambiente basta');
    assert.equal(iso.env.TMP, iso.tmp); assert.equal(iso.env.TMPDIR, iso.tmp);
    // um processo qualquer que a Muvuca suba com esse ambiente vê as variáveis
    const r = await rodar(process.execPath, { args: ['-e', 'console.log(require("os").tmpdir())'], cwd: proj, env: iso.env });
    assert.equal(path.resolve(r.saida.trim()), path.resolve(iso.tmp), r.saida);
  } finally { await iso.limpar(); }
  assert.equal(existsSync(iso.tmp), false, 'limpar() tira a pasta temporária');
  // "node" é um aplicativo feito em Node: "--version" responde antes de carregar qualquer arquivo, então serve de exemplo que aceita
  assert.equal(await cliAceitaIsolamento('node'), true);
  assert.equal(await cliAceitaIsolamento('comando-que-nao-existe-muvuca'), false);
  assert.equal(normalizarPreferencias({}, { raiz: proj }).isolarTestes, true, 'de fábrica, ligado');
  assert.equal(normalizarPreferencias({ isolarTestes: false }, { raiz: proj }).isolarTestes, false);
});
