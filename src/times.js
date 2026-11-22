// Construtor de times: valida e normaliza um time vindo da tela ou de um arquivo de arquitetura.
// O orquestrador só recebe time que passou por aqui, então as regras de forma ficam todas neste arquivo.
import { nivel } from './orquestrador.js';

export const FORMAS = ['cartola', 'engrenagem', 'regente', 'pilha', 'cristal', 'lente', 'escudo', 'tela', 'gota', 'nuvem', 'cogumelo', 'polvo', 'foguete', 'gato', 'livro', 'planta', 'salsicha'];
export const FERRAMENTAS = ['listar', 'ler', 'escrever', 'rodar'];
export const FUNCOES = ['', 'lider', 'sublider', 'revisor'];
export const ARQUITETURAS = {
  unico: 'Um agente só, com as ferramentas, faz o pedido inteiro. O revisor é opcional.',
  centralizada: 'Supervisor: um líder planeja e distribui; todos respondem a ele.',
  hierarquica: 'O líder divide o pedido entre sub-líderes, e cada sub-líder planeja para o próprio time.',
  sequencial: 'Esteira sem líder: cada agente faz a sua etapa, na ordem da lista, e passa para o próximo.',
  rede: 'Rede sem chefe: o primeiro da lista começa, e cada um faz a sua parte e escolhe quem continua entre os vizinhos dele.',
};
const SEM_LIDER = ['unico', 'sequencial', 'rede'];

const texto = (v, max) => String(v ?? '').trim().slice(0, max);
export const fatiar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

export function validarTime(t, provedores, provedorPadrao) {
  const erro = (m) => { throw new Error(m); };
  if (!t || typeof t !== 'object') erro('time vazio');
  const arquitetura = t.arquitetura || 'centralizada';
  if (!ARQUITETURAS[arquitetura]) erro(`arquitetura desconhecida: ${arquitetura}`);
  if (!Array.isArray(t.agentes) || !t.agentes.length) erro('o time precisa de pelo menos um agente');
  if (t.agentes.length > 12) erro('no máximo 12 agentes por time');

  const ids = new Set();
  const agentes = t.agentes.map((a, i) => {
    const id = texto(a.id, 24).toLowerCase();
    if (!/^[a-z][a-z0-9-]*$/.test(id)) erro(`agente ${i + 1}: id "${a.id || ''}" inválido (letras minúsculas, números e hífen, começando por letra)`);
    if (ids.has(id)) erro(`dois agentes com o id "${id}"`);
    ids.add(id);
    const nome = texto(a.nome, 24) || erro(`agente ${id}: falta o nome`);
    const funcao = a.funcao || '';
    if (!FUNCOES.includes(funcao)) erro(`${nome}: função "${funcao}" desconhecida`);
    let provedor = a.provedor || provedorPadrao;
    if (!provedores[provedor]) erro(`${nome}: o provedor "${provedor}" não existe nesta configuração`);
    const papel = texto(a.papel, 140) || 'sem papel definido';
    const lidera = funcao === 'lider' || funcao === 'sublider';
    let ferramentas = lidera ? [] : [...new Set((a.ferramentas || []).filter((f) => FERRAMENTAS.includes(f)))];
    if (funcao === 'revisor' && ferramentas.some((f) => f === 'escrever' || f === 'rodar')) erro(`${nome}: o revisor só lê (listar e ler); quem corrige é o autor`);
    const ag = {
      id, nome, papel, funcao, provedor, ferramentas,
      cor: /^#[0-9a-f]{6}$/i.test(a.cor || '') ? a.cor.toLowerCase() : '#8f7bff',
      forma: FORMAS.includes(a.forma) ? a.forma : (lidera ? 'regente' : 'pilha'),
      sistema: texto(a.sistema, 2000) || `Você é ${nome}. Seu papel: ${papel}.`,
    };
    if (texto(a.modelo, 60)) ag.modelo = texto(a.modelo, 60);
    if (a.complexidade === 'auto') ag.complexidade = 'auto'; else if (nivel(a.complexidade)) ag.complexidade = nivel(a.complexidade);
    if (texto(a.chefe, 24)) ag.chefe = texto(a.chefe, 24).toLowerCase();
    if (Array.isArray(a.conexoes)) ag.conexoes = [...new Set(a.conexoes.map((c) => texto(c, 24).toLowerCase()).filter(Boolean))];
    return ag;
  });

  const com = (f) => agentes.filter((a) => a.funcao === f);
  if (com('revisor').length > 1) erro('só pode haver um revisor');
  const executores = agentes.filter((a) => !a.funcao && a.ferramentas.includes('escrever'));
  if (!executores.length) erro('o time precisa de pelo menos um executor que possa escrever arquivos');

  if (arquitetura !== 'rede') agentes.forEach((a) => delete a.conexoes);
  if (SEM_LIDER.includes(arquitetura)) {
    const nomeArq = { unico: 'o agente único', sequencial: 'a esteira', rede: 'a rede' }[arquitetura];
    if (com('lider').length || com('sublider').length) erro(`${nomeArq} não tem líder: troque líder e sub-líder por executor`);
    agentes.forEach((a) => delete a.chefe);
    // o revisor fica por último (fecha a esteira; na rede, fica fora do anel)
    agentes.sort((x, y) => (x.funcao === 'revisor') - (y.funcao === 'revisor'));
    const membros = agentes.filter((a) => a.funcao !== 'revisor');
    if (arquitetura === 'unico' && membros.length !== 1) erro('o agente único tem exatamente um agente (mais o revisor, se quiser)');
    if (arquitetura === 'rede') {
      const ids2 = new Set(membros.map((a) => a.id));
      for (const a of membros) {
        if (!a.conexoes) continue;   // sem lista: liga com todos
        for (const c of a.conexoes) {
          if (c === a.id) erro(`${a.nome} não pode passar a vez para si mesmo`);
          if (!ids2.has(c)) erro(`${a.nome} passa a vez para "${c}", que não é membro da rede (o revisor fica de fora)`);
        }
      }
      if (membros.length > 1 && membros[0].conexoes?.length === 0) erro(`${membros[0].nome} começa a rede, mas não pode passar a vez para ninguém`);
    }
  } else {
    agentes.forEach((a) => delete a.conexoes);
    if (com('lider').length !== 1) erro('o time precisa de exatamente um líder');
    const lider = com('lider')[0];
    delete lider.chefe;
    if (arquitetura === 'centralizada') {
      if (com('sublider').length) erro('sub-líder só existe na arquitetura hierárquica');
      agentes.forEach((a) => { if (a !== lider) a.chefe = lider.id; });
    } else {
      const chefes = new Set(agentes.filter((a) => a.funcao === 'lider' || a.funcao === 'sublider').map((a) => a.id));
      for (const a of agentes) {
        if (a === lider) continue;
        if (!a.chefe) a.chefe = lider.id;
        if (a.chefe === a.id) erro(`${a.nome} não pode responder a si mesmo`);
        if (!chefes.has(a.chefe)) erro(`${a.nome} responde a "${a.chefe}", que não é líder nem sub-líder do time`);
      }
      // todo sub-líder sobe até o líder sem dar volta
      for (const s of com('sublider')) {
        let atual = s, passos = 0;
        while (atual.chefe && passos++ < 12) atual = agentes.find((x) => x.id === atual.chefe);
        if (atual !== lider) erro(`${s.nome} está numa cadeia de chefia que não chega ao líder`);
        if (!agentes.some((x) => x.chefe === s.id && x.funcao !== 'revisor')) erro(`o sub-líder ${s.nome} não tem ninguém no time dele`);
      }
    }
    if (!agentes.some((a) => a.chefe === lider.id && a.funcao !== 'revisor')) erro(`o líder ${lider.nome} não tem ninguém para quem delegar`);
  }

  return { nome: texto(t.nome, 40) || 'Time sem nome', descricao: texto(t.descricao, 200), arquitetura, agentes };
}
