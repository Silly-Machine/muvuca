#!/usr/bin/env node
// Comando "muvuca": sobe o servidor local e abre a tela no navegador.
//   muvuca [--porta 4317] [--dados PASTA] [--sem-abrir]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const tem = (...nomes) => nomes.some((n) => args.includes(n));
const valor = (nome) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : undefined; };

if (tem('--versao', '--version', '-v')) {
  console.log(JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).version);
  process.exit(0);
}
if (tem('--ajuda', '--help', '-h')) {
  console.log(`Muvuca: painel local para trabalhar com um time de agentes de IA.

Uso: muvuca [opções]

  --porta N      porta do servidor (padrão 4317; 0 escolhe uma livre)
  --dados PASTA  onde ficam preferências, projetos, rotinas e memória (padrão: ~/.muvuca)
  --sem-abrir    não abre o navegador
  --versao       mostra a versão
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

const { pronto } = await import(pathToFileURL(path.join(RAIZ, 'servidor.js')).href);
const emUso = await pronto;
if (!tem('--sem-abrir')) abrir(`http://localhost:${emUso}`);
console.log('Ctrl+C encerra.');
