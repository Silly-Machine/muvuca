// Rotinas: pedidos que o time recebe sozinho, em dias e hora marcados. O servidor confere o relógio;
// aqui ficam só as regras (forma da rotina e quando ela está na hora), para poderem ser testadas.
const texto = (v, max) => String(v ?? '').trim().slice(0, max);
export const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function normalizarRotinas(lista, anteriores = []) {
  if (!Array.isArray(lista)) throw new Error('lista de rotinas inválida');
  if (lista.length > 30) throw new Error('no máximo 30 rotinas');
  const antes = new Map(anteriores.map((r) => [r.id, r]));
  const ids = new Set();
  return lista.map((r, i) => {
    const nome = texto(r?.nome, 50) || `Rotina ${i + 1}`;
    const pedido = texto(r?.texto, 2000);
    if (!pedido) throw new Error(`${nome}: falta o pedido para o time`);
    const hora = texto(r?.hora, 5);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) throw new Error(`${nome}: hora inválida (use HH:MM, de 00:00 a 23:59)`);
    const dias = [...new Set((Array.isArray(r?.dias) ? r.dias : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
    if (!dias.length) throw new Error(`${nome}: escolha pelo menos um dia da semana`);
    let id = texto(r?.id, 24); if (!/^[a-z0-9-]+$/.test(id) || ids.has(id)) id = 'r' + Date.now().toString(36) + i;
    ids.add(id);
    // "última vez" e resultado são do servidor: a tela não escreve neles
    const a = antes.get(id);
    return { id, nome, texto: pedido, projeto: texto(r?.projeto, 400), hora, dias, ativa: r?.ativa !== false, ultima: a?.ultima || null, resultado: a?.resultado || '' };
  });
}

const mesmoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Rotinas na hora: ativas, no dia certo, dentro da janela depois do horário, e que ainda não rodaram hoje.
// A janela evita disparar de surpresa uma rotina das 9h quando o servidor só sobe às 15h.
export function devidas(rotinas, agora = new Date(), janelaMin = 10) {
  const minutos = agora.getHours() * 60 + agora.getMinutes();
  return rotinas.filter((r) => {
    if (!r.ativa || !r.dias.includes(agora.getDay())) return false;
    const [h, m] = r.hora.split(':').map(Number);
    const atraso = minutos - (h * 60 + m);
    if (atraso < 0 || atraso >= janelaMin) return false;
    return !(r.ultima && mesmoDia(new Date(r.ultima), agora));
  });
}

export const quando = (r) => `${r.dias.length === 7 ? 'todo dia' : r.dias.map((d) => DIAS[d]).join(', ')} às ${r.hora}`;
