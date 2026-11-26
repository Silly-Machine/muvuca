// CLI de mentira cujo modelo "fable" exige créditos que a assinatura não tem: sai com código 1 e a mensagem do
// Claude Code. Com qualquer outro modelo, responde normalmente. Para "erro-generico" no prompt, sai com código 2.
let prompt = '';
const i = process.argv.indexOf('--model');
const modelo = i >= 0 ? process.argv[i + 1] : '';
process.stdin.on('data', (d) => { prompt += d; });
process.stdin.on('end', () => {
  if (prompt.includes('erro-generico')) {
    console.log(JSON.stringify({ type: 'result', result: 'Algo deu errado do lado do aplicativo.' }));
    process.exit(2);
  }
  if (modelo === 'fable') {
    console.log(JSON.stringify({ type: 'result', is_error: true, result: 'Fable 5.2 requires usage credits. Add credits or choose another model.' }));
    process.exit(1);
  }
  // o revisor recebe um pedido de veredito em JSON
  const resposta = /Responda SOMENTE com JSON: \{"aprovado"/.test(prompt) ? '{"aprovado":true,"fala":"Tudo certo.","achados":[]}' : `Feito com ${modelo || 'o modelo padrão'}.`;
  console.log(JSON.stringify({ type: 'result', result: resposta }));
});
