// Conexões: servidores MCP que dão aos agentes acesso a coisas fora da pasta do projeto (documentação, issues,
// bancos de dados). Aqui ficam a validação da lista, a montagem da configuração que o aplicativo do provedor
// recebe e um cliente mínimo do protocolo, usado só para testar uma conexão e listar as ferramentas dela.
//
// Nenhum segredo é gravado: um servidor que precisa de token recebe o NOME de uma variável de ambiente, e a
// configuração entregue ao aplicativo leva a referência "${NOME}", que ele troca pelo valor na hora.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const texto = (v, max) => String(v ?? '').trim().slice(0, max);
const RE_ID = /^[a-z][a-z0-9_]{0,29}$/;
const RE_VARIAVEL = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
export const LIMITE_CONEXOES = 20;

// "Minha Conexão 2" -> "minha_conexao_2": o identificador entra no nome das ferramentas (mcp__id__ferramenta).
export function idDe(nome) {
  const s = texto(nome, 60).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return (/^[a-z]/.test(s) ? s : s ? `c_${s}` : '').slice(0, 30);
}

// Quebra uma linha de comando em partes, respeitando aspas: npx -y "@escopo/servidor" --pasta "C:\Meus Docs"
export function partes(linha) {
  const saida = []; let atual = '', aspas = '', tem = false;
  for (const ch of String(linha ?? '')) {
    if (aspas) { if (ch === aspas) aspas = ''; else atual += ch; continue; }
    if (ch === '"' || ch === "'") { aspas = ch; tem = true; continue; }
    if (/\s/.test(ch)) { if (atual || tem) saida.push(atual); atual = ''; tem = false; continue; }
    atual += ch;
  }
  if (aspas) throw new Error('aspas sem fechar no comando');
  if (atual || tem) saida.push(atual);
  return saida;
}

// Valida e limpa a lista de conexões e a ligação por agente. Lança erro dizendo o que está errado.
export function normalizarConexoes(dados) {
  dados = dados && typeof dados === 'object' ? dados : {};
  const lista = Array.isArray(dados.conexoes) ? dados.conexoes : [];
  if (lista.length > LIMITE_CONEXOES) throw new Error(`no máximo ${LIMITE_CONEXOES} conexões`);
  const conexoes = []; const vistos = new Set();
  for (const c of lista) {
    const nome = texto(c?.nome, 60);
    if (!nome) throw new Error('toda conexão precisa de um nome');
    const id = RE_ID.test(c?.id || '') ? c.id : idDe(nome);
    if (!RE_ID.test(id)) throw new Error(`o nome "${nome}" precisa ter ao menos uma letra`);
    if (vistos.has(id)) throw new Error(`já existe uma conexão chamada "${nome}"`);
    vistos.add(id);
    const tipo = c?.tipo === 'http' ? 'http' : 'comando';
    // Ferramentas liberadas: em branco, todas as do servidor. Com nomes, só essas (um servidor grande pode ter
    // ferramentas que agem fora da pasta; assim dá para deixar só as de consulta).
    const pedidas = (Array.isArray(c?.ferramentas) ? c.ferramentas : texto(c?.ferramentas, 8000).split(/[\s,;]+/)).map((f) => texto(f, 80)).filter(Boolean);
    for (const f of pedidas) if (!/^[A-Za-z0-9_.-]+$/.test(f)) throw new Error(`${nome}: "${f}" não é nome de ferramenta`);
    const limpa = { id, nome, tipo, descricao: texto(c?.descricao, 200), ativa: c?.ativa !== false, ferramentas: [...new Set(pedidas)].slice(0, 300) };
    if (tipo === 'comando') {
      const p = Array.isArray(c?.args) ? [texto(c?.comando, 300), ...c.args.map((a) => String(a ?? '').slice(0, 500))] : partes(texto(c?.comando, 2000));
      if (!p[0]) throw new Error(`${nome}: falta o comando`);
      limpa.comando = p[0]; limpa.args = p.slice(1, 41);
    } else {
      const url = texto(c?.url, 500);
      let u; try { u = new URL(url); } catch { throw new Error(`${nome}: endereço inválido`); }
      if (!/^https?:$/.test(u.protocol)) throw new Error(`${nome}: o endereço precisa começar com http:// ou https://`);
      if (u.username || u.password) throw new Error(`${nome}: não ponha usuário e senha no endereço; use uma variável de ambiente para o token`);
      limpa.url = u.href;
      // token de acesso: só o nome da variável de ambiente; vira "Authorization: Bearer ${NOME}"
      const token = texto(c?.variavelToken, 64);
      if (token && !RE_VARIAVEL.test(token)) throw new Error(`${nome}: "${token}" não é nome de variável de ambiente (o valor do token não vai aqui)`);
      limpa.variavelToken = token;
    }
    // variáveis de ambiente que o servidor precisa receber: só os nomes
    const variaveis = (Array.isArray(c?.variaveis) ? c.variaveis : texto(c?.variaveis, 600).split(/[\s,;]+/)).map((v) => texto(v, 64)).filter(Boolean);
    for (const v of variaveis) if (!RE_VARIAVEL.test(v)) throw new Error(`${nome}: "${v}" não é nome de variável de ambiente (escreva só o nome, não o valor)`);
    limpa.variaveis = tipo === 'comando' ? [...new Set(variaveis)].slice(0, 20) : [];
    conexoes.push(limpa);
  }
  // quem pode usar o quê: { idDoAgente: [idDaConexao, ...] }, só com conexões que existem
  const agentes = {};
  for (const [ag, ids] of Object.entries(dados.agentes && typeof dados.agentes === 'object' ? dados.agentes : {}).slice(0, 60)) {
    if (!/^[a-z][a-z0-9-]*$/.test(ag) || !Array.isArray(ids)) continue;
    const validos = [...new Set(ids.filter((i) => vistos.has(i)))];
    if (validos.length) agentes[ag] = validos;
  }
  return { conexoes, agentes };
}

// Variáveis de ambiente que a conexão pede e não estão definidas.
export function variaveisQueFaltam(c, env = process.env) {
  return [...(c.variaveis || []), ...(c.variavelToken ? [c.variavelToken] : [])].filter((v) => !env[v]);
}

// A configuração no formato que o aplicativo do provedor lê (--mcp-config). Os valores das variáveis não entram:
// só a referência "${NOME}".
export function montarConfigMcp(conexoes) {
  const mcpServers = {};
  for (const c of conexoes) {
    if (c.tipo === 'http') mcpServers[c.id] = { type: 'http', url: c.url, ...(c.variavelToken && { headers: { Authorization: `Bearer \${${c.variavelToken}}` } }) };
    else mcpServers[c.id] = { command: c.comando, args: c.args || [], ...(c.variaveis?.length && { env: Object.fromEntries(c.variaveis.map((v) => [v, `\${${v}}`])) }) };
  }
  return { mcpServers };
}

// O que um agente recebe: as conexões ativas ligadas a ele. Devolve [] se não houver.
export function conexoesDoAgente(dados, idAgente) {
  const ids = dados.agentes?.[idAgente] || [];
  return dados.conexoes.filter((c) => c.ativa && ids.includes(c.id));
}

// Grava a configuração de um agente e devolve o que o provedor precisa para montar a chamada.
export async function prepararMcp(pasta, idAgente, conexoes) {
  if (!conexoes.length) return null;
  await fs.mkdir(pasta, { recursive: true });
  const arquivo = path.join(pasta, `${idAgente}.json`);
  await fs.writeFile(arquivo, JSON.stringify(montarConfigMcp(conexoes), null, 2) + '\n');
  // permissão: o servidor inteiro, ou só as ferramentas escolhidas
  const permissoes = conexoes.flatMap((c) => (c.ferramentas?.length ? c.ferramentas.map((f) => `mcp__${c.id}__${f}`) : [`mcp__${c.id}`])).join(',');
  return { arquivo, permissoes, servidores: conexoes.map(({ id, nome, descricao }) => ({ id, nome, descricao })) };
}

// ---------- cliente mínimo, para o botão "Testar"

const PROTOCOLO = '2025-03-26';
const INICIAR = { protocolVersion: PROTOCOLO, capabilities: {}, clientInfo: { name: 'muvuca', version: '1' } };
const resumo = (tools) => (Array.isArray(tools) ? tools : []).slice(0, 1000).map((t) => ({ nome: texto(t?.name, 80), descricao: texto(t?.description, 200) }));

// Servidor por comando: conversa pela entrada e saída padrão, uma mensagem JSON por linha.
function testarComando(c, limiteMs) {
  return new Promise((resolve) => {
    const noWindows = process.platform === 'win32';
    const aspas = (s) => (/[\s"&|<>^()]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
    let filho;
    const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
    try {
      // No Windows, comandos como "npx" são arquivos .cmd e só rodam pelo shell.
      filho = noWindows ? spawn([c.comando, ...(c.args || [])].map(aspas).join(' '), [], { shell: true, windowsHide: true, env })
        : spawn(c.comando, c.args || [], { env });
    } catch (e) { return resolve({ ok: false, erro: `não deu para rodar "${c.comando}": ${e.message}` }); }
    let buf = '', erros = '', fim = false;
    const acabar = (r) => {
      if (fim) return; fim = true; clearTimeout(tempo);
      try { filho.stdin.end(); } catch { /* já fechou */ }
      if (noWindows && filho.pid) spawn('taskkill', ['/pid', String(filho.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }).on('error', () => {});
      else try { filho.kill(); } catch { /* já saiu */ }
      resolve(r);
    };
    const tempo = setTimeout(() => acabar({ ok: false, erro: `sem resposta em ${Math.round(limiteMs / 1000)} s${erros ? ': ' + erros.trim().slice(-200) : ''}` }), limiteMs);
    const mandar = (m) => { try { filho.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...m }) + '\n'); } catch { /* o servidor já saiu */ } };
    filho.on('error', (e) => acabar({ ok: false, erro: `não deu para rodar "${c.comando}": ${e.code === 'ENOENT' ? 'comando não encontrado' : e.message}` }));
    filho.on('exit', (codigo) => {
      // pelo shell do Windows, comando inexistente não dá erro de "spawn": sai com a mensagem do próprio shell
      if (/reconhecido como um comando|not recognized as an internal|command not found|: not found/i.test(erros)) return acabar({ ok: false, erro: `comando não encontrado: ${c.comando}` });
      acabar({ ok: false, erro: `o servidor saiu antes de responder (código ${codigo})${erros ? ': ' + erros.trim().slice(-300) : ''}` });
    });
    filho.stderr.on('data', (d) => { erros = (erros + d).slice(-2000); });
    filho.stdin.on('error', () => {});
    filho.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const linha = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        let m; try { m = JSON.parse(linha); } catch { continue; }
        if (m.id === 1 && m.result) { mandar({ method: 'notifications/initialized' }); mandar({ id: 2, method: 'tools/list' }); }
        else if (m.id === 1 && m.error) acabar({ ok: false, erro: `o servidor recusou a conexão: ${texto(m.error.message, 200)}` });
        else if (m.id === 2) acabar(m.result ? { ok: true, ferramentas: resumo(m.result.tools) } : { ok: false, erro: `o servidor não listou as ferramentas: ${texto(m.error?.message, 200)}` });
      }
    });
    mandar({ id: 1, method: 'initialize', params: INICIAR });
  });
}

// Servidor por endereço (HTTP): a resposta pode vir como JSON ou como um fluxo de eventos; nos dois casos pego a primeira mensagem com o id pedido.
async function testarHttp(c, limiteMs) {
  const token = c.variavelToken ? process.env[c.variavelToken] : '';
  const chamar = async (corpo, sessao) => {
    const r = await fetch(c.url, {
      method: 'POST', signal: AbortSignal.timeout(limiteMs),
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...(token && { authorization: `Bearer ${token}` }), ...(sessao && { 'mcp-session-id': sessao }) },
      body: JSON.stringify({ jsonrpc: '2.0', ...corpo }),
    });
    if (r.status === 401 || r.status === 403) throw new Error(`o servidor recusou o acesso (${r.status})${c.variavelToken ? '' : ': talvez precise de um token'}`);
    if (!r.ok && r.status !== 202) throw new Error(`o servidor respondeu ${r.status}`);
    const bruto = await r.text();
    let msg = null;
    if ((r.headers.get('content-type') || '').includes('text/event-stream')) {
      for (const l of bruto.split('\n')) if (l.startsWith('data:')) { try { const j = JSON.parse(l.slice(5)); if (j.id === corpo.id) { msg = j; break; } } catch { /* linha parcial */ } }
    } else if (bruto.trim()) { try { msg = JSON.parse(bruto); } catch { throw new Error('a resposta do servidor não é JSON'); } }
    return { msg, sessao: r.headers.get('mcp-session-id') || sessao };
  };
  try {
    const a = await chamar({ id: 1, method: 'initialize', params: INICIAR });
    if (!a.msg?.result) throw new Error(a.msg?.error ? `o servidor recusou a conexão: ${texto(a.msg.error.message, 200)}` : 'o servidor não respondeu à apresentação');
    await chamar({ method: 'notifications/initialized' }, a.sessao).catch(() => {});
    const b = await chamar({ id: 2, method: 'tools/list' }, a.sessao);
    if (!b.msg?.result) throw new Error(`o servidor não listou as ferramentas${b.msg?.error ? ': ' + texto(b.msg.error.message, 200) : ''}`);
    return { ok: true, ferramentas: resumo(b.msg.result.tools) };
  } catch (e) {
    const m = e.name === 'TimeoutError' ? `sem resposta em ${Math.round(limiteMs / 1000)} s` : e.cause?.code === 'ECONNREFUSED' ? 'ninguém atende nesse endereço' : e.message;
    return { ok: false, erro: m };
  }
}

// Testa uma conexão: sobe (ou chama) o servidor, apresenta-se e pede a lista de ferramentas.
export async function testarConexao(c, { limiteMs = 30000 } = {}) {
  const faltam = variaveisQueFaltam(c);
  if (faltam.length) return { ok: false, erro: `falta definir ${faltam.length > 1 ? 'as variáveis de ambiente' : 'a variável de ambiente'} ${faltam.join(', ')} antes de abrir a Muvuca` };
  return c.tipo === 'http' ? testarHttp(c, limiteMs) : testarComando(c, limiteMs);
}
