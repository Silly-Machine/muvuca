// Controle de versões da Muvuca. Um lugar só para: calcular a próxima versão, tirar do CHANGELOG as notas
// de uma versão, conferir se a tag bate com o código e lançar (commit + tag).
//
//   node apoio/versao.mjs lancar <correcao|menor|maior|X.Y.Z> [--enviar] [--sem-testes]
//   node apoio/versao.mjs notas [X.Y.Z]        notas da versão (padrão: a do package.json)
//   node apoio/versao.mjs conferir [vX.Y.Z]    a tag bate com package.json e tem notas no CHANGELOG?
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const EM_ANDAMENTO = 'Em andamento';
const RE_VERSAO = /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/;

// ---------- funções puras (testadas em test/versao.test.js)

// "0.2.0" + "menor" -> "0.3.0". Aceita também uma versão escrita por extenso.
export function proxima(atual, pedido) {
  if (RE_VERSAO.test(pedido)) return pedido;
  const [maior, menor, correcao] = atual.split('-')[0].split('.').map(Number);
  if (pedido === 'maior' || pedido === 'major') return `${maior + 1}.0.0`;
  if (pedido === 'menor' || pedido === 'minor') return `${maior}.${menor + 1}.0`;
  if (pedido === 'correcao' || pedido === 'correção' || pedido === 'patch') return `${maior}.${menor}.${correcao + 1}`;
  throw new Error(`não entendi "${pedido}": use correcao, menor, maior ou uma versão como 1.2.3`);
}

// Compara versões: negativo se a < b. Pré-lançamento ("1.0.0-beta.1") vem antes da versão cheia.
export function comparar(a, b) {
  const [na, pa = ''] = a.split('-'), [nb, pb = ''] = b.split('-');
  const x = na.split('.').map(Number), y = nb.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  if (pa === pb) return 0;
  if (!pa) return 1;
  if (!pb) return -1;
  return pa.localeCompare(pb, 'en', { numeric: true });
}

export const preLancamento = (versao) => versao.includes('-');

// Quebra o CHANGELOG em seções: [{ titulo, versao, corpo }]. "versao" é null em seção sem número (como "Em andamento").
export function secoes(changelog) {
  const partes = changelog.replace(/\r\n/g, '\n').split(/^## +/m).slice(1);
  return partes.map((p) => {
    const fim = p.indexOf('\n');
    const titulo = (fim < 0 ? p : p.slice(0, fim)).trim();
    const m = /^v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)\b/.exec(titulo);
    return { titulo, versao: m ? m[1] : null, corpo: (fim < 0 ? '' : p.slice(fim + 1)).trim() };
  });
}

// Notas de uma versão, como estão no CHANGELOG. Erro se a seção não existe ou está vazia.
export function notasDa(changelog, versao) {
  const s = secoes(changelog).find((x) => x.versao === versao);
  if (!s) throw new Error(`o CHANGELOG.md não tem a seção "## ${versao}"`);
  if (!s.corpo) throw new Error(`a seção "## ${versao}" do CHANGELOG.md está vazia`);
  return s.corpo;
}

// As versões do CHANGELOG estão da mais nova para a mais antiga, sem repetição?
export function problemasDeOrdem(changelog) {
  const vs = secoes(changelog).map((s) => s.versao).filter(Boolean);
  const erros = [];
  for (let i = 1; i < vs.length; i++) {
    if (comparar(vs[i - 1], vs[i]) === 0) erros.push(`${vs[i]} aparece duas vezes`);
    else if (comparar(vs[i - 1], vs[i]) < 0) erros.push(`${vs[i]} está depois de ${vs[i - 1]}, mas é mais nova`);
  }
  return erros;
}

// Troca "## Em andamento" pelo título da versão, com a data. Devolve o texto novo, ou null se a seção não existe.
export function fecharEmAndamento(changelog, versao, data) {
  const re = new RegExp(`^## +${EM_ANDAMENTO}[^\\n]*$`, 'm');
  if (!re.test(changelog)) return null;
  return changelog.replace(re, (linha) => {
    const resumo = /:\s*(.+)$/.exec(linha)?.[1];
    return `## ${versao} (${data})${resumo ? ': ' + resumo : ''}`;
  });
}

export const dataDeHoje = (d = new Date()) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

// ---------- o que mexe em disco e no git

const ler = (arq) => fs.readFileSync(path.join(RAIZ, arq), 'utf8');
const gravar = (arq, texto) => fs.writeFileSync(path.join(RAIZ, arq), texto);
const versaoAtual = () => JSON.parse(ler('package.json')).version;

function git(...args) {
  const r = spawnSync('git', args, { cwd: RAIZ, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${(r.stderr || r.stdout).trim()}`);
  return r.stdout.trim();
}

function conferir(tag) {
  const versao = versaoAtual();
  const esperada = `v${versao}`;
  if (tag && tag !== esperada) throw new Error(`a tag é ${tag}, mas o package.json diz ${versao}. A tag certa seria ${esperada}.`);
  const changelog = ler('CHANGELOG.md');
  notasDa(changelog, versao);
  const ordem = problemasDeOrdem(changelog);
  if (ordem.length) throw new Error(`CHANGELOG.md fora de ordem: ${ordem.join('; ')}`);
  const lock = JSON.parse(ler('package-lock.json'));
  if (lock.version !== versao) throw new Error(`package-lock.json diz ${lock.version}, e o package.json diz ${versao}`);
  return versao;
}

function lancar(pedido, { enviar, semTestes }) {
  const atual = versaoAtual();
  const nova = proxima(atual, pedido);
  const tag = `v${nova}`;
  if (comparar(nova, atual) <= 0) throw new Error(`a versão nova (${nova}) precisa ser maior que a atual (${atual})`);
  if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') throw new Error('lance a partir do ramo main');
  if (git('tag', '--list', tag)) throw new Error(`a tag ${tag} já existe`);
  // só o CHANGELOG pode ter mudança sem commit: é onde as notas acabaram de ser escritas
  const sujos = git('status', '--porcelain').split('\n').filter(Boolean).map((l) => l.trim().split(/\s+/).slice(1).join(' ')).filter((a) => a !== 'CHANGELOG.md');
  if (sujos.length) throw new Error(`há mudanças sem commit: ${sujos.join(', ')}. Faça o commit delas antes de lançar.`);

  let changelog = ler('CHANGELOG.md').replace(/\r\n/g, '\n');
  if (!secoes(changelog).some((s) => s.versao === nova)) {
    const fechado = fecharEmAndamento(changelog, nova, dataDeHoje());
    if (!fechado) throw new Error(`escreva as notas antes: crie no topo do CHANGELOG.md uma seção "## ${EM_ANDAMENTO}" (ou "## ${nova}") com o que mudou`);
    changelog = fechado;
  }
  const notas = notasDa(changelog, nova);
  const ordem = problemasDeOrdem(changelog);
  if (ordem.length) throw new Error(`CHANGELOG.md fora de ordem: ${ordem.join('; ')}`);

  if (!semTestes) {
    console.log('Rodando os testes...');
    const t = spawnSync(process.execPath, ['--test'], { cwd: RAIZ, stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, NODE_TEST_CONTEXT: '' } });
    if (t.status !== 0) throw new Error('os testes não passaram: nada foi alterado');
  }

  gravar('CHANGELOG.md', changelog);
  gravar('package.json', ler('package.json').replace(/("version":\s*")[^"]+(")/, `$1${nova}$2`));
  const lock = JSON.parse(ler('package-lock.json'));
  lock.version = nova; if (lock.packages?.['']) lock.packages[''].version = nova;
  gravar('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
  // o README cita a versão no selo e na nota de estado do projeto
  const antes = atual.replace(/[.]/g, '\\.');
  gravar('README.md', ler('README.md')
    .replace(new RegExp(`(vers%C3%A3o-)${antes.replace(/-/g, '--')}(-)`), `$1${nova.replace(/-/g, '--')}$2`)
    .replace(new RegExp(`\\(versão ${antes}\\)`), `(versão ${nova})`));

  git('add', 'CHANGELOG.md', 'package.json', 'package-lock.json', 'README.md');
  git('commit', '-m', `Muvuca ${nova}`);
  git('tag', '-a', tag, '-m', `Muvuca ${nova}\n\n${notas}`);
  console.log(`\nVersão ${nova} pronta: commit e tag ${tag} criados neste computador.`);
  if (enviar) {
    git('push', 'origin', 'main'); git('push', 'origin', tag);
    console.log(`Enviada. O GitHub Actions gera os instaladores e publica em Releases${preLancamento(nova) ? ', marcada como pré-lançamento' : ''}.`);
  } else {
    console.log(`Para publicar:  git push origin main && git push origin ${tag}`);
    console.log(`Para desistir:  git tag -d ${tag} && git reset --hard HEAD~1`);
  }
  return nova;
}

// ---------- linha de comando
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [comando, ...resto] = process.argv.slice(2);
  const opcoes = resto.filter((a) => a.startsWith('--')), args = resto.filter((a) => !a.startsWith('--'));
  try {
    if (comando === 'notas') process.stdout.write(notasDa(ler('CHANGELOG.md'), (args[0] || versaoAtual()).replace(/^v/, '')) + '\n');
    else if (comando === 'conferir') console.log(`Tudo certo com a versão ${conferir(args[0])}.`);
    else if (comando === 'lancar' && args[0]) lancar(args[0], { enviar: opcoes.includes('--enviar'), semTestes: opcoes.includes('--sem-testes') });
    else { console.log('Uso:\n  node apoio/versao.mjs lancar <correcao|menor|maior|X.Y.Z> [--enviar] [--sem-testes]\n  node apoio/versao.mjs notas [X.Y.Z]\n  node apoio/versao.mjs conferir [vX.Y.Z]'); process.exit(comando ? 2 : 0); }
  } catch (e) { console.error(`Não deu: ${e.message}`); process.exit(1); }
}
