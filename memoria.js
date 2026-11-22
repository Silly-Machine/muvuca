// Memória por agente: notas curtas que cada agente relê nos próximos pedidos do mesmo projeto.
// Ficam na pasta do app (memoria/<projeto>/<agente>.json), não dentro do projeto: assim não entram no diff.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const MAX_NOTAS = 20;
export const MAX_NOTA = 240;
const limpa = (n) => String(n ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOTA);
const chave = (n) => n.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function criarMemoria(base) {
  const arquivo = (projeto, agente) => {
    if (!/^[a-z][a-z0-9-]*$/.test(String(agente))) throw new Error(`id de agente inválido: ${agente}`);
    if (!projeto) throw new Error('memória sem projeto');
    const pasta = crypto.createHash('sha1').update(path.resolve(String(projeto)).toLowerCase()).digest('hex').slice(0, 12);
    return path.join(base, pasta, `${agente}.json`);
  };
  const ler = async (projeto, agente) => {
    try { const l = JSON.parse(await fs.readFile(arquivo(projeto, agente), 'utf8')); return Array.isArray(l) ? l.map(limpa).filter(Boolean) : []; }
    catch { return []; }
  };
  // Substitui a lista inteira (a tela usa para apagar notas). Lista vazia apaga o arquivo.
  const gravar = async (projeto, agente, notas) => {
    const arq = arquivo(projeto, agente);
    const vistas = new Set();
    const lista = (Array.isArray(notas) ? notas : []).map(limpa).filter((n) => n && !vistas.has(chave(n)) && vistas.add(chave(n))).slice(-MAX_NOTAS);
    if (!lista.length) { await fs.rm(arq, { force: true }); return lista; }
    await fs.mkdir(path.dirname(arq), { recursive: true });
    await fs.writeFile(arq, JSON.stringify(lista, null, 2) + '\n');
    return lista;
  };
  // Acrescenta uma nota. Devolve false se ela já existia (ou veio vazia): nada muda.
  const anotar = async (projeto, agente, nota) => {
    const n = limpa(nota); if (!n) return false;
    const atuais = await ler(projeto, agente);
    if (atuais.some((x) => chave(x) === chave(n))) return false;
    await gravar(projeto, agente, [...atuais, n]);
    return true;
  };
  return { ler, gravar, anotar };
}
