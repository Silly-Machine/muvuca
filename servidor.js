// Servidor local da Muvuca. Sem dependências: node servidor.js
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Muvuca, nivelPadrao, chaveMemoria } from './orquestrador.js';
import { validarTime, fatiar, ARQUITETURAS, FORMAS } from './times.js';
import { salvarFoto, carregarFoto, diferencas, rodar, dentro } from './ferramentas.js';
import os from 'node:os';
import { chamar } from './provedores.js';
import { responderOffline, sistemaBuzina, SUGESTOES } from './buzina.js';
import { criarMemoria } from './memoria.js';
import { normalizarRotinas, devidas } from './rotinas.js';
import { caminhoAnexo, LIMITES_ANEXO } from './ajustes.js';
import { lerJson, gravarJson, normalizarPreferencias, normalizarProjetos, infoProjeto, pastaPadrao } from './ajustes.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PORTA = Number(process.env.MUVUCA_PORTA ?? process.env.PORTA ?? 4317);   // 0 = qualquer porta livre
// Pasta de dados de quem usa (preferências, projetos, rotinas, memória, times salvos). Fica fora da pasta do app,
// que num aplicativo instalado não pode ser escrita.
const DADOS = path.resolve(process.env.MUVUCA_DADOS || path.join(os.homedir(), '.muvuca'));
const ARQUIVOS_DE_DADOS = ['preferencias.json', 'projetos.json', 'rotinas.json', 'decisoes.log', 'agentes.local.json', 'memoria', 'times', '.pendente'];
if (!await fs.stat(DADOS).catch(() => null)) {
  await fs.mkdir(DADOS, { recursive: true });
  // Quem já usava a Muvuca com os dados dentro da pasta do app leva tudo junto, uma vez só. Os originais ficam onde estão.
  for (const n of ARQUIVOS_DE_DADOS) await fs.cp(path.join(AQUI, n), path.join(DADOS, n), { recursive: true, errorOnExist: false }).catch(() => {});
}
const arquivoCfg = path.resolve(AQUI, process.env.MUVUCA_CONFIG || process.env.ESTUDIO_CONFIG || 'agentes.json');
const cfg = JSON.parse(await fs.readFile(arquivoCfg, 'utf8'));
// Provedores dos outros arquivos de agentes entram na lista também: dá para trocar de provedor pela tela,
// sem subir o servidor de novo com outro arquivo. Os do arquivo em uso têm prioridade; depois, os seus (agentes.local.json na pasta de dados).
for (const extra of [path.join(DADOS, 'agentes.local.json'), path.join(AQUI, 'agentes.json')]) {
  const outros = (await lerJsonSimples(extra))?.provedores || {};
  for (const [nome, p] of Object.entries(outros)) if (!cfg.provedores[nome]) cfg.provedores[nome] = p;
}
async function lerJsonSimples(arq) { try { return JSON.parse(await fs.readFile(arq, 'utf8')); } catch { return null; } }
const muvuca = new Muvuca(cfg);
const BOOT = Date.now().toString(36);
const VERSAO = JSON.parse(await fs.readFile(path.join(AQUI, 'package.json'), 'utf8')).version;
// Ponto de restauração em disco: se o servidor cair com mudanças esperando decisão, elas voltam a aparecer ao subir.
const PASTA_PENDENTE = path.join(DADOS, '.pendente');
muvuca.aoMudarFoto = (foto, projeto) => salvarFoto(PASTA_PENDENTE, projeto, foto);
{
  const guardado = await carregarFoto(PASTA_PENDENTE);
  const pasta = guardado && await fs.stat(guardado.projeto).catch(() => null);
  if (pasta?.isDirectory()) {
    const arquivos = await diferencas(guardado.projeto, guardado.foto);
    if (arquivos.length) {
      muvuca.foto = guardado.foto; muvuca.projeto = guardado.projeto;
      muvuca.emitir({ tipo: 'aviso', texto: `O servidor foi reiniciado com mudanças esperando decisão em ${guardado.projeto}. Elas continuam aqui: escolha manter ou descartar.` });
      muvuca.emitir({ tipo: 'diff', arquivos, autores: {} });
    } else await salvarFoto(PASTA_PENDENTE, null, null);
  } else if (guardado) await salvarFoto(PASTA_PENDENTE, null, null);
}
// Time que veio no arquivo de configuração: fica na galeria para voltar a ele.
const timeDoArquivo = { nome: `Time do arquivo (${path.basename(arquivoCfg)})`, descricao: 'O time com que o servidor subiu.', arquitetura: cfg.arquitetura || 'centralizada', agentes: cfg.agentes };
// Agente de modelo pronto que não diz o provedor usa o do líder do arquivo.
let provedorPadrao = (cfg.agentes.find((a) => a.funcao === 'lider') || cfg.agentes[0]).provedor;
// Um provedor está pronto para uso? CLI precisa do comando instalado; API precisa da chave e de endereço/modelo preenchidos.
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
  const usadas = [...new Set([...(p.args || []), ...(p.argsLeitura || []), p.argModelo].filter((a) => /^--[a-z]/.test(String(a))))];
  return usadas.filter((o) => !new RegExp(`(^|[\\s,])${o}([\\s,=<\\[]|$)`, 'm').test(ajuda));
}
async function versaoDe(comando) {
  const r = await rodar(String(comando), { args: ['--version'], limiteMs: 15000 });
  return r.codigo === 0 ? r.saida.trim().split('\n')[0].slice(0, 60) : '';
}
const PASTA_PRONTOS = path.join(AQUI, 'arquiteturas');
const PASTA_SALVOS = path.join(DADOS, 'times');
// Configurações (aba da engrenagem) e projetos (aba da pasta): JSON simples na pasta de dados.
const ARQ_PREFS = path.join(DADOS, 'preferencias.json');
const ARQ_PROJETOS = path.join(DADOS, 'projetos.json');
// Pasta de projeto de fábrica: a irmã "teste-estudio" quando existe (quem roda do código-fonte); senão, uma pasta na casa do usuário.
const PROJETO_FABRICA = await fs.stat(pastaPadrao(AQUI)).then((s) => s.isDirectory()).catch(() => false) ? pastaPadrao(AQUI) : path.join(os.homedir(), 'Muvuca', 'primeiro-projeto');
const opcoesPrefs = { raiz: AQUI, cfg, padrao: PROJETO_FABRICA };
const prefsGravadas = await lerJson(ARQ_PREFS, null);
let prefs = normalizarPreferencias(prefsGravadas ?? {}, opcoesPrefs);
// Quem já tinha preferências gravadas antes de existir a tela de boas-vindas não precisa passar por ela.
if (prefsGravadas && prefsGravadas.inicioFeito === undefined) prefs.inicioFeito = true;
const aplicarPrefs = () => { muvuca.maxCiclos = prefs.maxCiclos; muvuca.maxPassos = prefs.maxPassos; };
aplicarPrefs();
// Memória por agente (notas por projeto) e rotinas (pedidos agendados).
const memoria = criarMemoria(path.join(DADOS, 'memoria'));
muvuca.memoria = memoria;
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
async function dispararRotina(r, manual = false) {
  r.ultima = new Date().toISOString(); r.resultado = 'rodando'; await salvarRotinas();
  muvuca.emitir({ tipo: 'rotina', nome: r.nome, manual });
  try {
    await muvuca.pedido({ texto: r.texto, projeto: r.projeto || prefs.projetoPadrao, comandoTeste: prefs.comandoTeste || undefined });
    const fim = [...muvuca.eventos].reverse().find((e) => ['final', 'parado', 'erro'].includes(e.tipo));
    r.resultado = !fim ? 'sem resultado' : fim.tipo === 'parado' ? 'interrompida por você' : fim.tipo === 'erro' ? `erro: ${fim.texto}`
      : fim.aprovado ? 'aprovada' : fim.aprovado === false ? `não aprovada: ${fim.motivo}` : 'concluída (só conversa)';
  } catch (e) { r.resultado = `recusada: ${e.message}`; muvuca.emitir({ tipo: 'erro', texto: `Rotina "${r.nome}": ${e.message}` }); }
  await salvarRotinas().catch(() => {});
}
// Relógio: a cada 20 s vê se alguma rotina está na hora. Com o time ocupado, tenta de novo no próximo tique (dentro da janela).
setInterval(() => {
  if (muvuca.rodando) return;
  const r = devidas(rotinas)[0];
  if (r) dispararRotina(r).catch(() => {});
}, 20000).unref();

if (prefs.provedorTime && cfg.provedores[prefs.provedorTime] && (await situacaoProvedor(prefs.provedorTime, cfg.provedores[prefs.provedorTime])).pronto) {
  muvuca.usarProvedor(prefs.provedorTime, prefs.modelos[prefs.provedorTime]);
  provedorPadrao = prefs.provedorTime;
  muvuca.eventos = muvuca.eventos.filter((e) => e.tipo !== 'provedor');   // é o estado inicial, não um acontecimento da conversa
}
// escolhas de modelo por agente feitas na tela, para quem ainda está no time
for (const [id, v] of Object.entries(prefs.niveis)) if (muvuca.agente(id)) muvuca.definirNivel(id, v);
muvuca.eventos = muvuca.eventos.filter((e) => e.tipo !== 'nivel_agente');
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

const json = (res, codigo, obj) => { res.writeHead(codigo, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
const corpo = async (req, max = 1e6) => { let t = ''; for await (const p of req) { t += p; if (t.length > max) throw new Error('corpo grande demais'); } return t ? JSON.parse(t) : {}; };

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    // Só aceita chamadas da própria página: bloqueia sites abertos no navegador tentando comandar o servidor local.
    if (req.method === 'POST') {
      const origem = req.headers.origin;
      if (origem && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origem)) return json(res, 403, { erro: 'origem não permitida' });
      if (!/application\/json/.test(req.headers['content-type'] || '')) return json(res, 415, { erro: 'envie JSON' });
    }
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
      return res.end(await fs.readFile(path.join(AQUI, 'public', 'index.html')));
    }
    // imagens dos personagens: só nomes do tipo forma-estado.webp, sem caminho
    const boneco = req.method === 'GET' && /^\/bonecos\/([a-z]+-[a-z]+\.webp)$/.exec(url.pathname);
    if (boneco) {
      const arq = path.join(AQUI, 'public', 'bonecos', boneco[1]);
      const st = await fs.stat(arq).catch(() => null);
      if (!st) { res.writeHead(404); return res.end(); }
      const etag = `"${st.size}-${Math.round(st.mtimeMs)}"`;
      if (req.headers['if-none-match'] === etag) { res.writeHead(304, { etag, 'cache-control': 'no-cache' }); return res.end(); }
      res.writeHead(200, { 'content-type': 'image/webp', 'cache-control': 'no-cache', etag });
      return res.end(await fs.readFile(arq));
    }
    if (req.method === 'GET' && url.pathname === '/api/config') {
      const atual = muvuca.cfg;   // o construtor pode ter trocado o time
      return json(res, 200, {
        versao: VERSAO, buzina: prefs.buzina, rodando: muvuca.rodando, config: path.basename(arquivoCfg), projetoPadrao: process.env.MUVUCA_PROJETO || process.env.ESTUDIO_PROJETO || prefs.projetoPadrao,
        nomeTime: atual.nomeTime || timeDoArquivo.nome, arquitetura: muvuca.arquitetura, arquiteturas: ARQUITETURAS,
        // provedores sem chave nem argumentos: a tela só precisa do nome e dos modelos
        provedores: Object.entries(cfg.provedores).map(([nome, p]) => ({ nome, tipo: p.tipo, modelo: p.modelo || '', modelos: p.modelos || null })),
        agentes: atual.agentes.map((a) => ({ id: a.id, nome: a.nome, papel: a.papel, funcao: a.funcao || '', chefe: muvuca.chefeDe(a), conexoes: Array.isArray(a.conexoes) ? a.conexoes : null, complexidade: a.complexidade || '', nivelPadrao: nivelPadrao(a) || '', sistema: a.sistema || '', cor: a.cor, forma: a.forma, provedor: a.provedor, ferramentas: a.ferramentas || [], tipo: cfg.provedores[a.provedor]?.tipo || '?', modeloFixo: a.modelo || '', modelo: a.modelo || cfg.provedores[a.provedor]?.modelo || '', modelos: a.modelos || (a.modelo ? null : cfg.provedores[a.provedor]?.modelos) || null })),
      });
    }
    if (req.method === 'GET' && url.pathname === '/api/times') {
      // biblioteca de agentes básicos do construtor (só formas que a tela sabe desenhar)
      const catalogo = JSON.parse(await fs.readFile(path.join(AQUI, 'catalogo-agentes.json'), 'utf8').catch(() => '{"agentes":[]}')).agentes.filter((a) => FORMAS.includes(a.forma));
      return json(res, 200, { catalogo, times: [{ origem: 'arquivo', ...timeDoArquivo }, ...await lerTimes(PASTA_PRONTOS, 'pronto'), ...await lerTimes(PASTA_SALVOS, 'salvo')] });
    }
    if (req.method === 'POST' && url.pathname === '/api/time') {
      const b = await corpo(req);
      const t = validarTime(b.time, cfg.provedores, provedorPadrao);
      muvuca.trocarTime(t);
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
      return json(res, 200, { preferencias: prefs, pastaPadrao: PROJETO_FABRICA, pastaDados: DADOS, config: path.basename(arquivoCfg), deAmbiente: process.env.MUVUCA_PROJETO || process.env.ESTUDIO_PROJETO || '' });
    }
    if (req.method === 'POST' && url.pathname === '/api/preferencias') {
      const b = await corpo(req);
      if (muvuca.rodando) return json(res, 409, { erro: 'há um pedido em andamento' });
      prefs = normalizarPreferencias({ ...prefs, ...b.preferencias }, opcoesPrefs);
      await gravarJson(ARQ_PREFS, prefs);
      aplicarPrefs();
      return json(res, 200, { ok: true, preferencias: prefs });
    }
    if (req.method === 'GET' && url.pathname === '/api/inicio') {
      // Tela de boas-vindas: o que já está pronto nesta máquina
      const cli = Object.entries(cfg.provedores).find(([, p]) => p.tipo === 'cli' && p.comando === 'claude');
      const s = cli ? await situacaoProvedor(cli[0], cli[1]) : { pronto: false, motivo: 'nenhum provedor usa o aplicativo "claude"' };
      const instalado = !!cli && comandoExiste.get('claude') === true;
      // logado? Só o sim ou não sai daqui: a resposta do aplicativo traz e-mail e organização, que não interessam à tela.
      let logado = null;
      if (instalado) { const r = await rodar('claude', { args: ['auth', 'status'], limiteMs: 15000 }); try { logado = JSON.parse(r.saida).loggedIn === true; } catch { logado = r.codigo === 0 ? null : false; } }
      return json(res, 200, {
        feito: prefs.inicioFeito, pasta: prefs.projetoPadrao, pastaExiste: !!(await infoProjeto(prefs.projetoPadrao)).existe, pastaDados: DADOS,
        provedorAtual: provedorPadrao,
        claude: { provedor: cli?.[0] || '', instalado, logado, pronto: s.pronto && logado !== false, motivo: logado === false ? 'o aplicativo "claude" está instalado, mas sem login: rode "claude" num terminal e entre na sua conta' : s.motivo, versao: instalado ? await versaoDe('claude') : '' },
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
          const readme = await fs.readFile(path.join(AQUI, 'docs', 'guia.md'), 'utf8').catch(() => fs.readFile(path.join(AQUI, 'README.md'), 'utf8')).catch(() => '');
          const r = await chamar(prov, { sistema: sistemaBuzina(readme), mensagens: [...historico, { role: 'user', content: pergunta }], ferramentas: [], sinal: AbortSignal.timeout(90000), cwd: pasta, agente: { id: 'buzina', nome: 'Buzina', ferramentas: [] } });
          const texto = String(r.texto || '').trim();
          if (texto) return json(res, 200, { texto: texto.slice(0, 4000), fonte: prov.modelo || prov.nome });
        } catch (e) {
          const off = responderOffline(pergunta);
          return json(res, 200, { texto: off.texto, fonte: 'guia embutido', aviso: `O modelo não respondeu (${String(e.message).slice(0, 120)}). Usei o guia embutido.` });
        }
      }
      return json(res, 200, { texto: responderOffline(pergunta).texto, fonte: 'guia embutido' });
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
      for (const [, abs, dados] of prontos) { await fs.mkdir(path.dirname(abs), { recursive: true }); await fs.writeFile(abs, dados); }
      return json(res, 200, { ok: true, salvos: prontos.map(([rel]) => rel) });
    }
    if (req.method === 'GET' && url.pathname === '/api/rotinas') return json(res, 200, { rotinas, padrao: prefs.projetoPadrao });
    if (req.method === 'POST' && url.pathname === '/api/rotinas') {
      const b = await corpo(req);
      rotinas = normalizarRotinas(b.rotinas, rotinas);
      await salvarRotinas();
      return json(res, 200, { ok: true, rotinas });
    }
    if (req.method === 'POST' && url.pathname === '/api/rotinas/rodar') {
      const b = await corpo(req);
      const r = rotinas.find((x) => x.id === b.id);
      if (!r) return json(res, 404, { erro: 'rotina não encontrada' });
      if (muvuca.rodando) return json(res, 409, { erro: 'há um pedido em andamento' });
      dispararRotina(r, true).catch(() => {});
      return json(res, 202, { ok: true });
    }
    if (req.method === 'GET' && url.pathname === '/api/memoria') {
      const projeto = url.searchParams.get('projeto') || prefs.projetoPadrao;
      const notas = {};
      for (const a of muvuca.cfg.agentes) notas[a.id] = await memoria.ler(chaveMemoria(path.resolve(projeto), cfg.provedores[a.provedor]?.tipo === 'demo'), a.id);
      return json(res, 200, { projeto: path.resolve(projeto), notas });
    }
    if (req.method === 'POST' && url.pathname === '/api/memoria') {
      const b = await corpo(req);
      const dono = muvuca.agente(String(b.agente || ''));
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
      await muvuca.decidir(b.acao);
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
  servidor.listen(PORTA, '127.0.0.1', () => { const porta = servidor.address().port; console.log(`Muvuca em http://localhost:${porta}  (dados em ${DADOS})`); resolve(porta); });
});
pronto.catch(() => { if (!process.versions.electron) process.exit(1); });
