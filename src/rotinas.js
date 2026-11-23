// Rotinas: pedidos que o time recebe sozinho. Há dois tipos:
//   horário  dispara em dias e hora marcados;
//   vigia    roda um comando de tempos em tempos, sem gastar modelo, e só acorda o time quando algo muda
//            (o comando passa a falhar, ou a saída dele muda).
// O servidor confere o relógio e roda os comandos; aqui ficam só as regras, para poderem ser testadas.
import crypto from 'node:crypto';

const texto = (v, max) => String(v ?? '').trim().slice(0, max);
export const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const DISPAROS = { falha: 'quando o comando falhar', mudanca: 'quando a saída do comando mudar' };

export function normalizarRotinas(lista, anteriores = []) {
  if (!Array.isArray(lista)) throw new Error('lista de rotinas inválida');
  if (lista.length > 30) throw new Error('no máximo 30 rotinas');
  const antes = new Map(anteriores.map((r) => [r.id, r]));
  const ids = new Set();
  return lista.map((r, i) => {
    const nome = texto(r?.nome, 50) || `Rotina ${i + 1}`;
    const pedido = texto(r?.texto, 2000);
    if (!pedido) throw new Error(`${nome}: falta o pedido para o time`);
    const tipo = r?.tipo === 'vigia' ? 'vigia' : 'horario';
    let id = texto(r?.id, 24); if (!/^[a-z0-9-]+$/.test(id) || ids.has(id)) id = 'r' + Date.now().toString(36) + i;
    ids.add(id);
    // "última vez", resultado e o estado do vigia são do servidor: a tela não escreve neles
    const a = antes.get(id);
    const comum = { id, nome, tipo, texto: pedido, projeto: texto(r?.projeto, 400), ativa: r?.ativa !== false, ultima: a?.ultima || null, resultado: a?.resultado || '' };
    if (tipo === 'vigia') {
      const comando = texto(r?.comando, 300);
      if (!comando) throw new Error(`${nome}: falta o comando que o vigia roda`);
      const intervalo = Math.round(Number(r?.intervaloMin));
      if (!Number.isFinite(intervalo) || intervalo < 1 || intervalo > 1440) throw new Error(`${nome}: o intervalo do vigia vai de 1 a 1440 minutos`);
      const dispara = r?.dispara === 'mudanca' ? 'mudanca' : 'falha';
      // mudou o comando ou a condição: o que o vigia sabia sobre a última verificação deixa de valer
      const mesmo = a?.tipo === 'vigia' && a.comando === comando && a.dispara === dispara;
      return { ...comum, comando, intervaloMin: intervalo, dispara, vigia: mesmo && a.vigia ? a.vigia : { verificada: null, ok: null, marca: null, resumo: '', pendente: '' } };
    }
    const hora = texto(r?.hora, 5);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) throw new Error(`${nome}: hora inválida (use HH:MM, de 00:00 a 23:59)`);
    const dias = [...new Set((Array.isArray(r?.dias) ? r.dias : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
    if (!dias.length) throw new Error(`${nome}: escolha pelo menos um dia da semana`);
    return { ...comum, hora, dias };
  });
}

const mesmoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Rotinas de horário na hora: ativas, no dia certo, dentro da janela depois do horário, e que ainda não rodaram hoje.
// A janela evita disparar de surpresa uma rotina das 9h quando o servidor só sobe às 15h.
export function devidas(rotinas, agora = new Date(), janelaMin = 10) {
  const minutos = agora.getHours() * 60 + agora.getMinutes();
  return rotinas.filter((r) => {
    if (r.tipo === 'vigia' || !r.ativa || !r.dias.includes(agora.getDay())) return false;
    const [h, m] = r.hora.split(':').map(Number);
    const atraso = minutos - (h * 60 + m);
    if (atraso < 0 || atraso >= janelaMin) return false;
    return !(r.ultima && mesmoDia(new Date(r.ultima), agora));
  });
}

// Vigias que estão na hora de verificar: ativos e com o intervalo vencido desde a última verificação.
export function vigiasDevidos(rotinas, agora = new Date()) {
  return rotinas.filter((r) => r.tipo === 'vigia' && r.ativa && (!r.vigia?.verificada || agora - new Date(r.vigia.verificada) >= r.intervaloMin * 60000));
}

// Tempos de execução ("(0.52ms)", "duration_ms 90.6", "in 1.2s") mudam a cada rodada sem que nada tenha mudado:
// ficam fora da marca, senão um vigia de "mudança" sobre um comando de teste acordaria o time em toda verificação.
const semTempos = (saida) => String(saida).replace(/\r\n/g, '\n').replace(/\bduration_ms\s+[\d.]+/g, 'duration_ms').replace(/\b\d+(?:[.,]\d+)?\s?(?:ms|s|seg|segundos?)\b/g, '~').trim();
const marcaDe = (saida) => crypto.createHash('sha1').update(semTempos(saida)).digest('hex').slice(0, 16);
// Resumo para o cartão: o placar dos testes quando houver (linhas de pass/fail), senão as últimas linhas.
const resumoDe = (saida) => {
  const linhas = String(saida).replace(/\r\n/g, '\n').trim().split('\n').map((l) => l.trim()).filter(Boolean);
  const placar = linhas.filter((l) => /^(?:ℹ|#)?\s*(?:pass|fail|tests|passed|failed)\b/i.test(l));
  return (placar.length ? placar : linhas.slice(-3)).join(' / ').slice(-200);
};

// O que fazer com o resultado de uma verificação: devolve o estado novo do vigia e se é para acordar o time.
//   falha     acorda quando o comando passa a falhar (na transição: enquanto continuar falhando, não acorda de novo);
//   mudança   acorda quando a saída difere da última vista (a primeira verificação só registra o ponto de partida).
export function avaliarVigia(r, { codigo, saida }, agora = new Date()) {
  const antes = r.vigia || {};
  const ok = codigo === 0, marca = marcaDe(saida);
  const disparar = r.dispara === 'mudanca' ? antes.marca != null && antes.marca !== marca : !ok && antes.ok !== false;
  return { disparar, vigia: { verificada: agora.toISOString(), ok, marca, resumo: resumoDe(saida), pendente: antes.pendente || '' } };
}

// O pedido que o time recebe quando um vigia dispara: o pedido da rotina, mais o que o vigia viu.
export function pedidoDoVigia(r, saida) {
  const cauda = String(saida).replace(/\r\n/g, '\n').trim().slice(-1500);
  const motivo = r.dispara === 'mudanca' ? 'a saída do comando mudou' : 'o comando falhou';
  return `${r.texto}\n\nEste pedido foi disparado por um vigia: ${motivo}.\nComando: ${r.comando}\nSaída mais recente:\n${cauda || '(sem saída)'}`;
}

export const quando = (r) => (r.tipo === 'vigia' ? `a cada ${r.intervaloMin} min, ${DISPAROS[r.dispara]}` : `${r.dias.length === 7 ? 'todo dia' : r.dias.map((d) => DIAS[d]).join(', ')} às ${r.hora}`);
