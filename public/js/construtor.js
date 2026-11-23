// Construtor de times: galeria, editor, biblioteca, setas, borracha, desfazer.
import { compartilhado } from './estado.js';
import { depois } from './tardias.js';
import * as Regras from './regras/indice.js';
import { $, el, lerDoServidor, pedir } from './base.js';
import { mascote } from './personagens.js';
import { NOME_ARQ, NOME_FORMA, NOME_FUNCAO, SEM_LIDER, camadas, chefeDe, montarGrafo, ns, vizinhosDe } from './palco.js';

/* ---------- construtor de times ---------- */
const PALETA = ['#ff8e6b', '#4fb3ff', '#ffc94d', '#a48bff', '#4fe0a0', '#ff7bc8', '#5a8dff', '#63e6a3', '#ffb347'];
compartilhado.rascunho = null; compartilhado.galeria = []; compartilhado.catalogo = []; let tempoPrevia = 0; compartilhado.avisoTime = ''; let tempoDica = 0;
const copiaAgente = (a) => ({ id: a.id, nome: a.nome, funcao: a.funcao || '', papel: a.papel || '', chefe: a.chefe || '', ferramentas: [...(a.ferramentas || [])], cor: a.cor || '#8f7bff', forma: a.forma || 'pilha', provedor: a.provedor || '', modelo: a.modeloFixo ?? a.modelo ?? '', complexidade: a.complexidade || '', sistema: a.sistema || '', conexoes: Array.isArray(a.conexoes) ? [...a.conexoes] : null });
const timeAtual = () => ({ nome: compartilhado.nomeTime, descricao: '', arquitetura: compartilhado.arquitetura, agentes: compartilhado.agentes.map(copiaAgente) });
const EM_BRANCO = { nome: 'Time novo', arquitetura: 'centralizada', descricao: 'Começa com um líder, um executor e um revisor.', agentes: [
  { id: 'lider', nome: 'Líder', funcao: 'lider', papel: 'coordena o time e monta o plano', cor: '#ff8e6b', forma: 'regente' },
  { id: 'dev', nome: 'Dev', papel: 'implementa com teste junto', ferramentas: ['listar', 'ler', 'escrever', 'rodar'], cor: '#4fb3ff', forma: 'pilha' },
  { id: 'revisor', nome: 'Revisor', funcao: 'revisor', papel: 'revisão de código', ferramentas: ['listar', 'ler'], cor: '#4fe0a0', forma: 'escudo' }] };

async function abrirConstrutor() {
  depois.secao('construtor');
  try { const j = await lerDoServidor('/api/times'); compartilhado.galeria = j.times || []; compartilhado.catalogo = j.catalogo || []; } catch { compartilhado.galeria = []; }
  montarBiblioteca();
  montarGaleria();
  if (!compartilhado.rascunho) usarComoBase(timeAtual());
}
function montarGaleria() {
  const g = $('#galeria'); g.innerHTML = '';
  const cartao = (t, rotulo) => {
    const b = el('button', 'modelo-time'); b.type = 'button'; b.innerHTML = miniatura(t);
    b.append(el('span', 'arq', `${rotulo} · ${NOME_ARQ[t.arquitetura] || '?'}`), el('h3', '', t.nome), el('p', '', t.erro ? 'Com erro: ' + t.erro : t.descricao || ''));
    const pts = el('div', 'pontos'); for (const a of t.agentes || []) { const i = el('i'); i.style.setProperty('--c', a.cor); i.title = `${a.nome} (${NOME_FUNCAO[a.funcao || ''] || a.funcao})`; pts.append(i); }
    pts.append(el('small', '', `${(t.agentes || []).length} agentes`)); b.append(pts);
    if (t.erro) b.disabled = true; else b.onclick = () => { usarComoBase(t); g.querySelectorAll('.ativo').forEach((x) => x.classList.remove('ativo')); b.classList.add('ativo'); };
    g.append(b);
  };
  cartao(timeAtual(), 'No palco agora');
  const rotulos = { pronto: 'Pronto', salvo: 'Salvo por você', arquivo: 'Do arquivo' };
  for (const t of compartilhado.galeria) if (!(t.origem === 'arquivo' && t.nome === compartilhado.nomeTime)) cartao(t, rotulos[t.origem] || t.origem);
  cartao(EM_BRANCO, 'Do zero');
}
function usarComoBase(t) {
  compartilhado.rascunho = { nome: t.nome, descricao: t.descricao || '', arquitetura: t.arquitetura || 'centralizada', agentes: (t.agentes || []).map(copiaAgente) };
  $('#cErro').textContent = ''; montarEditor();
}
function montarEditor() {
  $('#cNome').value = compartilhado.rascunho.nome; $('#cArq').value = compartilhado.rascunho.arquitetura;
  $('#cArqDesc').textContent = compartilhado.arquiteturas[compartilhado.rascunho.arquitetura] || '';
  const box = $('#cAgentes'); const abertos = new Set([...box.querySelectorAll('details[open]')].map((d) => d.dataset.i));
  box.innerHTML = '';
  compartilhado.rascunho.agentes.forEach((a, i) => box.append(cartaoAgente(a, i, abertos.has(String(i)))));
  atualizarPrevia(true);
}
function campo(rotulo, entrada, largo) { const l = el('label', 'campo' + (largo ? ' largo' : '')); l.append(el('span', '', rotulo), entrada); return l; }
function opcoes(sel, pares, atual) { for (const [v, t] of pares) { const o = el('option', '', t); o.value = v; if (v === atual) o.selected = true; sel.append(o); } return sel; }
function cartaoAgente(a, i, aberto) {
  const arq = compartilhado.rascunho.arquitetura;
  const d = el('details', 'ag-cartao'); d.dataset.i = i; d.open = aberto; d.style.setProperty('--cor', a.cor);
  const s = el('summary'); const titulo = el('b', '', a.nome || '(sem nome)'); const fn = el('span', 'arq', NOME_FUNCAO[a.funcao] || a.funcao);
  const acoes = el('span', 'acoes');
  const botao = (txt, rot, f, off) => { const b = el('button', '', txt); b.type = 'button'; b.title = rot; b.setAttribute('aria-label', rot); b.disabled = !!off; b.onclick = (ev) => { ev.preventDefault(); ev.stopPropagation(); f(); }; return b; };
  acoes.append(
    botao('↑', 'Subir', () => { [compartilhado.rascunho.agentes[i - 1], compartilhado.rascunho.agentes[i]] = [compartilhado.rascunho.agentes[i], compartilhado.rascunho.agentes[i - 1]]; montarEditor(); }, i === 0),
    botao('↓', 'Descer', () => { [compartilhado.rascunho.agentes[i + 1], compartilhado.rascunho.agentes[i]] = [compartilhado.rascunho.agentes[i], compartilhado.rascunho.agentes[i + 1]]; montarEditor(); }, i === compartilhado.rascunho.agentes.length - 1),
    botao('✕', 'Remover agente', () => removerAgente(a.id)));
  s.append(el('i'), titulo, fn, acoes); d.append(s);

  const corpo = el('div', 'ag-campos');
  const muda = (f, refazer) => (ev) => { f(ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value); if (refazer) montarEditor(); else atualizarPrevia(); };
  const entrada = (v, f, extra = {}) => { const x = el(extra.tag || 'input'); if (extra.tipo) x.type = extra.tipo; x.value = v; if (extra.ph) x.placeholder = extra.ph; x.oninput = muda(f); return x; };

  corpo.append(campo('Nome', entrada(a.nome, (v) => { a.nome = v; titulo.textContent = v || '(sem nome)'; })));
  corpo.append(campo('Id (curto, sem espaço)', entrada(a.id, (v) => { const velho = a.id; a.id = v.trim().toLowerCase(); compartilhado.rascunho.agentes.forEach((x) => { if (x.chefe === velho) x.chefe = a.id; if (x.conexoes) x.conexoes = x.conexoes.map((c) => (c === velho ? a.id : c)); }); })));
  const funcoes = SEM_LIDER.includes(arq) ? ['', 'revisor'] : arq === 'centralizada' ? ['', 'lider', 'revisor'] : ['', 'lider', 'sublider', 'revisor'];
  const selF = opcoes(el('select'), funcoes.map((f) => [f, NOME_FUNCAO[f]]), a.funcao); selF.onchange = muda((v) => { a.funcao = v; if (v === 'lider' || v === 'sublider') a.forma = 'regente'; }, true);
  corpo.append(campo('Função', selF));
  if (arq === 'hierarquica' && a.funcao !== 'lider') {
    const chefes = compartilhado.rascunho.agentes.filter((x) => x !== a && (x.funcao === 'lider' || x.funcao === 'sublider'));
    const selC = opcoes(el('select'), [['', 'o líder'], ...chefes.map((x) => [x.id, x.nome])], a.chefe); selC.onchange = muda((v) => { a.chefe = v; });
    corpo.append(campo('Responde a', selC));
  } else corpo.append(el('span'));
  if (arq === 'rede' && a.funcao !== 'revisor') {
    const outros = compartilhado.rascunho.agentes.filter((x) => x !== a && x.funcao !== 'revisor');
    const cx = el('div', 'ferr');
    for (const o of outros) {
      const l = el('label'); const c = el('input'); c.type = 'checkbox';
      c.checked = !Array.isArray(a.conexoes) || a.conexoes.includes(o.id);
      c.onchange = muda((v) => { const atual = Array.isArray(a.conexoes) ? a.conexoes : outros.map((x) => x.id); a.conexoes = v ? [...new Set([...atual, o.id])] : atual.filter((x) => x !== o.id); });
      l.append(c, o.nome || o.id); cx.append(l);
    }
    if (!outros.length) cx.append(el('span', 'nota', 'Sozinho na rede: ninguém para passar a vez.'));
    corpo.append(campo(i === compartilhado.rascunho.agentes.findIndex((x) => x.funcao !== 'revisor') ? 'Pode passar a vez para (este começa a rede)' : 'Pode passar a vez para', cx, true));
  }
  corpo.append(campo('Papel (o que o líder lê para escolher)', entrada(a.papel, (v) => { a.papel = v; }), true));
  const selP = opcoes(el('select'), Object.entries(NOME_FORMA).filter(([k]) => k !== 'salsicha' || depois.buzinaSolta() || a.forma === 'salsicha'), a.forma); selP.onchange = muda((v) => { a.forma = v; });
  corpo.append(campo('Personagem', selP));
  corpo.append(campo('Cor', entrada(a.cor, (v) => { a.cor = v; d.style.setProperty('--cor', v); }, { tipo: 'color' })));
  const selV = opcoes(el('select'), [['', 'padrão do arquivo'], ...compartilhado.provedores.map((p) => [p.nome, `${p.nome} (${p.tipo})`])], a.provedor); selV.onchange = muda((v) => { a.provedor = v; }, true);
  corpo.append(campo('Provedor', selV));
  const prov = compartilhado.provedores.find((p) => p.nome === a.provedor) || compartilhado.provedores.find((p) => p.modelos) || compartilhado.provedores[0] || {};
  const dica = prov.modelos ? `pelo nível: ${['baixa', 'media', 'alta'].map((c) => prov.modelos[c]).filter(Boolean).join(' / ')}` : (prov.modelo || 'padrão do provedor');
  corpo.append(campo('Modelo fixo (vazio = automático)', entrada(a.modelo, (v) => { a.modelo = v; }, { ph: dica })));
  if (a.funcao !== 'lider' && a.funcao !== 'sublider') {
    const selN = opcoes(el('select'), [['', 'padrão do papel'], ['auto', 'automático'], ['baixa', 'baixa'], ['media', 'média'], ['alta', 'alta']], a.complexidade); selN.onchange = muda((v) => { a.complexidade = v; });
    corpo.append(campo('Nível', selN));
    const fe = el('div', 'ferr');
    for (const f of ['listar', 'ler', 'escrever', 'rodar']) {
      const l = el('label'); const c = el('input'); c.type = 'checkbox'; c.checked = a.ferramentas.includes(f);
      c.disabled = a.funcao === 'revisor' && (f === 'escrever' || f === 'rodar');
      c.onchange = muda((v) => { a.ferramentas = v ? [...new Set([...a.ferramentas, f])] : a.ferramentas.filter((x) => x !== f); });
      l.append(c, f); fe.append(l);
    }
    corpo.append(campo('Ferramentas', fe, true));
  } else corpo.append(el('p', 'nota largo', 'Líder e sub-líder não executam: planejam e delegam, sem ferramentas.'));
  corpo.append(campo('Instruções (prompt de sistema)', entrada(a.sistema, (v) => { a.sistema = v; }, { tag: 'textarea', ph: `Você é ${a.nome || 'o agente'}. Seu papel: ${a.papel || '...'}` }), true));
  d.append(corpo);
  return d;
}
// Avisos rápidos na tela; quem decide se o time é válido é o servidor (times.js).
function avisos(t) {
  const lista = [], com = (f) => t.agentes.filter((a) => a.funcao === f);
  const semLider = SEM_LIDER.includes(t.arquitetura);
  if (!semLider && com('lider').length !== 1) lista.push('O time precisa de exatamente um líder.');
  if (semLider && (com('lider').length || com('sublider').length)) lista.push(`Na arquitetura ${NOME_ARQ[t.arquitetura]} não há líder: troque por executor.`);
  if (t.arquitetura === 'unico' && t.agentes.filter((a) => a.funcao !== 'revisor').length !== 1) lista.push('O agente único tem exatamente um agente (mais o revisor, se quiser).');
  if (t.arquitetura === 'rede') for (const a of t.agentes) if (Array.isArray(a.conexoes) && !a.conexoes.length && a.funcao !== 'revisor') lista.push(`${a.nome} não passa a vez para ninguém: a rede para nele.`);
  if (!t.agentes.some((a) => !a.funcao && a.ferramentas.includes('escrever'))) lista.push('Falta um executor que possa escrever arquivos.');
  if (com('revisor').length > 1) lista.push('Só pode haver um revisor.');
  if (!com('revisor').length && t.arquitetura !== 'unico') lista.push('Sem revisor, o que passa nos testes é aceito sem revisão.');
  for (const s of com('sublider')) if (!t.agentes.some((a) => a.chefe === s.id && a.funcao !== 'revisor')) lista.push(`${s.nome} é sub-líder, mas ninguém responde a ele.`);
  const ids = t.agentes.map((a) => a.id); if (new Set(ids).size !== ids.length) lista.push('Há ids repetidos.');
  return lista;
}
function atualizarPrevia(ja) {
  clearTimeout(tempoPrevia);
  tempoPrevia = setTimeout(() => {
    const lista = compartilhado.rascunho.agentes.map((a, i) => ({ ...a, id: a.id || `sem-id-${i}` }));
    montarGrafo($('#previa'), lista, compartilhado.rascunho.arquitetura, 'p');
    prepararArrasto(); if (!$('#cDica').classList.contains('feito')) dica();   // não apaga a confirmação do último arrasto
    const av = avisos(compartilhado.rascunho); $('#cAvisos').textContent = av.join(' ');
    $('#cResumo').textContent = `${lista.length} agente(s), arquitetura ${NOME_ARQ[compartilhado.rascunho.arquitetura]}.`;
    registrarHistorico();
    if (!setaSel) estadoSetas();
  }, ja ? 0 : 150);
}
/* ---------- biblioteca e arrastar e soltar ---------- */
function montarBiblioteca() {
  const b = $('#biblioteca'); b.innerHTML = '';
  compartilhado.catalogo.filter((a) => !a.secreto || depois.buzinaSolta()).forEach((a, k) => {
    const p = el('button', 'peca' + (a.secreto ? ' secreta' : '')); p.type = 'button'; p.draggable = true; p.title = `${a.nome}: ${a.papel}`;
    p.innerHTML = mascote(a, k, 'b'); p.append(el('span', '', a.nome));
    p.ondragstart = (e) => { e.dataTransfer.setData('text/plain', 'catalogo:' + a.id); e.dataTransfer.effectAllowed = 'copy'; document.body.classList.add('arrastando'); };
    p.ondragend = () => document.body.classList.remove('arrastando');
    p.onclick = () => adicionarDoCatalogo(a.id);
    b.append(p);
  });
}
const DICAS = {
  centralizada: 'Arraste da biblioteca para a prévia: todo mundo responde ao líder. Arraste um agente sobre outro para trocar a ordem.',
  hierarquica: 'Solte da biblioteca sobre um líder ou sub-líder para pôr no time dele. Arraste um agente da prévia sobre outro líder para mudar de chefe.',
  sequencial: 'Arraste um agente sobre outro para mudar a ordem da esteira.',
  unico: 'Um agente só: arraste da biblioteca e remova o que sobrar.',
  rede: 'Solte da biblioteca sobre um agente para já ligar os dois. Arraste um agente sobre outro para ligar ou desligar a passagem de vez.',
};
function dica(texto) {
  clearTimeout(tempoDica);
  $('#cDica').textContent = texto || DICAS[compartilhado.rascunho?.arquitetura] || '';
  $('#cDica').classList.toggle('feito', !!texto);
  if (texto) tempoDica = setTimeout(() => dica(), 4500);
}
const achar = (id) => compartilhado.rascunho.agentes.find((a) => a.id === id);
function removerAgente(id) {
  compartilhado.rascunho.agentes = compartilhado.rascunho.agentes.filter((a) => a.id !== id);
  compartilhado.rascunho.agentes.forEach((x) => { if (x.chefe === id) x.chefe = ''; if (x.conexoes) x.conexoes = x.conexoes.filter((c) => c !== id); });
  montarEditor();
}
function adicionarDoCatalogo(cid, alvo) {
  const base = compartilhado.catalogo.find((x) => x.id === cid); if (!base || !compartilhado.rascunho) return;
  const novo = copiaAgente({ ...base, ferramentas: base.ferramentas || [] });
  let n = 1; while (compartilhado.rascunho.agentes.some((a) => a.id === (n === 1 ? base.id : `${base.id}-${n}`))) n++;
  if (n > 1) { novo.id = `${base.id}-${n}`; novo.nome = `${base.nome} ${n}`; }
  const arq = compartilhado.rascunho.arquitetura, temLider = compartilhado.rascunho.agentes.some((a) => a.funcao === 'lider');
  // a função se ajusta à arquitetura: esteira e rede não têm líder; o segundo líder vira sub-líder
  if (SEM_LIDER.includes(arq) && (novo.funcao === 'lider' || novo.funcao === 'sublider')) novo.funcao = '';
  if (novo.funcao === 'lider' && temLider) novo.funcao = arq === 'hierarquica' ? 'sublider' : '';
  if (novo.funcao === 'sublider' && arq !== 'hierarquica') novo.funcao = arq === 'centralizada' && !temLider ? 'lider' : '';
  if ((novo.funcao === 'lider' || novo.funcao === 'sublider')) novo.ferramentas = [];
  const b = alvo && achar(alvo);
  let msg = `${novo.nome} entrou no time.`;
  if (b && arq === 'hierarquica' && (b.funcao === 'lider' || b.funcao === 'sublider') && novo.funcao !== 'lider') { novo.chefe = b.id; msg = `${novo.nome} entrou no time de ${b.nome}.`; }
  if (b && arq === 'rede' && novo.funcao !== 'revisor' && b.funcao !== 'revisor') {
    novo.conexoes = [b.id];
    if (Array.isArray(b.conexoes)) b.conexoes = [...new Set([...b.conexoes, novo.id])];
    msg = `${novo.nome} entrou ligado a ${b.nome}.`;
  }
  // o revisor fica no fim; os outros entram antes dele
  const iRev = compartilhado.rascunho.agentes.findIndex((a) => a.funcao === 'revisor');
  compartilhado.rascunho.agentes.splice(novo.funcao !== 'revisor' && iRev >= 0 ? iRev : compartilhado.rascunho.agentes.length, 0, novo);
  montarEditor(); dica(msg);
}
function moverNo(src, alvo) {
  const a = achar(src), b = achar(alvo); if (!a || !b || a === b) return;
  const arq = compartilhado.rascunho.arquitetura;
  if (arq === 'hierarquica') {
    if (a.funcao === 'lider') return dica('O líder não responde a ninguém.');
    if (b.funcao !== 'lider' && b.funcao !== 'sublider') return dica('Solte sobre um líder ou sub-líder para mudar de chefe.');
    for (let x = b, k = 0; x && k < 12; x = achar(x.chefe), k++) if (x === a) return dica('Assim a chefia daria uma volta: escolha outro chefe.');
    a.chefe = b.funcao === 'lider' ? '' : b.id; montarEditor(); return dica(`${a.nome} agora responde a ${b.nome}.`);
  }
  if (arq === 'rede') {
    if (a.funcao === 'revisor' || b.funcao === 'revisor') return dica('O revisor fica fora da rede.');
    const todos = compartilhado.rascunho.agentes.filter((x) => x !== a && x.funcao !== 'revisor').map((x) => x.id);
    const atual = Array.isArray(a.conexoes) ? a.conexoes : todos, tinha = atual.includes(b.id);
    a.conexoes = tinha ? atual.filter((x) => x !== b.id) : [...atual, b.id];
    montarEditor(); return dica(`${a.nome} ${tinha ? 'não passa mais' : 'agora passa'} a vez para ${b.nome}.`);
  }
  const L = compartilhado.rascunho.agentes; L.splice(L.indexOf(a), 1); L.splice(L.indexOf(b), 0, a);
  montarEditor(); dica(`${a.nome} foi para antes de ${b.nome}.`);
}
/* ---------- desenhar setas na prévia ---------- */
// Com o modo ligado: clique num agente (origem) e depois em outro (destino) para criar a seta; clique numa seta para tirá-la.
// O que a seta significa depende da arquitetura: passar a vez (rede), chefiar (hierárquica) ou vir logo depois (esteira).
let modoSetas = false, origemSeta = null;
const DICAS_SETAS = {
  rede: 'Arraste de quem passa a vez até quem recebe (ou clique num e depois no outro). O × tira a seta.',
  hierarquica: 'Arraste do chefe até quem responde a ele. O × devolve o agente ao líder.',
  centralizada: 'No supervisor todos respondem ao líder. Arraste de um agente a outro para criar um sub-líder (vira hierárquica).',
  sequencial: 'Arraste de um agente até o que deve vir logo depois dele na esteira.',
  unico: 'Com um agente só não há setas. Adicione agentes ou troque a arquitetura.',
};
let modoBorracha = false;
function estadoSetas(texto) { $('#cSetasEstado').textContent = texto ?? (modoBorracha ? 'Borracha: clique numa seta ou num agente para apagar. Ctrl+Z desfaz.' : modoSetas ? DICAS_SETAS[compartilhado.rascunho?.arquitetura] || '' : ''); }
// Borracha: um clique apaga a seta ou tira o agente do time. Não convive com o modo de desenhar.
function ligarBorracha(liga) {
  if (liga && modoSetas) ligarModoSetas(false);
  modoBorracha = liga; setaSel = null;
  $('#cBorracha').setAttribute('aria-pressed', liga); $('#previa').classList.toggle('modo-borracha', liga);
  if (compartilhado.rascunho) { prepararArrasto(); marcarSetaSel(); }
  estadoSetas();
}
$('#cBorracha').onclick = () => ligarBorracha(!modoBorracha);
function ligarModoSetas(liga) {
  if (liga && modoBorracha) ligarBorracha(false);
  modoSetas = liga; origemSeta = null;
  $('#cSetas').setAttribute('aria-pressed', liga); $('#previa').classList.toggle('modo-setas', liga);
  $('#previa').querySelectorAll('.origem').forEach((x) => x.classList.remove('origem'));
  if (compartilhado.rascunho) prepararArrasto();   // com o modo ligado, clicar num agente começa uma seta em vez de abrir a ficha
  estadoSetas();
}
$('#cSetas').onclick = () => ligarModoSetas(!modoSetas);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modoBorracha && document.body.classList.contains('ver-construtor')) return ligarBorracha(false); if (e.key === 'Escape' && modoSetas && document.body.classList.contains('ver-construtor')) { if (origemSeta) { origemSeta = null; $('#previa').querySelectorAll('.origem').forEach((x) => x.classList.remove('origem')); estadoSetas(); } else ligarModoSetas(false); } });
// Arrastar de um agente até outro, com o modo ligado, desenha a seta: uma linha tracejada segue o ponteiro.
let arrastouSeta = false;
function comecarElastico(ev, no) {
  if (!modoSetas || ev.button !== 0) return;
  const prev = $('#previa'), svg = prev.querySelector('.arestas'), id = no.dataset.ag;
  const r = prev.getBoundingClientRect(), o = no.querySelector('.mascote').getBoundingClientRect();
  const x0 = o.left + o.width / 2 - r.left, y0 = o.top + o.height / 2 - r.top;
  let linha = null, moveu = false;
  const sobre = (e) => document.elementFromPoint(e.clientX, e.clientY)?.closest?.('#previa .agente');
  const limpar = () => { linha?.remove(); prev.querySelectorAll('.alvo, .origem').forEach((x) => x.classList.remove('alvo', 'origem')); };
  const mover = (e) => {
    if (!moveu && Math.hypot(e.clientX - ev.clientX, e.clientY - ev.clientY) < 7) return;
    if (!moveu) { moveu = true; origemSeta = null; limpar(); no.classList.add('origem'); linha = ns('path', { class: 'elastico' }); svg.append(linha); estadoSetas(`De ${achar(id)?.nome || id} para… solte em cima do destino.`); }
    linha.setAttribute('d', `M${x0} ${y0}L${e.clientX - r.left} ${e.clientY - r.top}`);
    prev.querySelectorAll('.alvo').forEach((x) => x.classList.remove('alvo'));
    const a = sobre(e); if (a && a !== no) a.classList.add('alvo');
  };
  const fim = (e) => {
    document.removeEventListener('pointermove', mover); document.removeEventListener('pointerup', fim); document.removeEventListener('pointercancel', fim);
    if (!moveu) return;   // foi só um clique: o fluxo de clicar na origem e depois no destino cuida
    arrastouSeta = true; setTimeout(() => { arrastouSeta = false; }, 0);
    const alvo = e.type === 'pointerup' ? sobre(e)?.dataset.ag : null;
    limpar();
    if (alvo && alvo !== id) ligarSeta(id, alvo); else estadoSetas();
  };
  document.addEventListener('pointermove', mover); document.addEventListener('pointerup', fim); document.addEventListener('pointercancel', fim);
}
function cliqueSeta(id) {
  if (!origemSeta) {
    origemSeta = id; $('#previa').querySelector(`.agente[data-ag="${CSS.escape(id)}"]`)?.classList.add('origem');
    return estadoSetas(`De ${achar(id)?.nome || id} para… clique no destino (Esc cancela).`);
  }
  const de = origemSeta; origemSeta = null;
  if (de === id) { $('#previa').querySelectorAll('.origem').forEach((x) => x.classList.remove('origem')); return estadoSetas(); }
  ligarSeta(de, id);
}
// cria a seta "de → para"
// As regras (o que cada seta quer dizer em cada arquitetura) ficam em js/regras/setas.js, com testes. Aqui, só a tela.
function ligarSeta(de, para) {
  const r = Regras.setas.ligarSeta(compartilhado.rascunho, de, para); if (!r) return;
  if (r.mudou) montarEditor(); else $('#previa').querySelectorAll('.origem').forEach((x) => x.classList.remove('origem'));
  dica(r.mensagem); estadoSetas();
}
// tira a seta "de → para"
function desligarSeta(de, para) {
  const r = Regras.setas.desligarSeta(compartilhado.rascunho, de, para); if (!r) return;
  if (!r.mudou) return dica(r.mensagem);
  montarEditor(); dica(r.mensagem); estadoSetas();
}
// seta selecionada (clique nela): fica destacada, mostra o "×" e a tecla Delete a tira
let setaSel = null;
function marcarSetaSel() {
  const igual = (e) => !!setaSel && e.dataset.de === setaSel.de && e.dataset.para === setaSel.para;
  let achou = false;
  $('#previa').querySelectorAll('.toque, .tira').forEach((e) => { const s2 = igual(e); e.classList.toggle('sel', s2); achou = achou || s2; });
  if (setaSel && !achou) setaSel = null;
}
function selecionarSeta(de, para) {
  setaSel = de ? { de, para } : null; marcarSetaSel();
  if (!setaSel) return estadoSetas();
  const podeTirar = !!$('#previa').querySelector('.tira.sel');
  estadoSetas(`Seta ${achar(de)?.nome || de} → ${achar(para)?.nome || para} selecionada. ` + (podeTirar ? 'Delete ou o × tira.' : 'Esta seta é da própria arquitetura e não sai.'));
}
$('#previa').addEventListener('click', (e) => {
  if (modoBorracha) { const t = e.target.closest?.('.tira, .toque'); if (t) { setaSel = null; desligarSeta(t.dataset.de, t.dataset.para); } return; }
  const x = e.target.closest?.('.tira'); if (x) { setaSel = null; return desligarSeta(x.dataset.de, x.dataset.para); }
  const t = e.target.closest?.('.toque'); if (t) return selecionarSeta(t.dataset.de, t.dataset.para);
  if (!e.target.closest?.('.agente') && setaSel) selecionarSeta(null);
});
$('#previa').addEventListener('keydown', (e) => { const x = e.target.closest?.('.tira'); if (x && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setaSel = null; desligarSeta(x.dataset.de, x.dataset.para); } });

/* ---------- desfazer e refazer no construtor ---------- */
// Cada mudança no rascunho (seta, agente, ordem, campo, modelo de time) vira um passo. A prévia redesenha depois de
// toda mudança, então é ali que o passo é registrado: comparo o rascunho com o último estado guardado.
// A pilha de estados fica em js/regras/historico.js, com testes. Aqui, só a tela.
let historico = null;
const oHistorico = () => (historico ||= Regras.criarHistorico(80));
function botoesHistorico() { $('#cDesfazer').disabled = !oHistorico().podeDesfazer; $('#cRefazer').disabled = !oHistorico().podeRefazer; }
function limparHistorico() { oHistorico().limpar(); botoesHistorico(); }
function registrarHistorico() {
  if (!compartilhado.rascunho) return;
  oHistorico().registrar(JSON.stringify(compartilhado.rascunho)); botoesHistorico();
}
function voltarHistorico(passo, feito, vazio2) {
  if (!compartilhado.rascunho) return;
  const estado = oHistorico()[passo](JSON.stringify(compartilhado.rascunho));
  if (estado === null) { botoesHistorico(); return dica(vazio2); }
  compartilhado.rascunho = JSON.parse(estado);
  setaSel = null; origemSeta = null; $('#cErro').textContent = '';
  montarEditor(); botoesHistorico(); dica(feito);
}
const desfazer = () => voltarHistorico('desfazer', 'Desfeito.', 'Nada para desfazer.');
const refazer = () => voltarHistorico('refazer', 'Refeito.', 'Nada para refazer.');
$('#cDesfazer').onclick = desfazer; $('#cRefazer').onclick = refazer;
document.addEventListener('keydown', (e) => {
  if (!compartilhado.rascunho || !document.body.classList.contains('ver-construtor')) return;
  if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;   // dentro de um campo, vale o desfazer do próprio campo
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && !e.altKey && k === 'z') { e.preventDefault(); return e.shiftKey ? refazer() : desfazer(); }
  if ((e.ctrlKey || e.metaKey) && !e.altKey && k === 'y') { e.preventDefault(); return refazer(); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && setaSel) { e.preventDefault(); const { de, para } = setaSel; setaSel = null; desligarSeta(de, para); }
});

function abrirCartao(id) {
  const i = compartilhado.rascunho.agentes.findIndex((a) => a.id === id); const d = $(`#cAgentes details[data-i="${i}"]`); if (!d) return;
  d.open = true; d.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function prepararArrasto() {
  $('#previa').querySelectorAll('.agente').forEach((d) => {
    d.draggable = !modoSetas && !modoBorracha; d.title = modoBorracha ? 'Clique para tirar do time' : modoSetas ? 'Clique para começar ou terminar uma seta' : 'Arraste sobre outro agente, ou clique para editar';
    d.ondragstart = (e) => { e.dataTransfer.setData('text/plain', 'no:' + d.dataset.ag); e.dataTransfer.effectAllowed = 'move'; document.body.classList.add('arrastando'); };
    d.ondragend = () => document.body.classList.remove('arrastando');
    d.onclick = () => {
      if (arrastouSeta) return;
      if (modoBorracha) { const a = achar(d.dataset.ag); removerAgente(d.dataset.ag); return dica(`${a?.nome || d.dataset.ag} saiu do time. Ctrl+Z traz de volta.`); }
      modoSetas ? cliqueSeta(d.dataset.ag) : abrirCartao(d.dataset.ag);
    };
    d.onpointerdown = (e) => comecarElastico(e, d);
  });
}
function soltar(e, alvo) {
  e.preventDefault(); document.body.classList.remove('arrastando');
  $('#previa').querySelectorAll('.alvo').forEach((x) => x.classList.remove('alvo'));
  const [tipo, id] = e.dataTransfer.getData('text/plain').split(':');
  if (alvo === 'lixeira') { if (tipo === 'no') { const a = achar(id); removerAgente(id); dica(`${a?.nome || id} saiu do time.`); } return; }
  const sobre = e.target.closest?.('.agente')?.dataset.ag;
  if (tipo === 'catalogo') adicionarDoCatalogo(id, sobre);
  else if (tipo === 'no' && sobre) moverNo(id, sobre);
}
$('#previa').addEventListener('dragover', (e) => {
  e.preventDefault();
  const sobre = e.target.closest('.agente');
  $('#previa').querySelectorAll('.alvo').forEach((x) => { if (x !== sobre) x.classList.remove('alvo'); });
  sobre?.classList.add('alvo');
});
$('#previa').addEventListener('dragleave', (e) => { if (!$('#previa').contains(e.relatedTarget)) $('#previa').querySelectorAll('.alvo').forEach((x) => x.classList.remove('alvo')); });
$('#previa').addEventListener('drop', (e) => soltar(e, 'previa'));
$('#lixeira').addEventListener('dragover', (e) => { e.preventDefault(); $('#lixeira').classList.add('alvo'); });
$('#lixeira').addEventListener('dragleave', () => $('#lixeira').classList.remove('alvo'));
$('#lixeira').addEventListener('drop', (e) => { $('#lixeira').classList.remove('alvo'); soltar(e, 'lixeira'); });

// Desenho da arquitetura para o cartão da galeria, tirado da estrutura real do time:
// ponto único, linha de pontos (esteira), estrela (supervisor), pirâmide (hierarquia), círculo (rede).
function miniatura(t) {
  const L = t.agentes || [], arq = t.arquitetura, P = new Map();
  const membros = L.filter((a) => a.funcao !== 'revisor'), rev = L.find((a) => a.funcao === 'revisor');
  if (arq === 'rede') {
    const n = membros.length;
    membros.forEach((a, i) => { const g = -Math.PI / 2 + (i * 2 * Math.PI) / n; P.set(a.id, [100 + Math.cos(g) * (n > 1 ? 40 : 0), 34 + Math.sin(g) * (n > 1 ? 24 : 0)]); });
    if (rev) P.set(rev.id, [172, 56]);
  } else if (arq === 'sequencial' || arq === 'unico') {
    const fila = camadas(L, 'sequencial')[0] || [];
    fila.forEach((a, i) => P.set(a.id, [fila.length === 1 ? 100 : 26 + (i * 148) / (fila.length - 1), 35]));
  } else if (arq === 'centralizada') {
    const lider = L.find((a) => a.funcao === 'lider') || L[0], outros = L.filter((a) => a !== lider);
    if (lider) P.set(lider.id, [100, 35]);
    outros.forEach((a, i) => { const g = -Math.PI / 2 + (i * 2 * Math.PI) / outros.length; P.set(a.id, [100 + Math.cos(g) * 46, 35 + Math.sin(g) * 25]); });
  } else {
    const linhas = camadas(L, arq);
    linhas.forEach((linha, r) => linha.forEach((a, i) => P.set(a.id, [100 + (i - (linha.length - 1) / 2) * Math.min(40, 170 / linha.length), linhas.length === 1 ? 35 : 10 + (r * 50) / (linhas.length - 1)])));
  }
  const ligas = [];
  if (arq === 'rede') { const vistos = new Set(); for (const a of membros) for (const b of vizinhosDe(L, a)) { const k = [a.id, b.id].sort().join(); if (!vistos.has(k)) { vistos.add(k); ligas.push([a.id, b.id]); } } }
  else if (arq === 'sequencial' || arq === 'unico') { const fila = camadas(L, 'sequencial')[0] || []; for (let i = 1; i < fila.length; i++) ligas.push([fila[i - 1].id, fila[i].id]); }
  else for (const a of L) { const c = chefeDe(L, a, arq); if (c) ligas.push([c, a.id]); }
  const linhasSvg = ligas.filter(([a, b]) => P.has(a) && P.has(b)).map(([a, b]) => { const [x1, y1] = P.get(a), [x2, y2] = P.get(b); return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`; }).join('');
  const pontos = L.filter((a) => P.has(a.id)).map((a) => { const [x, y] = P.get(a.id); const cor = /^#[0-9a-f]{6}$/i.test(a.cor || '') ? a.cor : '#8f7bff'; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${a.funcao === 'lider' ? 6.5 : a.funcao === 'sublider' ? 5.5 : 4.5}" fill="${cor}"${a.funcao === 'revisor' ? ' stroke="#4fe0a0" stroke-dasharray="2 2" fill-opacity=".35"' : ''}/>`; }).join('');
  return `<svg class="mini" viewBox="0 0 200 70" aria-hidden="true"><g stroke="#5c5578" stroke-width="1.4">${linhasSvg}</g>${pontos}</svg>`;
}

function novoAgente() {
  let n = compartilhado.rascunho.agentes.length + 1; while (compartilhado.rascunho.agentes.some((a) => a.id === 'agente-' + n)) n++;
  compartilhado.rascunho.agentes.push({ id: 'agente-' + n, nome: 'Agente ' + n, funcao: '', papel: '', chefe: '', ferramentas: ['listar', 'ler', 'escrever'], cor: PALETA[n % PALETA.length], forma: 'pilha', provedor: '', modelo: '', complexidade: '', sistema: '' });
  montarEditor();
  const ult = $('#cAgentes').lastElementChild; if (ult) { ult.open = true; ult.scrollIntoView({ block: 'nearest' }); ult.querySelector('input')?.focus(); }
}
const limpar = (t) => ({ nome: t.nome, descricao: t.descricao, arquitetura: t.arquitetura, agentes: t.agentes.map((a) => Object.fromEntries(Object.entries(a).filter(([, v]) => v !== '' && v != null))) });
async function aplicarTime(salvar) {
  $('#cErro').className = 'ruim'; $('#cErro').textContent = '';
  const r = await pedir('/api/time', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ time: limpar(compartilhado.rascunho), salvar }) });
  const j = await r.json().catch(() => ({}));
  $('#cDecidir').hidden = true;
  if (j.codigo === 'decisao') {
    // resolve ali mesmo: decide o que fazer com os arquivos e troca o time em seguida
    $('#cErro').textContent = 'A última conversa mudou arquivos do projeto e você ainda não decidiu se fica com eles. Escolha para trocar o time:';
    const caixa = $('#cDecidir'); caixa.hidden = false; caixa.replaceChildren();
    for (const [acao, rot] of [['aceitar', 'Manter mudanças e trocar'], ['descartar', 'Descartar mudanças e trocar']]) {
      const b = el('button', acao === 'aceitar' ? 'primario' : '', rot);
      b.onclick = async () => {
        caixa.querySelectorAll('button').forEach((x) => (x.disabled = true));
        const d = await pedir('/api/decidir', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ acao }) });
        if (!d.ok) { $('#cErro').textContent = 'Não deu: ' + ((await d.json().catch(() => ({}))).erro || d.status); caixa.hidden = true; return; }
        aplicarTime(salvar);
      };
      caixa.append(b);
    }
    return;
  }
  if (!r.ok) { $('#cErro').textContent = 'Não deu: ' + (j.erro || r.status); return; }
  compartilhado.rascunho = null; limparHistorico(); depois.secao('time');
  // o evento "time" do servidor limpa a conversa e mostra este aviso
  compartilhado.avisoTime = salvar ? `Time "${j.time.nome}" salvo em times/${j.arquivo} e posto no palco.` : `Time "${j.time.nome}" posto no palco.`;
}

// chamadas por arquivos carregados antes deste, em resposta a eventos (ver tardias.js)
Object.assign(depois, { marcarSetaSel });

export { abrirConstrutor, adicionarDoCatalogo, aplicarTime, limparHistorico, montarBiblioteca, montarEditor, novoAgente };
