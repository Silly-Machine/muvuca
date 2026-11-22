// Quadro de tarefas.
// Parte da tela da Muvuca. Os arquivos de public/js/ dividem o mesmo escopo e são carregados na ordem do index.html.
/* ---------- quadro de tarefas ---------- */
// O servidor manda um evento "tarefa" com o cartão inteiro a cada mudança; aqui é só desenhar.
const tarefas = new Map();
const COLUNAS = [['afazer', 'A fazer'], ['trabalhando', 'Trabalhando'], ['bloqueado', 'Bloqueado'], ['revisao', 'Em revisão'], ['fim', 'Encerrado']];
const SELO_FIM = { pronto: ['bom', 'pronto'], falhou: ['mau', 'não aprovado'], parado: ['neutro', 'parado'] };
function desenharQuadro() {
  const lista = [...tarefas.values()];
  const bloq = lista.filter((t) => t.estado === 'bloqueado').length;
  $('#qSinal').hidden = !bloq; $('#qSinal').textContent = bloq;
  if (!document.body.classList.contains('ver-quadro')) return;
  const prontas = lista.filter((t) => t.estado === 'pronto').length;
  $('#qResumo').textContent = lista.length ? `${lista.length} tarefa(s) neste pedido, ${prontas} pronta(s)` + (bloq ? `, ${bloq} esperando você` : '') : 'as etapas do pedido aparecem aqui';
  $('#qColunas').replaceChildren(...COLUNAS.map(([col, nome]) => {
    const daqui = lista.filter((t) => (['pronto', 'falhou', 'parado'].includes(t.estado) ? 'fim' : t.estado) === col);
    const c = el('section', 'coluna'); c.dataset.col = col;
    const h = el('h3', '', nome); h.append(el('b', '', daqui.length)); c.append(h);
    if (!daqui.length) c.append(el('div', 'nada', col === 'bloqueado' ? 'ninguém travado' : 'vazio'));
    for (const t of daqui) {
      const a = ag(t.agente); const k = el('article', 'tarefa'); k.style.setProperty('--cor', a.cor);
      const q = el('div', 'quem'); const img = el('img'); img.alt = '';
      img.src = `/bonecos/${PERSONAGENS[a.forma] ? a.forma : 'regente'}-${t.estado === 'trabalhando' ? 'trabalhando' : t.estado === 'bloqueado' ? 'aguardando' : t.estado === 'pronto' ? 'concluido' : 'disponivel'}.webp`;
      q.append(img, a.nome); k.append(q, el('p', '', t.titulo));
      const r = el('div', 'rodape');
      if (t.complexidade) r.append(el('span', 'cx ' + t.complexidade, NOME_CX[t.complexidade]));
      if (SELO_FIM[t.estado]) r.append(el('span', 'selo ' + SELO_FIM[t.estado][0], SELO_FIM[t.estado][1]));
      if (t.arquivos) r.append(el('span', '', `${t.arquivos} arquivo(s)`));
      if (r.childNodes.length) k.append(r);
      if (t.motivo) k.append(el('p', 'motivo', t.motivo));
      c.append(k);
    }
    return c;
  }));
}
