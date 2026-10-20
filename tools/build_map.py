#!/usr/bin/env python3
"""Build data/copahue.js for COLONIZATION from copahue-v8/data/data.js (read-only).
Produces a pointy-top hex map (odd-r offset) that follows the real river system."""
import json, base64, math, sys, array

SRC = sys.argv[1] if len(sys.argv) > 1 else '../copahue-v8/data/data.js'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'data/copahue.js'

s = open(SRC).read()
dec = json.JSONDecoder()
D, _ = dec.raw_decode(s[s.index('{'):])
P, _ = dec.raw_decode(s[s.index('{', s.index('const PHOTOS')):])
G, _ = dec.raw_decode(s[s.index('{', s.index('const GEO')):])

# ---- geo helpers (same projection as v8 world.js) ----
LAT0, LON0, KX, KZ = -37.93, -70.91, 87.8, 110.95
def proj(lat, lon): return ((lon - LON0) * KX, -(lat - LAT0) * KZ)

# region shown in the game
LON_A, LON_B = -71.19, -70.82
LAT_N, LAT_S = -37.775, -37.955
XA, YN = proj(LAT_N, LON_A)
XB, YS = proj(LAT_S, LON_B)
WKM, HKM = XB - XA, YS - YN
COLS = 34
HW = WKM / COLS                 # hex width (pointy top)
SIZE = HW / math.sqrt(3)
RH = SIZE * 1.5
ROWS = int(HKM / RH) + 1
print(f'region {WKM:.1f} x {HKM:.1f} km, hex {HW:.2f} km, grid {COLS}x{ROWS}', file=sys.stderr)

def hex_center(c, r):
    x = XA + HW * (c + 0.5 + (0.5 if r % 2 else 0))
    y = YN + SIZE + RH * r
    return x, y
def km_to_hex(x, y):
    """nearest hex (odd-r) to world km point"""
    r = round((y - YN - SIZE) / RH)
    best = None
    for rr in (r - 1, r, r + 1):
        if rr < 0 or rr >= ROWS: continue
        c = round((x - XA) / HW - 0.5 - (0.5 if rr % 2 else 0))
        for cc in (c - 1, c, c + 1):
            if cc < 0 or cc >= COLS: continue
            hx, hy = hex_center(cc, rr)
            d = (hx - x) ** 2 + (hy - y) ** 2
            if best is None or d < best[0]: best = (d, cc, rr)
    return (best[1], best[2]) if best else None
def neighbors(c, r):
    odd = r % 2
    cand = [(c - 1, r), (c + 1, r), (c - 1 + odd, r - 1), (c + odd, r - 1), (c - 1 + odd, r + 1), (c + odd, r + 1)]
    return [(a, b) for a, b in cand if 0 <= a < COLS and 0 <= b < ROWS]

# ---- DEM ----
dem = base64.b64decode(G['dem']['b64'])
DA = array.array('H'); DA.frombytes(dem)
NX, NZ = G['dem']['nx'], G['dem']['nz']
bl = G['bounds']  # [lonW, lonE, latN, latS]
X0, Z0 = proj(bl[2], bl[0]); X1, Z1 = proj(bl[3], bl[1])
def dem_at(x, y):
    fx = min(max((x - X0) / (X1 - X0) * NX, 0), NX - 1e-3); fz = min(max((y - Z0) / (Z1 - Z0) * NZ, 0), NZ - 1e-3)
    i, j = int(fx), int(fz); tx, tz = fx - i, fz - j
    g = lambda a, b: DA[b * (NX + 1) + a]
    return (g(i, j) * (1 - tx) + g(i + 1, j) * tx) * (1 - tz) + (g(i, j + 1) * (1 - tx) + g(i + 1, j + 1) * tx) * tz

# ---- lake SDF ----
LG = G['lake']
lb = base64.b64decode(LG['b64'])
def lake_inside(x, y):
    i = int((x - LG['x0']) / LG['res']); j = int((y - LG['z0']) / LG['res'])
    if i < 0 or j < 0 or i >= LG['nx'] or j >= LG['nz']: return False
    v = lb[j * LG['nx'] + i]
    if v > 127: v -= 256
    return v / 50 < 0.02

# ---- sites (prefer 2020 coords; average numeric values across years) ----
SITE_NAMES = {
 'CL': 'Laguna del Cráter', 'VA1': 'Vertiente del Agrio 1', 'VA2': 'Vertiente del Agrio 2', 'VAN': 'Vertiente del Agrio Norte',
 'RAS1': 'Río Agrio Superior', 'CC': 'Cascada de la Culebra', 'RJ': 'Río Jara', 'RA_RJ': 'Unión Agrio–Jara', 'LC': 'Lago Caviahue',
 'RAI1': 'Puente de Gendarmería', 'SA1': 'Salto del Agrio (arriba)', 'SA2': 'Salto del Agrio (pozo)', 'PT': 'Puerta de Trolope',
 'LN': 'Norte de Loncopué', 'CHC': 'Terma de Chancho-Có', 'ME1': 'Laguna Melliza 1', 'ME2': 'Laguna Melliza 2'}
KEYS = {'ph': 'pH', 'T': 'Temp.[ºC]', 'fe': 'Fe', 'so4': 'SO4', 'o2': 'D.O.[%]', 'ec': 'EC[µS/cm]', 'al': 'Al', 'as': 'As', 'cu': 'Cu', 'zn': 'Zn', 'turb': 'Turb.FNU'}
sites = {}
for smp in D['samples']:
    code = smp['site']
    if code == 'LSM': continue
    S = sites.setdefault(code, {'code': code, 'name': SITE_NAMES.get(code, smp['name']), 'vals': {}, 'lat': None, 'lon': None, 'ids': set(), 'years': set()})
    S['ids'].add(smp['id']); S['years'].add(smp['year'])
    if smp['lat'] and (S['lat'] is None or smp['year'] == 2020) and not (code == 'VA2' and smp['year'] == 2019):
        S['lat'], S['lon'] = smp['lat'], smp['lon']
    for k, kk in KEYS.items():
        v = smp['v'].get(kk)
        if v is not None: S['vals'].setdefault(k, []).append(v)
for S in sites.values():
    S['v'] = {k: round(sum(v) / len(v), 2) for k, v in S['vals'].items()}
    del S['vals']; S['ids'] = sorted(S['ids']); S['years'] = sorted(S['years'])
# Igneacidithiobacillus copahuensis type strain site (Arisan et al. 2024): hot spring water, VAN, ~37-40 C, pH 2.2-2.5
sites['VAN'] = {'code': 'VAN', 'name': SITE_NAMES['VAN'], 'lat': -37.8525, 'lon': -71.1525, 'ids': ['VAN18-1'], 'years': [2018],
                'v': {'ph': 2.35, 'T': 38.5, 'fe': 600, 'so4': 4000, 'o2': 20, 'ec': 20000}}

# ---- hex grid ----
hexes = {}
for r in range(ROWS):
    for c in range(COLS):
        x, y = hex_center(c, r)
        hexes[(c, r)] = {'c': c, 'r': r, 't': 'land', 'el': int(dem_at(x, y)), 'lake': lake_inside(x, y)}

# lake hexes
for h in hexes.values():
    if h['lake']: h['t'] = 'lake'; h['river'] = 'Lago Caviahue'

# rivers → hex chains (ordered upstream→downstream)
RIVER_SHORT = {'Río Agrio Superior': 'RAS', 'Río Jara': 'JARA', 'Río Agrio Inferior': 'RAI', 'Estero Chancho-Có': 'CHC', 'Río Rojo': 'ROJO',
               'Río Blanco': 'BLANCO', 'Río Dulce': 'DULCE', 'Río Trolope': 'TROLOPE', 'Arroyo Chinchiví': 'CHINCHIVI'}
chains = {}
for riv in G['rivers']:
    name = riv['n']; chain = []
    pts = riv['pts']
    for a, b in zip(pts, pts[1:]):
        (xa, ya), (xb, yb) = proj(a[0], a[1]), proj(b[0], b[1])
        n = max(1, int(math.hypot(xb - xa, yb - ya) / (HW * 0.35)))
        for k in range(n + 1):
            t = k / n
            x, y = xa + (xb - xa) * t, ya + (yb - ya) * t
            lat, lon = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
            if not (LON_A <= lon <= LON_B and LAT_S <= lat <= LAT_N): continue
            hk = km_to_hex(x, y)
            if hk is None: continue
            ph = a[3] + (b[3] - a[3]) * t; el = a[2] + (b[2] - a[2]) * t
            if chain and chain[-1][0] == hk: continue
            if hk in [cc[0] for cc in chain]: continue
            chain.append((hk, round(ph, 2), int(el)))
    chains[name] = chain
    for hk, ph, el in chain:
        h = hexes[hk]
        if h['t'] == 'lake': continue
        if h['t'] == 'river' and h.get('river') != name:
            # confluence: keep the bigger river
            if riv['w'] <= [rv for rv in G['rivers'] if rv['n'] == h['river']][0]['w']: continue
        h['t'] = 'river'; h['river'] = name; h['ph'] = ph; h['el'] = el

# lake water from LC
for h in hexes.values():
    if h['t'] == 'lake': h['ph'] = 2.7

# ---- assign sites to hexes (unique) ----
def nearest_water_hex(lat, lon, exclude=set(), maxd=3):
    x, y = proj(lat, lon); best = None
    for hk, h in hexes.items():
        if h['t'] == 'land' or hk in exclude: continue
        hx, hy = hex_center(*hk); d = math.hypot(hx - x, hy - y)
        if d <= maxd and (best is None or d < best[0]): best = (d, hk)
    return best[1] if best else None
taken = set()
site_hex = {}
for code in ['CL', 'VA1', 'VA2', 'VAN', 'RAS1', 'CC', 'RJ', 'RA_RJ', 'LC', 'RAI1', 'SA1', 'SA2', 'PT', 'CHC', 'ME1', 'ME2']:
    S = sites[code]
    if code == 'CL':
        x, y = proj(S['lat'], S['lon']); hk = km_to_hex(x, y); hexes[hk]['t'] = 'crater'; hexes[hk]['river'] = 'Laguna del Cráter'
    elif code in ('ME1', 'ME2'):
        x, y = proj(S['lat'], S['lon']); hk = km_to_hex(x, y)
        if hk in taken:
            hk = [n for n in neighbors(*hk) if n not in taken and hexes[n]['t'] == 'land'][0]
        hexes[hk]['t'] = 'pond'; hexes[hk]['river'] = 'Lagunas Mellizas'
    elif code == 'CHC':
        x, y = proj(S['lat'], S['lon']); hk = km_to_hex(x, y)
        if hexes[hk]['t'] == 'land': hexes[hk]['t'] = 'hot'; hexes[hk]['river'] = 'Estero Chancho-Có'
        else: hexes[hk]['t'] = 'hot'
    else:
        hk = nearest_water_hex(S['lat'], S['lon'], taken)
        if hk is None:
            x, y = proj(S['lat'], S['lon']); hk = km_to_hex(x, y); hexes[hk]['t'] = 'river'; hexes[hk]['river'] = 'Río Agrio Superior'
        if code in ('VA1', 'VA2', 'VAN'): hexes[hk]['t'] = 'spring'
        if code in ('CC', 'SA1', 'SA2'): hexes[hk]['t'] = 'falls'
    taken.add(hk); site_hex[code] = hk
    h = hexes[hk]; h['site'] = code
    if code == 'RJ': h['river'] = 'Río Jara'
    for k, v in S['v'].items(): h[k] = v
    if 'ph' in S['v']: h['ph'] = S['v']['ph']
# LN: downstream exit at the east edge of Agrio Inferior
rai = chains['Río Agrio Inferior']
if rai:
    hk = rai[-1][0]; h = hexes[hk]; h['site'] = 'LN'; h['exit'] = True
    for k, v in sites['LN']['v'].items(): h[k] = v
    site_hex['LN'] = hk

# ---- fill variables for water hexes without a site: interpolate along each river chain between sites ----
NEUTRAL = {'T': 12, 'fe': 0.2, 'so4': 300, 'o2': 60, 'ec': 450}
ACID = {'T': 14, 'fe': 150, 'so4': 2500, 'o2': 45, 'ec': 3000}
VARS = ('T', 'fe', 'so4', 'o2', 'ec')
for name, chain in chains.items():
    ks = [k for k, _, _ in chain if hexes[k]['t'] not in ('land',)]
    anchors = [(n, hexes[k]) for n, k in enumerate(ks) if 'site' in hexes[k] and 'T' in hexes[k]]
    for n, k in enumerate(ks):
        h = hexes[k]
        if 'T' in h: continue
        if not anchors:
            base = NEUTRAL if h.get('ph', 7) >= 5.5 else ACID
            for v in VARS: h[v] = base[v]
            continue
        prev = [a for a in anchors if a[0] <= n]; nxt = [a for a in anchors if a[0] >= n]
        if prev and nxt:
            (n0, h0), (n1, h1) = prev[-1], nxt[0]
            t = (n - n0) / max(1, (n1 - n0))
            for v in VARS: h[v] = round(h0.get(v, NEUTRAL[v]) * (1 - t) + h1.get(v, NEUTRAL[v]) * t, 2)
        else:
            a = (prev or nxt)[-1 if prev else 0][1]; d = abs(n - (prev or nxt)[-1 if prev else 0][0])
            base = NEUTRAL if h.get('ph', 7) >= 5.5 else ACID
            w = max(0.0, 1 - d / 4.0)
            for v in VARS: h[v] = round(a.get(v, base[v]) * w + base[v] * (1 - w), 2)
for h in hexes.values():
    if h['t'] != 'land' and 'T' not in h:
        base = NEUTRAL if h.get('ph', 7) >= 5.5 else ACID
        if h['t'] == 'lake':
            lc = hexes[site_hex['LC']]
            for v in VARS: h[v] = lc.get(v, base[v])
        else:
            for v in VARS: h[v] = base[v]
    if h['t'] != 'land' and h.get('ph', 7) > 4.5 and 'site' not in h: h['fe'] = round(min(h['fe'], 5.0), 1)
# ---- flow links (downstream neighbours) ----
idx = {}
order = [h for h in hexes.values()]
for i, h in enumerate(order): idx[(h['c'], h['r'])] = i; h['i'] = i
for h in order: h['down'] = []
for name, chain in chains.items():
    ks = [k for k, _, _ in chain if hexes[k]['t'] != 'land']
    for a, b in zip(ks, ks[1:]):
        if hexes[a]['t'] == 'lake': continue
        if b in neighbors(*a) or True:
            hexes[a]['down'].append(idx[b])
    if ks:
        last = ks[-1]
        for n in neighbors(*last):
            if hexes[n]['t'] != 'land' and hexes[n].get('river') != name and idx[n] not in hexes[last]['down'] and hexes[last]['t'] != 'lake':
                hexes[last]['down'].append(idx[n]); break
# lake flows toward Agrio Inferior head
if rai:
    head = idx[rai[0][0]]
    for h in order:
        if h['t'] == 'lake': h['down'] = [head]
# crater → VA1/VA2 (seepage)
cl = hexes[site_hex['CL']]
for code in ('VA1', 'VA2'):
    cl['down'].append(idx[site_hex[code]])
for code in ('VA1', 'VA2', 'VAN'):
    h = hexes[site_hex[code]]
    if not h['down']:
        for n in neighbors(h['c'], h['r']):
            if hexes[n]['t'] == 'river': h['down'].append(idx[n]); break

for h in order:
    h['down'] = list(dict.fromkeys(h['down']))
    if h['t'] in ('river',) and not h['down']: h['exit'] = True
# ---- fumaroles / solfataras (land hexes with sulfur) near crater & Las Máquinas & Chancho-Có ----
FUM = [(-37.8205, -71.164), (-37.8172, -71.168), (-37.845, -71.165), (-37.852, -71.162)]
for lat, lon in FUM:
    hk = km_to_hex(*proj(lat, lon))
    if hexes[hk]['t'] == 'land': hexes[hk]['t'] = 'fumarole'; hexes[hk]['T'] = 92; hexes[hk]['ph'] = 1.5

# ---- taxa (genus top lists, acidithio species, shannon, mags) ----
taxa = {}
for code, t in D['taxa'].items():
    taxa[code] = {'reads': t['total_reads'], 'domain': t['domain'], 'phylum': t['phylum'], 'genus': [[g, p] for g, p, n in t['genus'][:14]],
                  'acidithio': t.get('acidithio'), 'shannon': t['shannon'], 'evenness': t['evenness'], 'mags': t['mags']}

# ---- output ----
water = [h for h in order if h['t'] != 'land']
print(f"water hexes: {len(water)} / {len(order)}; sites: {site_hex}", file=sys.stderr)
from collections import Counter
print(Counter(h['t'] for h in order), file=sys.stderr)
out = {'cols': COLS, 'rows': ROWS, 'hexKm': round(HW, 3), 'bounds': [LON_A, LON_B, LAT_N, LAT_S],
       'hexes': [{k: v for k, v in h.items() if k != 'lake'} for h in order],
       'sites': {c: {k: v for k, v in S.items()} for c, S in sites.items()}, 'siteHex': {c: idx[k] for c, k in site_hex.items()},
       'taxa': taxa, 'elev': [int(dem_at(*hex_center(h['c'], h['r']))) for h in order]}
import os
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w') as f:
    f.write('// COLONIZATION — datos reales del sistema Caviahue-Copahue, derivados de copahue-v8/data/data.js (campañas 2019-2020)\n')
    f.write('const COPAHUE=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
    f.write('const PHOTOS=' + json.dumps(P, separators=(',', ':')) + ';\n')
print('written', OUT, os.path.getsize(OUT), file=sys.stderr)
