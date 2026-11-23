// Conexões (servidores MCP): validação, configuração sem segredos, teste de conexão e entrega aos agentes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { idDe, partes, normalizarConexoes, montarConfigMcp, conexoesDoAgente, prepararMcp, variaveisQueFaltam, testarConexao } from '../src/conexoes.js';
import { chamar } from '../src/provedores.js';
import { Muvuca } from '../src/orquestrador.js';

const apoio = (n) => fileURLToPath(new URL(`./apoio/${n}`, import.meta.url));
const MCP_FALSO = apoio('mcp-falso.js'), CLI_FALSO = apoio('falso-cli-mcp.js');
const cfg = JSON.parse(await fs.readFile(new URL('../config/agentes.json', import.meta.url), 'utf8'));
const BARRA = String.fromCharCode(92);

test('identificador e linha de comando: acentos saem, aspas juntam, caminho do Windows fica inteiro', () => {
  assert.equal(idDe('Documentação 2'), 'documentacao_2');
  assert.equal(idDe('  GitHub — Issues!  '), 'github_issues');
  assert.equal(idDe('123 teste'), 'c_123_teste');
  assert.equal(idDe('!!!'), '');
  assert.deepEqual(partes('npx -y "@escopo/servidor" --nome \'a b\''), ['npx', '-y', '@escopo/servidor', '--nome', 'a b']);
  const caminho = `C:${BARRA}Meus Docs${BARRA}srv.js`;
  assert.deepEqual(partes(`node "${caminho}" ""`), ['node', caminho, '']);
  assert.deepEqual(partes('   '), []);
  assert.throws(() => partes('node "sem fechar'), /aspas sem fechar/);
});

test('validação: recusa o que está errado dizendo o quê, e nunca aceita valor de segredo', () => {
  const erro = (c, re) => assert.throws(() => normalizarConexoes({ conexoes: [c] }), re);
  erro({ comando: 'node x' }, /precisa de um nome/);
  erro({ nome: '!!!', comando: 'node x' }, /ao menos uma letra/);
  erro({ nome: 'A' }, /falta o comando/);
  erro({ nome: 'A', tipo: 'http', url: 'nao é url' }, /endereço inválido/);
  erro({ nome: 'A', tipo: 'http', url: 'ftp://x.com' }, /http:\/\/ ou https:\/\//);
  erro({ nome: 'A', tipo: 'http', url: 'https://u:senha@x.com/mcp' }, /usuário e senha no endereço/);
  erro({ nome: 'A', tipo: 'http', url: 'https://x.com/mcp', variavelToken: 'ghp_abc-123' }, /o valor do token não vai aqui/);
  erro({ nome: 'A', comando: 'node x', variaveis: 'TOKEN=abc123' }, /só o nome, não o valor/);
  assert.throws(() => normalizarConexoes({ conexoes: [{ nome: 'Docs', comando: 'a' }, { nome: 'docs', comando: 'b' }] }), /já existe uma conexão/);
  assert.throws(() => normalizarConexoes({ conexoes: Array.from({ length: 21 }, (_, i) => ({ nome: `c${i}`, comando: 'x' })) }), /no máximo 20/);
  assert.deepEqual(normalizarConexoes(null), { conexoes: [], agentes: {} });
  assert.deepEqual(normalizarConexoes({ conexoes: 'x', agentes: [] }), { conexoes: [], agentes: {} });
});

test('ligação por agente: só conexões que existem, e só as ligadas chegam ao agente', () => {
  const d = normalizarConexoes({
    conexoes: [{ nome: 'Docs', comando: 'npx -y servidor-docs', variaveis: 'CHAVE_A, CHAVE_B CHAVE_A' }, { nome: 'Issues', tipo: 'http', url: 'https://exemplo.com/mcp', variavelToken: 'MEU_TOKEN' }, { nome: 'Parada', comando: 'x', ativa: false }],
    agentes: { scout: ['docs', 'nao_existe', 'docs', 'parada'], revisor: ['issues'], 'Id Ruim': ['docs'], maestro: 'docs', vazio: ['sumiu'] },
  });
  assert.deepEqual(d.conexoes[0], { id: 'docs', nome: 'Docs', tipo: 'comando', descricao: '', ativa: true, comando: 'npx', args: ['-y', 'servidor-docs'], variaveis: ['CHAVE_A', 'CHAVE_B'] });
  assert.deepEqual(d.agentes, { scout: ['docs', 'parada'], revisor: ['issues'] });
  assert.deepEqual(conexoesDoAgente(d, 'scout').map((c) => c.id), ['docs'], 'conexão desligada não chega');
  assert.deepEqual(conexoesDoAgente(d, 'chevron'), []);
  assert.deepEqual(variaveisQueFaltam(d.conexoes[0], { CHAVE_A: 'x' }), ['CHAVE_B']);
  assert.deepEqual(variaveisQueFaltam(d.conexoes[1], {}), ['MEU_TOKEN']);
  assert.deepEqual(variaveisQueFaltam(d.conexoes[1], { MEU_TOKEN: 't' }), []);
});

test('configuração entregue ao provedor: referência à variável, nunca o valor', async () => {
  process.env.SEGREDO_DO_TESTE_MCP = 'valor-super-secreto-123';
  const d = normalizarConexoes({ conexoes: [{ nome: 'Banco', comando: 'node srv.js --ro', variaveis: 'SEGREDO_DO_TESTE_MCP' }, { nome: 'Issues', descricao: 'lê issues', tipo: 'http', url: 'https://exemplo.com/mcp', variavelToken: 'SEGREDO_DO_TESTE_MCP' }] });
  const c = montarConfigMcp(d.conexoes);
  assert.deepEqual(c.mcpServers.banco, { command: 'node', args: ['srv.js', '--ro'], env: { SEGREDO_DO_TESTE_MCP: '${SEGREDO_DO_TESTE_MCP}' } });
  assert.deepEqual(c.mcpServers.issues, { type: 'http', url: 'https://exemplo.com/mcp', headers: { Authorization: 'Bearer ${SEGREDO_DO_TESTE_MCP}' } });
  const pasta = await fs.mkdtemp(path.join(os.tmpdir(), 'muvuca-mcp-'));
  const m = await prepararMcp(pasta, 'scout', d.conexoes);
  assert.equal(m.permissoes, 'mcp__banco,mcp__issues');
  assert.deepEqual(m.servidores[1], { id: 'issues', nome: 'Issues', descricao: 'lê issues' });
  const gravado = await fs.readFile(m.arquivo, 'utf8');
  assert.equal(gravado.includes('valor-super-secreto-123'), false, 'o valor do segredo não vai para o arquivo');
  assert.deepEqual(JSON.parse(gravado), c);
  assert.equal(await prepararMcp(pasta, 'pixel', []), null, 'sem conexões, nada é gravado nem entregue');
  delete process.env.SEGREDO_DO_TESTE_MCP;
});

test('testar conexão por comando: lista as ferramentas de um servidor de verdade e explica as falhas', async () => {
  const [c] = normalizarConexoes({ conexoes: [{ nome: 'Cofre', comando: `"${process.execPath}" "${MCP_FALSO}"` }] }).conexoes;
  const r = await testarConexao(c, { limiteMs: 20000 });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.ferramentas.map((f) => f.nome), ['senha_do_dia', 'eco']);
  assert.match(r.ferramentas[0].descricao, /senha do dia/);

  const nao = await testarConexao({ tipo: 'comando', comando: 'comando-que-nao-existe-xyz', args: [] }, { limiteMs: 20000 });
  assert.equal(nao.ok, false); assert.match(nao.erro, /não encontrado/, nao.erro);
  const mudo = await testarConexao({ tipo: 'comando', comando: process.execPath, args: ['-e', 'setTimeout(() => {}, 60000)'] }, { limiteMs: 1500 });
  assert.equal(mudo.ok, false); assert.match(mudo.erro, /sem resposta/);
  const sai = await testarConexao({ tipo: 'comando', comando: process.execPath, args: ['-e', 'process.exit(3)'] }, { limiteMs: 20000 });
  assert.equal(sai.ok, false); assert.match(sai.erro, /saiu antes de responder \(código 3\)/);
  const semVar = await testarConexao({ tipo: 'comando', comando: 'x', args: [], variaveis: ['VARIAVEL_QUE_NAO_EXISTE_MUVUCA'] });
  assert.equal(semVar.ok, false); assert.match(semVar.erro, /falta definir a variável de ambiente VARIAVEL_QUE_NAO_EXISTE_MUVUCA/);
});

test('testar conexão por endereço: resposta em JSON ou em fluxo de eventos, token só no cabeçalho, 401 explicado', async () => {
  const visto = [];
  const srv = http.createServer((req, res) => {
    let corpo = ''; req.on('data', (d) => { corpo += d; }).on('end', () => {
      const m = JSON.parse(corpo || '{}'); visto.push({ rota: req.url, metodo: m.method, auth: req.headers.authorization || '', sessao: req.headers['mcp-session-id'] || '' });
      if (req.url === '/fechado' && req.headers.authorization !== 'Bearer tok-123') { res.writeHead(401); return res.end(); }
      if (m.id === undefined) { res.writeHead(202); return res.end(); }
      const resposta = m.method === 'initialize' ? { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'http-falso', version: '1' } } : { tools: [{ name: 'buscar', description: 'busca' }] };
      const msg = JSON.stringify({ jsonrpc: '2.0', id: m.id, result: resposta });
      if (req.url === '/eventos') { res.writeHead(200, { 'content-type': 'text/event-stream', 'mcp-session-id': 's1' }); return res.end(`event: message\ndata: ${msg}\n\n`); }
      res.writeHead(200, { 'content-type': 'application/json', 'mcp-session-id': 's1' }); res.end(msg);
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    for (const rota of ['/json', '/eventos']) {
      const r = await testarConexao({ tipo: 'http', url: base + rota }, { limiteMs: 10000 });
      assert.deepEqual(r, { ok: true, ferramentas: [{ nome: 'buscar', descricao: 'busca' }] }, rota);
    }
    assert.equal(visto.filter((v) => v.metodo === 'tools/list').every((v) => v.sessao === 's1'), true, 'a sessão devolvida na apresentação acompanha as chamadas seguintes');
    const semToken = await testarConexao({ tipo: 'http', url: base + '/fechado' }, { limiteMs: 10000 });
    assert.equal(semToken.ok, false); assert.match(semToken.erro, /recusou o acesso \(401\): talvez precise de um token/);
    process.env.TOKEN_DO_TESTE_MCP = 'tok-123';
    const comToken = await testarConexao({ tipo: 'http', url: base + '/fechado', variavelToken: 'TOKEN_DO_TESTE_MCP' }, { limiteMs: 10000 });
    assert.equal(comToken.ok, true, JSON.stringify(comToken));
    delete process.env.TOKEN_DO_TESTE_MCP;
  } finally { await new Promise((r) => srv.close(r)); }
  const ninguem = await testarConexao({ tipo: 'http', url: 'http://127.0.0.1:1/mcp' }, { limiteMs: 5000 });
  assert.equal(ninguem.ok, false);
});

test('provedor: quem só lê recebe a configuração e a permissão; quem escreve não recebe nada', async () => {
  const prov = { tipo: 'cli', comando: process.execPath, args: [CLI_FALSO, '--escreve'], argsLeitura: [CLI_FALSO, '--so-le'], argsMcp: ['--mcp-config', '{arquivo}', '--allowedTools', '{permissoes}'], argModelo: '--model', modelo: 'leve' };
  const mcp = { arquivo: path.join(os.tmpdir(), 'pasta com espaço', 'scout.json'), permissoes: 'mcp__cofre,mcp__docs' };
  const pedido = (ferramentas, extra = {}) => chamar({ ...prov, ...extra.prov }, { sistema: 's', mensagens: [{ role: 'user', content: 'oi' }], ferramentas, cwd: os.tmpdir(), mcp: extra.semMcp ? null : mcp, aoPasso: extra.aoPasso });
  const passos = [];
  const leitor = JSON.parse((await pedido(['listar', 'ler'], { aoPasso: (p) => passos.push(p) })).texto);
  assert.deepEqual(leitor.args, ['--so-le', '--mcp-config', mcp.arquivo, '--allowedTools', 'mcp__cofre,mcp__docs', '--model', 'leve']);
  assert.deepEqual(passos.find((p) => p.ferramenta === 'conexao'), { ferramenta: 'conexao', servidor: 'cofre', alvo: 'senha_do_dia' }, 'o uso da conexão é avisado com servidor e ferramenta');
  const escritor = JSON.parse((await pedido(['listar', 'ler', 'escrever'])).texto);
  assert.deepEqual(escritor.args, ['--escreve', '--model', 'leve'], 'agente que escreve fica sem conexões mesmo que alguém as passe');
  assert.deepEqual(JSON.parse((await pedido(['ler'], { semMcp: true })).texto).args, ['--so-le', '--model', 'leve']);
  assert.deepEqual(JSON.parse((await pedido(['ler'], { prov: { argsMcp: undefined } })).texto).args, ['--so-le', '--model', 'leve'], 'provedor que não declara argsMcp não recebe');
});

test('orquestrador: o agente fica sabendo das conexões dele e o uso aparece na conversa', async () => {
  const c = structuredClone(cfg);
  c.provedores.cli = { tipo: 'cli', comando: process.execPath, args: [CLI_FALSO], argsLeitura: [CLI_FALSO], argsMcp: ['--mcp-config', '{arquivo}', '--allowedTools', '{permissoes}'] };
  for (const a of c.agentes) a.provedor = 'cli';
  const e = new Muvuca(c);
  const projeto = await fs.mkdtemp(path.join(os.tmpdir(), 'muvuca-'));
  const pasta = await fs.mkdtemp(path.join(os.tmpdir(), 'muvuca-mcp-'));
  const dados = normalizarConexoes({ conexoes: [{ nome: 'Cofre', descricao: 'guarda a senha do dia', comando: `"${process.execPath}" "${MCP_FALSO}"` }], agentes: { scout: ['cofre'], chevron: ['cofre'] } });
  const pediram = [];
  e.conexoesDe = async (ag) => { pediram.push(ag.id); return (ag.ferramentas || []).includes('escrever') ? null : prepararMcp(pasta, ag.id, conexoesDoAgente(dados, ag.id)); };

  await e.pedido({ texto: 'Qual é a senha do dia?', projeto, para: 'scout' });
  const fala = e.eventos.filter((x) => x.tipo === 'fala' || x.tipo === 'concluiu').map((x) => x.texto || x.resumo || '').join(' ');
  const visto = JSON.parse(/\{.*\}/s.exec(e.eventos.map((x) => x.texto || '').filter((t) => t.includes('falouDeConexoes')).pop() || fala)[0]);
  assert.equal(visto.falouDeConexoes, true);
  assert.match(visto.trecho, /Cofre \(ferramentas mcp__cofre__\*; guarda a senha do dia\)/);
  assert.equal(visto.args.includes('--mcp-config'), true);
  assert.equal(visto.args[visto.args.indexOf('--allowedTools') + 1], 'mcp__cofre');
  assert.deepEqual(e.eventos.filter((x) => x.tipo === 'conexao').map(({ agente, servidor, ferramenta }) => ({ agente, servidor, ferramenta })), [{ agente: 'scout', servidor: 'cofre', ferramenta: 'senha_do_dia' }]);
  assert.equal(pediram.includes('scout'), true);

  // o mesmo pedido para quem escreve: nenhuma conexão, nenhum evento
  const antes = e.eventos.length;
  await e.pedido({ texto: 'Qual é a senha do dia?', projeto, para: 'chevron' });
  const novos = e.eventos.slice(antes);
  assert.equal(novos.some((x) => x.tipo === 'conexao'), false);
  assert.equal(novos.map((x) => x.texto || '').some((t) => t.includes('--mcp-config')), false);
});
