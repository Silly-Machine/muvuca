// O palco e o grafo de setas (usado também pela prévia do construtor).
// Parte da tela da Muvuca. Os arquivos de public/js/ dividem o mesmo escopo e são carregados na ordem do index.html.
/* ---------- palco ---------- */
PERSONAGENS.salsicha = PERSONAGENS.regente;   // a Buzina só tem versão em imagem (public/bonecos/salsicha-*.webp)
const NOME_CX = { baixa: 'baixa', media: 'média', alta: 'alta' };
const NOME_FUNCAO = { '': 'executor', lider: 'líder', sublider: 'sub-líder', revisor: 'revisor' };
const NOME_FORMA = { salsicha: 'Buzina, a salsicha astronauta', cartola: 'Maestro de cartola', engrenagem: 'Engrenagem', regente: 'Cápsula de batuta', pilha: 'Pilha de discos', cristal: 'Cristal lapidado', lente: 'Esfera de lente', escudo: 'Escudo de óculos', tela: 'Monitor de antena', gota: 'Gota', nuvem: 'Nuvem', cogumelo: 'Cogumelo', polvo: 'Polvo', foguete: 'Foguete', gato: 'Gato vigia', livro: 'Livro', planta: 'Vaso de planta' };
const NOME_ARQ = { unico: 'agente único', centralizada: 'supervisor', hierarquica: 'hierárquica', sequencial: 'esteira', rede: 'rede' };
const SEM_LIDER = ['unico', 'sequencial', 'rede'];
let liderId = null, arquitetura = 'centralizada', nomeTime = '', arquiteturas = {}, provedores = [];
// Relação de cada agente com quem está acima dele, escrita na aresta do grafo.
const relacao = (a) => (a.funcao === 'revisor' ? 'revisa' : a.funcao === 'sublider' ? 'coordena' : (a.ferramentas || []).includes('escrever') ? 'executa' : 'consulta');
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
// A quem o agente responde. Esteira não tem chefia; sem "chefe", responde ao líder.
function chefeDe(lista, a, arq) {
  if (!a || SEM_LIDER.includes(arq) || a.funcao === 'lider') return null;
  const lider = lista.find((x) => x.funcao === 'lider');
  if (a.chefe && a.chefe !== a.id && lista.some((x) => x.id === a.chefe && (x.funcao === 'lider' || x.funcao === 'sublider'))) return a.chefe;
  return lider && lider.id !== a.id ? lider.id : null;
}
// Linhas do grafo: o líder no topo, e cada linha seguinte com quem responde à linha de cima.
function camadas(lista, arq) {
  if (arq === 'sequencial' || arq === 'unico') return [[...lista.filter((a) => a.funcao !== 'revisor'), ...lista.filter((a) => a.funcao === 'revisor')]];
  if (arq === 'rede') return [lista.filter((a) => a.funcao !== 'revisor'), lista.filter((a) => a.funcao === 'revisor')].filter((l) => l.length);
  const peso = { coordena: 0, executa: 1, consulta: 2, revisa: 3 };
  const topo = lista.find((a) => a.funcao === 'lider') || lista[0]; if (!topo) return [];
  const linhas = [[topo]], vistos = new Set([topo.id]);
  while (linhas.length < 6) {
    const prox = linhas.at(-1).flatMap((p) => lista.filter((a) => !vistos.has(a.id) && chefeDe(lista, a, arq) === p.id).sort((x, y) => peso[relacao(x)] - peso[relacao(y)]));
    if (!prox.length) break;
    prox.forEach((a) => vistos.add(a.id)); linhas.push(prox);
  }
  const soltos = lista.filter((a) => !vistos.has(a.id));   // sem chefe válido: aparecem embaixo, sem aresta
  if (soltos.length) linhas.push(soltos);
  return linhas;
}
function montarGrafo(raiz, lista, arq, sufixo = '') {
  raiz.innerHTML = `<svg class="arestas" aria-hidden="true"><defs><marker id="seta${sufixo}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker></defs></svg>`;
  raiz._lista = lista; raiz._arq = arq; raiz._sufixo = sufixo;
  camadas(lista, arq).forEach((linha, n) => {
    const anel = arq === 'rede' && n === 0 && linha.length > 1;
    const l = el('div', 'nivel' + (arq === 'sequencial' || arq === 'unico' || (arq === 'rede' && !anel) ? ' seq' : '') + (anel ? ' anel' : '') + (!anel && linha.length > 4 ? ' cheia' : '')); l.dataset.nivel = Math.min(n, 2);
    for (const a of linha) {
      const i = lista.indexOf(a);
      const d = el('div', 'agente' + (lista.some((x) => x.chefe === a.id) ? ' chefe' : '')); d.dataset.ag = a.id; d.dataset.estado = 'disponivel'; d.style.setProperty('--cor', a.cor); d.style.setProperty('--i', i);
      d.innerHTML = `<div class="foco"></div><div class="chao"></div><div class="balao"></div>${mascote(a, i, sufixo)}<div class="nome"></div><div class="prov"></div><div class="pilula"><i></i><span>Disponível</span></div>`;
      d.querySelector('.nome').textContent = a.nome || '(sem nome)';
      l.append(d);
    }
    raiz.append(l);
    if (anel) dispor(l);
  });
  // desenha no próximo quadro; o temporizador cobre a aba em segundo plano, onde o navegador segura os quadros
  let feito = false; const desenhar = () => { if (feito || !raiz.isConnected) return; feito = true; desenharArestas(raiz); };
  requestAnimationFrame(desenhar); setTimeout(desenhar, 120);
}
// Anel da rede: os membros em volta de um círculo, o primeiro (quem começa) no topo.
function dispor(l) {
  const nos = [...l.children], n = nos.length; if (!n) return;
  const w = nos[0].offsetWidth || 140, h = nos[0].offsetHeight || 190;
  // o raio acompanha o tamanho do boneco: o mesmo anel serve ao palco e à prévia pequena
  const r = Math.max(w * (n <= 3 ? .85 : 1.05), n * w * .3), ry = r * (n <= 3 ? .8 : .9);
  l.style.width = (2 * r + w) + 'px'; l.style.height = (2 * ry + h) + 'px';
  nos.forEach((d, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    d.style.left = (r + Math.cos(ang) * r) + 'px'; d.style.top = (ry + Math.sin(ang) * ry) + 'px';
  });
}
// Na rede, sem "conexoes" o agente passa para todos os outros membros.
const vizinhosDe = (lista, a) => (a.funcao === 'revisor' ? [] : lista).filter((x) => x.id !== a.id && x.funcao !== 'revisor' && (!Array.isArray(a.conexoes) || a.conexoes.includes(x.id)));
// Linha reta entre dois membros do anel, recuada para não entrar no boneco.
function reta(A, B, recuo = .84) {
  const dx = B.x - A.x, dy = B.meio - A.meio, d = Math.hypot(dx, dy) || 1, ka = A.raio * recuo / d, kb = B.raio * recuo / d;
  return `M${A.x + dx * ka} ${A.meio + dy * ka}L${B.x - dx * kb} ${B.meio - dy * kb}`;
}
const ns = (tag, at) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const k in at) e.setAttribute(k, at[k]); return e; };
// Posição dentro da raiz pela soma de offsets: ignora as animações de entrada e de respiração.
function posicao(raiz, id) {
  const d = noAg(raiz, id); if (!d || !d.offsetWidth) return null;
  let x = 0, y = 0, n = d; while (n && n !== raiz) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
  let p = d.querySelector('.pilula'); if (!p.offsetHeight) p = d.querySelector('.nome');
  const tam = d.querySelector('.mascote').clientWidth || 100;
  return { x: x + d.offsetWidth / 2, topo: y + 6, base: y + p.offsetTop + p.offsetHeight + 6, meio: y + tam * .62, raio: tam / 2 };
}
// Do pé do chefe até a cabeça de quem responde a ele, em cotovelo de cantos arredondados.
function cotovelo(a, b) {
  const ym = (a.base + b.topo) / 2, dx = b.x - a.x, s = Math.sign(dx), r = Math.max(0, Math.min(10, Math.abs(dx) / 2, (b.topo - a.base) / 2));
  if (Math.abs(dx) < 1) return `M${a.x} ${a.base}V${b.topo}`;
  return `M${a.x} ${a.base}V${ym - r}Q${a.x} ${ym} ${a.x + s * r} ${ym}H${b.x - s * r}Q${b.x} ${ym} ${b.x} ${ym + r}V${b.topo}`;
}
const arco = (a, b) => `M${a.x} ${a.topo}Q${(a.x + b.x) / 2} ${Math.min(a.topo, b.topo) - 70} ${b.x} ${b.topo}`;
const seta = (a, b) => `M${a.x + a.raio - 2} ${a.meio}H${b.x - b.raio + 2}`;
function desenharArestas(raiz = palco()) {
  const svg = raiz.querySelector('.arestas'), lista = raiz._lista; if (!svg || !lista) return;
  svg.querySelectorAll('.aresta, .rel').forEach((e) => e.remove());
  const defs = svg.querySelector('defs'), por = (e) => svg.insertBefore(e, defs.nextSibling);
  if (raiz._arq === 'rede') {
    const feitos = new Set();
    for (const a of lista) for (const b of vizinhosDe(lista, a)) {
      const chave = [a.id, b.id].sort().join('|'); if (feitos.has(chave)) continue; feitos.add(chave);
      const A = posicao(raiz, a.id), B = posicao(raiz, b.id); if (!A || !B) continue;
      const volta = vizinhosDe(lista, b).some((x) => x.id === a.id);   // B também passa para A: ponta dos dois lados
      const p = ns('path', { class: 'aresta rede', d: reta(A, B), 'data-de': a.id, 'data-para': b.id, ...(volta ? { 'data-volta': '1' } : {}), 'marker-end': `url(#seta${raiz._sufixo})`, ...(volta ? { 'marker-start': `url(#seta${raiz._sufixo})` } : {}) });
      p.style.setProperty('--cor', b.cor); por(p);
    }
    const membros = lista.filter((x) => x.funcao !== 'revisor');
    const E = membros.length > 1 && posicao(raiz, membros[0].id);
    if (E) { const t = ns('text', { class: 'rel', x: E.x - E.raio - 6, y: E.meio, 'text-anchor': 'end' }); t.textContent = 'começa aqui →'; por(t); }
  } else if (raiz._arq === 'sequencial' || raiz._arq === 'unico') {
    const fila = camadas(lista, 'sequencial')[0];
    for (let i = 1; i < fila.length; i++) {
      const A = posicao(raiz, fila[i - 1].id), B = posicao(raiz, fila[i].id); if (!A || !B) continue;
      const p = ns('path', { class: 'aresta' + (fila[i].funcao === 'revisor' ? ' revisa' : ''), d: seta(A, B), 'data-de': fila[i - 1].id, 'data-para': fila[i].id, 'marker-end': `url(#seta${raiz._sufixo})` });
      p.style.setProperty('--cor', fila[i].cor); por(p);
    }
  } else {
    for (const x of lista) {
      const c = chefeDe(lista, x, raiz._arq); if (!c) continue;
      const A = posicao(raiz, c), B = posicao(raiz, x.id); if (!A || !B) continue;
      const p = ns('path', { class: 'aresta' + (relacao(x) === 'revisa' ? ' revisa' : ''), d: cotovelo(A, B), 'data-de': c, 'data-para': x.id, 'marker-end': `url(#seta${raiz._sufixo})` }); p.style.setProperty('--cor', x.cor);
      const t = ns('text', { class: 'rel', x: B.x, y: (A.base + B.topo) / 2 - 6, 'text-anchor': 'middle', 'data-para': x.id }); t.textContent = relacao(x);
      por(t); por(p);
    }
  }
  if (raiz === palco()) lista.forEach((x) => marcarAresta(x.id));
  // na prévia do construtor, cada seta ganha uma área de clique larga (uma por sentido) e, quando dá para tirá-la, um botão "×"
  if (raiz.id === 'previa') {
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
    marcarSetaSel();
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
  if (chefeDe(lista, achar(para), raiz._arq) === de) d = cotovelo(A, B);
  else if (chefeDe(lista, achar(de), raiz._arq) === para) { d = cotovelo(B, A); volta = true; }
  else if (raiz._arq === 'rede' && vizinhosDe(lista, achar(de) || {}).some((x) => x.id === para)) d = reta(A, B);
  else if (raiz._arq === 'sequencial' && A.x < B.x && Math.abs(lista.indexOf(achar(de)) - lista.indexOf(achar(para))) === 1) d = seta(A, B);
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

function montarTime() {
  liderId = SEM_LIDER.includes(arquitetura) ? null : (agentes.find((a) => a.funcao === 'lider') || agentes[0])?.id;
  $('#time').innerHTML = '<div class="grafo"></div>';
  montarGrafo(palco(), agentes, arquitetura); requestAnimationFrame(ajustarEscala);
  agentes.forEach((a) => rotuloModelo(a.id, modeloPadrao(a)));
  $('#fichas').innerHTML = '';
  const tituloTime = el('h2', 'sec', 'Time no palco'); tituloTime.append(el('small', '', `${nomeTime || 'sem nome'} · ${agentes.length} agente(s)`)); $('#fichas').append(tituloTime);
  const fila = camadas(agentes, arquitetura)[0] || [];
  agentes.forEach((a, i) => {
    const f = el('div', 'ficha'); f.innerHTML = mascote(a, i, 's');
    const subs = agentes.filter((x) => chefeDe(agentes, x, arquitetura) === a.id).map((x) => x.nome);
    const chefe = chefeDe(agentes, a, arquitetura);
    const lugar = arquitetura === 'rede' && a.funcao !== 'revisor' ? `${a.papel} (passa a vez para: ${vizinhosDe(agentes, a).map((x) => x.nome).join(', ') || 'ninguém'})`
      : arquitetura === 'unico' || (SEM_LIDER.includes(arquitetura) && a.funcao === 'revisor') ? a.papel
      : arquitetura === 'sequencial' ? `${a.papel} (etapa ${fila.indexOf(a) + 1} de ${fila.length} da esteira)`
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
  montarBasicos();
  montarDestinos(); atualizarResumo();
}
function montarDestinos() {
  const dst = $('#destinos'); dst.innerHTML = '';
  for (const o of [{ id: 'time', nome: 'Time' }, ...agentes]) {
    const b = el('button', o.id === destino ? 'ativo' : ''); if (o.cor) b.style.setProperty('--cor', o.cor);
    b.append(el('i'), o.nome); b.setAttribute('aria-pressed', o.id === destino); b.onclick = () => { destino = o.id; montarDestinos(); };
    dst.append(b);
  }
  $('#dicaDestino').textContent = destino !== 'time' ? 'Pedido direto: sem plano, testes nem revisão.' : ({ sequencial: 'A esteira roda na ordem do time.', rede: 'Na rede, o primeiro começa e cada um escolhe quem continua.', unico: 'Um agente faz tudo; o portão confere.' })[arquitetura] || 'O líder decide quem assume.';
}
function atualizarResumo() {
  const nos = [...document.querySelectorAll('#time .agente')];
  const ocupados = nos.filter((d) => !['disponivel', 'concluido'].includes(d.dataset.estado)).length;
  $('#time').classList.toggle('ocupado', ocupados > 0);
  const demo = agentes.every((a) => a.tipo === 'demo');
  { const provs = [...new Set(agentes.map((a) => a.provedor))]; const chip = $('#chipModelo');
    chip.replaceChildren(provs.length === 1 ? (demo ? 'Demonstração' : provs[0]) : `${provs.length} provedores`, el('small', '', demo ? 'sem custo' : 'modelos por tarefa')); }
  $('#resumo').textContent = `${nomeTime || 'Time'}, ${NOME_ARQ[arquitetura] || arquitetura} · ` + (ocupados ? `${ocupados} de ${agentes.length} trabalhando` : `${agentes.length} agentes, todos disponíveis`) + (demo ? ', em modo demonstração' : '');
}
const ag = (id) => agentes.find((a) => a.id === id) || { nome: id, cor: '#aaaaaa' };
function estado(id, e) { const d = noPalco(id); if (!d) return; d.dataset.estado = e; d.querySelector('.pilula span').textContent = ESTADOS[e] || e; atualizarResumo(); marcarAresta(id); if (rodando) atualizarAndamento(); atualizarBuzina(); }
function balao(id, texto) { const d = noPalco(id); if (!d || !texto) return; const b = d.querySelector('.balao'); b.textContent = texto.length > 130 ? texto.slice(0, 128) + '…' : texto; b.classList.add('visivel'); clearTimeout(baloes[id]); baloes[id] = setTimeout(() => b.classList.remove('visivel'), 8000); }
