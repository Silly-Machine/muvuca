// Ferramentas que os agentes podem usar, sempre confinadas à pasta do projeto.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { comandoIsolavel, prepararIsolamento, EXPLICACAO_BLOQUEIO } from './isolamento.js';

// Pastas que a foto do projeto não percorre: são enormes e não são código do projeto. O que mudar dentro delas
// fica fora do "Descartar"; a foto guarda um sinal de cada uma para ao menos avisar quando algo mudou.
// (dist/ e build/ já estiveram aqui: saíram porque um time pode escrever nelas, e o descarte não as restaurava.)
const IGNORAR = new Set(['node_modules', '.git', '__pycache__', '.venv', 'venv']);
const MAX_HASH = 512 * 1024;             // acima disto, a detecção rápida de mudança usa tamanho e data em vez do conteúdo
const MAX_GUARDAR = 25 * 1024 * 1024;    // maior arquivo que a foto guarda inteiro
const MAX_TOTAL = 400 * 1024 * 1024;     // quanto a foto guarda no total
const MAX_ARQUIVOS = 20000;

export function dentro(projeto, rel) {
  const abs = path.resolve(projeto, String(rel || '.'));
  const r = path.relative(projeto, abs);
  if (r.startsWith('..') || path.isAbsolute(r)) throw new Error(`caminho fora do projeto: ${rel}`);
  if (/(^|[\\/])\.env(\.|$)/i.test(r)) throw new Error(`arquivo protegido: ${rel}`);
  return abs;
}

const rel = (projeto, abs) => path.relative(projeto, abs).split(path.sep).join('/');

async function andar(projeto, dir, saida, fora) {
  let itens;
  try { itens = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const it of itens) {
    if (saida.length >= MAX_ARQUIVOS) { saida.cheio = true; return; }
    const abs = path.join(dir, it.name);
    if (IGNORAR.has(it.name)) { if (fora && it.isDirectory()) fora.set(rel(projeto, abs) + '/', await sinalDaPasta(abs)); continue; }
    if (it.isSymbolicLink()) continue; // link simbólico pode apontar para fora do projeto
    if (it.isDirectory()) await andar(projeto, abs, saida, fora);
    else if (it.isFile()) saida.push(abs);
  }
}
// Sinal barato de uma pasta que a foto não percorre: quantos itens tem no primeiro nível e a data mais recente entre eles.
// Não pega toda mudança lá dentro, mas pega instalar, remover ou trocar um pacote.
async function sinalDaPasta(abs) {
  try {
    const itens = await fs.readdir(abs);
    let recente = (await fs.stat(abs)).mtimeMs;
    for (const n of itens.slice(0, 400)) { const st = await fs.stat(path.join(abs, n)).catch(() => null); if (st && st.mtimeMs > recente) recente = st.mtimeMs; }
    return `${itens.length}:${Math.round(recente)}`;
  } catch { return 'ilegivel'; }
}

// Foto do projeto: caminho relativo -> Buffer (ou null se grande demais para guardar).
export async function fotografar(projeto) {
  const arquivos = [], fora = new Map();
  await andar(projeto, projeto, arquivos, fora);
  const foto = new Map();
  // O que a foto não guarda inteiro (arquivo grande demais, ou o total passou do limite) entra como null,
  // com um sinal (tamanho e data) em foto.sinais: dá para saber que mudou, mas não para restaurar.
  foto.sinais = new Map(); foto.fora = fora; foto.incompleta = !!arquivos.cheio;
  let total = 0;
  for (const abs of arquivos) {
    const st = await fs.stat(abs).catch(() => null); if (!st) continue;
    const k = rel(projeto, abs);
    if (st.size > MAX_GUARDAR || total + st.size > MAX_TOTAL) { foto.set(k, null); foto.sinais.set(k, `${st.size}:${Math.round(st.mtimeMs)}`); continue; }
    total += st.size;
    foto.set(k, await fs.readFile(abs));
  }
  return foto;
}

export async function assinaturas(projeto) {
  const arquivos = [];
  await andar(projeto, projeto, arquivos);
  const m = new Map();
  for (const abs of arquivos) {
    const st = await fs.stat(abs);
    const h = st.size > MAX_HASH ? `g:${st.size}:${st.mtimeMs}` : crypto.createHash('sha1').update(await fs.readFile(abs)).digest('hex');
    m.set(rel(projeto, abs), h);
  }
  return m;
}

export function mudou(antes, depois) {
  const s = new Set();
  for (const [k, v] of depois) if (antes.get(k) !== v) s.add(k);
  for (const k of antes.keys()) if (!depois.has(k)) s.add(k);
  return [...s];
}

export async function restaurar(projeto, foto) {
  const agora = await fotografar(projeto);
  for (const k of agora.keys()) {
    if (foto.has(k)) continue;
    await fs.rm(path.join(projeto, k), { force: true });
    // remove as pastas que ficaram vazias (rmdir falha, e para, na primeira que ainda tem algo)
    for (let d = path.dirname(path.join(projeto, k)); d !== projeto && d.startsWith(projeto); d = path.dirname(d)) { try { await fs.rmdir(d); } catch { break; } }
  }
  for (const [k, buf] of foto) {
    if (buf === null) continue;
    const atual = agora.get(k);
    if (atual && Buffer.compare(atual, buf) === 0) continue;
    await fs.mkdir(path.dirname(path.join(projeto, k)), { recursive: true });
    await fs.writeFile(path.join(projeto, k), buf);
  }
}

// Guarda a foto em disco (uma pasta com manifesto + cópia dos arquivos), para a decisão de manter ou descartar
// sobreviver a um reinício do servidor. Sem foto, apaga a pasta.
export async function salvarFoto(dir, projeto, foto) {
  await fs.rm(dir, { recursive: true, force: true });
  if (!foto) return;
  await fs.mkdir(dir, { recursive: true });
  const arquivos = []; let i = 0;
  for (const [k, buf] of foto) {
    if (buf === null) { arquivos.push([k, null, foto.sinais?.get(k) ?? null]); continue; }
    const nome = `f${i++}`; await fs.writeFile(path.join(dir, nome), buf); arquivos.push([k, nome]);
  }
  await fs.writeFile(path.join(dir, 'manifesto.json'), JSON.stringify({ projeto, arquivos, fora: [...(foto.fora || [])], incompleta: !!foto.incompleta }));   // por último: sem manifesto, a foto não vale
}
export async function carregarFoto(dir) {
  try {
    const m = JSON.parse(await fs.readFile(path.join(dir, 'manifesto.json'), 'utf8'));
    const foto = new Map(); foto.sinais = new Map(); foto.fora = new Map(m.fora || []); foto.incompleta = !!m.incompleta;
    for (const [k, nome, sinal] of m.arquivos) { foto.set(k, nome === null ? null : await fs.readFile(path.join(dir, nome))); if (nome === null && sinal) foto.sinais.set(k, sinal); }
    return { projeto: m.projeto, foto };
  } catch { return null; }
}

const binario = (buf) => buf.subarray(0, 4000).includes(0);

function diffLinhas(a, b) {
  const A = a.split('\n'), B = b.split('\n');
  if (A.length * B.length > 4_000_000) return [{ t: '!', l: 'arquivo grande demais para comparar linha a linha' }];
  const n = A.length, m = B.length;
  const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ops = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { ops.push({ t: ' ', l: A[i] }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) ops.push({ t: '-', l: A[i++] });
    else ops.push({ t: '+', l: B[j++] });
  }
  while (i < n) ops.push({ t: '-', l: A[i++] });
  while (j < m) ops.push({ t: '+', l: B[j++] });
  // mantém só as mudanças com 2 linhas de contexto
  const manter = new Uint8Array(ops.length);
  ops.forEach((o, k) => { if (o.t !== ' ') for (let d = -2; d <= 2; d++) if (ops[k + d]) manter[k + d] = 1; });
  const saida = []; let pulou = false;
  ops.forEach((o, k) => { if (manter[k]) { if (pulou && saida.length) saida.push({ t: '~', l: '' }); saida.push(o); pulou = false; } else pulou = true; });
  return saida;
}

export async function diferencas(projeto, foto) {
  const agora = await fotografar(projeto);
  const saida = [];
  const nomes = new Set([...foto.keys(), ...agora.keys()]);
  for (const k of [...nomes].sort()) {
    const a = foto.get(k), b = agora.get(k);
    if (a && b && Buffer.compare(a, b) === 0) continue;
    if (a === null && b === null) {
      // nenhum dos dois lados tem cópia: só o sinal (tamanho e data) diz se mudou
      if (foto.sinais?.get(k) === agora.sinais?.get(k)) continue;
      saida.push({ arquivo: k, tipo: 'alterado', semCopia: true, linhas: [{ t: '!', l: 'arquivo grande demais para guardar cópia: o Descartar não consegue restaurar este' }] });
      continue;
    }
    const tipo = !foto.has(k) ? 'novo' : !agora.has(k) ? 'removido' : 'alterado';
    // sem cópia do estado anterior, não há o que restaurar (arquivo novo é só apagado, e isso funciona)
    const semCopia = a === null && foto.has(k);
    if ((a && binario(a)) || (b && binario(b)) || a === null || b === null) { saida.push({ arquivo: k, tipo, ...(semCopia && { semCopia: true }), linhas: [{ t: '!', l: semCopia ? 'arquivo grande demais para guardar cópia: o Descartar não consegue restaurar este' : 'binário ou grande' }] }); continue; }
    saida.push({ arquivo: k, tipo, linhas: diffLinhas(a ? a.toString('utf8') : '', b ? b.toString('utf8') : '') });
  }
  // O que o "Descartar" não cobre, para a tela avisar: pastas que a foto não percorre e que mudaram, e projeto grande demais.
  const avisos = [];
  for (const [pasta, sinal] of agora.fora || []) if ((foto.fora?.get(pasta) ?? null) !== sinal) avisos.push(`${pasta} mudou. Essa pasta fica fora do Descartar: o que foi instalado ou alterado nela continua lá.`);
  for (const pasta of (foto.fora || new Map()).keys()) if (!agora.fora?.has(pasta)) avisos.push(`${pasta} foi removida. Essa pasta fica fora do Descartar e não volta.`);
  if (foto.incompleta || agora.incompleta) avisos.push(`O projeto tem mais de ${MAX_ARQUIVOS} arquivos: os que passam disso ficam fora do diff e do Descartar.`);
  saida.avisos = avisos;
  return saida;
}

// Processos que a Muvuca subiu e ainda não terminaram (o aplicativo do provedor, os testes do portão).
// Ao fechar a Muvuca eles são encerrados, para não ficarem trabalhando sozinhos na pasta do projeto.
const vivos = new Set();
export function encerrarProcessos() {
  for (const filho of vivos) {
    if (!filho.pid) continue;
    try {
      // síncrono: isto roda quando o processo da Muvuca está saindo, e nada assíncrono chegaria a acontecer
      if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(filho.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true, timeout: 5000 });
      else { try { process.kill(-filho.pid, 'SIGKILL'); } catch { filho.kill('SIGKILL'); } }
    } catch { /* já saiu */ }
  }
  const n = vivos.size; vivos.clear(); return n;
}

function matar(filho) {
  if (!filho.pid) return;
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(filho.pid), '/T', '/F'], { stdio: 'ignore' });
  else { try { process.kill(-filho.pid, 'SIGKILL'); } catch { filho.kill('SIGKILL'); } }
}

// Roda um processo. Com `args`, não usa shell (exceto no Windows, onde os CLIs do npm são .cmd).
export function rodar(comando, { cwd, sinal, limiteMs = 120000, entrada, args, aoSair, env } = {}) {
  return new Promise((resolve) => {
    const usaShell = !args || process.platform === 'win32';
    // No Windows com shell, o Node só concatena os args (DEP0190): caminho com espaço quebra.
    // Monta a linha nós mesmos, pondo aspas em cada parte que precisa.
    const aspas = (s) => (/[\s"&|<>^()]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
    const linha = args && usaShell ? [comando, ...args].map(aspas).join(' ') : comando;
    let filho;
    try {
      filho = spawn(linha, usaShell ? [] : args, { cwd, shell: usaShell, detached: process.platform !== 'win32', windowsHide: true, env: { ...ambienteLimpo(), ...env } });
    } catch (e) { return resolve({ codigo: -1, saida: String(e.message) }); }
    vivos.add(filho); filho.once('close', () => vivos.delete(filho)); filho.once('error', () => vivos.delete(filho));
    let saida = ''; let fim = false;
    const junta = (d) => { saida += d; if (aoSair) aoSair(String(d)); if (saida.length > 400000) saida = saida.slice(-300000); };
    filho.stdout.on('data', junta); filho.stderr.on('data', junta);
    const acabar = (codigo, extra = '') => { if (fim) return; fim = true; clearTimeout(tempo); sinal?.removeEventListener('abort', abortar); resolve({ codigo, saida: saida + extra }); };
    const abortar = () => { matar(filho); acabar(-2, '\n[interrompido]'); };
    const tempo = setTimeout(() => { matar(filho); acabar(-3, `\n[tempo esgotado: ${limiteMs / 1000}s]`); }, limiteMs);
    if (sinal?.aborted) return abortar();
    sinal?.addEventListener('abort', abortar);
    filho.on('error', (e) => acabar(-1, String(e.message)));
    filho.on('close', (c) => acabar(c ?? -1));
    if (entrada !== undefined) filho.stdin.end(entrada); else filho.stdin.end();
  });
}

const SEGURO = /^(node --test|npm test|npm run test|npx vitest run|pytest|python3? -m pytest)( [\w./=:@-]+)*$/;
export const comandoSeguro = (c) => SEGURO.test(String(c).trim());

export async function detectarTeste(projeto) {
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(projeto, 'package.json'), 'utf8'));
    if (pkg.scripts?.test && !/no test specified/.test(pkg.scripts.test)) return 'npm test';
  } catch { /* sem package.json */ }
  const arquivos = [];
  await andar(projeto, projeto, arquivos);
  const nomes = arquivos.map((a) => rel(projeto, a));
  if (nomes.some((n) => /(\.test\.[cm]?js$)|(^test\/.*\.[cm]?js$)/.test(n))) return 'node --test';
  if (nomes.some((n) => /(^|\/)test_.*\.py$|_test\.py$/.test(n))) return 'python -m pytest -q';
  return null;
}

export const ESQUEMAS = {
  listar: { descricao: 'Lista os arquivos do projeto (caminhos relativos).', params: {} },
  ler: { descricao: 'Lê um arquivo de texto do projeto.', params: { caminho: 'string' } },
  escrever: { descricao: 'Cria ou substitui um arquivo do projeto com o conteúdo completo.', params: { caminho: 'string', conteudo: 'string' } },
  rodar: { descricao: 'Roda um comando na pasta do projeto. Comandos fora da lista segura pedem aprovação humana.', params: { comando: 'string' } },
};

// Executa uma chamada de ferramenta. `pedirAprovacao(comando)` devolve true ou false.
export async function usar(nome, args, { projeto, sinal, pedirAprovacao, isolar = false }) {
  try {
    if (nome === 'listar') {
      const arquivos = []; await andar(projeto, projeto, arquivos);
      return arquivos.map((a) => rel(projeto, a)).filter((n) => !/(^|\/)\.env/.test(n)).slice(0, 300).join('\n') || '(pasta vazia)';
    }
    if (nome === 'ler') return (await fs.readFile(dentro(projeto, args.caminho), 'utf8')).slice(0, 20000);
    if (nome === 'escrever') {
      const abs = dentro(projeto, args.caminho);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, String(args.conteudo ?? ''));
      return `gravado: ${args.caminho}`;
    }
    if (nome === 'rodar') {
      const cmd = String(args.comando || '').trim();
      if (!comandoSeguro(cmd) && !(await pedirAprovacao(cmd))) return 'NEGADO: o humano não aprovou este comando.';
      // comando de teste que dá para isolar roda sem alcançar nada fora da pasta do projeto
      const alvo = isolar ? await comandoIsolavel(cmd, projeto) : null;
      const iso = alvo ? await prepararIsolamento(projeto) : null;
      try {
        const r = await rodar(iso?.ok ? iso.comando(alvo) : cmd, { cwd: projeto, sinal, limiteMs: 90000, env: iso?.ok ? iso.env : undefined });
        return `código de saída: ${r.codigo}\n${r.saida.slice(-6000)}` + (iso?.ok && /ERR_ACCESS_DENIED/.test(r.saida) ? EXPLICACAO_BLOQUEIO : '');
      } finally { await iso?.limpar?.(); }
    }
    return `ferramenta desconhecida: ${nome}`;
  } catch (e) { return `ERRO: ${e.message}`; }
}

// Sem isto, um `node --test` disparado de dentro de outro `node --test` herda NODE_TEST_CONTEXT,
// vira "filho" do primeiro e sai com código 0 mesmo com teste falhando: o portão aprovaria código quebrado.
function ambienteLimpo() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
}
