// Bateria ao vivo: exercita o servidor ligado, rota por rota, em modo demonstração.
// Uso (com a Muvuca rodando):  node scripts/bateria.mjs
// Só trabalha na pasta padrão (que precisa terminar em "teste-estudio") e devolve tudo ao estado inicial no fim.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const BASE = process.env.MUVUCA_URL || 'http://localhost:4317';
// A chave de acesso fica na pasta de dados do servidor que está sendo testado (MUVUCA_DADOS, ou ~/.muvuca).
const PASTA_DADOS = path.resolve(process.env.MUVUCA_DADOS || path.join(os.homedir(), '.muvuca'));
const CHAVE = (await fs.readFile(path.join(PASTA_DADOS, 'acesso.token'), 'utf8').catch(() => '')).trim();
if (!CHAVE) { console.log(`Não achei a chave de acesso em ${PASTA_DADOS}. Se o servidor usa outra pasta de dados, rode com MUVUCA_DADOS apontando para ela.`); process.exit(2); }
// Toda chamada da bateria leva a chave; "semChave" é para testar o que o servidor responde a quem não tem.
const semChave = globalThis.fetch;
globalThis.fetch = (u, o = {}) => semChave(u, { ...o, headers: { 'x-muvuca-token': CHAVE, ...(o.headers || {}) } });
const AQUI = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const resultados = [];
let grupo = '';
const ok = (nome, cond, detalhe = '') => { resultados.push({ grupo, nome, ok: !!cond, detalhe: cond ? '' : String(detalhe).slice(0, 300) }); if (!cond) console.log(`  FALHOU [${grupo}] ${nome} ${detalhe ? '-> ' + String(detalhe).slice(0, 300) : ''}`); };
const secao = (g) => { grupo = g; console.log('• ' + g); };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const get = async (u) => { const r = await fetch(BASE + u); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* não é JSON */ } return { s: r.status, j, t, tipo: r.headers.get('content-type') || '', cab: Object.fromEntries(r.headers) }; };
const post = async (u, corpo, cab = { 'content-type': 'application/json' }) => { const r = await fetch(BASE + u, { method: 'POST', headers: cab, body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo ?? {}) }); let j = null; try { j = await r.json(); } catch { /* sem corpo */ } return { s: r.status, j }; };
// lê o que o servidor reenvia ao conectar (a conversa inteira) e desconecta
async function eventos() {
  const ctl = new AbortController(); const r = await fetch(BASE + '/api/eventos', { signal: ctl.signal });
  const leitor = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
  const fim = Date.now() + 700;
  while (Date.now() < fim) { const p = await Promise.race([leitor.read(), dormir(250).then(() => null)]); if (p?.value) buf += dec.decode(p.value); }
  ctl.abort();
  return buf.split('\n').filter((l) => l.startsWith('data: ')).map((l) => JSON.parse(l.slice(6)));
}
// acontecimentos das conversas já encerradas pela bateria (histórico), mais os da conversa em andamento
async function eventosGuardados() {
  const todos = [...(await eventos())];
  for (const c of ((await get('/api/conversas')).j?.conversas || []).slice(0, 6)) todos.push(...(((await get('/api/conversas/' + c.id)).j?.eventos) || []));
  return todos;
}
const config = async () => (await get('/api/config')).j;
async function esperarParar(maxMs = 120000) { const fim = Date.now() + maxMs; while (Date.now() < fim) { if (!(await config()).rodando) return true; await dormir(600); } return false; }
const vazia = async (pasta) => (await fs.readdir(pasta)).length === 0;

// ---------- preparo
const c0 = await config();
const PROJETO = c0.projetoPadrao;
if (!/[\\/]teste-estudio$/.test(PROJETO)) { console.log(`Pasta padrão não é teste-estudio (${PROJETO}): não rodo a bateria.`); process.exit(2); }
if (c0.rodando) { console.log('Há um pedido em andamento: espere terminar.'); process.exit(2); }
if (!c0.agentes.every((a) => a.tipo === 'demo')) { console.log('O time não está em demonstração: troque em Configurações antes de rodar (a bateria não gasta modelo de verdade).'); process.exit(2); }
if (!(await vazia(PROJETO))) { console.log(`A pasta ${PROJETO} não está vazia: a bateria não mexe em pasta com conteúdo.`); process.exit(2); }
if ((await eventos())[0]?.pendente) { console.log('Há mudanças esperando decisão: decida antes de rodar.'); process.exit(2); }
const prefs0 = (await get('/api/preferencias')).j.preferencias;
const DADOS = (await get('/api/preferencias')).j.pastaDados;   // onde o servidor guarda preferências e o ponto de restauração
const rotinas0 = (await get('/api/rotinas')).j.rotinas;
const projetos0 = (await get('/api/projetos')).j.projetos.map(({ nome, caminho }) => ({ nome, caminho }));
const times0 = (await get('/api/times')).j;
const timeArquivo = times0.times.find((t) => t.origem === 'arquivo');
const PEDIDO = 'Crie uma página de status com um endpoint /health';

// ---------- 1. páginas e arquivos
secao('Página e imagens');
{ const r = await get('/'); ok('página inicial abre', r.s === 200 && /<title>Muvuca<\/title>/.test(r.t)); }
{ const formas = ['cartola', 'engrenagem', 'regente', 'pilha', 'cristal', 'lente', 'escudo', 'tela', 'gota', 'nuvem', 'cogumelo', 'polvo', 'foguete', 'gato', 'livro', 'planta', 'salsicha'];
  const estados = ['disponivel', 'pensando', 'trabalhando', 'concluido', 'aguardando']; const faltam = [];
  for (const f of formas) for (const e of estados) { const r = await fetch(`${BASE}/bonecos/${f}-${e}.webp`); if (r.status !== 200 || r.headers.get('content-type') !== 'image/webp') faltam.push(`${f}-${e}`); await r.arrayBuffer(); }
  ok('as 85 imagens dos bonecos existem', !faltam.length, faltam.join(', ')); }
{ const html = (await get('/')).t; const pedidos = [...html.matchAll(/(?:src|href)="(\/(?:js|css)\/[^"]+)"/g)].map((m) => m[1]); const ruins = [];
  for (const p of pedidos) { const r = await fetch(BASE + p); const t = r.headers.get('content-type') || ''; if (r.status !== 200 || !(p.endsWith('.css') ? t.startsWith('text/css') : t.startsWith('text/javascript'))) ruins.push(p + ' ' + r.status + ' ' + t); await r.arrayBuffer(); }
  ok('estilos e a entrada da tela são servidos com o tipo certo', pedidos.includes('/js/principal.js') && pedidos.length >= 4 && !ruins.length, ruins.join(', ') || pedidos.join(' '));
  // a tela é feita de módulos: a partir da entrada, todo arquivo importado tem de ser servido como JavaScript
  { const vistos = new Set(), fila = ['/js/principal.js'], quebrados = [];
    while (fila.length) { const u = fila.pop(); if (vistos.has(u)) continue; vistos.add(u);
      const r = await fetch(BASE + u); const txt = await r.text();
      if (r.status !== 200 || !(r.headers.get('content-type') || '').startsWith('text/javascript')) { quebrados.push(u + ' ' + r.status); continue; }
      for (const m of txt.matchAll(/^import\s+(?:[^'"]*?from\s+)?['"]([^'"]+)['"]/gm)) fila.push(new URL(m[1], 'http://x' + u).pathname); }
    ok('todos os módulos da tela são servidos', vistos.size >= 14 && !quebrados.length, quebrados.join(', ') || 'só ' + vistos.size + ' módulos'); }
  const e1 = await fetch(BASE + '/js/base.js'); const etag = e1.headers.get('etag'); await e1.arrayBuffer();
  ok('arquivo que não mudou responde 304', !!etag && (await fetch(BASE + '/js/base.js', { headers: { 'if-none-match': etag } })).status === 304); }
ok('pasta de scripts não deixa subir de nível nem servir outro tipo', (await get('/js/..%2F..%2Fsrc%2Fservidor.js')).s === 404 && (await get('/js/../../package.json')).s === 404 && (await get('/js/regras/../../index.html')).s === 404 && (await get('/css/estilo.css.map')).s === 404 && (await get('/js/a/b/c.js')).s === 404 && (await get('/js/')).s === 404);
ok('imagem que não existe dá 404', (await get('/bonecos/nada-nada.webp')).s === 404);
ok('caminho fora da pasta de imagens não é servido', (await get('/bonecos/..%2F..%2Fservidor.js')).s === 404 && (await get('/bonecos/../servidor.js')).s === 404);
ok('arquivo do servidor não é servido', (await get('/servidor.js')).s === 404 && (await get('/src/servidor.js')).s === 404 && (await get('/config/agentes.json')).s === 404 && (await get('/agentes.local.json')).s === 404 && (await get('/preferencias.json')).s === 404);
ok('rota desconhecida dá 404', (await get('/api/nao-existe')).s === 404);

// ---------- acesso
secao('Acesso');
{ const st = async (u, o) => (await semChave(BASE + u, o)).status;
  ok('sem a chave, a API recusa (401)', await st('/api/config') === 401 && await st('/api/eventos') === 401 && await st('/api/conversas') === 401);
  ok('sem a chave, ninguém manda rodar comando', await st('/api/conexoes/testar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"conexao":{"nome":"x","comando":"node -v"}}' }) === 401);
  ok('chave errada é recusada', await st('/api/config', { headers: { 'x-muvuca-token': 'a'.repeat(48) } }) === 401);
  ok('a página sem a chave explica, sem entregar a chave', await st('/') === 401 && !(await (await semChave(BASE + '/')).text()).includes(CHAVE));
  const entrada = await semChave(BASE + '/?t=' + CHAVE);
  ok('a chave no endereço abre a página e entrega o cookie', entrada.status === 200 && /HttpOnly/.test(entrada.headers.get('set-cookie') || '') && /SameSite=Strict/.test(entrada.headers.get('set-cookie') || ''));
  const politica = entrada.headers.get('content-security-policy') || '';
  ok('a página só carrega o que vem deste servidor', politica.includes("default-src 'self'") && politica.includes("frame-ancestors 'none'") && !/script-src[^;]*unsafe-inline/.test(politica), politica);
  ok('a página não busca nada fora deste computador', !/(?:src|href)\s*=\s*["']?(?:https?:)?\/\//.test(await entrada.text()));
  const fonte = await semChave(BASE + '/fontes/nunito-latin-400-normal.woff2'); await fonte.arrayBuffer();
  ok('as fontes vêm do próprio servidor', fonte.status === 200 && fonte.headers.get('content-type') === 'font/woff2');
  ok('cabeçalhos de segurança em toda resposta', (await get('/api/config')).cab['x-frame-options'] === 'DENY' && (await get('/css/tema.css')).cab['x-content-type-options'] === 'nosniff'); }

// ---------- 2. proteções de entrada
secao('Proteções de entrada');
ok('POST sem JSON é recusado (415)', (await post('/api/nova', 'x=1', { 'content-type': 'text/plain' })).s === 415);
ok('POST vindo de outro site é recusado (403)', (await post('/api/nova', {}, { 'content-type': 'application/json', origin: 'https://site-estranho.example' })).s === 403);
ok('POST com a origem da própria página é aceito', (await post('/api/buzina', { pergunta: 'oi' }, { 'content-type': 'application/json', origin: 'http://localhost:4317' })).s === 200);
ok('JSON quebrado dá erro 400, não derruba', (await post('/api/pedido', '{quebrado')).s === 400 && (await get('/api/config')).s === 200);
ok('config não vaza chave de API', !/chave|apikey|api_key|authorization/i.test(JSON.stringify((await config()).provedores)));

// ---------- 3. pedido: validações
secao('Pedido: validações');
ok('pedido vazio é recusado', (await post('/api/pedido', { texto: '  ', projeto: PROJETO })).s === 400);
{ const r = await post('/api/pedido', { texto: 'oi', projeto: 'C:\\pasta\\que-nao-existe-xyz' }); ok('pasta inexistente é recusada na resposta', r.s === 400 && /não encontrada/.test(r.j?.erro || ''), JSON.stringify(r)); }
{ const r = await post('/api/pedido', { texto: 'oi', projeto: PROJETO, para: 'fantasma' }); ok('agente inexistente é recusado', r.s === 400 && /não existe/.test(r.j?.erro || ''), JSON.stringify(r)); }
ok('recusas não deixam o time ocupado nem decisão pendente', !(await config()).rodando && !(await eventos())[0].pendente);
ok('decidir sem nada pendente dá erro', (await post('/api/decidir', { acao: 'descartar' })).s === 400);

// ---------- 4. fluxo completo no time do arquivo
secao('Fluxo completo (time do arquivo)');
await post('/api/nova');
{ const r = await post('/api/pedido', { texto: PEDIDO, projeto: PROJETO }); ok('pedido aceito (202)', r.s === 202, JSON.stringify(r)); }
ok('segundo pedido durante o primeiro é recusado (409)', (await post('/api/pedido', { texto: 'outro', projeto: PROJETO })).s === 409);
ok('trocar o time com pedido rodando é recusado', (await post('/api/time', { time: timeArquivo })).s === 400);
ok('nova conversa com pedido rodando é recusada', (await post('/api/nova')).s === 400);
ok('o pedido termina sozinho', await esperarParar());
{ const ev = await eventos(); const tipos = ev.map((e) => e.tipo);
  ok('primeiro evento identifica o servidor', ev[0].tipo === 'ola' && !!ev[0].boot && ev[0].pendente === true, JSON.stringify(ev[0]));
  for (const t of ['pedido', 'plano', 'consulta', 'passo', 'concluiu', 'portao', 'devolucao', 'veredito', 'final', 'diff', 'tarefa', 'memoria'.replace('memoria', 'fala')]) ok(`evento "${t}" apareceu`, tipos.includes(t));
  const fim = ev.find((e) => e.tipo === 'final'); ok('entrega aprovada', fim?.aprovado === true, JSON.stringify(fim));
  ok('houve devolução e correção', ev.filter((e) => e.tipo === 'devolucao').length === 2);
  const dif = ev.find((e) => e.tipo === 'diff'); ok('3 arquivos alterados, com autor', dif?.arquivos.length === 3 && Object.keys(dif.autores).length === 3, JSON.stringify(dif?.arquivos.map((a) => a.arquivo)));
  const quadro = new Map(); for (const e of ev.filter((x) => x.tipo === 'tarefa')) quadro.set(e.id, e);
  ok('quadro: todas as tarefas encerradas', [...quadro.values()].every((t) => ['pronto', 'falhou'].includes(t.estado)) && quadro.size >= 5, JSON.stringify([...quadro.values()].map((t) => t.estado)));
  ok('todos os agentes voltam a "disponível"', c0.agentes.every((a) => ev.filter((e) => e.tipo === 'status' && e.agente === a.id).at(-1)?.estado === 'disponivel'));
  ok('eventos numerados em ordem', ev.slice(1).every((e, i, l) => i === 0 || e.n > l[i - 1].n)); }
ok('os arquivos existem na pasta', (await fs.readdir(PROJETO)).sort().join() === 'public,src,test');
// com decisão pendente
ok('nova conversa com decisão pendente é recusada', (await post('/api/nova')).s === 400);
{ const r = await post('/api/time', { time: timeArquivo }); ok('trocar time com decisão pendente pede a decisão (código "decisao")', r.s === 400 && r.j?.codigo === 'decisao', JSON.stringify(r)); }
ok('ponto de restauração gravado em disco', await fs.stat(path.join(DADOS, '.pendente', 'manifesto.json')).then(() => true, () => false));
ok('decisão inválida é recusada', (await post('/api/decidir', { acao: 'talvez' })).s === 400);
ok('descartar funciona', (await post('/api/decidir', { acao: 'descartar' })).s === 200);
ok('a pasta voltou a ficar vazia', await vazia(PROJETO));
ok('o ponto de restauração saiu do disco', await fs.stat(path.join(DADOS, '.pendente')).then(() => false, () => true));

// ---------- 5. manter mudanças e pedido direto
secao('Manter mudanças e pedido direto');
await post('/api/nova');
await post('/api/pedido', { texto: PEDIDO, projeto: PROJETO }); await esperarParar();
ok('manter funciona', (await post('/api/decidir', { acao: 'aceitar' })).s === 200);
ok('os arquivos ficam depois de manter', !(await vazia(PROJETO)) && !(await eventos())[0].pendente);
{ await post('/api/pedido', { texto: 'Explique o que você faz', projeto: PROJETO, para: 'farol' }); await esperarParar();
  const ev = await eventos(); const fim = ev.filter((e) => e.tipo === 'final').at(-1);
  ok('pedido direto a um agente não passa por testes nem revisão', fim?.aprovado === null && /pedido direto/.test(fim.motivo || ''), JSON.stringify(fim)); }
if ((await eventos())[0].pendente) await post('/api/decidir', { acao: 'descartar' });
await fs.rm(path.join(PROJETO, 'public'), { recursive: true, force: true }); await fs.rm(path.join(PROJETO, 'src'), { recursive: true, force: true }); await fs.rm(path.join(PROJETO, 'test'), { recursive: true, force: true });
for (const n of await fs.readdir(PROJETO)) await fs.rm(path.join(PROJETO, n), { recursive: true, force: true });   // só o que a própria bateria criou (a pasta estava vazia no começo)
ok('pasta limpa de novo', await vazia(PROJETO));

// ---------- 6. parar no meio
secao('Parar no meio');
await post('/api/nova');
await post('/api/pedido', { texto: PEDIDO, projeto: PROJETO }); await dormir(2500);
ok('parar responde', (await post('/api/parar')).s === 200);
ok('o time para', await esperarParar(20000));
{ const ev = await eventos(); ok('evento "parado" aparece', ev.some((e) => e.tipo === 'parado'));
  const quadro = new Map(); for (const e of ev.filter((x) => x.tipo === 'tarefa')) quadro.set(e.id, e);
  ok('nenhuma tarefa fica pendurada', [...quadro.values()].every((t) => ['pronto', 'falhou', 'parado'].includes(t.estado)), JSON.stringify([...quadro.values()].map((t) => t.estado)));
  if (ev[0].pendente) await post('/api/decidir', { acao: 'descartar' }); }
ok('pasta vazia depois de parar e descartar', await vazia(PROJETO));

// ---------- 7. os 7 modelos de time prontos
secao('Modelos de time prontos');
for (const t of times0.times.filter((x) => x.origem === 'pronto')) {
  ok(`${t.nome}: modelo válido`, !t.erro, t.erro);
  if (t.erro) continue;
  const r = await post('/api/time', { time: t, salvar: false });
  ok(`${t.nome}: vai para o palco`, r.s === 200, JSON.stringify(r.j));
  if (r.s !== 200) continue;
  const cc = await config(); ok(`${t.nome}: palco com ${t.agentes.length} agente(s) e arquitetura ${t.arquitetura}`, cc.agentes.length === t.agentes.length && cc.arquitetura === t.arquitetura);
  await post('/api/pedido', { texto: PEDIDO, projeto: PROJETO });
  ok(`${t.nome}: o pedido termina`, await esperarParar());
  const ev = await eventos(); const fim = ev.find((e) => e.tipo === 'final');
  ok(`${t.nome}: entrega aprovada`, fim?.aprovado === true, JSON.stringify(fim) + ' ' + JSON.stringify(ev.filter((e) => e.tipo === 'erro')));
  ok(`${t.nome}: sem erro na conversa`, !ev.some((e) => e.tipo === 'erro'), JSON.stringify(ev.filter((e) => e.tipo === 'erro')));
  if (ev[0].pendente) await post('/api/decidir', { acao: 'descartar' });
  ok(`${t.nome}: pasta vazia depois de descartar`, await vazia(PROJETO));
}
{ const r = await post('/api/time', { time: timeArquivo, salvar: false }); ok('volta ao time do arquivo', r.s === 200 && (await config()).agentes.map((a) => a.id).join() === c0.agentes.map((a) => a.id).join(), JSON.stringify(r.j)); }
// construtor: times inválidos
{ const sem = await post('/api/time', { time: { nome: 'x', arquitetura: 'centralizada', agentes: [{ id: 'a', nome: 'A', ferramentas: ['escrever'] }] } }); ok('time sem líder é recusado', sem.s === 400 && /líder/.test(sem.j?.erro || ''), JSON.stringify(sem.j));
  const dup = await post('/api/time', { time: { nome: 'x', arquitetura: 'unico', agentes: [{ id: 'a', nome: 'A', ferramentas: ['escrever'] }, { id: 'a', nome: 'B', ferramentas: ['escrever'] }] } }); ok('ids repetidos são recusados', dup.s === 400, JSON.stringify(dup.j));
  const prov = await post('/api/time', { time: { nome: 'x', arquitetura: 'unico', agentes: [{ id: 'a', nome: 'A', provedor: 'nao-existe', ferramentas: ['escrever'] }] } }); ok('provedor inexistente é recusado', prov.s === 400 && /provedor/.test(prov.j?.erro || ''), JSON.stringify(prov.j)); }
ok('biblioteca tem os 15 agentes básicos, com a Buzina marcada como secreta', times0.catalogo.length === 15 && times0.catalogo.find((a) => a.id === 'buzina')?.secreto === true);

secao('Desenho do time');
// cada agente guarda o lugar no desenho (pos); os modelos prontos trazem o desenho base
for (const t of times0.times.filter((x) => x.origem === 'pronto' && !x.erro)) ok(`${t.nome}: todo agente com lugar no desenho`, t.agentes.every((a) => Array.isArray(a.pos) && a.pos.length === 2), JSON.stringify(t.agentes.map((a) => a.pos)));
{ const base = times0.times.find((x) => x.origem === 'pronto' && x.arquitetura === 'rede' && !x.erro);
  const desenhado = { ...base, desenho: { rede: 'camadas' }, modelo: base.nome, agentes: base.agentes.map((a, i) => ({ ...a, pos: i === 0 ? [3.456, -1] : i === 1 ? [999, 0] : a.pos })) };
  const r = await post('/api/time', { time: desenhado, salvar: true });
  ok('time com desenho vai para o palco e é salvo', r.s === 200 && r.j?.arquivo, JSON.stringify(r.j));
  const cc = await config();
  ok('o palco recebe o lugar de cada agente, arredondado', JSON.stringify(cc.agentes[0].pos) === '[3.46,-1]', JSON.stringify(cc.agentes[0]?.pos));
  ok('lugar fora do limite é descartado sem recusar o time', cc.agentes[1].pos === null, JSON.stringify(cc.agentes[1]?.pos));
  ok('o palco recebe o desenho da rede e o modelo de origem', cc.desenho?.rede === 'camadas' && cc.modelo === base.nome, JSON.stringify({ desenho: cc.desenho, modelo: cc.modelo }));
  { const rs = await post('/api/time', { time: { ...desenhado, desenho: { rede: 'anel', setas: 'arredondadas' } }, salvar: false });
    ok('setas arredondadas chegam ao palco junto com o desenho da rede', rs.s === 200 && JSON.stringify((await config()).desenho) === '{"rede":"anel","setas":"arredondadas"}', JSON.stringify((await config()).desenho)); }
  if (r.j?.arquivo) {
    const arq = path.join(PASTA_DADOS, 'times', r.j.arquivo);
    const salvo = JSON.parse(await fs.readFile(arq, 'utf8'));
    ok('o time salvo leva o desenho', JSON.stringify(salvo.agentes[0].pos) === '[3.46,-1]' && salvo.desenho?.rede === 'camadas' && salvo.modelo === base.nome, JSON.stringify({ pos: salvo.agentes[0].pos, desenho: salvo.desenho, modelo: salvo.modelo }));
    const naGaleria = (await get('/api/times')).j.times.find((x) => x.origem === 'salvo' && x.arquivo === r.j.arquivo);
    ok('o time salvo volta pela galeria com o desenho', JSON.stringify(naGaleria?.agentes[0].pos) === '[3.46,-1]', JSON.stringify(naGaleria?.agentes?.[0]));
    await fs.rm(arq);   // a bateria devolve a pasta de dados como achou
  }
  const semPos = await post('/api/time', { time: { ...base, agentes: base.agentes.map(({ pos, ...a }) => a) }, salvar: false });
  ok('time sem desenho continua valendo (desenho automático na tela)', semPos.s === 200 && (await config()).agentes.every((a) => a.pos === null), JSON.stringify(semPos.j));
  const r2 = await post('/api/time', { time: timeArquivo, salvar: false }); ok('volta ao time do arquivo depois do desenho', r2.s === 200); }
// mover os bonecos no palco: só o lugar muda, e o time em uso guarda
{ const antes = await config(); const id = antes.agentes[0].id, anterior = antes.agentes[0].pos;
  const r = await post('/api/desenho', { pos: { [id]: [1.234, 2] } });
  const depois = await config();
  ok('arrastar no palco grava o lugar, arredondado', r.s === 200 && JSON.stringify(depois.agentes[0].pos) === '[1.23,2]', JSON.stringify({ r: r.j, pos: depois.agentes[0].pos }));
  ok('arrastar no palco não muda o time', JSON.stringify(depois.agentes.map(({ pos, ...x }) => x)) === JSON.stringify(antes.agentes.map(({ pos, ...x }) => x)));
  ok('agente que não está no palco é recusado com uma frase', (await post('/api/desenho', { pos: { fantasma: [0, 0] } })).s === 400);
  ok('lugar fora do limite é recusado', (await post('/api/desenho', { pos: { [id]: [0, 999] } })).s === 400);
  await post('/api/time', { time: timeArquivo, salvar: false });   // devolve o time como achou, sem o lugar de teste
}
{ const js = await get('/js/regras/desenho.js'); ok('regras do desenho servidas à tela como módulo', js.s === 200 && /javascript/.test(js.tipo) && /export function completar/.test(js.t), js.s + ' ' + js.tipo); }

// ---------- 8. preferências e projetos
secao('Configurações e projetos');
{ const r = await post('/api/preferencias', { preferencias: { ...prefs0, maxCiclos: 99, maxPassos: -5 } }); ok('limites fora da faixa são ajustados', r.j?.preferencias.maxCiclos === 10 && r.j.preferencias.maxPassos === 1, JSON.stringify(r.j));
  ok('salvar limites não apaga o provedor nem os modelos escolhidos', r.j?.preferencias.provedorTime === prefs0.provedorTime && JSON.stringify(r.j.preferencias.modelos) === JSON.stringify(prefs0.modelos));
  const v = await post('/api/preferencias', { preferencias: prefs0 }); ok('preferências restauradas', v.j?.preferencias.maxCiclos === prefs0.maxCiclos && v.j.preferencias.projetoPadrao === prefs0.projetoPadrao); }
ok('projeto com caminho relativo é recusado', (await post('/api/projetos', { projetos: [...projetos0, { nome: 'x', caminho: 'relativo\\pasta' }] })).s === 400);
{ await post('/api/projetos', { projetos: [...projetos0, { nome: 'fantasma', caminho: 'C:\\pasta\\que-nao-existe-xyz' }] });
  const l = (await get('/api/projetos')).j.projetos; ok('pasta que não existe aparece como "não encontrada"', l.find((p) => p.nome === 'fantasma')?.existe === false);
  ok('a pasta de teste aparece vazia e existente', l.find((p) => /teste-estudio$/.test(p.caminho))?.existe === true && l.find((p) => /teste-estudio$/.test(p.caminho)).arquivos === 0);
  await post('/api/projetos', { projetos: projetos0 }); ok('lista de projetos restaurada', (await get('/api/projetos')).j.projetos.length === projetos0.length); }

// ---------- 9. rotinas
secao('Rotinas');
ok('hora inválida é recusada', (await post('/api/rotinas', { rotinas: [{ nome: 'x', texto: 'y', hora: '99:00', dias: [1] }] })).s === 400);
ok('rotina sem dia é recusada', (await post('/api/rotinas', { rotinas: [{ nome: 'x', texto: 'y', hora: '09:00', dias: [] }] })).s === 400);
ok('rodar rotina inexistente dá 404', (await post('/api/rotinas/rodar', { id: 'nao-existe' })).s === 404);
{ const r = await post('/api/rotinas', { rotinas: [...rotinas0, { nome: 'Bateria', texto: PEDIDO, hora: '03:33', dias: [0, 1, 2, 3, 4, 5, 6], ativa: false, ultima: 'forjado', resultado: 'forjado' }] });
  const nova = r.j?.rotinas.find((x) => x.nome === 'Bateria'); ok('rotina criada, e a tela não consegue forjar a "última vez"', !!nova && nova.ultima === null && nova.resultado === '', JSON.stringify(nova));
  await post('/api/nova');
  ok('rodar agora aceita (202)', (await post('/api/rotinas/rodar', { id: nova.id })).s === 202);
  await dormir(800); ok('rotina rodando ocupa o time', (await config()).rodando === true);
  ok('a rotina termina', await esperarParar());
  await dormir(500);
  const depois = (await get('/api/rotinas')).j.rotinas.find((x) => x.id === nova.id); ok('a rotina registra quando rodou e o resultado', depois?.resultado === 'aprovada' && !!depois.ultima, JSON.stringify(depois));
  ok('a conversa mostra que foi uma rotina', (await eventos()).some((e) => e.tipo === 'rotina' && e.nome === 'Bateria' && e.manual === true));
  await post('/api/decidir', { acao: 'descartar' });
  const v = await post('/api/rotinas', { rotinas: rotinas0 }); ok('rotinas restauradas', v.j?.rotinas.length === rotinas0.length && v.j.rotinas.every((x, i) => x.ultima === rotinas0[i].ultima && x.ativa === rotinas0[i].ativa)); }
ok('pasta vazia depois da rotina', await vazia(PROJETO));

// ---------- 10. memória
secao('Memória dos agentes');
{ const antes = (await get('/api/memoria?projeto=' + encodeURIComponent(PROJETO))).j.notas;
  ok('a reprovação do revisor virou nota do Catraca', (antes.catraca || []).some((n) => /O revisor já reprovou/.test(n)), JSON.stringify(antes.catraca));
  ok('a mesma reprovação em vários pedidos não duplicou a nota', (antes.catraca || []).filter((n) => /Cache-Control/.test(n)).length === 1, JSON.stringify(antes.catraca));
  const g = await post('/api/memoria', { projeto: PROJETO, agente: 'vitral', notas: ['  nota de teste  ', 'NOTA DE TESTE', ''] }); ok('gravar notas limpa espaços e repetidas', JSON.stringify(g.j?.notas) === '["nota de teste"]', JSON.stringify(g.j));
  ok('id de agente malicioso é recusado', (await post('/api/memoria', { projeto: PROJETO, agente: '../../fora', notas: ['x'] })).s === 400);
  await post('/api/memoria', { projeto: PROJETO, agente: 'vitral', notas: antes.vitral || [] });
  ok('memória do Vitral restaurada', JSON.stringify((await get('/api/memoria?projeto=' + encodeURIComponent(PROJETO))).j.notas.vitral) === JSON.stringify(antes.vitral || []));
  ok('a memória fica fora da pasta do projeto', await vazia(PROJETO)); }

// ---------- 11. provedores e modelo por agente
secao('Modelos e provedores');
{ const l = (await get('/api/provedores')).j.provedores; ok('lista de provedores com situação', l.length >= 2 && l.every((p) => typeof p.pronto === 'boolean' && p.motivo !== undefined), JSON.stringify(l.map((p) => p.nome)));
  ok('demonstração está pronta e em uso por todos', l.find((p) => p.nome === 'demo')?.pronto === true && l.find((p) => p.nome === 'demo').agentes === c0.agentes.length);
  const naoPronto = l.find((p) => !p.pronto); if (naoPronto) { const r = await post('/api/provedores/usar', { nome: naoPronto.nome }); ok(`provedor não pronto (${naoPronto.nome}) é recusado, com o motivo`, r.s === 400 && r.j.erro.includes(naoPronto.motivo), JSON.stringify(r.j)); }
  ok('provedor inexistente dá 404', (await post('/api/provedores/usar', { nome: 'nao-existe' })).s === 404);
  ok('depois das recusas, o time segue em demonstração', (await config()).agentes.every((a) => a.provedor === 'demo')); }
{ const cc = await config(); const papel = Object.fromEntries(cc.agentes.map((a) => [a.id, a.nivelPadrao]));
  ok('modelo padrão por papel: líder comum, revisor difícil, consulta simples, executor livre', papel.batuta === 'media' && papel.revisor === 'alta' && papel.farol === 'baixa' && papel.catraca === '' && papel.vitral === '', JSON.stringify(papel));
  ok('escolher modelo de um agente', (await post('/api/agentes/nivel', { id: 'catraca', nivel: 'alta' })).s === 200 && (await config()).agentes.find((a) => a.id === 'catraca').complexidade === 'alta');
  ok('a escolha fica salva', (await get('/api/preferencias')).j.preferencias.niveis.catraca === 'alta');
  ok('nível inválido é recusado', (await post('/api/agentes/nivel', { id: 'catraca', nivel: 'enorme' })).s === 400);
  ok('agente inexistente é recusado', (await post('/api/agentes/nivel', { id: 'fantasma', nivel: 'alta' })).s === 400);
  await post('/api/nova'); await post('/api/pedido', { texto: PEDIDO, projeto: PROJETO }); await esperarParar();
  const ev = await eventos(); const plano = ev.find((e) => e.tipo === 'plano');
  ok('o agente usa o modelo escolhido, não o que o líder classificou', plano?.etapas.find((s) => s.agente === 'catraca')?.complexidade === 'alta' && ev.find((e) => e.tipo === 'concluiu' && e.agente === 'catraca')?.modelo === 'fable (simulado)', JSON.stringify(plano?.etapas));
  ok('o líder planeja no modelo comum', ev.find((e) => e.tipo === 'status' && e.agente === 'batuta' && e.modelo)?.modelo === 'sonnet (simulado)');
  await post('/api/decidir', { acao: 'descartar' });
  ok('voltar ao padrão do papel', (await post('/api/agentes/nivel', { id: 'catraca', nivel: '' })).s === 200 && (await config()).agentes.find((a) => a.id === 'catraca').complexidade === '' && (await get('/api/preferencias')).j.preferencias.niveis.catraca === undefined); }

// ---------- 12. Buzina
secao('Buzina');
ok('sugestões de perguntas', (await get('/api/buzina')).j?.sugestoes.length === 4);
ok('pergunta vazia é recusada', (await post('/api/buzina', { pergunta: '  ' })).s === 400);
{ const temas = [['Como começo?', /Pasta do projeto/], ['O que são rotinas?', /Rotina é um pedido/], ['Como uso IA de verdade?', /Modelos do time/], ['Como monto um time?', /Construtor de times/], ['posso desfazer o que o time escreveu?', /Descartar/], ['quem é você?', /Buzina/]];
  for (const [p, re] of temas) { const r = await post('/api/buzina', { pergunta: p }); ok(`responde "${p}"`, r.s === 200 && re.test(r.j?.texto || '') && r.j.fonte === 'guia embutido', JSON.stringify(r.j).slice(0, 200)); }
  const fora = await post('/api/buzina', { pergunta: 'qual a capital da França?' }); ok('assunto de fora: admite que não sabe', /não sei responder/.test(fora.j?.texto || ''), JSON.stringify(fora.j).slice(0, 200));
  const longa = await post('/api/buzina', { pergunta: 'rotina '.repeat(500) }); ok('pergunta enorme não quebra', longa.s === 200); }

// ---------- anexos do pedido
secao('Anexos');
{ const BARRA = String.fromCharCode(92);   // barra invertida, como o Windows manda
  const b64 = (t) => Buffer.from(t).toString('base64');
  const an = (arquivos, projeto = PROJETO) => post('/api/anexos', { projeto, arquivos });
  const r = await an([{ caminho: 'nota.txt', dados: b64('olá, time') }, { caminho: `pasta${BARRA}sub/dados.json`, dados: b64('{"a":1}') }]);
  ok('grava arquivo e pasta em anexos/', r.s === 200 && r.j.salvos.join() === 'anexos/nota.txt,anexos/pasta/sub/dados.json', JSON.stringify(r.j));
  ok('conteúdo gravado é o enviado', (await fs.readFile(path.join(PROJETO, 'anexos', 'nota.txt'), 'utf8')) === 'olá, time' && (await fs.readFile(path.join(PROJETO, 'anexos', 'pasta', 'sub', 'dados.json'), 'utf8')) === '{"a":1}');
  const antes = (await fs.readdir(path.dirname(PROJETO))).sort().join();
  for (const ruim of ['../../fora.txt', `..${BARRA}..${BARRA}fora.txt`, 'x/.env', 'a/node_modules/b.js', 'p/.git/config', '']) { const x = await an([{ caminho: ruim, dados: b64('x') }]); ok(`recusa caminho "${ruim}"`, x.s === 400 && !!x.j?.erro, JSON.stringify(x.j)); }
  ok('nada foi escrito fora da pasta do projeto', (await fs.readdir(path.dirname(PROJETO))).sort().join() === antes);
  const misto = await an([{ caminho: 'bom.txt', dados: b64('x') }, { caminho: '../ruim.txt', dados: b64('x') }]);
  ok('um caminho ruim recusa o lote inteiro', misto.s === 400 && !(await fs.stat(path.join(PROJETO, 'anexos', 'bom.txt')).catch(() => null)));
  ok('lista vazia é recusada', (await an([])).s === 400);
  ok('pasta de projeto que não existe é recusada', (await an([{ caminho: 'a.txt', dados: b64('x') }], path.join(PROJETO, 'nao-existe-123'))).s === 400);
  ok('mais de 300 arquivos é recusado', (await an(Array.from({ length: 301 }, (_, i) => ({ caminho: `f${i}.txt`, dados: b64('x') })))).s === 400);
  const grande = await an([{ caminho: 'grande.bin', dados: Buffer.alloc(8 * 1048576 + 1).toString('base64') }]);
  ok('arquivo acima de 8 MB é recusado', grande.s === 400 && /8 MB/.test(grande.j?.erro || ''), JSON.stringify(grande.j));
  ok('anexos não são servidos pela web', (await get('/anexos/nota.txt')).s === 404);
  await fs.rm(path.join(PROJETO, 'anexos'), { recursive: true, force: true }); }

// ---------- histórico e limites de tempo
secao('Histórico e limites');
{ const h = (await get('/api/conversas')).j;
  ok('histórico lista as conversas guardadas', Array.isArray(h?.conversas) && h.conversas.every((c) => c.id && c.quando && typeof c.titulo === 'string'), JSON.stringify(h).slice(0, 200));
  ok('a bateria deixou conversas no histórico', h.conversas.length >= 1, 'nenhuma conversa guardada');
  if (h.conversas[0]) { const c = (await get('/api/conversas/' + h.conversas[0].id)).j; ok('uma conversa abre com os acontecimentos, sem o diff linha a linha', Array.isArray(c?.eventos) && c.eventos.some((e) => e.tipo === 'pedido') && c.eventos.filter((e) => e.tipo === 'diff').every((e) => e.arquivos.every((a) => a.linhas === undefined))); }
  ok('conversa que não existe dá 404', (await get('/api/conversas/20000101000000-zzzz')).s === 404);
  const pr = (await get('/api/preferencias')).j.preferencias;
  ok('preferências trazem os dois limites de tempo', pr.limiteAgenteMin >= 1 && pr.limiteTestesMin >= 1, JSON.stringify(pr));
  const mudou = await post('/api/preferencias', { preferencias: { limiteAgenteMin: 9999, limiteTestesMin: 0 } });
  ok('limites fora da faixa são ajustados', mudou.j?.preferencias?.limiteAgenteMin === 180 && mudou.j?.preferencias?.limiteTestesMin === 1, JSON.stringify(mudou.j?.preferencias));
  await post('/api/preferencias', { preferencias: prefs0 }); }

// ---------- conversas abertas e isolamento dos testes
secao('Conversas abertas e isolamento');
{ const de = (id) => ({ 'x-muvuca-conversa': id });
  const lista = async () => (await get('/api/sessoes')).j;
  const ini = await lista();
  ok('a principal existe sempre', ini.conversas.some((c) => c.id === '1') && ini.maximo >= 2, JSON.stringify(ini));
  const abriu = await post('/api/sessoes', { acao: 'abrir' });
  const id = abriu.j?.id;
  ok('abre outra conversa', abriu.s === 200 && /^[2-9]$/.test(id || ''), JSON.stringify(abriu.j));
  const cfg2 = await (await fetch(BASE + '/api/config', { headers: de(id) })).json();
  ok('a conversa nova tem o próprio time, parado', Array.isArray(cfg2.agentes) && cfg2.agentes.length >= 1 && cfg2.rodando === false);
  const ev2 = await fetch(BASE + '/api/eventos?conversa=' + id); const leitor = ev2.body.getReader(); const pedaco = new TextDecoder().decode((await leitor.read()).value || new Uint8Array()); leitor.cancel().catch(() => {});
  ok('o fluxo de eventos dela começa vazio', /"tipo":"ola"/.test(pedaco) && !/"tipo":"pedido"/.test(pedaco), pedaco.slice(0, 200));
  ok('conversa que não está aberta é recusada (404)', (await fetch(BASE + '/api/config', { headers: de('9') })).status === 404);
  ok('a principal não fecha', (await post('/api/sessoes', { acao: 'fechar', id: '1' })).s === 400);
  ok('ação desconhecida é recusada', (await post('/api/sessoes', { acao: 'explodir' })).s === 400);
  const fechou = await post('/api/sessoes', { acao: 'fechar', id });
  ok('fecha a conversa que abriu', fechou.s === 200 && !(await lista()).conversas.some((c) => c.id === id), JSON.stringify(fechou.j));
  const pr = (await get('/api/preferencias')).j;
  ok('preferências dizem se o isolamento dos testes está disponível', typeof pr.isolamento?.disponivel === 'boolean' && typeof pr.preferencias.isolarTestes === 'boolean', JSON.stringify(pr.isolamento));
  if (pr.isolamento?.disponivel && pr.preferencias.isolarTestes) {
    // conversa gravada no histórico por uma versão anterior não traz o campo: essas ficam de fora da conta
    const portoes = (await eventosGuardados()).filter((e) => e.tipo === 'portao' && e.isolado !== undefined);
    ok('os testes do portão rodaram isolados', portoes.length >= 1 && portoes.every((p) => p.isolado === true), JSON.stringify(portoes.map((p) => [p.isolado, p.semIsolamento])));
  } }

// ---------- conexões (servidores MCP)
secao('Conexões');
{ const c0x = (await get('/api/conexoes')).j;
  const guardadas = { conexoes: c0x.conexoes.map(({ faltam, ...c }) => c), agentes: c0x.agentes };
  const falso = path.join(AQUI, 'test', 'apoio', 'mcp-falso.js');
  const cofre = { nome: 'Cofre da bateria', descricao: 'guarda a senha do dia', comando: `"${process.execPath}" "${falso}"` };
  ok('lista traz conexões, ligações e o time', Array.isArray(c0x.conexoes) && typeof c0x.agentes === 'object' && c0x.time.length === c0.agentes.length);
  ok('em demonstração ninguém usa conexão, e a tela diz por quê', c0x.time.every((a) => a.pode === false && a.motivo.length > 10), JSON.stringify(c0x.time.map((a) => a.motivo)));
  const t = await post('/api/conexoes/testar', { conexao: cofre });
  ok('testar antes de criar lista as ferramentas do servidor', t.s === 200 && t.j.ok === true && t.j.ferramentas.map((f) => f.nome).join() === 'senha_do_dia,eco', JSON.stringify(t.j));
  ok('nada é gravado por um teste', (await get('/api/conexoes')).j.conexoes.length === c0x.conexoes.length);
  const ruim = await post('/api/conexoes/testar', { conexao: { nome: 'Nada', comando: 'comando-que-nao-existe-xyz' } });
  ok('comando que não existe: o teste explica', ruim.s === 200 && ruim.j.ok === false && /não encontrado/.test(ruim.j.erro), JSON.stringify(ruim.j));
  ok('testar conexão que não existe dá 404', (await post('/api/conexoes/testar', { id: 'nao_existe_xyz' })).s === 404);
  for (const [nome, c, re] of [['sem nome', { comando: 'node x' }, /nome/], ['sem comando', { nome: 'A' }, /comando/], ['endereço que não é http', { nome: 'A', tipo: 'http', url: 'ftp://x.com' }, /http/],
    ['senha no endereço', { nome: 'A', tipo: 'http', url: 'https://u:senha@x.com/mcp' }, /usuário e senha/], ['valor de token no lugar do nome', { nome: 'A', comando: 'node x', variaveis: 'TOKEN=abc' }, /só o nome/]]) {
    const r = await post('/api/conexoes', { conexoes: [...guardadas.conexoes, c] }); ok(`recusa conexão: ${nome}`, r.s === 400 && re.test(r.j?.erro || ''), JSON.stringify(r.j)); }
  ok('recusa não grava nada', (await get('/api/conexoes')).j.conexoes.length === c0x.conexoes.length);
  const criada = await post('/api/conexoes', { conexoes: [...guardadas.conexoes, cofre], agentes: { ...guardadas.agentes, [c0.agentes.find((a) => !a.ferramentas?.includes('escrever'))?.id || 'farol']: ['cofre_da_bateria', 'nao_existe'] } });
  const nova = criada.j?.conexoes?.find((c) => c.id === 'cofre_da_bateria');
  ok('cria a conexão com identificador tirado do nome', criada.s === 200 && !!nova && nova.args.length === 1 && nova.faltam.length === 0, JSON.stringify(criada.j).slice(0, 300));
  ok('ligação só guarda conexões que existem', Object.values(criada.j?.agentes || {}).flat().includes('cofre_da_bateria') && !Object.values(criada.j?.agentes || {}).flat().includes('nao_existe'));
  ok('testar pelo identificador', (await post('/api/conexoes/testar', { id: 'cofre_da_bateria' })).j?.ok === true);
  ok('conexões ficam na pasta de dados', await fs.stat(path.join(DADOS, 'conexoes.json')).then(() => true, () => false));
  const comVar = await post('/api/conexoes', { conexoes: [...guardadas.conexoes, { nome: 'Com chave', comando: 'node x', variaveis: 'VARIAVEL_QUE_NAO_EXISTE_NA_BATERIA' }] });
  ok('variável de ambiente que falta aparece na lista', comVar.j?.conexoes?.find((c) => c.id === 'com_chave')?.faltam.join() === 'VARIAVEL_QUE_NAO_EXISTE_NA_BATERIA', JSON.stringify(comVar.j).slice(0, 300));
  ok('teste com variável faltando explica', /falta definir a variável/.test((await post('/api/conexoes/testar', { id: 'com_chave' })).j?.erro || ''));
  ok('arquivo de conexões não é servido pela web', (await get('/conexoes.json')).s === 404 && (await get('/.mcp/farol.json')).s === 404);
  const volta = await post('/api/conexoes', guardadas);
  ok('conexões voltam ao estado do começo', volta.s === 200 && JSON.stringify(volta.j.conexoes.map(({ faltam, ...c }) => c)) === JSON.stringify(guardadas.conexoes) && JSON.stringify(volta.j.agentes) === JSON.stringify(guardadas.agentes)); }

// ---------- lições do time, vigias e especificação em etapas
secao('Lições, vigias e especificação em etapas');
{ const mem = async () => (await get('/api/memoria?projeto=' + encodeURIComponent(PROJETO))).j;
  const licoes0 = (await mem()).licoes || [];
  const g = await post('/api/memoria', { projeto: PROJETO, agente: 'time', notas: [...licoes0, '  lição da bateria  ', 'LIÇÃO DA BATERIA'] });
  ok('lição do time é gravada limpa e sem repetir', g.s === 200 && (await mem()).licoes.filter((n) => /lição da bateria/i.test(n)).length === 1, JSON.stringify(g.j));

  // vigia: só roda o comando; quem decide chamar o time é a condição
  ok('vigia sem comando é recusado', (await post('/api/rotinas', { rotinas: [{ tipo: 'vigia', nome: 'x', texto: 'y', comando: '', intervaloMin: 5, dispara: 'falha' }] })).s === 400);
  const criar = await post('/api/rotinas', { rotinas: [...rotinas0,
    { tipo: 'vigia', nome: 'Vigia que passa', texto: 'conserte', comando: 'node -e "process.exit(0)"', intervaloMin: 60, dispara: 'falha', ativa: false },
    { tipo: 'vigia', nome: 'Vigia que falha', texto: 'conserte', comando: 'node -e "process.exit(3)"', intervaloMin: 60, dispara: 'falha', ativa: false }] });
  const passa = criar.j?.rotinas.find((x) => x.nome === 'Vigia que passa'); const falha = criar.j?.rotinas.find((x) => x.nome === 'Vigia que falha');
  ok('vigias criados', !!passa && !!falha && passa.tipo === 'vigia', JSON.stringify(criar.j).slice(0, 300));
  const v1 = await post('/api/rotinas/verificar', { id: passa?.id }); ok('comando que passa não chama o time', v1.s === 200 && v1.j.ok === true && v1.j.dispararia === false, JSON.stringify(v1.j).slice(0, 200));
  const v2 = await post('/api/rotinas/verificar', { id: falha?.id }); ok('comando que falha chamaria o time', v2.s === 200 && v2.j.ok === false && v2.j.dispararia === true, JSON.stringify(v2.j).slice(0, 200));
  ok('verificar o que não é vigia dá 404', (await post('/api/rotinas/verificar', { id: 'nao-existe' })).s === 404);
  ok('verificar não ocupou o time', (await config()).rodando === false);
  const v = await post('/api/rotinas', { rotinas: rotinas0 }); ok('rotinas restauradas depois dos vigias', v.j?.rotinas.length === rotinas0.length);

  // especificação em etapas, do começo ao fim
  await post('/api/nova');
  ok('especificação curta demais é recusada', (await post('/api/especificacao', { texto: 'curta', projeto: PROJETO })).s === 400);
  ok('ação sem especificação dá 404', (await post('/api/especificacao/acao', { acao: 'pausar' })).s === 404);
  const e = await post('/api/especificacao', { texto: 'Página de status da bateria\n- Crie a rota /health com teste\n- Crie a página de status que consulta a rota', projeto: PROJETO });
  ok('especificação aceita (202)', e.s === 202 && e.j?.especificacao?.estado === 'planejando', JSON.stringify(e.j).slice(0, 200));
  ok('segunda especificação na mesma conversa é recusada', [409].includes((await post('/api/especificacao', { texto: 'Outra especificação qualquer, bem comprida', projeto: PROJETO })).s));
  let run = null; const fim = Date.now() + 180000;
  while (Date.now() < fim) { run = (await get('/api/especificacao')).j.especificacao; if (run && ['concluida', 'pausada', 'cancelada'].includes(run.estado)) break; await dormir(700); }
  ok('a especificação conclui as duas etapas', run?.estado === 'concluida' && run.etapas.length === 2 && run.etapas.every((x) => x.estado === 'pronta'), JSON.stringify(run).slice(0, 300));
  ok('a conversa recebeu o andamento', (await eventos()).some((x) => x.tipo === 'espec'));
  ok('tirar da tela antes de decidir funciona', (await post('/api/especificacao/acao', { acao: 'fechar' })).s === 200 && (await get('/api/especificacao')).j.especificacao === null);
  await esperarParar();
  const d = await post('/api/decidir', { acao: 'descartar', motivo: 'motivo da bateria' });
  ok('descartar com motivo vira lição do time', d.s === 200 && (await mem()).licoes.some((n) => /motivo da bateria/.test(n)), JSON.stringify((await mem()).licoes));
  await post('/api/memoria', { projeto: PROJETO, agente: 'time', notas: licoes0 });
  ok('lições restauradas', JSON.stringify((await mem()).licoes || []) === JSON.stringify(licoes0));
  ok('pasta vazia depois da especificação', await vazia(PROJETO)); }

// ---------- fim: estado igual ao do começo
secao('Estado final');
await post('/api/nova');
{ const cf = await config();
  ok('mesmo time do começo', cf.agentes.map((a) => `${a.id}:${a.provedor}:${a.complexidade}`).join() === c0.agentes.map((a) => `${a.id}:${a.provedor}:${a.complexidade}`).join() && cf.arquitetura === c0.arquitetura);
  ok('ninguém trabalhando, nada pendente', !cf.rodando && !(await eventos())[0].pendente);
  ok('preferências iguais às do começo', JSON.stringify((await get('/api/preferencias')).j.preferencias) === JSON.stringify(prefs0));
  ok('pasta de teste vazia', await vazia(PROJETO)); }

const falhas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length} verificações: ${resultados.length - falhas.length} passaram, ${falhas.length} falharam.`);
for (const f of falhas) console.log(`  ✗ [${f.grupo}] ${f.nome}${f.detalhe ? ' -> ' + f.detalhe : ''}`);
await fs.writeFile(path.join(AQUI, 'scripts', 'bateria-resultado.json'), JSON.stringify({ quando: new Date().toISOString(), total: resultados.length, falhas: falhas.length, resultados }, null, 2));
process.exit(falhas.length ? 1 : 0);
