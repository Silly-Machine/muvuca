// Conversa com o time: envio do pedido, eventos, anexos e painel retrátil.
import { compartilhado } from './estado.js';
import { depois } from './tardias.js';
import { $, CONVERSA, chaveProjeto, el, pedir, textoDoUso } from './base.js';
import { NOME_ARQ, NOME_CX, ag, ajustarEscala, alarme, balao, desenharArestas, estado, modeloPadrao, montarDestinos, noPalco, rotuloModelo, viagem } from './palco.js';
import { abrirConstrutor } from './construtor.js';

/* ---------- conversa ---------- */
function por(no) { const f = $('#fluxo'); f.querySelector('.vazio')?.remove(); f.append(no); f.scrollTop = f.scrollHeight; if (document.body.classList.contains('sem-conversa')) $('#alternarConversa').classList.add('novo'); return no; }
function msg(id, texto, hora) {
  const a = ag(id); const m = el('div', 'msg'); m.style.setProperty('--cor', a.cor);
  const cab = el('div'); cab.append(el('b', '', a.nome), el('small', '', new Date(hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })));
  const dentro = el('div', 'dentro', texto); m.append(el('span', 'avatar'), cab, dentro); por(m); return dentro;
}
function etiqueta(id) { const e = el('span', 'etiqueta', ag(id).nome); e.style.setProperty('--cor', ag(id).cor); return e; }
function saida(titulo, texto) { const d = el('details'); d.append(el('summary', '', titulo), el('pre', '', texto)); return d; }
let inicioPedido = 0, relogio = 0, terminouLonge = false;
const mmss = (ms) => { const t = Math.max(0, Math.round(ms / 1000)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
function atualizarAndamento() {
  const ativos = compartilhado.agentes.map((a) => [a, noPalco(a.id)?.dataset.estado]).filter(([, e]) => e && e !== 'disponivel' && e !== 'concluido');
  const espera = ativos.some(([, e]) => e === 'aguardando');
  $('#andTexto').textContent = ativos.length ? ativos.map(([a, e]) => a.nome + ' ' + (e === 'aguardando' ? 'aguarda você' : e)).join(' · ') : 'Time trabalhando…';
  $('#andTempo').textContent = mmss(Date.now() - inicioPedido);
  document.title = (compartilhado.rodando ? (espera ? '⚠ ' : '● ') : terminouLonge ? '✓ ' : '') + 'Muvuca' + (CONVERSA !== '1' ? ` · conversa ${CONVERSA}` : '');
}
function ocupado(v, desde) {
  const antes = compartilhado.rodando; compartilhado.rodando = v; $('#enviar').disabled = v; $('#parar').hidden = !v; $('#andamento').hidden = !v;
  clearInterval(relogio);
  if (v) { inicioPedido = desde || Date.now(); relogio = setInterval(atualizarAndamento, 1000); }
  else if (antes && document.hidden) terminouLonge = true;   // acabou com a aba em segundo plano: marca no título
  atualizarAndamento();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && terminouLonge) { terminouLonge = false; atualizarAndamento(); } });
function pendencia(v) { $('#pendencia').hidden = !v; depois.atualizarBuzina(); }
function crescer() { const t = $('#texto'); t.style.height = 'auto'; t.style.height = Math.min(260, Math.max(92, t.scrollHeight + 2)) + 'px'; t.style.overflowY = t.scrollHeight > 260 ? 'auto' : 'hidden'; }
function vazio() {
  const v = el('div', 'vazio'); v.append(el('h2', '', 'Fale com o time'), el('p', '', 'O líder monta o plano, o time executa, os testes rodam e o revisor confere. Você decide o que fica.'));
  for (const s of ['Crie uma página de status com um endpoint /health', 'Revise o projeto e procure bugs', 'Adicione testes ao que não tem']) { const b = el('button', '', s); b.onclick = () => { $('#texto').value = s; $('#texto').focus(); }; v.append(b); }
  $('#fluxo').innerHTML = ''; $('#fluxo').append(v); $('#titulo').textContent = 'Nova conversa';
}

const trata = {
  nova() { compartilhado.tarefas.clear(); depois.desenharQuadro(); pendencia(false); vazio(); compartilhado.agentes.forEach((a) => { estado(a.id, 'disponivel'); rotuloModelo(a.id, modeloPadrao(a)); }); ocupado(false); },
  pedido(e) { compartilhado.tarefas.clear(); depois.desenharQuadro(); ocupado(true, e.hora); $('#titulo').textContent = e.texto; por(el('div', 'rotulo', e.para === 'time' ? 'Para o time' : 'Para ' + ag(e.para).nome)); por(el('div', 'pedido', e.texto)); },
  status(e) { estado(e.agente, e.estado); if (e.modelo) rotuloModelo(e.agente, e.modelo, e.complexidade); },
  fala(e) { balao(e.agente, e.texto); msg(e.agente, e.texto, e.hora); },
  aviso(e) { por(el('div', 'linha aviso', e.texto)); },
  nivel_agente() { depois.carregarConfig(); },
  provedor(e) { por(el('div', 'linha', `O time passou a usar ${e.nome}` + (e.modelos ? ` (simples: ${e.modelos.baixa || e.modelo || 'padrão'}, comum: ${e.modelos.media || e.modelo || 'padrão'}, difícil: ${e.modelos.alta || e.modelo || 'padrão'}).` : '.'))); depois.carregarConfig(); },
  tarefa(e) { compartilhado.tarefas.set(e.id, e); depois.desenharQuadro(); },
  rotina(e) { por(el('div', 'rotulo', e.manual ? `Rotina "${e.nome}" (rodada por você)` : `Rotina "${e.nome}" (na hora marcada)`)); },
  memoria(e) { const l = el('div', 'linha'); l.append(el('b', '', `${ag(e.agente).nome} anotou para lembrar: `), e.nota); por(l); if (document.body.classList.contains('ver-fichas')) depois.montarMemoria(); },
  consultando(e) { viagem(e.de, e.agente); },
  consulta(e) { const c = el('div', 'cartao'); c.append(el('h3', '', `${ag(e.de).nome} consultou ${ag(e.agente).nome}` + (e.modelo ? ` (${e.modelo})` : '')), el('div', 'linha', e.pergunta), el('div', '', e.resposta)); por(c); balao(e.agente, e.resposta); viagem(e.agente, e.de); },
  plano(e) {
    balao(e.agente, e.texto); const m = msg(e.agente, e.texto, e.hora); const c = el('div', 'cartao'); c.append(el('h3', '', e.sublider ? `Plano de ${ag(e.agente).nome} para a frente dele` : 'Plano do líder')); const ol = el('ol');
    for (const s of e.etapas) { const li = el('li'); const b = el('b', '', ag(s.agente).nome + ': '); b.style.color = ag(s.agente).cor; li.append(b, s.tarefa); if (s.complexidade) li.append(' ', el('span', 'cx ' + s.complexidade, NOME_CX[s.complexidade])); ol.append(li); }
    c.append(ol); m.append(c); for (const s of e.etapas) m.append(etiqueta(s.agente));
    [...new Set(e.etapas.map((s) => s.agente))].forEach((id, i) => viagem(e.agente, id, { atraso: i * 260 }));
  },
  esteira(e) {
    const c = el('div', 'cartao'); c.append(el('h3', '', 'Esteira: cada etapa na ordem')); const ol = el('ol');
    for (const s of e.etapas) { const li = el('li'); const b = el('b', '', ag(s.agente).nome); b.style.color = ag(s.agente).cor; li.append(b, ` (${ag(s.agente).papel || ''}) `, el('span', 'cx ' + s.complexidade, NOME_CX[s.complexidade])); ol.append(li); }
    c.append(ol); por(c);
    e.etapas.slice(1).forEach((s, i) => viagem(e.etapas[i].agente, s.agente, { atraso: i * 260 }));
  },
  rede(e) { por(el('div', 'linha', `Rede sem chefe: ${ag(e.entrada).nome} começa, e cada um escolhe quem continua (até ${e.teto} passagens).`)); },
  async time(e) {
    compartilhado.tarefas.clear(); depois.desenharQuadro();
    await depois.carregarConfig(); vazio(); ocupado(false); pendencia(false);
    const aviso = el('p', 'ok', compartilhado.avisoTime || `Time "${e.nome}" no palco (${NOME_ARQ[e.arquitetura] || e.arquitetura}).`); compartilhado.avisoTime = '';
    $('.vazio')?.prepend(aviso);
  },
  uso(e) { const l = el('div', 'linha uso', textoDoUso(e)); if (e.custo !== undefined) l.title = 'O custo é o que essas chamadas custariam pela tabela da API. Na assinatura do Claude não há cobrança por pedido.'; por(l); },
  conexao(e) { por(el('div', 'linha', `${ag(e.agente).nome} usou a conexão ${e.servidor}: ${e.ferramenta}`)); },
  passo(e) {
    let c = document.getElementById('ativ-' + e.agente);
    if (!c) { c = el('details', 'cartao'); c.id = 'ativ-' + e.agente; c.append(el('summary', '', ''), el('pre', '', '')); c.dataset.n = 0; por(c); }
    c.dataset.n = +c.dataset.n + 1; c.querySelector('summary').textContent = `${ag(e.agente).nome} está trabalhando, ${c.dataset.n} passos`; c.querySelector('pre').textContent += `${e.ferramenta} ${e.alvo || ''}\n`;
  },
  concluiu(e) {
    let c = document.getElementById('ativ-' + e.agente); if (!c) { c = el('details', 'cartao'); c.append(el('summary', '', ''), el('pre', '', '')); por(c); }
    c.removeAttribute('id'); c.querySelector('summary').textContent = `✓ ${ag(e.agente).nome} concluiu em ${e.segundos} s, ${e.passos} passos` + (e.arquivos.length ? `, ${e.arquivos.length} arquivo(s)` : '') + (e.modelo ? `, com ${e.modelo}` + (e.complexidade ? ` (${NOME_CX[e.complexidade]})` : '') : '');
    if (e.arquivos.length) c.querySelector('pre').textContent += '\narquivos: ' + e.arquivos.join(', ');
  },
  passagem(e) { const l = el('div', 'linha'); l.append(el('b', '', `${ag(e.de).nome} para ${ag(e.para).nome}: `), e.texto); por(l); viagem(e.de, e.para); },
  devolucao(e) {
    const l = el('div', 'linha ruim'); l.append(el('b', '', `↩ ${e.de === 'portao' ? 'Testes' : ag(e.de).nome} para ${ag(e.para).nome}: `), e.texto);
    if (e.complexidade) l.append(' Tenta de novo em ', el('span', 'cx ' + e.complexidade, NOME_CX[e.complexidade]), '.');
    por(l);
    if (compartilhado.agentes.some((a) => a.id === e.de)) viagem(e.de, e.para, { ruim: true }); else alarme(e.para);
  },
  portao_rodando(e) { por(el('div', 'linha', `Rodando os testes (${e.comando})...`)); },
  portao(e) { const c = el('div', 'cartao'); c.append(el('h3', '', 'Portão de testes'), el('div', e.ok ? 'ok' : 'ruim', e.ok ? `✓ passou (${e.comando}), rodado depois da última edição` : `✗ não passou (${e.comando || 'nenhum teste no projeto'})`), saida('Ver a saída', e.saida)); c.append(el('div', 'isolamento' + (e.isolado ? '' : ' sem'), e.isolado ? 'Testes isolados: só alcançaram a pasta do projeto.' : e.semIsolamento ? `Sem isolamento: ${e.semIsolamento}.` : '')); por(c); },
  veredito(e) { if (compartilhado.liderId) viagem(e.agente, compartilhado.liderId, { ruim: !e.aprovado }); balao(e.agente, e.texto); const m = msg(e.agente, e.texto, e.hora); const c = el('div', 'cartao'); c.append(el('h3', '', 'Veredito'), el('div', e.aprovado ? 'ok' : 'ruim', e.aprovado ? '✓ aprovado' : '✗ reprovado')); for (const a of e.achados) c.append(el('div', 'linha', `${a.arquivo || '?'}: ${a.problema}`)); m.append(c); },
  aprovacao(e) {
    const c = el('div', 'cartao aprovar'); c.id = e.id; c.append(el('h3', '', 'Precisa da sua aprovação'), el('div', '', `${ag(e.agente).nome} quer rodar este comando:`), el('code', '', e.comando));
    const bs = el('div', 'botoes'); const s = el('button', '', 'Aprovar comando'); const n = el('button', '', 'Negar'); s.onclick = () => post('/api/aprovar', { id: e.id, ok: true }); n.onclick = () => post('/api/aprovar', { id: e.id, ok: false }); bs.append(s, n); c.append(bs); por(c);
  },
  aprovacao_resolvida(e) { const c = document.getElementById(e.id); if (c) { c.querySelector('.botoes')?.remove(); c.append(el('div', e.ok ? 'ok' : 'ruim', e.ok ? 'Comando aprovado por você.' : 'Comando negado por você.')); } },
  final(e) {
    if (e.aprovado && Date.now() - e.hora < 5000) { compartilhado.buzinaFesta = Date.now() + 6000; depois.atualizarBuzina(); }
    const texto = e.aprovado ? (!e.ciclos ? 'Entrega aprovada de primeira.' : `Entrega aprovada após ${e.ciclos} ${e.ciclos === 1 ? 'devolução' : 'devoluções'}.`) : e.aprovado === false ? `Entrega não aprovada: ${e.motivo}. O limite de devoluções acabou.`
      : e.conversa ? 'Só conversa: o líder não montou plano e ninguém mexeu na pasta.' : 'Pedido direto: não passou por testes nem revisão.';
    por(el('div', 'linha ' + (e.aprovado ? 'ok' : e.aprovado === false ? 'ruim' : ''), texto));
    // aprovado com ressalvas: elas ficam à vista, com um botão que manda o time corrigir
    if (e.aprovado && e.ressalvas?.length) {
      const c = el('div', 'cartao ressalvas'); c.append(el('h3', '', `${e.ressalvas.length} ressalva(s) do revisor ficaram sem correção`));
      for (const r of e.ressalvas) c.append(el('div', 'linha', `${r.arquivo}: ${r.problema}`));
      const bs = el('div', 'botoes'); const b = el('button', 'primario', 'Corrigir ressalvas');
      b.onclick = () => {
        if (compartilhado.rodando) return;
        compartilhado.destino = 'time'; montarDestinos?.();
        $('#texto').value = 'Corrija as ressalvas que o revisor apontou ao aprovar a última entrega, com teste para cada uma quando fizer sentido:\n' + e.ressalvas.map((r) => `- ${r.arquivo}: ${r.problema}`).join('\n');
        crescer(); secao('time'); b.disabled = true; enviar();
      };
      bs.append(b); c.append(bs); por(c);
    }
  },
  parado() { por(el('div', 'linha aviso', 'Time interrompido. O que já foi feito aparece nos arquivos alterados.')); },
  erro(e) { por(el('div', 'linha ruim', 'Erro: ' + e.texto)); },
  diff(e) {
    ocupado(false); pendencia(e.arquivos.length > 0);
    const avisos = e.avisos || [];
    if (!e.arquivos.length && !avisos.length) return por(el('div', 'linha', 'Nenhum arquivo alterado.'));
    if (!e.arquivos.length) { const a = el('div', 'cartao aviso-descarte'); a.append(el('h3', '', 'Nenhum arquivo do projeto alterado, mas atenção')); for (const t of avisos) a.append(el('p', '', t)); return por(a); }
    const c = el('div', 'cartao'); c.id = 'diff'; c.append(el('h3', '', `Arquivos alterados (${e.arquivos.length})`));
    for (const a of e.arquivos) {
      const d = el('details'); d.append(el('summary', '', `${a.arquivo} (${a.tipo}${a.semCopia ? ', não dá para restaurar' : ''}` + (e.autores[a.arquivo] ? `, por ${ag(e.autores[a.arquivo]).nome})` : ')')));
      const p = el('pre', 'diff'); for (const l of a.linhas) p.append(el('span', l.t === '+' ? 'mais' : l.t === '-' ? 'menos' : l.t === '~' ? 'salto' : '', l.t === '~' ? '···' : l.t + ' ' + l.l)); d.append(p); c.append(d);
    }
    const naoVolta = e.arquivos.filter((a) => a.semCopia).length;
    if (naoVolta || avisos.length) { const a = el('div', 'aviso-descarte'); a.append(el('b', '', 'O Descartar não desfaz tudo desta vez:')); if (naoVolta) a.append(el('p', '', `${naoVolta} arquivo(s) grande(s) demais para guardar cópia.`)); for (const t of avisos) a.append(el('p', '', t)); c.append(a); }
    const bs = el('div', 'botoes'); const f = el('button', '', 'Manter mudanças'); const x = el('button', '', 'Descartar mudanças'); f.onclick = () => post('/api/decidir', { acao: 'aceitar' }); x.onclick = () => post('/api/decidir', { acao: 'descartar' }); bs.append(f, x); c.append(bs); por(c);
  },
  decisao_humana(e) { pendencia(false); document.querySelectorAll('#diff').forEach((d) => { d.querySelector('.botoes')?.remove(); d.removeAttribute('id'); }); por(el('div', 'linha', e.acao === 'descartar' ? 'Mudanças descartadas: a pasta voltou ao que era.' : 'Mudanças mantidas.')); },
};

async function post(url, corpo) {
  const r = await pedir(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo || {}) });
  const j = await r.json().catch(() => ({})); if (!r.ok) por(el('div', 'linha ruim', 'Erro: ' + (j.erro || r.status))); return j;
}
async function enviar() {
  const texto = $('#texto').value.trim(); if (!texto || compartilhado.rodando) return;
  const projeto = $('#projeto').value.trim(); $('#erroEnvio').textContent = '';
  if (!projeto) { $('#erroEnvio').textContent = 'Escolha o projeto, embaixo da caixa de texto, antes de enviar.'; $('#projetoChip').focus(); return; }
  try { localStorage.setItem(chaveProjeto, projeto); } catch {}
  $('#enviar').disabled = true;
  let r, j = {}, textoFinal = texto;
  if (anexos.length) {
    // os anexos vão primeiro para anexos/ no projeto; o pedido diz ao time onde eles estão
    $('#erroEnvio').className = ''; $('#erroEnvio').textContent = `Enviando ${anexos.length} anexo(s)…`;
    try {
      const arquivos = []; for (const a of anexos) arquivos.push({ caminho: a.caminho, dados: await emBase64(a.file) });
      const up = await pedir('/api/anexos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projeto, arquivos }) });
      const uj = await up.json().catch(() => ({}));
      $('#erroEnvio').className = 'ruim';
      if (!up.ok) { $('#erroEnvio').textContent = 'Não deu para anexar: ' + (uj.erro || up.status); $('#enviar').disabled = compartilhado.rodando; return; }
      const salvos = uj.salvos || [];
      textoFinal += '\n\nO usuário anexou ' + salvos.length + ' arquivo(s), já gravados na pasta do projeto: ' +
        (salvos.length <= 15 ? salvos.join(', ') : [...new Set(salvos.map((p) => p.split('/').slice(0, 2).join('/')))].slice(0, 15).join(', ') + ' (pastas e arquivos; liste para ver tudo)') + '. Leia-os antes de começar.';
    } catch (e) { $('#erroEnvio').className = 'ruim'; $('#erroEnvio').textContent = 'Não deu para anexar: ' + e.message; $('#enviar').disabled = compartilhado.rodando; return; }
    $('#erroEnvio').textContent = '';
  }
  try { r = await pedir('/api/pedido', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ texto: textoFinal, projeto, para: compartilhado.destino }) }); j = await r.json().catch(() => ({})); }
  catch { $('#erroEnvio').textContent = 'Sem conexão com o servidor da Muvuca. Ele está rodando?'; $('#enviar').disabled = compartilhado.rodando; return; }
  // só limpa a caixa quando o pedido foi aceito: recusa não faz perder o que você digitou
  if (!r.ok) { $('#erroEnvio').textContent = 'Não deu: ' + (j.erro || r.status); $('#enviar').disabled = compartilhado.rodando; return; }
  $('#texto').value = ''; crescer(); anexos.length = 0; desenharAnexos();
}

/* ---------- anexos: arquivos, pastas, arrastar e colar ---------- */
const anexos = [];   // [{ caminho, file }] — caminho relativo, com a pasta quando veio de uma
const LIM_ANEXO = { porArquivo: 8 * 1048576, total: 30 * 1048576, quantidade: 300 };
const tamanhoLegivel = (n) => (n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB');
const emBase64 = (file) => new Promise((ok, erro) => { const l = new FileReader(); l.onload = () => ok(String(l.result).split(',')[1] || ''); l.onerror = () => erro(new Error('não consegui ler ' + file.name)); l.readAsDataURL(file); });
function adicionarAnexos(lista) {
  const avisos = [];
  for (const { caminho, file } of lista) {
    const c = String(caminho || file.name).replace(/\\/g, '/').replace(/^\/+/, '');
    if (/(^|\/)(node_modules|\.git)(\/|$)/.test(c)) continue;   // nunca são o que a pessoa quer mandar
    if (anexos.some((a) => a.caminho === c)) continue;
    if (file.size > LIM_ANEXO.porArquivo) { avisos.push(`${c} tem ${tamanhoLegivel(file.size)} (o limite é 8 MB)`); continue; }
    if (anexos.length >= LIM_ANEXO.quantidade) { avisos.push('limite de 300 arquivos por pedido'); break; }
    if (anexos.reduce((s, a) => s + a.file.size, 0) + file.size > LIM_ANEXO.total) { avisos.push('os anexos passam de 30 MB no total'); break; }
    anexos.push({ caminho: c, file });
  }
  $('#erroEnvio').className = 'ruim'; $('#erroEnvio').textContent = avisos.length ? 'Ficou de fora: ' + [...new Set(avisos)].slice(0, 3).join('; ') + '.' : '';
  desenharAnexos();
}
function desenharAnexos() {
  // uma ficha por arquivo solto e uma por pasta
  const grupos = new Map();
  for (const a of anexos) { const topo = a.caminho.includes('/') ? a.caminho.split('/')[0] + '/' : a.caminho; const g = grupos.get(topo) || { n: 0, bytes: 0 }; g.n++; g.bytes += a.file.size; grupos.set(topo, g); }
  $('#anexos').replaceChildren(...[...grupos].map(([nome, g]) => {
    const f = el('span', 'anexo'); f.title = nome;
    const x = el('button', '', 'tirar'); x.type = 'button'; x.setAttribute('aria-label', 'Tirar o anexo ' + nome);
    x.onclick = () => { for (let i = anexos.length - 1; i >= 0; i--) if (nome.endsWith('/') ? anexos[i].caminho.startsWith(nome) : anexos[i].caminho === nome) anexos.splice(i, 1); desenharAnexos(); };
    f.append(el('b', '', nome), el('small', '', nome.endsWith('/') ? `${g.n} arquivo(s), ${tamanhoLegivel(g.bytes)}` : tamanhoLegivel(g.bytes)), x);
    return f;
  }));
}
function menuMais(abrir) { $('#maisMenu').hidden = !abrir; $('#maisBotao').setAttribute('aria-expanded', abrir); }
$('#maisBotao').onclick = (e) => { e.stopPropagation(); menuMais($('#maisMenu').hidden); };
document.addEventListener('click', (e) => { if (!e.target.closest('.mais-anexo')) menuMais(false); });
$('#maisArquivos').onclick = () => { menuMais(false); $('#anexoArq').click(); };
$('#maisPasta').onclick = () => { menuMais(false); $('#anexoPasta').click(); };
$('#anexoArq').onchange = (e) => { adicionarAnexos([...e.target.files].map((file) => ({ caminho: file.name, file }))); e.target.value = ''; };
$('#anexoPasta').onchange = (e) => { adicionarAnexos([...e.target.files].map((file) => ({ caminho: file.webkitRelativePath || file.name, file }))); e.target.value = ''; };
document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key.toLowerCase() === 'u' && !document.body.className.includes('ver-')) { e.preventDefault(); $('#anexoArq').click(); } if (e.key === 'Escape') menuMais(false); });
// colar imagem ou arquivo na caixa de texto
$('#texto').addEventListener('paste', (e) => {
  const fs2 = [...(e.clipboardData?.files || [])]; if (!fs2.length) return;
  e.preventDefault(); const agora = new Date().toISOString().slice(11, 19).replace(/:/g, '');
  adicionarAnexos(fs2.map((file, i) => ({ caminho: file.name && file.name !== 'image.png' ? file.name : `colado-${agora}${i ? '-' + i : ''}.${(file.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, file })));
});
// arrastar arquivos ou pastas para a caixa de entrada
{
  const caixa = $('#entrada');
  const ler = (entrada, base, saida) => new Promise((ok) => {
    if (entrada.isFile) return entrada.file((file) => { saida.push({ caminho: base + file.name, file }); ok(); }, () => ok());
    if (!entrada.isDirectory || saida.length > 400) return ok();
    const leitor = entrada.createReader(); const todos = [];
    const lote = () => leitor.readEntries(async (es) => { if (!es.length) { for (const x of todos) await ler(x, base + entrada.name + '/', saida); return ok(); } todos.push(...es); lote(); }, () => ok());
    lote();
  });
  caixa.addEventListener('dragover', (e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); caixa.classList.add('soltar'); } });
  caixa.addEventListener('dragleave', (e) => { if (!caixa.contains(e.relatedTarget)) caixa.classList.remove('soltar'); });
  caixa.addEventListener('drop', async (e) => {
    if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
    e.preventDefault(); caixa.classList.remove('soltar');
    const entradas = [...e.dataTransfer.items].map((i) => i.webkitGetAsEntry?.()).filter(Boolean); const saida = [];
    if (entradas.length) for (const en of entradas) await ler(en, '', saida); else saida.push(...[...e.dataTransfer.files].map((file) => ({ caminho: file.name, file })));
    adicionarAnexos(saida);
  });
}

/* ---------- conversa retrátil ---------- */
function mostrarConversa(mostrar) {
  document.body.classList.toggle('sem-conversa', !mostrar);
  const b = $('#alternarConversa'); b.setAttribute('aria-pressed', mostrar); b.classList.remove('novo');
  b.title = mostrar ? 'Ocultar a conversa' : 'Mostrar a conversa'; b.setAttribute('aria-label', b.title);
  try { localStorage.setItem('muvuca.conversa', mostrar ? '1' : '0'); } catch {}
  if (mostrar) $('#fluxo').scrollTop = $('#fluxo').scrollHeight;
  setTimeout(() => { ajustarEscala(); desenharArestas(); }, 60);   // o palco ganhou ou perdeu largura
}
$('#alternarConversa').onclick = () => mostrarConversa(document.body.classList.contains('sem-conversa'));
try { if (localStorage.getItem('muvuca.conversa') === '0') mostrarConversa(false); } catch {}
$('#texto').addEventListener('input', () => { crescer(); $('#erroEnvio').textContent = ''; });
$('#pendManter').onclick = () => post('/api/decidir', { acao: 'aceitar' });
$('#pendDescartar').onclick = () => post('/api/decidir', { acao: 'descartar' });
$('#pendVer').onclick = () => { secao('time'); const d = document.getElementById('diff'); if (d) { d.scrollIntoView({ block: 'center', behavior: 'smooth' }); d.classList.add('destaque'); setTimeout(() => d.classList.remove('destaque'), 1800); } };
function secao(nome) {
  for (const n of ['fichas', 'construtor', 'projetos', 'config', 'quadro', 'rotinas', 'conexoes']) document.body.classList.toggle('ver-' + n, nome === n);
  for (const [b, n] of [['#navTime', 'time'], ['#navFichas', 'fichas'], ['#navConstrutor', 'construtor'], ['#navProjetos', 'projetos'], ['#navConfig', 'config'], ['#navQuadro', 'quadro'], ['#navRotinas', 'rotinas'], ['#navConexoes', 'conexoes']]) $(b).setAttribute('aria-pressed', nome === n);
  if (nome === 'fichas') { depois.montarMemoria(); depois.montarBasicos(true); }
  if (nome === 'time') requestAnimationFrame(() => { ajustarEscala(); desenharArestas(); });
}
$('#enviar').onclick = enviar; $('#parar').onclick = () => post('/api/parar'); $('#nova').onclick = () => post('/api/nova');
$('#navTime').onclick = () => secao('time'); $('#navFichas').onclick = () => secao('fichas'); $('#navConstrutor').onclick = abrirConstrutor;
$('#navProjetos').onclick = () => { secao('projetos'); depois.montarProjetos(); };
$('#navConfig').onclick = () => { secao('config'); depois.montarConfig(); };

// chamadas por arquivos carregados antes deste, em resposta a eventos (ver tardias.js)
Object.assign(depois, { atualizarAndamento, secao });

export { enviar, ocupado, pendencia, secao, trata, vazio };
