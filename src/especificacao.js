// Especificação em etapas: um trabalho grande demais para um pedido só. Quem usa escreve o objetivo, os requisitos
// e como saber que ficou pronto; quem lidera o time quebra isso em etapas; cada etapa roda como um pedido normal
// (plano, execução, testes, revisão). O progresso fica gravado: se a Muvuca fechar no meio, a especificação
// reaparece pausada e continua da etapa em que parou.
//
// As mudanças de todas as etapas se acumulam sob o mesmo ponto de restauração, então no fim continua valendo
// "manter ou descartar" para o trabalho inteiro.
import { chamar } from './provedores.js';
import { extrairJson } from './orquestrador.js';

export const MAX_ETAPAS = 12;
export const MAX_TENTATIVAS = 2;   // cada etapa é tentada no máximo duas vezes antes de a especificação pausar
const linha = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export const SISTEMA_DO_PLANEJADOR = `PLANEJADOR DE ESPECIFICAÇÃO.
Você recebe a especificação de um trabalho de software e a quebra em etapas pequenas, em ordem, que um time vai executar uma de cada vez.
Regras:
- De 2 a ${MAX_ETAPAS} etapas. Cada etapa deixa o projeto funcionando e com os testes passando.
- Cada etapa depende só das anteriores.
- "aceite" diz como conferir que a etapa ficou pronta (um teste que passa, um arquivo que existe, um comportamento observável).
- Não escreva código. Não invente requisito que a especificação não pede.
Responda SOMENTE com JSON neste formato:
{"etapas":[{"titulo":"frase curta","tarefa":"o que fazer nesta etapa, com detalhe suficiente para executar","aceite":"como conferir"}]}`;

// Limpa e valida o plano devolvido pelo modelo. Lança erro se não houver etapas aproveitáveis.
export function normalizarPlano(j) {
  const brutas = Array.isArray(j?.etapas) ? j.etapas : [];
  const etapas = brutas.map((e) => ({ titulo: linha(e?.titulo, 100), tarefa: String(e?.tarefa ?? '').trim().slice(0, 1500), aceite: linha(e?.aceite, 300) }))
    .filter((e) => e.tarefa).map((e, i) => ({ ...e, titulo: e.titulo || `Etapa ${i + 1}` })).slice(0, MAX_ETAPAS);
  if (!etapas.length) throw new Error('o plano veio sem etapas');
  return etapas.map((e) => ({ ...e, estado: 'pendente', tentativas: 0, resumo: '' }));
}

// O pedido que o time recebe em cada etapa: a etapa, o que já foi feito, o que fica para depois e a especificação inteira.
export function textoDaEtapa(run, i) {
  const e = run.etapas[i], n = run.etapas.length;
  const feitas = run.etapas.slice(0, i).filter((x) => x.estado === 'pronta').map((x, k) => `${k + 1}. ${x.titulo}${x.resumo ? ` (${x.resumo})` : ''}`);
  const depois = run.etapas.slice(i + 1).map((x) => x.titulo);
  return [
    `Etapa ${i + 1} de ${n} de uma especificação: ${e.titulo}`, '',
    `Faça só esta etapa:\n${e.tarefa}`,
    ...(e.aceite ? [`Como conferir que ficou pronta: ${e.aceite}`] : []),
    ...(e.tentativas > 1 && e.resumo ? ['', `Esta etapa já foi tentada e não passou: ${e.resumo}. Corrija isso.`] : []),
    '',
    feitas.length ? `Etapas já concluídas (não refaça):\n${feitas.join('\n')}` : 'Esta é a primeira etapa.',
    ...(depois.length ? [`Etapas que ficam para depois (não adiante): ${depois.join('; ')}`] : []),
    '', 'Especificação completa, para contexto:', String(run.especificacao).slice(0, 6000),
  ].join('\n');
}

// O que a tela e o histórico precisam saber da especificação.
export function resumoDaEspecificacao(run) {
  if (!run) return null;
  const { id, titulo, projeto, estado, motivo, criada } = run;
  return { id, titulo, projeto, estado, motivo: motivo || '', criada, atual: run.etapas.findIndex((e) => !['pronta', 'pulada'].includes(e.estado)),
    etapas: run.etapas.map(({ titulo: t, estado: s, tentativas, resumo, aceite }) => ({ titulo: t, estado: s, tentativas, resumo, aceite })) };
}

// Pede o plano a quem lidera o time (ou ao primeiro agente, em times sem líder).
export async function planejar(muvuca, especificacao, projeto) {
  const lider = muvuca.agente(muvuca.idLider);
  const prov = muvuca.provedor(lider, 'alta');
  const r = await chamar(prov, { sistema: SISTEMA_DO_PLANEJADOR, mensagens: [{ role: 'user', content: `ESPECIFICAÇÃO:\n${String(especificacao).slice(0, 12000)}` }], ferramentas: [], sinal: AbortSignal.timeout(180000), cwd: projeto, agente: lider });
  muvuca.somarUso?.(r);
  return normalizarPlano(extrairJson(r.texto));
}

// Toca a especificação: uma etapa por vez, até acabar, pausar ou ser cancelada. Cada mudança de estado é gravada
// (aoMudar) antes de seguir, para a retomada saber onde parou.
export async function tocar(run, { muvuca, comandoTeste, aoMudar }) {
  const mudou = async () => { await aoMudar?.(run); };
  const pausar = async (motivo) => { run.estado = 'pausada'; run.motivo = motivo; await mudou(); };
  run.estado = 'rodando'; run.motivo = ''; run.parar = false;
  await mudou();
  for (;;) {
    const i = run.etapas.findIndex((e) => !['pronta', 'pulada'].includes(e.estado));
    if (i < 0) { run.estado = 'concluida'; run.motivo = ''; await mudou(); return run; }
    if (run.parar) return pausar('pausada por você');
    const e = run.etapas[i];
    if (e.tentativas >= MAX_TENTATIVAS) return pausar(`a etapa "${e.titulo}" não passou em ${MAX_TENTATIVAS} tentativas${e.resumo ? `: ${e.resumo}` : ''}`);
    e.estado = 'rodando'; e.tentativas++; await mudou();
    const desde = muvuca.eventos.length;
    try { await muvuca.pedido({ texto: textoDaEtapa(run, i), projeto: run.projeto, comandoTeste }); }
    catch (erro) { e.estado = 'falhou'; e.resumo = linha(erro.message, 200); return pausar(`não deu para começar a etapa "${e.titulo}": ${e.resumo}`); }
    if (run.estado === 'cancelada') return run;
    const fim = [...muvuca.eventos.slice(desde)].reverse().find((x) => ['final', 'parado', 'erro'].includes(x.tipo));
    if (fim?.tipo === 'parado') { e.estado = 'pendente'; e.tentativas--; return pausar('pausada por você'); }
    if (fim?.tipo === 'erro') { e.estado = 'falhou'; e.resumo = linha(fim.texto, 200); return pausar(`a etapa "${e.titulo}" parou com erro: ${e.resumo}`); }
    if (fim?.tipo === 'final' && fim.aprovado === true) {
      const arquivos = [...new Set(muvuca.eventos.slice(desde).filter((x) => x.tipo === 'concluiu').flatMap((x) => x.arquivos || []))];
      e.estado = 'pronta'; e.resumo = arquivos.length ? `mexeu em ${arquivos.slice(0, 6).join(', ')}${arquivos.length > 6 ? ' e outros' : ''}` : 'aprovada';
      await mudou();
      continue;
    }
    // não aprovada, ou o líder não montou plano: fica marcada e a volta seguinte decide se tenta de novo ou pausa
    e.estado = 'falhou';
    e.resumo = fim?.conversa ? 'o líder não montou um plano para esta etapa' : linha(fim?.motivo || 'não foi aprovada', 200);
    await mudou();
  }
}
