"""Gera os dados das estrelas a partir do AT-HYG (subconjunto "HYGLike" v3.2, D. Nash / astronexus, CC BY-SA 4.0).

  public/data/star-catalog.json  estrelas com nome próprio da IAU e todas as estrelas a menos de 20 anos-luz
  public/data/hr-diagram.json    índice de cor B-V e magnitude absoluta das estrelas a menos de 100 pc (diagrama H-R)

Distâncias: Gaia DR3 quando existe (cerca de 90% das estrelas); Hipparcos para as mais brilhantes.
Uso: git clone --depth 1 https://github.com/astronexus/HYG-Database HYG
     python3 scripts/build_stars.py HYG/hyg/athyg_v3/hyglike_from_athyg_v32.csv.gz <d3-celestial>/data/constellations.json
"""
import csv, gzip, json, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = sys.argv[1]
CONS = sys.argv[2]
LY = 3.26156

gen = {}
for f in json.load(open(CONS))['features']:
    p = f['properties']
    gen[p['desig']] = p['gen']

GREEK = {'Alp': 'α', 'Bet': 'β', 'Gam': 'γ', 'Del': 'δ', 'Eps': 'ε', 'Zet': 'ζ', 'Eta': 'η', 'The': 'θ', 'Iot': 'ι', 'Kap': 'κ',
         'Lam': 'λ', 'Mu': 'μ', 'Nu': 'ν', 'Xi': 'ξ', 'Omi': 'ο', 'Pi': 'π', 'Rho': 'ρ', 'Sig': 'σ', 'Tau': 'τ', 'Ups': 'υ',
         'Phi': 'φ', 'Chi': 'χ', 'Psi': 'ψ', 'Ome': 'ω'}
SUP = {'1': '¹', '2': '²', '3': '³', '4': '⁴'}

def f(x):
    try: return float(x)
    except (TypeError, ValueError): return None

def designation(r):
    con = r['con']
    if r['bayer']:
        parts = r['bayer'].split('-')
        g = GREEK.get(parts[0], parts[0])
        if len(parts) > 1: g += ''.join(SUP.get(c, c) for c in parts[1])
        return f"{g} {gen.get(con, con)}"
    if r['flam']:
        return f"{r['flam']} {gen.get(con, con)}"
    if r['gl']:
        return r['gl'].replace('Gl ', 'Gliese ').replace('GJ ', 'GJ ')
    if r['hip']:
        return f"HIP {r['hip']}"
    if r['hd']:
        return f"HD {r['hd']}"
    return None

def sig(x, n=5):
    if x is None: return None
    return float(f'{x:.{n}g}')

rows = list(csv.DictReader(gzip.open(SRC, 'rt')))
stars = []
hr = []
for r in rows:
    if r['proper'] == 'Sol': continue
    dist = f(r['dist'])
    if dist is not None and dist >= 100000: dist = None
    named = bool(r['proper'])
    near = dist is not None and dist * LY <= 20
    ci = f(r['ci']); absmag = f(r['absmag'])
    if dist is not None and dist <= 100 and ci is not None and absmag is not None and r['dist_src'].startswith('G'):
        hr.append([round(ci, 3), round(absmag, 2)])
    if not (named or near): continue
    des = designation(r)
    stars.append({
        'id': int(r['id']),
        'name': r['proper'] or des or f"HYG {r['id']}",
        'proper': named,
        'des': des if named else (des if des != (r['proper'] or des) else None),
        'con': r['con'] or None,
        'hip': int(r['hip']) if r['hip'] else None,
        'hd': int(r['hd']) if r['hd'] else None,
        'hr': int(r['hr']) if r['hr'] else None,
        'gl': r['gl'] or None,
        'ra': sig(f(r['ra']) * 15, 7) if f(r['ra']) is not None else None,
        'dec': sig(f(r['dec']), 7),
        'dist': sig(dist),
        'distSrc': {'G_R3': 'gaia-dr3', 'G_R2': 'gaia-dr2', 'HIP': 'hipparcos', 'GJ': 'gliese'}.get(r['dist_src'], 'other') if dist else None,
        'mag': f(r['mag']),
        'absmag': sig(absmag, 4),
        'spect': (r['spect'] or '').strip() or None,
        'ci': ci,
        'rv': f(r['rv']),
    })
stars.sort(key=lambda s: (s['dist'] is None, s['dist'] or 0))
# Nomes repetidos (componentes de estrelas duplas com a mesma designação): acrescenta a componente
names = {}
for s in stars:
    names.setdefault(s['name'], []).append(s)
for n, group in names.items():
    if len(group) < 2: continue
    for i, s in enumerate(sorted(group, key=lambda x: x['mag'] if x['mag'] is not None else 99)):
        comp = (s['gl'] or '')[-1:] if (s['gl'] or '')[-1:] in 'ABCD' and s['gl'] else 'ABCD'[i]
        s['name'] = f"{n} {comp}"
dups = {n: len(v) for n, v in names.items() if len(v) > 1}
out = {'source': 'AT-HYG v3.2 (subconjunto HYGLike), CC BY-SA 4.0', 'stars': stars}
json.dump(out, open(os.path.join(ROOT, 'public', 'data', 'star-catalog.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump({'source': 'AT-HYG v3.2 (HYGLike), estrelas a menos de 100 pc com distância Gaia DR3', 'points': hr},
          open(os.path.join(ROOT, 'public', 'data', 'hr-diagram.json'), 'w'), separators=(',', ':'))
print(len(stars), 'estrelas no catálogo;', sum(1 for s in stars if s['proper']), 'com nome;', len(hr), 'no diagrama H-R; nomes repetidos:', dups)
