"""Gera public/data/exoplanets.json a partir da cópia do NASA Exoplanet Archive (tabela PSCompPars)
distribuída pelo projeto Open Exoplanet Catalogue (oec_gzip/systems-exoplanetarchive.xml.gz, MIT).
Converte o XML num formato de colunas compacto. Não altera valores: apenas arredonda a 5 algarismos significativos."""
import gzip, json, math, re, subprocess, xml.etree.ElementTree as ET

# Uso: git clone --depth 1 https://github.com/OpenExoplanetCatalogue/oec_gzip /tmp/oec_gzip
#      python3 scripts/build_exoplanets.py /tmp/oec_gzip
import os, sys
REPO = sys.argv[1] if len(sys.argv) > 1 else 'oec_gzip'
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(REPO, 'systems-exoplanetarchive.xml.gz')
OUT = os.path.join(ROOT, 'public', 'data', 'exoplanets.json')
commit_date = subprocess.check_output(['git', '-C', REPO, 'log', '-1', '--format=%cs']).decode().strip()
commit = subprocess.check_output(['git', '-C', REPO, 'log', '-1', '--format=%h']).decode().strip()

def sig(x, n=5):
    if x is None or x == 0 or not math.isfinite(x): return x
    return float(f'{x:.{n}g}')

def num(el, tag):
    e = el.find(tag)
    if e is None or e.text is None or not e.text.strip(): return None, False
    try: v = float(e.text)
    except ValueError: return None, False
    return v, bool(e.get('errorplus') or e.get('errorminus'))

def err(el, tag):
    e = el.find(tag)
    if e is None or not e.get('errorplus'): return None
    try:
        return sig((float(e.get('errorplus')) + float(e.get('errorminus'))) / 2, 2)
    except ValueError: return None

def hms(s, hours):
    if not s: return None
    m = re.match(r'([+-]?)(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)', s.strip())
    if not m: return None
    sign = -1 if m.group(1) == '-' else 1
    v = int(m.group(2)) + int(m.group(3)) / 60 + float(m.group(4)) / 3600
    return round(sign * v * (15 if hours else 1), 4)

METHODS = {'transit': 'transit', 'RV': 'rv', 'imaging': 'imaging', 'microlensing': 'microlensing', 'timing': 'timing'}
root = ET.fromstring(gzip.open(SRC).read())
rows = []
for s in root.findall('system'):
    sname = s.findtext('name')
    if sname == 'Sun': continue
    ra = hms(s.findtext('rightascension'), True)
    dec = hms(s.findtext('declination'), False)
    dist, _ = num(s, 'distance')
    stars = s.findall('.//star')
    planets_in_system = sum(len(st.findall('planet')) for st in stars) + len(s.findall('planet'))
    for st in stars or [s]:
        teff, _ = num(st, 'temperature'); srad, _ = num(st, 'radius'); smass, _ = num(st, 'mass')
        spec = (st.findtext('spectraltype') or '').strip() or None
        vmag, _ = num(st, 'magV')
        for p in st.findall('planet'):
            names = [n.text for n in p.findall('name')]
            name = names[0]
            per, _ = num(p, 'period'); a, _ = num(p, 'semimajoraxis'); e, _ = num(p, 'eccentricity')
            mj, mE = num(p, 'mass'); rj, rE = num(p, 'radius'); teq, _ = num(p, 'temperature')
            inc, _ = num(p, 'inclination')
            method = METHODS.get(p.findtext('discoverymethod') or '', 'other')
            year = p.findtext('discoveryyear')
            disc = (p.findtext('description') or '')
            m = re.search(r"discovered by (.+?\d{4})\.", disc)
            ref = m.group(1) if m else None
            space = 'space based telescope' in disc
            tel = None
            m2 = re.search(r'space based telescope \((.+?)\)', disc)
            if m2: tel = m2.group(1)
            rows.append([
                name, sname, '|'.join(names[1:]) or None, method, int(year) if year else None,
                sig(per, 7), sig(a), sig(e, 3), sig(mj), err(p, 'mass'), 1 if mE else 0, sig(rj), err(p, 'radius'), 1 if rE else 0,
                sig(teq, 4), sig(inc, 4), sig(dist), ra, dec, sig(teff, 4), sig(srad, 4), sig(smass, 4), spec, sig(vmag, 4),
                planets_in_system, ref, tel if space else ('ground' if 'ground based' in disc else None),
            ])
rows.sort(key=lambda r: r[0].lower())
cols = ['name', 'host', 'alt', 'method', 'year', 'period', 'a', 'e', 'massJ', 'massErr', 'massHasErr', 'radiusJ', 'radiusErr', 'radiusHasErr',
        'teq', 'incl', 'dist', 'ra', 'dec', 'stTeff', 'stRad', 'stMass', 'stSpec', 'stVmag', 'sysPlanets', 'discRef', 'facility']
out = {
    'source': 'NASA Exoplanet Archive, tabela Planetary Systems Composite Parameters (PSCompPars)',
    'via': f'Open Exoplanet Catalogue, oec_gzip/systems-exoplanetarchive.xml.gz (commit {commit})',
    'snapshot': commit_date,
    'units': {'period': 'd', 'a': 'UA', 'massJ': 'M_Júpiter', 'radiusJ': 'R_Júpiter', 'teq': 'K', 'dist': 'pc', 'ra': 'graus', 'dec': 'graus',
              'stTeff': 'K', 'stRad': 'R_Sol', 'stMass': 'M_Sol'},
    'columns': cols,
    'rows': rows,
}
json.dump(out, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
import os
print(len(rows), 'planetas;', os.path.getsize(OUT) // 1024, 'KB;', commit_date, commit)

# Índice leve para a pesquisa global: [nome, sistema, ano, método, nomes alternativos]
IDX = os.path.join(ROOT, 'public', 'data', 'exoplanet-index.json')
index = {'snapshot': commit_date, 'rows': [[r[0], r[1], r[4], r[3], r[2]] for r in rows]}
json.dump(index, open(IDX, 'w'), ensure_ascii=False, separators=(',', ':'))
print('índice:', os.path.getsize(IDX) // 1024, 'KB')
