// Boas-vindas da primeira abertura e partida da tela (carregado por último).
import { compartilhado } from './estado.js';
import { $, CONVERSA, chaveProjeto, el, pedir } from './base.js';
import { NOME_ARQ, estado } from './palco.js';
import { ocupado, pendencia, trata, vazio } from './conversa.js';
import { soltarBuzina } from './buzina.js';
import { desenharQuadro } from './quadro.js';
import { carregarConfig, lerProjetos } from './abas.js';

/* ---------- boas-vindas: primeira abertura ---------- */
// No aplicativo de mesa, "window.muvucaDesktop" traz o seletor de pasta do sistema.
const desktop = window.muvucaDesktop || null;
async function escolherPastaEm(campo) { const p = await desktop.escolherPasta(campo.value); if (p) { campo.value = p; campo.dispatchEvent(new Event('input', { bubbles: true })); } }
if (desktop) for (const id of ['pCaminho', 'cfProjeto']) {
  const campo = $('#' + id); if (!campo) continue;
  const b = el('button', 'pequeno', 'Escolher…'); b.type = 'button'; b.onclick = () => escolherPastaEm(campo); campo.after(b);
}
async function boasVindas(forcar = false) {
  const ler = async () => (await pedir('/api/inicio')).json();
  let j = await ler(); if (j.feito && !forcar) return;
  const pintar = () => {
    const c = j.claude, info = $('#bvClaudeInfo');
    $('#bvClaude').disabled = !c.pronto; $('#bvConferir').hidden = c.pronto;
    info.textContent = c.pronto ? `Usa o aplicativo "claude" logado neste computador (${c.versao || 'versão não informada'}). Vale a sua assinatura.`
      : !c.instalado ? 'O aplicativo "claude" (Claude Code) não foi encontrado. Instale, faça login e clique em "Conferir de novo".' : c.motivo + '.';
    if (c.pronto && !$('#bvDemo').checked) $('#bvClaude').checked = true; else if (!c.pronto) $('#bvDemo').checked = true;
  };
  $('#bvPasta').value = j.pasta; $('#bvEscolher').hidden = !desktop; pintar();
  $('#bvEscolher').onclick = () => escolherPastaEm($('#bvPasta'));
  $('#bvConferir').onclick = async (e) => { e.preventDefault(); $('#bvClaudeInfo').textContent = 'conferindo…'; j = await ler(); pintar(); };
  const d = $('#boasVindas');
  d.addEventListener('cancel', (e) => e.preventDefault());   // Esc não pula as escolhas
  $('#bvForm').onsubmit = async (e) => {
    e.preventDefault(); $('#bvErro').textContent = ''; $('#bvComecar').disabled = true;
    try {
      const provedor = $('#bvClaude').checked ? j.claude.provedor : 'demo';
      const r = await pedir('/api/inicio', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pasta: $('#bvPasta').value.trim(), provedor }) });
      const k = await r.json(); if (!r.ok) throw new Error(k.erro || 'não deu para concluir');
      $('#projeto').value = k.pasta; try { localStorage.setItem(chaveProjeto, k.pasta); } catch {}
      await carregarConfig(); await lerProjetos(); d.close();
    } catch (err) { $('#bvErro').textContent = err.message; }
    $('#bvComecar').disabled = false;
  };
  d.showModal();
}

// A chave de acesso chega uma vez pelo endereço; o cookie já foi gravado, então ela sai da barra e do histórico.
if (new URLSearchParams(location.search).has('t')) { const q = new URLSearchParams(location.search); q.delete('t'); history.replaceState(null, '', location.pathname + (q.size ? '?' + q : '')); }

(async () => {
  const c = await carregarConfig();
  let salvo = ''; try { salvo = localStorage.getItem(chaveProjeto) || localStorage.getItem('estudio.projeto') || ''; } catch {}
  $('#projeto').value = salvo || c.projetoPadrao; vazio(); lerProjetos();
  // quem soltou a Buzina num navegador antes de a escolha ir para a pasta de dados leva a escolha junto
  let noNavegador = false; try { noNavegador = localStorage.getItem('muvuca.buzina') === '1'; } catch {}
  compartilhado.buzinaGuardada = c.buzina === true;
  if (compartilhado.buzinaGuardada || noNavegador) soltarBuzina(true, false);
  for (const [v, t] of Object.entries(c.arquiteturas || {})) { const o = el('option', '', NOME_ARQ[v] || v); o.value = v; o.title = t; $('#cArq').append(o); }
  // ?vitrine=pensando,trabalhando,concluido,aguardando,disponivel mostra os estados sem rodar nada
  const vitrine = new URLSearchParams(location.search).get('vitrine');
  if (vitrine) { vitrine.split(',').forEach((e, i) => compartilhado.agentes[i] && estado(compartilhado.agentes[i].id, e)); return; }
  boasVindas(new URLSearchParams(location.search).has('boasvindas')).catch(() => {});
  const fonte = new EventSource('/api/eventos?conversa=' + CONVERSA); const luz = $('#conexao');
  fonte.onopen = () => { luz.classList.add('viva'); luz.title = 'conectado ao servidor'; };
  fonte.onerror = () => { luz.classList.remove('viva'); luz.title = 'sem conexão com o servidor'; };
  // Ao reconectar, o servidor reenvia a conversa inteira: o número do evento evita repetir o que já está na tela.
  // Se o servidor reiniciou ("boot" novo), a conversa dele começou do zero, e a tela acompanha.
  let boot = null, ultimo = 0;
  fonte.onmessage = (m) => {
    const e = JSON.parse(m.data);
    if (e.tipo === 'ola') {
      if (boot && boot !== e.boot) { ultimo = 0; compartilhado.tarefas.clear(); desenharQuadro(); pendencia(false); ocupado(false); vazio(); carregarConfig(); }
      boot = e.boot; return;
    }
    if (e.n && e.n <= ultimo) return;
    if (e.n) ultimo = e.n;
    (trata[e.tipo] || (() => {}))(e);
  };
})();

// O modo de captura do aplicativo de mesa (electron/main.cjs) abre as boas-vindas para fotografar. Como os módulos
// não deixam nada no escopo global, esta é a única porta, e só faz isso.
window.muvucaAbrirBoasVindas = () => boasVindas(true);
