// Entrega as regras (módulos testados em test/tela.test.js) aos arquivos da tela, que dividem um escopo só.
// Este arquivo é carregado antes deles no index.html.
import * as setas from './setas.js';
import { criarHistorico } from './historico.js';

window.Regras = { setas, criarHistorico };
