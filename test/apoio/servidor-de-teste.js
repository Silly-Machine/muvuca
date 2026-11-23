// Sobe um servidor de verdade numa porta livre, com a pasta de dados que o teste escolher, e devolve
// atalhos para falar com ele já com a chave de acesso.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

export async function subir(dados, extra = {}) {
  const env = { ...process.env, MUVUCA_DADOS: dados, MUVUCA_PORTA: '0', ...extra };
  delete env.NODE_TEST_CONTEXT; delete env.MUVUCA_CONFIG; delete env.ESTUDIO_CONFIG; delete env.MUVUCA_PROJETO; delete env.ESTUDIO_PROJETO; delete env.PORTA;
  const filho = spawn(process.execPath, [path.join(RAIZ, 'src', 'servidor.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let saida = '';
  const porta = await new Promise((resolve, reject) => {
    const tempo = setTimeout(() => reject(new Error('o servidor não subiu: ' + saida)), 30000);
    const ler = (d) => { saida += d; const m = /localhost:(\d+)/.exec(saida); if (m) { clearTimeout(tempo); resolve(Number(m[1])); } };
    filho.stdout.on('data', ler); filho.stderr.on('data', ler);
    filho.on('exit', (c) => { clearTimeout(tempo); reject(new Error(`o servidor saiu (${c}): ${saida}`)); });
  });
  const base = `http://127.0.0.1:${porta}`;
  const token = (await fs.readFile(path.join(dados, 'acesso.token'), 'utf8')).trim();
  const chave = { 'x-muvuca-token': token };
  return {
    porta, base, token, pid: filho.pid, saida: () => saida,
    get: async (u) => (await fetch(base + u, { headers: chave })).json(),
    post: async (u, corpo) => { const r = await fetch(base + u, { method: 'POST', headers: { 'content-type': 'application/json', ...chave }, body: JSON.stringify(corpo) }); return { s: r.status, j: await r.json() }; },
    // sem a chave, para testar o que o servidor responde a quem não tem acesso
    cru: (u, opcoes = {}) => fetch(base + u, { redirect: 'manual', ...opcoes }),
    parar: () => new Promise((r) => { filho.once('exit', r); filho.kill(); }),
  };
}
