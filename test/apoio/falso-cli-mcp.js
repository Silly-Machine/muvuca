// CLI de mentira para testar as conexões (MCP): devolve os argumentos que recebeu, diz se o prompt falava das
// conexões e imita o uso de uma ferramenta de conexão no fluxo de saída.
let prompt = '';
process.stdin.on('data', (d) => { prompt += d; });
process.stdin.on('end', () => {
  const args = process.argv.slice(2);
  const i = args.indexOf('--mcp-config');
  if (i >= 0) console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'mcp__cofre__senha_do_dia', input: {} }] } }));
  console.log(JSON.stringify({ type: 'result', result: JSON.stringify({ args, falouDeConexoes: /conexões externas/.test(prompt), trecho: (/Você tem conexões externas[^\n]*/.exec(prompt) || [''])[0] }) }));
});
