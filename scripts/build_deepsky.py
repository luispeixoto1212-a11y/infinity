"""Gera public/data/deepsky.json: os 110 objetos Messier.

Fontes:
  - OpenNGC (M. Verga, CC BY-SA 4.0): posição J2000, constelação, tipo, dimensões, magnitudes, tipo de Hubble.
    git clone --depth 1 https://github.com/mattiaverga/OpenNGC
  - NASA Hubble Messier Catalog (science.nasa.gov): distância e nome comum, para os 89 objetos com página.
    Transcrito em scripts/data/messier_nasa.tsv (consultado em 2026-10-13).
  - Cantat-Gaudin et al. 2020 (Gaia DR2): distância de 13 enxames abertos sem página da NASA.
    Transcrito em scripts/data/cantat_gaudin_2020.tsv (consultado em 2026-10-14).
Uso: python3 scripts/build_deepsky.py <pasta OpenNGC>
"""
import csv, json, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OPENNGC = sys.argv[1] if len(sys.argv) > 1 else 'OpenNGC'
OUT = os.path.join(ROOT, 'public', 'data', 'deepsky.json')

def hms(s, hours):
    m = re.match(r'([+-]?)(\d+):(\d+):(\d+(?:\.\d+)?)', s.strip())
    if not m: return None
    sign = -1 if m.group(1) == '-' else 1
    v = int(m.group(2)) + int(m.group(3)) / 60 + float(m.group(4)) / 3600
    return round(sign * v * (15 if hours else 1), 5)

def num(s):
    try: return float(s)
    except (TypeError, ValueError): return None

rows = {}
for f in ['NGC.csv', 'addendum.csv']:
    with open(os.path.join(OPENNGC, 'database_files', f), newline='') as fh:
        for r in csv.DictReader(fh, delimiter=';'):
            rows[r['Name']] = r
messier = {}
for r in rows.values():
    if r['M'] and r['Type'] != 'Dup':
        messier[int(r['M'])] = r
# M102: a NASA identifica-a com NGC 5866 (o OpenNGC considera-a duplicação de M101)
messier[102] = rows['NGC5866']

nasa = {}
with open(os.path.join(ROOT, 'scripts', 'data', 'messier_nasa.tsv')) as fh:
    for line in fh:
        if not line.strip() or line.startswith('#'): continue
        parts = [p.strip() for p in line.split('|')]
        m = int(parts[0][1:])
        nasa[m] = dict(name=None if parts[1] == '-' else parts[1], type=parts[2], distance=parts[3], const=parts[4], mag=num(parts[5]), season=parts[6])

gaia = {}
with open(os.path.join(ROOT, 'scripts', 'data', 'cantat_gaudin_2020.tsv')) as fh:
    for line in fh:
        if not line.strip() or line.startswith('#'): continue
        parts = [p.strip() for p in line.split('|')]
        gaia[int(parts[0][1:])] = float(parts[2])
LY_PER_PC = 3.26156

def parse_ly(s):
    s = s.lower().replace('about', '').replace('~', '').strip()
    m = re.match(r'([\d.,]+)\s*(million)?\s*light-years', s)
    if not m: raise ValueError(s)
    v = float(m.group(1).replace(',', ''))
    return v * 1e6 if m.group(2) else v

def category(r):
    t = r['Type']; h = (r['Hubble'] or '').strip()
    if t == 'G':
        if h.startswith('E'): return 'galaxy', 'elliptical'
        if h.startswith(('S0', 'SA0', 'SB0', 'SAB0')): return 'galaxy', 'lenticular'
        if h.startswith('SB'): return 'galaxy', 'barred-spiral'
        if h.startswith(('S', 'SA', 'SAB')): return 'galaxy', 'spiral'
        if h.startswith('I'): return 'galaxy', 'irregular'
        return 'galaxy', 'galaxy'
    if t == 'GCl': return 'cluster', 'globular'
    if t == 'OCl': return 'cluster', 'open'
    if t == '*Ass': return 'other', 'star-cloud'
    if t == 'PN': return 'nebula', 'planetary'
    if t == 'SNR': return 'nebula', 'snr'
    if t == 'RfN': return 'nebula', 'reflection'
    if t in ('HII', 'EmN', 'Neb', 'Cl+N'): return 'nebula', 'emission'
    if t == '**': return 'other', 'double-star'
    if t == 'Other': return 'other', 'asterism'
    raise ValueError(t)

out = []
for m in range(1, 111):
    r = messier[m]
    cat, sub = category(r)
    n = nasa.get(m)
    if cat == 'galaxy' and n:
        nt = n['type'].lower()
        if 'barred' in nt: sub = 'barred-spiral'
        elif 'lenticular' in nt: sub = 'lenticular'
        elif 'elliptical' in nt: sub = 'elliptical'
        elif 'spiral' in nt: sub = 'spiral'
    rec = {
        'm': m,
        'ngc': (r['Name'] if r['Name'].startswith(('NGC', 'IC')) else (('NGC' + r['NGC']) if r['NGC'] else None)),
        'other': None if r['Name'].startswith(('NGC', 'IC')) else ({'Mel022': 'Melotte 22', 'M040': 'Winnecke 4'}.get(r['Name'], r['Name'])),
        'cat': cat, 'sub': sub,
        'ra': hms(r['RA'], True), 'dec': hms(r['Dec'], False),
        'con': r['Const'].replace('Se1', 'Ser').replace('Se2', 'Ser'),
        'maj': num(r['MajAx']), 'min': num(r['MinAx']),
        'vmag': num(r['V-Mag']),
        'nasaMag': n['mag'] if n else None,
        'bmag': num(r['B-Mag']),
        'hubble': (r['Hubble'] or '').strip() or None,
        'commonEn': (r['Common names'] or '').split(',')[0] or None,
        'distLy': parse_ly(n['distance']) if n else (round(gaia[m] * LY_PER_PC) if m in gaia else None),
        'distSrc': 'nasa' if n else ('gaia-cg2020' if m in gaia else None),
        'distText': n['distance'] if n else None,
        'nasaName': n['name'] if n else None,
        'nasaType': n['type'] if n else None,
        'season': n['season'] if n and n['season'] != '-' else None,
        'nasaPage': bool(n),
    }
    out.append(rec)
json.dump({'source': 'OpenNGC (CC BY-SA 4.0) + NASA Hubble Messier Catalog + Cantat-Gaudin et al. 2020', 'objects': out}, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'objetos;', sum(1 for o in out if o['distSrc'] == 'nasa'), 'com distância da NASA;',
      sum(1 for o in out if o['distSrc'] == 'gaia-cg2020'), 'da Gaia;', os.path.getsize(OUT), 'bytes')
