// Funções de partes da tela carregadas depois de quem as chama. Os módulos são carregados em ordem (ver principal.js)
// e cada um só importa dos anteriores; quando um anterior precisa chamar um posterior, e isso só acontece em resposta
// a um clique ou a um evento do servidor, a chamada passa por aqui. Cada módulo registra as suas no fim do arquivo.
//   atualizarAndamento, atualizarBuzina, buzinaSolta, carregarConfig, desenharQuadro, marcarSetaSel, montarBasicos, montarConfig, montarMemoria, montarProjetos, montarRotinas, secao
export const depois = {};
