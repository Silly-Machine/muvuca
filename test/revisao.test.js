// Correções da revisão: o que o Descartar cobre, o uso de cada pedido, o histórico de conversas,
// a limpeza de anexos e a permissão de conexão por ferramenta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fotografar, diferencas, restaurar, salvarFoto, carregarFoto, rodar, encerrarProcessos } from '../src/ferramentas.js';
import { lerSaidaCli } from '../src/provedores.js';
import { normalizarConexoes, prepararMcp } from '../src/conexoes.js';
import { subir } from './apoio/servidor-de-teste.js';

const pasta = (p) => fs.mkdtemp(path.join(os.tmpdir(), p));
const MEGA = 1024 * 1024;

test('descartar: arquivo grande e as pastas dist/ e build/ voltam ao que eram, e o diff mostra tudo', async () => {
  const d = await pasta('muvuca-desc-');
  await fs.mkdir(path.join(d, 'dist')); await fs.mkdir(path.join(d, 'build', 'sub'), { recursive: true });
  await fs.writeFile(path.join(d, 'grande.bin'), Buffer.alloc(2 * MEGA, 65));   // maior que o antigo limite de 512 KB
  await fs.writeFile(path.join(d, 'dist', 'saida.js'), 'original');
  await fs.writeFile(path.join(d, 'build', 'sub', 'pacote.txt'), 'original');
  const foto = await fotografar(d);
  await fs.writeFile(path.join(d, 'grande.bin'), Buffer.alloc(2 * MEGA, 66));
  await fs.writeFile(path.join(d, 'dist', 'saida.js'), 'mudou'); await fs.writeFile(path.join(d, 'dist', 'novo.js'), 'novo');
  await fs.rm(path.join(d, 'build'), { recursive: true });
  const dif = await diferencas(d, foto);
  assert.deepEqual(dif.map((x) => `${x.arquivo}:${x.tipo}`), ['build/sub/pacote.txt:removido', 'dist/novo.js:novo', 'dist/saida.js:alterado', 'grande.bin:alterado']);
  assert.equal(dif.some((x) => x.semCopia), false, 'tudo aqui tem cópia guardada');
  assert.deepEqual(dif.avisos, []);
  await restaurar(d, foto);
  assert.equal((await fs.readFile(path.join(d, 'grande.bin')))[0], 65);
  assert.equal(await fs.readFile(path.join(d, 'dist', 'saida.js'), 'utf8'), 'original');
  assert.equal(existsSync(path.join(d, 'dist', 'novo.js')), false);
  assert.equal(await fs.readFile(path.join(d, 'build', 'sub', 'pacote.txt'), 'utf8'), 'original');
  assert.deepEqual(await diferencas(d, foto).then((x) => [...x]), [], 'depois de descartar, nada difere');
});

test('descartar: o que fica de fora é avisado (node_modules, arquivo acima do limite), em vez de passar em silêncio', async () => {
  const d = await pasta('muvuca-fora-');
  await fs.mkdir(path.join(d, 'node_modules', 'lib'), { recursive: true }); await fs.writeFile(path.join(d, 'node_modules', 'lib', 'a.js'), 'x');
  await fs.writeFile(path.join(d, 'enorme.bin'), Buffer.alloc(26 * MEGA, 1));   // acima dos 25 MB que a foto guarda
  await fs.writeFile(path.join(d, 'codigo.js'), 'a');
  const foto = await fotografar(d);
  assert.equal(foto.get('enorme.bin'), null, 'sem cópia');
  assert.ok(foto.sinais.get('enorme.bin'), 'mas com sinal para notar mudança');
  assert.deepEqual([...foto.fora.keys()], ['node_modules/']);
  assert.deepEqual([...(await diferencas(d, foto))], [], 'nada mudou: nada a mostrar');
  assert.deepEqual((await diferencas(d, foto)).avisos, []);

  await fs.mkdir(path.join(d, 'node_modules', 'pacote-novo'));
  await fs.writeFile(path.join(d, 'enorme.bin'), Buffer.alloc(26 * MEGA + 10, 2));
  const dif = await diferencas(d, foto);
  assert.deepEqual(dif.map((x) => [x.arquivo, x.tipo, !!x.semCopia]), [['enorme.bin', 'alterado', true]]);
  assert.match(dif[0].linhas[0].l, /não consegue restaurar/);
  assert.equal(dif.avisos.length, 1); assert.match(dif.avisos[0], /^node_modules\/ mudou\. Essa pasta fica fora do Descartar/);

  // a foto guardada em disco leva os sinais junto: depois de reiniciar, os avisos continuam valendo
  const dir = path.join(await pasta('muvuca-pend-'), '.pendente');
  await salvarFoto(dir, d, foto);
  const g = await carregarFoto(dir);
  assert.equal(g.foto.sinais.get('enorme.bin'), foto.sinais.get('enorme.bin'));
  assert.deepEqual([...g.foto.fora], [...foto.fora]);
  const depois = await diferencas(d, g.foto);
  assert.deepEqual([depois.map((x) => x.arquivo), depois.avisos.length], [['enorme.bin'], 1]);
});

test('uso: o que o aplicativo informa de custo e tokens é lido do resultado; sem informar, fica vazio', () => {
  const saida = [
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read' }], usage: { input_tokens: 9, output_tokens: 9 } } }),
    JSON.stringify({ type: 'result', result: 'Pronto.', total_cost_usd: 0.0312, usage: { input_tokens: 1200, cache_read_input_tokens: 5000, cache_creation_input_tokens: 300, output_tokens: 450 } }),
  ].join('\n');
  const r = lerSaidaCli(saida);
  assert.equal(r.texto, 'Pronto.');
  assert.deepEqual(r.uso, { custo: 0.0312, entrada: 6500, saida: 450 }, 'só o resultado final conta, com o que veio do cache somado à entrada');
  assert.equal(lerSaidaCli(JSON.stringify({ type: 'result', result: 'ok' })).uso, null);
  assert.equal(lerSaidaCli('texto puro').uso, null);
});

test('processos: o que a Muvuca subiu é encerrado junto com ela', async () => {
  const marca = path.join(await pasta('muvuca-proc-'), 'vivo.txt');
  // um processo que escreveria um arquivo daqui a 4 s: se for encerrado antes, o arquivo nunca aparece
  const p = rodar(process.execPath, { args: ['-e', `setTimeout(() => require('fs').writeFileSync(${JSON.stringify(marca)}, 'x'), 4000)`], limiteMs: 60000 });
  await new Promise((r) => setTimeout(r, 700));
  assert.equal(encerrarProcessos(), 1, 'havia um processo em andamento');
  const r = await p;
  assert.notEqual(r.codigo, 0);
  await new Promise((r2) => setTimeout(r2, 4200));
  assert.equal(existsSync(marca), false, 'o processo não chegou a escrever');
  assert.equal(encerrarProcessos(), 0);
});

test('conexão por ferramenta: a permissão sai só para as ferramentas escolhidas', async () => {
  const d = normalizarConexoes({ conexoes: [{ nome: 'Rea', comando: 'rea --mcp', ferramentas: 'decompile, analyze decompile;binary_session' }, { nome: 'Docs', comando: 'x' }] });
  assert.deepEqual(d.conexoes[0].ferramentas, ['decompile', 'analyze', 'binary_session']);
  assert.deepEqual(d.conexoes[1].ferramentas, []);
  const m = await prepararMcp(await pasta('muvuca-mcp-'), 'farol', d.conexoes);
  assert.equal(m.permissoes, 'mcp__rea__decompile,mcp__rea__analyze,mcp__rea__binary_session,mcp__docs');
  assert.throws(() => normalizarConexoes({ conexoes: [{ nome: 'A', comando: 'x', ferramentas: 'boa, "ruim' }] }), /não é nome de ferramenta/);
});

test('servidor: histórico guarda a conversa ao começar outra, o uso sai no fim do pedido e os anexos saem com o descarte', async () => {
  const dados = await pasta('muvuca-dados-'), projeto = await pasta('muvuca-proj-');
  const s = await subir(dados, { DEMO_ATRASO: '0' });
  const esperar = async () => { for (let i = 0; i < 400; i++) { if (!(await s.get('/api/config')).rodando) return; await new Promise((r) => setTimeout(r, 100)); } throw new Error('o pedido não terminou'); };
  const eventos = async () => {
    const ctl = new AbortController(); const r = await fetch(s.base + '/api/eventos', { headers: { 'x-muvuca-token': s.token }, signal: ctl.signal });
    const leitor = r.body.getReader(); const dec = new TextDecoder(); let buf = ''; const fim = Date.now() + 600;
    while (Date.now() < fim) { const p = await Promise.race([leitor.read(), new Promise((x) => setTimeout(() => x(null), 200))]); if (p?.value) buf += dec.decode(p.value); }
    ctl.abort(); return buf.split('\n').filter((l) => l.startsWith('data: ')).map((l) => JSON.parse(l.slice(6)));
  };
  try {
    assert.deepEqual((await s.get('/api/conversas')).conversas, []);
    const an = await s.post('/api/anexos', { projeto, arquivos: [{ caminho: 'pasta/requisitos.txt', dados: Buffer.from('faça assim').toString('base64') }] });
    assert.equal(an.s, 200);
    assert.equal(existsSync(path.join(projeto, 'anexos', 'pasta', 'requisitos.txt')), true);
    assert.equal((await s.post('/api/pedido', { texto: 'Crie uma página de status com um endpoint /health', projeto })).s, 202);
    await esperar();
    const ev = await eventos();
    const uso = ev.find((e) => e.tipo === 'uso');
    assert.ok(uso, 'o pedido termina com a linha de uso');
    assert.equal(typeof uso.segundos, 'number'); assert.ok(uso.chamadas >= 3, `chamadas: ${uso.chamadas}`);
    assert.equal(uso.custo, undefined, 'a demonstração não informa custo, então a tela não inventa um');
    assert.ok(ev.findIndex((e) => e.tipo === 'uso') < ev.findIndex((e) => e.tipo === 'diff'), 'o uso vem antes do diff');

    assert.equal((await s.post('/api/decidir', { acao: 'descartar' })).s, 200);
    assert.equal(existsSync(path.join(projeto, 'anexos')), false, 'os anexos do pedido descartado saem, com a pasta');
    assert.deepEqual(await fs.readdir(projeto), [], 'o projeto volta a ficar vazio');

    assert.deepEqual((await s.get('/api/conversas')).conversas, [], 'a conversa em andamento ainda não está no histórico');
    assert.equal((await s.post('/api/nova', {})).s, 200);
    let lista = [];
    for (let i = 0; i < 40 && !lista.length; i++) { await new Promise((r) => setTimeout(r, 100)); lista = (await s.get('/api/conversas')).conversas; }
    assert.equal(lista.length, 1);
    assert.deepEqual([lista[0].titulo, lista[0].pedidos, lista[0].resultado, path.resolve(lista[0].projeto)], ['Crie uma página de status com um endpoint /health', 1, 'aprovada', projeto]);
    const inteira = await s.get('/api/conversas/' + lista[0].id);
    const tipos = inteira.eventos.map((e) => e.tipo);
    for (const t of ['pedido', 'veredito', 'final', 'uso', 'diff']) assert.ok(tipos.includes(t), t);
    assert.equal(tipos.includes('status'), false, 'movimento de tela não vai para o histórico');
    assert.equal(inteira.eventos.find((e) => e.tipo === 'diff').arquivos.every((a) => a.linhas === undefined), true, 'o diff linha a linha não é guardado');
    assert.equal((await s.cru('/api/conversas/' + lista[0].id)).status, 401, 'sem a chave, o histórico não abre');
    assert.equal((await fetch(s.base + '/api/conversas/..%2Facesso.token', { headers: { 'x-muvuca-token': s.token } })).status, 404);

    // conversa nova sem nenhum pedido não gera entrada vazia no histórico
    await s.post('/api/nova', {}); await new Promise((r) => setTimeout(r, 300));
    assert.equal((await s.get('/api/conversas')).conversas.length, 1);

    // manter: os anexos ficam
    await s.post('/api/anexos', { projeto, arquivos: [{ caminho: 'nota.txt', dados: Buffer.from('x').toString('base64') }] });
    await s.post('/api/pedido', { texto: 'Crie uma página de status com um endpoint /health', projeto }); await esperar();
    await s.post('/api/decidir', { acao: 'aceitar' });
    assert.equal(existsSync(path.join(projeto, 'anexos', 'nota.txt')), true);
  } finally { await s.parar(); }
});
