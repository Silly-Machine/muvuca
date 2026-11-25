# Fatia as faixas geradas pelo ChatGPT (um personagem, 5 poses lado a lado, PNG transparente)
# em imagens public/bonecos/<forma>-<estado>.webp, todas do mesmo tamanho e alinhadas pelo pé.
# Cada personagem tem duas faixas: gpt/<nome>_5_estados.png (os 5 estados originais) e
# gpt-poses/<nome>_5_poses.png (as 5 poses acrescentadas depois).
# Uso, na pasta da Muvuca:
#   python assets/personagens/plush/fatiar_gpt.py            # os 5 estados originais
#   python assets/personagens/plush/fatiar_gpt.py --poses    # as 5 poses novas
import sys, os
from PIL import Image, ImageFilter, ImageChops

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(AQUI)))
POSES = '--poses' in sys.argv
args = [a for a in sys.argv[1:] if not a.startswith('--')]
ORIGEM = args[0] if args else os.path.join(AQUI, 'gpt-poses' if POSES else 'gpt')
SAIDA = os.path.join(RAIZ, 'public', 'bonecos')
os.makedirs(SAIDA, exist_ok=True)

ARQUIVOS = {
    'cartola': 'batuta_sinal', 'regente': 'relay_coordenacao', 'engrenagem': 'engrenagem',
    'cristal': 'cristal_frontend', 'pilha': 'banco_dados', 'polvo': 'polvo_testes',
    'livro': 'livro_docs', 'nuvem': 'nuvem_ux', 'cogumelo': 'cogumelo_produto',
    'foguete': 'foguete_devops', 'gato': 'sentinela_seguranca', 'lente': 'esfera_lente_pesquisa',
    'planta': 'camaleao_generalista', 'escudo': 'escudo_oculos_revisor', 'tela': 'monitor_antena',
    'gota': 'gota', 'salsicha': 'buzina_mascote',
}
ESTADOS = ['divagando', 'falhou', 'bloqueado', 'lendo', 'conferindo'] if POSES else ['disponivel', 'pensando', 'trabalhando', 'concluido', 'aguardando']
SUFIXO = '_5_poses' if POSES else '_5_estados'
# Qual pose dá o tamanho do corpo: a primeira dos estados originais (disponível); nas poses novas, a "lendo",
# que não tem nuvem, X nem ampulheta em cima da cabeça. Assim o boneco fica do mesmo tamanho nas duas faixas.
REF = 3 if POSES else 0
LARG, ALT = 320, 328          # 2x a área do boneco na Muvuca (160 x 164)
CHAO = ALT - 6                # onde fica o pé
CORPO = 0.74                  # altura do corpo (estado disponível) em relação à imagem

def cortes(alfa):
    """Acha as 4 divisas entre os 5 personagens pelos trechos de colunas vazias."""
    w, h = alfa.size
    px = alfa.load()
    soma = [sum(px[x, y] > 40 for y in range(0, h, 2)) for x in range(w)]
    trechos, ini = [], None
    for x in range(w):
        if soma[x] > 1 and ini is None: ini = x
        if soma[x] <= 1 and ini is not None: trechos.append([ini, x]); ini = None
    if ini is not None: trechos.append([ini, w])
    # junta pedaços soltos (estrela, bolha) ao vizinho mais próximo até sobrarem 5
    while len(trechos) > 5:
        k = min(range(len(trechos) - 1), key=lambda i: trechos[i + 1][0] - trechos[i][1])
        trechos[k] = [trechos[k][0], trechos[k + 1][1]]; del trechos[k + 1]
    # personagens encostados: parte o trecho mais largo na coluna mais vazia do meio dele
    while len(trechos) < 5:
        k = max(range(len(trechos)), key=lambda i: trechos[i][1] - trechos[i][0])
        a, b = trechos[k]
        meio = min(range(a + (b - a) // 4, b - (b - a) // 4), key=lambda x: soma[x])
        trechos[k:k + 1] = [[a, meio], [meio, b]]
    return [0] + [(trechos[i][1] + trechos[i + 1][0]) // 2 for i in range(4)] + [w]

def limpar_bordas(peca):
    """Apaga pedaços do vizinho que entraram na coluna: componentes pequenos encostados na lateral."""
    k = 4
    a = peca.getchannel('A')
    w, h = (a.width + k - 1) // k, (a.height + k - 1) // k
    m = a.resize((w, h), Image.BOX).load()
    rot = [[0] * w for _ in range(h)]
    comps = []
    for y in range(h):
        for x in range(w):
            if m[x, y] <= 30 or rot[y][x]: continue
            n = len(comps) + 1; pilha = [(x, y)]; rot[y][x] = n; pts = []
            while pilha:
                cx, cy = pilha.pop(); pts.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not rot[ny][nx] and m[nx, ny] > 30:
                        rot[ny][nx] = n; pilha.append((nx, ny))
            comps.append(pts)
    maior = max((len(c) for c in comps), default=0)
    apagar = [c for c in comps if len(c) < maior * 0.15 and any(px <= 1 or px >= w - 2 for px, _ in c)]
    if not apagar: return peca
    peca = peca.copy(); p = peca.load()
    for c in apagar:
        for cx, cy in c:
            for yy in range(cy * k - k, min(peca.height, cy * k + 2 * k)):
                for xx in range(max(0, cx * k - k), min(peca.width, cx * k + 2 * k)):
                    if yy >= 0: p[xx, yy] = (0, 0, 0, 0)
    return peca

def separar_por_componente(im, d):
    """Separa os 5 personagens por pedaços ligados, não por corte reto: um pedaço que invade a coluna
    do vizinho (cabo de lupa, balão, rabo) fica inteiro com o personagem que tem a maior parte dele.
    Devolve None quando dois personagens se encostam (aí vale o corte reto)."""
    k = 4
    alfa = im.getchannel('A')
    w, h = (im.width + k - 1) // k, (im.height + k - 1) // k
    m = alfa.resize((w, h), Image.BOX).load()
    coluna = lambda x: next(i for i in range(5) if x * k < d[i + 1] or i == 4)
    rot = [[-1] * w for _ in range(h)]
    dono = []
    larg_col = im.width / 5
    for y in range(h):
        for x in range(w):
            if m[x, y] <= 24 or rot[y][x] >= 0: continue
            n = len(dono); pilha = [(x, y)]; rot[y][x] = n; votos = [0] * 5; x0 = x1 = x
            while pilha:
                cx, cy = pilha.pop(); votos[coluna(cx)] += 1; x0 = min(x0, cx); x1 = max(x1, cx)
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1), (cx + 1, cy + 1), (cx - 1, cy - 1), (cx + 1, cy - 1), (cx - 1, cy + 1)):
                    if 0 <= nx < w and 0 <= ny < h and rot[ny][nx] < 0 and m[nx, ny] > 24:
                        rot[ny][nx] = n; pilha.append((nx, ny))
            if (x1 - x0) * k > 1.7 * larg_col: return None   # dois personagens grudados num pedaço só
            dono.append(votos.index(max(votos)))
    pecas = []
    for i in range(5):
        masc = Image.new('L', (w, h), 0); mp = masc.load(); xs = []
        for y in range(h):
            for x in range(w):
                if rot[y][x] >= 0 and dono[rot[y][x]] == i: mp[x, y] = 255; xs.append(x)
        if not xs: return None
        # volta ao tamanho cheio e engorda um pouco, para não comer a borda macia do pelo
        cheia = masc.resize((w * k, h * k), Image.NEAREST).crop((0, 0, im.width, im.height)).filter(ImageFilter.MaxFilter(9))
        peca = im.copy(); peca.putalpha(ImageChops.multiply(alfa, cheia))
        x0, x1 = max(0, min(xs) * k - 12), min(im.width, (max(xs) + 1) * k + 12)
        pecas.append(peca.crop((x0, 0, x1, im.height)))
    return pecas

def baixar_acessorios(peca, excesso):
    """Nas poses novas, a nuvem, o X e a ampulheta ficam altos e fariam o boneco inteiro encolher para caber.
    Em vez disso, o que está solto acima do corpo desce "excesso" pixels. Devolve None se não há nada solto."""
    k = 4
    a = peca.getchannel('A')
    w, h = (a.width + k - 1) // k, (a.height + k - 1) // k
    m = a.resize((w, h), Image.BOX).load()
    rot = [[-1] * w for _ in range(h)]
    comps = []
    for y in range(h):
        for x in range(w):
            if m[x, y] <= 24 or rot[y][x] >= 0: continue
            n = len(comps); pilha = [(x, y)]; rot[y][x] = n; pts = []
            while pilha:
                cx, cy = pilha.pop(); pts.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < w and 0 <= ny < h and rot[ny][nx] < 0 and m[nx, ny] > 24:
                        rot[ny][nx] = n; pilha.append((nx, ny))
            comps.append(pts)
    if len(comps) < 2: return None
    corpo = max(range(len(comps)), key=lambda i: len(comps[i]))
    topo = min(y for _, y in comps[corpo]); base = max(y for _, y in comps[corpo])
    soltos = [i for i in range(len(comps)) if i != corpo and sum(y for _, y in comps[i]) / len(comps[i]) < topo + (base - topo) * 0.3]
    if not soltos: return None
    masc = Image.new('L', (w, h), 0); mp = masc.load()
    for i in soltos:
        for x, y in comps[i]: mp[x, y] = 255
    cheia = masc.resize((w * k, h * k), Image.NEAREST).crop((0, 0, peca.width, peca.height)).filter(ImageFilter.MaxFilter(9))
    em_cima = peca.copy(); em_cima.putalpha(ImageChops.multiply(a, cheia))
    resto = peca.copy(); resto.putalpha(ImageChops.multiply(a, ImageChops.invert(cheia)))
    nova = Image.new('RGBA', peca.size, (0, 0, 0, 0))
    nova.alpha_composite(resto)
    nova.alpha_composite(em_cima.crop((0, 0, peca.width, peca.height - excesso)), (0, excesso))
    return nova

def centro_corpo(peca):
    """Centro horizontal do corpo: média das colunas opacas na metade de baixo (ignora bolha e estrelas)."""
    a = peca.getchannel('A')
    x0, y0, x1, y1 = a.getbbox()
    px = a.load()
    tot = n = 0
    for y in range((y0 + y1) // 2, y1, 2):
        for x in range(x0, x1, 2):
            if px[x, y] > 128: tot += x; n += 1
    return tot / n if n else (x0 + x1) / 2

# As faixas não ficam no repositório (83 MB): ficam na versão "fontes-dos-personagens" do GitHub.
if not os.path.isdir(ORIGEM):
    print(f'Não achei a pasta {ORIGEM}.\nBaixe fontes-dos-personagens.zip em '
          'https://github.com/Silly-Machine/muvuca/releases/tag/fontes-dos-personagens '
          'e descompacte dentro de assets/personagens/plush/.')
    sys.exit(1)

faltando = []
for forma, nome in ARQUIVOS.items():
    caminho = os.path.join(ORIGEM, f'{nome}{SUFIXO}.png')
    if not os.path.exists(caminho):
        faltando.append(nome); continue
    im = Image.open(caminho).convert('RGBA')
    alfa = im.getchannel('A')
    if alfa.getextrema()[0] > 200:
        print(f'AVISO {nome}: sem transparência, pulei'); faltando.append(nome); continue
    d = cortes(alfa)
    pecas = separar_por_componente(im, d)
    modo = 'por pedaços' if pecas else 'corte reto'
    if not pecas: pecas = [limpar_bordas(im.crop((d[i], 0, d[i + 1], im.height))) for i in range(5)]
    caixas = [p.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox() for p in pecas]
    # escala: o corpo do estado disponível ocupa CORPO da altura; nenhum estado pode passar do topo
    h_disp = caixas[REF][3] - caixas[REF][1]
    escala = CORPO * ALT / h_disp
    caixa_de = lambda p: p.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    if POSES:
        # o tamanho do corpo manda; o que está solto em cima (nuvem, X, ampulheta) desce o quanto precisar
        for p, c in zip(pecas, caixas): escala = min(escala, (LARG - 6) / (c[2] - c[0]))
        for i, (p, c) in enumerate(zip(pecas, caixas)):
            excesso = round((c[3] - c[1]) - (CHAO - 4) / escala)
            if excesso <= 0: continue
            nova = baixar_acessorios(p, excesso + 2)
            if nova: pecas[i] = nova; caixas[i] = caixa_de(nova)
    for p, c in zip(pecas, caixas):
        escala = min(escala, (CHAO - 4) / (c[3] - c[1]), (LARG - 6) / (c[2] - c[0]))
    for estado, p, c in zip(ESTADOS, pecas, caixas):
        cx = centro_corpo(p)
        q = p.resize((max(1, round(p.width * escala)), max(1, round(p.height * escala))), Image.LANCZOS)
        tela = Image.new('RGBA', (LARG, ALT), (0, 0, 0, 0))
        dx = round(LARG / 2 - cx * escala)
        dy = round(CHAO - c[3] * escala)
        dx = min(max(dx, -round(c[0] * escala) + 2), LARG - 2 - round(c[2] * escala))  # não corta nas laterais
        tela.alpha_composite(q, (dx, dy)) if dx >= 0 and dy >= 0 else tela.paste(q, (dx, dy), q)
        tela.save(os.path.join(SAIDA, f'{forma}-{estado}.webp'), 'WEBP', quality=90, method=6)
    print(f'{forma:<11} <- {nome}  ({im.width}x{im.height}, {modo})')
if faltando: print('faltando:', ', '.join(faltando))
