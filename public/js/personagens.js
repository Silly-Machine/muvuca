// Os personagens: imagens por estado e o desenho vetorial de reserva.
/* ---------- personagens ---------- */
function mistura(hex, alvo, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = p(hex), b = p(alvo);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
const TINTA = '#1d1620';
function rosto(x1, x2, y, r = 6.5) {
  const olho = (x) => `<g><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.25}" fill="${TINTA}"/><circle cx="${x + r * .35}" cy="${y - r * .5}" r="${r * .33}" fill="#fff"/></g>`;
  const m = (x1 + x2) / 2, by = y + r * 2.5;
  return `<g class="rosto">
    <g class="o-normal">${olho(x1)}${olho(x2)}</g>
    <g class="o-foco" fill="none" stroke="${TINTA}" stroke-width="4.5" stroke-linecap="round"><path d="M${x1 - r} ${y}h${r * 2}"/><path d="M${x2 - r} ${y}h${r * 2}"/></g>
    <g class="o-feliz" fill="none" stroke="${TINTA}" stroke-width="4.5" stroke-linecap="round"><path d="M${x1 - r} ${y + 3}q${r} ${-r * 1.7} ${r * 2} 0"/><path d="M${x2 - r} ${y + 3}q${r} ${-r * 1.7} ${r * 2} 0"/></g>
    <g class="o-susto"><circle cx="${x1}" cy="${y}" r="${r * 1.35}" fill="#fff"/><circle cx="${x1}" cy="${y}" r="${r * .55}" fill="${TINTA}"/><circle cx="${x2}" cy="${y}" r="${r * 1.35}" fill="#fff"/><circle cx="${x2}" cy="${y}" r="${r * .55}" fill="${TINTA}"/></g>
    <ellipse class="bochecha" cx="${x1 - r * 1.3}" cy="${y + r * 1.9}" rx="${r}" ry="${r * .6}" fill="#ff7b96" opacity=".55"/><ellipse class="bochecha" cx="${x2 + r * 1.3}" cy="${y + r * 1.9}" rx="${r}" ry="${r * .6}" fill="#ff7b96" opacity=".55"/>
    <path class="b-curva" d="M${m - 5} ${by}q5 5 10 0" fill="none" stroke="${TINTA}" stroke-width="3" stroke-linecap="round"/>
    <path class="b-reta" d="M${m - 4} ${by + 1}h8" fill="none" stroke="${TINTA}" stroke-width="3" stroke-linecap="round"/>
    <path class="b-aberta" d="M${m - 7} ${by - 1}h14a7 7 0 0 1 -14 0z" fill="${TINTA}"/>
  </g>`;
}
const pes = (c, x1, x2, y) => `<ellipse class="pe-e" cx="${x1}" cy="${y}" rx="11" ry="6.5" fill="${c.esc}"/><ellipse class="pe-d" cx="${x2}" cy="${y}" rx="11" ry="6.5" fill="${c.esc}"/>`;
const maos = (c, x1, x2, y) => `<circle class="mao-e" cx="${x1}" cy="${y}" r="7.5" fill="${c.cla}"/><circle class="mao-d" cx="${x2}" cy="${y}" r="7.5" fill="${c.cla}"/>`;

const PERSONAGENS = {
  // Maestro: cápsula de gravata-borboleta, com topete e batuta
  regente: (c) => `${pes(c, 64, 96, 150)}
    <g class="tufo"><path d="M80 34q-10 -16 -18 -10M80 34q0 -20 6 -22M80 34q12 -14 20 -6" fill="none" stroke="${c.esc}" stroke-width="5" stroke-linecap="round"/></g>
    <rect x="44" y="34" width="72" height="112" rx="36" fill="url(#${c.g})"/>
    <path d="M58 52q8 -12 22 -12" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".35"/>
    ${rosto(68, 92, 76)}
    <g fill="${TINTA}"><path d="M80 116l-15 -8v16zM80 116l15 -8v16z"/><circle cx="80" cy="116" r="4" fill="${c.cla}"/></g>
    <circle class="mao-e" cx="42" cy="110" r="7.5" fill="${c.cla}"/>
    <g class="antena" style="transform-origin:0% 100%"><path d="M118 106l20 -34" stroke="#f1ecdf" stroke-width="3.5" stroke-linecap="round"/><circle cx="138" cy="72" r="3.5" fill="#f1ecdf"/></g><circle class="mao-d" cx="118" cy="106" r="7.5" fill="${c.cla}"/>`,
  // Chevron: três discos de servidor empilhados, com luzes
  pilha: (c) => `${pes(c, 62, 98, 152)}
    ${[[118, 0], [90, 1]].map(([y]) => `<path d="M38 ${y}v20a42 12 0 0 0 84 0v-20z" fill="url(#${c.g}l)"/><ellipse cx="80" cy="${y}" rx="42" ry="12" fill="${c.cla}"/>
      <circle class="led" cx="52" cy="${y + 17}" r="2.8" fill="#63e6a3"/><circle class="led" cx="62" cy="${y + 20}" r="2.8" fill="#ffd27a"/><circle class="led" cx="72" cy="${y + 21.5}" r="2.8" fill="#63e6a3"/>`).join('')}
    <path d="M38 48v36a42 12 0 0 0 84 0v-36z" fill="url(#${c.g}l)"/><ellipse cx="80" cy="48" rx="42" ry="12" fill="${c.cla}"/>
    <ellipse cx="68" cy="46" rx="16" ry="4" fill="#fff" opacity=".3"/>
    ${rosto(68, 92, 68)}${maos(c, 32, 128, 112)}`,
  // Pixel: cristal lapidado, cada face num tom
  cristal: (c) => `${pes(c, 66, 94, 152)}
    <polygon points="80,26 124,56 80,80 36,56" fill="${c.cla}"/>
    <polygon points="36,56 80,80 80,148 44,120" fill="${c.cor}"/>
    <polygon points="124,56 80,80 80,148 116,120" fill="${c.esc}"/>
    <polygon class="faceta-brilho" points="80,26 102,41 80,54 58,41" fill="#fff"/>
    <g transform="translate(-18 6) skewY(14)">${rosto(64, 86, 86, 5.8)}</g>
    ${maos(c, 30, 130, 104)}`,
  // Scout: esfera com um olho de lente e antena
  lente: (c) => `${pes(c, 64, 96, 152)}
    <g class="antena"><path d="M80 44v-22" stroke="${c.esc}" stroke-width="4" stroke-linecap="round"/><circle cx="80" cy="20" r="6" fill="${c.cla}"/><circle class="led" cx="80" cy="20" r="2.5" fill="#fff"/></g>
    <circle cx="80" cy="96" r="54" fill="url(#${c.g})"/>
    <path d="M44 70q10 -20 30 -24" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".3"/>
    <circle cx="80" cy="90" r="27" fill="${c.esc}"/><circle cx="80" cy="90" r="21" fill="#f6f2ff"/>
    <g class="rosto">
      <g class="o-normal"><g class="pupila"><circle cx="80" cy="90" r="11" fill="${TINTA}"/><circle cx="84" cy="85" r="3.5" fill="#fff"/></g></g>
      <g class="o-foco"><g class="pupila"><circle cx="80" cy="90" r="6" fill="${TINTA}"/></g><path d="M59 90h42" stroke="${c.cor}" stroke-width="1.5" opacity=".6"/></g>
      <path class="o-feliz" d="M66 94q14 -18 28 0" fill="none" stroke="${TINTA}" stroke-width="5" stroke-linecap="round"/>
      <g class="o-susto"><circle cx="80" cy="90" r="15" fill="${TINTA}"/><circle cx="85" cy="84" r="4.5" fill="#fff"/></g>
      <ellipse class="bochecha" cx="46" cy="112" rx="8" ry="5" fill="#ff7b96" opacity=".55"/><ellipse class="bochecha" cx="114" cy="112" rx="8" ry="5" fill="#ff7b96" opacity=".55"/>
      <path class="b-curva" d="M74 128q6 5 12 0" fill="none" stroke="${TINTA}" stroke-width="3" stroke-linecap="round"/>
      <path class="b-reta" d="M75 129h10" fill="none" stroke="${TINTA}" stroke-width="3" stroke-linecap="round"/>
      <path class="b-aberta" d="M73 126h14a7 7 0 0 1 -14 0z" fill="${TINTA}"/>
    </g>${maos(c, 26, 134, 108)}`,
  // Revisor: escudo de óculos, com selo
  escudo: (c) => `${pes(c, 66, 94, 152)}
    <path d="M80 28l46 14v42c0 30 -20 52 -46 64c-26 -12 -46 -34 -46 -64v-42z" fill="${c.esc}"/>
    <path d="M80 38l37 11v35c0 24 -15 42 -37 53c-22 -11 -37 -29 -37 -53v-35z" fill="url(#${c.g})"/>
    <path d="M52 58l22 -7" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".35"/>
    ${rosto(67, 93, 78, 5.5)}
    <g fill="none" stroke="${TINTA}" stroke-width="3"><rect x="55" y="68" width="24" height="20" rx="7"/><rect x="81" y="68" width="24" height="20" rx="7"/><path d="M55 76l-7 -3M105 76l7 -3"/></g>
    <g class="selo"><circle cx="80" cy="120" r="9" fill="${c.cla}"/><path d="M75.5 120l3.5 3.5l6 -7" fill="none" stroke="${TINTA}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></g>
    ${maos(c, 30, 130, 100)}`,
  // Líder de cartola: gravata-borboleta e batuta; a cartola balança
  cartola: (c) => `${pes(c, 62, 98, 152)}
    <rect x="38" y="56" width="84" height="92" rx="30" fill="url(#${c.g})"/>
    <path d="M52 78q6 -10 18 -12" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".35"/>
    <g class="tufo"><ellipse cx="80" cy="58" rx="40" ry="7" fill="#3b3352"/><rect x="57" y="18" width="46" height="42" rx="6" fill="#3b3352"/><rect x="57" y="45" width="46" height="8" fill="${c.cla}"/><path d="M64 24v16" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".25"/></g>
    ${rosto(67, 93, 90, 6)}
    <g fill="${TINTA}"><path d="M80 126l-14 -7v14zM80 126l14 -7v14z"/><circle cx="80" cy="126" r="3.6" fill="${c.cla}"/></g>
    <circle class="mao-e" cx="36" cy="114" r="7.5" fill="${c.cla}"/>
    <g class="antena" style="transform-origin:0% 100%"><path d="M124 108l20 -34" stroke="#f1ecdf" stroke-width="3.5" stroke-linecap="round"/><circle cx="144" cy="74" r="3.5" fill="#f1ecdf"/></g><circle class="mao-d" cx="124" cy="108" r="7.5" fill="${c.cla}"/>`,
  // Engrenagem: os dentes giram devagar (rápido quando trabalha); a cara fica parada
  engrenagem: (c) => {
    const pts = [];
    for (let k = 0; k < 8; k++) { const b = (k / 8) * 2 * Math.PI; for (const [da, r] of [[-.21, 44], [-.15, 58], [.15, 58], [.21, 44]]) pts.push(`${(80 + Math.cos(b + da) * r).toFixed(1)},${(90 + Math.sin(b + da) * r).toFixed(1)}`); }
    return `${pes(c, 62, 98, 152)}
    <g class="giro"><polygon points="${pts.join(' ')}" fill="${c.esc}"/></g>
    <circle cx="80" cy="90" r="46" fill="url(#${c.g})"/>
    <circle cx="80" cy="90" r="46" fill="none" stroke="${c.esc}" stroke-width="2" opacity=".5"/>
    <path d="M52 72q8 -16 26 -20" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".35"/>
    ${rosto(67, 93, 88, 6.5)}${maos(c, 26, 134, 112)}`;
  },
  // Monitor de antena: a cara aparece na tela
  tela: (c) => `${pes(c, 64, 96, 152)}
    <g class="antena"><path d="M80 32v-14" stroke="${c.esc}" stroke-width="4" stroke-linecap="round"/><circle class="led" cx="80" cy="16" r="5" fill="#ff7b96"/></g>
    <rect x="70" y="100" width="20" height="14" fill="${c.esc}"/>
    <rect x="46" y="108" width="68" height="40" rx="14" fill="${c.cor}"/>
    <circle class="led" cx="62" cy="128" r="3" fill="#63e6a3"/><circle class="led" cx="72" cy="128" r="3" fill="#ffd27a"/>
    <rect x="32" y="30" width="96" height="74" rx="16" fill="${c.esc}"/>
    <rect x="40" y="37" width="80" height="60" rx="10" fill="url(#${c.g})"/>
    <path d="M48 46h22" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".35"/>
    ${rosto(66, 94, 62, 6)}${maos(c, 38, 122, 126)}`,
  // Gota
  gota: (c) => `${pes(c, 64, 96, 152)}
    <path d="M80 22C98 50 128 78 128 106a48 44 0 0 1 -96 0C32 78 62 50 80 22z" fill="url(#${c.g})"/>
    <path d="M58 84q4 -14 14 -22" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".4"/>
    ${rosto(68, 92, 100, 6)}${maos(c, 30, 130, 116)}`,
  // Nuvem
  nuvem: (c) => `${pes(c, 64, 96, 152)}
    <g fill="${c.cor}"><circle cx="54" cy="96" r="28"/><circle cx="82" cy="74" r="34"/><circle cx="108" cy="96" r="26"/><rect x="34" y="92" width="94" height="50" rx="25"/></g>
    <g fill="${c.cla}" opacity=".7"><circle cx="72" cy="66" r="16"/><circle cx="48" cy="90" r="10"/></g>
    <path d="M62 60q8 -12 22 -13" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".45"/>
    ${rosto(68, 94, 100, 6)}${maos(c, 28, 132, 120)}`,
  // Cogumelo: chapéu colorido de bolinhas, cara no pé
  cogumelo: (c) => `${pes(c, 64, 96, 152)}
    <rect x="50" y="72" width="60" height="76" rx="24" fill="#f3e9da"/>
    <path d="M26 84Q26 30 80 28Q134 30 134 84Q80 96 26 84z" fill="url(#${c.g})"/>
    <g fill="#fff" opacity=".75"><circle cx="58" cy="54" r="7"/><circle cx="92" cy="46" r="9"/><circle cx="114" cy="66" r="5"/><circle cx="44" cy="74" r="4"/></g>
    ${rosto(68, 92, 108, 5.5)}${maos(c, 42, 118, 126)}`,
  // Polvo: quatro tentáculos que batucam quando trabalha
  polvo: (c) => `
    <g fill="${c.esc}">
      <path class="pe-e" d="M44 112q-14 22 -4 38q6 6 10 -2q-6 -14 8 -30z"/><path class="pe-d" d="M116 112q14 22 4 38q-6 6 -10 -2q6 -14 -8 -30z"/>
      <path class="pe-d" d="M64 120q-6 20 2 32q6 4 8 -4q-4 -12 4 -26z"/><path class="pe-e" d="M96 120q6 20 -2 32q-6 4 -8 -4q4 -12 -4 -26z"/>
    </g>
    <ellipse cx="80" cy="84" rx="48" ry="46" fill="url(#${c.g})"/>
    <path d="M50 62q10 -18 30 -20" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".35"/>
    <g fill="${c.esc}" opacity=".5"><circle cx="58" cy="110" r="3"/><circle cx="102" cy="110" r="3"/><circle cx="80" cy="116" r="3"/></g>
    ${rosto(66, 94, 82, 6.5)}`,
  // Foguete: cara na escotilha, chama piscando
  foguete: (c) => `
    <g class="led"><path d="M68 140q12 30 24 0z" fill="#ffd27a"/><path d="M73 140q7 18 14 0z" fill="#ff7b96"/></g>
    <path d="M50 108l-18 32h26z" fill="${c.esc}"/><path d="M110 108l18 32h-26z" fill="${c.esc}"/>
    <path d="M80 18C108 40 114 80 108 140H52C46 80 52 40 80 18z" fill="url(#${c.g})"/>
    <path d="M66 40q8 -10 14 -14" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".4"/>
    <rect x="52" y="128" width="56" height="12" rx="4" fill="${c.esc}"/>
    <circle cx="80" cy="78" r="25" fill="${c.esc}"/><circle cx="80" cy="78" r="20" fill="#f6f2ff"/>
    ${rosto(72, 88, 74, 4.2)}`,
  // Gato vigia: orelhas que balançam e bigodes
  gato: (c) => `${pes(c, 64, 96, 152)}
    <g class="tufo"><path d="M42 66L44 22L76 48z" fill="${c.esc}"/><path d="M118 66L116 22L84 48z" fill="${c.esc}"/><path d="M50 54L49 33L66 46zM110 54L111 33L94 46z" fill="#ff9db1" opacity=".75"/></g>
    <rect x="34" y="40" width="92" height="108" rx="42" fill="url(#${c.g})"/>
    <g stroke="${TINTA}" stroke-width="2" stroke-linecap="round" opacity=".5"><path d="M38 94h18M38 102l18 -3M122 94h-18M122 102l-18 -3"/></g>
    ${rosto(66, 94, 80, 6)}${maos(c, 32, 128, 120)}`,
  // Livro: capa com cara, lombada escura e páginas
  livro: (c) => `${pes(c, 64, 96, 152)}
    <rect x="40" y="30" width="86" height="116" rx="10" fill="#f6f2ff"/>
    <path d="M120 40v96" stroke="#d9d2ec" stroke-width="3"/>
    <rect x="34" y="26" width="86" height="116" rx="10" fill="url(#${c.g})"/>
    <rect x="34" y="26" width="14" height="116" rx="6" fill="${c.esc}"/>
    <path d="M60 44h46" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".35"/>
    ${rosto(72, 98, 82, 6)}
    <path d="M68 124h36" stroke="${c.esc}" stroke-width="3" stroke-linecap="round"/>
    ${maos(c, 30, 132, 104)}`,
  // Vaso de planta: folhas que balançam, cara no vaso
  planta: (c) => `${pes(c, 64, 96, 152)}
    <g class="tufo"><path d="M80 66C60 58 50 38 58 22C72 30 80 48 80 66z" fill="#63e6a3"/><path d="M80 66C100 56 112 38 104 20C88 28 80 48 80 66z" fill="#3fbf84"/><path d="M80 68V44" stroke="#2f8f62" stroke-width="4" stroke-linecap="round"/></g>
    <path d="M38 68h84l-10 80H48z" fill="url(#${c.g})"/>
    <rect x="34" y="62" width="92" height="16" rx="6" fill="${c.esc}"/>
    ${rosto(68, 92, 102, 6)}${maos(c, 34, 126, 114)}`,
};

// Personagens de pelúcia: uma imagem por forma e estado (public/bonecos, recortadas por sprites/plush/recortar.py).
// O estado do agente só troca qual imagem aparece; respirar, pular e tremer continuam no .corpo.
const ESTADOS_BONECO = ['disponivel', 'pensando', 'trabalhando', 'concluido', 'aguardando'];
function mascote(a, i) {
  const forma = PERSONAGENS[a.forma] ? a.forma : 'regente';
  const nome = String(a.nome || forma).replace(/[&<>"']/g, '');
  const imagens = ESTADOS_BONECO.map((e) => `<image class="img img-${e}" href="/bonecos/${forma}-${e}.webp" x="0" y="0" width="160" height="164"/>`).join('');
  return `<svg class="mascote" viewBox="0 0 160 170" role="img" aria-label="${nome}" style="--i:${i}">
    <ellipse class="sombra" cx="80" cy="160" rx="40" ry="6" fill="#000" opacity=".4"/>
    <g class="corpo">${imagens}</g>
  </svg>`;
}

// Versão vetorial antiga (desenhada por código), mantida só para o pacote de sprites/gerar.cjs.
function mascoteVetor(a, i, sufixo = '') {
  // o id do gradiente leva um sufixo por lugar (palco, fichas, prévia): o mesmo agente aparece em vários
  const cor = /^#[0-9a-f]{6}$/i.test(a.cor || '') ? a.cor : '#8f7bff';
  const c = { cor, cla: mistura(cor, '#ffffff', .38), esc: mistura(cor, '#1a0f2a', .42), g: 'g-' + String(a.id).replace(/[^a-z0-9-]/gi, '_') + sufixo };
  const corpo = (PERSONAGENS[a.forma] || PERSONAGENS.regente)(c);
  return `<svg class="mascote" viewBox="0 0 160 170" role="img" aria-label="${a.nome}" style="--i:${i}">
    <defs>
      <radialGradient id="${c.g}" cx="34%" cy="26%" r="85%"><stop offset="0" stop-color="${c.cla}"/><stop offset=".55" stop-color="${c.cor}"/><stop offset="1" stop-color="${c.esc}"/></radialGradient>
      <linearGradient id="${c.g}l" x1="0" x2="1"><stop offset="0" stop-color="${c.cor}"/><stop offset=".55" stop-color="${c.cor}"/><stop offset="1" stop-color="${c.esc}"/></linearGradient>
    </defs>
    <ellipse class="sombra" cx="80" cy="158" rx="46" ry="8" fill="#000" opacity=".45"/>
    <g class="corpo">${corpo}
      <g class="notebook"><path d="M50 150h60l5 9h-70z" fill="#cfcbe0"/><rect x="54" y="122" width="52" height="30" rx="4" fill="#2a2638"/><rect x="58" y="126" width="44" height="22" rx="2" fill="#16131f"/>
        <rect class="tela-linha" x="62" y="130" width="30" height="2.5" rx="1" fill="${c.cla}"/><rect class="tela-linha" x="62" y="136" width="22" height="2.5" rx="1" fill="#63e6a3"/><rect class="tela-linha" x="62" y="142" width="34" height="2.5" rx="1" fill="#ffd27a"/></g>
    </g>
    <g class="digitando"><rect x="104" y="6" width="46" height="22" rx="11" fill="#f1ecdf"/><circle cx="116" cy="17" r="3" fill="#4a4460"/><circle cx="127" cy="17" r="3" fill="#4a4460"/><circle cx="138" cy="17" r="3" fill="#4a4460"/></g>
    <g class="alerta"><circle cx="130" cy="20" r="13" fill="#ff7b96"/><path d="M130 12v9" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><circle cx="130" cy="26.5" r="2" fill="#fff"/></g>
    <g class="estrelas"><circle cx="30" cy="40" r="4" fill="#ffd27a"/><circle cx="134" cy="36" r="5" fill="#63e6a3"/><circle cx="20" cy="84" r="3" fill="#ff7b96"/><circle cx="142" cy="80" r="3.5" fill="${c.cla}"/></g>
  </svg>`;
}

export { PERSONAGENS, mascote };
