// Roda um caso real em cada arquitetura pronta, com o provedor de verdade que estiver no time.
// Uso (com a Muvuca rodando e o time num provedor real):  node scripts/arquiteturas-reais.mjs [numero do caso...]
// Trabalha só na pasta padrão (teste-estudio), cada caso numa subpasta de casos/. Gasta modelo de verdade.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const B = process.env.MUVUCA_URL || 'http://localhost:4317', H = { 'content-type': 'application/json' };
const AQUI = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const post = async (u, c) => { const r = await fetch(B + u, { method: 'POST', headers: H, body: JSON.stringify(c ?? {}) }); return { s: r.status, j: await r.json().catch(() => null) }; };
const cfg = async () => (await (await fetch(B + '/api/config')).json());
async function eventos() {
  const ctl = new AbortController(); const r = await fetch(B + '/api/eventos', { signal: ctl.signal }); const rd = r.body.getReader(); const dec = new TextDecoder(); let buf = ''; const fim = Date.now() + 1200;
  while (Date.now() < fim) { const p = await Promise.race([rd.read(), dormir(300).then(() => null)]); if (p?.value) buf += dec.decode(p.value); }
  ctl.abort(); return buf.split('\n').filter((l) => l.startsWith('data: ')).map((l) => { try { return JSON.parse(l.slice(6)); } catch { return {}; } });
}

const REGRAS = (pasta) => `Regras do caso: trabalhe SOMENTE dentro da pasta ${pasta}/ (crie-a) e não altere nada fora dela. ` +
  `Use JavaScript em CommonJS (require), sem dependências externas. Os testes usam node:test, ficam em arquivos *.test.js dentro dessa pasta e precisam passar rodando "node --test" na raiz do projeto.`;
const CASOS = [
  { arquivo: '0-agente-unico.json', pasta: 'casos/unico-slug', pedido: 'Crie um utilitário de slug: um módulo slug.js que exporta slugify(texto), convertendo um título em português em slug de URL (minúsculas, sem acentos, espaços e pontuação viram hífen, sem hífen repetido nem nas pontas), com testes cobrindo acentos, pontuação, espaços extras e texto vazio.' },
  { arquivo: '4-dupla.json', pasta: 'casos/dupla-moeda', pedido: 'Crie um módulo moeda.js que exporta formatarBRL(valor), devolvendo o valor em reais no formato brasileiro (R$ 1.234,56), tratando negativos, zero, arredondamento de centavos e entrada inválida (lança TypeError), com testes.' },
  { arquivo: '1-centralizada.json', pasta: 'casos/supervisor-cpf', pedido: 'Crie um validador de CPF: um módulo cpf.js com validarCPF(texto) e formatarCPF(texto), um programa de linha de comando cli.js que recebe um CPF como argumento e diz se é válido, testes do módulo (CPFs válidos, dígitos errados, sequências repetidas, com e sem pontuação) e um README.md curto explicando o uso.' },
  { arquivo: '3-esteira.json', pasta: 'casos/esteira-palavras', pedido: 'Crie um contador de palavras: um módulo contar.js com contar(texto) devolvendo { palavras, linhas, caracteres, maisFrequentes } (as 5 palavras mais frequentes, sem diferenciar maiúsculas), um programa cli.js que lê um arquivo de texto e imprime o resultado, testes do módulo e um README.md com exemplo de uso.' },
  { arquivo: '5-rede-completa.json', pasta: 'casos/rede-pomodoro', pedido: 'Crie um cronômetro Pomodoro: um módulo pomodoro.js com a lógica pura (fases de foco de 25 min, pausa curta de 5 e pausa longa de 15 a cada 4 focos; funções para avançar o tempo e saber a fase atual), uma página index.html com app.js que usa essa lógica para mostrar o tempo e os botões iniciar, pausar e reiniciar, testes da lógica e um README.md curto.' },
  { arquivo: '6-rede-personalizada.json', pasta: 'casos/rede-senha', pedido: 'Crie um gerador de senhas: um módulo senha.js com gerarSenha({ tamanho, maiusculas, numeros, simbolos }) usando crypto do Node, validando as opções e garantindo ao menos um caractere de cada tipo pedido, e forca(senha) classificando como fraca, média ou forte; uma página index.html simples que mostra uma senha gerada (com uma versão da lógica para o navegador), testes do módulo e um README.md curto.' },
  { arquivo: '2-hierarquica.json', pasta: 'casos/hierarquico-cambio', pedido: 'Crie um conversor de moedas: taxas fixas em taxas.json (BRL, USD, EUR, ARS em relação ao real); um módulo conversor.js com converter(valor, de, para) validando moedas e valores; um servidor em servidor.js com node:http que serve a página e a rota GET /api/converter?valor=&de=&para= devolvendo JSON (porta pela variável de ambiente PORT); uma página public/index.html com formulário que chama a API e mostra o resultado; testes do módulo e da API; e um README.md explicando como rodar e testar.' },
];

const c0 = await cfg();
const PROJETO = c0.projetoPadrao;
if (!/[\\/]teste-estudio$/.test(PROJETO)) { console.log('pasta padrão não é teste-estudio'); process.exit(2); }
if (c0.rodando) { console.log('há um pedido em andamento'); process.exit(2); }
if ((await eventos())[0]?.pendente) { console.log('há mudanças esperando decisão'); process.exit(2); }
const times = (await (await fetch(B + '/api/times')).json()).times;
const timeArquivo = times.find((t) => t.origem === 'arquivo');
const escolhidos = process.argv.slice(2).map(Number).filter((n) => n >= 1 && n <= CASOS.length);
const fila = escolhidos.length ? escolhidos.map((n) => CASOS[n - 1]) : CASOS;
const relatorio = [];
const gravar = () => fs.writeFile(path.join(AQUI, 'scripts', 'arquiteturas-reais-resultado.json'), JSON.stringify({ quando: new Date().toISOString(), projeto: PROJETO, casos: relatorio }, null, 2));

for (const caso of fila) {
  const t = times.find((x) => x.arquivo === caso.arquivo && x.origem === 'pronto');
  const r = { time: t?.nome || caso.arquivo, arquitetura: t?.arquitetura, pasta: caso.pasta, agentes: t?.agentes.length };
  relatorio.push(r);
  console.log(`\n===== ${r.time} (${r.arquitetura}, ${r.agentes} agentes) -> ${caso.pasta}`);
  if (!t || t.erro) { r.erro = 'modelo de time inválido: ' + (t?.erro || 'não achei'); console.log(r.erro); continue; }
  const tr = await post('/api/time', { time: t, salvar: false });
  if (tr.s !== 200) { r.erro = 'não foi ao palco: ' + JSON.stringify(tr.j); console.log(r.erro); continue; }
  const c = await cfg();
  if (c.agentes.some((a) => a.tipo === 'demo')) { r.erro = 'o time ficou com agente em demonstração: ' + c.agentes.filter((a) => a.tipo === 'demo').map((a) => a.id).join(','); console.log(r.erro); continue; }
  r.provedores = [...new Set(c.agentes.map((a) => a.provedor))].join(', ');
  const t0 = Date.now();
  const pd = await post('/api/pedido', { texto: `${caso.pedido}\n${REGRAS(caso.pasta)}`, projeto: PROJETO });
  if (pd.s !== 202) { r.erro = 'pedido recusado: ' + JSON.stringify(pd.j); console.log(r.erro); continue; }
  let negadas = 0, estourou = false;
  for (let i = 0; ; i++) {
    await dormir(2000);
    if (i % 4 === 3) { const ev = await eventos(); for (const a of ev.filter((e) => e.tipo === 'aprovacao' && !ev.some((x) => x.tipo === 'aprovacao_resolvida' && x.id === e.id))) { negadas++; await post('/api/aprovar', { id: a.id, ok: false }); } }
    if (!(await cfg()).rodando) break;
    if (Date.now() - t0 > 30 * 60000) { estourou = true; await post('/api/parar'); await dormir(4000); break; }
  }
  const ev = await eventos();
  const fim = ev.filter((e) => e.tipo === 'final').at(-1);
  const dif = ev.filter((e) => e.tipo === 'diff').at(-1);
  Object.assign(r, {
    segundos: Math.round((Date.now() - t0) / 1000), estourouTempo: estourou, aprovado: fim?.aprovado ?? null, ciclos: fim?.ciclos ?? null, motivo: fim?.motivo || '',
    etapas: ev.filter((e) => e.tipo === 'concluiu').map((e) => `${e.agente}(${e.modelo}${e.complexidade ? '/' + e.complexidade : ''}, ${e.segundos}s${e.arquivos.length ? ', ' + e.arquivos.length + ' arq' : ''})`),
    participaram: [...new Set(ev.filter((e) => e.tipo === 'concluiu').map((e) => e.agente))],
    naoParticiparam: c.agentes.map((a) => a.id).filter((id) => !ev.some((e) => (e.tipo === 'concluiu' || e.tipo === 'plano' || e.tipo === 'consulta') && e.agente === id)),
    planos: ev.filter((e) => e.tipo === 'plano').map((e) => `${e.agente}: ${e.etapas.map((s) => `${s.agente}[${s.complexidade}]`).join(', ')}`),
    passagens: ev.filter((e) => e.tipo === 'passagem').map((e) => `${e.de}>${e.para}`),
    portoes: ev.filter((e) => e.tipo === 'portao').map((e) => (e.ok ? 'passou' : 'falhou') + ` (${e.comando || 'sem teste'})`),
    devolucoes: ev.filter((e) => e.tipo === 'devolucao').map((e) => `${e.de}>${e.para}`),
    vereditos: ev.filter((e) => e.tipo === 'veredito').map((e) => (e.aprovado ? 'aprovado' : 'reprovado') + ': ' + String(e.texto).slice(0, 160) + (e.achados.length ? ` [${e.achados.length} achado(s)]` : '')),
    avisos: ev.filter((e) => e.tipo === 'aviso').map((e) => String(e.texto).slice(0, 200)),
    erros: ev.filter((e) => e.tipo === 'erro' || e.tipo === 'parado').map((e) => e.tipo + ': ' + String(e.texto || '').slice(0, 300)),
    memorias: ev.filter((e) => e.tipo === 'memoria').length, aprovacoesNegadas: negadas,
    arquivos: (dif?.arquivos || []).map((a) => a.arquivo),
    foraDaPasta: (dif?.arquivos || []).map((a) => a.arquivo).filter((a) => !a.startsWith(caso.pasta + '/')),
    tarefas: (() => { const q = new Map(); for (const e of ev.filter((x) => x.tipo === 'tarefa')) q.set(e.id, e.estado); return [...q.values()].join(','); })(),
  });
  console.log(`${r.aprovado === true ? 'APROVADO' : r.aprovado === false ? 'NÃO APROVADO' : 'SEM RESULTADO'} em ${r.segundos}s, ${r.ciclos} devolução(ões); ${r.arquivos.length} arquivo(s)${r.foraDaPasta.length ? ', FORA DA PASTA: ' + r.foraDaPasta.join(', ') : ''}`);
  console.log('  etapas:', r.etapas.join(' | '));
  if (r.planos.length) console.log('  planos:', r.planos.join(' || '));
  if (r.passagens.length) console.log('  passagens:', r.passagens.join(' '));
  console.log('  portões:', r.portoes.join(', '), '| vereditos:', r.vereditos.join(' || '));
  if (r.avisos.length) console.log('  avisos:', r.avisos.join(' || '));
  if (r.erros.length) console.log('  ERROS:', r.erros.join(' || '));
  if (r.naoParticiparam.length) console.log('  não participaram:', r.naoParticiparam.join(', '));
  // guarda o que foi feito (cada caso fica na sua subpasta) e libera o próximo
  if (ev[0]?.pendente) { const d = await post('/api/decidir', { acao: 'aceitar' }); r.mantido = d.s === 200; }
  await gravar();
}
const volta = await post('/api/time', { time: timeArquivo, salvar: false });
console.log('\nvolta ao time do arquivo:', volta.s);
await gravar();
console.log('\nRESUMO');
for (const r of relatorio) console.log(`- ${r.time}: ${r.erro ? 'ERRO ' + r.erro : (r.aprovado ? 'aprovado' : 'NÃO aprovado') + `, ${r.segundos}s, ${r.ciclos} devoluções, ${r.arquivos.length} arquivos`}`);
