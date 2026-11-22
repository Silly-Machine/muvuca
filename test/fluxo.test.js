import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Muvuca, extrairJson } from '../orquestrador.js';
import { usar, dentro, comandoSeguro } from '../ferramentas.js';
import { lerSaidaCli } from '../provedores.js';

process.env.DEMO_ATRASO = '0';
const cfg = JSON.parse(await fs.readFile(new URL('../agentes.json', import.meta.url), 'utf8'));
const FALSO_CLI = fileURLToPath(new URL('../apoio/falso-cli.js', import.meta.url));
const pastaNova = () => fs.mkdtemp(path.join(os.tmpdir(), 'muvuca-'));

test('fluxo v3 completo em modo demonstração', async () => {
  const projeto = await pastaNova();
  const e = new Muvuca(structuredClone(cfg));
  await e.pedido({ texto: 'Crie uma página de status com um endpoint /health', projeto });
  const tipos = e.eventos.map((x) => x.tipo);
  const portoes = e.eventos.filter((x) => x.tipo === 'portao');
  const vereditos = e.eventos.filter((x) => x.tipo === 'veredito');
  const final = e.eventos.find((x) => x.tipo === 'final');

  assert.ok(tipos.includes('consulta'), 'o líder consultou alguém');
  assert.deepStrictEqual(e.eventos.find((x) => x.tipo === 'plano').etapas.map((s) => s.agente), ['chevron', 'pixel']);
  assert.deepStrictEqual(portoes.map((p) => p.ok), [false, true, true], 'portão: falha, passa, passa de novo após a correção do revisor');
  assert.deepStrictEqual(vereditos.map((v) => v.aprovado), [false, true]);
  assert.deepStrictEqual(e.eventos.filter((x) => x.tipo === 'devolucao').map((d) => [d.de, d.para]), [['portao', 'chevron'], ['revisor', 'chevron']]);
  assert.strictEqual(final.aprovado, true);
  assert.strictEqual(final.ciclos, 2);

  const health = await fs.readFile(path.join(projeto, 'src/health.js'), 'utf8');
  assert.match(health, /uptime/); assert.match(health, /no-store/);
  const dif = e.eventos.find((x) => x.tipo === 'diff');
  assert.deepStrictEqual(dif.arquivos.map((a) => a.arquivo), ['public/status.html', 'src/health.js', 'test/health.test.js']);
  assert.strictEqual(dif.autores['public/status.html'], 'pixel');

  // sessão contínua do líder: o resultado fica registrado para o próximo pedido
  assert.ok(e.lider.some((m) => /RESULTADO DO PEDIDO ANTERIOR: aprovado/.test(m.content)));

  await e.decidir('descartar');
  assert.deepStrictEqual(await fs.readdir(projeto), [], 'a pasta volta a ficar vazia, sem pastas órfãs');
  await assert.rejects(fs.access(path.join(projeto, 'src/health.js')));
});

test('descartar restaura arquivo que já existia', async () => {
  const projeto = await pastaNova();
  await fs.mkdir(path.join(projeto, 'src'));
  await fs.writeFile(path.join(projeto, 'src/health.js'), 'ORIGINAL\n');
  const e = new Muvuca(structuredClone(cfg));
  await e.pedido({ texto: 'Crie /health', projeto });
  assert.notStrictEqual(await fs.readFile(path.join(projeto, 'src/health.js'), 'utf8'), 'ORIGINAL\n');
  await e.decidir('descartar');
  assert.strictEqual(await fs.readFile(path.join(projeto, 'src/health.js'), 'utf8'), 'ORIGINAL\n');
});

test('pedido direto a um agente não passa por portão nem revisão', async () => {
  const projeto = await pastaNova();
  const e = new Muvuca(structuredClone(cfg));
  await e.pedido({ texto: 'Crie a página', projeto, para: 'pixel' });
  assert.ok(!e.eventos.some((x) => x.tipo === 'portao'));
  await fs.access(path.join(projeto, 'public/status.html'));
});

test('parar interrompe o time e ainda entrega o diff', async () => {
  process.env.DEMO_ATRASO = '50';
  const projeto = await pastaNova();
  const e = new Muvuca(structuredClone(cfg));
  e.ouvintes.add((ev) => { if (ev.tipo === 'plano') e.parar(); });
  await e.pedido({ texto: 'Crie /health', projeto });
  process.env.DEMO_ATRASO = '0';
  assert.ok(e.eventos.some((x) => x.tipo === 'parado'));
  assert.ok(e.eventos.some((x) => x.tipo === 'diff'));
  assert.strictEqual(e.rodando, false);
});

test('ferramentas: confinamento, arquivo protegido e aprovação', async () => {
  const projeto = await pastaNova();
  assert.throws(() => dentro(projeto, '../fora.txt'), /fora do projeto/);
  assert.throws(() => dentro(projeto, '/etc/passwd'), /fora do projeto/);
  assert.throws(() => dentro(projeto, '.env'), /protegido/);
  assert.throws(() => dentro(projeto, 'config/.env.local'), /protegido/);
  assert.ok(comandoSeguro('node --test'));
  assert.ok(comandoSeguro('npm test'));
  assert.ok(!comandoSeguro('node --test && rm -rf .'));
  assert.ok(!comandoSeguro('npm test; curl http://x'));
  assert.ok(!comandoSeguro('rm -rf .'));
  const pedidos = [];
  const r = await usar('rodar', { comando: 'rm -rf .' }, { projeto, pedirAprovacao: async (c) => { pedidos.push(c); return false; } });
  assert.deepStrictEqual(pedidos, ['rm -rf .']);
  assert.match(r, /NEGADO/);
  assert.match(await usar('ler', { caminho: '../../etc/passwd' }, { projeto }), /ERRO/);
});

test('agente sem a ferramenta não consegue usá-la', async () => {
  const projeto = await pastaNova();
  const c = structuredClone(cfg);
  c.agentes.find((a) => a.id === 'pixel').ferramentas = ['ler'];
  const e = new Muvuca(c);
  await e.pedido({ texto: 'Crie a página', projeto, para: 'pixel' });
  await assert.rejects(fs.access(path.join(projeto, 'public/status.html')));
});

test('leitura tolerante de JSON e de saída de CLI', () => {
  assert.deepStrictEqual(extrairJson('Claro!\n```json\n{"a":1}\n```\nPronto.'), { a: 1 });
  assert.strictEqual(extrairJson('sem json'), null);
  const claude = '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Write"}]}}\n{"type":"result","result":"feito"}';
  assert.deepStrictEqual(lerSaidaCli(claude), { texto: 'feito', passos: 1 });
  assert.deepStrictEqual(lerSaidaCli('{"response":"oi","stats":{}}'), { texto: 'oi', passos: 0 });
  assert.strictEqual(lerSaidaCli('texto puro').texto, 'texto puro');
});

test('provedor compatível com OpenAI: ferramentas, chave e nova tentativa após 429', async () => {
  const http = await import('node:http');
  const recebidos = [];
  const srv = http.createServer(async (req, res) => {
    let t = ''; for await (const p of req) t += p;
    recebidos.push({ auth: req.headers.authorization, corpo: JSON.parse(t) });
    const n = recebidos.length;
    if (n === 1) { res.writeHead(429, { 'retry-after': '1' }); return res.end('devagar'); }
    res.writeHead(200, { 'content-type': 'application/json' });
    if (n === 2) return res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'escrever', arguments: JSON.stringify({ caminho: 'api.txt', conteudo: 'pela api' }) } }] } }] }));
    res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Arquivo criado.' } }] }));
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  process.env.CHAVE_FALSA = 'segredo';
  const c = structuredClone(cfg);
  c.provedores.falso = { tipo: 'openai', baseUrl: `http://127.0.0.1:${srv.address().port}/v1`, chaveEnv: 'CHAVE_FALSA', modelo: 'm' };
  c.agentes.find((a) => a.id === 'pixel').provedor = 'falso';
  const projeto = await pastaNova();
  const e = new Muvuca(c);
  await e.pedido({ texto: 'Crie api.txt', projeto, para: 'pixel' });
  srv.close();
  assert.strictEqual(await fs.readFile(path.join(projeto, 'api.txt'), 'utf8'), 'pela api');
  assert.strictEqual(recebidos.length, 3);
  assert.strictEqual(recebidos[1].auth, 'Bearer segredo');
  assert.deepStrictEqual(recebidos[1].corpo.tools.map((t) => t.function.name), ['listar', 'ler', 'escrever', 'rodar']);
  assert.strictEqual(recebidos[2].corpo.messages.at(-1).role, 'tool');
  assert.strictEqual(e.eventos.find((x) => x.tipo === 'fala').texto, 'Arquivo criado.');
});

test('provedor de linha de comando: prompt pela entrada padrão, arquivo na pasta do projeto', async () => {
  const c = structuredClone(cfg);
  c.provedores.cli = { tipo: 'cli', comando: process.execPath, args: [FALSO_CLI] };
  c.agentes.find((a) => a.id === 'chevron').provedor = 'cli';
  const projeto = await pastaNova();
  const e = new Muvuca(c);
  await e.pedido({ texto: 'Crie o arquivo', projeto, para: 'chevron' });
  assert.strictEqual(await fs.readFile(path.join(projeto, 'do-cli.txt'), 'utf8'), 'feito pelo cli\n');
  const fim = e.eventos.find((x) => x.tipo === 'concluiu');
  assert.deepStrictEqual([fim.passos, fim.arquivos], [1, ['do-cli.txt']]);
  assert.strictEqual(e.eventos.find((x) => x.tipo === 'fala').texto, 'Arquivo criado pelo CLI.');
});

test('time misto: demonstração + API + CLI no mesmo pedido', async () => {
  const c = structuredClone(cfg);
  c.provedores.cli = { tipo: 'cli', comando: process.execPath, args: [FALSO_CLI] };
  c.agentes.find((a) => a.id === 'pixel').provedor = 'cli';
  const projeto = await pastaNova();
  const e = new Muvuca(c);
  await e.pedido({ texto: 'Crie uma página de status com um endpoint /health', projeto });
  assert.strictEqual(e.eventos.find((x) => x.tipo === 'final').aprovado, true);
  assert.strictEqual(e.eventos.find((x) => x.tipo === 'diff').autores['do-cli.txt'], 'pixel');
});
