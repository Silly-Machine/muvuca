// Construtor de times: galeria, editor, biblioteca, setas, borracha, desfazer.
import { compartilhado } from './estado.js';
import { depois } from './tardias.js';
import * as Regras from './regras/indice.js';
import { $, el, lerDoServidor, pedir } from './base.js';
import { mascote } from './personagens.js';
import { NOME_ARQ, NOME_FORMA, NOME_FUNCAO, SEM_LIDER, desenharArestas, montarGrafo, ns, paraUnidades } from './palco.js';

/* ---------- construtor de times ---------- */
const PALETA = ['#ff8e6b', '#4fb3ff', '#ffc94d', '#a48bff', '#4fe0a0', '#ff7bc8', '#5a8dff', '#63e6a3', '#ffb347'];
compartilhado.rascunho = null; compartilhado.galeria = []; compartilhado.catalogo = []; let tempoPrevia = 0; compartilhado.avisoTime = ''; let tempoDica = 0;
const copiaAgente = (a) => ({ id: a.id, pos: Regras.desenho.posicaoValida(a.pos) ? [...a.pos] : null, nome: a.nome, funcao: a.funcao || '', papel: a.papel || '', chefe: a.chefe || '', ferramentas: [...(a.ferramentas || [])], cor: a.cor || '#8f7bff', forma: a.forma || 'pilha', provedor: a.provedor || '', modelo: a.modeloFixo ?? a.modelo ?? '', complexidade: a.complexidade || '', sistema: a.sistema || '', conexoes: Array.isArray(a.conexoes) ? [...a.conexoes] : null });
const timeAtual = () => ({ nome: compartilhado.nomeTime, descricao: '', arquitetura: compartilhado.arquitetura, desenho: compartilhado.desenho, modelo: compartilhado.modelo, agentes: compartilhado.agentes.map(copiaAgente) });
const EM_BRANCO = { nome: 'Time novo', arquitetura: 'centralizada', descricao: 'Começa com um líder, um executor e um revisor.', agentes: [
  { id: 'lider', nome: 'Líder', funcao: 'lider', papel: 'coordena o time e monta o plano', cor: '#ff8e6b', forma: 'regente' },
  { id: 'dev', nome: 'Dev', papel: 'implementa com teste junto', ferramentas: ['listar', 'ler', 'escrever', 'rodar'], cor: '#4fb3ff', forma: 'pilha' },
  { id: 'revisor', nome: 'Revisor', funcao: 'revisor', papel: 'revisão de código', ferramentas: ['listar', 'ler'], cor: '#4fe0a0', forma: 'escudo' }] };

async function abrirConstrutor() {
  depois.secao('construtor'); maximizar(false);
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
  // o modelo pronto de origem fica anotado, para "voltar ao desenho do modelo"
  compartilhado.rascunho = { nome: t.nome, descricao: t.descricao || '', arquitetura: t.arquitetura || 'centralizada', desenho: t.desenho || null, modelo: t.origem === 'pronto' ? t.nome : t.modelo || '', agentes: (t.agentes || []).map(copiaAgente) };
  vista.nova = true;
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
    const r = compartilhado.rascunho;
    const lista = r.agentes.map((a, i) => ({ ...a, id: a.id || `sem-id-${i}` }));
    // quem não tem lugar no desenho ganha um agora, e o lugar fica gravado no rascunho (vai para o desfazer e para o time)
    const pos = Regras.desenho.completar({ ...r, agentes: lista }, { perto: pertoPendente }); pertoPendente = {};
    lista.forEach((a, i) => { a.pos = pos[a.id]; r.agentes[i].pos = pos[a.id]; });
    const m = mundo(), velha = m._origem;
    montarGrafo(m, lista, r.arquitetura, 'p', r.desenho);
    // o mundo começa no agente mais à esquerda e mais acima: se ele mudou, a vista compensa e o desenho não pula
    if (velha && !vista.nova) { vista.tx += (m._origem.x0 - velha.x0) * m._escala.ux * vista.z; vista.ty += (m._origem.y0 - velha.y0) * m._escala.uy * vista.z; }
    if (vista.nova) { vista.nova = false; caber(); } else aplicarVista();
    barraDaVista();
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
  centralizada: 'Arraste da biblioteca para a prévia: todo mundo responde ao líder. Arraste um agente para mudar o lugar dele; solto sobre outro, troca a ordem. Ctrl + roda aproxima.',
  hierarquica: 'Solte da biblioteca sobre um líder ou sub-líder para pôr no time dele. Arraste um agente para mudar o lugar; solto sobre outro líder, muda de chefe.',
  sequencial: 'Arraste um agente para mudar o lugar dele no desenho; solto sobre outro, muda a ordem da esteira.',
  unico: 'Um agente só: arraste da biblioteca e remova o que sobrar.',
  rede: 'Solte da biblioteca sobre um agente para já ligar os dois. Arraste um agente para mudar o lugar; solto sobre outro, liga ou desliga a passagem de vez.',
};
function dica(texto) {
  clearTimeout(tempoDica);
  $('#cDica').textContent = texto || DICAS[compartilhado.rascunho?.arquitetura] || '';
  $('#cDica').classList.toggle('feito', !!texto);
  if (texto) tempoDica = setTimeout(() => dica(), 4500);
}
const achar = (id) => compartilhado.rascunho.agentes.find((a) => a.id === id);
function removerAgente(id) { removerVarios([id]); }
// Tira vários de uma vez: quem respondia a eles volta para o líder, e as passagens de vez para eles somem.
function removerVarios(ids) {
  const fora = new Set(ids), r = compartilhado.rascunho;
  r.agentes = r.agentes.filter((a) => !fora.has(a.id));
  r.agentes.forEach((x) => { if (fora.has(x.chefe)) x.chefe = ''; if (x.conexoes) x.conexoes = x.conexoes.filter((c) => !fora.has(c)); });
  ids.forEach((id) => selecao.delete(id));
  montarEditor();
}
function adicionarDoCatalogo(cid, alvo, ponto) {
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
  if (ponto && !b) pertoPendente[novo.id] = ponto;   // solto no vazio: nasce onde caiu
  montarEditor(); dica(msg);
}
// Devolve true quando mudou o time; nas recusas, só explica.
function moverNo(src, alvo) {
  const a = achar(src), b = achar(alvo); if (!a || !b || a === b) return false;
  const arq = compartilhado.rascunho.arquitetura;
  if (arq === 'hierarquica') {
    if (a.funcao === 'lider') return dica('O líder não responde a ninguém.'), false;
    if (b.funcao !== 'lider' && b.funcao !== 'sublider') return dica('Solte sobre um líder ou sub-líder para mudar de chefe.'), false;
    for (let x = b, k = 0; x && k < 12; x = achar(x.chefe), k++) if (x === a) return dica('Assim a chefia daria uma volta: escolha outro chefe.'), false;
    a.chefe = b.funcao === 'lider' ? '' : b.id; montarEditor(); dica(`${a.nome} agora responde a ${b.nome}.`); return true;
  }
  if (arq === 'rede') {
    if (a.funcao === 'revisor' || b.funcao === 'revisor') return dica('O revisor fica fora da rede.'), false;
    const todos = compartilhado.rascunho.agentes.filter((x) => x !== a && x.funcao !== 'revisor').map((x) => x.id);
    const atual = Array.isArray(a.conexoes) ? a.conexoes : todos, tinha = atual.includes(b.id);
    a.conexoes = tinha ? atual.filter((x) => x !== b.id) : [...atual, b.id];
    montarEditor(); dica(`${a.nome} ${tinha ? 'não passa mais' : 'agora passa'} a vez para ${b.nome}.`); return true;
  }
  const L = compartilhado.rascunho.agentes; L.splice(L.indexOf(a), 1); L.splice(L.indexOf(b), 0, a);
  montarEditor(); dica(`${a.nome} foi para antes de ${b.nome}.`); return true;
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
  const o = no.querySelector('.mascote').getBoundingClientRect();
  const [x0, y0] = noMundo(o.left + o.width / 2, o.top + o.height / 2);
  let linha = null, moveu = false;
  const sobre = (e) => document.elementFromPoint(e.clientX, e.clientY)?.closest?.('#previa .agente');
  const limpar = () => { linha?.remove(); prev.querySelectorAll('.alvo, .origem').forEach((x) => x.classList.remove('alvo', 'origem')); };
  const mover = (e) => {
    if (!moveu && Math.hypot(e.clientX - ev.clientX, e.clientY - ev.clientY) < 7) return;
    if (!moveu) { moveu = true; origemSeta = null; limpar(); no.classList.add('origem'); linha = ns('path', { class: 'elastico' }); svg.append(linha); estadoSetas(`De ${achar(id)?.nome || id} para… solte em cima do destino.`); }
    const [x1, y1] = noMundo(e.clientX, e.clientY); linha.setAttribute('d', `M${x0} ${y0}L${x1} ${y1}`);
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
  if (!e.target.closest?.('.agente') && !e.shiftKey && selecao.size) selecionar(null);
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
  if ((e.key === 'Delete' || e.key === 'Backspace') && setaSel) { e.preventDefault(); const { de, para } = setaSel; setaSel = null; desligarSeta(de, para); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selecao.size && !modoSetas && !modoBorracha) {
    e.preventDefault(); const n = selecao.size, nome = achar([...selecao][0])?.nome;
    removerVarios([...selecao]); return dica(n === 1 ? `${nome} saiu do time. Ctrl+Z traz de volta.` : `${n} agentes saíram do time. Ctrl+Z traz todos de volta.`);
  }
  if (e.key === 'Escape' && !modoSetas && !modoBorracha) {
    if (selecao.size) return selecionar(null);
    if ($('.previa-caixa').classList.contains('maximizada')) return maximizar(false);
  }
});

/* ---------- seleção de agentes na prévia ---------- */
// Clique seleciona um agente (e abre o cartão); Shift ou Ctrl + clique soma ou tira; Shift + arrastar o fundo
// seleciona por caixa. Arrastar um selecionado move todos juntos; Delete tira todos do time.
const selecao = new Set();
function marcarSelecao() {
  const existe = new Set((compartilhado.rascunho?.agentes || []).map((a) => a.id));
  [...selecao].forEach((id) => { if (!existe.has(id)) selecao.delete(id); });
  $('#previa').querySelectorAll('.agente').forEach((d) => { const s = selecao.has(d.dataset.ag); d.classList.toggle('sel', s); d.setAttribute('aria-selected', String(s)); });
  if (setaSel || modoSetas || modoBorracha) return;
  estadoSetas(selecao.size > 1 ? `${selecao.size} agentes selecionados: arraste um para mover todos, Delete tira do time, Esc desmarca.` : undefined);
}
function selecionar(id, somar = false) {
  if (!somar) selecao.clear();
  if (id) { if (somar && selecao.has(id)) selecao.delete(id); else selecao.add(id); }
  marcarSelecao();
}
// Caixa de seleção: Shift + arrastar no fundo da prévia.
function comecarCaixa(e) {
  const p = $('#previa'), r = p.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
  const caixa = el('div', 'caixa-sel'); p.append(caixa);
  const antes = new Set(selecao);
  const retangulo = (ev) => ({ l: Math.min(x0, ev.clientX), t: Math.min(y0, ev.clientY), r: Math.max(x0, ev.clientX), b: Math.max(y0, ev.clientY) });
  const mover = (ev) => {
    if (ev.pointerId !== e.pointerId) return;
    const q = retangulo(ev);
    Object.assign(caixa.style, { left: q.l - r.left + 'px', top: q.t - r.top + 'px', width: q.r - q.l + 'px', height: q.b - q.t + 'px' });
    selecao.clear(); antes.forEach((id) => selecao.add(id));
    p.querySelectorAll('.agente').forEach((d) => { const b = d.getBoundingClientRect(); if (b.left < q.r && b.right > q.l && b.top < q.b && b.bottom > q.t) selecao.add(d.dataset.ag); });
    marcarSelecao();
  };
  const fim = (ev) => {
    if (ev.pointerId !== e.pointerId) return;
    document.removeEventListener('pointermove', mover); document.removeEventListener('pointerup', fim); document.removeEventListener('pointercancel', fim);
    caixa.remove(); cliqueEngolido = true; setTimeout(() => { cliqueEngolido = false; }, 0);
  };
  document.addEventListener('pointermove', mover); document.addEventListener('pointerup', fim); document.addEventListener('pointercancel', fim);
}

/* ---------- quadro maximizado ---------- */
// O quadro de desenho ocupa a janela inteira, com a biblioteca dentro dele para continuar arrastando peças.
let lugarDaBiblioteca = null;
function maximizar(liga) {
  const c = $('.previa-caixa'), b = $('#biblioteca'), botao = $('#cMaximizar');
  if (liga === c.classList.contains('maximizada')) return;
  c.classList.toggle('maximizada', liga); document.body.classList.toggle('quadro-max', liga);
  if (liga) { lugarDaBiblioteca = [b.parentNode, b.nextSibling]; $('.barra-vista').after(b); b.classList.add('na-moldura'); }
  else if (lugarDaBiblioteca) { lugarDaBiblioteca[0].insertBefore(b, lugarDaBiblioteca[1]); b.classList.remove('na-moldura'); }
  botao.setAttribute('aria-pressed', String(liga)); botao.textContent = liga ? '⤡ Tamanho normal' : '⤢ Quadro grande';
  botao.title = liga ? 'Voltar o quadro ao tamanho normal (Esc)' : 'Abrir o quadro de desenho na janela inteira (Esc volta)';
  $('#cQuadroNome').textContent = compartilhado.rascunho?.nome ? `· ${compartilhado.rascunho.nome}` : '';
  if (liga) dica('Quadro grande: arraste peças da faixa de cima, mova os agentes à vontade. Esc ou "Fechar" volta.');
  requestAnimationFrame(() => { caber(); desenharArestas(mundo()); if (liga) $('#cFecharQuadro').focus({ preventScroll: true }); });
}
$('#cMaximizar').onclick = () => maximizar(!$('.previa-caixa').classList.contains('maximizada'));
$('#cFecharQuadro').onclick = () => maximizar(false);
document.querySelectorAll('[data-abre-quadro]').forEach((b) => { b.onclick = () => maximizar(true); });
// clique duplo no fundo da prévia também abre o quadro grande
$('#previa').addEventListener('dblclick', (e) => { if (!e.target.closest?.('.agente, .toque, .tira')) maximizar(true); });

function abrirCartao(id) {
  const i = compartilhado.rascunho.agentes.findIndex((a) => a.id === id); const d = $(`#cAgentes details[data-i="${i}"]`); if (!d) return;
  d.open = true; d.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function prepararArrasto() {
  $('#previa').querySelectorAll('.agente').forEach((d) => {
    d.title = modoBorracha ? 'Clique para tirar do time' : modoSetas ? 'Clique para começar ou terminar uma seta' : 'Arraste para mudar o lugar (solto sobre outro agente, liga os dois), ou clique para editar';
    d.onclick = (e) => {
      if (arrastouSeta) return;
      if (modoBorracha) { const a = achar(d.dataset.ag); removerAgente(d.dataset.ag); return dica(`${a?.nome || d.dataset.ag} saiu do time. Ctrl+Z traz de volta.`); }
      if (modoSetas) return cliqueSeta(d.dataset.ag);
      const somar = e.shiftKey || e.ctrlKey || e.metaKey;
      selecionar(d.dataset.ag, somar);
      if (!somar) abrirCartao(d.dataset.ag);
    };
    d.onpointerdown = (e) => (modoSetas ? comecarElastico(e, d) : modoBorracha ? null : comecarMover(e, d));
  });
  marcarSelecao();
}
function soltar(e, alvo) {
  e.preventDefault(); document.body.classList.remove('arrastando');
  $('#previa').querySelectorAll('.alvo').forEach((x) => x.classList.remove('alvo'));
  const [tipo, id] = e.dataTransfer.getData('text/plain').split(':');
  if (alvo === 'lixeira') { if (tipo === 'no') { const a = achar(id); removerAgente(id); dica(`${a?.nome || id} saiu do time.`); } return; }
  const sobre = e.target.closest?.('.agente')?.dataset.ag;
  if (tipo === 'catalogo') adicionarDoCatalogo(id, sobre, sobre ? null : unidadesNoPonto(e.clientX, e.clientY));
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

// Desenho da arquitetura para o cartão da galeria: as posições do próprio time (as gravadas, ou o desenho automático),
// encolhidas para caber no cartão. Unidades viram pixels na proporção da prévia, para não achatar o desenho.
function miniatura(t) {
  const L = t.agentes || [], pos = Regras.desenho.completar(t), c = Regras.desenho.caixa(pos) || { x0: 0, y0: 0, x1: 0, y1: 0 };
  const largura = (c.x1 - c.x0) * 98, altura = (c.y1 - c.y0) * 124;
  const k = Math.min(1, 170 / (largura || 1), 46 / (altura || 1));
  const ponto = ([x, y]) => [100 + (x - (c.x0 + c.x1) / 2) * 98 * k, 35 + (y - (c.y0 + c.y1) / 2) * 124 * k];
  const P = new Map(L.filter((a) => pos[a.id]).map((a) => [a.id, ponto(pos[a.id])]));
  // na rede, ida e volta entre os mesmos dois viram uma linha só
  const vistas = new Set(), ligas = Regras.desenho.relacoes(t).filter(([a, b]) => { const chave = [a, b].sort().join(); if (vistas.has(chave)) return false; vistas.add(chave); return true; });
  const linhasSvg = ligas.filter(([a, b]) => P.has(a) && P.has(b)).map(([a, b]) => { const [x1, y1] = P.get(a), [x2, y2] = P.get(b); return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`; }).join('');
  const pontos = L.filter((a) => P.has(a.id)).map((a) => { const [x, y] = P.get(a.id); const cor = /^#[0-9a-f]{6}$/i.test(a.cor || '') ? a.cor : '#8f7bff'; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${a.funcao === 'lider' ? 6.5 : a.funcao === 'sublider' ? 5.5 : 4.5}" fill="${cor}"${a.funcao === 'revisor' ? ' stroke="#4fe0a0" stroke-dasharray="2 2" fill-opacity=".35"' : ''}/>`; }).join('');
  return `<svg class="mini" viewBox="0 0 200 70" aria-hidden="true"><g stroke="#5c5578" stroke-width="1.4">${linhasSvg}</g>${pontos}</svg>`;
}

/* ---------- desenho livre: vista (deslocar e zoom) e arrastar agentes ---------- */
// A prévia é uma janela sobre o "mundo": o mundo tem o desenho em pixels e recebe translate + scale.
// As posições dos agentes ficam no rascunho, em unidades (js/regras/desenho.js); o arrasto só grava ao soltar,
// então um arrasto é um passo só no desfazer.
const ZOOM_MIN = 0.25, ZOOM_MAX = 3;
const vista = { tx: 0, ty: 0, z: 1, nova: true };
let pertoPendente = {};   // id → ponto onde a peça da biblioteca foi solta, para o próximo desenho
function mundo() {
  let m = $('#previa .mundo'); if (!m) { m = el('div', 'mundo'); $('#previa').append(m); }
  return m;
}
function aplicarVista() {
  const m = mundo(); m.style.setProperty('--tx', vista.tx + 'px'); m.style.setProperty('--ty', vista.ty + 'px'); m.style.setProperty('--z', vista.z);
  $('#cZoomTexto').textContent = Math.round(vista.z * 100) + '%';
  $('#cZoomMenos').disabled = vista.z <= ZOOM_MIN + 1e-6; $('#cZoomMais').disabled = vista.z >= ZOOM_MAX - 1e-6;
}
const limitarZoom = (z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
// Enquadra o desenho inteiro na prévia, sem passar de 140%: time pequeno não vira gigante.
function caber() {
  const m = mundo(), p = $('#previa'), W = m.offsetWidth, H = m.offsetHeight, PW = p.clientWidth, PH = p.clientHeight;
  if (!W || !H || !PW || !PH) return;
  vista.z = limitarZoom(Math.min(PW / W, PH / H, 1.4));
  vista.tx = (PW - W * vista.z) / 2; vista.ty = (PH - H * vista.z) / 2;
  aplicarVista();
}
// Muda o zoom mantendo parado o ponto (cx, cy) da prévia.
function zoomEm(z, cx, cy) {
  const novo = limitarZoom(z); if (novo === vista.z) return aplicarVista();
  vista.tx = cx - (cx - vista.tx) * novo / vista.z; vista.ty = cy - (cy - vista.ty) * novo / vista.z; vista.z = novo;
  aplicarVista();
}
const zoomNoMeio = (fator) => { const p = $('#previa'); zoomEm(vista.z * fator, p.clientWidth / 2, p.clientHeight / 2); };
// De coordenadas da tela para pixels dentro do mundo.
function noMundo(cx, cy) {
  const r = $('#previa').getBoundingClientRect();
  return [(cx - r.left - vista.tx) / vista.z, (cy - r.top - vista.ty) / vista.z];
}
// Ponto da tela em unidades de desenho, para um agente cujo centro fique ali.
function unidadesNoPonto(cx, cy) {
  const m = mundo(); if (!m._escala) return null;
  const [px, py] = noMundo(cx, cy);
  return paraUnidades(m, px, py - m._escala.alt / 2).map((v) => Math.round(v * 100) / 100);
}
$('#cZoomMenos').onclick = () => zoomNoMeio(1 / 1.25);
$('#cZoomMais').onclick = () => zoomNoMeio(1.25);
$('#cZoomTexto').onclick = () => zoomNoMeio(1 / vista.z);
$('#cCaber').onclick = () => caber();
// Ctrl + roda (e a pinça do trackpad, que chega como roda com Ctrl): zoom em volta do ponteiro.
$('#previa').addEventListener('wheel', (e) => {
  if (!e.ctrlKey && !e.metaKey) return;   // sem Ctrl, a roda continua rolando a página
  e.preventDefault();
  const r = $('#previa').getBoundingClientRect();
  zoomEm(vista.z * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.03 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
}, { passive: false });
// Espaço segurado: arrastar em qualquer lugar desloca, mesmo em cima de um agente.
let espaco = false;
const noConstrutor = () => document.body.classList.contains('ver-construtor');
const emCampo = (e) => !!e.target.closest?.('input, textarea, select, button, [contenteditable]');
document.addEventListener('keydown', (e) => {
  if (!noConstrutor() || emCampo(e)) return;
  if (e.code === 'Space' && !e.repeat) { espaco = true; $('#previa').classList.add('pronta-deslocar'); e.preventDefault(); }
  if (e.code === 'Digit1' && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) { e.preventDefault(); caber(); }
});
document.addEventListener('keyup', (e) => { if (e.code === 'Space') { espaco = false; $('#previa').classList.remove('pronta-deslocar'); } });
// Deslocar: arrastar o fundo (ou com espaço, em qualquer lugar). Com dois dedos, desloca e muda o zoom junto.
const toques = new Map();
$('#previa').addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') toques.set(e.pointerId, [e.clientX, e.clientY]);
  if (toques.size === 2) return comecarPinca();
  const sobreAlgo = e.target.closest?.('.agente, .toque, .tira');
  if (e.shiftKey && e.button === 0 && !espaco && !sobreAlgo && !modoSetas && !modoBorracha) { e.preventDefault(); e.stopPropagation(); return comecarCaixa(e); }
  if (!(espaco || e.button === 1 || (e.button === 0 && !sobreAlgo))) return;
  if (sobreAlgo) e.stopPropagation();
  e.preventDefault();
  const x0 = e.clientX, y0 = e.clientY, tx0 = vista.tx, ty0 = vista.ty; let moveu = false;
  const mover = (ev) => {
    if (toques.size > 1 || ev.pointerId !== e.pointerId) return;
    if (!moveu && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
    moveu = true; $('#previa').classList.add('deslocando');
    vista.tx = tx0 + ev.clientX - x0; vista.ty = ty0 + ev.clientY - y0; aplicarVista();
  };
  const fim = (ev) => {
    if (ev.pointerId !== e.pointerId) return;
    document.removeEventListener('pointermove', mover); document.removeEventListener('pointerup', fim); document.removeEventListener('pointercancel', fim);
    $('#previa').classList.remove('deslocando');
    if (moveu) { cliqueEngolido = true; setTimeout(() => { cliqueEngolido = false; }, 0); }
  };
  document.addEventListener('pointermove', mover); document.addEventListener('pointerup', fim); document.addEventListener('pointercancel', fim);
}, true);
const soltarToque = (e) => toques.delete(e.pointerId);
document.addEventListener('pointerup', soltarToque); document.addEventListener('pointercancel', soltarToque);
function comecarPinca() {
  const r = $('#previa').getBoundingClientRect();
  const medir = () => { const [[ax, ay], [bx, by]] = [...toques.values()]; return { d: Math.hypot(bx - ax, by - ay) || 1, cx: (ax + bx) / 2 - r.left, cy: (ay + by) / 2 - r.top }; };
  let antes = medir();
  const mover = (ev) => {
    if (!toques.has(ev.pointerId)) return;
    toques.set(ev.pointerId, [ev.clientX, ev.clientY]); if (toques.size !== 2) return;
    const agora = medir();
    vista.tx += agora.cx - antes.cx; vista.ty += agora.cy - antes.cy;
    zoomEm(vista.z * agora.d / antes.d, agora.cx, agora.cy);
    antes = agora;
  };
  const fim = () => { if (toques.size < 2) { document.removeEventListener('pointermove', mover); document.removeEventListener('pointerup', fim); document.removeEventListener('pointercancel', fim); } };
  document.addEventListener('pointermove', mover); document.addEventListener('pointerup', fim); document.addEventListener('pointercancel', fim);
}
// Um arrasto que terminou não vira clique (no agente, abriria o cartão; no fundo, tiraria a seleção da seta).
let cliqueEngolido = false;
$('#previa').addEventListener('click', (e) => { if (cliqueEngolido) { e.stopPropagation(); e.preventDefault(); } }, true);

// Arrastar um agente: move o desenho. Solto sobre outro agente, vale o que valia antes (mudar de chefe, de ordem
// ou a passagem de vez); solto na lixeira, sai do time; solto fora da prévia, volta para onde estava.
function comecarMover(e, d) {
  if (e.button !== 0 || espaco || toques.size > 1) return;
  const raiz = mundo(), id = d.dataset.ag, x0 = e.clientX, y0 = e.clientY;
  const left0 = parseFloat(d.style.left), top0 = parseFloat(d.style.top);
  let moveu = false, quadro = 0, grupo = [];
  const debaixo = (ev) => document.elementFromPoint(ev.clientX, ev.clientY);
  const marcar = (ev) => {
    const alvo = debaixo(ev);
    raiz.querySelectorAll('.alvo').forEach((x) => x.classList.remove('alvo'));
    alvo?.closest?.('#previa .agente')?.classList.add('alvo');
    $('#lixeira').classList.toggle('alvo', !!alvo?.closest?.('#lixeira'));
  };
  const mover = (ev) => {
    if (ev.pointerId !== e.pointerId || toques.size > 1) return;
    if (!moveu && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
    if (!moveu) {
      moveu = true; d.classList.add('movendo'); d.style.pointerEvents = 'none'; document.body.classList.add('arrastando');
      if (!selecao.has(id)) selecionar(id);   // arrastar quem não estava selecionado seleciona só ele
      grupo = [...raiz.querySelectorAll('.agente.sel')].filter((x) => x !== d).map((x) => ({ x, l: parseFloat(x.style.left), t: parseFloat(x.style.top) }));
      grupo.forEach((g) => { g.x.classList.add('movendo'); g.x.style.pointerEvents = 'none'; });
    }
    const dx = (ev.clientX - x0) / vista.z, dy = (ev.clientY - y0) / vista.z;
    d.style.left = (left0 + dx) + 'px'; d.style.top = (top0 + dy) + 'px';
    grupo.forEach((g) => { g.x.style.left = (g.l + dx) + 'px'; g.x.style.top = (g.t + dy) + 'px'; });
    marcar(ev);
    cancelAnimationFrame(quadro); quadro = requestAnimationFrame(() => desenharArestas(raiz));
  };
  const fim = (ev) => {
    if (ev.pointerId !== e.pointerId) return;
    document.removeEventListener('pointermove', mover); document.removeEventListener('pointerup', fim); document.removeEventListener('pointercancel', fim);
    if (!moveu) return;   // foi só um clique: abre o cartão
    cliqueEngolido = true; setTimeout(() => { cliqueEngolido = false; }, 0);
    const alvo = ev.type === 'pointerup' ? debaixo(ev) : null;
    d.classList.remove('movendo'); d.style.pointerEvents = ''; document.body.classList.remove('arrastando');
    grupo.forEach((g) => { g.x.classList.remove('movendo'); g.x.style.pointerEvents = ''; });
    raiz.querySelectorAll('.alvo').forEach((x) => x.classList.remove('alvo')); $('#lixeira').classList.remove('alvo');
    const a = achar(id); if (!a) return atualizarPrevia(true);
    if (alvo?.closest?.('#lixeira')) {
      if (grupo.length) { const ids = [id, ...grupo.map((g) => g.x.dataset.ag)]; removerVarios(ids); return dica(`${ids.length} agentes saíram do time. Ctrl+Z traz todos de volta.`); }
      removerAgente(id); return dica(`${a.nome || id} saiu do time. Ctrl+Z traz de volta.`);
    }
    const outro = alvo?.closest?.('#previa .agente')?.dataset.ag;
    if (outro && outro !== id) {
      const antes = a.pos; a.pos = null;   // mudou de chefe ou de ordem: volta a ficar perto de quem faz sentido
      if (!moverNo(id, outro)) { a.pos = antes; atualizarPrevia(true); }
      return;
    }
    if (!alvo?.closest?.('#previa')) { atualizarPrevia(true); return dica('Solte dentro da prévia para mover, ou na lixeira para tirar do time.'); }
    const lugar = (x) => paraUnidades(raiz, parseFloat(x.style.left), parseFloat(x.style.top)).map((v) => Math.round(v * 100) / 100);
    a.pos = lugar(d);
    grupo.forEach((g) => { const b = achar(g.x.dataset.ag); if (b) b.pos = lugar(g.x); });   // todos no mesmo passo do desfazer
    atualizarPrevia(true);
  };
  document.addEventListener('pointermove', mover); document.addEventListener('pointerup', fim); document.addEventListener('pointercancel', fim);
}

// Reorganizar: refaz o desenho automático do time inteiro (na rede, em anel ou em camadas) e enquadra.
function reorganizar() {
  const r = compartilhado.rascunho; if (!r) return;
  if (r.arquitetura === 'rede') r.desenho = { ...r.desenho, rede: $('#cRede').value };
  r.agentes.forEach((a) => { a.pos = null; });
  vista.nova = true; atualizarPrevia(true); dica('Desenho reorganizado. Ctrl+Z desfaz.');
}
$('#cReorganizar').onclick = reorganizar;
$('#cRede').onchange = reorganizar;
// O modelo pronto de onde o rascunho veio, se ele ainda existe na galeria.
const modeloDeOrigem = () => compartilhado.rascunho?.modelo && compartilhado.galeria.find((t) => t.origem === 'pronto' && t.nome === compartilhado.rascunho.modelo);
$('#cVoltarModelo').onclick = () => {
  const m = modeloDeOrigem(); if (!m) return;
  const base = new Map(m.agentes.map((a) => [a.id, a.pos]));
  compartilhado.rascunho.agentes.forEach((a) => { a.pos = base.get(a.id) ? [...base.get(a.id)] : null; });
  vista.nova = true; atualizarPrevia(true); dica(`Voltou ao desenho do modelo "${m.nome}". Ctrl+Z desfaz.`);
};
// Estilo das setas: guardado no desenho do time, então vale também no palco, no time salvo e no exportado.
$('#cSetaEstilo').onchange = (e) => {
  const r = compartilhado.rascunho; if (!r) return;
  const { setas, ...resto } = r.desenho || {};
  r.desenho = e.target.value === 'arredondadas' ? { ...resto, setas: 'arredondadas' } : resto;
  if (!Object.keys(r.desenho).length) delete r.desenho;
  atualizarPrevia(true); dica(`Setas ${e.target.value}. Ctrl+Z desfaz.`);
};
function barraDaVista() {
  const r = compartilhado.rascunho;
  $('#cSetaEstilo').value = Regras.desenho.estiloDaSeta(r.desenho);
  $('#cRede').hidden = r.arquitetura !== 'rede'; $('#cRede').value = r.desenho?.rede === 'camadas' ? 'camadas' : 'anel';
  $('#cVoltarModelo').hidden = !modeloDeOrigem();
}

function novoAgente() {
  let n = compartilhado.rascunho.agentes.length + 1; while (compartilhado.rascunho.agentes.some((a) => a.id === 'agente-' + n)) n++;
  compartilhado.rascunho.agentes.push({ id: 'agente-' + n, nome: 'Agente ' + n, funcao: '', papel: '', chefe: '', ferramentas: ['listar', 'ler', 'escrever'], cor: PALETA[n % PALETA.length], forma: 'pilha', provedor: '', modelo: '', complexidade: '', sistema: '' });
  montarEditor();
  const ult = $('#cAgentes').lastElementChild; if (ult) { ult.open = true; ult.scrollIntoView({ block: 'nearest' }); ult.querySelector('input')?.focus(); }
}
const limpar = (t) => ({ nome: t.nome, descricao: t.descricao, arquitetura: t.arquitetura, ...(t.desenho ? { desenho: t.desenho } : {}), ...(t.modelo ? { modelo: t.modelo } : {}), agentes: t.agentes.map((a) => Object.fromEntries(Object.entries(a).filter(([, v]) => v !== '' && v != null))) });
/* ---------- exportar o time ---------- */
// Salva a arquitetura do rascunho em arquivos que outra IA consegue usar: AGENTS.md, o JSON da Muvuca e os subagentes
// do Claude Code. Não precisa aplicar o time antes: exporta o que está no construtor.
async function exportar(formato, extra = {}) {
  const r = await pedir('/api/exportar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ time: limpar(compartilhado.rascunho), formato, ...extra }) });
  if (formato === 'zip' && r.ok) return r;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.erro || `o servidor respondeu ${r.status}`), j);
  return j;
}
async function abrirExportar() {
  const d = $('#dlgExportar'), msg = (t, ruim) => { $('#exMsg').textContent = t; $('#exMsg').className = ruim ? 'ruim' : 'ok'; };
  $('#cErro').className = 'ruim'; $('#cErro').textContent = '';
  let previa; try { previa = await exportar('previa'); } catch (e) { $('#cErro').textContent = 'Não dá para exportar ainda: ' + e.message; return; }
  $('#exTitulo').textContent = `Exportar "${previa.nome}"`; msg('');
  const lista = $('#exArquivos'); lista.replaceChildren();
  const oque = (p) => (p === 'AGENTS.md' ? 'o time em texto, para qualquer IA' : p === 'muvuca-time.json' ? 'o time em JSON, para a Muvuca ou outro programa' : 'subagente do Claude Code');
  for (const a of previa.arquivos) { const li = el('li'); li.append(el('code', '', a.caminho), el('span', '', oque(a.caminho))); lista.append(li); }
  $('#exPrevia').textContent = previa.agentsMd;
  const projeto = $('#projeto').value.trim();
  $('#exDestino').textContent = projeto ? `Pasta do projeto: ${projeto}` : 'Escolha uma pasta de projeto para poder gravar nela.';
  $('#exPasta').disabled = !projeto;
  $('#exZip').onclick = async () => {
    try {
      const r = await exportar('zip'); const blob = await r.blob();
      const nome = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') || '')?.[1] || 'time-muvuca.zip';
      const a = el('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      msg(`Baixado: ${nome}`);
    } catch (e) { msg('Não deu: ' + e.message, true); }
  };
  $('#exPasta').onclick = async () => {
    try {
      let j;
      try { j = await exportar('pasta', { projeto }); }
      catch (e) {
        // arquivo que já existe com outro conteúdo: só troca com a sua confirmação
        if (e.codigo !== 'existe' || !confirm(`Já existe na pasta, com outro conteúdo:\n\n${e.existentes.join('\n')}\n\nSubstituir?`)) throw e;
        j = await exportar('pasta', { projeto, sobrescrever: true });
      }
      msg(`Gravado em ${j.projeto}: ${j.gravados.join(', ')}`);
    } catch (e) { msg('Não deu: ' + e.message, true); }
  };
  $('#exFechar').onclick = () => d.close();
  d.showModal();
}
$('#cExportar').onclick = () => abrirExportar();

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
