"""Gera public/data/star-map.json: as estrelas do AT-HYG a menos de 100 parsecs do Sol, em coordenadas galácticas.

Fonte: AT-HYG v3.2, subconjunto "HYGLike" (D. Nash / astronexus, CC BY-SA 4.0). Distâncias da Gaia DR3 quando
existem; Hipparcos ou Gliese nas restantes. O HYG reúne os catálogos Hipparcos, Yale Bright Star e Gliese: não é um
censo completo da vizinhança do Sol (faltam muitas anãs vermelhas e anãs brancas ténues).

Posições: calculadas a partir da ascensão reta, declinação e distância do catálogo (J2000) e rodadas para o sistema
galáctico com a matriz da IAU (introdução ao catálogo Hipparcos, ESA 1997, vol. 1, secção 1.5.3):
x aponta para o centro da Galáxia (l = 0°, b = 0°), y para l = 90° (sentido da rotação galáctica) e z para o polo
norte galáctico.

Uso: git clone --depth 1 https://github.com/astronexus/HYG-Database HYG
     python3 scripts/build_star_map.py HYG/hyg/athyg_v3/hyglike_from_athyg_v32.csv.gz <d3-celestial>/data/constellations.json
"""
import csv, gzip, json, math, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = sys.argv[1]
CONS = sys.argv[2]
MAX_PC = 100.0
LY = 3.26156

# ICRS (J2000) → galáctico
A = [
    [-0.0548755604, -0.8734370902, -0.4838350155],
    [0.4941094279, -0.4448296300, 0.7469822445],
    [-0.8676661490, -0.1980763734, 0.4559837762],
]

gen = {}
for feat in json.load(open(CONS))['features']:
    p = feat['properties']
    gen[p['desig']] = p['gen']

GREEK = {'Alp': 'α', 'Bet': 'β', 'Gam': 'γ', 'Del': 'δ', 'Eps': 'ε', 'Zet': 'ζ', 'Eta': 'η', 'The': 'θ', 'Iot': 'ι', 'Kap': 'κ',
         'Lam': 'λ', 'Mu': 'μ', 'Nu': 'ν', 'Xi': 'ξ', 'Omi': 'ο', 'Pi': 'π', 'Rho': 'ρ', 'Sig': 'σ', 'Tau': 'τ', 'Ups': 'υ',
         'Phi': 'φ', 'Chi': 'χ', 'Psi': 'ψ', 'Ome': 'ω'}
SUP = {'1': '¹', '2': '²', '3': '³', '4': '⁴'}
SRC_CODE = {'G_R3': 'G', 'G_R2': '2', 'HIP': 'H', 'GJ': 'J'}


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def designation(r):
    """Mesma ordem de preferência do catálogo de estrelas: Bayer, Flamsteed, Gliese, HIP, HD."""
    con = r['con']
    if r['bayer']:
        parts = r['bayer'].split('-')
        g = GREEK.get(parts[0], parts[0])
        if len(parts) > 1:
            g += ''.join(SUP.get(c, c) for c in parts[1])
        return f"{g} {gen.get(con, con)}"
    if r['flam']:
        return f"{r['flam']} {gen.get(con, con)}"
    if r['gl']:
        return r['gl'].replace('Gl ', 'Gliese ')
    if r['hip']:
        return f"HIP {r['hip']}"
    if r['hd']:
        return f"HD {r['hd']}"
    return f"HYG {r['id']}"


def main():
    catalog = json.load(open(os.path.join(ROOT, 'public', 'data', 'star-catalog.json')))
    in_catalog = {s['id'] for s in catalog['stars']}
    cols = {k: [] for k in ('x', 'y', 'z', 'M', 'ci', 'V', 'sp', 'des', 'id', 'src')}
    rows = csv.DictReader(gzip.open(SRC, 'rt'))
    for r in rows:
        if r['proper'] == 'Sol':
            continue
        d = num(r['dist'])
        ra = num(r['ra'])
        dec = num(r['dec'])
        if d is None or d <= 0 or d > MAX_PC or ra is None or dec is None:
            continue
        a, b = math.radians(ra * 15), math.radians(dec)
        eq = (d * math.cos(b) * math.cos(a), d * math.cos(b) * math.sin(a), d * math.sin(b))
        g = [sum(A[i][j] * eq[j] for j in range(3)) for i in range(3)]
        sid = int(r['id'])
        cols['x'].append(round(g[0], 3))
        cols['y'].append(round(g[1], 3))
        cols['z'].append(round(g[2], 3))
        absmag = num(r['absmag'])
        ci = num(r['ci'])
        mag = num(r['mag'])
        cols['M'].append(round(absmag, 2) if absmag is not None else None)
        cols['ci'].append(round(ci, 3) if ci is not None else None)
        cols['V'].append(round(mag, 2) if mag is not None else None)
        cols['sp'].append((r['spect'] or '').strip() or None)
        cols['des'].append(r['proper'] or designation(r))
        cols['id'].append(sid if sid in in_catalog else 0)
        cols['src'].append(SRC_CODE.get(r['dist_src'], 'O'))
    n = len(cols['x'])
    out = {
        'source': 'AT-HYG v3.2 (subconjunto HYGLike), D. Nash / astronexus, CC BY-SA 4.0',
        'frame': 'galáctico (IAU), parsecs, Sol na origem',
        'maxPc': MAX_PC,
        'n': n,
        **cols,
    }
    path = os.path.join(ROOT, 'public', 'data', 'star-map.json')
    json.dump(out, open(path, 'w'), ensure_ascii=False, separators=(',', ':'))
    linked = sum(1 for i in cols['id'] if i)
    gaia = sum(1 for s in cols['src'] if s == 'G')
    print(f'{n} estrelas a menos de {MAX_PC:g} pc; {linked} com ficha; {gaia} com distância Gaia DR3; {os.path.getsize(path)} bytes')


if __name__ == '__main__':
    main()
