// Buzina, a mascote: easter egg e conversa sobre a própria Muvuca.
import { compartilhado } from './estado.js';
import { depois } from './tardias.js';
import { $, el, lerDoServidor } from './base.js';
import { noPalco } from './palco.js';
import { montarBiblioteca } from './construtor.js';
import { secao } from './conversa.js';

/* ---------- easter egg: Buzina ---------- */
// Cinco cliques seguidos no logo, ou digitar "buzina" em qualquer lugar, soltam a mascote no palco.
// Ela espelha o humor do time (pensando, trabalhando, pronto, esperando você) e entra na biblioteca do construtor.
// A escolha fica na pasta de dados (vale para o navegador e para o aplicativo de mesa); o navegador guarda uma cópia.
compartilhado.buzinaGuardada = null;   // o que o servidor tem; null até a configuração chegar
const buzinaSolta = () => { if (compartilhado.buzinaGuardada !== null) return compartilhado.buzinaGuardada; try { return localStorage.getItem('muvuca.buzina') === '1'; } catch { return false; } };
function guardarBuzina(liga) {
  try { localStorage.setItem('muvuca.buzina', liga ? '1' : '0'); } catch {}
  if (compartilhado.buzinaGuardada === liga) return;
  compartilhado.buzinaGuardada = liga;
  fetch('/api/buzina/solta', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ solta: liga }) }).catch(() => {});
}
compartilhado.buzinaFesta = 0;
// Meta-chat: a Buzina responde dúvidas sobre a própria Muvuca. Só abre quando clicam nela.
const conversaBuzina = [];   // [{ de: 'voce' | 'buzina', texto }] — vale enquanto a página está aberta
function linhaBuzina(de, texto, extra) {
  const m = el('div', 'bc ' + de, texto); if (extra) m.append(el('small', '', extra));
  $('#bcFluxo').append(m); $('#bcFluxo').scrollTop = $('#bcFluxo').scrollHeight; return m;
}
async function abrirBuzinaChat(abrir) {
  const c = $('#buzinaChat'); c.hidden = !abrir; $('#buzina').setAttribute('aria-expanded', abrir);
  if (!abrir) return;
  if (!$('#bcFluxo').childElementCount) {
    linhaBuzina('buzina', 'Au! Eu sou a Buzina, mascote da Muvuca. Pergunte o que quiser sobre como a Muvuca funciona.');
    try { const j = await lerDoServidor('/api/buzina'); for (const t of j.sugestoes || []) { const b = el('button', '', t); b.type = 'button'; b.onclick = () => perguntarBuzina(t); $('#bcSugestoes').append(b); } } catch { /* sem sugestões */ }
  }
  $('#bcTexto').focus();
}
async function perguntarBuzina(pergunta) {
  pergunta = String(pergunta || '').trim(); if (!pergunta || $('#bcForm').dataset.ocupado) return;
  $('#bcForm').dataset.ocupado = '1'; $('#bcSugestoes').replaceChildren();
  linhaBuzina('voce', pergunta);
  const espera = linhaBuzina('buzina pensando', 'farejando a resposta…');
  let j = null;
  try {
    const r = await fetch('/api/buzina', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pergunta, historico: conversaBuzina }) });
    j = await r.json().catch(() => null); if (!r.ok) j = { texto: 'Não consegui responder: ' + (j?.erro || r.status) + '.' };
  } catch { j = { texto: 'Não consegui falar com o servidor da Muvuca. Ele está rodando?' }; }
  espera.remove();
  linhaBuzina('buzina', j.texto, [j.aviso, j.fonte && j.fonte !== 'guia embutido' ? 'respondido por ' + j.fonte : ''].filter(Boolean).join(' '));
  conversaBuzina.push({ de: 'voce', texto: pergunta }, { de: 'buzina', texto: j.texto });
  delete $('#bcForm').dataset.ocupado; $('#bcTexto').focus();
}
function atualizarBuzina() {
  const b = $('#buzina'); if (b.hidden) return;
  const estados = compartilhado.agentes.map((a) => noPalco(a.id)?.dataset.estado);
  const e = estados.includes('aguardando') || !$('#pendencia').hidden ? 'aguardando' : estados.includes('trabalhando') ? 'trabalhando' : estados.includes('pensando') ? 'pensando' : Date.now() < compartilhado.buzinaFesta ? 'concluido' : 'disponivel';
  if (b.dataset.estado === e) return;
  b.dataset.estado = e; b.querySelector('img').src = `/bonecos/salsicha-${e}.webp`;
}
function soltarBuzina(liga, comFala = true) {
  guardarBuzina(liga);
  const b = $('#buzina');
  if (!liga) { b.hidden = true; abrirBuzinaChat(false); depois.montarBasicos(); return; }
  b.hidden = false; delete b.dataset.estado; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; atualizarBuzina();
  if (document.body.classList.contains('ver-construtor')) montarBiblioteca();
  depois.montarBasicos();
}
$('#buzina').onclick = () => { const b = $('#buzina'); b.classList.remove('pulo'); void b.offsetWidth; b.classList.add('pulo'); abrirBuzinaChat($('#buzinaChat').hidden); };
$('#bcFechar').onclick = () => { abrirBuzinaChat(false); $('#buzina').focus(); };
$('#bcForm').onsubmit = (e) => { e.preventDefault(); const t = $('#bcTexto').value; $('#bcTexto').value = ''; perguntarBuzina(t); };
$('#buzinaChat').addEventListener('keydown', (e) => { if (e.key === 'Escape') { abrirBuzinaChat(false); $('#buzina').focus(); } });
{
  let cliques = [], letras = '';
  $('.marca').addEventListener('click', () => {
    const t = Date.now(); cliques = [...cliques.filter((x) => t - x < 2500), t];
    if (cliques.length >= 5) { cliques = []; soltarBuzina($('#buzina').hidden); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key.length !== 1) return;
    letras = (letras + e.key.toLowerCase()).slice(-6);
    if (letras === 'buzina' && $('#buzina').hidden) soltarBuzina(true);
  });
  setInterval(atualizarBuzina, 1500);   // para a festa do "concluído" acabar sozinha
}

$('#navQuadro').onclick = () => { secao('quadro'); depois.desenharQuadro(); };
$('#navRotinas').onclick = () => { secao('rotinas'); depois.montarRotinas(); };

// chamadas por arquivos carregados antes deste, em resposta a eventos (ver tardias.js)
Object.assign(depois, { atualizarBuzina, buzinaSolta });

export { buzinaSolta, soltarBuzina };
