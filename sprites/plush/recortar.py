# Recorta a folha de referência (16 personagens x 5 estados) em 80 imagens com fundo transparente.
# Uso, na pasta da Muvuca:  python sprites/plush/recortar.py [folha.webp|png]
# Saída: public/bonecos/<forma>-<estado>.webp
# Quando chegar uma folha em alta resolução com o mesmo layout, basta rodar de novo apontando para ela.
import sys, os
from collections import deque
from PIL import Image, ImageFilter

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
ORIGEM = sys.argv[1] if len(sys.argv) > 1 else os.path.join(AQUI, 'referencia.webp')
SAIDA = os.path.join(RAIZ, 'public', 'bonecos')
os.makedirs(SAIDA, exist_ok=True)

FORMAS = ['cartola', 'regente', 'engrenagem', 'cristal', 'pilha', 'polvo', 'livro', 'nuvem',
          'cogumelo', 'foguete', 'gato', 'lente', 'planta', 'escudo', 'tela', 'gota']
ESTADOS = ['disponivel', 'pensando', 'trabalhando', 'concluido', 'aguardando']

im = Image.open(ORIGEM).convert('RGB')
W, H = im.size
k = W / 772  # o layout foi medido na folha de 772 px; escala para folhas maiores
px = im.load()

def dist(a, b):
    return sum(abs(x - y) for x, y in zip(a, b))

# perfil de linhas: onde há desenho (fora da coluna de nomes)
def linhas():
    bg = px[int(5 * k), int(5 * k)]
    prof = [sum(dist(px[x, y], bg) > 45 for x in range(int(170 * k), W, 2)) for y in range(H)]
    segs, s = [], None
    for y in range(int(115 * k), H):
        on = prof[y] > 2
        if on and s is None: s = y
        if not on and s is not None:
            if y - s > 20 * k: segs.append((s, y))
            s = None
    if s is not None: segs.append((s, H))
    return segs

segs = linhas()
assert len(segs) == 16, f'esperava 16 linhas de personagens, achei {len(segs)}: {segs}'
cortes = [int(110 * k)] + [(segs[i][1] + segs[i + 1][0]) // 2 for i in range(15)] + [min(H, segs[-1][1] + int(8 * k))]
passo = 119.5 * k
centros = [231 * k + passo * i for i in range(5)]
LARG = int(round(passo))
ALT = max(cortes[i + 1] - cortes[i] for i in range(16))

lum = lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
sat = lambda c: max(c) - min(c)

def sem_fundo(cel):
    w, h = cel.size
    p = cel.load()
    borda = [p[x, 0] for x in range(w)] + [p[x, h - 1] for x in range(w)] + [p[0, y] for y in range(h)] + [p[w - 1, y] for y in range(h)]
    borda.sort(key=sum)
    bg = borda[len(borda) // 2]
    lb = lum(bg)
    # é fundo o que for quase da cor do fundo ou mais escuro e sem cor (a sombra difusa em volta)
    quase = lambda c: (lum(c) - lb < 16 and sat(c) < 30) or dist(c, bg) < 30
    fundo = [[False] * w for _ in range(h)]
    fila = deque([(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)])
    while fila:
        x, y = fila.popleft()
        if fundo[y][x] or not quase(p[x, y]): continue
        fundo[y][x] = True
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not fundo[ny][nx]: fila.append((nx, ny))
    # tira restos pequenos (pedaços do vizinho cortados na borda)
    visto = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            if fundo[y][x] or visto[y][x]: continue
            comp, f = [], deque([(x, y)]); visto[y][x] = True
            while f:
                cx, cy = f.popleft(); comp.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not fundo[ny][nx] and not visto[ny][nx]:
                        visto[ny][nx] = True; f.append((nx, ny))
            toca = any(cx in (0, w - 1) or cy in (0, h - 1) for cx, cy in comp)
            if len(comp) < 14 or (toca and len(comp) < 120):
                for cx, cy in comp: fundo[cy][cx] = True
    alfa = Image.new('L', (w, h), 255)
    a = alfa.load()
    for y in range(h):
        for x in range(w):
            if fundo[y][x]: a[x, y] = 0
    # borda macia: só um anel de 1 px fica semi-transparente
    alfa = alfa.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7 * k))
    out = Image.new('RGBA', (w, h))
    o = out.load(); al = alfa.load()
    for y in range(h):
        for x in range(w):
            o[x, y] = (*p[x, y], al[x, y])
    return out

for i, forma in enumerate(FORMAS):
    y0, y1 = cortes[i], cortes[i + 1]
    limpos = []
    for j in range(len(ESTADOS)):
        x0 = int(round(centros[j] - passo / 2))
        limpos.append(sem_fundo(im.crop((x0, y0, x0 + LARG, y1))))
    # alinha a linha inteira pelo pé mais baixo dos cinco estados, para o boneco não pular ao trocar de estado
    pe = max(l.getchannel('A').point(lambda v: 255 if v > 60 else 0).getbbox()[3] for l in limpos)
    for estado, limpo in zip(ESTADOS, limpos):
        tela = Image.new('RGBA', (LARG, ALT), (0, 0, 0, 0))
        tela.paste(limpo, (0, ALT - 2 - pe))
        tela.save(os.path.join(SAIDA, f'{forma}-{estado}.webp'), 'WEBP', quality=92, method=6)
print(f'{len(FORMAS) * len(ESTADOS)} imagens de {LARG}x{ALT} em {SAIDA}')
