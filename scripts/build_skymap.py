"""Gera public/data/sky-map.json (linhas e etiquetas das constelações), public/data/constellation-bounds.json
(limites oficiais das constelações da IAU) e public/data/milky-way.png
(mapa equiretangular da Via Láctea, 720 × 360, níveis de brilho 1 a 5 do d3-celestial).

Fonte: d3-celestial (O. Frohn, BSD-3-Clause), ficheiros data/constellations.json,
data/constellations.lines.json, data/constellations.bounds.json e data/mw.json.
Os limites vêm de Davenhall & Leggett (1989), VizieR VI/49, convertidos pelo d3-celestial para J2000.
Uso: python3 scripts/build_skymap.py <pasta d3-celestial/data>
As coordenadas são ascensão reta (0–360°) e declinação em graus (J2000), arredondadas a 0,01° (linhas)
ou 0,1° (Via Láctea, com um em cada dois vértices).
"""
import json, os, sys
from PIL import Image, ImageChops, ImageDraw

SRC = sys.argv[1] if len(sys.argv) > 1 else 'd3-celestial/data'
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'public', 'data', 'sky-map.json')

def ra(lon):
    return round(lon % 360, 2)

lines = {}
for f in json.load(open(os.path.join(SRC, 'constellations.lines.json')))['features']:
    lines[f['id']] = [[[ra(x), round(y, 2)] for x, y in seg] for seg in f['geometry']['coordinates']]

labels = []
for f in json.load(open(os.path.join(SRC, 'constellations.json')))['features']:
    x, y = f['geometry']['coordinates']
    labels.append([f['id'], ra(x), round(y, 2), int(f['properties']['rank'])])

json.dump({'source': 'd3-celestial (O. Frohn), BSD-3-Clause', 'lines': lines, 'labels': labels},
          open(OUT, 'w'), separators=(',', ':'))
print(OUT, os.path.getsize(OUT), 'bytes;', sum(len(s) for v in lines.values() for s in v), 'vértices de linhas')

bounds = {}
for f in json.load(open(os.path.join(SRC, 'constellations.bounds.json')))['features']:
    abbr = f['id'][:3]  # a Serpente tem duas partes (Ser1, Ser2)
    rings = [[[round(x % 360, 4), round(y, 4)] for x, y in ring] for ring in f['geometry']['coordinates']]
    bounds.setdefault(abbr, []).extend(rings)
BOUNDS = os.path.join(ROOT, 'public', 'data', 'constellation-bounds.json')
json.dump({'source': 'Davenhall & Leggett (1989), VizieR VI/49, via d3-celestial (O. Frohn), BSD-3-Clause; J2000',
           'bounds': bounds}, open(BOUNDS, 'w'), separators=(',', ':'))
print(BOUNDS, os.path.getsize(BOUNDS), 'bytes;', len(bounds), 'constelações')

# Via Láctea: cada nível é um conjunto de polígonos esféricos. Os anéis que dão a volta completa ao céu
# (bordas da faixa) são fechados pelo polo norte; os anéis de cada polígono combinam-se por OU exclusivo.
# Píxel (x, y): ascensão reta = 360 − (x + 0,5) × 0,5 graus, declinação = 90 − (y + 0,5) × 0,5 graus.
W, H = 720, 360

def ring_mask(ring):
    pts, prev, off = [], None, 0
    for x, y in ring:
        lon = x % 360
        if prev is not None:
            dl = lon + off - prev
            if dl > 180: off -= 360
            elif dl < -180: off += 360
        prev = lon + off
        pts.append((lon + off, y))
    if abs(pts[-1][0] - pts[0][0]) > 180:
        pts += [(pts[-1][0], 90), (pts[0][0], 90)]
    mask = Image.new('1', (W, H), 0)
    d = ImageDraw.Draw(mask)
    for shift in (-720, -360, 0, 360, 720):
        d.polygon([((360 - (lo + shift)) * W / 360, (90 - la) * H / 180) for lo, la in pts], fill=1)
    return mask

img = Image.new('L', (W, H), 0)
for level, f in enumerate(json.load(open(os.path.join(SRC, 'mw.json')))['features'], start=1):
    acc = Image.new('1', (W, H), 0)
    for poly in f['geometry']['coordinates']:
        pm = Image.new('1', (W, H), 0)
        for ring in poly:
            pm = ImageChops.logical_xor(pm, ring_mask(ring))
        acc = ImageChops.logical_or(acc, pm)
    img.paste(level * 51, mask=acc)
PNG = os.path.join(ROOT, 'public', 'data', 'milky-way.png')
img.save(PNG, optimize=True)
print(PNG, os.path.getsize(PNG), 'bytes')
