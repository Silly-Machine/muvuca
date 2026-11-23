// Abas Rotinas, Agentes, Projetos e Configurações.
// Parte da tela da Muvuca. Os arquivos de public/js/ dividem o mesmo escopo e são carregados na ordem do index.html.
/* ---------- rotinas ---------- */
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
let rotinas = [];
const quandoRotina = (r) => (r.dias.length === 7 ? 'todo dia' : r.dias.map((d) => DIAS[d]).join(', ')) + ' às ' + r.hora;
async function gravarRotinas(lista) {
  const r = await fetch('/api/rotinas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rotinas: lista }) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.erro || r.status);
  rotinas = j.rotinas;
}
async function montarRotinas() {
  const j = await lerDoServidor('/api/rotinas'); rotinas = j.rotinas || []; lerProjetos();
  if (!$('#rDias').childElementCount) [1, 2, 3, 4, 5, 6, 0].forEach((d) => { const l = el('label'); const i = el('input'); i.type = 'checkbox'; i.value = d; i.checked = d >= 1 && d <= 5; l.append(i, DIAS[d]); $('#rDias').append(l); });
  const lista = $('#rLista'); lista.replaceChildren();
  if (!rotinas.length) lista.append(el('p', 'nota', 'Nenhuma rotina ainda. Crie a primeira abaixo.'));
  for (const r of rotinas) {
    const c = el('article', 'projeto' + (r.ativa ? '' : ' inativa'));
    const h = el('h3', '', r.nome); h.append(el('span', 'selo' + (r.ativa ? ' padrao' : ''), r.ativa ? 'ativa' : 'pausada'));
    c.append(h, el('div', 'situacao', quandoRotina(r)), el('div', 'pedido-rotina', r.texto), el('code', '', r.projeto || `pasta padrão (${j.padrao})`),
      el('div', 'situacao' + (/^(não aprovada|erro|recusada|interrompida)/.test(r.resultado) ? ' ruim' : ''), r.ultima ? `Última vez: ${new Date(r.ultima).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` + (r.resultado ? ` · ${r.resultado}` : '') : 'Ainda não rodou'));
    const bs = el('div', 'botoes');
    const agora = el('button', 'primario', 'Rodar agora'); agora.disabled = rodando;
    agora.onclick = async () => { const x = await fetch('/api/rotinas/rodar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: r.id }) }); if (x.ok) secao('time'); else $('#rErro').textContent = 'Não deu: ' + ((await x.json().catch(() => ({}))).erro || x.status); };
    const pausa = el('button', '', r.ativa ? 'Pausar' : 'Ativar');
    pausa.onclick = async () => { try { await gravarRotinas(rotinas.map((x) => (x === r ? { ...x, ativa: !x.ativa } : x))); } catch (e) { $('#rErro').textContent = 'Não deu: ' + e.message; } montarRotinas(); };
    const tirar = el('button', '', 'Excluir');
    tirar.onclick = async () => { try { await gravarRotinas(rotinas.filter((x) => x !== r)); } catch (e) { $('#rErro').textContent = 'Não deu: ' + e.message; } montarRotinas(); };
    bs.append(agora, pausa, tirar); c.append(bs); lista.append(c);
  }
}
$('#rForm').onsubmit = async (e) => {
  e.preventDefault(); $('#rErro').textContent = '';
  const nova = { nome: $('#rNome').value, hora: $('#rHora').value, texto: $('#rTexto').value, projeto: $('#rProjeto').value.trim(), dias: [...$('#rDias').querySelectorAll('input:checked')].map((i) => +i.value), ativa: true };
  try { await gravarRotinas([...rotinas, nova]); $('#rNome').value = ''; $('#rTexto').value = ''; $('#rProjeto').value = ''; montarRotinas(); }
  catch (err) { $('#rErro').textContent = 'Não deu: ' + err.message; }
};

/* ---------- agentes básicos na aba Agentes ---------- */
async function montarBasicos(buscar = false) {
  if (buscar && !catalogo.length) { try { const j = await lerDoServidor('/api/times'); galeria = j.times || []; catalogo = j.catalogo || []; } catch { /* sem servidor: fica sem a lista */ } }
  const raiz = $('#fichas'); raiz.querySelectorAll('.basico, .sec.segunda, .sec.segunda + .nota').forEach((x) => x.remove());
  const lista = catalogo.filter((a) => !a.secreto || buzinaSolta());
  if (!lista.length) return;
  const h = el('h2', 'sec segunda', 'Agentes básicos'); h.append(el('small', '', `${lista.length} modelos prontos, os mesmos da biblioteca do construtor`));
  raiz.append(h, el('p', 'nota', 'Eles ainda não estão no time. Use "Pôr num time" para abrir o construtor já com o agente incluído.'));
  lista.forEach((a, k) => {
    const f = el('div', 'ficha basico'); f.innerHTML = mascote(a, k, 'c');
    const t = el('div');
    const funcao = a.funcao ? NOME_FUNCAO[a.funcao] : 'executor';
    const pode = el('p'); pode.append('Pode ', el('code', '', (a.ferramentas || []).join(', ') || 'só conversar'));
    t.append(el('h2', '', a.nome), el('p', '', `${a.papel} (${funcao})`));
    if (a.complexidade) { const n = el('p'); n.append(el('span', 'cx ' + a.complexidade, 'nível ' + NOME_CX[a.complexidade])); t.append(n); }
    t.append(pode);
    const bs = el('div', 'botoes'); const usar = el('button', 'pequeno', 'Pôr num time');
    usar.onclick = async () => { await abrirConstrutor(); adicionarDoCatalogo(a.id); };
    bs.append(usar); t.append(bs); f.append(t); raiz.append(f);
  });
}

/* ---------- memória dos agentes (na aba Agentes) ---------- */
async function montarMemoria() {
  const projeto = $('#projeto').value.trim();
  let j; try { j = await lerDoServidor('/api/memoria?projeto=' + encodeURIComponent(projeto)); } catch { return; }
  document.querySelectorAll('#fichas .ficha:not(.basico)').forEach((f, i) => {
    const a = agentes[i]; if (!a) return; f.querySelector('.memo')?.remove();
    if (a.funcao === 'lider' || a.funcao === 'sublider') return;   // quem só planeja não guarda notas
    const notas = j.notas?.[a.id] || []; const m = el('div', 'memo');
    m.append(el('h4', '', notas.length ? `Memória neste projeto (${notas.length})` : 'Memória neste projeto: nenhuma nota ainda'));
    const ul = el('ul');
    notas.forEach((n, k) => { const li = el('li'); const x = el('button', '', 'apagar'); x.setAttribute('aria-label', 'Apagar nota: ' + n);
      x.onclick = async () => { await fetch('/api/memoria', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projeto, agente: a.id, notas: notas.filter((_, q) => q !== k) }) }); montarMemoria(); };
      li.append(el('span', '', n), x); ul.append(li); });
    if (notas.length) m.append(ul);
    f.lastElementChild.append(m);
  });
}

/* ---------- projetos ---------- */
let projetos = [], prefs = null;
const mesmaPasta = (a, b) => !!a && !!b && a.replace(/[\\/]+$/, '').toLowerCase() === b.replace(/[\\/]+$/, '').toLowerCase();
const haQuanto = (ms) => { const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? 'agora há pouco' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} dia(s)`; };
function usarProjeto(caminho) {
  $('#projeto').value = caminho; try { localStorage.setItem('muvuca.projeto', caminho); } catch {}
  montarChipProjeto();
}
// Seletor de projeto embaixo da caixa de texto: os projetos da lista, a pasta atual (se não estiver na lista) e o atalho para a aba Projetos.
function montarChipProjeto() {
  const sel = $('#projetoChip'), atual = $('#projeto').value.trim();
  const nomeDe = (c) => c.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || c;
  const itens = projetos.map((p) => [p.caminho, p.nome + (p.existe === false ? ' (pasta não encontrada)' : '')]);
  if (atual && !projetos.some((p) => mesmaPasta(p.caminho, atual))) itens.unshift([atual, nomeDe(atual)]);
  if (!atual) itens.unshift(['', 'escolha uma pasta']);
  sel.replaceChildren(...itens.map(([v, t]) => { const o = el('option', '', t); o.value = v; o.title = v; return o; }));
  const g = el('option', '', 'Gerenciar projetos…'); g.value = '::gerenciar'; sel.append(g);
  sel.value = itens.find(([v]) => mesmaPasta(v, atual))?.[0] ?? atual;
  sel.title = atual || 'nenhuma pasta escolhida';
}
$('#projetoChip').onchange = (e) => {
  if (e.target.value === '::gerenciar') { montarChipProjeto(); secao('projetos'); montarProjetos(); return; }
  usarProjeto(e.target.value); $('#erroEnvio').textContent = '';
};
$('#chipModelo').onclick = () => { secao('config'); montarConfig().then(() => $('#cfModelosCartao')?.scrollIntoView({ block: 'start', behavior: 'smooth' })); };
async function lerProjetos() {
  const j = await lerDoServidor('/api/projetos');
  projetos = j.projetos || [];
  $('#listaProjetos').replaceChildren(...projetos.map((p) => { const o = el('option'); o.value = p.caminho; o.label = p.nome; return o; }));
  montarChipProjeto();
  return j;
}
async function gravarProjetos(lista) {
  const r = await fetch('/api/projetos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projetos: lista.map(({ nome, caminho }) => ({ nome, caminho })) }) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.erro || r.status);
}
async function montarProjetos() {
  const j = await lerProjetos();
  const lista = $('#pLista'); lista.replaceChildren();
  if (!projetos.length) lista.append(el('p', 'nota', 'Nenhum projeto na lista ainda. Adicione o primeiro abaixo.'));
  for (const p of projetos) {
    const noPalco = mesmaPasta(p.caminho, $('#projeto').value.trim()), padrao = mesmaPasta(p.caminho, j.padrao);
    const c = el('article', 'projeto' + (noPalco ? ' ativo' : ''));
    const h = el('h3', '', p.nome); if (noPalco) h.append(el('span', 'selo', 'no palco')); if (padrao) h.append(el('span', 'selo padrao', 'padrão'));
    c.append(h, el('code', '', p.caminho),
      el('div', 'situacao' + (p.existe ? '' : ' ruim'), p.existe ? `${p.arquivos} arquivo(s)` + (p.arquivos ? ` · mudou ${haQuanto(p.alterado)}` : ' · pasta vazia') : 'pasta não encontrada'));
    const bs = el('div', 'botoes');
    const usar = el('button', noPalco ? '' : 'primario', noPalco ? 'Já está no palco' : 'Usar no palco'); usar.disabled = noPalco || !p.existe;
    usar.onclick = () => { usarProjeto(p.caminho); secao('time'); };
    const tornar = el('button', '', 'Tornar padrão'); tornar.disabled = padrao;
    tornar.onclick = async () => {
      try { await salvarPrefs({ ...(prefs || (await lerPrefs()).preferencias), projetoPadrao: p.caminho }); } catch (e) { $('#pErro').textContent = 'Não deu: ' + e.message; }
      montarProjetos();
    };
    const tirar = el('button', '', 'Tirar da lista');
    tirar.onclick = async () => { try { await gravarProjetos(projetos.filter((x) => x !== p)); } catch (e) { $('#pErro').textContent = 'Não deu: ' + e.message; } montarProjetos(); };
    bs.append(usar, tornar, tirar); c.append(bs); lista.append(c);
  }
}
$('#pForm').onsubmit = async (e) => {
  e.preventDefault(); $('#pErro').textContent = '';
  const caminho = $('#pCaminho').value.trim(), nome = $('#pNome').value.trim();
  if (!caminho) { $('#pErro').textContent = 'Informe o caminho completo da pasta.'; return; }
  try { await gravarProjetos([...projetos, { nome, caminho }]); $('#pNome').value = ''; $('#pCaminho').value = ''; montarProjetos(); }
  catch (err) { $('#pErro').textContent = 'Não deu: ' + err.message; }
};

/* ---------- configurações: modelos do time ---------- */
let listaProv = [];
const NOME_TIPO = { demo: 'demonstração', cli: 'aplicativo no computador', openai: 'API' };
function preencherModelos() {
  const p = listaProv.find((x) => x.nome === $('#cfProv').value); if (!p) return;
  $('#cfMBaixa').value = p.modelos?.baixa || ''; $('#cfMMedia').value = p.modelos?.media || ''; $('#cfMAlta').value = p.modelos?.alta || '';
  for (const i of ['#cfMBaixa', '#cfMMedia', '#cfMAlta']) { $(i).placeholder = p.modelo || 'padrão do provedor'; $(i).disabled = p.tipo === 'demo'; }
  $('#cfModelosLista').replaceChildren(...[...new Set([p.modelo, ...Object.values(p.modelos || {})].filter(Boolean))].map((m) => { const o = el('option'); o.value = m; return o; }));
  $('#cfProvMotivo').textContent = (p.pronto ? 'Pronto: ' : 'Ainda não dá para usar: ') + p.motivo + '.'; $('#cfProvMotivo').className = 'nota' + (p.pronto ? '' : ' ruim');
  $('#cfProvUsar').disabled = !p.pronto || rodando;
}
async function montarProvedores(manter) {
  let j; try { j = await lerDoServidor('/api/provedores'); } catch { return; }
  listaProv = j.provedores || [];
  const emUso = listaProv.filter((p) => p.agentes > 0);
  $('#cfProvAtual').textContent = emUso.length === 1 ? `Hoje o time inteiro usa ${emUso[0].nome} (${NOME_TIPO[emUso[0].tipo] || emUso[0].tipo}).`
    : `Hoje o time está dividido: ${emUso.map((p) => `${p.agentes} em ${p.nome}`).join(', ')}.`;
  const sel = $('#cfProv'); const antes = manter || sel.value;
  sel.replaceChildren(...listaProv.map((p) => { const o = el('option', '', `${p.nome} · ${NOME_TIPO[p.tipo] || p.tipo}` + (p.pronto ? '' : ' (não pronto)')); o.value = p.nome; return o; }));
  sel.value = listaProv.some((p) => p.nome === antes) ? antes : (emUso.sort((a, b) => b.agentes - a.agentes)[0]?.nome || listaProv[0]?.nome || '');
  preencherModelos(); montarNiveis();
}
function montarNiveis() {
  const raiz = $('#cfAgentes'); raiz.replaceChildren();
  for (const a of agentes) {
    const l = el('div', 'linha-nivel'); l.style.setProperty('--cor', a.cor);
    const img = el('img'); img.alt = ''; img.src = `/bonecos/${PERSONAGENS[a.forma] ? a.forma : 'regente'}-disponivel.webp`;
    const nome = el('b', '', a.nome); nome.append(el('small', '', a.funcao ? NOME_FUNCAO[a.funcao] : (a.ferramentas || []).includes('escrever') ? 'executor' : 'só consulta'));
    const sel = el('select'); sel.setAttribute('aria-label', 'Modelo de ' + a.nome);
    const automatico = a.funcao === 'revisor' ? 'Automático: o nível mais alto do trabalho' : a.funcao === 'lider' || a.funcao === 'sublider' ? 'Automático: o modelo padrão do provedor' : 'Automático: o líder decide por tarefa';
    const doNivel = (n) => `${modeloDoNivel(a, n)} · ${ROTULO_NIVEL[n]}`;
    const opcoesNivel = [['', 'Padrão do papel: ' + (a.nivelPadrao ? doNivel(a.nivelPadrao) : automatico.replace('Automático: ', ''))], ['auto', automatico], ['baixa', doNivel('baixa')], ['media', doNivel('media')], ['alta', doNivel('alta')]];
    // sem padrão no papel, "padrão" e "automático" são a mesma coisa: mostra uma opção só
    for (const [v, t] of opcoesNivel) { if (v === 'auto' && !a.nivelPadrao) continue; const o = el('option', '', t); o.value = v; sel.append(o); }
    sel.value = a.complexidade === 'auto' && !a.nivelPadrao ? '' : (a.complexidade || '');
    if (a.modeloFixo) { sel.replaceChildren(el('option', '', `Fixo: ${a.modeloFixo} (definido no construtor)`)); sel.disabled = true; }
    sel.disabled = sel.disabled || rodando;
    sel.onchange = async () => {
      const m = $('#cfNivelMsg'); m.textContent = ''; m.className = '';
      const r = await fetch('/api/agentes/nivel', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: a.id, nivel: sel.value }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { m.className = 'ruim'; m.textContent = 'Não deu: ' + (j.erro || r.status); }
      await carregarConfig(); montarNiveis();
      if (r.ok) { m.className = 'ok'; m.textContent = `${a.nome}: ${sel.selectedOptions[0]?.textContent || 'atualizado'}.`; }
    };
    l.append(img, nome, sel); raiz.append(l);
  }
}
$('#cfProv').onchange = preencherModelos;
$('#cfProvUsar').onclick = async () => {
  const nome = $('#cfProv').value; const m = $('#cfProvMsg'); m.textContent = ''; m.className = '';
  const r = await fetch('/api/provedores/usar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome, modelos: { baixa: $('#cfMBaixa').value, media: $('#cfMMedia').value, alta: $('#cfMAlta').value } }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { m.className = 'ruim'; m.textContent = 'Não deu: ' + (j.erro || r.status); return; }
  await carregarConfig(); await montarProvedores(nome); montarNiveis();
  m.className = 'ok'; m.textContent = `Pronto: o time inteiro agora usa ${nome}. Vale para os próximos pedidos e continua depois de reiniciar.`;
};

/* ---------- configurações ---------- */
async function lerPrefs() { const j = await lerDoServidor('/api/preferencias'); prefs = j.preferencias; return j; }
async function salvarPrefs(novas) {
  const antigo = prefs?.projetoPadrao;
  const r = await fetch('/api/preferencias', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ preferencias: novas }) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.erro || r.status);
  prefs = j.preferencias;
  // o palco acompanha o novo padrão se ainda estava no padrão antigo (ou vazio)
  const atual = $('#projeto').value.trim(); if (!atual || mesmaPasta(atual, antigo)) usarProjeto(prefs.projetoPadrao);
  return prefs;
}
async function montarConfig() {
  const j = await lerPrefs(); lerProjetos(); montarProvedores();
  $('#cfProjeto').value = prefs.projetoPadrao; $('#cfTeste').value = prefs.comandoTeste; $('#cfCiclos').value = prefs.maxCiclos; $('#cfPassos').value = prefs.maxPassos; $('#cfLimiteAgente').value = prefs.limiteAgenteMin; $('#cfLimiteTestes').value = prefs.limiteTestesMin; $('#cfIsolar').checked = prefs.isolarTestes;
  $('#cfIsolarNota').textContent = j.isolamento?.disponivel ? '(vale para "node --test"; a rede não é bloqueada)' : `(indisponível: ${j.isolamento?.motivo || 'motivo desconhecido'})`;
  $('#cfFabrica').textContent = j.pastaPadrao; $('#cfArquivo').textContent = j.config; $('#cfMsg').textContent = ''; $('#cfMsg').className = '';
  $('#cfRestaurar').onclick = () => { $('#cfProjeto').value = j.pastaPadrao; };
  $('#cfAmbiente').hidden = !j.deAmbiente; $('#cfAmbiente').textContent = j.deAmbiente ? `A variável de ambiente MUVUCA_PROJETO está definida (${j.deAmbiente}) e vale no lugar desta pasta.` : '';
}
$('#cfSalvar').onclick = async () => {
  try {
    await salvarPrefs({ projetoPadrao: $('#cfProjeto').value.trim(), comandoTeste: $('#cfTeste').value.trim(), maxCiclos: $('#cfCiclos').value, maxPassos: $('#cfPassos').value, limiteAgenteMin: $('#cfLimiteAgente').value, limiteTestesMin: $('#cfLimiteTestes').value, isolarTestes: $('#cfIsolar').checked });
    await montarConfig(); $('#cfMsg').className = 'ok'; $('#cfMsg').textContent = 'Configurações salvas em preferencias.json.';
  } catch (e) { $('#cfMsg').className = 'ruim'; $('#cfMsg').textContent = 'Não deu: ' + e.message; }
};
$('#cNome').oninput = (e) => { rascunho.nome = e.target.value; };
$('#cArq').onchange = (e) => { rascunho.arquitetura = e.target.value; montarEditor(); };
$('#cNovo').onclick = novoAgente; $('#cAplicar').onclick = () => aplicarTime(false); $('#cSalvar').onclick = () => aplicarTime(true);
$('#cDescartar').onclick = () => { rascunho = null; limparHistorico(); secao('time'); };
new ResizeObserver(() => rascunho && desenharArestas($('#previa'))).observe($('#previa'));

async function carregarConfig() {
  const c = await lerDoServidor('/api/config');
  agentes = c.agentes; arquitetura = c.arquitetura || 'centralizada'; nomeTime = c.nomeTime || ''; arquiteturas = c.arquiteturas || {}; provedores = c.provedores || [];
  if (destino !== 'time' && !agentes.some((a) => a.id === destino)) destino = 'time';
  montarTime();
  if (c.versao) $('#versao').textContent = 'v' + c.versao;
  return c;
}
$('#texto').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } });
document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#texto').focus(); } });
