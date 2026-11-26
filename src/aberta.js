// Já existe uma Muvuca aberta cuidando desta pasta de dados? Quem pergunta é o comando "muvuca" e o aplicativo
// de mesa, antes de subir um servidor: duas Muvucas na mesma pasta de dados gravariam uma por cima da outra.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const pastaDeDados = () => path.resolve(process.env.MUVUCA_DADOS || path.join(os.homedir(), '.muvuca'));

// Devolve { porta, token, endereco, versao } da Muvuca que já está aberta, ou null. Confere três coisas: o aviso deixado
// por ela, se o processo ainda existe e se o servidor responde com o token desta pasta.
export async function muvucaAberta(dados = pastaDeDados()) {
  try {
    const { pid, porta, raiz } = JSON.parse(await fs.readFile(path.join(dados, 'aberta.json'), 'utf8'));
    if (!Number.isInteger(pid) || !Number.isInteger(porta) || pid === process.pid) return null;
    try { process.kill(pid, 0); } catch (e) { if (e.code !== 'EPERM') return null; }   // 0 não mata: só pergunta se existe
    const token = (await fs.readFile(path.join(dados, 'acesso.token'), 'utf8')).trim();
    const r = await fetch(`http://127.0.0.1:${porta}/api/config`, { headers: { 'x-muvuca-token': token }, signal: AbortSignal.timeout(3000) });
    const { versao } = r.ok ? await r.json() : {};
    if (typeof versao !== 'string') return null;
    return { porta, token, endereco: `http://127.0.0.1:${porta}`, versao, pid, ...(typeof raiz === 'string' && raiz ? { raiz } : {}) };
  } catch { return null; }
}

// Quem chega depois só aproveita a Muvuca aberta se for a mesma versão. Com versões diferentes (o aplicativo
// instalado e o comando do repositório, por exemplo), a pessoa veria a tela e o servidor de uma versão achando
// que está na outra: melhor dizer qual está aberta e pedir para fechar.
export function versaoDiferente(aberta, minha) {
  if (!aberta || aberta.versao === minha) return '';
  const quem = [`processo ${aberta.pid}`, aberta.raiz && `instalada em ${aberta.raiz}`].filter(Boolean).join(', ');
  return `Já há uma Muvuca ${aberta.versao} aberta com esta pasta de dados (${quem}), e esta é a ${minha}. Para não misturar as duas versões, feche a outra (o aplicativo de mesa ou o terminal onde ela roda) ou rode "muvuca --encerrar" e abra de novo.`;
}

// Pede à Muvuca aberta que se encerre e espera o processo sair. Com um pedido em andamento, ela recusa (a menos que
// "forcar"), e o erro diz isso com a frase dela.
export async function encerrarAberta(aberta, { forcar = false, esperaMs = 8000 } = {}) {
  const r = await fetch(`${aberta.endereco}/api/encerrar`, { method: 'POST', headers: { 'x-muvuca-token': aberta.token, 'content-type': 'application/json' }, body: JSON.stringify({ forcar }), signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || `a Muvuca aberta respondeu ${r.status}`);
  const ate = Date.now() + esperaMs;
  while (Date.now() < ate) {
    try { process.kill(aberta.pid, 0); } catch (e) { if (e.code !== 'EPERM') return true; }
    await new Promise((ok) => setTimeout(ok, 150));
  }
  throw new Error(`a Muvuca ${aberta.versao} (processo ${aberta.pid}) não saiu a tempo`);
}
