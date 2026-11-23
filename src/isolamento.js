// Isolamento dos testes. O código de teste que um agente escreve é código como outro qualquer: sem isto, rodava
// com as permissões de quem abriu a Muvuca e podia ler e escrever em qualquer lugar.
//
// O isolamento usa o modelo de permissões do próprio Node: o processo dos testes só lê e escreve dentro da pasta
// do projeto e de uma pasta temporária criada para ele, e não consegue abrir outros processos. As permissões vão
// pela variável de ambiente NODE_OPTIONS.
//
// O "node --test" normalmente abre um processo por arquivo de teste, o que o isolamento proíbe; por isso ele roda
// com a opção que mantém tudo num processo só. No Node 24 essa opção também vai pela variável de ambiente, e aí o
// isolamento vale até para o "node --test" que o próprio agente dispara. No Node 22 ela só é aceita na linha de
// comando: o portão isola (é a Muvuca que monta o comando), mas os testes rodados pelo agente não.
//
// O que NÃO fica isolado: a rede (o Node não restringe), e qualquer comando de teste que não seja "node --test"
// (pytest, jest por npx, um script próprio): esses rodam como antes, e a tela diz que estão sem isolamento.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const PERMISSOES = ['--permission', '--experimental-permission'];
const NUM_PROCESSO_SO = ['--test-isolation=none', '--experimental-test-isolation=none'];
// Caminho dentro de NODE_OPTIONS: entre aspas, com a barra invertida dobrada (ali ela é caractere de escape).
const aspas = (p) => `"${String(p).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const opcoes = (permissao, pastas, extra = '') => [permissao, ...pastas.flatMap((p) => [`--allow-fs-read=${aspas(p)}`, `--allow-fs-write=${aspas(p)}`]), extra].filter(Boolean).join(' ');

function executar(comando, args, env, cwd) {
  return new Promise((resolve) => {
    let saida = '';
    let filho;
    try { filho = spawn(comando, args, { env, cwd, windowsHide: true }); } catch (e) { return resolve({ codigo: -1, saida: e.message }); }
    const tempo = setTimeout(() => { try { filho.kill(); } catch { /* já saiu */ } }, 20000);
    filho.stdout.on('data', (d) => { saida += d; }); filho.stderr.on('data', (d) => { saida += d; });
    filho.on('error', (e) => { clearTimeout(tempo); resolve({ codigo: -1, saida: e.message }); });
    filho.on('close', (codigo) => { clearTimeout(tempo); resolve({ codigo, saida }); });
  });
}

// O "node" desta máquina aceita as opções e elas de fato bloqueiam? Uma sonda responde, uma vez por execução:
// tenta escrever fora da pasta liberada e espera ser negada. Sem a sonda, uma versão antiga do Node ignoraria as
// opções (ou recusaria subir) e a Muvuca diria "isolado" sem estar.
let sondagem = null;
async function sondar() {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'muvuca-sonda-'));
  const dentro = path.join(base, 'dentro'), fora = path.join(base, 'fora.txt');
  await fs.mkdir(dentro);
  const codigo = `const fs=require('fs');let r='';try{fs.writeFileSync(${JSON.stringify(fora)},'x');r+='ESCREVEU-FORA'}catch(e){r+=e.code}try{fs.writeFileSync(require('path').join(${JSON.stringify(dentro)},'ok.txt'),'x');r+=' ESCREVEU-DENTRO'}catch(e){r+=' '+e.code}console.log(r)`;
  const limpo = () => { const env = { ...process.env }; delete env.NODE_TEST_CONTEXT; delete env.NODE_OPTIONS; return env; };
  const bloqueia = async (permissao, extraNoAmbiente, extraNaLinha) => {
    const r = await executar('node', [...(extraNaLinha ? [extraNaLinha] : []), '-e', codigo], { ...limpo(), NODE_OPTIONS: opcoes(permissao, [dentro], extraNoAmbiente) }, dentro);
    return r.codigo === 0 && /ERR_ACCESS_DENIED ESCREVEU-DENTRO/.test(r.saida);
  };
  try {
    for (const permissao of PERMISSOES) {
      if (!(await bloqueia(permissao, '', ''))) continue;
      // a opção de rodar num processo só: melhor pela variável de ambiente (vale para o agente); senão, pela linha de comando
      for (const um of NUM_PROCESSO_SO) if (await bloqueia(permissao, um, '')) return { ok: true, permissao, noAmbiente: um, naLinha: '', paraAgentes: true };
      for (const um of NUM_PROCESSO_SO) if (await bloqueia(permissao, '', um)) return { ok: true, permissao, noAmbiente: '', naLinha: um, paraAgentes: false };
    }
    const v = await executar('node', ['--version'], limpo(), base);
    return { ok: false, motivo: v.codigo === 0 ? `o Node instalado (${v.saida.trim()}) não tem o modelo de permissões usado no isolamento; atualize para o Node 24 ou mais novo` : 'o comando "node" não foi encontrado' };
  } finally { await fs.rm(base, { recursive: true, force: true }).catch(() => {}); }
}
export const isolamentoDisponivel = () => (sondagem ||= sondar());
export const esquecerSondagem = () => { sondagem = null; };   // para os testes

// O comando de teste pode rodar isolado? Devolve o comando a executar, ou null. Só "node --test" entra: é o único
// em que as opções do Node alcançam o código de teste sem precisar abrir outro processo. "npm test" entra quando
// o script do package.json é "node --test" (o npm em si não roda sob o modelo de permissões).
const RE_NODE_TEST = /^node --test(\s+[\w@./*\\-]+)*$/;
export async function comandoIsolavel(comando, projeto) {
  const c = String(comando || '').trim();
  if (RE_NODE_TEST.test(c)) return c;
  if (/^npm (test|t|run test)$/.test(c)) {
    try { const s = String(JSON.parse(await fs.readFile(path.join(projeto, 'package.json'), 'utf8')).scripts?.test || '').trim(); if (RE_NODE_TEST.test(s)) return s; } catch { /* sem package.json legível */ }
  }
  return null;
}

// Prepara uma execução isolada para a pasta do projeto: cria a pasta temporária e devolve as variáveis de ambiente.
// Quem chama roda o processo com esse ambiente (passando o comando por comando()) e depois chama limpar().
export async function prepararIsolamento(projeto) {
  const s = await isolamentoDisponivel();
  if (!s.ok) return { ok: false, motivo: s.motivo };
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'muvuca-testes-'));
  const pasta = path.resolve(projeto);
  // Libera o caminho como foi dado e o caminho verdadeiro: quando há um link simbólico no meio (no macOS, /var é um
  // atalho para /private/var, e a pasta temporária fica ali), o Node confere a permissão pelo caminho verdadeiro.
  const real = async (p) => fs.realpath(p).catch(() => p);
  // Terceira forma: a pasta-mãe pelo caminho verdadeiro, com o nome da pasta como foi dado. Cobre o projeto que é ele
  // mesmo um link dentro de um caminho com nome abreviado (no Windows, "RUNNER~1" no lugar do nome inteiro do usuário).
  const maeReal = async (p) => path.join(await real(path.dirname(p)), path.basename(p));
  const liberadas = [...new Set([pasta, await real(pasta), await maeReal(pasta), tmp, await real(tmp), await maeReal(tmp)])];
  return {
    ok: true, tmp,
    // TMP, TEMP e TMPDIR levam os.tmpdir() para a pasta liberada: teste que cria arquivo temporário continua funcionando
    env: { NODE_OPTIONS: opcoes(s.permissao, liberadas, s.noAmbiente), TMP: tmp, TEMP: tmp, TMPDIR: tmp },
    // o comando "node --test ..." como deve ser executado nesta versão do Node
    comando: (c) => (s.naLinha ? c.replace(/^node /, `node ${s.naLinha} `) : c),
    // o ambiente basta para isolar um "node --test" que outro programa dispare (o agente)? Só quando nada precisa ir na linha de comando.
    paraAgentes: s.paraAgentes,
    limpar: () => fs.rm(tmp, { recursive: true, force: true }).catch(() => {}),
  };
}

export const EXPLICACAO_BLOQUEIO = '\n[isolamento] Um teste tentou ler ou escrever fora da pasta do projeto, ou abrir outro processo, e foi bloqueado (ERR_ACCESS_DENIED). Arquivos temporários devem usar os.tmpdir(). Se o projeto precisa mesmo disso, desligue "Isolar os testes" nas Configurações.';

// O aplicativo do provedor funciona com o ambiente isolado? As opções vão por NODE_OPTIONS, que todo processo Node
// obedece: um aplicativo feito em Node (instalado pelo npm) ficaria ele mesmo preso e não subiria. O "claude" nativo
// não é afetado. A sonda roda "<aplicativo> --version" no ambiente isolado, uma vez por aplicativo; se falhar,
// o agente roda os testes dele sem isolamento (o portão continua isolado) e a conversa avisa.
const aceitam = new Map();
export function cliAceitaIsolamento(comando) {
  if (!aceitam.has(comando)) aceitam.set(comando, (async () => {
    const iso = await prepararIsolamento(os.tmpdir());
    if (!iso.ok) return false;
    try {
      const env = { ...process.env, ...iso.env }; delete env.NODE_TEST_CONTEXT;
      const noWindows = process.platform === 'win32';
      // no Windows os aplicativos instalados pelo npm são arquivos .cmd, que só rodam pelo shell
      const r = await new Promise((resolve) => {
        let filho; try { filho = noWindows ? spawn(`${comando} --version`, [], { env, shell: true, windowsHide: true }) : spawn(comando, ['--version'], { env }); } catch { return resolve(-1); }
        const tempo = setTimeout(() => { try { filho.kill(); } catch { /* já saiu */ } }, 20000);
        filho.on('error', () => { clearTimeout(tempo); resolve(-1); }); filho.on('close', (c) => { clearTimeout(tempo); resolve(c); });
        filho.stdout?.resume(); filho.stderr?.resume();
      });
      return r === 0;
    } finally { await iso.limpar(); }
  })());
  return aceitam.get(comando);
}
