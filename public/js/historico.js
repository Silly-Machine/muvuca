// Histórico de conversas: as conversas encerradas ficam guardadas na pasta de dados e podem ser relidas aqui.
import { compartilhado } from './estado.js';
import { $, avisar, el, lerDoServidor, textoDoUso } from './base.js';


/* ---------- histórico ---------- */
const dataCurta = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
// Uma linha de texto para cada acontecimento que vale a pena reler. O que é só movimento de tela fica de fora.
function linhaDoHistorico(e, nome) {
  switch (e.tipo) {
    case 'pedido': return ['pedido', `${e.para === 'time' ? 'Você, para o time' : 'Você, para ' + nome(e.para)}: ${e.texto}`];
    case 'fala': return ['fala', `${nome(e.agente)}: ${e.texto}`];
    case 'plano': return ['', `Plano: ${(e.etapas || []).map((x) => `${nome(x.agente)} (${x.tarefa})`).join('; ')}`];
    case 'concluiu': return ['', `${nome(e.agente)} concluiu em ${e.segundos} s` + (e.arquivos?.length ? `, mexeu em ${e.arquivos.join(', ')}` : '')];
    case 'conexao': return ['', `${nome(e.agente)} usou a conexão ${e.servidor}: ${e.ferramenta}`];
    case 'portao': return [e.ok ? 'ok' : 'ruim', e.comando ? `Testes (${e.comando}): ${e.ok ? 'passaram' : 'falharam'}` : 'Testes: nenhum encontrado'];
    case 'veredito': return [e.aprovado ? 'ok' : 'ruim', `Revisor: ${e.aprovado ? 'aprovado' : 'devolveu'}${e.resumo ? '. ' + e.resumo : ''}`];
    case 'final': return [e.aprovado ? 'ok' : e.aprovado === false ? 'ruim' : '', e.aprovado ? 'Entrega aprovada.' : e.aprovado === false ? `Entrega não aprovada: ${e.motivo}` : e.conversa ? 'Só conversa.' : 'Pedido direto: sem testes nem revisão.'];
    case 'uso': return ['', textoDoUso(e)];
    case 'diff': return ['', e.arquivos.length ? `Arquivos alterados: ${e.arquivos.map((a) => `${a.arquivo} (${a.tipo})`).join(', ')}` : 'Nenhum arquivo alterado.'];
    case 'erro': return ['ruim', `Erro: ${e.texto}`];
    case 'parado': return ['ruim', 'Interrompido por você.'];
    case 'aviso': return ['', e.texto];
    default: return null;
  }
}
async function abrirHistorico() {
  const d = $('#dlgHistorico'), corpo = $('#hCorpo');
  const lista = async () => {
    $('#hTitulo').textContent = 'Conversas anteriores'; $('#hVoltar').hidden = true; corpo.replaceChildren(el('p', 'nota', 'Carregando…'));
    const j = await lerDoServidor('/api/conversas'); corpo.replaceChildren();
    if (!j.conversas.length) return corpo.append(el('p', 'nota', 'Nenhuma conversa guardada ainda. Uma conversa entra aqui quando você começa outra com "Nova conversa".'));
    for (const c of j.conversas) {
      const b = el('button', 'item-historico'); b.type = 'button';
      b.append(el('b', '', c.titulo || '(sem texto)'), el('small', '', `${dataCurta(c.quando)} · ${c.pedidos} pedido(s)${c.resultado ? ' · ' + c.resultado : ''}${c.projeto ? ' · ' + c.projeto : ''}`));
      b.onclick = () => uma(c.id);
      corpo.append(b);
    }
  };
  const uma = async (id) => {
    corpo.replaceChildren(el('p', 'nota', 'Carregando…'));
    const c = await lerDoServidor('/api/conversas/' + id);
    $('#hTitulo').textContent = dataCurta(c.quando); $('#hVoltar').hidden = false; corpo.replaceChildren();
    // nomes dos agentes daquela conversa: os do time atual quando o identificador bate; senão, o próprio identificador
    const nome = (idAg) => compartilhado.agentes.find((a) => a.id === idAg)?.nome || idAg || 'alguém';
    for (const e of c.eventos) { const l = linhaDoHistorico(e, nome); if (l) corpo.append(el('p', 'linha-historico ' + l[0], l[1])); }
  };
  $('#hVoltar').onclick = () => lista().catch((e) => avisar(e.message));
  $('#hFechar').onclick = () => d.close();
  d.showModal();
  await lista();
}
$('#historico').onclick = () => abrirHistorico().catch((e) => avisar(e.message));
