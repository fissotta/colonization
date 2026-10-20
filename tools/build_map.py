#!/usr/bin/env python3
"""Tablero esquemático de COLONIZATION (16x11 hexes grandes) inspirado en la forma real del sistema
Caviahue-Copahue. La química de cada hex sale de los sitios reales (copahue-v8/data/data.js) e
interpolada a lo largo de cada río."""
import json, sys, os, math
SRC = sys.argv[1] if len(sys.argv) > 1 else '../copahue-v8/data/data.js'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'data/copahue.js'
s = open(SRC).read(); dec = json.JSONDecoder()
D, _ = dec.raw_decode(s[s.index('{'):]); P, _ = dec.raw_decode(s[s.index('{', s.index('const PHOTOS')):])

# ---- board: 16 cols x 11 rows, odd-r (odd rows shifted right). codes: '..' land, 'MM' mountain/snow, '^^' fumarole,
#      water types: CR crater, SP spring, AS agrio superior, LK lake, AI agrio inferior, JA jara, DU dulce, RO rojo, CH chancho-có,
#      TR trolope, PO pond (mellizas), HS hot spring, FA falls, NE neutral downstream. Sites are placed by code below.
BOARD = [
 "MM .. HS CH .. .. .. .. .. .. .. .. .. TR TR ..",
 " MM ^^ CH .. PO PO .. .. .. .. .. .. .. TR .. ..",
 "^^ CR SP SP .. .. .. .. .. .. .. .. FA FA AI NE",
 " MM SP AS RO .. .. .. .. .. .. .. AI AI .. .. ..",
 ".. .. AS AS .. .. .. .. .. .. AI AI .. .. .. ..",
 " .. .. .. AS AS .. .. .. LK LK AI .. .. .. .. ..",
 ".. .. .. .. AS FA AS LK LK LK .. .. .. .. .. ..",
 " .. .. .. JA JA JA LK LK LK DU .. .. .. .. .. ..",
 ".. .. JA JA .. .. .. .. .. DU .. .. .. .. .. ..",
 " .. JA .. .. .. .. .. .. .. DU .. .. .. .. .. ..",
 ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
]
COLS, ROWS = 16, 11
# ordered flow per river (upstream → downstream), (col,row)
RIVERS = {
 'Laguna del Cráter': [(1,2)],
 'Río Agrio Superior': [(2,2),(3,2),(1,3),(2,3),(3,4),(2,4),(4,5),(3,5),(4,6),(5,6),(6,6)],
 'Río Rojo': [(3,3)],
 'Lago Caviahue': [(7,6),(8,6),(9,6),(8,5),(9,5),(6,7),(7,7),(8,7)],
 'Río Agrio Inferior': [(10,5),(10,4),(11,4),(11,3),(12,3),(12,2),(13,2),(14,2),(15,2)],
 'Río Jara': [(1,9),(2,8),(3,8),(3,7),(4,7),(5,7)],
 'Río Dulce': [(9,9),(9,8),(9,7)],
 'Estero Chancho-Có': [(2,0),(3,0),(2,1)],
 'Río Trolope': [(13,0),(14,0),(13,1)],
 'Lagunas Mellizas': [(4,1),(5,1)],
}
# junctions: last hex of a river → first water hex it feeds
JOIN = {'Laguna del Cráter': None, 'Río Rojo': (3,4), 'Río Jara': (6,6), 'Río Dulce': (8,7), 'Río Trolope': (13,2), 'Estero Chancho-Có': None, 'Lagunas Mellizas': None,
        'Río Agrio Superior': (7,6), 'Lago Caviahue': (10,5), 'Río Agrio Inferior': None}
SITE_AT = {'CL': (1,2), 'VA2': (2,2), 'VAN': (3,2), 'VA1': (1,3), 'RAS1': (3,5), 'CC': (5,6), 'RJ': (5,7), 'RA_RJ': (6,6), 'LC': (8,6),
           'RAI1': (11,4), 'SA2': (12,2), 'SA1': (13,2), 'PT': (14,2), 'LN': (15,2), 'CHC': (2,0), 'ME1': (4,1), 'ME2': (5,1)}
SITE_NAMES = {'CL': 'Laguna del Cráter', 'VA1': 'Vertiente del Agrio 1', 'VA2': 'Vertiente del Agrio 2', 'VAN': 'Vertiente del Agrio Norte',
 'RAS1': 'Río Agrio Superior', 'CC': 'Cascada de la Culebra', 'RJ': 'Río Jara', 'RA_RJ': 'Unión Agrio–Jara', 'LC': 'Lago Caviahue',
 'RAI1': 'Puente de Gendarmería', 'SA1': 'Salto del Agrio', 'SA2': 'Pozo del Salto', 'PT': 'Puerta de Trolope', 'LN': 'Hacia Loncopué',
 'CHC': 'Terma de Chancho-Có', 'ME1': 'Laguna Melliza 1', 'ME2': 'Laguna Melliza 2'}
KEYS = {'ph': 'pH', 'T': 'Temp.[ºC]', 'fe': 'Fe', 'so4': 'SO4', 'o2': 'D.O.[%]', 'ec': 'EC[µS/cm]', 'as': 'As'}
sites = {}
for smp in D['samples']:
    code = smp['site']
    if code == 'LSM': continue
    S = sites.setdefault(code, {'code': code, 'name': SITE_NAMES.get(code, smp['name']), 'vals': {}, 'ids': set(), 'years': set()})
    S['ids'].add(smp['id']); S['years'].add(smp['year'])
    for k, kk in KEYS.items():
        v = smp['v'].get(kk)
        if v is not None: S['vals'].setdefault(k, []).append(v)
for S in sites.values():
    S['v'] = {k: round(sum(v) / len(v), 2) for k, v in S['vals'].items()}; del S['vals']; S['ids'] = sorted(S['ids']); S['years'] = sorted(S['years'])
sites['VAN'] = {'code': 'VAN', 'name': SITE_NAMES['VAN'], 'ids': ['VAN18-1'], 'years': [2018], 'v': {'ph': 2.35, 'T': 38.5, 'fe': 600, 'so4': 4000, 'o2': 20, 'ec': 20000}}
# elevation (m) for the relief, hand-shaped: volcano NW high, valley to SE
def elev(c, r):
    x, y = c / (COLS - 1), r / (ROWS - 1)
    base = 2750 - 900 * (x * .8 + y * .5)
    ridge = 250 * math.sin(x * 9 + y * 3) * math.cos(y * 7 - x * 2)
    return int(base + ridge)
TYPE = {'CR': 'crater', 'SP': 'spring', 'AS': 'river', 'LK': 'lake', 'AI': 'river', 'JA': 'river', 'DU': 'river', 'RO': 'river', 'CH': 'river', 'TR': 'river',
        'PO': 'pond', 'HS': 'hot', 'FA': 'falls', 'NE': 'river', '..': 'land', 'MM': 'mountain', '^^': 'fumarole'}
hexes = []; idx = {}
for r, line in enumerate(BOARD):
    cells = line.strip().split()
    assert len(cells) == COLS, (r, len(cells))
    for c, code in enumerate(cells):
        t = TYPE[code]; h = {'c': c, 'r': r, 't': t, 'i': len(hexes), 'el': elev(c, r), 'down': []}
        if t == 'mountain': h['el'] += 350
        if t == 'fumarole': h['T'] = 92; h['ph'] = 1.5
        idx[(c, r)] = h['i']; hexes.append(h)
riverOf = {}
for name, pts in RIVERS.items():
    for p in pts: riverOf[p] = name
for h in hexes:
    k = (h['c'], h['r'])
    if k in riverOf: h['river'] = riverOf[k]
    elif h['t'] not in ('land', 'mountain', 'fumarole'): raise SystemExit('water hex without river: %s' % (k,))
# sites
for code, k in SITE_AT.items():
    h = hexes[idx[k]]; h['site'] = code
    for kk, v in sites[code]['v'].items(): h[kk] = v
# interpolate chemistry along rivers; defaults by water type
NEUTRAL = {'ph': 7.0, 'T': 12, 'fe': 0.2, 'so4': 300, 'o2': 60, 'ec': 450}
ACID = {'ph': 2.6, 'T': 14, 'fe': 150, 'so4': 2500, 'o2': 45, 'ec': 3000}
VARS = ['ph', 'T', 'fe', 'so4', 'o2', 'ec']
for name, pts in RIVERS.items():
    hs = [hexes[idx[p]] for p in pts]
    anch = [(n, h) for n, h in enumerate(hs) if 'site' in h]
    for n, h in enumerate(hs):
        if 'site' in h: continue
        prev = [a for a in anch if a[0] < n]; nxt = [a for a in anch if a[0] > n]
        base = NEUTRAL if name in ('Río Jara', 'Río Dulce', 'Río Trolope', 'Estero Chancho-Có', 'Lagunas Mellizas') else ACID
        for v in VARS:
            if prev and nxt:
                (n0, h0), (n1, h1) = prev[-1], nxt[0]; t = (n - n0) / (n1 - n0)
                h[v] = round(h0.get(v, base[v]) * (1 - t) + h1.get(v, base[v]) * t, 2)
            elif prev or nxt:
                a = (prev[-1] if prev else nxt[0])[1]; d = abs(n - (prev[-1] if prev else nxt[0])[0]); w = max(0, 1 - d / 3)
                h[v] = round(a.get(v, base[v]) * w + base[v] * (1 - w), 2)
            else: h[v] = base[v]
    # flow links
    def adj(a, b):
        odd = a[1] & 1; cand = [(a[0]-1,a[1]),(a[0]+1,a[1]),(a[0]-1+odd,a[1]-1),(a[0]+odd,a[1]-1),(a[0]-1+odd,a[1]+1),(a[0]+odd,a[1]+1)]
        return b in cand
    j = JOIN.get(name)
    for n, a in enumerate(pts):
        if name == 'Lago Caviahue': continue
        dn = [idx[b] for b in pts[n+1:] if adj(a, b)]
        if not dn and n + 1 < len(pts): dn = [idx[pts[n+1]]]
        if not dn and j: dn = [idx[j]]
        hexes[idx[a]]['down'] += dn
    if name == 'Lago Caviahue':
        for p in pts: hexes[idx[p]]['down'] = [idx[j]]
for name, pts in RIVERS.items():
    base = NEUTRAL if name in ('Río Jara', 'Río Dulce', 'Río Trolope', 'Estero Chancho-Có', 'Lagunas Mellizas') else ACID
    for p in pts:
        h = hexes[idx[p]]
        for v in VARS:
            if v not in h: h[v] = base[v]
hexes[idx[(15, 2)]]['exit'] = True
hexes[idx[(1, 2)]]['down'] = [idx[(2, 2)], idx[(1, 3)]]
hexes[idx[(2, 1)]]['exit'] = True
for h in hexes: h['down'] = list(dict.fromkeys(h['down']))
# lake hexes without site copy LC
lc = hexes[idx[SITE_AT['LC']]]
for h in hexes:
    if h.get('river') == 'Lago Caviahue' and 'site' not in h:
        for v in VARS: h[v] = lc[v]
    if h['t'] not in ('land', 'mountain', 'fumarole') and h.get('ph', 7) > 4.5 and 'site' not in h: h['fe'] = round(min(h['fe'], 5), 1)
taxa = {}
for code, t in D['taxa'].items():
    taxa[code] = {'reads': t['total_reads'], 'genus': [[g, p] for g, p, n in t['genus'][:8]], 'shannon': t['shannon'], 'mags': t['mags'], 'acidithio': t.get('acidithio')}
out = {'cols': COLS, 'rows': ROWS, 'hexes': hexes, 'sites': sites, 'siteHex': {c: idx[k] for c, k in SITE_AT.items()}, 'taxa': taxa, 'elev': [h['el'] for h in hexes]}
water = [h for h in hexes if h['t'] not in ('land', 'mountain', 'fumarole')]
print('water hexes', len(water), 'of', len(hexes), file=sys.stderr)
os.makedirs(os.path.dirname(OUT) or '.', exist_ok=True)
with open(OUT, 'w') as f:
    f.write('// COLONIZATION — tablero esquemático del sistema Caviahue-Copahue con química real (copahue-v8/data/data.js, 2019-2020)\n')
    f.write('const COPAHUE=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\nconst PHOTOS=' + json.dumps(P, separators=(',', ':')) + ';\n')
print('written', OUT, os.path.getsize(OUT), file=sys.stderr)
