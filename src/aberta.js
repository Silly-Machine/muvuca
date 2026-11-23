// Já existe uma Muvuca aberta cuidando desta pasta de dados? Quem pergunta é o comando "muvuca" e o aplicativo
// de mesa, antes de subir um servidor: duas Muvucas na mesma pasta de dados gravariam uma por cima da outra.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const pastaDeDados = () => path.resolve(process.env.MUVUCA_DADOS || path.join(os.homedir(), '.muvuca'));

// Devolve { porta, token, endereco } da Muvuca que já está aberta, ou null. Confere três coisas: o aviso deixado
// por ela, se o processo ainda existe e se o servidor responde com o token desta pasta.
export async function muvucaAberta(dados = pastaDeDados()) {
  try {
    const { pid, porta } = JSON.parse(await fs.readFile(path.join(dados, 'aberta.json'), 'utf8'));
    if (!Number.isInteger(pid) || !Number.isInteger(porta) || pid === process.pid) return null;
    try { process.kill(pid, 0); } catch (e) { if (e.code !== 'EPERM') return null; }   // 0 não mata: só pergunta se existe
    const token = (await fs.readFile(path.join(dados, 'acesso.token'), 'utf8')).trim();
    const r = await fetch(`http://127.0.0.1:${porta}/api/config`, { headers: { 'x-muvuca-token': token }, signal: AbortSignal.timeout(3000) });
    if (!r.ok || typeof (await r.json()).versao !== 'string') return null;
    return { porta, token, endereco: `http://127.0.0.1:${porta}` };
  } catch { return null; }
}
