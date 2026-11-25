// Utilitários e estado compartilhado por todos os arquivos da tela.
import { compartilhado } from './estado.js';

const $ = (s) => document.querySelector(s);
// Cada página mostra uma conversa (a principal, ou a do endereço "?conversa=2"). Toda chamada à API leva esse número,
// para o servidor saber de qual time, de qual pasta e de quais pedidos se trata.
const CONVERSA = /^[1-9]$/.test(new URLSearchParams(location.search).get('conversa') || '') ? new URLSearchParams(location.search).get('conversa') : '1';
const pedir = (url, opcoes = {}) => fetch(url, String(url).startsWith('/api/') ? { ...opcoes, headers: { 'x-muvuca-conversa': CONVERSA, ...(opcoes.headers || {}) } } : opcoes);
// a pasta de projeto escolhida é lembrada por conversa: duas conversas não trabalham na mesma pasta
const chaveProjeto = CONVERSA === '1' ? 'muvuca.projeto' : `muvuca.projeto.${CONVERSA}`;
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
const ESTADOS = { disponivel:'Disponível', pensando:'Pensando', trabalhando:'Trabalhando', concluido:'Concluído', aguardando:'Aguarda você', divagando:'Espera a vez', falhou:'Falhou', bloqueado:'Aguarda o veredito', lendo:'Lendo', conferindo:'Conferindo' };
compartilhado.agentes = []; compartilhado.destino = 'time'; compartilhado.rodando = false; compartilhado.baloes = {};

// Lê JSON do servidor conferindo a resposta. Antes, uma resposta de erro era lida como se fosse o dado, e a tela
// quebrava mais adiante sem dizer nada.
async function lerDoServidor(url) {
  let r;
  try { r = await pedir(url); } catch { throw new Error('a Muvuca não respondeu. Ela continua aberta?'); }
  const j = await r.json().catch(() => null);
  if (r.status === 401) throw new Error('este navegador perdeu o acesso: reabra a Muvuca pelo link do terminal ou pelo aplicativo');
  // a conversa desta página foi fechada (em outra janela, ou o servidor reiniciou sem ela): volta para a principal
  if (r.status === 404 && j?.codigo === 'conversa' && CONVERSA !== '1') { location.replace('/'); throw new Error(j.erro); }
  if (!r.ok || j === null) throw new Error(j?.erro || `o servidor respondeu ${r.status}`);
  return j;
}
// Aviso passageiro no canto da tela, para o que não tem um lugar próprio onde aparecer.
function avisar(texto) {
  let a = document.getElementById('avisoGeral');
  if (!a) { a = el('div'); a.id = 'avisoGeral'; a.setAttribute('role', 'alert'); document.body.append(a); }
  a.textContent = texto; a.classList.add('visivel');
  clearTimeout(avisar.tempo); avisar.tempo = setTimeout(() => a.classList.remove('visivel'), 7000);
}
// Falha que ninguém tratou não some mais em silêncio.
window.addEventListener('unhandledrejection', (e) => { if (e.reason?.message) avisar(e.reason.message); });
const textoDoUso = (e) => {
  const tempo = e.segundos >= 60 ? `${Math.floor(e.segundos / 60)} min ${e.segundos % 60} s` : `${e.segundos} s`;
  const milhares = (n) => (n >= 1000 ? `${Math.round(n / 1000)} mil` : String(n));
  return `Tempo total: ${tempo} · ${e.chamadas} chamada(s) ao provedor` + (e.custo !== undefined ? ` · ${milhares(e.entrada)} tokens lidos e ${milhares(e.saida)} escritos · US$ ${e.custo.toFixed(2)} pela tabela da API` : '');
};

export { $, CONVERSA, ESTADOS, avisar, chaveProjeto, el, lerDoServidor, pedir, textoDoUso };
