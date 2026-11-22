import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { proxima, comparar, secoes, notasDa, problemasDeOrdem, fecharEmAndamento, dataDeHoje, preLancamento } from '../apoio/versao.mjs';

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const EXEMPLO = `# Histórico de mudanças

## Em andamento: coisa nova

- Item em andamento.

## 0.2.0 (22/11/2026): instalável

### Novo

- Aplicativo de mesa.

## 0.1.6 (22/11/2026)

- Rodada de testes.

## 0.1.0

Primeira versão.
`;

test('próxima versão: correção, menor, maior e por extenso', () => {
  assert.equal(proxima('0.2.0', 'correcao'), '0.2.1');
  assert.equal(proxima('0.2.7', 'menor'), '0.3.0');
  assert.equal(proxima('0.2.7', 'maior'), '1.0.0');
  assert.equal(proxima('0.2.7', 'patch'), '0.2.8');
  assert.equal(proxima('0.2.0', '1.0.0-beta.1'), '1.0.0-beta.1');
  assert.equal(proxima('1.0.0-beta.1', 'correcao'), '1.0.1');
  assert.throws(() => proxima('0.2.0', 'gigante'), /não entendi/);
  assert.throws(() => proxima('0.2.0', '1.2'), /não entendi/);
});

test('comparar versões: números, não texto, e pré-lançamento antes da versão cheia', () => {
  assert.ok(comparar('0.9.0', '0.10.0') < 0);
  assert.ok(comparar('1.0.0', '0.99.99') > 0);
  assert.equal(comparar('0.2.0', '0.2.0'), 0);
  assert.ok(comparar('1.0.0-beta.1', '1.0.0') < 0);
  assert.ok(comparar('1.0.0-beta.2', '1.0.0-beta.10') < 0);
  assert.equal(preLancamento('1.0.0-beta.1'), true);
  assert.equal(preLancamento('1.0.0'), false);
});

test('notas de uma versão saem do CHANGELOG, só a seção dela', () => {
  assert.deepEqual(secoes(EXEMPLO).map((s) => s.versao), [null, '0.2.0', '0.1.6', '0.1.0']);
  assert.equal(notasDa(EXEMPLO, '0.2.0'), '### Novo\n\n- Aplicativo de mesa.');
  assert.equal(notasDa(EXEMPLO, '0.1.0'), 'Primeira versão.');
  assert.equal(notasDa(EXEMPLO.replace(/\n/g, '\r\n'), '0.1.6'), '- Rodada de testes.', 'quebra de linha do Windows não atrapalha');
  assert.throws(() => notasDa(EXEMPLO, '9.9.9'), /não tem a seção/);
  assert.throws(() => notasDa('## 1.0.0\n\n## 0.9.0\n\n- x\n', '1.0.0'), /está vazia/);
});

test('ordem do CHANGELOG: mais nova primeiro, sem repetir', () => {
  assert.deepEqual(problemasDeOrdem(EXEMPLO), []);
  assert.match(problemasDeOrdem('## 0.1.0\n\n- a\n\n## 0.2.0\n\n- b\n')[0], /0\.2\.0 está depois de 0\.1\.0/);
  assert.match(problemasDeOrdem('## 0.2.0\n\n- a\n\n## 0.2.0\n\n- b\n')[0], /duas vezes/);
});

test('"Em andamento" vira a versão, com data e mantendo o resumo', () => {
  const novo = fecharEmAndamento(EXEMPLO, '0.3.0', '01/12/2026');
  assert.match(novo, /^## 0\.3\.0 \(01\/12\/2026\): coisa nova$/m);
  assert.equal(notasDa(novo, '0.3.0'), '- Item em andamento.');
  assert.deepEqual(problemasDeOrdem(novo), []);
  assert.equal(fecharEmAndamento('## 0.1.0\n\n- a\n', '0.2.0', '01/12/2026'), null, 'sem a seção, nada a fechar');
  assert.equal(dataDeHoje(new Date(2026, 0, 5)), '05/01/2026');
});

test('o repositório está coerente: versão do package.json tem notas, o lock bate e o CHANGELOG está em ordem', () => {
  const versao = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).version;
  const changelog = fs.readFileSync(path.join(RAIZ, 'CHANGELOG.md'), 'utf8');
  assert.ok(notasDa(changelog, versao).length > 0);
  assert.deepEqual(problemasDeOrdem(changelog), []);
  assert.equal(JSON.parse(fs.readFileSync(path.join(RAIZ, 'package-lock.json'), 'utf8')).version, versao);
  assert.ok(fs.readFileSync(path.join(RAIZ, 'README.md'), 'utf8').includes(`vers%C3%A3o-${versao.replace(/-/g, '--')}-`), 'o selo do README mostra a versão atual');
});
