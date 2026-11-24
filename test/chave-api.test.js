// A chave de API no ambiente não pode passar na frente da assinatura sem o usuário saber.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chamar, chavesARetirar, esquecerAssinatura } from '../src/provedores.js';

const falso = fileURLToPath(new URL('./apoio/falso-cli-chave.js', import.meta.url));
const prov = (extra = {}) => ({ tipo: 'cli', comando: process.execPath, args: [falso], argsStatus: [falso, 'auth', 'status'], variaveisDeChave: ['CHAVE_FALSA'], ...extra });
const pedido = { sistema: 's', mensagens: [{ role: 'user', content: 'oi' }], ferramentas: [] };
const com = async (env, f) => {
  esquecerAssinatura();
  const antes = {}; for (const k of Object.keys(env)) { antes[k] = process.env[k]; process.env[k] = env[k]; }
  try { return await f(); } finally { for (const k of Object.keys(env)) { if (antes[k] === undefined) delete process.env[k]; else process.env[k] = antes[k]; } }
};

test('com assinatura logada, a chave de API fica de fora e o time usa a assinatura', async () => {
  await com({ CHAVE_FALSA: 'x', FALSO_ASSINATURA: '1', FALSO_SEM_CREDITO: '1' }, async () => {
    assert.deepEqual(await chavesARetirar(prov()), ['CHAVE_FALSA']);
    assert.equal((await chamar(prov(), pedido)).texto, 'SEM-CHAVE');
  });
});

test('sem assinatura logada, a chave de API continua indo para o aplicativo', async () => {
  await com({ CHAVE_FALSA: 'x', FALSO_ASSINATURA: '0' }, async () => {
    assert.deepEqual(await chavesARetirar(prov()), []);
    assert.equal((await chamar(prov(), pedido)).texto, 'COM-CHAVE');
  });
});

test('chave sem crédito e sem assinatura: o erro diz qual variável e o que fazer', async () => {
  await com({ CHAVE_FALSA: 'x', FALSO_ASSINATURA: '0', FALSO_SEM_CREDITO: '1' }, async () => {
    await assert.rejects(chamar(prov(), pedido), /variável de ambiente CHAVE_FALSA está sem crédito/);
  });
});

test('"usarChaveDeApi" mantém a chave mesmo com assinatura', async () => {
  await com({ CHAVE_FALSA: 'x', FALSO_ASSINATURA: '1' }, async () => {
    assert.deepEqual(await chavesARetirar(prov({ usarChaveDeApi: true })), []);
  });
});

test('sem a variável no ambiente, nada muda', async () => {
  assert.deepEqual(await chavesARetirar(prov(), {}), []);
});
