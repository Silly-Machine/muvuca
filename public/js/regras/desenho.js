// Onde cada agente fica no desenho do time. Sem DOM: serve à prévia, ao palco e aos testes.
// As posições são em unidades de desenho: 1 na horizontal é a largura de um agente, 1 na vertical é uma camada.
// Cada vista converte unidades em pixels com a sua escala, então o mesmo desenho serve à prévia e ao palco.

const SEM_LIDER = ['unico', 'sequencial', 'rede'];
const PESO = { coordena: 0, executa: 1, consulta: 2, revisa: 3 };
const LIMITE = 200;   // o servidor guarda só posições dentro de ±200 unidades

// Relação de cada agente com quem está acima dele.
export const relacao = (a) => (a.funcao === 'revisor' ? 'revisa' : a.funcao === 'sublider' ? 'coordena' : (a.ferramentas || []).includes('escrever') ? 'executa' : 'consulta');

// A quem o agente responde. Esteira e rede não têm chefia; sem "chefe", responde ao líder.
export function chefeDe(lista, a, arq) {
  if (!a || SEM_LIDER.includes(arq) || a.funcao === 'lider') return null;
  const lider = lista.find((x) => x.funcao === 'lider');
  if (a.chefe && a.chefe !== a.id && lista.some((x) => x.id === a.chefe && (x.funcao === 'lider' || x.funcao === 'sublider'))) return a.chefe;
  return lider && lider.id !== a.id ? lider.id : null;
}

// Na rede, sem "conexoes" o agente passa para todos os outros membros. O revisor fica fora.
export const vizinhosDe = (lista, a) => (a.funcao === 'revisor' ? [] : lista).filter((x) => x.id !== a.id && x.funcao !== 'revisor' && (!Array.isArray(a.conexoes) || a.conexoes.includes(x.id)));

// Ordem da esteira: a lista, com o revisor no fim.
export const fila = (lista) => [...lista.filter((a) => a.funcao !== 'revisor'), ...lista.filter((a) => a.funcao === 'revisor')];

// As setas do time, [de, para], conforme a arquitetura.
export function relacoes(time) {
  const lista = time.agentes || [], arq = time.arquitetura;
  if (arq === 'sequencial' || arq === 'unico') { const f = fila(lista); return f.slice(1).map((a, i) => [f[i].id, a.id]); }
  if (arq === 'rede') return lista.flatMap((a) => vizinhosDe(lista, a).map((b) => [a.id, b.id]));
  return lista.map((a) => [chefeDe(lista, a, arq), a.id]).filter(([c]) => c);
}

export const posicaoValida = (p) => Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= LIMITE);
const arred = (v) => Math.round(v * 100) / 100 || 0;   // "|| 0" troca o -0 por 0

// Centra em x = 0 e começa em y = 0.
function centrar(pos) {
  const c = caixa(pos); if (!c) return pos;
  const dx = (c.x0 + c.x1) / 2, dy = c.y0;
  return Object.fromEntries(Object.entries(pos).map(([id, [x, y]]) => [id, [arred(x - dx), arred(y - dy)]]));
}

// Supervisor e hierárquica: a chefia é uma árvore. Folhas em colunas seguidas; cada chefe centrado sobre os seus.
// Numa árvore desenhada assim nenhuma seta cruza outra, em qualquer profundidade.
function arvore(lista, arq) {
  const pos = {}, vistos = new Set(); let coluna = 0;
  const filhos = (id) => lista.filter((a) => !vistos.has(a.id) && chefeDe(lista, a, arq) === id)
    .map((a, i) => [a, i]).sort(([x, i], [y, j]) => PESO[relacao(x)] - PESO[relacao(y)] || i - j).map(([a]) => a);
  const colocar = (a, prof) => {
    vistos.add(a.id);
    const fs = filhos(a.id); fs.forEach((f) => vistos.add(f.id));
    if (!fs.length) { pos[a.id] = [coluna++, prof]; return; }
    fs.forEach((f) => colocar(f, prof + 1));
    pos[a.id] = [(pos[fs[0].id][0] + pos[fs.at(-1).id][0]) / 2, prof];
  };
  const topo = lista.find((a) => a.funcao === 'lider') || lista[0];
  if (topo) colocar(topo, 0);
  // sem chefe válido: uma linha embaixo, sem seta
  const soltos = lista.filter((a) => !vistos.has(a.id));
  const fundo = Math.max(-1, ...Object.values(pos).map(([, y]) => y)) + 1;
  soltos.forEach((a, i) => { pos[a.id] = [i - (soltos.length - 1) / 2, fundo]; });
  return pos;
}

// Rede em anel: os membros num círculo, o primeiro (quem começa) no topo; o revisor embaixo, fora do anel.
function anel(lista) {
  const membros = lista.filter((a) => a.funcao !== 'revisor'), n = membros.length, pos = {};
  // o raio garante pelo menos 1,2 unidade entre vizinhos no círculo
  const r = n < 2 ? 0 : Math.max(1, 0.6 / Math.sin(Math.PI / n)), ry = r * 0.85;
  membros.forEach((a, i) => { const g = -Math.PI / 2 + (i * 2 * Math.PI) / n; pos[a.id] = [Math.cos(g) * r, ry + Math.sin(g) * ry]; });
  lista.filter((a) => a.funcao === 'revisor').forEach((a, i) => { pos[a.id] = [i, 2 * ry + 1.2]; });
  return pos;
}

// Rede em camadas: camada é a distância a partir do primeiro membro, seguindo quem passa a vez;
// duas passadas de baricentro (média das colunas dos vizinhos da camada de cima) reduzem os cruzamentos.
function camadasDaRede(lista) {
  const membros = lista.filter((a) => a.funcao !== 'revisor'); if (!membros.length) return fila(lista).reduce((p, a, i) => ({ ...p, [a.id]: [i, 0] }), {});
  const prof = new Map([[membros[0].id, 0]]), ordem = [membros[0]];
  for (let k = 0; k < ordem.length; k++) for (const b of vizinhosDe(lista, ordem[k])) if (!prof.has(b.id)) { prof.set(b.id, prof.get(ordem[k].id) + 1); ordem.push(b); }
  const fundo = Math.max(...prof.values()) + 1;
  for (const a of membros) if (!prof.has(a.id)) prof.set(a.id, fundo);
  const linhas = [];
  for (const a of membros) (linhas[prof.get(a.id)] ||= []).push(a);
  const ligados = (a, b) => vizinhosDe(lista, a).some((x) => x.id === b.id) || vizinhosDe(lista, b).some((x) => x.id === a.id);
  for (let passada = 0; passada < 2; passada++) {
    for (let k = 1; k < linhas.length; k++) {
      if (!linhas[k]) continue;
      const cima = linhas[k - 1] || [];
      const bari = (a) => { const cols = cima.map((b, i) => (ligados(a, b) ? i : null)).filter((i) => i !== null); return cols.length ? cols.reduce((s, i) => s + i, 0) / cols.length : Infinity; };
      linhas[k] = linhas[k].map((a, i) => [a, bari(a), i]).sort((x, y) => (x[1] - y[1]) || (x[2] - y[2])).map(([a]) => a);
    }
  }
  const pos = {};
  linhas.forEach((l, y) => l?.forEach((a, i) => { pos[a.id] = [i - (l.length - 1) / 2, y]; }));
  const ultima = linhas.length;
  lista.filter((a) => a.funcao === 'revisor').forEach((a, i) => { pos[a.id] = [i, ultima]; });
  return pos;
}

// Desenho automático do time inteiro: { id: [x, y] }. Sempre o mesmo para o mesmo time.
export function layoutAutomatico(time, opcoes = {}) {
  const lista = time.agentes || [], arq = time.arquitetura || 'centralizada';
  if (!lista.length) return {};
  if (arq === 'sequencial' || arq === 'unico') return centrar(Object.fromEntries(fila(lista).map((a, i) => [a.id, [i, 0]])));
  if (arq === 'rede') return centrar((opcoes.rede || time.desenho?.rede) === 'camadas' ? camadasDaRede(lista) : anel(lista));
  return centrar(arvore(lista, arq));
}

// Retângulo que envolve as posições, ou null sem nenhuma.
export function caixa(pos) {
  const v = Object.values(pos || {}); if (!v.length) return null;
  const xs = v.map(([x]) => x), ys = v.map(([, y]) => y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

// Dois agentes se cobrem quando estão a menos de uma unidade nas duas direções.
const cobre = (a, b) => Math.abs(a[0] - b[0]) < 1 && Math.abs(a[1] - b[1]) < 1;

// O lugar livre mais perto de "alvo", numa grade de meia unidade. Mais perto vem primeiro; no empate,
// a mesma linha antes de mudar de linha, e a direita antes da esquerda.
export function lugarLivre(ocupados, alvo) {
  const [ax, ay] = alvo;
  const livre = (p) => !ocupados.some((o) => cobre(o, p));
  if (livre(alvo)) return [arred(ax), arred(ay)];
  for (let r = 1; r <= 60; r++) {
    const cands = [];
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) if (Math.max(Math.abs(i), Math.abs(j)) === r) cands.push([i / 2, j / 2]);
    cands.sort((p, q) => Math.hypot(p[0], p[1] * 1.3) - Math.hypot(q[0], q[1] * 1.3) || Math.abs(p[1]) - Math.abs(q[1]) || p[1] - q[1] || q[0] - p[0]);
    for (const [dx, dy] of cands) { const p = [ax + dx, ay + dy]; if (livre(p)) return [arred(p[0]), arred(p[1])]; }
  }
  return [arred(ax), arred(ay)];
}

// Posições de todos os agentes: quem já tem posição fica onde está; quem não tem ganha um lugar livre perto de
// onde faz sentido (o ponto pedido em "perto", o chefe, o anterior da esteira, um vizinho na rede).
// Se ninguém tem posição, vale o desenho automático. Não altera o time recebido.
export function completar(time, opcoes = {}) {
  const lista = time.agentes || [], arq = time.arquitetura || 'centralizada', perto = opcoes.perto || {};
  const fixos = lista.filter((a) => posicaoValida(a.pos));
  if (!fixos.length) {
    const auto = layoutAutomatico(time, opcoes);
    // o ponto pedido vale mesmo quando o resto é automático (o primeiro agente solto numa prévia vazia)
    for (const [id, p] of Object.entries(perto)) if (auto[id] && posicaoValida(p) && lista.length === 1) auto[id] = [arred(p[0]), arred(p[1])];
    return auto;
  }
  const pos = Object.fromEntries(fixos.map((a) => [a.id, [...a.pos]]));
  const f = fila(lista);
  for (const a of lista) {
    if (pos[a.id]) continue;
    let alvo = posicaoValida(perto[a.id]) ? perto[a.id] : null;
    if (!alvo && !SEM_LIDER.includes(arq)) { const c = pos[chefeDe(lista, a, arq)]; if (c) alvo = [c[0], c[1] + 1]; }
    if (!alvo && (arq === 'sequencial' || arq === 'unico')) { const ant = pos[f[f.indexOf(a) - 1]?.id]; if (ant) alvo = [ant[0] + 1, ant[1]]; }
    if (!alvo && arq === 'rede') { const v = vizinhosDe(lista, a).find((b) => pos[b.id]); if (v) alvo = [pos[v.id][0] + 1, pos[v.id][1]]; }
    if (!alvo) { const c = caixa(pos); alvo = [(c.x0 + c.x1) / 2, c.y1 + 1]; }
    pos[a.id] = lugarLivre(Object.values(pos), alvo);
  }
  return pos;
}

// ---------- caminho das setas ----------
// Cada ponta é { x, topo, base, meio, raio }: o centro, o alto e o pé do agente, a altura do meio e meia largura.
// Dois estilos, escolhidos no construtor e guardados em desenho.setas:
//   "quadradas": cotovelo de cantos vivos, só trechos retos na horizontal e na vertical;
//   "arredondadas": curva suave do mesmo ponto de saída ao mesmo ponto de chegada.
export const ESTILOS_DE_SETA = ['quadradas', 'arredondadas'];
export const estiloDaSeta = (desenho) => (desenho?.setas === 'arredondadas' ? 'arredondadas' : 'quadradas');
const n2 = (v) => Math.round(v * 100) / 100;
function cotovelo(x1, y1, x2, y2, vertical, estilo) {
  [x1, y1, x2, y2] = [x1, y1, x2, y2].map(n2);
  if (vertical) {
    if (Math.abs(x2 - x1) < 1) return `M${x1} ${y1}V${y2}`;
    const ym = n2((y1 + y2) / 2);
    return estilo === 'arredondadas' ? `M${x1} ${y1}C${x1} ${ym} ${x2} ${ym} ${x2} ${y2}` : `M${x1} ${y1}V${ym}H${x2}V${y2}`;
  }
  if (Math.abs(y2 - y1) < 1) return `M${x1} ${y1}H${x2}`;
  const xm = n2((x1 + x2) / 2);
  return estilo === 'arredondadas' ? `M${x1} ${y1}C${xm} ${y1} ${xm} ${y2} ${x2} ${y2}` : `M${x1} ${y1}H${xm}V${y2}H${x2}`;
}
// De A até B em qualquer posição: B embaixo, do pé de A à cabeça de B; B em cima, da cabeça de A ao pé de B;
// lado a lado, de lateral a lateral.
export function rotaDaSeta(A, B, estilo = 'quadradas') {
  if (B.topo >= A.base + 8) return cotovelo(A.x, A.base, B.x, B.topo, true, estilo);
  if (A.topo >= B.base + 8) return cotovelo(A.x, A.topo, B.x, B.base, true, estilo);
  const s = Math.sign(B.x - A.x) || 1;
  return cotovelo(A.x + s * (A.raio - 2), A.meio, B.x - s * (B.raio - 2), B.meio, false, estilo);
}
// Rede: linha de centro a centro, recuada para não entrar no agente. Arredondada, ela se curva um pouco para o lado.
export function retaDaRede(A, B, estilo = 'quadradas', recuo = 0.84) {
  const dx = B.x - A.x, dy = B.meio - A.meio, d = Math.hypot(dx, dy) || 1, ka = A.raio * recuo / d, kb = B.raio * recuo / d;
  const [x1, y1, x2, y2] = [A.x + dx * ka, A.meio + dy * ka, B.x - dx * kb, B.meio - dy * kb].map(n2);
  if (estilo !== 'arredondadas') return `M${x1} ${y1}L${x2} ${y2}`;
  const curva = Math.min(40, d * 0.15);   // o controle sai do meio, na perpendicular
  return `M${x1} ${y1}Q${n2((x1 + x2) / 2 - dy / d * curva)} ${n2((y1 + y2) / 2 + dx / d * curva)} ${x2} ${y2}`;
}
