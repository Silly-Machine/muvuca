// Três ideias trazidas do Kiro Crew: lições do time, vigias e especificação em etapas com retomada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizarRotinas, devidas, vigiasDevidos, avaliarVigia, pedidoDoVigia, quando } from '../src/rotinas.js';
import { normalizarPlano, textoDaEtapa, resumoDaEspecificacao, tocar, MAX_TENTATIVAS, SISTEMA_DO_PLANEJADOR } from '../src/especificacao.js';
import { criarMemoria } from '../src/memoria.js';
import { Muvuca } from '../src/orquestrador.js';
import { subir } from './apoio/servidor-de-teste.js';

process.env.DEMO_ATRASO = '0';
const cfg = JSON.parse(await fs.readFile(new URL('../config/agentes.json', import.meta.url), 'utf8'));
const CLI_MEMORIA = fileURLToPath(new URL('./apoio/falso-cli-mcp.js', import.meta.url));
const pasta = (p) => fs.mkdtemp(path.join(os.tmpdir(), p));
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const PEDIDO = 'Crie uma página de status com um endpoint /health';

// ---------- lições do time

test('lições do time: descartar dizendo o motivo ensina o time, e a lição entra como regra para todos, inclusive quem planeja', async () => {
  const c = structuredClone(cfg);
  c.provedores.cli = { tipo: 'cli', comando: process.execPath, args: [CLI_MEMORIA], argsLeitura: [CLI_MEMORIA] };
  const e = new Muvuca(c);
  e.memoria = criarMemoria(await pasta('muvuca-mem-'));
  const projeto = await pasta('muvuca-');
  await e.pedido({ texto: PEDIDO, projeto });
  assert.ok(e.foto, 'há mudanças esperando decisão');
  await e.decidir('descartar', '  não use   banco de dados; guarde em arquivo JSON  ');
  const licao = e.eventos.find((x) => x.tipo === 'licao');
  assert.equal(licao?.nota, 'Uma entrega foi descartada por este motivo: não use banco de dados; guarde em arquivo JSON');
  assert.deepEqual(await e.memoria.ler(e.pastaLicoes(), 'time'), [licao.nota]);
  assert.match(await e.textoDasLicoes(), /Valem como regra: siga sempre\.\n- Uma entrega foi descartada por este motivo: não use banco de dados/);

  // descartar sem motivo não cria lição; manter também não, mesmo com texto no motivo
  await e.pedido({ texto: PEDIDO, projeto }); await e.decidir('descartar');
  await e.pedido({ texto: PEDIDO, projeto }); await e.decidir('aceitar', 'motivo que não vale ao manter');
  assert.equal((await e.memoria.ler(e.pastaLicoes(), 'time')).length, 1);
  // a mesma lição não entra duas vezes, nem escrita com outra caixa e outros espaços
  assert.equal(await e.aprender('Os testes ficam em test/, com node:test'), true);
  assert.equal(await e.aprender('os testes ficam em test/,  com node:test'), false);
  assert.equal(e.eventos.filter((x) => x.tipo === 'licao').length, 2, 'duas lições novas, dois avisos; a repetida não gera um terceiro');
  const texto = await e.textoDasLicoes();
  assert.match(texto, /- Uma entrega foi descartada[^\n]*\n- Os testes ficam em test\//);
  // as lições são do projeto: em outra pasta, o time começa sem nenhuma
  e.projeto = await pasta('muvuca-outro-');
  assert.equal(await e.textoDasLicoes(), '');
});

test('lições do time: sem memória ligada ou sem projeto, nada quebra', async () => {
  const e = new Muvuca(structuredClone(cfg));
  assert.equal(await e.textoDasLicoes(), '');
  assert.equal(await e.aprender('x'), false);
});

// ---------- vigias

test('vigia: a forma da rotina, e o que muda quando o comando muda', () => {
  const base = { nome: 'Testes', tipo: 'vigia', texto: 'Conserte os testes', comando: 'node --test', intervaloMin: 5 };
  const [v] = normalizarRotinas([base]);
  assert.deepEqual([v.tipo, v.comando, v.intervaloMin, v.dispara, v.ativa], ['vigia', 'node --test', 5, 'falha', true]);
  assert.deepEqual(v.vigia, { verificada: null, ok: null, marca: null, resumo: '', pendente: '' });
  assert.equal(quando(v), 'a cada 5 min, quando o comando falhar');
  assert.throws(() => normalizarRotinas([{ ...base, comando: ' ' }]), /falta o comando/);
  assert.throws(() => normalizarRotinas([{ ...base, intervaloMin: 0 }]), /de 1 a 1440 minutos/);
  assert.throws(() => normalizarRotinas([{ ...base, intervaloMin: 'abc' }]), /de 1 a 1440 minutos/);
  assert.throws(() => normalizarRotinas([{ ...base, texto: '' }]), /falta o pedido/);
  // vigia não precisa de hora nem de dias; rotina de horário continua precisando
  assert.throws(() => normalizarRotinas([{ nome: 'x', texto: 'y' }]), /hora inválida/);
  // o estado do vigia é do servidor: a tela não escreve nele, e ele sobrevive a uma edição que não mexe no comando
  const comEstado = [{ ...v, vigia: { verificada: '2026-01-01T00:00:00.000Z', ok: false, marca: 'abc', resumo: 'falhou', pendente: '' } }];
  const renomeado = normalizarRotinas([{ ...v, nome: 'Outro nome', vigia: { ok: true } }], comEstado)[0];
  assert.deepEqual([renomeado.nome, renomeado.vigia.ok, renomeado.vigia.marca], ['Outro nome', false, 'abc']);
  const outroComando = normalizarRotinas([{ ...v, comando: 'npm test' }], comEstado)[0];
  assert.equal(outroComando.vigia.marca, null, 'comando novo: o que se sabia da última verificação deixa de valer');
  // vigia não entra na conta das rotinas de horário
  assert.deepEqual(devidas([v], new Date(2026, 0, 5, 9, 0)), []);
});

test('vigia: quando verificar e quando acordar o time', () => {
  const agora = new Date(2026, 0, 5, 12, 0, 0);
  const [v] = normalizarRotinas([{ nome: 'T', tipo: 'vigia', texto: 'Conserte', comando: 'node --test', intervaloMin: 10 }]);
  assert.deepEqual(vigiasDevidos([v], agora).length, 1, 'nunca verificado: está na hora');
  const ha = (min) => new Date(agora - min * 60000).toISOString();
  assert.equal(vigiasDevidos([{ ...v, vigia: { verificada: ha(9) } }], agora).length, 0);
  assert.equal(vigiasDevidos([{ ...v, vigia: { verificada: ha(10) } }], agora).length, 1);
  assert.equal(vigiasDevidos([{ ...v, ativa: false }], agora).length, 0, 'pausado não verifica');

  // condição "falha": acorda na passagem de bom para ruim, uma vez só
  const passo = (r, codigo, saida = 'x') => { const a = avaliarVigia(r, { codigo, saida }, agora); return [a.disparar, { ...r, vigia: a.vigia }]; };
  let d, r = v;
  [d, r] = passo(r, 0); assert.equal(d, false, 'passando: não acorda');
  [d, r] = passo(r, 1); assert.equal(d, true, 'começou a falhar: acorda');
  [d, r] = passo(r, 1); assert.equal(d, false, 'continua falhando: não acorda de novo');
  [d, r] = passo(r, 0); assert.equal(d, false, 'voltou a passar');
  [d, r] = passo(r, 2); assert.equal(d, true, 'falhou outra vez: acorda outra vez');
  assert.equal(passo(v, 1)[0], true, 'já falhando na primeira verificação: acorda');

  // condição "mudança": a primeira verificação só marca o ponto de partida
  let m = normalizarRotinas([{ nome: 'M', tipo: 'vigia', texto: 'Veja', comando: 'git status --short', intervaloMin: 1, dispara: 'mudanca' }])[0];
  [d, m] = passo(m, 0, 'a\nb'); assert.equal(d, false);
  [d, m] = passo(m, 0, 'a\r\nb  '); assert.equal(d, false, 'só quebra de linha e espaço no fim não contam como mudança');
  [d, m] = passo(m, 0, 'a\nb\nc'); assert.equal(d, true);
  [d, m] = passo(m, 0, 'a\nb\nc'); assert.equal(d, false);
  assert.equal(m.vigia.resumo, 'a / b / c');

  const pedido = pedidoDoVigia(v, 'linha 1\nERRO: teste x falhou');
  assert.match(pedido, /^Conserte\n\nEste pedido foi disparado por um vigia: o comando falhou\.\nComando: node --test\nSaída mais recente:\nlinha 1\nERRO: teste x falhou$/);
  assert.match(pedidoDoVigia(m, ''), /a saída do comando mudou[\s\S]*\(sem saída\)/);
});

test('servidor: o vigia roda o comando sem acordar o time, e acorda quando o comando passa a falhar', async () => {
  const dados = await pasta('muvuca-dados-'), projeto = await pasta('muvuca-vig-');
  await fs.writeFile(path.join(projeto, 'confere.js'), "process.exit(require('fs').existsSync('quebrado.txt') ? 1 : 0)");
  const s = await subir(dados, { DEMO_ATRASO: '0', MUVUCA_TIQUE_MS: '300' });
  const rotinas = async () => (await s.get('/api/rotinas')).rotinas;
  // o relógio do servidor também verifica: se a chamada cair no mesmo instante, ele responde 409 e o teste tenta de novo
  const verificar = async (id) => { for (let i = 0; i < 50; i++) { const r = await s.post('/api/rotinas/verificar', { id }); if (r.s !== 409) return r; await dormir(100); } throw new Error('o vigia não liberou'); };
  try {
    const cria = await s.post('/api/rotinas', { rotinas: [{ nome: 'Confere', tipo: 'vigia', texto: PEDIDO, projeto, comando: 'node confere.js', intervaloMin: 1 }] });
    assert.equal(cria.s, 200, JSON.stringify(cria.j));
    const id = cria.j.rotinas[0].id;
    // verificar à mão mostra o resultado e não manda pedido
    const v1 = await verificar(id);
    assert.deepEqual([v1.s, v1.j.ok, v1.j.dispararia], [200, true, false]);
    assert.equal((await s.get('/api/config')).rodando, false);
    assert.equal((await rotinas())[0].ultima, null, 'verificação que passa não conta como disparo');

    // o comando passa a falhar: a próxima verificação acorda o time, com a saída no pedido
    await fs.writeFile(path.join(projeto, 'quebrado.txt'), 'x');
    const v2 = await verificar(id);
    assert.deepEqual([v2.j.ok, v2.j.dispararia], [false, true]);
    let disparou = false; for (let i = 0; i < 80 && !disparou; i++) { await dormir(100); disparou = !!(await rotinas())[0].ultima; }
    assert.equal(disparou, true, 'o relógio pegou o disparo guardado e mandou o pedido');
    // espera o resultado ser gravado na rotina (ele é gravado depois de o pedido terminar)
    let r; for (let i = 0; i < 400; i++) { r = (await rotinas())[0]; if (r.resultado && r.resultado !== 'rodando') break; await dormir(100); }
    assert.equal(r.resultado, 'aprovada'); assert.equal(r.vigia.pendente, '');
    assert.equal(existsSync(path.join(projeto, 'src', 'health.js')), true, 'o time trabalhou na pasta do vigia');
    // continua falhando: verificar de novo não acorda outra vez
    assert.equal((await verificar(id)).j.dispararia, false);
    assert.equal((await s.post('/api/rotinas/verificar', { id: 'nao-existe' })).s, 404);
  } finally { await s.parar(); }
});

// ---------- especificação em etapas

test('especificação: o plano é limpo, e o pedido de cada etapa diz o que já foi feito e o que fica para depois', () => {
  const etapas = normalizarPlano({ etapas: [{ titulo: ' Base ', tarefa: 'Crie a rota', aceite: 'teste passa' }, { tarefa: 'Crie a página' }, { titulo: 'vazia', tarefa: '  ' }, 'lixo'] });
  assert.deepEqual(etapas.map((e) => [e.titulo, e.estado, e.tentativas]), [['Base', 'pendente', 0], ['Etapa 2', 'pendente', 0]]);
  assert.throws(() => normalizarPlano({ etapas: [] }), /sem etapas/);
  assert.throws(() => normalizarPlano(null), /sem etapas/);
  assert.equal(normalizarPlano({ etapas: Array.from({ length: 30 }, (_, i) => ({ tarefa: `t${i}` })) }).length, 12, 'no máximo 12 etapas');
  assert.match(SISTEMA_DO_PLANEJADOR, /^PLANEJADOR DE ESPECIFICAÇÃO/);

  const run = { especificacao: '# Loja\n- carrinho\n- pagamento', etapas: [{ ...etapas[0], estado: 'pronta', resumo: 'mexeu em a.js' }, { ...etapas[1], titulo: 'Página', aceite: 'abre no navegador' }, { titulo: 'Docs', tarefa: 'Documente', estado: 'pendente', tentativas: 0, resumo: '' }] };
  const t = textoDaEtapa(run, 1);
  assert.match(t, /^Etapa 2 de 3 de uma especificação: Página\n/);
  assert.match(t, /Faça só esta etapa:\nCrie a página\nComo conferir que ficou pronta: abre no navegador/);
  assert.match(t, /Etapas já concluídas \(não refaça\):\n1\. Base \(mexeu em a\.js\)/);
  assert.match(t, /Etapas que ficam para depois \(não adiante\): Docs/);
  assert.match(t, /Especificação completa, para contexto:\n# Loja/);
  assert.match(textoDaEtapa(run, 0), /Esta é a primeira etapa\./);
  run.etapas[1].tentativas = 2; run.etapas[1].resumo = 'faltou o teste';
  assert.match(textoDaEtapa(run, 1), /já foi tentada e não passou: faltou o teste/);
  assert.equal(resumoDaEspecificacao(null), null);
  assert.equal(resumoDaEspecificacao({ ...run, id: 'x', titulo: 'Loja', estado: 'rodando' }).atual, 1);
});

test('especificação: toca etapa por etapa, tenta de novo a que não passa, e pausa em vez de insistir', async () => {
  // um "time" de mentira: cada pedido termina do jeito que o roteiro mandar
  const falso = (roteiro) => {
    const m = { eventos: [], pedidos: [] };
    m.pedido = async ({ texto }) => { m.pedidos.push(texto.split('\n')[0]); const fim = roteiro.shift(); if (fim instanceof Error) throw fim; m.eventos.push({ tipo: 'concluiu', arquivos: fim.arquivos || [] }, fim); };
    return m;
  };
  const etapas = () => normalizarPlano({ etapas: [{ titulo: 'A', tarefa: 'a' }, { titulo: 'B', tarefa: 'b' }, { titulo: 'C', tarefa: 'c' }] });
  const ok = (arquivos) => ({ tipo: 'final', aprovado: true, arquivos });
  const gravacoes = [];

  let run = { especificacao: 'spec', projeto: '/p', etapas: etapas() };
  let m = falso([ok(['a.js']), { tipo: 'final', aprovado: false, motivo: 'testes falharam' }, ok(['b.js', 'b.test.js']), ok([])]);
  await tocar(run, { muvuca: m, aoMudar: (r) => gravacoes.push(r.etapas.map((e) => e.estado).join()) });
  assert.equal(run.estado, 'concluida');
  assert.deepEqual(run.etapas.map((e) => [e.estado, e.tentativas, e.resumo]), [['pronta', 1, 'mexeu em a.js'], ['pronta', 2, 'mexeu em b.js, b.test.js'], ['pronta', 1, 'aprovada']]);
  assert.deepEqual(m.pedidos, ['Etapa 1 de 3 de uma especificação: A', 'Etapa 2 de 3 de uma especificação: B', 'Etapa 2 de 3 de uma especificação: B', 'Etapa 3 de 3 de uma especificação: C']);
  assert.ok(gravacoes.includes('pronta,rodando,pendente'), 'cada mudança de estado é gravada antes de seguir');

  // etapa que não passa nas duas tentativas: pausa, dizendo qual e por quê; nada das seguintes roda
  run = { especificacao: 'spec', projeto: '/p', etapas: etapas() };
  m = falso([ok(['a.js']), { tipo: 'final', aprovado: false, motivo: 'revisor reprovou' }, { tipo: 'final', aprovado: false, motivo: 'revisor reprovou de novo' }]);
  await tocar(run, { muvuca: m });
  assert.equal(run.estado, 'pausada');
  assert.match(run.motivo, new RegExp(`a etapa "B" não passou em ${MAX_TENTATIVAS} tentativas: revisor reprovou de novo`));
  assert.deepEqual(run.etapas.map((e) => e.estado), ['pronta', 'falhou', 'pendente']);
  assert.equal(m.pedidos.length, 3);

  // retomar zera as tentativas da etapa e continua de onde parou; pular segue para a próxima
  run.etapas[1].estado = 'pendente'; run.etapas[1].tentativas = 0;
  m = falso([ok(['b.js']), ok(['c.js'])]);
  await tocar(run, { muvuca: m });
  assert.deepEqual([run.estado, m.pedidos.map((p) => p.slice(6, 7)).join()], ['concluida', '2,3'], 'a etapa A não é refeita');

  // parada por quem usa: a etapa volta a ficar pendente, sem gastar tentativa
  run = { especificacao: 'spec', projeto: '/p', etapas: etapas() };
  await tocar(run, { muvuca: falso([{ tipo: 'parado' }]) });
  assert.deepEqual([run.estado, run.motivo, run.etapas[0].estado, run.etapas[0].tentativas], ['pausada', 'pausada por você', 'pendente', 0]);
  // erro do provedor e pedido que nem começa também pausam, com o motivo
  run = { especificacao: 'spec', projeto: '/p', etapas: etapas() };
  await tocar(run, { muvuca: falso([{ tipo: 'erro', texto: 'login vencido' }]) });
  assert.match(run.motivo, /a etapa "A" parou com erro: login vencido/);
  run = { especificacao: 'spec', projeto: '/p', etapas: etapas() };
  await tocar(run, { muvuca: falso([new Error('pasta em uso')]) });
  assert.match(run.motivo, /não deu para começar a etapa "A": pasta em uso/);
  // o líder que só conversa, sem montar plano, conta como etapa que não passou
  run = { especificacao: 'spec', projeto: '/p', etapas: etapas() };
  await tocar(run, { muvuca: falso([{ tipo: 'final', aprovado: null, conversa: true }, { tipo: 'final', aprovado: null, conversa: true }]) });
  assert.match(run.motivo, /o líder não montou um plano/);
});

test('servidor: a especificação é planejada, roda as etapas, pausa e é retomada depois de reiniciar', async () => {
  const dados = await pasta('muvuca-dados-'), projeto = await pasta('muvuca-esp-');
  const especificacao = '# Página de status\n\nObjetivo: saber se o serviço está no ar.\n\n- Crie a rota /health com teste\n- Crie a página que consulta a rota\n- Crie a documentação da rota';
  const espera = async (s, cond, voltas = 400) => { for (let i = 0; i < voltas; i++) { const e = (await s.get('/api/especificacao')).especificacao; if (cond(e)) return e; await dormir(100); } throw new Error('a especificação não chegou ao estado esperado: ' + JSON.stringify((await s.get('/api/especificacao')).especificacao)); };
  let s = await subir(dados, { DEMO_ATRASO: '60' });
  try {
    assert.equal((await s.get('/api/especificacao')).especificacao, null);
    assert.equal((await s.post('/api/especificacao', { texto: 'curta', projeto })).s, 400);
    assert.equal((await s.post('/api/especificacao', { texto: especificacao, projeto: path.join(projeto, 'nao-existe') })).s, 400);
    const inicio = await s.post('/api/especificacao', { texto: especificacao, projeto });
    assert.equal(inicio.s, 202, JSON.stringify(inicio.j));
    assert.deepEqual([inicio.j.especificacao.titulo, inicio.j.especificacao.estado], ['Página de status', 'planejando']);
    const rodando = await espera(s, (e) => e.estado === 'rodando' && e.etapas.length === 3);
    assert.deepEqual(rodando.etapas.map((e) => e.titulo), ['Crie a rota /health com teste', 'Crie a página que consulta a rota', 'Crie a documentação da rota']);
    assert.equal((await s.post('/api/especificacao', { texto: especificacao, projeto })).s, 409, 'uma especificação por conversa');
    // espera a primeira etapa terminar e pausa no meio da segunda
    await espera(s, (e) => e.etapas[0].estado === 'pronta' && e.etapas[1].estado === 'rodando');
    assert.equal((await s.post('/api/especificacao/acao', { acao: 'pausar' })).s, 200);
    const pausada = await espera(s, (e) => e.estado === 'pausada');
    assert.equal(pausada.motivo, 'pausada por você');
    assert.deepEqual(pausada.etapas.map((e) => e.estado), ['pronta', 'pendente', 'pendente']);
    assert.equal(pausada.atual, 1);
    assert.equal((await s.get('/api/config')).rodando, false);
    assert.equal(existsSync(path.join(dados, 'especificacoes', 'conversa-1.json')), true, 'o progresso está em disco');
  } finally { await s.parar(); }

  // a Muvuca fecha e abre: a especificação reaparece pausada, com a primeira etapa feita
  s = await subir(dados, { DEMO_ATRASO: '0' });
  try {
    const voltou = (await s.get('/api/especificacao')).especificacao;
    assert.deepEqual([voltou.estado, voltou.etapas.map((e) => e.estado).join()], ['pausada', 'pronta,pendente,pendente']);
    assert.equal((await s.post('/api/especificacao/acao', { acao: 'fechar' })).s, 400, 'não sai da tela sem terminar ou cancelar');
    assert.equal((await s.post('/api/especificacao/acao', { acao: 'retomar' })).s, 200);
    const fim = await espera(s, (e) => e.estado === 'concluida');
    assert.deepEqual(fim.etapas.map((e) => e.estado), ['pronta', 'pronta', 'pronta']);
    assert.equal(fim.atual, -1);
    // as mudanças de todas as etapas ficam sob uma decisão só
    assert.equal(existsSync(path.join(projeto, 'src', 'health.js')), true);
    assert.equal((await s.get('/api/sessoes')).conversas[0].pendente, true);
    assert.equal((await s.post('/api/decidir', { acao: 'descartar' })).s, 200);
    assert.deepEqual(await fs.readdir(projeto), [], 'descartar desfaz o trabalho de todas as etapas');
    assert.equal((await s.post('/api/especificacao/acao', { acao: 'retomar' })).s, 400);
    assert.equal((await s.post('/api/especificacao/acao', { acao: 'fechar' })).s, 200);
    assert.equal((await s.get('/api/especificacao')).especificacao, null);
    assert.equal(existsSync(path.join(dados, 'especificacoes', 'conversa-1.json')), false);

    // cancelar no meio para o trabalho e libera a conversa
    await s.post('/api/especificacao', { texto: especificacao, projeto });
    await espera(s, (e) => e.etapas.length === 3);
    assert.equal((await s.post('/api/especificacao/acao', { acao: 'cancelar' })).s, 200);
    const cancelada = await espera(s, (e) => e.estado === 'cancelada');
    assert.equal(cancelada.motivo, 'cancelada por você');
    for (let i = 0; i < 100 && (await s.get('/api/config')).rodando; i++) await dormir(100);
    assert.equal((await s.get('/api/config')).rodando, false);
    assert.equal((await s.post('/api/especificacao/acao', { acao: 'explodir' })).s, 400);
    assert.equal((await s.cru('/api/especificacao')).status, 401);
  } finally { await s.parar(); }
});
