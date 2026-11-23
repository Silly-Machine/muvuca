// Orquestrador v3: um líder com sessão contínua, especialistas como subagentes,
// portão de testes determinístico e revisor que devolve o trabalho a quem fez.
import fs from 'node:fs/promises';
import path from 'node:path';
import { chamar } from './provedores.js';
import { usar, fotografar, assinaturas, mudou, restaurar, diferencas, detectarTeste, rodar } from './ferramentas.js';
import { comandoIsolavel, prepararIsolamento, cliAceitaIsolamento, EXPLICACAO_BLOQUEIO } from './isolamento.js';

export function extrairJson(texto) {
  const t = String(texto || '').replace(/```(?:json)?/gi, '');
  const i = t.indexOf('{'); const f = t.lastIndexOf('}');
  if (i < 0 || f <= i) return null;
  try { return JSON.parse(t.slice(i, f + 1)); } catch { return null; }
}

// Complexidade de uma tarefa: o líder classifica, e o provedor troca o modelo conforme o nível.
export const NIVEIS = ['baixa', 'media', 'alta'];
export function nivel(v) {
  const t = String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return NIVEIS.includes(t) ? t : null;
}
// Modelo padrão de cada papel, dito como nível (o provedor traduz o nível no modelo dele):
//   líder e sub-líder planejam: "media"; revisor confere o trabalho final: "alta";
//   quem só consulta (não escreve): "baixa"; quem escreve código: sem padrão, o líder classifica cada tarefa.
export function nivelPadrao(a) {
  if (a?.funcao === 'lider' || a?.funcao === 'sublider') return 'media';
  if (a?.funcao === 'revisor') return 'alta';
  if (!(a?.ferramentas || []).includes('escrever')) return 'baixa';
  return null;
}
// O nível que vale para o agente: o escolhido nele, senão o padrão do papel. "auto" desliga os dois.
export function nivelFixo(a) {
  if (!a || a.complexidade === 'auto') return null;
  return nivel(a.complexidade) || nivelPadrao(a);
}
// Onde ficam as notas de memória: as do modo demonstração (roteiro fixo) não se misturam com as do trabalho real.
export const chaveMemoria = (projeto, demo) => String(projeto) + (demo ? '::demonstracao' : '');
const subir = (n) => NIVEIS[Math.min(NIVEIS.indexOf(n ?? 'media') + 1, NIVEIS.length - 1)];
const maior = (lista) => lista.reduce((a, b) => (NIVEIS.indexOf(b) > NIVEIS.indexOf(a) ? b : a), 'baixa');

export class Muvuca {
  constructor(cfg) {
    this.cfg = cfg;
    this.ouvintes = new Set();
    this.eventos = [];
    this.lider = [];            // sessão contínua do líder: sobrevive entre pedidos
    this.pendentes = new Map(); // aprovações esperando o humano
    this.rodando = false;
    this.foto = null; this.projeto = null; this.seq = 0;
    this.maxCiclos = cfg.maxCiclos ?? 3;
    this.maxPassos = cfg.maxPassos ?? 12;
  }

  agente(id) { return this.cfg.agentes.find((a) => a.id === id); }
  // A foto é o ponto de restauração do "descartar". Quem quiser guardá-la (o servidor grava em disco) ouve aqui.
  async definirFoto(foto) { this.foto = foto; if (!foto) this.autoresPendentes = new Map(); try { await this.aoMudarFoto?.(foto, this.projeto); } catch (e) { this.emitir({ tipo: 'aviso', texto: `Não consegui guardar o ponto de restauração em disco: ${e.message}` }); } }
  // Escolha do modelo, do mais específico ao mais geral:
  // agente.modelos[nível] > agente.modelo (fixo) > provedor.modelos[nível] > provedor.modelo.
  provedor(ag, complexidade) {
    const p = this.cfg.provedores[ag.provedor]; if (!p) throw new Error(`provedor "${ag.provedor}" não existe (agente ${ag.id})`);
    const c = nivel(complexidade);
    const modelo = (c && ag.modelos?.[c]) || ag.modelo || (c && p.modelos?.[c]) || p.modelo;
    return { nome: ag.provedor, ...p, ...(modelo ? { modelo } : {}), ...(this.limiteAgenteS ? { limiteSegundos: this.limiteAgenteS } : {}) };
  }
  get idLider() { return (this.cfg.agentes.find((a) => a.funcao === 'lider') || this.cfg.agentes[0]).id; }
  get idRevisor() { return this.cfg.agentes.find((a) => a.funcao === 'revisor')?.id; }
  get arquitetura() { return this.cfg.arquitetura || 'centralizada'; }
  // A quem o agente responde. Sem "chefe" (configs antigas), todo mundo responde ao líder.
  chefeDe(a) { return a.funcao === 'lider' ? null : (a.chefe && this.agente(a.chefe) ? a.chefe : this.idLider); }
  // Quem um líder ou sub-líder pode receber no plano. O revisor fica de fora: a revisão é automática.
  subordinados(id) {
    if (!['centralizada', 'hierarquica'].includes(this.arquitetura)) return [];
    return this.cfg.agentes.filter((a) => a.id !== id && a.funcao !== 'lider' && a.funcao !== 'revisor' && this.chefeDe(a) === id);
  }

  // Troca o time inteiro (construtor). Só com o palco parado e sem mudança esperando decisão.
  trocarTime(t) {
    if (this.rodando) throw new Error('há um pedido em andamento');
    // a troca limpa a conversa (e o cartão de manter/descartar): a tela resolve a decisão antes, com o código abaixo
    if (this.foto) throw Object.assign(new Error('a última conversa mudou arquivos do projeto e isso ainda espera sua decisão'), { codigo: 'decisao' });
    this.cfg = { ...this.cfg, nomeTime: t.nome, arquitetura: t.arquitetura, agentes: t.agentes };
    this.eventos = []; this.lider = [];
    this.emitir({ tipo: 'time', nome: t.nome, arquitetura: t.arquitetura });
  }

  // Quadro de tarefas: cada etapa de trabalho vira um cartão, e o evento "tarefa" leva o cartão inteiro.
  // Estados: afazer, trabalhando, bloqueado, revisao, pronto, falhou, parado.
  tarefa(id, campos) { const t = { ...(this.quadro.get(id) || { id }), ...campos }; this.quadro.set(id, t); this.emitir({ tipo: 'tarefa', ...t }); return id; }
  novaTarefa(agente, titulo, estado = 'afazer', extra = {}) {
    return this.tarefa(`t${++this.seqTarefa}`, { agente, titulo: String(titulo || '').replace(/\s+/g, ' ').trim().slice(0, 180), estado, ...extra });
  }
  // Memória: nota curta que o agente relê nos próximos pedidos deste projeto. Quem guarda é o servidor (this.memoria).
  pastaMemoria(id) { return chaveMemoria(this.projeto, this.cfg.provedores[this.agente(id)?.provedor]?.tipo === 'demo'); }
  async lembrar(id, nota) {
    if (!this.memoria) return;
    try { if (await this.memoria.anotar(this.pastaMemoria(id), id, nota)) this.emitir({ tipo: 'memoria', agente: id, nota: String(nota).trim().slice(0, 240) }); }
    catch (e) { this.emitir({ tipo: 'aviso', texto: `Não consegui guardar a nota de ${id}: ${e.message}` }); }
  }

  // Põe o time inteiro num provedor (aba Configurações), com os modelos por complexidade escolhidos na tela.
  // Quem já estava nele mantém o modelo fixo; quem vem de outro perde o fixo, que era de outro provedor.
  usarProvedor(nome, modelos) {
    if (this.rodando) throw new Error('há um pedido em andamento');
    const p = this.cfg.provedores[nome]; if (!p) throw new Error(`provedor "${nome}" não existe nesta configuração`);
    const escolhidos = {};
    for (const n of NIVEIS) { const m = String(modelos?.[n] ?? '').trim().slice(0, 80); if (m) escolhidos[n] = m; }
    if (Object.keys(escolhidos).length) p.modelos = { ...(p.modelos || {}), ...escolhidos };
    this.cfg = { ...this.cfg, agentes: this.cfg.agentes.map((a) => { if (a.provedor === nome) return a; const { modelo, modelos: _m, ...resto } = a; return { ...resto, provedor: nome }; }) };
    this.emitir({ tipo: 'provedor', nome, modelos: p.modelos || null, modelo: p.modelo || '' });
  }

  // Escolha de modelo de um agente só (aba Configurações): '' = padrão do papel, 'auto', ou um nível.
  definirNivel(id, valor) {
    if (this.rodando) throw new Error('há um pedido em andamento');
    if (!this.agente(id)) throw new Error(`agente "${id}" não existe neste time`);
    const v = valor === 'auto' ? 'auto' : nivel(valor);
    if (valor && !v) throw new Error('nível desconhecido: use baixa, media, alta ou auto');
    this.cfg = { ...this.cfg, agentes: this.cfg.agentes.map((a) => { if (a.id !== id) return a; const { complexidade, ...resto } = a; return v ? { ...resto, complexidade: v } : resto; }) };
    this.emitir({ tipo: 'nivel_agente', agente: id, valor: v || '' });
  }

  // Uso do pedido em andamento: quantas chamadas ao provedor, e o custo e os tokens quando o aplicativo informa.
  somarUso(r) {
    if (!this.uso) return;
    this.uso.chamadas++;
    if (r?.uso) { this.uso.informado = true; this.uso.custo += r.uso.custo; this.uso.entrada += r.uso.entrada; this.uso.saida += r.uso.saida; }
  }
  emitir(ev) { ev.n = ++this.seq; ev.hora = Date.now(); this.eventos.push(ev); for (const f of this.ouvintes) f(ev); return ev; }
  status(agente, estado, extra) { this.emitir({ tipo: 'status', agente, estado, ...extra }); }

  nova() {
    if (this.rodando) throw new Error('há um pedido em andamento');
    // Zerar a foto aqui perderia o ponto de restauração: os arquivos ficariam na pasta sem como descartar.
    if (this.foto) throw new Error('há mudanças esperando sua decisão: escolha manter ou descartar antes de começar outra conversa');
    // a conversa que termina vai para o histórico (quem guarda é o servidor)
    if (this.eventos.some((e) => e.tipo === 'pedido')) { try { this.aoArquivar?.(this.eventos); } catch { /* o histórico é um extra: não impede a conversa nova */ } }
    this.eventos = []; this.lider = []; this.foto = null; this.emitir({ tipo: 'nova' }); }

  parar() { this.abort?.abort(); for (const [, ok] of this.pendentes) ok(false); this.pendentes.clear(); }

  aprovar(id, ok) { const f = this.pendentes.get(id); if (!f) return false; this.pendentes.delete(id); f(!!ok); this.emitir({ tipo: 'aprovacao_resolvida', id, ok: !!ok }); return true; }

  pedirAprovacao(agente, comando) {
    const id = `ap${++this.seq}`;
    this.status(agente, 'aguardando');
    const idT = this.tarefaDe?.get(agente);
    if (idT) this.tarefa(idT, { estado: 'bloqueado', motivo: 'Espera você aprovar um comando.' });
    this.emitir({ tipo: 'aprovacao', id, agente, comando });
    return new Promise((ok) => this.pendentes.set(id, (v) => { this.status(agente, 'trabalhando'); if (idT) this.tarefa(idT, { estado: 'trabalhando', motivo: '' }); ok(v); }));
  }

  async decidir(acao) {
    if (this.rodando) throw new Error('há um pedido em andamento');
    if (!this.foto) throw new Error('nada para decidir');
    if (acao !== 'aceitar' && acao !== 'descartar') throw new Error('decisão desconhecida: use "aceitar" ou "descartar"');
    if (acao === 'descartar') await restaurar(this.projeto, this.foto);
    await this.definirFoto(null);
    this.emitir({ tipo: 'decisao_humana', acao });
  }

  // Uma rodada de um agente: laço de ferramentas (API) ou uma chamada única (CLI, que tem o próprio laço).
  async executar(ag, tarefa, { somenteTexto = false, contexto = '', complexidade = null } = {}) {
    const prov = this.provedor(ag, complexidade);
    this.status(ag.id, 'pensando', { modelo: prov.modelo || prov.nome, complexidade: nivel(complexidade) });
    const ferramentas = somenteTexto ? [] : (ag.ferramentas || []);
    const sistema = `${ag.sistema}\nVocê é ${ag.nome}. Responda em português, em frases curtas.` +
      (ferramentas.length ? '\nTrabalhe na pasta do projeto usando as ferramentas. Ao terminar, responda com uma frase dizendo o que fez.' : '') +
      // Ninguém roda npm install aqui: dependência externa quebra o portão (visto com Express + Jest no teste real).
      (ferramentas.includes('rodar') ? '\nAntes de entregar, rode os testes do projeto e só diga que passam se você viu passar. Use exatamente "node --test" ou "npm test", na raiz do projeto, sem cd, sem pipe, sem redirecionamento e sem juntar com outro comando: outras formas podem ser negadas. Se for negado, tente a forma exata antes de desistir.' : '') +
      (ferramentas.includes('escrever') ? '\nNão há como instalar dependências (npm install não roda). Use só a biblioteca padrão; em Node, servidor com node:http e testes com node:test.' : '');
    // Conexões (MCP) ligadas a este agente: quem decide é o servidor (só agentes que não escrevem recebem).
    const mcp = this.conexoesDe ? await this.conexoesDe(ag).catch(() => null) : null;
    // Quem roda testes recebe o ambiente isolado: o "node --test" que o agente dispara também fica preso à pasta do projeto.
    const iso = ferramentas.includes('rodar') && this.isolarTestes !== false ? await prepararIsolamento(this.projeto).catch(() => null) : null;
    // aplicativo de provedor feito em Node não sobe no ambiente isolado: aí o agente roda os testes dele sem isolamento, e a conversa avisa uma vez
    // (num Node em que o ambiente sozinho não isola, o agente fica sem: ver isolamento.js)
    let isolamento = iso?.ok && iso.paraAgentes ? iso : null;
    if (iso?.ok && !iso.paraAgentes && prov.tipo === 'cli' && !(this.avisouIsolamento ||= new Set()).has('node')) { this.avisouIsolamento.add('node'); this.emitir({ tipo: 'aviso', texto: 'Neste Node, os testes que os agentes rodam por conta própria não ficam isolados (os do portão ficam). Com o Node 24 ou mais novo, os dois ficam.' }); }
    if (isolamento && prov.tipo === 'cli' && !(await cliAceitaIsolamento(prov.comando))) {
      isolamento = null;
      if (!(this.avisouIsolamento ||= new Set()).has(prov.comando)) { this.avisouIsolamento.add(prov.comando); this.emitir({ tipo: 'aviso', texto: `O aplicativo "${prov.comando}" não funciona com o isolamento dos testes: os testes que os agentes rodarem por ele não ficam isolados. Os do portão continuam.` }); }
    }
    const notas = !somenteTexto && this.memoria ? await this.memoria.ler(this.pastaMemoria(ag.id), ag.id).catch(() => []) : [];
    const comMemoria = sistema +
      (mcp ? `\nVocê tem conexões externas, além da pasta do projeto: ${mcp.servidores.map((s) => `${s.nome} (ferramentas mcp__${s.id}__*${s.descricao ? '; ' + s.descricao : ''})`).join('; ')}. Use quando ajudar na tarefa, e diga na resposta o que consultou.` : '') +
      (notas.length ? `\nSuas notas de trabalhos anteriores neste projeto (leve em conta):\n${notas.map((n) => `- ${n}`).join('\n')}` : '') +
      (this.memoria && ferramentas.length ? '\nSe aprender algo que valha para os próximos pedidos neste projeto (convenção, armadilha, comando que funciona), termine com uma linha "LEMBRAR: nota curta". Só quando for útil de verdade.' : '');
    const mensagens = [{ role: 'user', content: (contexto ? `${contexto}\n\n` : '') + tarefa }];
    let passos = 0; const inicio = Date.now();
    const base = { sistema: comMemoria + (isolamento ? '\nOs testes rodam isolados: só leem e escrevem dentro da pasta do projeto e da pasta temporária (os.tmpdir()), e não conseguem abrir outros processos. Escreva os testes de acordo: servidor no mesmo processo, arquivos temporários com os.tmpdir(). Para rodar os testes use exatamente "node --test": "npm test" e qualquer opção a mais na linha de comando são negados.' : ''), ferramentas, sinal: this.abort.signal, cwd: this.projeto, agente: ag, mcp, isolamento };
    try {
      for (let volta = 0; volta < this.maxPassos; volta++) {
        this.status(ag.id, volta === 0 ? 'pensando' : 'trabalhando');   // depois da primeira ferramenta ele está no meio do trabalho
        const r = await chamar(prov, { ...base, mensagens, aoPasso: (p) => {
          this.status(ag.id, 'trabalhando');
          // uso de uma conexão aparece na conversa com nome próprio; não conta como passo de trabalho
          if (p.ferramenta === 'conexao') return this.emitir({ tipo: 'conexao', agente: ag.id, servidor: p.servidor, ferramenta: p.alvo });
          passos++; this.emitir({ tipo: 'passo', agente: ag.id, ...p });
        } });
        this.somarUso(r);
        mensagens.push(r.msg);
        if (r.passos) passos = Math.max(passos, r.passos);
        if (!r.chamadas.length) return { texto: r.texto.trim(), passos, segundos: (Date.now() - inicio) / 1000, modelo: prov.modelo || prov.nome };
        this.status(ag.id, 'trabalhando');
        for (const c of r.chamadas) {
          passos++;
          const permitido = ferramentas.includes(c.nome);
          this.emitir({ tipo: 'passo', agente: ag.id, ferramenta: c.nome, alvo: c.args.caminho || c.args.comando || '' });
          const saida = permitido
            ? await usar(c.nome, c.args, { projeto: this.projeto, sinal: this.abort.signal, pedirAprovacao: (cmd) => this.pedirAprovacao(ag.id, cmd), isolar: this.isolarTestes !== false })
            : `ERRO: ${ag.nome} não tem a ferramenta ${c.nome}.`;
          mensagens.push({ role: 'tool', tool_call_id: c.id, content: String(saida) });
          if (this.abort.signal.aborted) throw new Error('interrompido');
        }
      }
      return { texto: '(parei: limite de passos atingido)', passos, segundos: (Date.now() - inicio) / 1000, estourou: true, modelo: prov.modelo || prov.nome };
    } finally { await iso?.limpar?.(); }
  }

  // Etapa de trabalho: executa, descobre quais arquivos o agente mudou e registra a autoria.
  async etapa(id, tarefa, contexto, complexidade, meta = {}) {
    const ag = this.agente(id);
    const c = nivel(complexidade);
    if (c) this.niveis.set(id, c);   // a próxima devolução para este agente parte deste nível
    const idT = meta.idTarefa || this.novaTarefa(id, meta.titulo || tarefa, 'trabalhando');
    this.tarefa(idT, { estado: 'trabalhando', complexidade: c }); this.tarefaDe.set(id, idT);
    const antes = await assinaturas(this.projeto);
    const r = await this.executar(ag, tarefa, { contexto, complexidade: c });
    const arquivos = mudou(antes, await assinaturas(this.projeto));
    // linhas "LEMBRAR: ..." viram notas do agente e saem do texto
    for (const m of r.texto.matchAll(/^\s*LEMBRAR:\s*(.+)$/gim)) await this.lembrar(id, m[1]);
    r.texto = r.texto.replace(/^\s*LEMBRAR:.*$/gim, '').trim();
    this.tarefa(idT, { estado: meta.fim || 'revisao', arquivos: arquivos.length });
    for (const a of arquivos) this.autores.set(a, id);
    if (arquivos.length) this.ultimaEdicao = Date.now();
    this.emitir({ tipo: 'concluiu', agente: id, segundos: +r.segundos.toFixed(1), passos: r.passos, arquivos, modelo: r.modelo, complexidade: c });
    // a linha de JSON da rede ({"proximo":...}) é para o orquestrador, não para a conversa
    r.fala = r.texto.replace(/\{\s*"proximo"[\s\S]*\}\s*$/, '').replace(/```(?:json)?\s*$/i, '').trim() || '(sem comentário)';
    this.emitir({ tipo: 'fala', agente: id, texto: r.fala });
    this.status(id, 'concluido');
    setTimeout(() => { if (this.rodando) this.status(id, 'disponivel'); }, 1500).unref?.();
    return r;
  }

  // Um líder (ou sub-líder) planeja para quem responde a ele. O líder do topo guarda a sessão entre pedidos;
  // o sub-líder começa do zero a cada tarefa que recebe, com a tarefa no lugar do pedido.
  async planejar(texto, idLider = this.idLider) {
    const lider = this.agente(idLider);
    const topo = idLider === this.idLider;
    const time = this.subordinados(idLider);
    const sessao = topo ? this.lider : [];
    const linha = (a) => {
      const subs = this.subordinados(a.id);
      if (subs.length) return `- ${a.id}: ${a.papel} (sub-líder: coordena ${subs.map((s) => s.id).join(', ')}; mande para ele a parte inteira da frente dele)`;
      return `- ${a.id}: ${a.papel}${a.ferramentas?.includes('escrever') ? '' : ' (só consulta, não edita)'}`;
    };
    const equipe = time.map(linha).join('\n');
    const instrucao = `Você lidera um time. Não executa: decide quem faz.\nEquipe:\n${equipe}\nResponda SOMENTE com JSON neste formato:\n{"fala":"uma frase para o usuário","consultas":[{"agente":"id","pergunta":"...","complexidade":"baixa"}],"etapas":[{"agente":"id","tarefa":"instrução completa e autocontida","complexidade":"baixa|media|alta"}]}\nRegras: use "consultas" só quando a resposta puder mudar o plano; "etapas" roda em sequência; cada etapa precisa dizer os arquivos e o critério de pronto; peça testes automatizados a quem escreve código; a revisão final é automática, não a inclua.\nComplexidade decide o modelo usado (quanto mais alta, mais caro e lento): "baixa" = mecânico e curto (texto, renomear, ajuste de estilo, consulta factual); "media" = funcionalidade comum com teste; "alta" = arquitetura, algoritmo, concorrência, segurança ou bug difícil. Na dúvida, "media".`;
    const pedir = async (conteudo) => {
      sessao.push({ role: 'user', content: conteudo });
      const prov = this.provedor(lider, nivelFixo(lider));
      this.status(lider.id, 'pensando', { modelo: prov.modelo || prov.nome });
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        const r = await chamar(prov, { sistema: `${lider.sistema}\n${instrucao}`, mensagens: sessao, ferramentas: [], sinal: this.abort.signal, cwd: this.projeto, agente: lider, mcp: this.conexoesDe ? await this.conexoesDe(lider).catch(() => null) : null });
        this.somarUso(r);
        const j = extrairJson(r.texto);
        if (j) { sessao.push(r.msg); return j; }
        this.emitir({ tipo: 'aviso', texto: `${lider.nome} não devolveu JSON válido (tentativa ${tentativa + 1}).` });
        sessao.push(r.msg, { role: 'user', content: 'Sua resposta não era JSON válido. Responda somente com o JSON pedido.' });
      }
      return null;
    };
    // nível fixo no agente vence a classificação do líder
    const nivelDe = (id, pedido, padrao) => nivelFixo(this.agente(id)) || nivel(pedido) || padrao;
    let plano = await pedir(`${topo ? 'PEDIDO DO USUÁRIO' : 'TAREFA PARA A SUA FRENTE'}:\n${texto}`);
    const consultas = (plano?.consultas || []).filter((c) => time.some((a) => a.id === c.agente));
    if (consultas.length) {
      this.emitir({ tipo: 'fala', agente: lider.id, texto: plano.fala || 'Vou consultar o time.' });
      const respostas = await Promise.all(consultas.map(async (c) => {   // consultas em paralelo
        const ag = this.agente(c.agente);
        const complexidade = nivelDe(ag.id, c.complexidade, 'baixa');
        this.emitir({ tipo: 'consultando', de: lider.id, agente: ag.id, complexidade });
        const r = await this.executar(ag, c.pergunta, { somenteTexto: true, complexidade });
        this.emitir({ tipo: 'consulta', de: lider.id, agente: ag.id, pergunta: c.pergunta, resposta: r.texto, modelo: r.modelo, complexidade });
        this.status(ag.id, 'disponivel');
        return `${ag.id}: ${r.texto}`;
      }));
      plano = await pedir(`RESPOSTAS DAS CONSULTAS:\n${respostas.join('\n')}\nAgora devolva o plano final, com "etapas" preenchidas e "consultas" vazia.`);
    }
    // JSON válido sem etapas = o líder decidiu que não há trabalho (cumprimento, pergunta, esclarecimento).
    // Só é conversa; o plano de reserva fica para quando a resposta é ilegível. Sub-líder não pode recusar.
    if (topo && plano && !(plano.etapas || []).length) {
      this.status(lider.id, 'disponivel');
      this.emitir({ tipo: 'fala', agente: lider.id, texto: plano.fala || '(o líder não respondeu nada)' });
      return null;
    }
    let etapas = (plano?.etapas || []).filter((e) => time.some((a) => a.id === e.agente) && e.tarefa)
      .map((e) => ({ agente: e.agente, tarefa: e.tarefa, complexidade: nivelDe(e.agente, e.complexidade, 'media') }));
    if (!etapas.length) {
      const reserva = time.find((a) => a.ferramentas?.includes('escrever')) || this.cfg.agentes.find((a) => !['lider', 'sublider', 'revisor'].includes(a.funcao) && a.ferramentas?.includes('escrever'));
      this.emitir({ tipo: 'aviso', texto: `Plano vazio ou inválido: usando plano de reserva (${reserva.nome} faz tudo).` });
      etapas = [{ agente: reserva.id, tarefa: texto, complexidade: nivelDe(reserva.id, null, 'media') }];
      plano = { fala: `${reserva.nome}, é com você.` };
    }
    this.status(lider.id, 'disponivel');
    this.emitir({ tipo: 'plano', agente: lider.id, texto: plano.fala || '', etapas, sublider: !topo });
    return etapas;
  }

  // Executa as etapas em ordem. Etapa entregue a um sub-líder vira um plano dele, executado aqui mesmo.
  async rodarEtapas(etapas, texto, rastro, profundidade = 0) {
    const delega = (e) => profundidade < 4 && this.subordinados(e.agente).length > 0;
    for (const e of etapas) if (!delega(e)) e.idTarefa = this.novaTarefa(e.agente, e.titulo || e.tarefa, 'afazer', { complexidade: e.complexidade });
    for (const e of etapas) {
      if (delega(e)) {   // o limite protege de chefia em ciclo num arquivo editado à mão
        await this.rodarEtapas(await this.planejar(e.tarefa, e.agente), texto, rastro, profundidade + 1);
        continue;
      }
      if (rastro.anterior && rastro.anterior !== e.agente) this.emitir({ tipo: 'passagem', de: rastro.anterior, para: e.agente, texto: 'Minha parte está pronta. Segue com a sua.' });
      const feito = [...this.autores.keys()];
      await this.etapa(e.agente, e.tarefa, `Pedido original do usuário: ${texto}` + (feito.length ? `\nArquivos já criados pelo time: ${feito.join(', ')}` : ''), e.complexidade, { idTarefa: e.idTarefa });
      rastro.anterior = e.agente; rastro.primeiro ??= e.agente;
    }
  }

  // Esteira: sem líder, a ordem da lista é o plano. Cada agente sabe o que veio antes e o que vem depois.
  esteira(texto) {
    const fila = this.cfg.agentes.filter((a) => a.funcao !== 'revisor');
    const etapas = fila.map((a, i) => ({
      agente: a.id,
      complexidade: nivelFixo(a) || 'media',
      titulo: `Etapa ${i + 1} de ${fila.length}: ${a.papel}`,
      tarefa: `Você é a etapa ${i + 1} de ${fila.length} de uma esteira. Seu papel: ${a.papel}.\n` +
        (i ? `Antes de você: ${fila.slice(0, i).map((x) => `${x.nome} (${x.papel})`).join('; ')}. Leia o que já existe na pasta antes de começar.\n` : '') +
        (fila[i + 1] ? `Depois de você vem ${fila[i + 1].nome} (${fila[i + 1].papel}): deixe nos arquivos o que essa etapa precisa.\n` : 'Você fecha a esteira: o resultado tem que funcionar e ter teste automatizado.\n') +
        `Faça só a sua parte do pedido.\nPEDIDO: ${texto}`,
    }));
    this.emitir({ tipo: 'esteira', etapas });
    return etapas;
  }

  // Portão: quem roda os testes é o orquestrador, depois da última edição. A palavra do agente não conta.
  async portao() {
    const comando = this.comandoTeste || await detectarTeste(this.projeto);
    if (!comando) { const g = { ok: false, comando: null, saida: 'Nenhum teste automatizado encontrado no projeto.' }; this.emitir({ tipo: 'portao', ...g }); return g; }
    // Isolamento: os testes só alcançam a pasta do projeto. Vale para "node --test"; outros comandos rodam como antes, e o portão avisa.
    let iso = null, alvo = null, semIsolamento = '';
    if (this.isolarTestes === false) semIsolamento = 'desligado nas Configurações';
    else if (!(alvo = await comandoIsolavel(comando, this.projeto))) semIsolamento = `só "node --test" roda isolado; "${comando}" roda com as suas permissões`;
    else { iso = await prepararIsolamento(this.projeto); if (!iso.ok) semIsolamento = iso.motivo; }
    const isolado = !!iso?.ok;
    this.emitir({ tipo: 'portao_rodando', comando, isolado });
    let r;
    try { r = await rodar(isolado ? iso.comando(alvo) : comando, { cwd: this.projeto, sinal: this.abort.signal, limiteMs: this.limiteTestesMs || 180000, env: isolado ? iso.env : undefined }); }
    finally { await iso?.limpar?.(); }
    if (r.codigo === -2) throw new Error('interrompido');
    const bloqueou = isolado && /ERR_ACCESS_DENIED/.test(r.saida);
    const g = { ok: r.codigo === 0, comando, saida: (r.saida + (bloqueou ? EXPLICACAO_BLOQUEIO : '')).slice(-3200), depoisDaUltimaEdicao: true, isolado, ...(semIsolamento && { semIsolamento }) };
    this.emitir({ tipo: 'portao', ...g });
    return g;
  }

  autorDoErro(saida, reserva) {
    // Ferramenta ou módulo que não existe é escolha de quem montou o package.json, não de quem escreveu por último.
    // (o cmd devolve "n?o ? reconhecido" na página de código do console: casa só a parte sem acento)
    if (/reconhecido como um comando|not recognized|command not found|Cannot find (module|package)|ERR_MODULE_NOT_FOUND/i.test(saida) && this.autores.has('package.json')) return this.autores.get('package.json');
    for (const [arq, id] of this.autores) if (saida.includes(path.basename(arq))) return id;
    return [...this.autores.values()].pop() || reserva;
  }

  async revisar() {
    const rev = this.agente(this.idRevisor);
    if (!rev) return { aprovado: true, achados: [], fala: '(sem revisor configurado)' };
    const dif = await diferencas(this.projeto, this.foto);
    const resumo = dif.map((d) => `### ${d.arquivo} (${d.tipo}, por ${this.autores.get(d.arquivo) || '?'})\n` + d.linhas.map((l) => l.t + l.l).join('\n').slice(0, 2500)).join('\n\n').slice(0, 9000);
    const inteiro = dif.map((d) => `### ${d.arquivo}`).join('').length + dif.reduce((n, d) => n + d.linhas.reduce((m, l) => m + l.l.length + 2, 0), 0);
    const cortado = inteiro > resumo.length + 200;
    const lista = dif.map((d) => `- ${d.arquivo} (${d.tipo}, por ${this.autores.get(d.arquivo) || this.autoresPendentes?.get(d.arquivo) || '?'})`).join('\n');
    const tarefa = `Revise as mudanças abaixo. Os testes já passaram no portão. Procure defeitos reais (lógica, segurança, contrato), não estilo.\n` +
      `Em "achados", ponha só o que precisa ser corrigido agora; se aprovar com alguma ressalva menor, descreva-a em "achados" mesmo assim, que ela vai para o usuário.\n` +
      `Responda SOMENTE com JSON: {"aprovado":true|false,"fala":"uma frase","achados":[{"agente":"id de quem escreveu","arquivo":"...","problema":"..."}]}\n\n` +
      `ARQUIVOS ALTERADOS (${dif.length}):\n${lista}\n\n` +
      (cortado ? 'ATENÇÃO: o resumo abaixo está CORTADO por tamanho. Leia os arquivos completos com as ferramentas antes de dar o veredito.\n\n' : '') +
      `MUDANÇAS:\n${resumo}`;
    // Revisa no nível da parte mais difícil do que foi feito.
    // nível do revisor: o escolhido nele ou o padrão do papel; em "auto", o da parte mais difícil do trabalho
    const complexidade = nivelFixo(rev) || maior([...this.niveis.values()]);
    const idT = this.novaTarefa(rev.id, 'Revisão das mudanças', 'trabalhando', { complexidade });
    this.tarefaDe.set(rev.id, idT);
    const r = await this.executar(rev, tarefa, { complexidade });
    const j = extrairJson(r.texto);
    const v = j && typeof j.aprovado === 'boolean' ? j : { aprovado: false, fala: 'Veredito ilegível.', achados: [], ilegivel: true };
    v.achados = Array.isArray(v.achados) ? v.achados : [];
    this.emitir({ tipo: 'concluiu', agente: rev.id, segundos: +r.segundos.toFixed(1), passos: r.passos, arquivos: [], modelo: r.modelo, complexidade });
    this.tarefa(idT, { estado: v.aprovado ? 'pronto' : 'falhou', motivo: v.aprovado ? '' : (v.fala || 'Reprovado.') });
    this.emitir({ tipo: 'veredito', agente: rev.id, aprovado: v.aprovado, texto: v.fala || '', achados: v.achados });
    this.status(rev.id, 'disponivel');
    return v;
  }

  // Para quem um agente da rede pode passar a vez. Sem "conexoes", para todos (rede completa).
  conexoes(a) {
    const membros = this.cfg.agentes.filter((x) => x.funcao !== 'revisor' && x.id !== a.id);
    return Array.isArray(a.conexoes) ? membros.filter((x) => a.conexoes.includes(x.id)) : membros;
  }

  // Rede: sem chefe nem plano. O primeiro da lista começa; cada um faz a sua parte e escolhe
  // quem continua entre os vizinhos, ou encerra. Um teto de passagens evita ping-pong sem fim.
  async rede(texto, rastro) {
    const membros = this.cfg.agentes.filter((a) => a.funcao !== 'revisor');
    const teto = this.cfg.maxPassagens ?? Math.min(12, membros.length * 2);
    const feito = [];
    let atual = membros[0];
    this.emitir({ tipo: 'rede', entrada: atual.id, teto });
    for (let vez = 1; atual; vez++) {
      const vizinhos = this.conexoes(atual);
      const tarefa = `Você faz parte de uma rede de agentes sem chefe. Seu papel: ${atual.papel}.\nPEDIDO: ${texto}\n` +
        (feito.length ? `O que já foi feito:\n${feito.map((f) => `- ${f}`).join('\n')}\nLeia os arquivos antes de mexer.\n` : 'Você começa.\n') +
        `Já participaram: ${[...new Set(rastro.participantes)].join(', ') || 'ninguém'}\n` +
        `Faça só a parte que é sua. Depois decida quem continua.\n` +
        (vizinhos.length ? `Pode passar para:\n${vizinhos.map((v) => `- ${v.id}: ${v.papel}`).join('\n')}\n` : '') +
        `Termine a resposta com uma linha só de JSON: {"proximo":"id de quem continua ou fim","motivo":"..."}. Use "fim" quando o pedido estiver pronto e testado.`;
      const r = await this.etapa(atual.id, tarefa, '', nivelFixo(atual) || 'media', { titulo: `Vez ${vez} na rede: ${atual.papel}` });
      rastro.anterior = atual.id; rastro.primeiro ??= atual.id; rastro.participantes.push(atual.id);
      feito.push(`${atual.nome}: ${r.fala}`);
      const j = extrairJson(r.texto.slice(r.texto.lastIndexOf('{"proximo"') >= 0 ? r.texto.lastIndexOf('{"proximo"') : r.texto.lastIndexOf('{')));
      const proximo = vizinhos.find((v) => v.id === j?.proximo);
      if (!proximo) { this.emitir({ tipo: 'aviso', texto: j?.proximo && j.proximo !== 'fim' ? `${atual.nome} quis passar para "${j.proximo}", que não está entre os vizinhos dele: a rede para aqui.` : `${atual.nome} encerrou a rede.` }); break; }
      if (vez >= teto) { this.emitir({ tipo: 'aviso', texto: `Limite de ${teto} passagens na rede: segue para os testes.` }); break; }
      this.emitir({ tipo: 'passagem', de: atual.id, para: proximo.id, texto: j.motivo || 'Sua vez.' });
      atual = proximo;
    }
  }

  async fluxoTime(texto) {
    const arq = this.arquitetura;
    const sequencial = arq === 'sequencial' || arq === 'unico' || arq === 'rede';   // sem líder: nada de sessão de líder
    const rastro = { anterior: null, primeiro: null, participantes: [] };
    if (arq === 'rede') await this.rede(texto, rastro);
    else {
      const etapas = arq === 'unico' ? [{ agente: this.cfg.agentes.find((a) => a.funcao !== 'revisor').id, tarefa: texto, complexidade: nivelFixo(this.cfg.agentes.find((a) => a.funcao !== 'revisor')) || 'media' }]
        : arq === 'sequencial' ? this.esteira(texto) : await this.planejar(texto);
      if (!etapas) { this.emitir({ tipo: 'final', aprovado: null, ciclos: 0, motivo: 'conversa', conversa: true }); return; }
      await this.rodarEtapas(etapas, texto, rastro);
    }
    let anterior = { agente: rastro.anterior };
    const primeiro = rastro.primeiro;
    let aprovado = false; let ciclos = 0; let motivo = ''; let ressalvas = [];
    while (true) {
      const g = await this.portao();
      if (!g.ok) {
        motivo = 'testes não passaram';
        if (++ciclos > this.maxCiclos) break;
        const alvo = this.autorDoErro(g.saida, primeiro);
        // Quem errou tenta de novo um nível acima: se o modelo leve não deu conta, o próximo é mais forte.
        const nv = subir(this.niveis.get(alvo));
        this.emitir({ tipo: 'devolucao', de: 'portao', para: alvo, texto: 'Os testes não passaram. Volta para quem fez.', complexidade: nv });
        await this.etapa(alvo, `TESTES FALHARAM (comando: ${g.comando || 'nenhum'}). Corrija o código ou crie os testes que faltam.\nSaída:\n${g.saida}`, `Pedido original: ${texto}`, nv, { titulo: 'Correção: os testes não passaram' });
        continue;
      }
      if (this.idRevisor) this.emitir({ tipo: 'passagem', de: anterior.agente, para: this.idRevisor, texto: 'Terminamos. Pode revisar?' });
      const v = await this.revisar();
      if (v.aprovado) { aprovado = true; motivo = ''; ressalvas = v.achados; break; }
      motivo = 'revisor reprovou';
      if (++ciclos > this.maxCiclos) break;
      const porAgente = new Map();
      for (const a of v.achados) { const id = this.agente(a.agente) && a.agente !== this.idRevisor ? a.agente : (this.autores.get(a.arquivo) || primeiro); porAgente.set(id, [...(porAgente.get(id) || []), a]); }
      if (!porAgente.size) porAgente.set(primeiro, [{ arquivo: '?', problema: v.fala || 'reprovado sem detalhe' }]);
      for (const [id, achados] of porAgente) {
        const nv = subir(this.niveis.get(id));
        this.emitir({ tipo: 'devolucao', de: this.idRevisor, para: id, texto: 'Reprovado. Volta para quem fez.', complexidade: nv });
        // o que o revisor apontou vira nota: da próxima vez o agente já começa sabendo
        for (const a of achados) await this.lembrar(id, `O revisor já reprovou (${a.arquivo || '?'}): ${a.problema}`);
        await this.etapa(id, `REVISOR REPROVOU. Corrija:\n${achados.map((a) => `- ${a.arquivo}: ${a.problema}`).join('\n')}`, `Pedido original: ${texto}`, nv,
          { titulo: `Correção: ${achados.map((a) => a.problema).join('; ')}` });
        anterior = { agente: id };
      }
    }
    for (const t of this.quadro.values()) if (t.estado === 'revisao') this.tarefa(t.id, { estado: aprovado ? 'pronto' : 'falhou', motivo: aprovado ? '' : `Entrega não aprovada: ${motivo}.` });
    this.emitir({ tipo: 'final', aprovado, ciclos, motivo, ressalvas: ressalvas.map((a) => ({ arquivo: a.arquivo || '?', problema: String(a.problema || '').slice(0, 400) })) });
    if (!sequencial) this.lider.push({ role: 'user', content: `RESULTADO DO PEDIDO ANTERIOR: ${aprovado ? 'aprovado' : 'NÃO aprovado (' + motivo + ')'} após ${ciclos} devolução(ões). Arquivos: ${[...this.autores.keys()].join(', ') || 'nenhum'}.` },
      { role: 'assistant', content: '{"fala":"Registrado."}' });
  }

  async pedido({ texto, projeto, para, comandoTeste }) {
    if (this.rodando) throw new Error('há um pedido em andamento');
    const pasta = path.resolve(String(projeto || ''));
    const st = await fs.stat(pasta).catch(() => null);
    if (!projeto || !st?.isDirectory()) throw new Error(`pasta de projeto não encontrada: ${projeto || '(vazia)'}`);
    if (para && para !== 'time' && !this.agente(para)) throw new Error(`agente "${para}" não existe neste time`);
    // A foto pendente é de outra pasta: descartar depois restauraria os arquivos de um projeto dentro do outro.
    if (this.foto && this.projeto && pasta !== this.projeto) throw Object.assign(new Error(`há mudanças esperando sua decisão em ${this.projeto}: escolha manter ou descartar antes de trabalhar em outra pasta`), { codigo: 'decisao' });
    this.rodando = true; this.projeto = pasta; this.comandoTeste = comandoTeste || null; this.pedidoAtual = String(texto || '');
    this.abort = new AbortController(); this.autores = new Map(); this.niveis = new Map(); this.ultimaEdicao = 0;
    this.quadro = new Map(); this.tarefaDe = new Map(); this.seqTarefa = 0;
    if (!this.foto) await this.definirFoto(await fotografar(pasta));   // mudanças acumulam até o humano decidir
    this.emitir({ tipo: 'pedido', texto, para: para || 'time', projeto: pasta });
    this.uso = { chamadas: 0, custo: 0, entrada: 0, saida: 0, informado: false }; const comecou = Date.now();
    try {
      if (para && para !== 'time') { await this.etapa(para, texto, '', null, { fim: 'pronto' }); this.emitir({ tipo: 'final', aprovado: null, ciclos: 0, motivo: 'pedido direto: sem portão nem revisão' }); }
      else await this.fluxoTime(texto);
    } catch (e) {
      if (this.abort.signal.aborted) this.emitir({ tipo: 'parado' });
      else this.emitir({ tipo: 'erro', texto: e.message, ...(e.codigo && { codigo: e.codigo }) });
    } finally {
      // o que não chegou ao fim (parada, erro) não fica pendurado no quadro
      for (const t of this.quadro.values()) if (!['pronto', 'falhou'].includes(t.estado)) this.tarefa(t.id, { estado: 'parado', motivo: 'O pedido parou antes de esta tarefa terminar.' });
      this.rodando = false;
      for (const a of this.cfg.agentes) this.status(a.id, 'disponivel');
      const u = this.uso; this.uso = null;
      this.emitir({ tipo: 'uso', segundos: Math.round((Date.now() - comecou) / 1000), chamadas: u.chamadas, ...(u.informado && { custo: +u.custo.toFixed(4), entrada: u.entrada, saida: u.saida }) });
      try {
        const arquivos = await diferencas(pasta, this.foto);
        if (!arquivos.length) await this.definirFoto(null);   // nada mudou: não há o que decidir
        for (const [arq, id] of this.autores) (this.autoresPendentes ??= new Map()).set(arq, id);
        this.emitir({ tipo: 'diff', arquivos, avisos: arquivos.avisos || [], autores: Object.fromEntries(this.autoresPendentes ?? this.autores) });
      } catch (e) { this.emitir({ tipo: 'erro', texto: `diff: ${e.message}` }); }
    }
  }
}
