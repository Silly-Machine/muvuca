// Rotinas, quadro de tarefas e memória por agente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Muvuca, chaveMemoria } from '../orquestrador.js';
import { criarMemoria, MAX_NOTAS } from '../memoria.js';
import { normalizarRotinas, devidas, quando } from '../rotinas.js';

const cfg = JSON.parse(await fs.readFile(new URL('../agentes.json', import.meta.url), 'utf8'));
const pastaNova = (p = 'muvuca-gb-') => fs.mkdtemp(path.join(os.tmpdir(), p));
const PEDIDO = 'Crie uma página de status com um endpoint /health';

test('rotinas: valida, e só dispara no dia certo, dentro da janela e uma vez por dia', () => {
  const [r] = normalizarRotinas([{ nome: 'Revisão', texto: 'Revise o projeto', hora: '09:00', dias: [1, 3, 3, '5'] }]);
  assert.deepEqual(r.dias, [1, 3, 5]);
  assert.equal(r.ativa, true);
  assert.equal(quando(r), 'seg, qua, sex às 09:00');
  const seg = (h, m) => new Date(2026, 10, 23, h, m);   // 23/11/2026 é segunda-feira
  assert.equal(seg(9, 0).getDay(), 1);
  assert.equal(devidas([r], seg(8, 59)).length, 0, 'antes da hora');
  assert.equal(devidas([r], seg(9, 0)).length, 1, 'na hora');
  assert.equal(devidas([r], seg(9, 9)).length, 1, 'dentro da janela');
  assert.equal(devidas([r], seg(9, 10)).length, 0, 'depois da janela: não dispara de surpresa');
  assert.equal(devidas([r], new Date(2026, 10, 24, 9, 0)).length, 0, 'terça não está nos dias');
  assert.equal(devidas([{ ...r, ultima: seg(9, 1).toISOString() }], seg(9, 5)).length, 0, 'já rodou hoje');
  assert.equal(devidas([{ ...r, ativa: false }], seg(9, 0)).length, 0, 'pausada');
  assert.throws(() => normalizarRotinas([{ texto: 'x', hora: '25:00', dias: [1] }]), /hora inválida/);
  assert.throws(() => normalizarRotinas([{ texto: 'x', hora: '09:00', dias: [] }]), /pelo menos um dia/);
  assert.throws(() => normalizarRotinas([{ hora: '09:00', dias: [1] }]), /falta o pedido/);
  // a tela não consegue mexer na "última vez": ela vem do que o servidor já tinha
  const [d] = normalizarRotinas([{ ...r, ultima: 'forjado', resultado: 'forjado' }], [{ ...r, ultima: '2026-11-23T12:00:00.000Z', resultado: 'aprovada' }]);
  assert.deepEqual([d.ultima, d.resultado], ['2026-11-23T12:00:00.000Z', 'aprovada']);
});

test('memória: anota sem repetir, limita o tamanho e separa por projeto e por agente', async () => {
  const m = criarMemoria(await pastaNova('muvuca-mem-'));
  const a = path.resolve('/proj/a'), b = path.resolve('/proj/b');
  assert.equal(await m.anotar(a, 'chevron', '  Testes com node:test  '), true);
  assert.equal(await m.anotar(a, 'chevron', 'testes com NODE:TEST'), false, 'mesma nota, outra caixa');
  assert.equal(await m.anotar(a, 'chevron', '   '), false);
  assert.deepEqual(await m.ler(a, 'chevron'), ['Testes com node:test']);
  assert.deepEqual(await m.ler(b, 'chevron'), [], 'outro projeto');
  assert.deepEqual(await m.ler(a, 'pixel'), [], 'outro agente');
  for (let i = 0; i < MAX_NOTAS + 5; i++) await m.anotar(a, 'pixel', `nota ${i}`);
  const notas = await m.ler(a, 'pixel');
  assert.equal(notas.length, MAX_NOTAS);
  assert.equal(notas.at(-1), `nota ${MAX_NOTAS + 4}`, 'ficam as mais recentes');
  assert.deepEqual(await m.gravar(a, 'pixel', []), []);
  assert.deepEqual(await m.ler(a, 'pixel'), []);
  await assert.rejects(m.anotar(a, '../fora', 'x'), /id de agente inválido/);
});

test('quadro: cada etapa vira cartão, passa pelos estados e fecha com o resultado', async () => {
  const projeto = await pastaNova();
  const e = new Muvuca(structuredClone(cfg));
  await e.pedido({ texto: PEDIDO, projeto });
  const tarefas = e.eventos.filter((x) => x.tipo === 'tarefa');
  const historia = (id) => tarefas.filter((t) => t.id === id).map((t) => t.estado);
  // t1 e t2 são as etapas do plano (Chevron e Pixel): nascem "a fazer" antes de alguém começar
  assert.deepEqual([tarefas[0].estado, tarefas[1].estado], ['afazer', 'afazer']);
  assert.deepEqual(historia('t1'), ['afazer', 'trabalhando', 'revisao', 'pronto']);
  assert.equal(tarefas.find((t) => t.id === 't1').agente, 'chevron');
  assert.ok(tarefas.find((t) => t.id === 't1' && t.estado === 'revisao').arquivos > 0, 'conta os arquivos mexidos');
  const finais = [...e.quadro.values()];
  assert.ok(finais.some((t) => /^Correção:/.test(t.titulo)), 'a devolução do revisor vira um cartão de correção');
  assert.ok(finais.some((t) => t.titulo === 'Revisão das mudanças' && t.estado === 'falhou'), 'a revisão reprovada aparece');
  assert.ok(finais.some((t) => t.titulo === 'Revisão das mudanças' && t.estado === 'pronto'), 'e a aprovada também');
  assert.ok(finais.every((t) => ['pronto', 'falhou'].includes(t.estado)), 'nada fica pendurado no fim');
  await e.decidir('descartar');
});

test('quadro: pedido interrompido marca as tarefas como paradas', async () => {
  const projeto = await pastaNova();
  const e = new Muvuca(structuredClone(cfg));
  e.ouvintes.add((ev) => { if (ev.tipo === 'tarefa' && ev.estado === 'trabalhando') e.parar(); });
  await e.pedido({ texto: PEDIDO, projeto });
  assert.ok(e.eventos.some((x) => x.tipo === 'parado'));
  assert.ok([...e.quadro.values()].every((t) => ['pronto', 'falhou', 'parado'].includes(t.estado)));
  assert.ok([...e.quadro.values()].some((t) => t.estado === 'parado'));
  if (e.foto) await e.decidir('descartar');
});

test('memória no fluxo: o que o revisor reprovou vira nota e volta no pedido seguinte', async () => {
  const projeto = await pastaNova();
  const e = new Muvuca(structuredClone(cfg));
  e.memoria = criarMemoria(await pastaNova('muvuca-mem-'));
  await e.pedido({ texto: PEDIDO, projeto });
  const anotou = e.eventos.filter((x) => x.tipo === 'memoria');
  assert.equal(anotou.length, 1);
  assert.equal(anotou[0].agente, 'chevron');
  assert.match(anotou[0].nota, /O revisor já reprovou \(src\/health\.js\)/);
  assert.equal((await e.memoria.ler(chaveMemoria(projeto, true), 'chevron')).length, 1);
  assert.deepEqual(await e.memoria.ler(projeto, 'chevron'), [], 'nota da demonstração não entra na memória do trabalho real');
  await e.decidir('descartar');
  // segundo pedido: a mesma reprovação não duplica a nota
  await e.pedido({ texto: PEDIDO, projeto });
  assert.equal((await e.memoria.ler(chaveMemoria(projeto, true), 'chevron')).length, 1);
  await e.decidir('descartar');
});

test('trocar o provedor do time: todos mudam, modelos por nível valem, e modelo fixo de outro provedor sai', async () => {
  const c = structuredClone(cfg);
  c.provedores.outro = { tipo: 'demo', modelo: 'padrao' };
  c.agentes.find((a) => a.id === 'scout').modelo = 'fixo-do-antigo';
  const e = new Muvuca(c);
  e.usarProvedor('outro', { baixa: ' leve ', alta: 'forte', media: '' });
  assert.ok(e.cfg.agentes.every((a) => a.provedor === 'outro'));
  assert.equal(e.agente('scout').modelo, undefined, 'o modelo fixo era do provedor antigo');
  assert.equal(e.provedor(e.agente('chevron'), 'baixa').modelo, 'leve');
  assert.equal(e.provedor(e.agente('chevron'), 'alta').modelo, 'forte');
  assert.equal(e.provedor(e.agente('chevron'), 'media').modelo, 'padrao', 'nível em branco cai no padrão do provedor');
  assert.equal(e.eventos.at(-1).tipo, 'provedor');
  assert.throws(() => e.usarProvedor('nao-existe'), /não existe/);
  // o time continua funcionando no provedor novo
  await e.pedido({ texto: PEDIDO, projeto: await pastaNova() });
  assert.equal(e.eventos.find((x) => x.tipo === 'final').aprovado, true);
  await e.decidir('descartar');
});

test('modelo padrão por papel, e a escolha por agente vence o padrão', async () => {
  const { nivelPadrao, nivelFixo } = await import('../orquestrador.js');
  assert.equal(nivelPadrao({ funcao: 'lider' }), 'media');
  assert.equal(nivelPadrao({ funcao: 'sublider' }), 'media');
  assert.equal(nivelPadrao({ funcao: 'revisor', ferramentas: ['listar', 'ler'] }), 'alta');
  assert.equal(nivelPadrao({ ferramentas: ['listar', 'ler'] }), 'baixa', 'quem só consulta');
  assert.equal(nivelPadrao({ ferramentas: ['listar', 'ler', 'escrever'] }), null, 'quem escreve: o líder classifica');
  assert.equal(nivelFixo({ funcao: 'revisor', complexidade: 'auto' }), null);
  assert.equal(nivelFixo({ funcao: 'revisor', complexidade: 'baixa' }), 'baixa');

  const e = new Muvuca(structuredClone(cfg));
  e.definirNivel('chevron', 'alta');     // executor fixado no modelo forte
  e.definirNivel('revisor', 'baixa');    // revisor no modelo leve
  assert.throws(() => e.definirNivel('fantasma', 'alta'), /não existe/);
  assert.throws(() => e.definirNivel('pixel', 'enorme'), /nível desconhecido/);
  await e.pedido({ texto: PEDIDO, projeto: await pastaNova() });
  const plano = e.eventos.find((x) => x.tipo === 'plano');
  assert.deepEqual(plano.etapas.map((s) => [s.agente, s.complexidade]), [['chevron', 'alta'], ['pixel', 'baixa']], 'a escolha no agente vence a classificação do líder');
  const revisoes = e.eventos.filter((x) => x.tipo === 'concluiu' && x.agente === 'revisor').map((x) => [x.complexidade, x.modelo]);
  assert.ok(revisoes.length && revisoes.every(([c, m]) => c === 'baixa' && m === 'haiku (simulado)'));
  await e.decidir('descartar');
  e.definirNivel('chevron', '');         // volta ao padrão do papel
  assert.equal(e.agente('chevron').complexidade, undefined);
});

test('Buzina sem rede: acha o tema certo do guia, com ou sem acento, e admite quando não sabe', async () => {
  const { responderOffline, GUIA, sistemaBuzina } = await import('../buzina.js');
  const tema = (p) => responderOffline(p).titulo;
  assert.equal(tema('Como começo a usar?'), 'Como começar');
  assert.equal(tema('o que sao rotinas'), 'Rotinas');
  assert.equal(tema('Como uso IA de verdade? Quero o Claude'), 'Modelos e provedores');
  assert.equal(tema('como monto um time novo no construtor'), 'Montar um time');
  assert.equal(tema('posso descartar os arquivos alterados?'), 'Manter ou descartar mudanças');
  assert.equal(tema('para que serve o quadro de tarefas'), 'Quadro de tarefas');
  assert.equal(tema('os agentes tem memória?'), 'Memória dos agentes');
  assert.equal(tema('quem é você, Buzina?'), 'Quem é a Buzina');
  // as perguntas que a própria Buzina sugere têm que ter resposta
  const { SUGESTOES } = await import('../buzina.js');
  for (const p of SUGESTOES) assert.notEqual(tema(p), null, `sem resposta para a sugestão "${p}"`);
  assert.equal(tema('Como monto um time?'), 'Montar um time');
  assert.equal(tema('como o time testa o código?'), 'Testes e revisão');
  const nada = responderOffline('qual a capital da França?');
  assert.equal(nada.titulo, null);
  assert.match(nada.texto, /não sei responder/);
  assert.ok(GUIA.every((t) => t.resposta.length > 80 && t.chaves.length));
  assert.match(sistemaBuzina('# Guia'), /SOMENTE dúvidas sobre como usar/);
});

test('memória com um provedor de verdade (CLI falso): o agente anota com LEMBRAR e recebe a nota no pedido seguinte', async () => {
  const { fileURLToPath } = await import('node:url');
  const c = structuredClone(cfg);
  c.provedores.cli = { tipo: 'cli', comando: process.execPath, args: [fileURLToPath(new URL('../apoio/falso-cli-memoria.js', import.meta.url))] };
  c.agentes.find((a) => a.id === 'chevron').provedor = 'cli';
  const projeto = await pastaNova();
  const e = new Muvuca(c);
  e.memoria = criarMemoria(await pastaNova('muvuca-mem-'));
  await e.pedido({ texto: 'Arrume o projeto', projeto, para: 'chevron' });
  assert.equal(await fs.readFile(path.join(projeto, 'visto.txt'), 'utf8'), 'sem notas', 'na primeira vez não há nota para entregar');
  assert.deepEqual(e.eventos.filter((x) => x.tipo === 'memoria').map((x) => [x.agente, x.nota]), [['chevron', 'neste projeto os testes rodam com node --test']]);
  assert.equal(e.eventos.find((x) => x.tipo === 'fala').texto, 'Feito. Primeira vez aqui.', 'a linha LEMBRAR sai do texto mostrado');
  await e.decidir('aceitar');
  await e.pedido({ texto: 'Arrume de novo', projeto, para: 'chevron' });
  assert.equal(await fs.readFile(path.join(projeto, 'visto.txt'), 'utf8'), '- neste projeto os testes rodam com node --test', 'a nota chega no prompt do pedido seguinte');
  assert.equal((await e.memoria.ler(projeto, 'chevron')).length, 1, 'a mesma nota não entra duas vezes');
  if (e.foto) await e.decidir('aceitar');
});
