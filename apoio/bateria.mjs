// Bateria ao vivo: exercita o servidor ligado, rota por rota, em modo demonstração.
// Uso (com a Muvuca rodando):  node apoio/bateria.mjs
// Só trabalha na pasta padrão (que precisa terminar em "teste-estudio") e devolve tudo ao estado inicial no fim.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.MUVUCA_URL || 'http://localhost:4317';
const AQUI = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const resultados = [];
let grupo = '';
const ok = (nome, cond, detalhe = '') => { resultados.push({ grupo, nome, ok: !!cond, detalhe: cond ? '' : String(detalhe).slice(0, 300) }); if (!cond) console.log(`  FALHOU [${grupo}] ${nome} ${detalhe ? '-> ' + String(detalhe).slice(0, 300) : ''}`); };
const secao = (g) => { grupo = g; console.log('• ' + g); };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const get = async (u) => { const r = await fetch(BASE + u); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* não é JSON */ } return { s: r.status, j, t, tipo: r.headers.get('content-type') || '' }; };
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
ok('imagem que não existe dá 404', (await get('/bonecos/nada-nada.webp')).s === 404);
ok('caminho fora da pasta de imagens não é servido', (await get('/bonecos/..%2F..%2Fservidor.js')).s === 404 && (await get('/bonecos/../servidor.js')).s === 404);
ok('arquivo do servidor não é servido', (await get('/servidor.js')).s === 404 && (await get('/agentes.local.json')).s === 404 && (await get('/preferencias.json')).s === 404);
ok('rota desconhecida dá 404', (await get('/api/nao-existe')).s === 404);

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
{ await post('/api/pedido', { texto: 'Explique o que você faz', projeto: PROJETO, para: 'scout' }); await esperarParar();
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
  ok('a reprovação do revisor virou nota do Chevron', (antes.chevron || []).some((n) => /O revisor já reprovou/.test(n)), JSON.stringify(antes.chevron));
  ok('a mesma reprovação em vários pedidos não duplicou a nota', (antes.chevron || []).filter((n) => /Cache-Control/.test(n)).length === 1, JSON.stringify(antes.chevron));
  const g = await post('/api/memoria', { projeto: PROJETO, agente: 'pixel', notas: ['  nota de teste  ', 'NOTA DE TESTE', ''] }); ok('gravar notas limpa espaços e repetidas', JSON.stringify(g.j?.notas) === '["nota de teste"]', JSON.stringify(g.j));
  ok('id de agente malicioso é recusado', (await post('/api/memoria', { projeto: PROJETO, agente: '../../fora', notas: ['x'] })).s === 400);
  await post('/api/memoria', { projeto: PROJETO, agente: 'pixel', notas: antes.pixel || [] });
  ok('memória do Pixel restaurada', JSON.stringify((await get('/api/memoria?projeto=' + encodeURIComponent(PROJETO))).j.notas.pixel) === JSON.stringify(antes.pixel || []));
  ok('a memória fica fora da pasta do projeto', await vazia(PROJETO)); }

// ---------- 11. provedores e modelo por agente
secao('Modelos e provedores');
{ const l = (await get('/api/provedores')).j.provedores; ok('lista de provedores com situação', l.length >= 2 && l.every((p) => typeof p.pronto === 'boolean' && p.motivo !== undefined), JSON.stringify(l.map((p) => p.nome)));
  ok('demonstração está pronta e em uso por todos', l.find((p) => p.nome === 'demo')?.pronto === true && l.find((p) => p.nome === 'demo').agentes === c0.agentes.length);
  const naoPronto = l.find((p) => !p.pronto); if (naoPronto) { const r = await post('/api/provedores/usar', { nome: naoPronto.nome }); ok(`provedor não pronto (${naoPronto.nome}) é recusado, com o motivo`, r.s === 400 && r.j.erro.includes(naoPronto.motivo), JSON.stringify(r.j)); }
  ok('provedor inexistente dá 404', (await post('/api/provedores/usar', { nome: 'nao-existe' })).s === 404);
  ok('depois das recusas, o time segue em demonstração', (await config()).agentes.every((a) => a.provedor === 'demo')); }
{ const cc = await config(); const papel = Object.fromEntries(cc.agentes.map((a) => [a.id, a.nivelPadrao]));
  ok('modelo padrão por papel: líder comum, revisor difícil, consulta simples, executor livre', papel.maestro === 'media' && papel.revisor === 'alta' && papel.scout === 'baixa' && papel.chevron === '' && papel.pixel === '', JSON.stringify(papel));
  ok('escolher modelo de um agente', (await post('/api/agentes/nivel', { id: 'chevron', nivel: 'alta' })).s === 200 && (await config()).agentes.find((a) => a.id === 'chevron').complexidade === 'alta');
  ok('a escolha fica salva', (await get('/api/preferencias')).j.preferencias.niveis.chevron === 'alta');
  ok('nível inválido é recusado', (await post('/api/agentes/nivel', { id: 'chevron', nivel: 'enorme' })).s === 400);
  ok('agente inexistente é recusado', (await post('/api/agentes/nivel', { id: 'fantasma', nivel: 'alta' })).s === 400);
  await post('/api/nova'); await post('/api/pedido', { texto: PEDIDO, projeto: PROJETO }); await esperarParar();
  const ev = await eventos(); const plano = ev.find((e) => e.tipo === 'plano');
  ok('o agente usa o modelo escolhido, não o que o líder classificou', plano?.etapas.find((s) => s.agente === 'chevron')?.complexidade === 'alta' && ev.find((e) => e.tipo === 'concluiu' && e.agente === 'chevron')?.modelo === 'fable (simulado)', JSON.stringify(plano?.etapas));
  ok('o líder planeja no modelo comum', ev.find((e) => e.tipo === 'status' && e.agente === 'maestro' && e.modelo)?.modelo === 'sonnet (simulado)');
  await post('/api/decidir', { acao: 'descartar' });
  ok('voltar ao padrão do papel', (await post('/api/agentes/nivel', { id: 'chevron', nivel: '' })).s === 200 && (await config()).agentes.find((a) => a.id === 'chevron').complexidade === '' && (await get('/api/preferencias')).j.preferencias.niveis.chevron === undefined); }

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
await fs.writeFile(path.join(AQUI, 'apoio', 'bateria-resultado.json'), JSON.stringify({ quando: new Date().toISOString(), total: resultados.length, falhas: falhas.length, resultados }, null, 2));
process.exit(falhas.length ? 1 : 0);
