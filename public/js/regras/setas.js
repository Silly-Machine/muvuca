// Regras das setas do construtor de times, sem nada de tela: recebem o rascunho do time, mudam o que for
// preciso nele e devolvem { mudou, mensagem }. Servem ao navegador e aos testes (test/tela.test.js).
//
// O que uma seta "de → para" quer dizer depende da arquitetura:
//   rede: "de" passa a vez para "para";  hierárquica e supervisor: "de" chefia "para";  esteira: "para" vem logo depois de "de".

const achar = (rascunho, id) => rascunho.agentes.find((a) => a.id === id);
const sim = (mensagem) => ({ mudou: true, mensagem });
const nao = (mensagem) => ({ mudou: false, mensagem });
// Na rede, agente sem lista de conexões passa a vez para todos (menos ele mesmo e o revisor).
const todosMenos = (rascunho, a) => rascunho.agentes.filter((x) => x !== a && x.funcao !== 'revisor').map((x) => x.id);

// Cria a seta "de → para". Devolve null se algum dos dois não existe ou se são o mesmo agente.
export function ligarSeta(rascunho, de, para) {
  const a = achar(rascunho, de), b = achar(rascunho, para);
  if (!a || !b || a === b) return null;
  let arq = rascunho.arquitetura;
  if (arq === 'unico') return nao('Com um agente só não há setas.');
  if (a.funcao === 'revisor' || b.funcao === 'revisor') return nao('O revisor fica fora das setas: ele confere tudo no fim, sozinho.');
  if (arq === 'rede') {
    const atual = Array.isArray(a.conexoes) ? a.conexoes : todosMenos(rascunho, a);
    if (atual.includes(b.id)) return nao(`${a.nome} já passa a vez para ${b.nome}.`);
    a.conexoes = [...atual, b.id];
    return sim(`${a.nome} agora passa a vez para ${b.nome}.`);
  }
  if (arq === 'sequencial') {
    const lista = rascunho.agentes;
    lista.splice(lista.indexOf(b), 1); lista.splice(lista.indexOf(a) + 1, 0, b);
    return sim(`${b.nome} agora vem logo depois de ${a.nome}.`);
  }
  // supervisor ou hierárquica: a seta é "a chefia b"
  if (b.funcao === 'lider') return nao('O líder não responde a ninguém.');
  if (arq === 'centralizada' && a.funcao === 'lider') return nao(`${b.nome} já responde a ${a.nome}.`);
  for (let x = a, k = 0; x && k < 12; x = achar(rascunho, x.chefe), k++) if (x === b) return nao('Assim a chefia daria uma volta: escolha outro chefe.');
  let extra = '';
  if (arq === 'centralizada') { rascunho.arquitetura = arq = 'hierarquica'; extra = ' A arquitetura virou hierárquica.'; }
  if (a.funcao !== 'lider' && a.funcao !== 'sublider') { a.funcao = 'sublider'; a.ferramentas = []; extra = ` ${a.nome} virou sub-líder: passa a planejar, não a executar.` + extra; }
  b.chefe = a.funcao === 'lider' ? '' : a.id;
  return sim(`${b.nome} agora responde a ${a.nome}.` + extra);
}

// Tira a seta "de → para". Setas que são da própria arquitetura não saem: a mensagem explica por quê.
export function desligarSeta(rascunho, de, para) {
  const a = achar(rascunho, de), b = achar(rascunho, para);
  if (!a || !b) return null;
  const arq = rascunho.arquitetura;
  if (arq === 'rede') {
    a.conexoes = (Array.isArray(a.conexoes) ? a.conexoes : todosMenos(rascunho, a)).filter((x) => x !== b.id);
    return sim(`${a.nome} não passa mais a vez para ${b.nome}.`);
  }
  if (arq === 'hierarquica') {
    if (b.funcao === 'revisor') return nao('O revisor sempre responde ao líder.');
    if (a.funcao === 'lider') return nao(`Todo mundo responde a alguém. Para trocar o chefe de ${b.nome}, desenhe uma seta de um sub-líder até ele.`);
    b.chefe = '';
    return sim(`${b.nome} voltou a responder direto ao líder.`);
  }
  if (arq === 'centralizada') return nao(`No supervisor todos respondem ao líder. Para tirar ${b.nome} do time, solte-o na área abaixo.`);
  return nao('Na esteira a ordem é a da lista: clique num agente e depois no que deve vir depois dele.');
}
