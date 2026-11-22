// CLI de mentira: lê o prompt da entrada padrão, grava um arquivo na pasta atual e imita o stream-json.
import fs from 'node:fs';
let prompt = '';
process.stdin.on('data', (d) => { prompt += d; });
process.stdin.on('end', () => {
  fs.writeFileSync('do-cli.txt', prompt.includes('Crie') ? 'feito pelo cli\n' : 'outro\n');
  console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Write' }] } }));
  console.log(JSON.stringify({ type: 'result', result: 'Arquivo criado pelo CLI.' }));
});
