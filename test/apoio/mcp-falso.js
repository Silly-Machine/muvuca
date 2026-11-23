// Servidor MCP mínimo, só para testes: fala o protocolo pela entrada e saída padrão (uma mensagem JSON por linha)
// e oferece duas ferramentas. "senha_do_dia" devolve um texto que só dá para saber chamando a ferramenta.
// Uso: node test/apoio/mcp-falso.js [senha]
import readline from 'node:readline';

const SENHA = process.argv[2] || process.env.MCP_FALSO_SENHA || 'MUVUCA-MCP-4821';
const FERRAMENTAS = [
  { name: 'senha_do_dia', description: 'Devolve a senha do dia. Não recebe argumentos.', inputSchema: { type: 'object', properties: {} } },
  { name: 'eco', description: 'Devolve o texto recebido.', inputSchema: { type: 'object', properties: { texto: { type: 'string' } }, required: ['texto'] } },
];
const enviar = (msg) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');

readline.createInterface({ input: process.stdin }).on('line', (linha) => {
  let m; try { m = JSON.parse(linha); } catch { return; }
  if (m.id === undefined) return;   // notificação: nada a responder
  if (m.method === 'initialize') return enviar({ id: m.id, result: { protocolVersion: m.params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'mcp-falso', version: '1.0.0' } } });
  if (m.method === 'ping') return enviar({ id: m.id, result: {} });
  if (m.method === 'tools/list') return enviar({ id: m.id, result: { tools: FERRAMENTAS } });
  if (m.method === 'tools/call') {
    const { name, arguments: args = {} } = m.params || {};
    if (name === 'senha_do_dia') return enviar({ id: m.id, result: { content: [{ type: 'text', text: SENHA }] } });
    if (name === 'eco') return enviar({ id: m.id, result: { content: [{ type: 'text', text: String(args.texto ?? '') }] } });
    return enviar({ id: m.id, result: { content: [{ type: 'text', text: `ferramenta desconhecida: ${name}` }], isError: true } });
  }
  enviar({ id: m.id, error: { code: -32601, message: `método não suportado: ${m.method}` } });
});
