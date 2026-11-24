// Servidor local da Muvuca. Sem dependências: node src/servidor.js
import http from 'node:http';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { rmSync, writeFileSync, readFileSync } from 'node:fs';
const readFileSyncSeguro = (arq) => { try { return readFileSync(arq, 'utf8'); } catch { return 'null'; } };
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Muvuca, nivelPadrao, chaveMemoria } from './orquestrador.js';
import { validarTime, fatiar, ARQUITETURAS, FORMAS, posicao } from './times.js';
import { salvarFoto, carregarFoto, diferencas, rodar, dentro, encerrarProcessos } from './ferramentas.js';
import os from 'node:os';
import { chamar, completarPath, instrucaoClaude } from './provedores.js';
import { responderOffline, sistemaBuzina, SUGESTOES } from './buzina.js';
import { criarMemoria } from './memoria.js';
import { normalizarRotinas, devidas, vigiasDevidos, avaliarVigia, pedidoDoVigia } from './rotinas.js';
import { caminhoAnexo, LIMITES_ANEXO } from './ajustes.js';
import { isolamentoDisponivel } from './isolamento.js';
import { arquivosDoTime, zip } from './exportar.js';
import { planejar, tocar, resumoDaEspecificacao } from './especificacao.js';
import { normalizarConexoes, conexoesDoAgente, prepararMcp, testarConexao, variaveisQueFaltam } from './conexoes.js';
import { lerJson, gravarJson, normalizarPreferencias, normalizarProjetos, infoProjeto, pastaPadrao } from './ajustes.js';

// Raiz do aplicativo: a pasta acima de src/, onde estão public/, config/ e docs/.
const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CONFIG = path.join(RAIZ, 'config');
const PORTA = Number(process.env.MUVUCA_PORTA ?? process.env.PORTA ?? 4317);   // 0 = qualquer porta livre
// Pasta de dados de quem usa (preferências, projetos, rotinas, memória, times salvos). Fica fora da pasta do app,
// que num aplicativo instalado não pode ser escrita.
const DADOS = path.resolve(process.env.MUVUCA_DADOS || path.join(os.homedir(), '.muvuca'));
const ARQUIVOS_DE_DADOS = ['preferencias.json', 'projetos.json', 'rotinas.json', 'decisoes.log', 'agentes.local.json', 'memoria', 'times', '.pendente'];
// O time em uso na conversa principal: sem isto, fechar e abrir a Muvuca (ou atualizá-la) voltava ao time do arquivo.
const ARQ_TIME_EM_USO = path.join(DADOS, 'time-em-uso.json');
if (!await fs.stat(DADOS).catch(() => null)) {
  await fs.mkdir(DADOS, { recursive: true });
  // Quem já usava a Muvuca com os dados dentro da pasta do app leva tudo junto, uma vez só. Os originais ficam onde estão.
  for (const n of ARQUIVOS_DE_DADOS) await fs.cp(path.join(RAIZ, n), path.join(DADOS, n), { recursive: true, errorOnExist: false }).catch(() => {});
}
// MUVUCA_CONFIG aceita o nome de um arquivo de config/ ou um caminho completo.
const ARQ_ABERTA = path.join(DADOS, 'aberta.json');
const readAberta = () => { try { return JSON.stringify(JSON.parse(String(readFileSyncSeguro(ARQ_ABERTA)))); } catch { return null; } };
const arquivoCfg = path.resolve(CONFIG, process.env.MUVUCA_CONFIG || process.env.ESTUDIO_CONFIG || 'agentes.json');
const cfg = JSON.parse(await fs.readFile(arquivoCfg, 'utf8'));
// Provedores dos outros arquivos de agentes entram na lista também: dá para trocar de provedor pela tela,
// sem subir o servidor de novo com outro arquivo. Os do arquivo em uso têm prioridade; depois, os seus (agentes.local.json na pasta de dados).
for (const extra of [path.join(DADOS, 'agentes.local.json'), path.join(CONFIG, 'agentes.json')]) {
  const outros = (await lerJsonSimples(extra))?.provedores || {};
  for (const [nome, p] of Object.entries(outros)) if (!cfg.provedores[nome]) cfg.provedores[nome] = p;
}
async function lerJsonSimples(arq) { try { return JSON.parse(await fs.readFile(arq, 'utf8')); } catch { return null; } }
const muvuca = new Muvuca(cfg);
const BOOT = Date.now().toString(36);
const VERSAO = JSON.parse(await fs.readFile(path.join(RAIZ, 'package.json'), 'utf8')).version;
// Ponto de restauração em disco: se o servidor cair com mudanças esperando decisão, elas voltam a aparecer ao subir.
const PASTA_PENDENTE = path.join(DADOS, '.pendente');
// Cada conversa aberta tem o próprio orquestrador: time, pasta de projeto, eventos e mudanças pendentes. A "1" é a
// principal e existe sempre. As outras nascem pela tela, para tocar mais de um pedido ao mesmo tempo, cada um na
// sua pasta. Duas conversas não trabalham na mesma pasta: o diff e o "Descartar" de uma atropelariam a outra.
const MAX_CONVERSAS_ABERTAS = 4;
const sessoes = new Map();   // id -> { id, muvuca, anexos }
const pastaPendente = (id) => (id === '1' ? PASTA_PENDENTE : `${PASTA_PENDENTE}-${id}`);
sessoes.set('1', { id: '1', muvuca, anexos: [] });
// Se o servidor caiu com mudanças esperando decisão numa conversa, elas voltam a aparecer nela ao subir.
async function restaurarPendente(muvuca, dir) {
  const guardado = await carregarFoto(dir);
  const pasta = guardado && await fs.stat(guardado.projeto).catch(() => null);
  if (pasta?.isDirectory()) {
    const arquivos = await diferencas(guardado.projeto, guardado.foto);
    if (arquivos.length) {
      muvuca.foto = guardado.foto; muvuca.projeto = guardado.projeto;
      muvuca.emitir({ tipo: 'aviso', texto: `O servidor foi reiniciado com mudanças esperando decisão em ${guardado.projeto}. Elas continuam aqui: escolha manter ou descartar.` });
      muvuca.emitir({ tipo: 'diff', arquivos, avisos: arquivos.avisos || [], autores: {} });
      return true;
    } else await salvarFoto(dir, null, null);
  } else if (guardado) await salvarFoto(dir, null, null);
  return false;
}
muvuca.aoMudarFoto = (foto, projeto) => salvarFoto(PASTA_PENDENTE, projeto, foto);
await restaurarPendente(muvuca, PASTA_PENDENTE);
// Time que veio no arquivo de configuração: fica na galeria para voltar a ele.
const timeDoArquivo = { nome: `Time do arquivo (${path.basename(arquivoCfg)})`, descricao: 'O time com que o servidor subiu.', arquitetura: cfg.arquitetura || 'centralizada', agentes: cfg.agentes };
// Agente de modelo pronto que não diz o provedor usa o do líder do arquivo.
let provedorPadrao = (cfg.agentes.find((a) => a.funcao === 'lider') || cfg.agentes[0]).provedor;
// Volta o time que estava em uso. Guardado como a tela mandou e validado de novo: se um provedor sumiu ou o formato
// mudou numa versão nova, fica o time do arquivo, e o arquivo com problema é deixado de lado (não apagado).
{
  const guardado = await lerJson(ARQ_TIME_EM_USO, null);
  if (guardado?.time) {
    try {
      const t = validarTime(guardado.time, cfg.provedores, provedorPadrao);
      muvuca.cfg = { ...muvuca.cfg, nomeTime: t.nome, arquitetura: t.arquitetura, agentes: t.agentes, desenho: t.desenho, modelo: t.modelo };
    } catch (e) {
      console.log(`O time em uso guardado não vale mais (${e.message}); ficou o time do arquivo.`);
      await fs.rename(ARQ_TIME_EM_USO, ARQ_TIME_EM_USO + '.invalido').catch(() => {});
    }
  }
}
// Um provedor está pronto para uso? CLI precisa do comando instalado; API precisa da chave e de endereço/modelo preenchidos.
completarPath();   // o "claude" instalado pelo instalador oficial pode não estar no PATH de quem abriu a Muvuca
const comandoExiste = new Map();
async function situacaoProvedor(nome, p) {
  if (p.tipo === 'demo') return { pronto: true, motivo: 'roteiro simulado, sem custo' };
  if (p.tipo === 'cli') {
    if (!comandoExiste.has(p.comando)) {
      const r = await rodar(process.platform === 'win32' ? 'where' : 'which', { args: [String(p.comando)], limiteMs: 8000 });
      comandoExiste.set(p.comando, r.codigo === 0);
    }
    if (!comandoExiste.get(p.comando)) return { pronto: false, motivo: `o comando "${p.comando}" não está instalado` };
    const falta = await opcoesQueFaltam(p);
    if (falta.length) return { pronto: false, motivo: `a versão instalada de "${p.comando}" não tem ${falta.length > 1 ? 'as opções' : 'a opção'} ${falta.join(', ')}: atualize o aplicativo` };
    return { pronto: true, motivo: `usa o aplicativo "${p.comando}" logado neste computador` };
  }
  if (/TROQUE/i.test(`${p.baseUrl} ${p.modelo}`)) return { pronto: false, motivo: 'falta preencher endereço ou modelo no arquivo de agentes' };
  if (p.chaveEnv && !process.env[p.chaveEnv]) return { pronto: false, motivo: `falta a variável de ambiente ${p.chaveEnv}` };
  return { pronto: true, motivo: p.baseUrl || '' };
}
// As opções que a Muvuca passa ao aplicativo existem na versão instalada? Confere contra a ajuda dele ("--help"),
// uma vez por comando. Sem isso, uma versão antiga falharia no meio do pedido com um erro difícil de entender.
const ajudaDe = new Map();
async function opcoesQueFaltam(p) {
  if (process.env.MUVUCA_SEM_CONFERIR_CLI) return [];
  if (!ajudaDe.has(p.comando)) {
    const r = await rodar(String(p.comando), { args: ['--help'], limiteMs: 15000 });
    ajudaDe.set(p.comando, r.codigo === 0 ? r.saida : null);
  }
  const ajuda = ajudaDe.get(p.comando);
  if (!ajuda) return [];   // sem ajuda legível não dá para conferir: segue como antes
  const usadas = [...new Set([...(p.args || []), ...(p.argsLeitura || []), ...(p.argsMcp || []), p.argModelo].filter((a) => /^--[a-z]/.test(String(a))))];
  return usadas.filter((o) => !new RegExp(`(^|[\\s,])${o}([\\s,=<\\[]|$)`, 'm').test(ajuda));
}
async function versaoDe(comando) {
  const r = await rodar(String(comando), { args: ['--version'], limiteMs: 15000 });
  return r.codigo === 0 ? r.saida.trim().split('\n')[0].slice(0, 60) : '';
}
const PASTA_PRONTOS = path.join(CONFIG, 'arquiteturas');
const PASTA_SALVOS = path.join(DADOS, 'times');
// Configurações (aba da engrenagem) e projetos (aba da pasta): JSON simples na pasta de dados.
const ARQ_PREFS = path.join(DADOS, 'preferencias.json');
const ARQ_PROJETOS = path.join(DADOS, 'projetos.json');
// Pasta de projeto de fábrica: a irmã "teste-estudio" quando existe (quem roda do código-fonte); senão, uma pasta na casa do usuário.
const PROJETO_FABRICA = await fs.stat(pastaPadrao(RAIZ)).then((s) => s.isDirectory()).catch(() => false) ? pastaPadrao(RAIZ) : path.join(os.homedir(), 'Muvuca', 'primeiro-projeto');
const opcoesPrefs = { raiz: RAIZ, cfg, padrao: PROJETO_FABRICA };
const prefsGravadas = await lerJson(ARQ_PREFS, null);
let prefs = normalizarPreferencias(prefsGravadas ?? {}, opcoesPrefs);
// Quem já tinha preferências gravadas antes de existir a tela de boas-vindas não precisa passar por ela.
if (prefsGravadas && prefsGravadas.inicioFeito === undefined) prefs.inicioFeito = true;
const aplicarPrefs = () => { for (const { muvuca } of sessoes.values()) { muvuca.maxCiclos = prefs.maxCiclos; muvuca.maxPassos = prefs.maxPassos; muvuca.limiteAgenteS = prefs.limiteAgenteMin * 60; muvuca.limiteTestesMs = prefs.limiteTestesMin * 60000; muvuca.isolarTestes = prefs.isolarTestes; } };
aplicarPrefs();
// Memória por agente (notas por projeto) e rotinas (pedidos agendados).
const memoria = criarMemoria(path.join(DADOS, 'memoria'));
muvuca.memoria = memoria;
// Conexões (servidores MCP) e quem pode usar cada uma. Só agentes que não escrevem arquivos recebem conexões,
// e só quando o provedor deles sabe recebê-las (campo argsMcp). O que uma conexão faz fora da pasta do projeto
// não é desfeito pelo "Descartar": por isso quem escreve código fica sem.
const ARQ_CONEXOES = path.join(DADOS, 'conexoes.json');
let conexoes = { conexoes: [], agentes: {} };
try { conexoes = normalizarConexoes(await lerJson(ARQ_CONEXOES, {})); } catch { /* arquivo estragado: começa vazio */ }
function situacaoConexoes(a) {
  if ((a.ferramentas || []).includes('escrever')) return { pode: false, motivo: 'escreve arquivos: fica sem conexões, porque o que elas fazem fora da pasta não é desfeito pelo "Descartar"' };
  const p = cfg.provedores[a.provedor];
  if (!Array.isArray(p?.argsMcp)) return { pode: false, motivo: p?.tipo === 'demo' ? 'em demonstração as conexões não são usadas' : `o provedor ${a.provedor} não recebe conexões` };
  return { pode: true, motivo: '' };
}
const conexoesDe = async (ag) => {
  if (!situacaoConexoes(ag).pode) return null;
  // conexão com variável de ambiente faltando fica de fora, em vez de derrubar a chamada inteira
  return prepararMcp(path.join(DADOS, '.mcp'), ag.id, conexoesDoAgente(conexoes, ag.id).filter((c) => !variaveisQueFaltam(c).length));
};
muvuca.conexoesDe = conexoesDe;
const verConexoes = (muvuca) => ({
  conexoes: conexoes.conexoes.map((c) => ({ ...c, faltam: variaveisQueFaltam(c) })),
  agentes: conexoes.agentes,
  time: muvuca.cfg.agentes.map((a) => ({ id: a.id, nome: a.nome, papel: a.papel || '', ...situacaoConexoes(a) })),
});
// Histórico: ao começar uma conversa nova, a anterior é guardada na pasta de dados. Ficam as 100 mais recentes.
const PASTA_CONVERSAS = path.join(DADOS, 'conversas');
const MAX_CONVERSAS = 100;
const aoArquivar = (eventos) => {
  const pedidos = eventos.filter((e) => e.tipo === 'pedido');
  const fim = [...eventos].reverse().find((e) => ['final', 'parado', 'erro'].includes(e.tipo));
  // o diff linha a linha pode ser enorme: no histórico fica só a lista de arquivos de cada um
  const enxuto = eventos.filter((e) => !['status', 'passo', 'tarefa'].includes(e.tipo)).map((e) => (e.tipo === 'diff' ? { ...e, arquivos: e.arquivos.map(({ arquivo, tipo }) => ({ arquivo, tipo })) } : e));
  const quando = new Date(pedidos[0].hora || Date.now());
  const id = quando.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 6);
  const conversa = { id, quando: quando.toISOString(), titulo: String(pedidos[0].texto || '').split('\n')[0].slice(0, 120), projeto: pedidos[0].projeto || '', pedidos: pedidos.length,
    resultado: !fim ? '' : fim.tipo === 'parado' ? 'interrompida' : fim.tipo === 'erro' ? 'erro' : fim.aprovado ? 'aprovada' : fim.aprovado === false ? 'não aprovada' : 'concluída', eventos: enxuto };
  (async () => {
    await fs.mkdir(PASTA_CONVERSAS, { recursive: true });
    await gravarJson(path.join(PASTA_CONVERSAS, id + '.json'), conversa);
    const todas = (await fs.readdir(PASTA_CONVERSAS)).filter((n) => /^\d{14}-[a-z0-9]+\.json$/.test(n)).sort();
    for (const velha of todas.slice(0, Math.max(0, todas.length - MAX_CONVERSAS))) await fs.rm(path.join(PASTA_CONVERSAS, velha), { force: true });
  })().catch(() => {});
};
muvuca.aoArquivar = aoArquivar;
// Abre uma conversa nova, com o time e o provedor de fábrica e as mesmas regras da principal.
async function abrirConversa(id) {
  const m = new Muvuca({ ...cfg, agentes: structuredClone(cfg.agentes) });
  const sessao = { id, muvuca: m, anexos: [] };
  sessoes.set(id, sessao);
  m.memoria = memoria; m.conexoesDe = conexoesDe; m.aoArquivar = aoArquivar;
  m.aoMudarFoto = (foto, projeto) => salvarFoto(pastaPendente(id), projeto, foto);
  aplicarPrefs();
  if (provedorPadrao && cfg.provedores[provedorPadrao] && (await situacaoProvedor(provedorPadrao, cfg.provedores[provedorPadrao])).pronto) m.usarProvedor(provedorPadrao, prefs.modelos[provedorPadrao]);
  for (const [ag, v] of Object.entries(prefs.niveis)) if (m.agente(ag)) m.definirNivel(ag, v);
  m.eventos = [];
  return sessao;
}
// Especificações em etapas: uma por conversa, gravada em disco a cada mudança para poder ser retomada.
const PASTA_ESPECS = path.join(DADOS, 'especificacoes');
const arquivoDaEspec = (id) => path.join(PASTA_ESPECS, `conversa-${id}.json`);
async function gravarEspec(sessao) {
  const run = sessao.espec;
  await fs.mkdir(PASTA_ESPECS, { recursive: true });
  if (!run) return fs.rm(arquivoDaEspec(sessao.id), { force: true });
  const { parar, ...paraDisco } = run;
  await gravarJson(arquivoDaEspec(sessao.id), paraDisco);
  sessao.muvuca.emitir({ tipo: 'espec', ...resumoDaEspecificacao(run) });
}
// Continua (ou começa) a especificação da conversa, em segundo plano. Erro inesperado vira pausa, nunca some.
function tocarEspec(sessao) {
  const run = sessao.espec;
  tocar(run, { muvuca: sessao.muvuca, comandoTeste: prefs.comandoTeste || undefined, aoMudar: () => gravarEspec(sessao) })
    .catch(async (e) => { run.estado = 'pausada'; run.motivo = `erro inesperado: ${e.message}`; await gravarEspec(sessao).catch(() => {}); });
}
// Especificação que estava andando quando a Muvuca fechou volta pausada: quem decide retomar é a pessoa.
async function carregarEspec(sessao) {
  const run = await lerJson(arquivoDaEspec(sessao.id), null);
  if (!run || !Array.isArray(run.etapas)) return;
  if (['rodando', 'planejando'].includes(run.estado)) { run.estado = 'pausada'; run.motivo = 'a Muvuca foi fechada no meio desta especificação'; }
  for (const e of run.etapas) if (e.estado === 'rodando') { e.estado = 'pendente'; e.tentativas = Math.max(0, (e.tentativas || 1) - 1); }
  sessao.espec = run;
}
const qualquerRodando = () => [...sessoes.values()].some((x) => x.muvuca.rodando);
// A pasta está em uso por outra conversa (trabalhando nela, ou com mudanças dela esperando decisão)?
const pastaEmUso = (pasta, menos) => [...sessoes.values()].find((x) => x.id !== menos && x.muvuca.projeto && path.resolve(x.muvuca.projeto) === path.resolve(pasta) && (x.muvuca.rodando || x.muvuca.foto));
const resumoDaConversa = (x) => {
  const ultimo = [...x.muvuca.eventos].reverse().find((e) => e.tipo === 'pedido');
  return { id: x.id, rodando: x.muvuca.rodando, pendente: !!x.muvuca.foto, projeto: x.muvuca.projeto || '', titulo: String((x.muvuca.rodando && x.muvuca.pedidoAtual) || ultimo?.texto || '').split('\n')[0].slice(0, 80), aguardando: x.muvuca.pendentes.size > 0 };
};
const ARQ_ROTINAS = path.join(DADOS, 'rotinas.json');
let rotinas = [];
try {
  const bruto = await lerJson(ARQ_ROTINAS, []);
  rotinas = normalizarRotinas(bruto, Array.isArray(bruto) ? bruto : []);
  // "rodando" gravado em disco quer dizer que o servidor caiu no meio da rotina
  for (const r of rotinas) if (r.resultado === 'rodando') r.resultado = 'interrompida: o servidor parou no meio';
} catch { rotinas = []; }
const salvarRotinas = () => gravarJson(ARQ_ROTINAS, rotinas);
// Roda uma rotina como um pedido normal para o time. O resultado fica anotado na própria rotina.
async function dispararRotina(r, manual = false, textoDoPedido = r.texto) {
  r.ultima = new Date().toISOString(); r.resultado = 'rodando'; await salvarRotinas();
  muvuca.emitir({ tipo: 'rotina', nome: r.nome, manual });
  try {
    await muvuca.pedido({ texto: textoDoPedido, projeto: r.projeto || prefs.projetoPadrao, comandoTeste: prefs.comandoTeste || undefined });
    const fim = [...muvuca.eventos].reverse().find((e) => ['final', 'parado', 'erro'].includes(e.tipo));
    r.resultado = !fim ? 'sem resultado' : fim.tipo === 'parado' ? 'interrompida por você' : fim.tipo === 'erro' ? `erro: ${fim.texto}`
      : fim.aprovado ? 'aprovada' : fim.aprovado === false ? `não aprovada: ${fim.motivo}` : 'concluída (só conversa)';
  } catch (e) { r.resultado = `recusada: ${e.message}`; muvuca.emitir({ tipo: 'erro', texto: `Rotina "${r.nome}": ${e.message}` }); }
  await salvarRotinas().catch(() => {});
}
// Relógio: a cada 20 s vê se alguma rotina está na hora. Com o time ocupado, tenta de novo no próximo tique (dentro da janela).
// Vigias: rodam o comando deles de tempos em tempos, sem gastar modelo. Só quando a condição acontece (o comando
// passa a falhar, ou a saída muda) o time recebe o pedido. Se o time estiver ocupado, o disparo fica guardado.
const verificando = new Set();
async function verificarVigia(r) {
  if (verificando.has(r.id)) return null;
  verificando.add(r.id);
  try {
    const pasta = r.projeto || prefs.projetoPadrao;
    const st = await fs.stat(pasta).catch(() => null);
    const res = st?.isDirectory() ? await rodar(r.comando, { cwd: pasta, limiteMs: 120000 }) : { codigo: -1, saida: `pasta não encontrada: ${pasta}` };
    const av = avaliarVigia(r, res);
    r.vigia = av.vigia;
    if (av.disparar) r.vigia.pendente = pedidoDoVigia(r, res.saida);
    await salvarRotinas().catch(() => {});
    return { ...av, saida: res.saida };
  } finally { verificando.delete(r.id); }
}
async function tiqueDasRotinas() {
  for (const r of vigiasDevidos(rotinas)) await verificarVigia(r).catch(() => {});
  if (muvuca.rodando) return;
  // um vigia que disparou tem prioridade sobre a rotina de horário: é algo que acabou de acontecer
  const v = rotinas.find((r) => r.tipo === 'vigia' && r.ativa && r.vigia?.pendente);
  if (v) { const texto = v.vigia.pendente; v.vigia.pendente = ''; await salvarRotinas().catch(() => {}); return dispararRotina(v, false, texto).catch(() => {}); }
  const r = devidas(rotinas)[0];
  if (r) dispararRotina(r).catch(() => {});
}
let tiqueEmCurso = false;
setInterval(() => { if (tiqueEmCurso) return; tiqueEmCurso = true; tiqueDasRotinas().catch(() => {}).finally(() => { tiqueEmCurso = false; }); }, Number(process.env.MUVUCA_TIQUE_MS) || 20000).unref();

if (prefs.provedorTime && cfg.provedores[prefs.provedorTime] && (await situacaoProvedor(prefs.provedorTime, cfg.provedores[prefs.provedorTime])).pronto) {
  muvuca.usarProvedor(prefs.provedorTime, prefs.modelos[prefs.provedorTime]);
  provedorPadrao = prefs.provedorTime;
  muvuca.eventos = muvuca.eventos.filter((e) => e.tipo !== 'provedor');   // é o estado inicial, não um acontecimento da conversa
}
// escolhas de modelo por agente feitas na tela, para quem ainda está no time
for (const [id, v] of Object.entries(prefs.niveis)) if (muvuca.agente(id)) muvuca.definirNivel(id, v);
muvuca.eventos = muvuca.eventos.filter((e) => e.tipo !== 'nivel_agente');
for (const nome of await fs.readdir(DADOS).catch(() => [])) {
  const m = /^\.pendente-([2-9])$/.exec(nome); if (!m) continue;
  const x = await abrirConversa(m[1]);
  if (!(await restaurarPendente(x.muvuca, pastaPendente(m[1])))) sessoes.delete(m[1]);
}
// conversa extra que tinha uma especificação por terminar também volta, mesmo sem mudanças pendentes
for (const nome of await fs.readdir(PASTA_ESPECS).catch(() => [])) {
  const m = /^conversa-([2-9])\.json$/.exec(nome); if (!m || sessoes.has(m[1])) continue;
  const run = await lerJson(path.join(PASTA_ESPECS, nome), null);
  if (run && !['concluida', 'cancelada'].includes(run.estado)) await abrirConversa(m[1]); else await fs.rm(path.join(PASTA_ESPECS, nome), { force: true }).catch(() => {});
}
for (const x of sessoes.values()) await carregarEspec(x).catch(() => {});
const lerProjetos = async () => { try { return normalizarProjetos(await lerJson(ARQ_PROJETOS, null) ?? [{ nome: path.basename(prefs.projetoPadrao), caminho: prefs.projetoPadrao }]); } catch { return []; } };

async function lerTimes(pasta, origem) {
  const nomes = (await fs.readdir(pasta).catch(() => [])).filter((n) => n.endsWith('.json')).sort();
  const lista = [];
  for (const n of nomes) {
    try {
      const bruto = JSON.parse(await fs.readFile(path.join(pasta, n), 'utf8'));
      const t = validarTime(bruto, cfg.provedores, provedorPadrao);
      // a tela mostra "padrão do arquivo" para quem não escolheu provedor, em vez do padrão já resolvido
      const comProvedor = new Set((bruto.agentes || []).filter((a) => a.provedor).map((a) => String(a.id).trim().toLowerCase()));
      t.agentes = t.agentes.map((a) => (comProvedor.has(a.id) ? a : { ...a, provedor: '' }));
      lista.push({ origem, arquivo: n, ...t });
    }
    catch (e) { lista.push({ origem, arquivo: n, nome: n, erro: e.message, agentes: [] }); }
  }
  return lista;
}

// ---------- acesso
// Quem pode falar com este servidor: só quem tem o token, guardado na pasta de dados (só o seu usuário lê).
// O link que a Muvuca abre leva o token uma vez; o navegador recebe um cookie e segue sem ele. Sem isso, qualquer
// programa ou outro usuário do computador podia mandar pedidos e rodar comandos por aqui.
const ARQ_TOKEN = path.join(DADOS, 'acesso.token');
let TOKEN = (await fs.readFile(ARQ_TOKEN, 'utf8').catch(() => '')).trim();
if (!/^[a-f0-9]{48}$/.test(TOKEN)) { TOKEN = crypto.randomBytes(24).toString('hex'); await fs.writeFile(ARQ_TOKEN, TOKEN + '\n', { mode: 0o600 }); }
export const acesso = TOKEN;
const mesmoToken = (v) => typeof v === 'string' && v.length === TOKEN.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(TOKEN));
// Endereços pelos quais a Muvuca atende. Um site malicioso pode apontar o próprio nome para 127.0.0.1 e, pelo navegador,
// ler o que este servidor responde; conferir o endereço pedido fecha essa porta.
const ENDERECOS = new Set(['localhost', '127.0.0.1', '[::1]']);
const SEGURANCA = { 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer', 'cross-origin-resource-policy': 'same-origin' };
// A página só carrega o que vem deste servidor. Estilo embutido é permitido porque a tela posiciona elementos por atributo style.
const POLITICA = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
const SEM_ACESSO = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Muvuca</title><body style="font:16px system-ui;background:#241c22;color:#eee;display:grid;place-items:center;height:100vh;margin:0"><div style="max-width:460px;padding:24px"><h1 style="color:#f5a45a;font-size:22px">A Muvuca está aberta, mas este navegador ainda não tem acesso</h1><p>Abra pelo link que apareceu no terminal, ou pelo aplicativo. O link leva uma chave que só a sua conta do computador conhece.</p></div></body></html>`;

// Entrar com o Claude: a Muvuca aciona "claude auth login", que abre a página de login da Anthropic no navegador e
// guarda o acesso no próprio Claude Code. Nada de senha ou token passa por aqui: só se sabe se o login terminou.
let loginClaude = null;   // { filho, saida, erro } enquanto o login está em andamento ou acabou de falhar
async function claudeLogado() {
  const r = await rodar('claude', { args: ['auth', 'status'], limiteMs: 15000 });
  try { return JSON.parse(r.saida).loggedIn === true; } catch { return false; }
}
function iniciarLoginClaude() {
  if (loginClaude?.filho) return;
  const noWindows = process.platform === 'win32';
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const comando = process.env.MUVUCA_LOGIN_CLAUDE || 'claude auth login --claudeai';   // a variável existe para os testes
  const filho = noWindows || process.env.MUVUCA_LOGIN_CLAUDE ? spawn(comando, [], { shell: true, windowsHide: true, env, stdio: ['ignore', 'pipe', 'pipe'] }) : spawn('claude', ['auth', 'login', '--claudeai'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  const estado = loginClaude = { filho, saida: '', erro: '' };
  const junta = (d) => { estado.saida = (estado.saida + d).slice(-4000); };
  filho.stdout.on('data', junta); filho.stderr.on('data', junta);
  const tempo = setTimeout(() => { estado.erro = 'O login não foi concluído em 5 minutos.'; try { filho.kill(); } catch { /* já saiu */ } }, 300000);
  filho.on('error', (e) => { clearTimeout(tempo); estado.filho = null; estado.erro = e.code === 'ENOENT' ? 'O aplicativo "claude" não foi encontrado.' : e.message; });
  filho.on('close', (codigo) => { clearTimeout(tempo); estado.filho = null; if (codigo !== 0 && !estado.erro) estado.erro = 'O Claude Code não concluiu o login. Tente de novo.'; });
}

const json = (res, codigo, obj) => { res.writeHead(codigo, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
const corpo = async (req, max = 1e6) => { let t = ''; for await (const p of req) { t += p; if (t.length > max) throw new Error('corpo grande demais'); } return t ? JSON.parse(t) : {}; };

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    for (const [k, v] of Object.entries(SEGURANCA)) res.setHeader(k, v);
    if (!ENDERECOS.has(String(req.headers.host || '').replace(/:\d+$/, '').toLowerCase())) return json(res, 403, { erro: 'endereço não permitido' });
    // A página e a API pedem o token (cabeçalho, para programas; cookie, para o navegador). Estilos, scripts e imagens são públicos.
    if (url.pathname === '/' || url.pathname.startsWith('/api/')) {
      const nomeCookie = `muvuca_${servidor.address()?.port || 0}`;   // por porta: duas Muvucas abertas não derrubam o acesso uma da outra
      const cookies = Object.fromEntries(String(req.headers.cookie || '').split(';').map((c) => { const i = c.indexOf('='); return [c.slice(0, i).trim(), c.slice(i + 1).trim()]; }));
      const chegou = url.pathname === '/' && mesmoToken(url.searchParams.get('t') || '');
      if (chegou) res.setHeader('set-cookie', `${nomeCookie}=${TOKEN}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000`);
      if (!chegou && !mesmoToken(req.headers['x-muvuca-token']) && !mesmoToken(cookies[nomeCookie])) {
        if (url.pathname !== '/') return json(res, 401, { erro: 'sem acesso: abra a Muvuca pelo link do terminal ou pelo aplicativo' });
        res.writeHead(401, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); return res.end(SEM_ACESSO);
      }
    }
    // De qual conversa é esta chamada: cabeçalho (a tela manda em toda chamada) ou parâmetro (fluxo de eventos). Sem nada, a principal.
    const idConversa = String(req.headers['x-muvuca-conversa'] || url.searchParams.get('conversa') || '1');
    const sessao = sessoes.get(idConversa);
    if (!sessao && url.pathname.startsWith('/api/') && url.pathname !== '/api/sessoes') return json(res, 404, { codigo: 'conversa', erro: `a conversa ${idConversa} não está aberta` });
    const muvuca = (sessao || sessoes.get('1')).muvuca;
    if (req.method === 'GET' && url.pathname === '/api/sessoes') return json(res, 200, { conversas: [...sessoes.values()].map(resumoDaConversa), maximo: MAX_CONVERSAS_ABERTAS });
    if (req.method === 'POST' && url.pathname === '/api/sessoes') {
      const b = await corpo(req);
      if (b.acao === 'abrir') {
        if (sessoes.size >= MAX_CONVERSAS_ABERTAS) return json(res, 400, { erro: `no máximo ${MAX_CONVERSAS_ABERTAS} conversas abertas ao mesmo tempo: feche uma antes` });
        const id = ['2', '3', '4', '5', '6', '7', '8', '9'].find((n) => !sessoes.has(n));
        await abrirConversa(id);
        await fs.rm(arquivoDaEspec(id), { force: true }).catch(() => {});   // número reaproveitado não herda especificação antiga
        return json(res, 200, { ok: true, id });
      }
      if (b.acao === 'fechar') {
        const x = sessoes.get(String(b.id || ''));
        if (!x) return json(res, 404, { erro: 'conversa não encontrada' });
        if (x.id === '1') return json(res, 400, { erro: 'a conversa principal não fecha' });
        if (x.muvuca.rodando) return json(res, 409, { erro: 'essa conversa está no meio de um pedido: pare o pedido antes de fechar' });
        if (x.muvuca.foto) return json(res, 400, { codigo: 'decisao', erro: 'essa conversa tem mudanças esperando decisão: escolha manter ou descartar antes de fechar' });
        x.muvuca.nova();   // manda a conversa para o histórico
        sessoes.delete(x.id);
        return json(res, 200, { ok: true });
      }
      return json(res, 400, { erro: 'ação desconhecida' });
    }
    // Só aceita chamadas da própria página: bloqueia sites abertos no navegador tentando comandar o servidor local.
    if (req.method === 'POST') {
      const origem = req.headers.origin;
      if (origem && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origem)) return json(res, 403, { erro: 'origem não permitida' });
      if (!/application\/json/.test(req.headers['content-type'] || '')) return json(res, 415, { erro: 'envie JSON' });
    }
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': POLITICA });
      return res.end(await fs.readFile(path.join(RAIZ, 'public', 'index.html')));
    }
    // Arquivos da tela: imagens dos personagens (forma-estado.webp), estilos e scripts. Só nomes simples dentro
    // das três pastas conhecidas; nada de subir de pasta nem de servir outro tipo de arquivo.
    const estatico = req.method === 'GET' && (/^\/(bonecos)\/([a-z]+-[a-z]+\.webp)$/.exec(url.pathname) || /^\/(css)\/([a-z0-9-]+\.css)$/.exec(url.pathname) || /^\/(fontes)\/([a-z0-9-]+\.woff2)$/.exec(url.pathname) || /^\/(js)\/((?:[a-z0-9-]+\/)?[a-z0-9-]+\.js)$/.exec(url.pathname));
    if (estatico) {
      const tipo = { bonecos: 'image/webp', css: 'text/css; charset=utf-8', fontes: 'font/woff2', js: 'text/javascript; charset=utf-8' }[estatico[1]];
      const arq = path.join(RAIZ, 'public', estatico[1], estatico[2]);
      const st = await fs.stat(arq).catch(() => null);
      if (!st?.isFile()) { res.writeHead(404); return res.end(); }
      const etag = `"${st.size}-${Math.round(st.mtimeMs)}"`;
      if (req.headers['if-none-match'] === etag) { res.writeHead(304, { etag, 'cache-control': 'no-cache' }); return res.end(); }
      res.writeHead(200, { 'content-type': tipo, 'cache-control': 'no-cache', etag });
      return res.end(await fs.readFile(arq));
    }
    if (req.method === 'GET' && url.pathname === '/api/config') {
      const atual = muvuca.cfg;   // o construtor pode ter trocado o time
      return json(res, 200, {
        versao: VERSAO, buzina: prefs.buzina, rodando: muvuca.rodando, config: path.basename(arquivoCfg), projetoPadrao: process.env.MUVUCA_PROJETO || process.env.ESTUDIO_PROJETO || prefs.projetoPadrao,
        nomeTime: atual.nomeTime || timeDoArquivo.nome, arquitetura: muvuca.arquitetura, arquiteturas: ARQUITETURAS, desenho: atual.desenho || null, modelo: atual.modelo || '',
        // provedores sem chave nem argumentos: a tela só precisa do nome e dos modelos
        provedores: Object.entries(cfg.provedores).map(([nome, p]) => ({ nome, tipo: p.tipo, modelo: p.modelo || '', modelos: p.modelos || null })),
        agentes: atual.agentes.map((a) => ({ id: a.id, pos: a.pos || null, nome: a.nome, papel: a.papel, funcao: a.funcao || '', chefe: muvuca.chefeDe(a), conexoes: Array.isArray(a.conexoes) ? a.conexoes : null, complexidade: a.complexidade || '', nivelPadrao: nivelPadrao(a) || '', sistema: a.sistema || '', cor: a.cor, forma: a.forma, provedor: a.provedor, ferramentas: a.ferramentas || [], tipo: cfg.provedores[a.provedor]?.tipo || '?', modeloFixo: a.modelo || '', modelo: a.modelo || cfg.provedores[a.provedor]?.modelo || '', modelos: a.modelos || (a.modelo ? null : cfg.provedores[a.provedor]?.modelos) || null })),
      });
    }
    if (req.method === 'GET' && url.pathname === '/api/times') {
      // biblioteca de agentes básicos do construtor (só formas que a tela sabe desenhar)
      const catalogo = JSON.parse(await fs.readFile(path.join(CONFIG, 'catalogo-agentes.json'), 'utf8').catch(() => '{"agentes":[]}')).agentes.filter((a) => FORMAS.includes(a.forma));
      return json(res, 200, { catalogo, times: [{ origem: 'arquivo', ...timeDoArquivo }, ...await lerTimes(PASTA_PRONTOS, 'pronto'), ...await lerTimes(PASTA_SALVOS, 'salvo')] });
    }
    if (req.method === 'GET' && url.pathname === '/api/especificacao') return json(res, 200, { especificacao: resumoDaEspecificacao(sessao.espec) });
    if (req.method === 'POST' && url.pathname === '/api/especificacao') {
      // Começa uma especificação em etapas: quem lidera planeja, e as etapas rodam uma a uma como pedidos normais.
      const b = await corpo(req, 2e5);
      const especificacao = String(b.texto || '').trim();
      if (especificacao.length < 20) return json(res, 400, { erro: 'escreva a especificação: o objetivo, o que precisa ter e como saber que ficou pronto' });
      if (muvuca.rodando) return json(res, 409, { erro: 'há um pedido em andamento' });
      if (sessao.espec && !['concluida', 'cancelada'].includes(sessao.espec.estado)) return json(res, 409, { codigo: 'especificacao', erro: 'esta conversa já tem uma especificação em andamento: retome ou cancele a que está aqui' });
      const projeto = path.resolve(String(b.projeto || ''));
      const st = await fs.stat(projeto).catch(() => null);
      if (!b.projeto || !st?.isDirectory()) return json(res, 400, { erro: `pasta de projeto não encontrada: ${b.projeto || '(vazia)'}` });
      const ocupada = pastaEmUso(projeto, sessao.id);
      if (ocupada) return json(res, 409, { codigo: 'pasta', erro: `essa pasta está em uso na conversa ${ocupada.id}: use outra pasta ou resolva lá primeiro` });
      if (muvuca.foto && muvuca.projeto && path.resolve(muvuca.projeto) !== projeto) return json(res, 400, { codigo: 'decisao', erro: `há mudanças esperando sua decisão em ${muvuca.projeto}: decida antes de começar uma especificação em outra pasta` });
      const run = sessao.espec = { id: Date.now().toString(36), titulo: especificacao.split('\n').find((l) => l.trim())?.replace(/^#+\s*/, '').trim().slice(0, 100) || 'Especificação', especificacao, projeto, estado: 'planejando', motivo: '', criada: new Date().toISOString(), etapas: [] };
      await gravarEspec(sessao);
      (async () => {
        try { run.etapas = await planejar(muvuca, especificacao, projeto); }
        catch (e) { run.estado = 'cancelada'; run.motivo = `não deu para planejar: ${e.message}`; return gravarEspec(sessao).catch(() => {}); }
        if (run.estado === 'cancelada') return;
        tocarEspec(sessao);
      })();
      return json(res, 202, { ok: true, especificacao: resumoDaEspecificacao(run) });
    }
    if (req.method === 'POST' && url.pathname === '/api/especificacao/acao') {
      const b = await corpo(req); const run = sessao.espec;
      if (!run) return json(res, 404, { erro: 'esta conversa não tem especificação' });
      if (b.acao === 'pausar') {
        if (run.estado !== 'rodando') return json(res, 400, { erro: 'a especificação não está andando' });
        run.parar = true; muvuca.parar();   // para a etapa em curso; ela volta a ficar pendente
        return json(res, 200, { ok: true });
      }
      if (b.acao === 'retomar' || b.acao === 'pular') {
        if (run.estado !== 'pausada') return json(res, 400, { erro: 'só dá para retomar uma especificação pausada' });
        if (muvuca.rodando) return json(res, 409, { erro: 'há um pedido em andamento' });
        const i = run.etapas.findIndex((e) => !['pronta', 'pulada'].includes(e.estado));
        if (i >= 0) { if (b.acao === 'pular') run.etapas[i].estado = 'pulada'; else { run.etapas[i].estado = 'pendente'; run.etapas[i].tentativas = 0; } }
        tocarEspec(sessao);
        return json(res, 200, { ok: true });
      }
      if (b.acao === 'cancelar') {
        if (['concluida', 'cancelada'].includes(run.estado)) return json(res, 400, { erro: 'a especificação já terminou' });
        const andando = run.estado === 'rodando';
        run.estado = 'cancelada'; run.motivo = 'cancelada por você';
        if (andando) muvuca.parar();
        await gravarEspec(sessao);
        return json(res, 200, { ok: true });
      }
      if (b.acao === 'fechar') {
        if (!['concluida', 'cancelada'].includes(run.estado)) return json(res, 400, { erro: 'cancele a especificação antes de tirá-la da tela' });
        sessao.espec = null; await gravarEspec(sessao);
        return json(res, 200, { ok: true });
      }
      return json(res, 400, { erro: 'ação desconhecida' });
    }
    if (req.method === 'POST' && url.pathname === '/api/exportar') {
      // Exporta o time (o do construtor, ainda sem aplicar, ou qualquer outro) como arquivos que outra IA consegue usar:
      // AGENTS.md, o JSON da Muvuca e os subagentes do Claude Code. "previa" só mostra, "zip" baixa, "pasta" grava no projeto.
      const b = await corpo(req);
      const t = { ...validarTime(b.time, cfg.provedores, provedorPadrao), descricao: String(b.time?.descricao || '').trim().slice(0, 400) };
      const hoje = new Date();
      const arquivos = arquivosDoTime(t, {
        versao: VERSAO, maxCiclos: prefs.maxCiclos,
        data: `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`,
        modelos: prefs.modelos['claude-cli'] || cfg.provedores['claude-cli']?.modelos,
      });
      if (b.formato === 'zip') {
        const pacote = zip(arquivos, hoje);
        res.writeHead(200, { 'content-type': 'application/zip', 'content-length': pacote.length, 'content-disposition': `attachment; filename="${fatiar(t.nome) || 'time'}-muvuca.zip"`, 'cache-control': 'no-store' });
        return res.end(pacote);
      }
      if (b.formato === 'pasta') {
        const projeto = path.resolve(String(b.projeto || ''));
        const st = await fs.stat(projeto).catch(() => null);
        if (!b.projeto || !st?.isDirectory()) return json(res, 400, { erro: `pasta de projeto não encontrada: ${b.projeto || '(vazia)'}` });
        // com um time trabalhando na pasta, ou mudanças dela esperando decisão, os arquivos exportados entrariam no diff como se fossem do time
        const ocupada = pastaEmUso(projeto, null);
        if (ocupada) return json(res, 409, { codigo: 'pasta', erro: `essa pasta está em uso na conversa ${ocupada.id}${ocupada.muvuca.rodando ? ' (trabalhando)' : ' (mudanças esperando decisão)'}: grave depois, ou baixe o .zip` });
        const destinos = arquivos.map((a) => ({ ...a, abs: dentro(projeto, a.caminho) }));
        const existentes = [];
        for (const a of destinos) { const atual = await fs.readFile(a.abs, 'utf8').catch(() => null); if (atual !== null && atual !== a.conteudo) existentes.push(a.caminho); }
        if (existentes.length && b.sobrescrever !== true) return json(res, 409, { codigo: 'existe', existentes, erro: `já existe na pasta, com outro conteúdo: ${existentes.join(', ')}` });
        for (const a of destinos) { await fs.mkdir(path.dirname(a.abs), { recursive: true }); await fs.writeFile(a.abs, a.conteudo); }
        return json(res, 200, { ok: true, projeto, gravados: destinos.map((a) => a.caminho), sobrescritos: existentes });
      }
      return json(res, 200, { nome: t.nome, arquivos: arquivos.map((a) => ({ caminho: a.caminho, tamanho: Buffer.byteLength(a.conteudo) })), agentsMd: arquivos[0].conteudo });
    }
    // Mover os bonecos no palco: muda só o lugar de cada um no desenho, nunca o time. Vale até com um pedido
    // em andamento, porque o protocolo não olha o desenho. Na conversa 1, o lugar novo fica no time em uso.
    if (req.method === 'POST' && url.pathname === '/api/desenho') {
      const b = await corpo(req);
      const pedidas = b.pos && typeof b.pos === 'object' && !Array.isArray(b.pos) ? Object.entries(b.pos) : null;
      if (!pedidas?.length || pedidas.length > 200) return json(res, 400, { erro: 'mande "pos" com o lugar de cada agente que mudou, por exemplo {"pos": {"dev": [1, 2]}}' });
      const novas = new Map();
      for (const [id, p] of pedidas) {
        if (!muvuca.cfg.agentes.some((a) => a.id === id)) return json(res, 400, { erro: `o agente "${id}" não está no time do palco` });
        const v = posicao(p); if (!v) return json(res, 400, { erro: `lugar inválido para "${id}": use [x, y] com números entre -200 e 200` });
        novas.set(id, v);
      }
      const comPos = (a) => (novas.has(a.id) ? { ...a, pos: novas.get(a.id) } : a);
      muvuca.cfg = { ...muvuca.cfg, agentes: muvuca.cfg.agentes.map(comPos) };
      if (sessao.id === '1') {
        const guardado = await lerJson(ARQ_TIME_EM_USO, null);
        const c = muvuca.cfg;
        const time = guardado?.time ? { ...guardado.time, agentes: (guardado.time.agentes || []).map(comPos) }
          : { nome: c.nomeTime, arquitetura: c.arquitetura, agentes: c.agentes, ...(c.desenho ? { desenho: c.desenho } : {}), ...(c.modelo ? { modelo: c.modelo } : {}) };
        await gravarJson(ARQ_TIME_EM_USO, { time, gravado: new Date().toISOString() });
      }
      return json(res, 200, { ok: true, pos: Object.fromEntries(novas) });
    }
    if (req.method === 'POST' && url.pathname === '/api/time') {
      const b = await corpo(req);
      const t = validarTime(b.time, cfg.provedores, provedorPadrao);
      muvuca.trocarTime(t);
      if (sessao.id === '1') await gravarJson(ARQ_TIME_EM_USO, { time: b.time, gravado: new Date().toISOString() });
      let arquivo = null;
      if (b.salvar) {
        arquivo = (fatiar(t.nome) || 'time') + '.json';
        await fs.mkdir(PASTA_SALVOS, { recursive: true });
        // provedor só vai para o arquivo quando foi escolhido: assim o time salvo roda com qualquer configuração
        const escolhido = new Set((b.time.agentes || []).filter((a) => a.provedor).map((a) => String(a.id).trim().toLowerCase()));
        const gravar = { ...t, agentes: t.agentes.map(({ provedor, ...a }) => (escolhido.has(a.id) ? { ...a, provedor } : a)) };
        await fs.writeFile(path.join(PASTA_SALVOS, arquivo), JSON.stringify(gravar, null, 2) + '\n');
      }
      return json(res, 200, { ok: true, arquivo, time: t });
    }
    if (req.method === 'GET' && url.pathname === '/api/preferencias') {
      const isolamento = await isolamentoDisponivel();
      return json(res, 200, { preferencias: prefs, isolamento: { disponivel: isolamento.ok, motivo: isolamento.motivo || '', paraAgentes: !!isolamento.paraAgentes }, pastaPadrao: PROJETO_FABRICA, pastaDados: DADOS, config: path.basename(arquivoCfg), deAmbiente: process.env.MUVUCA_PROJETO || process.env.ESTUDIO_PROJETO || '' });
    }
    if (req.method === 'POST' && url.pathname === '/api/preferencias') {
      const b = await corpo(req);
      if (qualquerRodando()) return json(res, 409, { erro: 'há um pedido em andamento em alguma conversa' });
      prefs = normalizarPreferencias({ ...prefs, ...b.preferencias }, opcoesPrefs);
      await gravarJson(ARQ_PREFS, prefs);
      aplicarPrefs();
      return json(res, 200, { ok: true, preferencias: prefs });
    }
    if (req.method === 'POST' && url.pathname === '/api/claude/entrar') {
      await corpo(req);
      if (!comandoExiste.has('claude')) await situacaoProvedor('claude-cli', { tipo: 'cli', comando: 'claude' });
      if (comandoExiste.get('claude') !== true && !process.env.MUVUCA_LOGIN_CLAUDE) return json(res, 400, { erro: 'o aplicativo "claude" (Claude Code) não está instalado neste computador' });
      iniciarLoginClaude();
      return json(res, 200, { ok: true });
    }
    if (req.method === 'GET' && url.pathname === '/api/claude/entrar') {
      // se o Claude Code não conseguiu abrir o navegador, ele imprime o endereço: a tela oferece como link
      const link = /https:\/\/[^\s"'<>]+/.exec(loginClaude?.saida || '')?.[0] || '';
      return json(res, 200, { andamento: !!loginClaude?.filho, logado: await claudeLogado(), ...(link && { link }), ...(loginClaude?.erro && !loginClaude.filho && { erro: loginClaude.erro }) });
    }
    if (req.method === 'GET' && url.pathname === '/api/inicio') {
      // Tela de boas-vindas: o que já está pronto nesta máquina. Quem não foi achado é procurado de novo: a pessoa
      // pode ter acabado de instalar o Claude Code e clicado em "Conferir de novo".
      for (const [k, v] of comandoExiste) if (!v) comandoExiste.delete(k);
      completarPath();
      const cli = Object.entries(cfg.provedores).find(([, p]) => p.tipo === 'cli' && p.comando === 'claude');
      const s = cli ? await situacaoProvedor(cli[0], cli[1]) : { pronto: false, motivo: 'nenhum provedor usa o aplicativo "claude"' };
      const instalado = !!cli && comandoExiste.get('claude') === true;
      // logado? Só o sim ou não sai daqui: a resposta do aplicativo traz e-mail e organização, que não interessam à tela.
      let logado = null;
      if (instalado) { const r = await rodar('claude', { args: ['auth', 'status'], limiteMs: 15000 }); try { logado = JSON.parse(r.saida).loggedIn === true; } catch { logado = r.codigo === 0 ? null : false; } }
      return json(res, 200, {
        feito: prefs.inicioFeito, pasta: prefs.projetoPadrao, pastaExiste: !!(await infoProjeto(prefs.projetoPadrao)).existe, pastaDados: DADOS,
        provedorAtual: provedorPadrao,
        claude: { provedor: cli?.[0] || '', instalado, logado, instalar: instrucaoClaude(), pronto: s.pronto && logado !== false, motivo: logado === false ? 'o aplicativo "claude" está instalado, mas sem login: rode "claude" num terminal e entre na sua conta' : s.motivo, versao: instalado ? await versaoDe('claude') : '' },
      });
    }
    if (req.method === 'POST' && url.pathname === '/api/inicio') {
      // Conclui as boas-vindas: cria a pasta do projeto se preciso, guarda como padrão e liga o provedor escolhido
      const b = await corpo(req);
      if (muvuca.rodando) return json(res, 409, { erro: 'há um pedido em andamento' });
      const pasta = String(b.pasta || '').trim();
      if (!pasta || !path.isAbsolute(pasta)) return json(res, 400, { erro: 'informe o caminho completo da pasta do projeto' });
      const alvo = path.resolve(pasta);
      const st = await fs.stat(alvo).catch(() => null);
      if (st && !st.isDirectory()) return json(res, 400, { erro: 'esse caminho é um arquivo, não uma pasta' });
      if (!st) await fs.mkdir(alvo, { recursive: true });
      let provedor = '';
      if (b.provedor && !cfg.provedores[b.provedor]) return json(res, 400, { erro: `provedor não encontrado: ${b.provedor}` });
      if (b.provedor) {
        const s = await situacaoProvedor(b.provedor, cfg.provedores[b.provedor]);
        if (!s.pronto) return json(res, 400, { erro: `${b.provedor} não está pronto: ${s.motivo}` });
        const p = cfg.provedores[b.provedor];
        muvuca.usarProvedor(b.provedor, prefs.modelos[b.provedor] || p.modelos);
        provedorPadrao = provedor = b.provedor;
      }
      prefs = normalizarPreferencias({ ...prefs, projetoPadrao: alvo, inicioFeito: true, ...(provedor && { provedorTime: provedor }) }, opcoesPrefs);
      await gravarJson(ARQ_PREFS, prefs);
      const lista = await lerProjetos();
      if (!lista.some((x) => path.resolve(x.caminho) === alvo)) await gravarJson(ARQ_PROJETOS, normalizarProjetos([...lista, { nome: path.basename(alvo), caminho: alvo }]));
      return json(res, 200, { ok: true, pasta: alvo, criada: !st, provedor });
    }
    if (req.method === 'GET' && url.pathname === '/api/projetos') {
      const lista = await lerProjetos();
      const projetos = await Promise.all(lista.map(async (p) => ({ ...p, ...await infoProjeto(p.caminho) })));
      return json(res, 200, { projetos, padrao: prefs.projetoPadrao });
    }
    if (req.method === 'POST' && url.pathname === '/api/projetos') {
      const b = await corpo(req);
      const lista = normalizarProjetos(b.projetos);
      await gravarJson(ARQ_PROJETOS, lista);
      return json(res, 200, { ok: true, projetos: lista });
    }
    if (req.method === 'GET' && url.pathname === '/api/provedores') {
      const lista = await Promise.all(Object.entries(cfg.provedores).map(async ([nome, p]) => ({
        nome, tipo: p.tipo, modelo: p.modelo || '', modelos: p.modelos || null, ...await situacaoProvedor(nome, p),
        agentes: muvuca.cfg.agentes.filter((a) => a.provedor === nome).length,
      })));
      return json(res, 200, { provedores: lista, total: muvuca.cfg.agentes.length });
    }
    if (req.method === 'POST' && url.pathname === '/api/provedores/usar') {
      const b = await corpo(req);
      const p = cfg.provedores[b.nome]; if (!p) return json(res, 404, { erro: 'provedor não encontrado' });
      const s = await situacaoProvedor(b.nome, p);
      if (!s.pronto) return json(res, 400, { erro: `${b.nome} não está pronto: ${s.motivo}` });
      muvuca.usarProvedor(b.nome, b.modelos);
      provedorPadrao = b.nome;
      prefs = normalizarPreferencias({ ...prefs, provedorTime: b.nome, modelos: { ...prefs.modelos, ...(p.modelos ? { [b.nome]: p.modelos } : {}) } }, opcoesPrefs);
      await gravarJson(ARQ_PREFS, prefs);
      return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/agentes/nivel') {
      const b = await corpo(req);
      muvuca.definirNivel(String(b.id || ''), String(b.nivel || ''));
      const niveis = { ...prefs.niveis }; if (b.nivel) niveis[b.id] = b.nivel; else delete niveis[b.id];
      prefs = normalizarPreferencias({ ...prefs, niveis }, opcoesPrefs);
      await gravarJson(ARQ_PREFS, prefs);
      return json(res, 200, { ok: true });
    }
    if (req.method === 'GET' && url.pathname === '/api/buzina') return json(res, 200, { sugestoes: SUGESTOES });
    if (req.method === 'POST' && url.pathname === '/api/buzina') {
      const b = await corpo(req);
      const pergunta = String(b.pergunta || '').trim().slice(0, 600);
      if (!pergunta) return json(res, 400, { erro: 'pergunta vazia' });
      // Com um provedor de verdade no time, responde o modelo leve dele, com o README como guia.
      // Em demonstração, ou se o modelo falhar, responde o guia embutido.
      const lider = muvuca.agente(muvuca.idLider);
      const p = cfg.provedores[lider.provedor];
      if (p && p.tipo !== 'demo' && (await situacaoProvedor(lider.provedor, p)).pronto) {
        try {
          const prov = muvuca.provedor({ id: 'buzina', provedor: lider.provedor }, 'baixa');
          const historico = (Array.isArray(b.historico) ? b.historico : []).slice(-8)
            .map((m) => ({ role: m?.de === 'buzina' ? 'assistant' : 'user', content: String(m?.texto || '').slice(0, 1500) })).filter((m) => m.content);
          const pasta = path.join(os.tmpdir(), 'muvuca-buzina'); await fs.mkdir(pasta, { recursive: true });   // longe de qualquer projeto
          const readme = await fs.readFile(path.join(RAIZ, 'docs', 'guia.md'), 'utf8').catch(() => fs.readFile(path.join(RAIZ, 'README.md'), 'utf8')).catch(() => '');
          const r = await chamar(prov, { sistema: sistemaBuzina(readme), mensagens: [...historico, { role: 'user', content: pergunta }], ferramentas: [], sinal: AbortSignal.timeout(90000), cwd: pasta, agente: { id: 'buzina', nome: 'Buzina', ferramentas: [] } });
          const texto = String(r.texto || '').trim();
          // aplicativo que saiu com erro (login vencido, por exemplo) devolve a mensagem de erro como texto: isso não é resposta
          const falhou = /\[aviso: .+ saiu com código \d+\]/.test(texto);
          if (texto && !falhou) return json(res, 200, { texto: texto.slice(0, 4000), fonte: prov.modelo || prov.nome });
          if (falhou) return json(res, 200, { texto: responderOffline(pergunta).texto, fonte: 'guia embutido', aviso: `O modelo não respondeu (${texto.split('\n')[0].slice(0, 120)}). Usei o guia embutido.` });
        } catch (e) {
          const off = responderOffline(pergunta);
          return json(res, 200, { texto: off.texto, fonte: 'guia embutido', aviso: `O modelo não respondeu (${String(e.message).slice(0, 120)}). Usei o guia embutido.` });
        }
      }
      return json(res, 200, { texto: responderOffline(pergunta).texto, fonte: 'guia embutido' });
    }
    if (req.method === 'GET' && url.pathname === '/api/conversas') {
      // histórico: só o resumo de cada conversa, da mais nova para a mais antiga
      const nomes = (await fs.readdir(PASTA_CONVERSAS).catch(() => [])).filter((n) => /^\d{14}-[a-z0-9]+\.json$/.test(n)).sort().reverse();
      const lista = [];
      for (const n of nomes) { const c = await lerJson(path.join(PASTA_CONVERSAS, n), null); if (c) lista.push({ id: c.id, quando: c.quando, titulo: c.titulo, projeto: c.projeto, pedidos: c.pedidos, resultado: c.resultado }); }
      return json(res, 200, { conversas: lista });
    }
    const umaConversa = req.method === 'GET' && /^\/api\/conversas\/(\d{14}-[a-z0-9]+)$/.exec(url.pathname);
    if (umaConversa) {
      const c = await lerJson(path.join(PASTA_CONVERSAS, umaConversa[1] + '.json'), null);
      return c ? json(res, 200, c) : json(res, 404, { erro: 'conversa não encontrada' });
    }
    if (req.method === 'GET' && url.pathname === '/api/conexoes') return json(res, 200, verConexoes(muvuca));
    if (req.method === 'POST' && url.pathname === '/api/conexoes') {
      const b = await corpo(req);
      if (qualquerRodando()) return json(res, 409, { erro: 'há um pedido em andamento em alguma conversa' });
      conexoes = normalizarConexoes({ conexoes: b.conexoes ?? conexoes.conexoes, agentes: b.agentes ?? conexoes.agentes });
      // agente do time atual que não pode usar conexão não fica na lista: se um dia passasse a poder, ganharia a conexão sem ninguém marcar
      for (const a of muvuca.cfg.agentes) if (!situacaoConexoes(a).pode && a.provedor && cfg.provedores[a.provedor]?.tipo !== 'demo') delete conexoes.agentes[a.id];
      await gravarJson(ARQ_CONEXOES, conexoes);
      return json(res, 200, { ok: true, ...verConexoes(muvuca) });
    }
    if (req.method === 'POST' && url.pathname === '/api/conexoes/testar') {
      // Sobe o servidor da conexão, pede a lista de ferramentas e encerra. Aceita uma conexão já salva (id) ou uma ainda no formulário.
      const b = await corpo(req);
      const c = b.id ? conexoes.conexoes.find((x) => x.id === b.id) : normalizarConexoes({ conexoes: [b.conexao] }).conexoes[0];
      if (!c) return json(res, 404, { erro: 'conexão não encontrada' });
      return json(res, 200, await testarConexao(c, { limiteMs: 30000 }));
    }
    if (req.method === 'POST' && url.pathname === '/api/buzina/solta') {
      // Guarda na pasta de dados se a mascote está solta. No navegador isso ficava só no próprio navegador,
      // e o aplicativo de mesa (outro endereço) não a encontrava.
      const b = await corpo(req);
      prefs = normalizarPreferencias({ ...prefs, buzina: b.solta === true }, opcoesPrefs);
      await gravarJson(ARQ_PREFS, prefs);
      return json(res, 200, { ok: true, solta: prefs.buzina });
    }
    if (req.method === 'POST' && url.pathname === '/api/anexos') {
      // arquivos e pastas mandados junto com o pedido: gravados em anexos/ dentro da pasta do projeto, antes de o time começar
      const b = await corpo(req, 45e6);
      if (muvuca.rodando) return json(res, 409, { erro: 'há um pedido em andamento' });
      const projeto = path.resolve(String(b.projeto || ''));
      const st = await fs.stat(projeto).catch(() => null);
      if (!b.projeto || !st?.isDirectory()) return json(res, 400, { erro: `pasta de projeto não encontrada: ${b.projeto || '(vazia)'}` });
      if (muvuca.foto && muvuca.projeto && projeto !== muvuca.projeto) return json(res, 400, { codigo: 'decisao', erro: `há mudanças esperando sua decisão em ${muvuca.projeto}: decida antes de anexar em outra pasta` });
      const lista = Array.isArray(b.arquivos) ? b.arquivos : [];
      if (!lista.length) return json(res, 400, { erro: 'nenhum arquivo' });
      if (lista.length > LIMITES_ANEXO.quantidade) return json(res, 400, { erro: `no máximo ${LIMITES_ANEXO.quantidade} arquivos por pedido` });
      const prontos = []; let total = 0;
      for (const a of lista) {
        const rel = caminhoAnexo(a?.caminho);
        const dados = Buffer.from(String(a?.dados || ''), 'base64');
        if (dados.length > LIMITES_ANEXO.porArquivo) return json(res, 400, { erro: `${a.caminho}: maior que ${LIMITES_ANEXO.porArquivo / 1048576} MB` });
        total += dados.length;
        if (total > LIMITES_ANEXO.total) return json(res, 400, { erro: `os anexos passam de ${LIMITES_ANEXO.total / 1048576} MB no total` });
        prontos.push([rel, dentro(projeto, rel), dados]);
      }
      for (const [, abs, dados] of prontos) { await fs.mkdir(path.dirname(abs), { recursive: true }); await fs.writeFile(abs, dados); sessao.anexos.push({ projeto, abs }); }
      return json(res, 200, { ok: true, salvos: prontos.map(([rel]) => rel) });
    }
    if (req.method === 'GET' && url.pathname === '/api/rotinas') return json(res, 200, { rotinas, padrao: prefs.projetoPadrao });
    if (req.method === 'POST' && url.pathname === '/api/rotinas') {
      const b = await corpo(req);
      rotinas = normalizarRotinas(b.rotinas, rotinas);
      await salvarRotinas();
      return json(res, 200, { ok: true, rotinas });
    }
    if (req.method === 'POST' && url.pathname === '/api/rotinas/verificar') {
      // roda o comando do vigia agora e mostra o resultado, sem mandar pedido nenhum ao time
      const b = await corpo(req);
      const r = rotinas.find((x) => x.id === b.id && x.tipo === 'vigia');
      if (!r) return json(res, 404, { erro: 'vigia não encontrado' });
      const v = await verificarVigia(r);
      if (!v) return json(res, 409, { erro: 'este vigia já está verificando' });
      return json(res, 200, { ok: r.vigia.ok, resumo: r.vigia.resumo, dispararia: v.disparar, rotinas });
    }
    if (req.method === 'POST' && url.pathname === '/api/rotinas/rodar') {
      const b = await corpo(req);
      const r = rotinas.find((x) => x.id === b.id);
      if (!r) return json(res, 404, { erro: 'rotina não encontrada' });
      if (muvuca.rodando) return json(res, 409, { erro: 'há um pedido em andamento' });
      // vigia rodado à mão: verifica agora e manda o pedido com o que o comando mostrou, sem esperar a condição
      if (r.tipo === 'vigia') { const v = await verificarVigia(r); r.vigia.pendente = ''; dispararRotina(r, true, pedidoDoVigia(r, v?.saida ?? '')).catch(() => {}); return json(res, 202, { ok: true }); }
      dispararRotina(r, true).catch(() => {});
      return json(res, 202, { ok: true });
    }
    if (req.method === 'GET' && url.pathname === '/api/memoria') {
      const projeto = url.searchParams.get('projeto') || prefs.projetoPadrao;
      const notas = {};
      for (const a of muvuca.cfg.agentes) notas[a.id] = await memoria.ler(chaveMemoria(path.resolve(projeto), cfg.provedores[a.provedor]?.tipo === 'demo'), a.id);
      // lições do time: ficam na mesma memória, sob o nome reservado "time", na pasta de quem lidera
      const lider = muvuca.agente(muvuca.idLider);
      const licoes = await memoria.ler(chaveMemoria(path.resolve(projeto), cfg.provedores[lider?.provedor]?.tipo === 'demo'), 'time');
      return json(res, 200, { projeto: path.resolve(projeto), notas, licoes });
    }
    if (req.method === 'POST' && url.pathname === '/api/memoria') {
      const b = await corpo(req);
      // "time" são as lições do time: a pasta é a de quem lidera (é de lá que o orquestrador as lê)
      const dono = muvuca.agente(b.agente === 'time' ? muvuca.idLider : String(b.agente || ''));
      return json(res, 200, { ok: true, notas: await memoria.gravar(chaveMemoria(path.resolve(b.projeto || prefs.projetoPadrao), cfg.provedores[dono?.provedor]?.tipo === 'demo'), b.agente, b.notas) });
    }
    if (req.method === 'GET' && url.pathname === '/api/eventos') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      const manda = (ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`);
      // "ola" diz qual é esta subida do servidor: a tela usa para não repetir a conversa ao reconectar
      res.write(`data: ${JSON.stringify({ tipo: 'ola', boot: BOOT, pendente: !!muvuca.foto })}

`);
      muvuca.eventos.forEach(manda);
      muvuca.ouvintes.add(manda);
      const vivo = setInterval(() => res.write(': vivo\n\n'), 20000);
      req.on('close', () => { clearInterval(vivo); muvuca.ouvintes.delete(manda); });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/pedido') {
      const b = await corpo(req);
      if (!b.texto?.trim()) return json(res, 400, { erro: 'pedido vazio' });
      if (muvuca.rodando) return json(res, 409, { erro: 'há um pedido em andamento' });
      // quem valida é o pedido(): se ele recusar antes de começar, o erro volta na resposta (a tela mantém o texto digitado)
      // duas conversas na mesma pasta se atropelariam: o diff e o "Descartar" de uma mexeriam no trabalho da outra
      const ocupada = b.projeto && pastaEmUso(String(b.projeto), sessao.id);
      if (ocupada) return json(res, 409, { codigo: 'pasta', erro: `essa pasta está em uso na conversa ${ocupada.id}${ocupada.muvuca.rodando ? ' (trabalhando)' : ' (mudanças esperando decisão)'}: use outra pasta ou resolva lá primeiro` });
      const andamento = muvuca.pedido({ ...b, comandoTeste: prefs.comandoTeste || undefined });
      let recusa = null, acabou = false;
      andamento.then(() => { acabou = true; }, (e) => { recusa = e; });
      for (let i = 0; i < 100 && !muvuca.rodando && !recusa && !acabou; i++) await new Promise((ok) => setTimeout(ok, 10));
      if (recusa) return json(res, 400, { erro: recusa.message, ...(recusa.codigo && { codigo: recusa.codigo }) });
      return json(res, 202, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/aprovar') { const b = await corpo(req); return json(res, 200, { ok: muvuca.aprovar(b.id, b.ok) }); }
    if (req.method === 'POST' && url.pathname === '/api/parar') { muvuca.parar(); return json(res, 200, { ok: true }); }
    if (req.method === 'POST' && url.pathname === '/api/decidir') {
      const b = await corpo(req); const pasta = muvuca.projeto;
      await muvuca.decidir(b.acao, b.motivo);
      // descartou: os anexos mandados com esses pedidos saem também (e as pastas que ficarem vazias, até a "anexos/")
      if (b.acao === 'descartar') for (const { projeto, abs } of sessao.anexos) {
        await fs.rm(abs, { force: true }).catch(() => {});
        for (let d = path.dirname(abs); d !== projeto && d.startsWith(projeto + path.sep); d = path.dirname(d)) { try { await fs.rmdir(d); } catch { break; } }
      }
      sessao.anexos = [];
      // registro em disco: a conversa some ao reiniciar, e sem isto não dá para saber depois o que foi decidido
      await fs.appendFile(path.join(DADOS, 'decisoes.log'), `${new Date().toISOString()}	${b.acao}	${pasta}
`).catch(() => {});
      return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/nova') { muvuca.nova(); return json(res, 200, { ok: true }); }
    json(res, 404, { erro: 'não encontrado' });
  } catch (e) { json(res, 400, { erro: e.message, ...(e.codigo && { codigo: e.codigo }) }); }
});

// "pronto" entrega a porta em uso: o comando "muvuca" e o aplicativo de mesa esperam por ela para abrir a tela.
export const pronto = new Promise((resolve, reject) => {
  servidor.once('error', (e) => { console.error(e.code === 'EADDRINUSE' ? `A porta ${PORTA} já está em uso. A Muvuca já está aberta? Para usar outra: MUVUCA_PORTA=4318` : e.message); reject(e); });
  servidor.listen(PORTA, '127.0.0.1', () => {
    const porta = servidor.address().port;
    // "aberta.json" diz às outras formas de abrir (comando, aplicativo) que esta pasta de dados já tem uma Muvuca cuidando dela
    // Se outra Muvuca viva já deixou o aviso, ele fica: esta é a segunda na mesma pasta e não toma o lugar da primeira.
    let outraViva = false;
    try { const a = JSON.parse(readFileSyncSeguro(ARQ_ABERTA)); if (a?.pid && a.pid !== process.pid) { try { process.kill(a.pid, 0); outraViva = true; } catch (e) { outraViva = e.code === 'EPERM'; } } } catch { /* aviso ilegível: vale como ausente */ }
    if (!outraViva) try { writeFileSync(ARQ_ABERTA, JSON.stringify({ pid: process.pid, porta })); } catch { /* sem o aviso, só não há reaproveitamento */ }
    console.log(`Muvuca em http://localhost:${porta}/?t=${TOKEN}  (dados em ${DADOS})`);
    resolve(porta);
  });
});
pronto.catch(() => { if (!process.versions.electron) process.exit(1); });

// Ao sair: encerra o que a Muvuca subiu (o aplicativo do provedor, os testes) e tira o aviso de que está aberta.
process.on('exit', () => {
  encerrarProcessos();
  try { if (JSON.parse(String(readAberta() || '{}')).pid === process.pid) rmSync(ARQ_ABERTA, { force: true }); } catch { /* nada a limpar */ }
});
for (const sinal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sinal, () => process.exit(0));
