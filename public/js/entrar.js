// Entrar com o Claude: a tela que aparece quando o Claude Code está instalado mas sem login (ou com o login vencido).
// O botão pede ao servidor para acionar o login do próprio Claude Code, que abre a página da Anthropic no navegador.
// A Muvuca não vê senha nem guarda o acesso: só espera o Claude Code dizer que há alguém logado.
import { depois } from './tardias.js';
import { $, avisar, lerDoServidor, pedir } from './base.js';

/* ---------- entrar com o Claude ---------- */
let acompanhando = 0;
const parar = () => { clearInterval(acompanhando); acompanhando = 0; };
function mostrar(estado, texto, link) {
  const d = $('#dlgEntrar'); d.dataset.estado = estado;
  $('#enTexto').textContent = texto;
  const a = $('#enLink'); a.hidden = !link; if (link) a.href = link;
  $('#enBotao').disabled = estado === 'esperando';
  $('#enBotao').textContent = estado === 'esperando' ? 'Esperando o login…' : estado === 'erro' ? 'Tentar de novo' : 'Entrar com o Claude';
}
// Aciona o login e acompanha até o Claude Code dizer que há alguém logado. Devolve true se entrou.
function entrarComClaude(aoEntrar) {
  return new Promise(async (resolve) => {
    parar();
    mostrar('esperando', 'Abrindo a página de login do Claude no seu navegador…');
    try {
      const r = await pedir('/api/claude/entrar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.erro || 'não deu para iniciar o login');
    } catch (e) { mostrar('erro', e.message); return resolve(false); }
    let voltas = 0;
    acompanhando = setInterval(async () => {
      let j; try { j = await lerDoServidor('/api/claude/entrar'); } catch { return; }
      if (j.logado) { parar(); mostrar('pronto', 'Login feito. O time já pode trabalhar com o Claude.'); aoEntrar?.(); return resolve(true); }
      if (!j.andamento) { parar(); mostrar('erro', j.erro || 'O login não foi concluído. Tente de novo.'); return resolve(false); }
      mostrar('esperando', voltas++ < 2 ? 'Abrindo a página de login do Claude no seu navegador…' : 'A página de login do Claude abriu no seu navegador. Entre com a sua conta e autorize; esta tela percebe sozinha quando terminar.', j.link);
    }, 2000);
  });
}
// Abre a tela de entrada. Usada na partida (login que falta) e quando um pedido falha por login vencido.
function abrirEntrar(motivo) {
  const d = $('#dlgEntrar'); if (d.open) return;
  mostrar('inicio', motivo || 'O Claude Code está instalado neste computador, mas ninguém está logado. Entre com a sua conta do Claude para o time trabalhar com a sua assinatura.');
  $('#enBotao').onclick = async () => { if (await entrarComClaude()) { avisar('Login feito: o Claude está pronto.'); setTimeout(() => d.close(), 1400); } };
  $('#enDepois').onclick = () => { parar(); d.close(); };
  d.addEventListener('close', parar, { once: true });
  d.showModal();
}

// Na partida: quem já passou pelas boas-vindas, usa o Claude e está sem login cai direto nesta tela.
// (Na primeira abertura quem cuida disso são as boas-vindas, que têm o mesmo botão.)
(async () => {
  let j; try { j = await lerDoServidor('/api/inicio'); } catch { return; }
  if (j.feito && j.claude.instalado && j.claude.logado === false && j.provedorAtual === j.claude.provedor) abrirEntrar();
})();

// chamadas por arquivos carregados antes deste, em resposta a eventos (ver tardias.js)
Object.assign(depois, { abrirEntrar });

export { entrarComClaude };
