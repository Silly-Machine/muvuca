// Três tipos de provedor atrás da mesma função `chamar`:
//   openai : qualquer API compatível com OpenAI (Groq, Ollama, gateway da empresa, OpenRouter...)
//   cli    : aplicativo de linha de comando logado na assinatura (claude, codex, gemini)
//   demo   : roteiro fixo, sem rede, para testar a orquestração e a tela
import { rodar, ESQUEMAS } from './ferramentas.js';
import { demo } from './demo.js';

const dormir = (ms, sinal) => new Promise((ok, erro) => {
  const t = setTimeout(ok, ms);
  sinal?.addEventListener('abort', () => { clearTimeout(t); erro(new Error('interrompido')); }, { once: true });
});

function esquemaOpenAI(nomes) {
  return nomes.map((n) => ({
    type: 'function',
    function: {
      name: n, description: ESQUEMAS[n].descricao,
      parameters: { type: 'object', properties: Object.fromEntries(Object.entries(ESQUEMAS[n].params).map(([k, t]) => [k, { type: t }])), required: Object.keys(ESQUEMAS[n].params) },
    },
  }));
}

async function openai(prov, { sistema, mensagens, ferramentas, sinal }) {
  const chave = prov.chaveEnv ? process.env[prov.chaveEnv] : prov.chave;
  if (prov.chaveEnv && !chave) throw new Error(`defina a variável de ambiente ${prov.chaveEnv}`);
  const corpo = { model: prov.modelo, messages: [{ role: 'system', content: sistema }, ...mensagens] };
  if (ferramentas?.length) corpo.tools = esquemaOpenAI(ferramentas);
  if (prov.extras) Object.assign(corpo, prov.extras);
  for (let tentativa = 0; ; tentativa++) {
    const r = await fetch(`${prov.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST', signal: sinal,
      headers: { 'content-type': 'application/json', ...(chave ? { authorization: `Bearer ${chave}` } : {}) },
      body: JSON.stringify(corpo),
    });
    if ((r.status === 429 || r.status >= 500) && tentativa < 4) {
      const espera = Math.min(30, Number(r.headers.get('retry-after')) || 2 ** tentativa * 2);
      await dormir(espera * 1000, sinal); continue;
    }
    if (!r.ok) throw new Error(`${prov.nome}: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
    const m = (await r.json()).choices?.[0]?.message || {};
    const chamadas = (m.tool_calls || []).map((c) => {
      let args = {}; try { args = JSON.parse(c.function.arguments || '{}'); } catch { args = { _invalido: c.function.arguments }; }
      return { id: c.id, nome: c.function.name, args };
    });
    return { texto: m.content || '', chamadas, msg: { role: 'assistant', content: m.content || '', ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}) } };
  }
}

// Lê a saída de um CLI: tenta JSON por linha; conta usos de ferramenta; acha o texto final.
export function lerSaidaCli(saida) {
  let passos = 0; let texto = '';
  const olhar = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(olhar);
    const tipo = String(o.type || '');
    if (/tool_use|command_execution|function_call|file_change|tool_call/.test(tipo)) passos++;
    if (tipo === 'result' && typeof o.result === 'string') texto = o.result;            // claude
    else if (typeof o.response === 'string') texto = o.response;                         // gemini
    else if (/agent_message|message/.test(tipo) && typeof o.text === 'string') texto = o.text; // codex
    for (const v of Object.values(o)) olhar(v);
  };
  let algumJson = false;
  for (const linha of saida.split('\n')) {
    const l = linha.trim(); if (!l.startsWith('{')) continue;
    try { olhar(JSON.parse(l)); algumJson = true; } catch { /* linha não é JSON */ }
  }
  if (!algumJson) { try { olhar(JSON.parse(saida)); algumJson = true; } catch { /* texto puro */ } }
  return { texto: texto || saida.trim().slice(-4000), passos };
}

async function cli(prov, { sistema, mensagens, ferramentas, sinal, cwd, aoPasso, mcp }) {
  const podeEscrever = ferramentas?.includes('escrever');
  const args = [...(podeEscrever ? prov.args : (prov.argsLeitura || prov.args))];
  // Conexões (MCP): só para quem não escreve, e só se o provedor declarou como recebê-las (argsMcp).
  if (mcp?.arquivo && !podeEscrever && Array.isArray(prov.argsMcp)) args.push(...prov.argsMcp.map((a) => String(a).replace('{arquivo}', mcp.arquivo).replace('{permissoes}', mcp.permissoes)));
  if (prov.modelo && prov.argModelo) args.push(prov.argModelo, prov.modelo);
  const conversa = mensagens.filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content)).map((m) => (m.role === 'user' ? m.content : `[sua resposta anterior]\n${m.content}`)).join('\n\n');
  let vistos = 0;
  const r = await rodar(prov.comando, {
    args, cwd, sinal, limiteMs: (prov.limiteSegundos || 600) * 1000, entrada: `${sistema}\n\n${conversa}`,
    aoSair: (pedaco) => {
      for (const m of pedaco.matchAll(/"name"\s*:\s*"mcp__([a-z0-9_]+?)__([A-Za-z0-9_.-]+)"/g)) aoPasso?.({ ferramenta: 'conexao', servidor: m[1], alvo: m[2] });
      const n = (pedaco.match(/"type"\s*:\s*"(tool_use|command_execution|function_call|file_change)"/g) || []).length; for (let i = 0; i < n; i++) aoPasso?.({ ferramenta: 'cli', alvo: `passo ${++vistos}` });
    },
  });
  if (r.codigo === -2) throw new Error('interrompido');
  const lido = lerSaidaCli(r.saida);
  if (r.codigo !== 0 && !lido.texto) throw new Error(`${prov.comando} saiu com código ${r.codigo}: ${r.saida.slice(-300)}`);
  if (r.codigo !== 0) lido.texto += `\n[aviso: ${prov.comando} saiu com código ${r.codigo}]`;
  return { texto: lido.texto, chamadas: [], passos: lido.passos, msg: { role: 'assistant', content: lido.texto } };
}

export async function chamar(prov, pedido) {
  if (prov.tipo === 'openai') return openai(prov, pedido);
  if (prov.tipo === 'cli') return cli(prov, pedido);
  if (prov.tipo === 'demo') { await dormir(Number(process.env.DEMO_ATRASO ?? 700), pedido.sinal); return demo(pedido); }
  throw new Error(`tipo de provedor desconhecido: ${prov.tipo}`);
}
