// Aba Conexões: servidores MCP que dão aos agentes acesso a coisas fora da pasta do projeto.
import { $, el, lerDoServidor, pedir } from './base.js';
import { secao } from './conversa.js';


/* ---------- conexões ---------- */
let conexoes = { conexoes: [], agentes: {}, time: [] };
const testesConexao = {};   // id -> resultado do último teste, só nesta sessão da tela
async function gravarConexoes(novo) {
  const r = await pedir('/api/conexoes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(novo) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.erro || r.status);
  conexoes = j;
}
const erroConexao = (e) => { $('#xErro').textContent = e ? 'Não deu: ' + e.message : ''; };
// O que o formulário tem agora, no formato que o servidor espera.
function conexaoDoFormulario() {
  const tipo = $('#xTipo').value;
  return { nome: $('#xNome').value, tipo, descricao: $('#xDescricao').value, ferramentas: $('#xFerramentas').value,
    ...(tipo === 'http' ? { url: $('#xUrl').value, variavelToken: $('#xToken').value } : { comando: $('#xComando').value, variaveis: $('#xVariaveis').value }) };
}
function mostrarTeste(onde, r) {
  onde.className = 'situacao' + (r.ok ? '' : ' ruim');
  // servidor grande (o REA tem mais de 200 ferramentas): mostra as primeiras e diz quantas ficaram de fora
  const nomes = (r.ferramentas || []).map((f) => f.nome), MOSTRA = 12;
  onde.textContent = r.ok ? (nomes.length ? `Respondeu com ${nomes.length} ferramenta(s): ${nomes.slice(0, MOSTRA).join(', ')}${nomes.length > MOSTRA ? ` e mais ${nomes.length - MOSTRA}` : ''}` : 'Respondeu, mas não oferece nenhuma ferramenta.') : 'Não respondeu: ' + r.erro;
  onde.title = nomes.length > MOSTRA ? nomes.join(', ') : '';
}
async function testarConexao(corpo, onde, botao) {
  botao.disabled = true; onde.className = 'situacao'; onde.textContent = 'Testando… (pode levar alguns segundos na primeira vez)';
  let r;
  try { const x = await pedir('/api/conexoes/testar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) }); r = await x.json(); if (!x.ok) r = { ok: false, erro: r.erro || x.status }; }
  catch (e) { r = { ok: false, erro: e.message }; }
  botao.disabled = false; mostrarTeste(onde, r); return r;
}
async function montarConexoes() {
  conexoes = await lerDoServidor('/api/conexoes'); erroConexao();
  const lista = $('#xLista'); lista.replaceChildren();
  if (!conexoes.conexoes.length) lista.append(el('p', 'nota', 'Nenhuma conexão ainda. Crie a primeira abaixo.'));
  for (const c of conexoes.conexoes) {
    const cartao = el('article', 'projeto' + (c.ativa ? '' : ' inativa'));
    const h = el('h3', '', c.nome); h.append(el('span', 'selo' + (c.ativa ? ' padrao' : ''), c.ativa ? 'ligada' : 'desligada'));
    const usam = conexoes.time.filter((a) => (conexoes.agentes[a.id] || []).includes(c.id) && a.pode).map((a) => a.nome);
    cartao.append(h);
    if (c.descricao) cartao.append(el('div', 'pedido-rotina', c.descricao));
    cartao.append(el('code', '', c.tipo === 'http' ? c.url : [c.comando, ...c.args].join(' ')),
      el('div', 'situacao', usam.length ? 'Usada por: ' + usam.join(', ') : 'Nenhum agente usa ainda: marque abaixo quem pode.'));
    if (c.faltam.length) cartao.append(el('div', 'situacao ruim', `Falta definir ${c.faltam.join(', ')} no ambiente antes de abrir a Muvuca. Sem isso, a conexão fica de fora.`));
    // ferramentas liberadas: em branco, todas; com nomes, só essas
    const campoF = el('label', 'campo ferramentas-conexao'); const entradaF = el('input'); entradaF.spellcheck = false; entradaF.value = (c.ferramentas || []).join(', ');
    entradaF.placeholder = 'em branco: todas as ferramentas do servidor';
    const guardar = el('button', 'pequeno', 'Guardar'); guardar.type = 'button';
    guardar.onclick = async () => { try { await gravarConexoes({ conexoes: conexoes.conexoes.map(({ faltam, ...x }) => (x.id === c.id ? { ...x, ferramentas: entradaF.value } : x)) }); } catch (e) { erroConexao(e); return; } montarConexoes(); };
    campoF.append(el('span', '', c.ferramentas?.length ? `Ferramentas liberadas (${c.ferramentas.length})` : 'Ferramentas liberadas (todas)'), entradaF, guardar);
    cartao.append(campoF);
    const teste = el('div', 'situacao'); if (testesConexao[c.id]) mostrarTeste(teste, testesConexao[c.id]);
    const bs = el('div', 'botoes');
    const testar = el('button', 'primario', 'Testar');
    testar.onclick = async () => { testesConexao[c.id] = await testarConexao({ id: c.id }, teste, testar); };
    const liga = el('button', '', c.ativa ? 'Desligar' : 'Ligar');
    liga.onclick = async () => { try { await gravarConexoes({ conexoes: conexoes.conexoes.map((x) => (x.id === c.id ? { ...x, ativa: !x.ativa } : x)) }); } catch (e) { erroConexao(e); } montarConexoes(); };
    const tirar = el('button', '', 'Excluir');
    tirar.onclick = async () => { try { await gravarConexoes({ conexoes: conexoes.conexoes.filter((x) => x.id !== c.id) }); delete testesConexao[c.id]; } catch (e) { erroConexao(e); } montarConexoes(); };
    bs.append(testar, liga, tirar); cartao.append(teste, bs); lista.append(cartao);
  }
  montarQuemUsa();
}
// Quem pode usar o quê: uma linha por agente do time atual, uma caixa por conexão.
function montarQuemUsa() {
  const t = $('#xQuem'); t.replaceChildren();
  if (!conexoes.conexoes.length) return t.append(el('p', 'nota', 'Crie uma conexão para escolher quem pode usá-la.'));
  for (const a of conexoes.time) {
    const linha = el('div', 'quem' + (a.pode ? '' : ' sem'));
    const nome = el('div', 'quem-nome'); nome.append(el('b', '', a.nome), el('small', '', a.pode ? a.papel : a.motivo));
    const caixas = el('div', 'quem-caixas');
    for (const c of conexoes.conexoes) {
      const l = el('label'); const i = el('input'); i.type = 'checkbox'; i.disabled = !a.pode;
      i.checked = a.pode && (conexoes.agentes[a.id] || []).includes(c.id);
      i.onchange = async () => {
        const atual = new Set(conexoes.agentes[a.id] || []); i.checked ? atual.add(c.id) : atual.delete(c.id);
        try { await gravarConexoes({ agentes: { ...conexoes.agentes, [a.id]: [...atual] } }); } catch (e) { erroConexao(e); }
        montarConexoes();
      };
      l.append(i, c.nome); caixas.append(l);
    }
    linha.append(nome, caixas); t.append(linha);
  }
}
function tipoConexao() { const http = $('#xTipo').value === 'http'; $('#xCampoComando').hidden = http; $('#xCampoVariaveis').hidden = http; $('#xCampoUrl').hidden = !http; $('#xCampoToken').hidden = !http; }
$('#xTipo').onchange = tipoConexao; tipoConexao();
$('#xTestarNova').onclick = () => testarConexao({ conexao: conexaoDoFormulario() }, $('#xTesteNova'), $('#xTestarNova'));
$('#xForm').onsubmit = async (e) => {
  e.preventDefault(); erroConexao();
  try {
    await gravarConexoes({ conexoes: [...conexoes.conexoes.map(({ faltam, ...c }) => c), conexaoDoFormulario()] });
    for (const id of ['xNome', 'xDescricao', 'xComando', 'xVariaveis', 'xUrl', 'xToken', 'xFerramentas']) $('#' + id).value = '';
    $('#xTesteNova').textContent = ''; montarConexoes();
  } catch (err) { erroConexao(err); }
};
$('#navConexoes').onclick = () => { secao('conexoes'); montarConexoes(); };
