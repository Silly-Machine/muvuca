import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Muvuca, nivel } from '../orquestrador.js';

process.env.DEMO_ATRASO = '0';
const cfg = JSON.parse(await fs.readFile(new URL('../agentes.json', import.meta.url), 'utf8'));
const pastaNova = () => fs.mkdtemp(path.join(os.tmpdir(), 'muvuca-cx-'));

test('nível de complexidade aceita acento e maiúscula, e rejeita o resto', () => {
  assert.strictEqual(nivel('Média'), 'media');
  assert.strictEqual(nivel(' ALTA '), 'alta');
  assert.strictEqual(nivel('baixa'), 'baixa');
  assert.strictEqual(nivel('enorme'), null);
  assert.strictEqual(nivel(undefined), null);
});

test('escolha do modelo: mapa do agente > modelo fixo do agente > mapa do provedor > modelo do provedor', () => {
  const c = structuredClone(cfg);
  c.provedores.p = { tipo: 'demo', modelo: 'padrao', modelos: { baixa: 'leve', alta: 'forte' } };
  const e = new Muvuca(c);
  const livre = { id: 'a', provedor: 'p' };
  assert.strictEqual(e.provedor(livre, 'alta').modelo, 'forte');
  assert.strictEqual(e.provedor(livre, 'baixa').modelo, 'leve');
  assert.strictEqual(e.provedor(livre, 'media').modelo, 'padrao', 'nível sem modelo no mapa cai no padrão');
  assert.strictEqual(e.provedor(livre).modelo, 'padrao', 'sem complexidade, o padrão');
  assert.strictEqual(e.provedor({ ...livre, modelo: 'fixo' }, 'alta').modelo, 'fixo', 'modelo no agente fixa a escolha');
  assert.strictEqual(e.provedor({ ...livre, modelo: 'fixo', modelos: { alta: 'do-agente' } }, 'alta').modelo, 'do-agente');
});

test('o plano carrega a complexidade e cada devolução sobe um nível', async () => {
  const projeto = await pastaNova();
  const e = new Muvuca(structuredClone(cfg));
  await e.pedido({ texto: 'Crie uma página de status com um endpoint /health', projeto });
  const plano = e.eventos.find((x) => x.tipo === 'plano');
  assert.deepStrictEqual(plano.etapas.map((s) => [s.agente, s.complexidade]), [['chevron', 'media'], ['pixel', 'baixa']]);

  const feitos = e.eventos.filter((x) => x.tipo === 'concluiu').map((x) => [x.agente, x.complexidade, x.modelo]);
  assert.deepStrictEqual(feitos, [
    ['chevron', 'media', 'sonnet (simulado)'],
    ['pixel', 'baixa', 'haiku (simulado)'],
    ['chevron', 'alta', 'fable (simulado)'],    // portão reprovou: média sobe para alta
    ['revisor', 'alta', 'fable (simulado)'],    // revisa no nível da parte mais difícil
    ['chevron', 'alta', 'fable (simulado)'],    // já estava no topo: fica em alta
    ['revisor', 'alta', 'fable (simulado)'],
  ]);
  assert.deepStrictEqual(e.eventos.filter((x) => x.tipo === 'devolucao').map((d) => d.complexidade), ['alta', 'alta']);
  const consulta = e.eventos.find((x) => x.tipo === 'consulta');
  assert.deepStrictEqual([consulta.complexidade, consulta.modelo], ['baixa', 'haiku (simulado)']);
  assert.ok(e.eventos.some((x) => x.tipo === 'status' && x.agente === 'chevron' && x.modelo === 'fable (simulado)' && x.complexidade === 'alta'), 'a tela recebe o modelo em uso');
  await e.decidir('descartar');
});
