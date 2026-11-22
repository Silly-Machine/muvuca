// Utilitários e estado compartilhado por todos os arquivos da tela.
// Parte da tela da Muvuca. Os arquivos de public/js/ dividem o mesmo escopo e são carregados na ordem do index.html.
const $ = (s) => document.querySelector(s);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
const ESTADOS = { disponivel:'Disponível', pensando:'Pensando', trabalhando:'Trabalhando', concluido:'Concluído', aguardando:'Aguarda você' };
let agentes = [], destino = 'time', rodando = false, baloes = {};
