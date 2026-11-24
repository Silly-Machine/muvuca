// Aplicativo falso para os testes da chave de API: "auth status" diz se há assinatura (variável FALSO_ASSINATURA);
// qualquer outra chamada responde dizendo se recebeu a chave, ou falha por falta de crédito quando FALSO_SEM_CREDITO=1.
if (process.argv.slice(2).join(' ') === 'auth status') {
  console.log(JSON.stringify({ loggedIn: process.env.FALSO_ASSINATURA === '1' && !process.env.CHAVE_FALSA }));
} else if (process.env.FALSO_SEM_CREDITO === '1' && process.env.CHAVE_FALSA) {
  console.log('Credit balance is too low'); process.exit(1);
} else {
  console.log(JSON.stringify({ type: 'result', result: process.env.CHAVE_FALSA ? 'COM-CHAVE' : 'SEM-CHAVE' }));
}
