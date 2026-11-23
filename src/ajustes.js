// Preferências da Muvuca e lista de projetos: dois JSON pequenos na pasta do app, editados pelas abas
// "Configurações" e "Projetos". Nada aqui guarda chave de API: provedores continuam no arquivo de agentes.
import fs from 'node:fs/promises';
import path from 'node:path';

const texto = (v, max) => String(v ?? '').trim().slice(0, max);
const inteiro = (v, min, max, padrao) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao; };

export async function lerJson(arquivo, padrao) {
  try { return JSON.parse(await fs.readFile(arquivo, 'utf8')); } catch { return padrao; }
}
// Grava num arquivo ao lado e troca de uma vez: se a Muvuca cair no meio, o arquivo antigo continua inteiro
// (antes, uma queda no meio da gravação deixava o JSON pela metade, e as preferências voltavam ao padrão).
let gravacoes = 0;
export async function gravarJson(arquivo, dados) {
  // nome próprio por gravação: duas gravações do mesmo arquivo ao mesmo tempo não disputam o provisório
  const provisorio = `${arquivo}.${process.pid}.${++gravacoes}.tmp`;
  await fs.writeFile(provisorio, JSON.stringify(dados, null, 2) + '\n');
  for (let tentativa = 0; ; tentativa++) {
    try { return await fs.rename(provisorio, arquivo); }
    catch (e) {
      // no Windows a troca falha se o arquivo está aberto por outra gravação naquele instante: espera um pouco e tenta de novo
      if (tentativa < 8 && ['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) { await new Promise((r) => setTimeout(r, 15 * (tentativa + 1))); continue; }
      await fs.rm(provisorio, { force: true }); throw e;
    }
  }
}

// Pasta padrão de quem roda do código-fonte: a irmã "teste-estudio". O servidor troca por uma pasta na casa do usuário quando ela não existe.
export const pastaPadrao = (raiz) => path.resolve(raiz, '..', 'teste-estudio');

export function normalizarPreferencias(p, { raiz, cfg = {}, padrao } = {}) {
  p = p && typeof p === 'object' ? p : {};
  const projeto = texto(p.projetoPadrao, 400);
  // modelos escolhidos na tela, por provedor: { "claude-cli": { baixa, media, alta } }
  const modelos = {};
  for (const [prov, m] of Object.entries(p.modelos && typeof p.modelos === 'object' ? p.modelos : {}).slice(0, 20)) {
    const limpo = {};
    for (const n of ['baixa', 'media', 'alta']) if (texto(m?.[n], 80)) limpo[n] = texto(m[n], 80);
    if (Object.keys(limpo).length) modelos[texto(prov, 60)] = limpo;
  }
  // escolha de modelo por agente: { chevron: 'alta', scout: 'auto' }
  const niveis = {};
  for (const [id, v] of Object.entries(p.niveis && typeof p.niveis === 'object' ? p.niveis : {}).slice(0, 60)) {
    if (/^[a-z][a-z0-9-]*$/.test(id) && ['auto', 'baixa', 'media', 'alta'].includes(v)) niveis[id] = v;
  }
  return {
    projetoPadrao: projeto ? path.resolve(projeto) : (padrao || pastaPadrao(raiz)),
    comandoTeste: texto(p.comandoTeste, 200),
    maxCiclos: inteiro(p.maxCiclos, 0, 10, cfg.maxCiclos ?? 3),
    maxPassos: inteiro(p.maxPassos, 1, 60, cfg.maxPassos ?? 12),
    limiteAgenteMin: inteiro(p.limiteAgenteMin, 1, 180, 10),   // tempo máximo de cada chamada ao aplicativo do provedor
    limiteTestesMin: inteiro(p.limiteTestesMin, 1, 60, 3),      // tempo máximo dos testes do portão
    provedorTime: texto(p.provedorTime, 60),
    modelos,
    niveis,
    inicioFeito: p.inicioFeito === true,
    buzina: p.buzina === true,   // a mascote já foi solta (easter egg); vale para o navegador e para o aplicativo de mesa   // já passou pela tela de boas-vindas
  };
}

export function normalizarProjetos(lista) {
  if (!Array.isArray(lista)) throw new Error('lista de projetos inválida');
  const vistos = new Set();
  const saida = [];
  for (const [i, p] of lista.entries()) {
    const caminho = texto(p?.caminho, 400);
    if (!caminho) throw new Error(`projeto ${i + 1}: falta o caminho da pasta`);
    if (!path.isAbsolute(caminho)) throw new Error(`projeto ${i + 1}: use o caminho completo (ex.: C:\\Users\\voce\\projeto)`);
    const abs = path.resolve(caminho);
    const chave = abs.toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push({ nome: texto(p.nome, 40) || path.basename(abs), caminho: abs });
  }
  if (saida.length > 50) throw new Error('no máximo 50 projetos');
  return saida;
}

// Anexos: arquivos e pastas que o usuário manda junto com o pedido. Vão para "anexos/" dentro do projeto.
export const LIMITES_ANEXO = { porArquivo: 8 * 1024 * 1024, total: 30 * 1024 * 1024, quantidade: 300 };
// Caminho relativo seguro para um anexo: sem subir de pasta, sem caractere proibido, no máximo 8 níveis.
export function caminhoAnexo(nome) {
  // ".." é recusado antes da limpeza: assim uma tentativa de sair da pasta não passa despercebida
  if (String(nome || '').split(/[\\/]+/).some((p) => p.trim() === '..')) throw new Error(`caminho de anexo inválido: ${nome}`);
  const partes = String(nome || '').split(/[\\/]+/).map((p) => p.replace(/[<>:"|?*\u0000-\u001f]/g, '').trim().replace(/[. ]+$/, '')).filter((p) => p && p !== '.');
  if (!partes.length) throw new Error('anexo sem nome');
  if (partes.some((p) => p === '..')) throw new Error(`caminho de anexo inválido: ${nome}`);
  if (partes.length > 8) throw new Error(`pasta funda demais: ${nome}`);
  if (partes.some((p) => /^\.env(\.|$)/i.test(p) || p === '.git' || p === 'node_modules')) throw new Error(`este tipo de arquivo não pode ser anexado: ${nome}`);
  return ['anexos', ...partes.map((p) => p.slice(0, 120))].join('/');
}

// Situação da pasta: existe, quantos arquivos (sem node_modules e .git) e quando mudou por último.
export async function infoProjeto(caminho) {
  const st = await fs.stat(caminho).catch(() => null);
  if (!st?.isDirectory()) return { existe: false };
  let arquivos = 0, alterado = st.mtimeMs;
  const fila = [caminho];
  while (fila.length && arquivos < 5000) {
    const dir = fila.pop();
    for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { fila.push(p); continue; }
      arquivos++;
      const s = await fs.stat(p).catch(() => null);
      if (s && s.mtimeMs > alterado) alterado = s.mtimeMs;
    }
  }
  return { existe: true, arquivos, alterado };
}
