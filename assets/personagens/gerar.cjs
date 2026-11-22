// Exporta os personagens da Muvuca como SVGs independentes, uma folha com todos os estados e o código-fonte.
const fs = require('fs'); const vm = require('vm'); const path = require('path');
const R = path.join(__dirname, '..', '..') + '/';   // pasta do projeto, onde quer que ela esteja
const html = fs.readFileSync(R + 'public/index.html', 'utf8');
const SAIDA = R + 'assets/personagens/';
fs.mkdirSync(SAIDA, { recursive: true });

// 1. código dos personagens: funções puras de texto, entre os dois marcadores
const ini = html.indexOf('/* ---------- personagens ---------- */'), fim = html.indexOf('/* ---------- palco ---------- */');
const codigo = html.slice(ini, fim);
const ctx = {}; vm.createContext(ctx);
vm.runInContext(codigo + '\nthis.mascote = mascoteVetor; this.PERSONAGENS = PERSONAGENS;', ctx);

// 2. CSS das animações e estados (o mesmo da tela), para o SVG funcionar sozinho
const linhas = html.split('\n');
const iCss = linhas.findIndex((l) => l.includes('.mascote * { transform-box:fill-box;'));
const fCss = linhas.findIndex((l) => l.includes('@media (prefers-reduced-motion: reduce)'));
const css = linhas.slice(iCss, fCss + 1).join('\n')
  .replace(/^ {2}#time\.ocupado[^\n]*\n/m, '')
  .replace('.agente, .mascote *, .foco', '.mascote *');

// 3. cor padrão de cada forma (a mesma da biblioteca de agentes)
const catalogo = JSON.parse(fs.readFileSync(R + 'config/catalogo-agentes.json', 'utf8')).agentes;
const cores = Object.fromEntries(catalogo.map((a) => [a.forma, a.cor]));
const NOMES = { cartola: 'Maestro de cartola (líder)', engrenagem: 'Engrenagem (back-end)', regente: 'Cápsula de batuta (sub-líder)', pilha: 'Pilha de discos (dados)', cristal: 'Cristal lapidado (front-end)', lente: 'Esfera de lente (pesquisa)', escudo: 'Escudo de óculos (revisor)', tela: 'Monitor de antena', gota: 'Gota', nuvem: 'Nuvem (UX)', cogumelo: 'Cogumelo (produto)', polvo: 'Polvo (testes)', foguete: 'Foguete (DevOps)', gato: 'Gato vigia (segurança)', livro: 'Livro (docs)', planta: 'Vaso de planta (generalista)' };
// ordem da biblioteca de agentes; as formas fora dela vão no fim
const formas = [...new Set([...catalogo.map((a) => a.forma), ...Object.keys(ctx.PERSONAGENS)])].filter((f) => ctx.PERSONAGENS[f]);
const extra = { tela: '#ff9f43', gota: '#5ad1ff', nuvem: '#9ad0ff' };
const ESTADOS = ['disponivel', 'pensando', 'trabalhando', 'concluido', 'aguardando'];

// Um SVG sozinho: o estado vai no atributo data-estado da raiz; o CSS embutido faz o resto.
const svgSolo = (forma, estado = 'disponivel', sufixo = '') => {
  const cor = cores[forma] || extra[forma] || '#8f7bff';
  const corpo = ctx.mascote({ id: forma, cor, forma, nome: NOMES[forma] || forma }, 0, sufixo);
  return corpo
    .replace('<svg class="mascote"', `<svg xmlns="http://www.w3.org/2000/svg" class="mascote" data-estado="${estado}" width="320" height="340"`)
    .replace(' style="--i:0"', '')
    .replace('<defs>', `<style>\n${css}\n</style>\n    <defs>`);
};

for (const f of formas) fs.writeFileSync(`${SAIDA}${f}.svg`, svgSolo(f) + '\n');

// 4. folha: cada personagem nos cinco estados
const celula = (f, e) => svgSolo(f, e, '-' + e).replace(/<style>[\s\S]*?<\/style>/, '').replace('width="320" height="340"', 'width="120" height="128"');
const folha = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Personagens da Muvuca</title>
<style>
  body { margin:0; padding:24px; background:#14121c; color:#f1ecdf; font:13px system-ui, sans-serif; }
  h1 { font-size:20px; margin:0 0 4px; } p { color:#9a94b0; margin:0 0 18px; }
  table { border-collapse:collapse; } th { font-weight:600; color:#9a94b0; padding:4px 8px; text-align:center; }
  td { text-align:center; padding:2px 6px; } td.nome { text-align:right; font-weight:600; padding-right:14px; white-space:nowrap; }
${css}
</style></head><body>
<h1>Personagens da Muvuca</h1>
<p>${formas.length} formas × 5 estados. Cada SVG desta pasta funciona sozinho; o estado é o atributo data-estado da raiz.</p>
<table><tr><th></th>${ESTADOS.map((e) => `<th>${e}</th>`).join('')}</tr>
${formas.map((f) => `<tr><td class="nome">${NOMES[f] || f}<br><small style="color:#9a94b0;font-weight:400">${f}.svg</small></td>${ESTADOS.map((e) => `<td>${celula(f, e)}</td>`).join('')}</tr>`).join('\n')}
</table></body></html>
`;
fs.writeFileSync(SAIDA + 'folha.html', folha);

// 5. código-fonte dos personagens, para a outra IA editar e devolver no mesmo formato
fs.writeFileSync(SAIDA + 'personagens.js', `// Código dos personagens da Muvuca, copiado de public/index.html (entre "personagens" e "palco").
// Para aplicar uma versão nova: devolver este arquivo no mesmo formato; ele volta para o mesmo trecho do index.html.
${codigo.trim()}\n`);
fs.writeFileSync(SAIDA + 'animacoes.css', `/* CSS das animações e estados, copiado de public/index.html. Os SVGs desta pasta já trazem uma cópia embutida. */\n${css}\n`);
console.log(formas.length, 'formas:', formas.join(', '));
