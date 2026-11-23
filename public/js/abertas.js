// Conversas abertas: a faixa no topo que mostra as conversas em andamento e deixa alternar, abrir e fechar.
// Cada conversa tem o próprio time, a própria pasta e os próprios pedidos; assim dá para tocar mais de um pedido
// ao mesmo tempo. Trocar de conversa recarrega a página no endereço dela (?conversa=2): a tela inteira é de uma só.
import { $, CONVERSA, avisar, el, pedir } from './base.js';

/* ---------- conversas abertas ---------- */
const ir = (id) => { const q = new URLSearchParams(location.search); if (id === '1') q.delete('conversa'); else q.set('conversa', id); q.delete('t'); location.assign(location.pathname + (q.size ? '?' + q : '')); };
const rotulo = (c) => (c.rodando ? (c.aguardando ? 'esperando você' : 'trabalhando') : c.pendente ? 'mudanças esperando decisão' : 'parada');
const nomeDaPasta = (p) => String(p || '').split(/[\\/]/).filter(Boolean).pop() || '';
async function acao(corpo) {
  const r = await pedir('/api/sessoes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.erro || r.status);
  return j;
}
let anterior = '';
async function desenhar() {
  let j; try { const r = await pedir('/api/sessoes'); if (!r.ok) return; j = await r.json(); } catch { return; }
  // a conversa desta página foi fechada em outra janela: volta para a principal
  if (!j.conversas.some((c) => c.id === CONVERSA)) return ir('1');
  const marca = JSON.stringify(j.conversas); if (marca === anterior) return; anterior = marca;
  const faixa = $('#abertas'); faixa.replaceChildren();
  // com uma conversa só, a faixa mostra apenas o botão de abrir outra
  for (const c of (j.conversas.length > 1 ? j.conversas : [])) {
    const b = el('button', 'aberta' + (c.id === CONVERSA ? ' atual' : '') + (c.rodando ? ' rodando' : c.pendente ? ' pendente' : '')); b.type = 'button';
    b.title = `Conversa ${c.id}: ${rotulo(c)}${c.projeto ? ' · ' + c.projeto : ''}${c.titulo ? ' · ' + c.titulo : ''}`;
    b.setAttribute('aria-current', c.id === CONVERSA ? 'page' : 'false');
    b.append(el('i'), el('span', '', `Conversa ${c.id}`), el('small', '', nomeDaPasta(c.projeto)));
    b.onclick = () => { if (c.id !== CONVERSA) ir(c.id); };
    if (c.id !== '1' && !c.rodando && !c.pendente) {
      const x = el('span', 'fechar', '×'); x.title = `Fechar a conversa ${c.id} (ela vai para o histórico)`; x.setAttribute('role', 'button'); x.setAttribute('aria-label', x.title);
      x.onclick = async (e) => { e.stopPropagation(); try { await acao({ acao: 'fechar', id: c.id }); if (c.id === CONVERSA) ir('1'); else { anterior = ''; desenhar(); } } catch (err) { avisar(err.message); } };
      b.append(x);
    }
    faixa.append(b);
  }
  if (j.conversas.length < j.maximo) {
    const mais = el('button', 'aberta nova', j.conversas.length > 1 ? '+' : '+ outra conversa'); mais.type = 'button';
    mais.title = 'Abrir outra conversa, para tocar outro pedido ao mesmo tempo em outra pasta';
    mais.onclick = async () => { try { ir((await acao({ acao: 'abrir' })).id); } catch (err) { avisar(err.message); } };
    faixa.append(mais);
  }
}
desenhar();
setInterval(desenhar, 2500);
