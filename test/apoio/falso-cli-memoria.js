// CLI de mentira para testar a memória dos agentes: diz se recebeu notas no prompt e pede para lembrar uma.
import fs from 'node:fs';
let prompt = '';
process.stdin.on('data', (d) => { prompt += d; });
process.stdin.on('end', () => {
  const notas = (prompt.match(/Suas notas de trabalhos anteriores[^\n]*\n((?:- .*\n?)+)/) || [])[1] || '';
  fs.writeFileSync('visto.txt', notas.trim() || 'sem notas');
  const sabeAnotar = prompt.includes('LEMBRAR:');
  console.log(JSON.stringify({ type: 'result', result: `Feito. ${notas ? 'Li minhas notas.' : 'Primeira vez aqui.'}` + (sabeAnotar ? '\nLEMBRAR: neste projeto os testes rodam com node --test' : '') }));
});
