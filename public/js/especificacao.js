// Especificação em etapas: o painel no topo da conversa que mostra o andamento de um trabalho longo, etapa por etapa,
// e deixa pausar, retomar, pular a etapa que travou ou cancelar. O progresso fica gravado no servidor: se a Muvuca
// fechar no meio, o painel reaparece com a especificação pausada.
import { depois } from './tardias.js';
import { $, avisar, el, lerDoServidor, pedir } from './base.js';

/* ---------- especificação em etapas ---------- */
const SINAL = { pendente: '○', rodando: '◐', pronta: '✓', falhou: '✗', pulada: '–' };
const NOME_ESTADO = { planejando: 'planejando as etapas…', rodando: 'em andamento', pausada: 'pausada', concluida: 'concluída', cancelada: 'cancelada' };
async function acao(nome) {
  const r = await pedir('/api/especificacao/acao', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ acao: nome }) });
  if (!r.ok) avisar('Não deu: ' + ((await r.json().catch(() => ({}))).erro || r.status));
  else if (nome === 'fechar') desenharEspec(null);
}
function desenharEspec(e) {
  const painel = $('#espec');
  if (!e || !e.id) { painel.hidden = true; painel.replaceChildren(); return; }
  painel.hidden = false; painel.dataset.estado = e.estado; painel.replaceChildren();
  const feitas = e.etapas.filter((x) => x.estado === 'pronta' || x.estado === 'pulada').length;
  const cab = el('header');
  cab.append(el('b', '', e.titulo), el('small', '', e.etapas.length ? `${feitas} de ${e.etapas.length} etapas · ${NOME_ESTADO[e.estado] || e.estado}` : NOME_ESTADO[e.estado] || e.estado));
  painel.append(cab);
  if (e.motivo && e.estado !== 'rodando') painel.append(el('p', 'motivo', e.motivo.charAt(0).toUpperCase() + e.motivo.slice(1) + '.'));
  if (e.etapas.length) {
    const lista = el('ol');
    e.etapas.forEach((x, i) => {
      const li = el('li', x.estado + (i === e.atual && e.estado !== 'concluida' ? ' atual' : ''));
      li.title = [x.aceite && `Como conferir: ${x.aceite}`, x.tentativas > 1 && `${x.tentativas} tentativas`].filter(Boolean).join(' · ');
      li.append(el('i', '', SINAL[x.estado] || '○'), el('span', '', x.titulo));
      if (x.resumo && x.estado !== 'pendente') li.append(el('small', '', x.resumo));
      lista.append(li);
    });
    painel.append(lista);
  }
  const bs = el('div', 'botoes');
  const botao = (rotulo, nome, classe = '') => { const b = el('button', classe, rotulo); b.type = 'button'; b.onclick = () => acao(nome); bs.append(b); };
  if (e.estado === 'rodando') botao('Pausar', 'pausar');
  if (e.estado === 'pausada') { botao('Retomar', 'retomar', 'primario'); if (e.atual >= 0) botao('Pular esta etapa', 'pular'); }
  if (['planejando', 'rodando', 'pausada'].includes(e.estado)) botao('Cancelar', 'cancelar');
  if (['concluida', 'cancelada'].includes(e.estado)) botao('Tirar da tela', 'fechar');
  painel.append(bs);
  if (e.estado === 'concluida') painel.append(el('p', 'nota', 'Todas as etapas passaram. As mudanças de todas elas esperam uma decisão só: manter ou descartar.'));
}

// ao abrir a página: se a conversa tem uma especificação (andando, pausada ou terminada), o painel volta
(async () => { try { desenharEspec((await lerDoServidor('/api/especificacao')).especificacao); } catch { /* sem especificação, sem painel */ } })();

// chamadas por arquivos carregados antes deste, em resposta a eventos (ver tardias.js)
Object.assign(depois, { desenharEspec });
