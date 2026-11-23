// CLI de mentira que se comporta como o Claude Code sem login: imprime a mensagem de autenticação e sai com erro.
process.stdin.resume();
process.stdin.on('end', () => {
  console.log(JSON.stringify({ type: 'result', is_error: true, result: 'Failed to authenticate: OAuth session expired and could not be refreshed' }));
  process.exit(1);
});
