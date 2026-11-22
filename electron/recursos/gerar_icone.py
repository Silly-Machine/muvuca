# Gera o ícone do aplicativo (icon.png, 1024 px) a partir da marca: dois círculos de pelúcia, cinza-escuro e laranja.
# Uso: python -I electron/recursos/gerar_icone.py
import os
from PIL import Image, ImageFilter

LADO = 1024
AQUI = os.path.dirname(os.path.abspath(__file__))


def bola(raio, cores):
    """Círculo com degradê radial deslocado para cima e para a esquerda, como na marca da tela."""
    lado = raio * 2
    img = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
    px = img.load()
    cx, cy, alcance = lado * 0.35, lado * 0.28, lado * 0.80
    paradas = [(0.0, cores[0]), (0.6, cores[1]), (1.0, cores[2])]
    for y in range(lado):
        for x in range(lado):
            if (x - raio + 0.5) ** 2 + (y - raio + 0.5) ** 2 > raio * raio:
                continue
            t = min(1.0, ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / alcance)
            for (t0, c0), (t1, c1) in zip(paradas, paradas[1:]):
                if t <= t1:
                    k = (t - t0) / (t1 - t0)
                    px[x, y] = tuple(round(c0[i] + (c1[i] - c0[i]) * k) for i in range(3)) + (255,)
                    break
    return img


def hexa(s):
    return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))


def main():
    escala = 2  # desenha no dobro e reduz: borda lisa
    tela = Image.new('RGBA', (LADO * escala, LADO * escala), (0, 0, 0, 0))
    raio = round(LADO * escala * 0.283)
    cinza = bola(raio, [hexa('#8d8389'), hexa('#5f565c'), hexa('#453d43')])
    laranja = bola(raio, [hexa('#ffc98a'), hexa('#f28a2e'), hexa('#c9641a')])
    meio = LADO * escala // 2
    for img, cx in ((cinza, round(LADO * escala * 0.367)), (laranja, round(LADO * escala * 0.667))):
        sombra = Image.new('RGBA', tela.size, (0, 0, 0, 0))
        mascara = img.split()[3].point(lambda a: round(a * 0.35))
        sombra.paste((0, 0, 0, 255), (cx - raio, meio - raio + round(raio * 0.09)), mascara)
        tela = Image.alpha_composite(tela, sombra.filter(ImageFilter.GaussianBlur(raio * 0.06)))
        tela.alpha_composite(img, (cx - raio, meio - raio))
    tela.resize((LADO, LADO), Image.LANCZOS).save(os.path.join(AQUI, 'icon.png'))
    print('icon.png gerado')


if __name__ == '__main__':
    main()
