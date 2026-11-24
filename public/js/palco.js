// O palco e o grafo de setas (usado também pela prévia do construtor).
import { compartilhado } from './estado.js';
import { depois } from './tardias.js';
import { $, ESTADOS, avisar, el, pedir } from './base.js';
import { PERSONAGENS, mascote } from './personagens.js';
import * as Regras from './regras/indice.js';

/* ---------- palco ---------- */
PERSONAGENS.salsicha = PERSONAGENS.regente;   // a Buzina só tem versão em imagem (public/bonecos/salsicha-*.webp)
const NOME_CX = { baixa: 'baixa', media: 'média', alta: 'alta' };
const NOME_FUNCAO = { '': 'executor', lider: 'líder', sublider: 'sub-líder', revisor: 'revisor' };
const NOME_FORMA = { salsicha: 'Buzina, a salsicha astronauta', cartola: 'Maestro de cartola', engrenagem: 'Engrenagem', regente: 'Cápsula de batuta', pilha: 'Pilha de discos', cristal: 'Cristal lapidado', lente: 'Esfera de lente', escudo: 'Escudo de óculos', tela: 'Monitor de antena', gota: 'Gota', nuvem: 'Nuvem', cogumelo: 'Cogumelo', polvo: 'Polvo', foguete: 'Foguete', gato: 'Gato vigia', livro: 'Livro', planta: 'Vaso de planta' };
const NOME_ARQ = { unico: 'agente único', centralizada: 'supervisor', hierarquica: 'hierárquica', sequencial: 'esteira', rede: 'rede' };
const SEM_LIDER = ['unico', 'sequencial', 'rede'];
compartilhado.liderId = null; compartilhado.arquitetura = 'centralizada'; compartilhado.nomeTime = ''; compartilhado.arquiteturas = {}; compartilhado.provedores = [];
// Relação de cada agente com quem está acima dele, escrita na aresta do grafo.
const { relacao } = Regras.desenho;
const ROTULO_NIVEL = { baixa: 'simples', media: 'comum', alta: 'difícil' };
const modeloDoNivel = (a, n) => a.modelos?.[n] || a.modelo || a.provedor;
// nível que vale para o agente: o escolhido nele, senão o padrão do papel; "auto" desliga os dois
const nivelDoAgente = (a) => (a.complexidade === 'auto' ? '' : a.complexidade || a.nivelPadrao || '');
const modeloPadrao = (a) => a.modeloFixo || (nivelDoAgente(a) ? modeloDoNivel(a, nivelDoAgente(a)) : a.modelos ? 'por complexidade' : a.modelo || a.provedor);
const noAg = (raiz, id) => raiz.querySelector(`.agente[data-ag="${CSS.escape(String(id))}"]`);
const palco = () => $('#time .grafo') || $('#time');
const noPalco = (id) => noAg(palco(), id);
function rotuloModelo(id, modelo, cx) {
  const p = noPalco(id)?.querySelector('.prov'); if (!p) return;
  p.textContent = ''; p.append(el('span', '', modelo)); if (cx) p.append(el('span', 'cx ' + cx, NOME_CX[cx]));
}

/* ---------- grafo: serve ao palco e à prévia do construtor ---------- */
// Quem fica onde vem de js/regras/desenho.js (com testes): cada agente tem uma posição em unidades de desenho,
// e cada vista converte unidades em pixels com a sua escala. Aqui, só a tela.
const { chefeDe, vizinhosDe, fila, rotaDaSeta, retaDaRede, estiloDaSeta } = Regras.desenho;
// Escala de cada vista: pixels por unidade (ux, uy), largura do agente, altura do maior agente e margem.
const ESCALA = { p: { ux: 98, uy: 124, larg: 86, alt: 92, margem: 16 }, '': { ux: 190, uy: 262, larg: 168, alt: 232, margem: 24 } };
// Tamanho do boneco pela função: o líder maior, o sub-líder um pouco menor, os outros iguais entre si.
const nivelVisual = (a, arq) => (a.funcao === 'lider' ? '0' : a.funcao === 'sublider' ? '1' : SEM_LIDER.includes(arq) ? 's' : arq === 'hierarquica' ? '2' : '1');
function montarGrafo(raiz, lista, arq, sufixo = '', desenho = null) {
  const E = ESCALA[sufixo] || ESCALA[''];
  const pos = Regras.desenho.completar({ arquitetura: arq, agentes: lista, desenho });
  const c = Regras.desenho.caixa(pos) || { x0: 0, y0: 0, x1: 0, y1: 0 };
  raiz.innerHTML = `<svg class="arestas" aria-hidden="true"><defs><marker id="seta${sufixo}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker></defs></svg>`;
  raiz._lista = lista; raiz._arq = arq; raiz._sufixo = sufixo; raiz._escala = E; raiz._origem = c; raiz._setas = estiloDaSeta(desenho);
  raiz.style.width = ((c.x1 - c.x0) * E.ux + E.larg + 2 * E.margem) + 'px';
  raiz.style.height = ((c.y1 - c.y0) * E.uy + E.alt + 2 * E.margem) + 'px';
  raiz.style.setProperty('--larg', E.larg + 'px');
  lista.forEach((a, i) => {
    const d = el('div', 'agente' + (lista.some((x) => x.chefe === a.id) ? ' chefe' : '')); d.dataset.ag = a.id; d.dataset.estado = 'disponivel'; d.dataset.nivel = nivelVisual(a, arq);
    d.style.setProperty('--cor', a.cor); d.style.setProperty('--i', i);
    d.innerHTML = `<div class="foco"></div><div class="chao"></div><div class="balao"></div>${mascote(a, i, sufixo)}<div class="nome"></div><div class="prov"></div><div class="pilula"><i></i><span>Disponível</span></div>`;
    d.querySelector('.nome').textContent = a.nome || '(sem nome)';
    colocar(raiz, d, pos[a.id]);
    raiz.append(d);
  });
  // desenha no próximo quadro; o temporizador cobre a aba em segundo plano, onde o navegador segura os quadros
  let feito = false; const desenhar = () => { if (feito || !raiz.isConnected) return; feito = true; desenharArestas(raiz); };
  requestAnimationFrame(desenhar); setTimeout(desenhar, 120);
}
// Põe o agente na posição (em unidades): o centro do boneco em x, o topo dele em y.
function colocar(raiz, d, [x, y]) {
  const E = raiz._escala, c = raiz._origem;
  d.style.left = ((x - c.x0) * E.ux + E.larg / 2 + E.margem) + 'px';
  d.style.top = ((y - c.y0) * E.uy + E.margem) + 'px';
}
// O contrário: de pixels dentro da raiz para unidades.
const paraUnidades = (raiz, px, py) => [(px - raiz._escala.larg / 2 - raiz._escala.margem) / raiz._escala.ux + raiz._origem.x0, (py - raiz._escala.margem) / raiz._escala.uy + raiz._origem.y0];
const ns = (tag, at) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const k in at) e.setAttribute(k, at[k]); return e; };
// Posição dentro da raiz pela soma de offsets: ignora as animações de entrada e de respiração.
function posicao(raiz, id) {
  const d = noAg(raiz, id); if (!d || !d.offsetWidth) return null;
  let x = 0, y = 0, n = d; while (n && n !== raiz) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
  // na prévia, o agente é uma miniatura (um cartão): a seta encosta na borda do cartão
  if (raiz.closest('#previa')) return { x: x + d.offsetWidth / 2, topo: y, base: y + d.offsetHeight, meio: y + d.offsetHeight / 2, raio: d.offsetWidth / 2 + 2 };
  let p = d.querySelector('.pilula'); if (!p.offsetHeight) p = d.querySelector('.nome');
  const tam = d.querySelector('.mascote').clientWidth || 100;
  return { x: x + d.offsetWidth / 2, topo: y + 6, base: y + p.offsetTop + p.offsetHeight + 6, meio: y + tam * .62, raio: tam / 2 };
}
// O traço das setas (quadradas ou arredondadas) vem de js/regras/desenho.js, com testes; o estilo é o do time.
const rota = (raiz, A, B) => rotaDaSeta(A, B, raiz._setas);
const reta = (raiz, A, B) => retaDaRede(A, B, raiz._setas);
const arco = (a, b) => `M${a.x} ${a.topo}Q${(a.x + b.x) / 2} ${Math.min(a.topo, b.topo) - 70} ${b.x} ${b.topo}`;
// Rótulo da relação: em cima do trecho que chega em B quando B está embaixo; senão, no meio do caminho.
function lugarDoRotulo(p, A, B) {
  if (B.topo >= A.base + 8) return { x: B.x, y: (A.base + B.topo) / 2 - 6, ancora: 'middle' };
  const m = p.getPointAtLength(p.getTotalLength() / 2); return { x: m.x, y: m.y - 6, ancora: 'middle' };
}
function desenharArestas(raiz = palco()) {
  const svg = raiz?.querySelector('.arestas'), lista = raiz?._lista; if (!svg || !lista) return;
  svg.querySelectorAll('.aresta, .rel').forEach((e) => e.remove());
  const defs = svg.querySelector('defs'), por = (e) => svg.insertBefore(e, defs.nextSibling);
  if (raiz._arq === 'rede') {
    const feitos = new Set();
    for (const a of lista) for (const b of vizinhosDe(lista, a)) {
      const chave = [a.id, b.id].sort().join('|'); if (feitos.has(chave)) continue; feitos.add(chave);
      const A = posicao(raiz, a.id), B = posicao(raiz, b.id); if (!A || !B) continue;
      const volta = vizinhosDe(lista, b).some((x) => x.id === a.id);   // B também passa para A: ponta dos dois lados
      const p = ns('path', { class: 'aresta rede', d: reta(raiz, A, B), 'data-de': a.id, 'data-para': b.id, ...(volta ? { 'data-volta': '1' } : {}), 'marker-end': `url(#seta${raiz._sufixo})`, ...(volta ? { 'marker-start': `url(#seta${raiz._sufixo})` } : {}) });
      p.style.setProperty('--cor', b.cor); por(p);
    }
    const membros = lista.filter((x) => x.funcao !== 'revisor');
    const E = membros.length > 1 && posicao(raiz, membros[0].id);
    if (E) { const t = ns('text', { class: 'rel', x: E.x - E.raio - 6, y: E.meio, 'text-anchor': 'end' }); t.textContent = 'começa aqui →'; por(t); }
  } else if (raiz._arq === 'sequencial' || raiz._arq === 'unico') {
    const f = fila(lista);
    for (let i = 1; i < f.length; i++) {
      const A = posicao(raiz, f[i - 1].id), B = posicao(raiz, f[i].id); if (!A || !B) continue;
      const p = ns('path', { class: 'aresta' + (f[i].funcao === 'revisor' ? ' revisa' : ''), d: rota(raiz, A, B), 'data-de': f[i - 1].id, 'data-para': f[i].id, 'marker-end': `url(#seta${raiz._sufixo})` });
      p.style.setProperty('--cor', f[i].cor); por(p);
    }
  } else {
    for (const x of lista) {
      const c = chefeDe(lista, x, raiz._arq); if (!c) continue;
      const A = posicao(raiz, c), B = posicao(raiz, x.id); if (!A || !B) continue;
      const p = ns('path', { class: 'aresta' + (relacao(x) === 'revisa' ? ' revisa' : ''), d: rota(raiz, A, B), 'data-de': c, 'data-para': x.id, 'marker-end': `url(#seta${raiz._sufixo})` }); p.style.setProperty('--cor', x.cor);
      por(p);
      const r = lugarDoRotulo(p, A, B);
      const t = ns('text', { class: 'rel', x: r.x, y: r.y, 'text-anchor': r.ancora, 'data-para': x.id }); t.textContent = relacao(x);
      por(t);
    }
  }
  if (raiz === palco()) lista.forEach((x) => marcarAresta(x.id));
  // na prévia do construtor, cada seta ganha uma área de clique larga (uma por sentido) e, quando dá para tirá-la, um botão "×"
  if (raiz.closest('#previa')) {
    svg.querySelectorAll('.toque, .tira').forEach((e) => e.remove());
    const de_ = (id) => lista.find((x) => x.id === id);
    const removivel = (a, b) => raiz._arq === 'rede' || (raiz._arq === 'hierarquica' && de_(a)?.funcao === 'sublider' && de_(b)?.funcao !== 'revisor');
    for (const p of svg.querySelectorAll('.aresta')) {
      const de = p.dataset.de, para = p.dataset.para; if (!de || !para) continue;
      const L = p.getTotalLength();
      const criar = (d, a, b, onde) => {
        const nome = `${de_(a)?.nome || a} → ${de_(b)?.nome || b}`;
        const t = ns('path', { class: 'toque', d, 'data-de': a, 'data-para': b }); const tt = ns('title', {}); tt.textContent = removivel(a, b) ? `Seta ${nome}: clique para selecionar, Delete tira` : `Seta ${nome}`; t.append(tt); svg.append(t);
        if (!removivel(a, b)) return;
        const c = p.getPointAtLength(L * onde);
        const g = ns('g', { class: 'tira', transform: `translate(${c.x} ${c.y})`, 'data-de': a, 'data-para': b, role: 'button', tabindex: '0', 'aria-label': `Tirar a seta ${nome}` });
        const gt = ns('title', {}); gt.textContent = `Tirar a seta ${nome}`;
        g.append(gt, ns('circle', { r: 9 }), ns('path', { d: 'M-3.5 -3.5L3.5 3.5M3.5 -3.5L-3.5 3.5' })); svg.append(g);
      };
      if (!p.dataset.volta) { criar(p.getAttribute('d'), de, para, 0.5); continue; }
      // seta de mão dupla: a metade perto de cada ponta vale pelo sentido que chega nela
      const i = p.getPointAtLength(0), m = p.getPointAtLength(L / 2), f = p.getPointAtLength(L);
      criar(`M${m.x} ${m.y}L${f.x} ${f.y}`, de, para, 0.72); criar(`M${i.x} ${i.y}L${m.x} ${m.y}`, para, de, 0.28);
    }
    depois.marcarSetaSel();
  }
}
function marcarAresta(id) {
  const d = noPalco(id); const ativo = !!d && !['disponivel', 'concluido'].includes(d.dataset.estado);
  palco().querySelectorAll(`.arestas [data-para="${CSS.escape(id)}"]`).forEach((e) => e.classList.toggle('ativa', ativo));
}
function alarme(id) {
  palco().querySelectorAll(`.arestas .aresta[data-para="${CSS.escape(id)}"]`).forEach((e) => { e.classList.add('alarme'); setTimeout(() => e.classList.remove('alarme'), 1600); });
}
// Uma bolinha na cor de quem manda sai de um agente e chega ao outro. Entre chefe e subordinado ela
// segue a aresta; na esteira, entre vizinhos, segue a seta; nos outros casos faz um arco por cima.
function viagem(de, para, { ruim = false, atraso = 0 } = {}) {
  const raiz = palco(), svg = raiz.querySelector('.arestas'), lista = raiz._lista || [];
  const A = posicao(raiz, de), B = posicao(raiz, para); if (!svg || !A || !B || de === para) return;
  const achar = (id) => lista.find((x) => x.id === id);
  let d, volta = false;
  const f = fila(lista), vizinhosNaFila = Math.abs(f.indexOf(achar(de)) - f.indexOf(achar(para))) === 1;
  if (chefeDe(lista, achar(para), raiz._arq) === de) d = rota(raiz, A, B);
  else if (chefeDe(lista, achar(de), raiz._arq) === para) { d = rota(raiz, B, A); volta = true; }
  else if (raiz._arq === 'rede' && vizinhosDe(lista, achar(de) || {}).some((x) => x.id === para)) d = reta(raiz, A, B);
  else if (raiz._arq === 'sequencial' && vizinhosNaFila) { if (f.indexOf(achar(de)) < f.indexOf(achar(para))) d = rota(raiz, A, B); else { d = rota(raiz, B, A); volta = true; } }
  else d = arco(A, B);
  const cor = ruim ? '#ff7b96' : ag(de).cor;
  const p = ns('path', { class: 'viagem', d }); p.style.setProperty('--cor', cor);
  const c = ns('circle', { class: 'carga', r: 5 }); c.style.setProperty('--cor', cor);
  svg.append(p, c);
  const fim = () => { p.classList.add('some'); c.classList.add('some'); setTimeout(() => { p.remove(); c.remove(); }, 600); };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { c.remove(); setTimeout(fim, 1200); return; }
  const L = p.getTotalLength(), dur = 950, t0 = performance.now() + atraso;
  const quadro = (agora) => {
    const k = Math.min(1, Math.max(0, (agora - t0) / dur)); const e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    const pt = p.getPointAtLength((volta ? 1 - e : e) * L); c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y);
    if (k < 1) requestAnimationFrame(quadro); else fim();
  };
  requestAnimationFrame(quadro);
}
// O grafo tem o tamanho natural dos bonecos; se não cabe no palco, encolhe inteiro (arestas junto).
function ajustarEscala() {
  const t = $('#time'), g = t.querySelector('.grafo'); if (!g || !g.offsetHeight || !t.clientHeight) return;
  g.style.setProperty('--escala', Math.min(1, t.clientHeight / g.offsetHeight, t.clientWidth / g.offsetWidth).toFixed(3));
}
new ResizeObserver(() => { ajustarEscala(); desenharArestas(); }).observe($('#time'));
document.fonts?.ready.then(() => { ajustarEscala(); desenharArestas(); });

// Mover os bonecos no palco: arrastar muda só o lugar no desenho (o time não muda), e o lugar fica guardado
// no time em uso. Com o time parado, o palco se refaz para caber de novo; trabalhando, só as setas acompanham,
// para não apagar o estado de cada um.
function arrastarNoPalco(e, d) {
  if (e.button !== 0) return;
  const raiz = palco(), id = d.dataset.ag, x0 = e.clientX, y0 = e.clientY;
  const left0 = parseFloat(d.style.left), top0 = parseFloat(d.style.top);
  const escala = parseFloat(getComputedStyle(raiz).getPropertyValue('--escala')) || 1;
  let moveu = false, quadro = 0;
  const mover = (ev) => {
    if (ev.pointerId !== e.pointerId) return;
    if (!moveu && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
    if (!moveu) { moveu = true; d.classList.add('movendo'); }
    d.style.left = (left0 + (ev.clientX - x0) / escala) + 'px'; d.style.top = (top0 + (ev.clientY - y0) / escala) + 'px';
    cancelAnimationFrame(quadro); quadro = requestAnimationFrame(() => desenharArestas(raiz));
  };
  const fim = async (ev) => {
    if (ev.pointerId !== e.pointerId) return;
    document.removeEventListener('pointermove', mover); document.removeEventListener('pointerup', fim); document.removeEventListener('pointercancel', fim);
    d.classList.remove('movendo'); if (!moveu) return;
    const pos = paraUnidades(raiz, parseFloat(d.style.left), parseFloat(d.style.top)).map((v) => Math.round(v * 100) / 100);
    const a = compartilhado.agentes.find((x) => x.id === id); if (a) a.pos = pos;
    if (!compartilhado.rodando) montarTime(); else desenharArestas(raiz);
    try {
      const r = await pedir('/api/desenho', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pos: { [id]: pos } }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || 'o servidor recusou');
    } catch (erro) { avisar(`Não deu para guardar o lugar de ${a?.nome || id}: ${erro.message}. Ele volta ao lugar anterior quando a Muvuca reabrir.`); }
  };
  document.addEventListener('pointermove', mover); document.addEventListener('pointerup', fim); document.addEventListener('pointercancel', fim);
}

function montarTime() {
  compartilhado.liderId = SEM_LIDER.includes(compartilhado.arquitetura) ? null : (compartilhado.agentes.find((a) => a.funcao === 'lider') || compartilhado.agentes[0])?.id;
  $('#time').innerHTML = '<div class="grafo"></div>';
  montarGrafo(palco(), compartilhado.agentes, compartilhado.arquitetura, '', compartilhado.desenho); requestAnimationFrame(ajustarEscala);
  palco().querySelectorAll('.agente').forEach((d) => { d.title = 'Arraste para mudar o lugar no palco'; d.onpointerdown = (e) => arrastarNoPalco(e, d); });
  compartilhado.agentes.forEach((a) => rotuloModelo(a.id, modeloPadrao(a)));
  $('#fichas').innerHTML = '';
  const tituloTime = el('h2', 'sec', 'Time no palco'); tituloTime.append(el('small', '', `${compartilhado.nomeTime || 'sem nome'} · ${compartilhado.agentes.length} agente(s)`)); $('#fichas').append(tituloTime);
  const etapas = fila(compartilhado.agentes);
  compartilhado.agentes.forEach((a, i) => {
    const f = el('div', 'ficha'); f.innerHTML = mascote(a, i, 's');
    const subs = compartilhado.agentes.filter((x) => chefeDe(compartilhado.agentes, x, compartilhado.arquitetura) === a.id).map((x) => x.nome);
    const chefe = chefeDe(compartilhado.agentes, a, compartilhado.arquitetura);
    const lugar = compartilhado.arquitetura === 'rede' && a.funcao !== 'revisor' ? `${a.papel} (passa a vez para: ${vizinhosDe(compartilhado.agentes, a).map((x) => x.nome).join(', ') || 'ninguém'})`
      : compartilhado.arquitetura === 'unico' || (SEM_LIDER.includes(compartilhado.arquitetura) && a.funcao === 'revisor') ? a.papel
      : compartilhado.arquitetura === 'sequencial' ? `${a.papel} (etapa ${etapas.indexOf(a) + 1} de ${etapas.length} da esteira)`
      : subs.length ? `coordena: ${subs.join(', ')}` + (chefe ? `; responde a ${ag(chefe).nome}` : '')
      : `${a.papel} (${relacao(a)} para ${ag(chefe).nome})`;
    const pr = el('p'); pr.append('Provedor ', el('code', '', a.provedor + (a.modeloFixo ? ' / ' + a.modeloFixo : '')));
    if (a.complexidade) pr.append(' ', el('span', 'cx ' + a.complexidade, 'nível ' + NOME_CX[a.complexidade]));
    const fe = el('p'); fe.append('Pode ', el('code', '', (a.ferramentas || []).join(', ') || 'só conversar'));
    const t = el('div'); t.append(el('h2', '', a.nome + (a.funcao && a.funcao !== 'revisor' ? `, ${NOME_FUNCAO[a.funcao]}` : '')), el('p', '', lugar), pr);
    if (a.modelos && !a.modeloFixo) {
      const r = el('div', 'rotas'); for (const c of ['baixa', 'media', 'alta']) if (a.modelos[c]) { const s = el('span'); s.append(el('span', 'cx ' + c, NOME_CX[c]), a.modelos[c]); r.append(s); }
      t.append(el('p', '', 'Modelo por complexidade:'), r);
    }
    t.append(fe); f.append(t);
    $('#fichas').append(f);
  });
  depois.montarBasicos();
  montarDestinos(); atualizarResumo();
}
function montarDestinos() {
  const dst = $('#destinos'); dst.innerHTML = '';
  for (const o of [{ id: 'time', nome: 'Time' }, ...compartilhado.agentes]) {
    const b = el('button', o.id === compartilhado.destino ? 'ativo' : ''); if (o.cor) b.style.setProperty('--cor', o.cor);
    b.append(el('i'), o.nome); b.setAttribute('aria-pressed', o.id === compartilhado.destino); b.onclick = () => { compartilhado.destino = o.id; montarDestinos(); };
    dst.append(b);
  }
  $('#dicaDestino').textContent = compartilhado.destino !== 'time' ? 'Pedido direto: sem plano, testes nem revisão.' : ({ sequencial: 'A esteira roda na ordem do time.', rede: 'Na rede, o primeiro começa e cada um escolhe quem continua.', unico: 'Um agente faz tudo; o portão confere.' })[compartilhado.arquitetura] || 'O líder decide quem assume.';
}
function atualizarResumo() {
  const nos = [...document.querySelectorAll('#time .agente')];
  const ocupados = nos.filter((d) => !['disponivel', 'concluido'].includes(d.dataset.estado)).length;
  $('#time').classList.toggle('ocupado', ocupados > 0);
  const demo = compartilhado.agentes.every((a) => a.tipo === 'demo');
  { const provs = [...new Set(compartilhado.agentes.map((a) => a.provedor))]; const chip = $('#chipModelo');
    chip.replaceChildren(provs.length === 1 ? (demo ? 'Demonstração' : provs[0]) : `${provs.length} provedores`, el('small', '', demo ? 'sem custo' : 'modelos por tarefa')); }
  $('#resumo').textContent = `${compartilhado.nomeTime || 'Time'}, ${NOME_ARQ[compartilhado.arquitetura] || compartilhado.arquitetura} · ` + (ocupados ? `${ocupados} de ${compartilhado.agentes.length} trabalhando` : `${compartilhado.agentes.length} agentes, todos disponíveis`) + (demo ? ', em modo demonstração' : '');
}
const ag = (id) => compartilhado.agentes.find((a) => a.id === id) || { nome: id, cor: '#aaaaaa' };
function estado(id, e) { const d = noPalco(id); if (!d) return; d.dataset.estado = e; d.querySelector('.pilula span').textContent = ESTADOS[e] || e; atualizarResumo(); marcarAresta(id); if (compartilhado.rodando) depois.atualizarAndamento(); depois.atualizarBuzina(); }
function balao(id, texto) { const d = noPalco(id); if (!d || !texto) return; const b = d.querySelector('.balao'); b.textContent = texto.length > 130 ? texto.slice(0, 128) + '…' : texto; b.classList.add('visivel'); clearTimeout(compartilhado.baloes[id]); compartilhado.baloes[id] = setTimeout(() => b.classList.remove('visivel'), 8000); }

export { NOME_ARQ, NOME_CX, NOME_FORMA, NOME_FUNCAO, ROTULO_NIVEL, SEM_LIDER, ag, ajustarEscala, alarme, balao, desenharArestas, estado, modeloDoNivel, modeloPadrao, montarDestinos, montarGrafo, montarTime, noPalco, ns, paraUnidades, rotuloModelo, viagem };
