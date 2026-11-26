#!/usr/bin/env node
// Comando "muvuca": sobe o servidor local e abre a tela no navegador.
//   muvuca [--porta 4317] [--dados PASTA] [--sem-abrir]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [maior] = process.versions.node.split('.').map(Number);
if (maior < 22) {
  console.error(`A Muvuca precisa do Node 22 ou mais novo, e este computador tem o ${process.versions.node}.
Instale a versão LTS em https://nodejs.org e rode de novo. Se preferir não mexer no Node, use o aplicativo de mesa:
https://github.com/Silly-Machine/muvuca/releases/latest`);
  process.exit(1);
}
const args = process.argv.slice(2);
const tem = (...nomes) => nomes.some((n) => args.includes(n));
const valor = (nome) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : undefined; };

if (tem('--versao', '--version', '-v')) {
  // a segunda linha diz qual cópia respondeu: com duas instalações, a do PATH pode não ser a esperada
  console.log(JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).version + `\ninstalada em ${RAIZ}`);
  process.exit(0);
}
if (tem('--ajuda', '--help', '-h')) {
  console.log(`Muvuca: painel local para trabalhar com um time de agentes de IA.

Uso: muvuca [opções]

  --porta N      porta do servidor (padrão 4317; 0 escolhe uma livre)
  --dados PASTA  onde ficam preferências, projetos, rotinas e memória (padrão: ~/.muvuca)
  --sem-abrir    não abre o navegador
  --encerrar     encerra a Muvuca aberta com esta pasta de dados (--forcar: mesmo no meio de um pedido)
  --versao       mostra a versão e onde está instalada
  --ajuda        mostra esta ajuda`);
  process.exit(0);
}

const porta = valor('--porta');
if (porta !== undefined) {
  if (!/^\d{1,5}$/.test(porta) || Number(porta) > 65535) { console.error(`Porta inválida: ${porta}`); process.exit(2); }
  process.env.MUVUCA_PORTA = porta;
}
const dados = valor('--dados');
if (dados) process.env.MUVUCA_DADOS = path.resolve(dados);

// Abre o endereço no navegador padrão. Se não der, o endereço já está impresso no terminal.
function abrir(url) {
  const [comando, argumentos] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try { spawn(comando, argumentos, { stdio: 'ignore', detached: true, windowsHide: true }).on('error', () => {}).unref(); } catch { /* sem navegador */ }
}

// Se já há uma Muvuca aberta com esta pasta de dados (o aplicativo de mesa, por exemplo), usa essa em vez de subir outra.
const { muvucaAberta, versaoDiferente, encerrarAberta } = await import(pathToFileURL(path.join(RAIZ, 'src', 'aberta.js')).href);
let jaAberta = await muvucaAberta();
const minhaVersao = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).version;
if (tem('--encerrar')) {
  if (!jaAberta) { console.log('Nenhuma Muvuca aberta com esta pasta de dados.'); process.exit(0); }
  try { await encerrarAberta(jaAberta, { forcar: tem('--forcar') }); console.log(`Muvuca ${jaAberta.versao} (processo ${jaAberta.pid}) encerrada.`); process.exit(0); }
  catch (e) { console.error(`Não deu para encerrar: ${e.message}`); process.exit(1); }
}
let outra = versaoDiferente(jaAberta, minhaVersao);
// No terminal, oferece trocar na hora: encerra a outra versão e segue abrindo esta.
if (outra && process.stdin.isTTY && process.stdout.isTTY) {
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const r = (await rl.question(`${outra}\nEncerrar a ${jaAberta.versao} e abrir a ${minhaVersao}? [s/N] `)).trim().toLowerCase(); rl.close();
  if (r === 's' || r === 'sim') {
    try { await encerrarAberta(jaAberta); outra = ''; jaAberta = null; }
    catch (e) { console.error(`Não deu para encerrar: ${e.message}`); process.exit(1); }
  }
}
if (outra) {
  console.error(outra + `
A aberta continua em http://localhost:${jaAberta.porta}/?t=${jaAberta.token}`);
  process.exit(1);
}
if (jaAberta) {
  const link = `http://localhost:${jaAberta.porta}/?t=${jaAberta.token}`;
  console.log(`A Muvuca já está aberta: ${link}`);
  if (!tem('--sem-abrir')) abrir(link);
  process.exit(0);
}
const { pronto, acesso } = await import(pathToFileURL(path.join(RAIZ, 'src', 'servidor.js')).href);
const emUso = await pronto;
// o link leva a chave de acesso uma vez; o navegador guarda um cookie e segue sem ela
if (!tem('--sem-abrir')) abrir(`http://localhost:${emUso}/?t=${acesso}`);
console.log('Ctrl+C encerra. De outro terminal: muvuca --encerrar');
