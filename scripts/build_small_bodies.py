"""Gera public/data/small-bodies.json a partir das respostas do JPL Horizons guardadas em scripts/data/small-bodies/.

Cada <corpo>.elements.txt tem elementos osculadores heliocêntricos (eclíptica J2000) de 20 em 20 anos (1806-2046);
alguns corpos têm também <corpo>.elements-dense.txt com épocas adicionais (de 5 em 5 anos entre 1991 e 2041, ou à volta
da passagem pelo periélio dos objetos interestelares). Antes de exportar, verifica a coerência interna de cada época
(A = QR/(1-EC), AD, PR, N a partir da constante de Gauss, MA = N·(t-Tp) e TA a partir de MA pela equação de Kepler),
o que deteta erros de transcrição em qualquer algarismo significativo.

Uso: python3 scripts/build_small_bodies.py
"""
import glob, json, math, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'scripts', 'data', 'small-bodies')
OUT = os.path.join(ROOT, 'public', 'data', 'small-bodies.json')
K = 0.01720209895  # constante de Gauss (rad/dia)


def parse(path):
    body = open(path).read().split('$$SOE')[1].split('$$EOE')[0]
    recs = []
    for block in re.split(r'\n(?=\d{7}\.\d+ = A\.D\.)', body.strip()):
        jd = float(block.split('=')[0])
        vals = dict((k, float(v)) for k, v in re.findall(r'(EC|QR|IN|OM|W |Tp|N |MA|TA|A |AD|PR)=\s*([-+0-9.E]+)', block))
        recs.append((jd, vals))
    return recs


def true_anomaly(M, e):
    if e < 1:
        E = M if e < 0.8 else math.pi
        for _ in range(100):
            d = (E - e * math.sin(E) - M) / (1 - e * math.cos(E))
            E -= d
            if abs(d) < 1e-14:
                break
        return 2 * math.atan2(math.sqrt(1 + e) * math.sin(E / 2), math.sqrt(1 - e) * math.cos(E / 2))
    H = math.asinh(M / e)
    for _ in range(200):
        d = (e * math.sinh(H) - H - M) / (e * math.cosh(H) - 1)
        H -= d
        if abs(d) < 1e-14:
            break
    return 2 * math.atan2(math.sqrt(e + 1) * math.sinh(H / 2), math.sqrt(e - 1) * math.cosh(H / 2))


def check(path, jd, v):
    e, q = v['EC'], v['QR']
    a = q / (1 - e)
    tests = [('A', a, v['A '], 1e-7), ('N', math.degrees(K / abs(a) ** 1.5), v['N '], 2e-6)]
    if e < 1:
        tests += [('AD', a * (1 + e), v['AD'], 1e-7), ('PR', 360 / v['N '], v['PR'], 1e-7)]
    errors = []
    for name, calc, given, tol in tests:
        if abs(calc - given) > tol * max(1, abs(given)):
            errors.append(f'{name}: calculado {calc!r}, lido {given!r}')
    M = v['N '] * (jd - v['Tp'])
    if e < 1:
        M %= 360
    if abs((M - v['MA'] + 180) % 360 - 180) > 1e-5:
        errors.append(f'MA: calculado {M!r}, lido {v["MA"]!r}')
    nu = math.degrees(true_anomaly(math.radians(v['MA']), e)) % 360
    if abs((nu - v['TA'] % 360 + 180) % 360 - 180) > 1e-4:
        errors.append(f'TA: calculado {nu!r}, lido {v["TA"]!r}')
    if errors:
        sys.exit(f'{os.path.basename(path)} JD {jd}: ' + '; '.join(errors))


def sig(x, n=12):
    return float(f'{x:.{n}g}')


orbits = {}
for path in sorted(glob.glob(os.path.join(SRC, '*.elements*.txt'))):
    body = os.path.basename(path).split('.')[0]
    for jd, v in parse(path):
        check(path, jd, v)
        # Épocas repetidas em consultas diferentes diferem só na integração numérica (~1e-10): fica a primeira lida.
        orbits.setdefault(body, {}).setdefault(jd, [jd, sig(v['EC']), sig(v['QR']), sig(v['IN'], 10), sig(v['OM'], 10), sig(v['W '], 10), round(v['Tp'], 6)])

validation = {}
for line in open(os.path.join(SRC, 'validation-vectors.txt')):
    if line.startswith('#') or not line.strip():
        continue
    body, jd, x, y, z = line.split()
    validation.setdefault(body, []).append([float(jd), sig(float(x)), sig(float(y)), sig(float(z))])

missing = set(validation) ^ set(orbits)
if missing:
    sys.exit(f'Corpos sem elementos ou sem vetores de validação: {sorted(missing)}')

out = {
    'source': 'JPL Horizons (sistema de efemérides do JPL), elementos osculadores heliocêntricos, eclíptica e equinócio J2000',
    'consulted': '2026-10-14',
    'columns': ['jdTdb', 'e', 'qAu', 'iDeg', 'nodeDeg', 'periDeg', 'tpJdTdb'],
    'orbits': {b: [ep[k] for k in sorted(ep)] for b, ep in sorted(orbits.items())},
    'validation': dict(sorted(validation.items())),
}
json.dump(out, open(OUT, 'w'), separators=(',', ':'))
print(len(out['orbits']), 'corpos;', sum(len(v) for v in out['orbits'].values()), 'épocas;',
      sum(len(v) for v in validation.values()), 'vetores de validação ->', os.path.relpath(OUT, ROOT))
