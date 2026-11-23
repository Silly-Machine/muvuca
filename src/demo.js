// Provedor de demonstração: responde por roteiro, mas passa pelo MESMO caminho dos provedores reais
// (plano em JSON, chamadas de ferramenta, veredito). O roteiro erra de propósito duas vezes para
// exercitar o portão de testes e a devolução do revisor.

const HEALTH_V1 = `const http = require('node:http');

function health() {
  return { status: 'ok' };
}

function criarServidor() {
  return http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(health()));
    }
    res.writeHead(404);
    res.end();
  });
}

module.exports = { health, criarServidor };
if (require.main === module) criarServidor().listen(3000);
`;
const HEALTH_V2 = HEALTH_V1.replace("return { status: 'ok' };", "return { status: 'ok', uptime: process.uptime() };");
const HEALTH_V3 = HEALTH_V2.replace("{ 'Content-Type': 'application/json' }", "{ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }");

const TESTE = `const test = require('node:test');
const assert = require('node:assert');
const { health } = require('../src/health.js');

test('health responde ok e informa uptime', () => {
  const r = health();
  assert.strictEqual(r.status, 'ok');
  assert.strictEqual(typeof r.uptime, 'number');
});
`;

const PAGINA = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Status</title>
<style>
  body { font-family: system-ui, sans-serif; background: #111; color: #eee; display: grid; place-items: center; min-height: 100vh; margin: 0; }
  main { padding: 2rem; border: 1px solid #333; border-radius: 12px; }
  .ok { color: #5c5; } .falha { color: #e66; }
  button:focus-visible { outline: 3px solid #fa0; }
</style>
</head>
<body>
<main>
  <h1>Status do serviço</h1>
  <p id="estado" aria-live="polite">consultando...</p>
  <button id="atualizar">Atualizar</button>
</main>
<script>
async function consultar() {
  const el = document.getElementById('estado');
  try {
    const r = await (await fetch('/health')).json();
    el.textContent = r.status + ' (no ar há ' + Math.round(r.uptime) + ' s)';
    el.className = 'ok';
  } catch { el.textContent = 'fora do ar'; el.className = 'falha'; }
}
document.getElementById('atualizar').onclick = consultar;
consultar();
</script>
</body>
</html>
`;

let seq = 0;
const chamada = (nome, args) => {
  const id = `demo_${++seq}`;
  return { texto: '', chamadas: [{ id, nome, args }], msg: { role: 'assistant', content: '', tool_calls: [{ id, type: 'function', function: { name: nome, arguments: JSON.stringify(args) } }] } };
};
const fala = (texto) => ({ texto, chamadas: [], msg: { role: 'assistant', content: texto } });

// Teste que confere as notas de um agente genérico: mantém o portão de testes no circuito
// mesmo para times montados no construtor, que o roteiro não conhece.
const TESTE_NOTAS = (id) => `const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('as notas de ${id} existem e não estão vazias', () => {
  const texto = fs.readFileSync(path.join(__dirname, '..', 'notas', '${id}.md'), 'utf8');
  assert.ok(texto.trim().length > 0);
});
`;

// Líder genérico (times do construtor): lê a equipe do próprio prompt e dá uma etapa a cada executor.
function liderGenerico(sistema, ultimoUsuario) {
  const pedido = ultimoUsuario.match(/^(?:PEDIDO DO USUÁRIO|TAREFA PARA A SUA FRENTE):\n([\s\S]*)/)?.[1];
  if (pedido === undefined) return fala(JSON.stringify({ fala: 'Plano mantido.', consultas: [], etapas: [] }));
  if (!/\b(cri|fa[çc]|adicion|implement|corrij|corrig|escrev|mont|ger[ae]|constru|ajust|mud|alter|refator|test)/i.test(pedido)) {
    return fala(JSON.stringify({ fala: 'Oi! Diga o que o time deve fazer.', consultas: [], etapas: [] }));
  }
  const equipe = [...String(sistema).matchAll(/^- ([a-z][a-z0-9-]*): (.*)$/gm)].filter((m) => !m[2].includes('só consulta'));
  const etapas = equipe.map((m, i) => ({ agente: m[1], tarefa: `Sua parte (${m[2].replace(/ \(sub-líder.*$/, '')}) em: ${pedido.trim().slice(0, 200)}`, complexidade: i === 0 ? 'media' : 'baixa' }));
  return fala(JSON.stringify({ fala: `Divido em ${etapas.length} parte(s).`, consultas: [], etapas }));
}

// Executor genérico: escreve as notas da sua parte e um teste que as confere.
function executorGenerico(agente, feitas, primeira) {
  if (!agente.ferramentas?.includes('escrever')) return fala(`Do ponto de vista de ${agente.papel}: comece pelo mais simples e teste.`);
  if (feitas === 0) return chamada('escrever', { caminho: `notas/${agente.id}.md`, conteudo: `# ${agente.nome}\n\nParte: ${agente.papel}.\n\nTarefa recebida:\n${primeira.slice(0, 400)}\n` });
  if (feitas === 1) return chamada('escrever', { caminho: `test/${agente.id}.test.js`, conteudo: TESTE_NOTAS(agente.id) });
  // Na rede, passa a vez para o primeiro vizinho que ainda não participou; sem ninguém, encerra.
  const rede = primeira.split('Pode passar para:\n')[1];
  if (primeira.includes('rede de agentes sem chefe')) {
    const ja = (primeira.match(/Já participaram: (.*)/)?.[1] || '').split(',').map((s) => s.trim());
    const prox = [...(rede || '').matchAll(/^- ([a-z][a-z0-9-]*): /gm)].map((m) => m[1]).find((v) => !ja.includes(v) && v !== agente.id);
    return fala(`Fiz a parte de ${agente.papel}, com teste.\n${JSON.stringify({ proximo: prox || 'fim', motivo: prox ? `falta a parte de ${prox}` : 'todos já participaram' })}`);
  }
  return fala(`Fiz a parte de ${agente.papel}, com teste.`);
}

export function demo({ agente, mensagens, sistema = '' }) {
  const ultimoUsuario = [...mensagens].reverse().find((m) => m.role === 'user')?.content || '';
  const primeira = mensagens.find((m) => m.role === 'user')?.content || '';
  const feitas = mensagens.filter((m) => m.role === 'tool').length;
  const ultimaFerramenta = [...mensagens].reverse().find((m) => m.role === 'tool')?.content || '';

  // Planejador de especificação: na demonstração, cada item de lista da especificação vira uma etapa (ou duas etapas fixas).
  if (String(sistema).startsWith('PLANEJADOR DE ESPECIFICAÇÃO')) {
    const itens = [...ultimoUsuario.matchAll(/^\s*(?:[-*]|\d+[.)])\s+(.+)$/gm)].map((m) => m[1].trim()).filter(Boolean).slice(0, 6);
    const etapas = (itens.length >= 2 ? itens : ['Crie a base: a rota /health com teste', 'Crie a página de status que consulta a rota']).map((t) => ({ titulo: t.slice(0, 80), tarefa: `Faça: ${t}`, aceite: 'os testes do projeto passam' }));
    return fala(JSON.stringify({ etapas }));
  }

  if (agente.id !== 'maestro' && (agente.funcao === 'lider' || agente.funcao === 'sublider')) return liderGenerico(sistema, ultimoUsuario);

  if (agente.id === 'maestro') {
    // Pedido sem verbo de trabalho ("oi", "tudo bem?") é conversa: o líder responde e não monta plano.
    const pedido = ultimoUsuario.match(/^PEDIDO DO USUÁRIO:\n([\s\S]*)/)?.[1];
    if (pedido !== undefined && !/\b(cri|fa[çc]|fiz|adicion|implement|corrij|corrig|escrev|mont|ger[ae]|constru|ajust|mud|alter|refator|test|cons(e|i)rt)/i.test(pedido)) {
      return fala(JSON.stringify({ fala: 'Oi! Sou o Maestro. Diga o que o time deve fazer, por exemplo: "Crie uma página de status com um endpoint /health".', consultas: [], etapas: [] }));
    }
    if (!ultimoUsuario.includes('RESPOSTAS DAS CONSULTAS')) {
      return fala(JSON.stringify({ fala: 'Antes de decidir, quero uma referência do Scout.', consultas: [{ agente: 'scout', pergunta: 'O que um endpoint /health deve devolver?', complexidade: 'baixa' }], etapas: [] }));
    }
    return fala(JSON.stringify({
      fala: 'Fica com Chevron e Pixel. Revisor confere no final.',
      consultas: [],
      etapas: [
        { agente: 'chevron', tarefa: 'Crie src/health.js com a rota /health e um teste em test/health.test.js.', complexidade: 'media' },
        { agente: 'pixel', tarefa: 'Crie public/status.html, uma página que consulta /health e mostra o estado.', complexidade: 'baixa' },
      ],
    }));
  }

  if (agente.id === 'scout') return fala('Referência: /health devolve JSON com status e uptime, e não deve ficar em cache.');

  if (agente.id === 'chevron') {
    if (primeira.includes('TESTES FALHARAM')) {
      if (feitas === 0) return chamada('ler', { caminho: 'src/health.js' });
      if (feitas === 1) return chamada('escrever', { caminho: 'src/health.js', conteudo: HEALTH_V2 });
      return fala('Faltava o uptime. Corrigido.');
    }
    if (primeira.includes('REVISOR REPROVOU')) {
      if (feitas === 0) return chamada('escrever', { caminho: 'src/health.js', conteudo: HEALTH_V3 });
      return fala('Cabeçalho de cache ajustado.');
    }
    if (feitas === 0) return chamada('listar', {});
    if (feitas === 1) return chamada('escrever', { caminho: 'src/health.js', conteudo: HEALTH_V1 });
    if (feitas === 2) return chamada('escrever', { caminho: 'test/health.test.js', conteudo: TESTE });
    return fala('Rota criada. Sem firula.');
  }

  if (agente.id === 'pixel') {
    if (feitas === 0) return chamada('escrever', { caminho: 'public/status.html', conteudo: PAGINA });
    return fala('Página pronta: responsiva, com foco visível e tema escuro.');
  }

  if (agente.id === 'revisor' && !primeira.includes('src/health.js')) {
    // revisão de um time do construtor: olha a pasta e aprova (o roteiro só tem defeito plantado no /health)
    if (feitas === 0) return chamada('listar', {});
    return fala(JSON.stringify({ aprovado: true, fala: 'Conferi a pasta: passa.', achados: [] }));
  }

  if (agente.id === 'revisor') {
    if (feitas === 0) return chamada('ler', { caminho: 'src/health.js' });
    if (!ultimaFerramenta.includes('no-store')) {
      return fala(JSON.stringify({ aprovado: false, fala: 'Um problema real. O resto passa.', achados: [{ agente: 'chevron', arquivo: 'src/health.js', problema: 'A resposta de /health não tem Cache-Control: no-store; um proxy pode servir um status antigo.' }] }));
    }
    return fala(JSON.stringify({ aprovado: true, fala: 'Agora passa.', achados: [] }));
  }

  return executorGenerico(agente, feitas, primeira);
}
