// Histórico de desfazer e refazer do construtor, sem nada de tela. Cada estado é um texto (o rascunho em JSON).
// Serve ao navegador e aos testes (test/tela.test.js).
//
// Uso: a cada mudança, registrar(estado). desfazer(atual) e refazer(atual) devolvem o estado a aplicar,
// ou null quando não há para onde ir.
export function criarHistorico(limite = 80) {
  let desfeitos = [], refeitos = [], ultimo = null;
  const h = {
    // Guarda o estado anterior como um passo, se o estado mudou. Uma mudança nova apaga o que havia para refazer.
    registrar(estado) {
      if (ultimo !== null && estado !== ultimo) {
        desfeitos.push(ultimo);
        if (desfeitos.length > limite) desfeitos.shift();
        refeitos = [];
      }
      ultimo = estado;
    },
    desfazer(atual) {
      h.registrar(atual);   // pega uma mudança que ainda não tinha sido registrada
      if (!desfeitos.length) return null;
      refeitos.push(atual);
      ultimo = desfeitos.pop();
      return ultimo;
    },
    refazer(atual) {
      h.registrar(atual);
      if (!refeitos.length) return null;
      desfeitos.push(atual);
      ultimo = refeitos.pop();
      return ultimo;
    },
    limpar() { desfeitos = []; refeitos = []; ultimo = null; },
    get podeDesfazer() { return desfeitos.length > 0; },
    get podeRefazer() { return refeitos.length > 0; },
    get passos() { return desfeitos.length; },
  };
  return h;
}
