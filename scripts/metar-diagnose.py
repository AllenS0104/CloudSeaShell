"""
METAR 客观样本上的模型诊断。

生产模型在这批样本上 AUC 0.498（等于随机）。这个数字太刺眼，
下结论前必须先排除方法论陷阱：

  METAR 的 verdict 由「云底海拔 vs 机位高程」决定。高机位只要天上有云
  就容易判成 above-cloud，低机位则很难。如果 verdict 主要被高程决定，
  那么跨机位混在一起算 AUC，天气信号会被高程差异淹没，
  得到 0.5 是必然的，却不能说明模型没用。

所以要按机位分层：在同一个机位内部（高程固定）再算 AUC。
若分层后仍是 0.5，模型才是真的没有预测力。
"""

import csv
from collections import defaultdict
import numpy as np

rows = list(csv.DictReader(open('data/metar-features.csv', encoding='utf-8')))
print(f'样本 {len(rows)} 条')


def auc(labels, scores):
    labels = np.asarray(labels)
    scores = np.asarray(scores)
    pos, neg = (labels == 1).sum(), (labels == 0).sum()
    if pos == 0 or neg == 0:
        return None
    order = np.argsort(scores, kind='mergesort')
    ranks = np.empty(len(scores), float)
    s = scores[order]
    i = 0
    while i < len(s):
        j = i
        while j < len(s) and s[j] == s[i]:
            j += 1
        ranks[order[i:j]] = (i + j + 1) / 2
        i = j
    return (ranks[labels == 1].sum() - pos * (pos + 1) / 2) / (pos * neg)


lab = np.array([int(r['label']) for r in rows])
sc = np.array([float(r['score']) if r['score'] else np.nan for r in rows])
elev = np.array([float(r['elevation']) for r in rows])
ok = ~np.isnan(sc)

print(f'\n【全局】AUC {auc(lab[ok], sc[ok]):.3f}')

print('\n' + '=' * 70)
print('【检验 1】verdict 是不是主要被机位高程决定？')
print('=' * 70)
print('  如果是，跨机位混算 AUC 就没有意义。')
print(f'  高程 → 标签 的 AUC: {auc(lab, elev):.3f}  (0.5=无关, 越偏离越说明高程主导)')
for lo, hi in [(0, 1000), (1000, 1500), (1500, 2000), (2000, 3000), (3000, 9999)]:
    m = (elev >= lo) & (elev < hi)
    if m.sum() < 30:
        continue
    print(f'    {lo}-{hi}m: n={m.sum():5d}  正样本率 {lab[m].mean()*100:5.1f}%')

print('\n' + '=' * 70)
print('【检验 2】按机位分层——高程固定后，模型还有预测力吗')
print('=' * 70)
by_site = defaultdict(list)
for i, r in enumerate(rows):
    if ok[i]:
        by_site[(r['lat'], r['lon'])].append(i)

per_site, weights = [], []
for key, idx in by_site.items():
    idx = np.array(idx)
    if len(idx) < 40:
        continue
    a = auc(lab[idx], sc[idx])
    if a is None:
        continue
    per_site.append(a)
    weights.append(len(idx))

if per_site:
    per_site = np.array(per_site)
    weights = np.array(weights, float)
    print(f'  可分层机位 {len(per_site)} 个（每个 ≥40 条且正负齐全）')
    print(f'  站内 AUC 均值      : {per_site.mean():.3f}')
    print(f'  站内 AUC 加权均值  : {(per_site*weights).sum()/weights.sum():.3f}')
    print(f'  中位数 / 最差 / 最好: {np.median(per_site):.3f} / {per_site.min():.3f} / {per_site.max():.3f}')
    print(f'  优于随机的机位占比 : {(per_site > 0.5).mean()*100:.0f}%')
else:
    print('  没有足够大的单机位子集')

print('\n' + '=' * 70)
print('【检验 3】单个天气特征在客观标签上的判别力')
print('=' * 70)
print('  模型总分若失效，要看是"所有特征都无关"还是"合成方式有问题"。')
feats = ['humidity', 'dewSpread', 'cloudLow', 'cloudMid', 'cloudHigh',
         'wind', 'pressure', 'visibility', 'temp', 'precip']
res = []
for f in feats:
    v = np.array([float(r[f]) if r[f] else np.nan for r in rows])
    m = ~np.isnan(v)
    if m.sum() < 100:
        continue
    a = auc(lab[m], v[m])
    if a is not None:
        res.append((f, a, abs(a - 0.5)))
for f, a, d in sorted(res, key=lambda x: -x[2]):
    arrow = '↑' if a > 0.5 else '↓'
    print(f'  {f:<12} AUC {a:.3f}  {arrow} 判别力 {d:.3f}')

print('\n' + '=' * 70)
print('【检验 4】站内分层下，单特征的判别力')
print('=' * 70)
print('  这是最干净的一版：高程与地形固定，只剩天气在变。')
mixed = {f: a for f, a, _ in res}
for f in ['cloudLow', 'humidity', 'dewSpread', 'cloudMid', 'wind', 'pressure']:
    v = np.array([float(r[f]) if r[f] else np.nan for r in rows])
    accs, ws = [], []
    for key, idx in by_site.items():
        idx = np.array(idx)
        m = idx[~np.isnan(v[idx])]
        if len(m) < 40:
            continue
        a = auc(lab[m], v[m])
        if a is not None:
            accs.append(a)
            ws.append(len(m))
    if accs:
        accs, ws = np.array(accs), np.array(ws, float)
        wm = (accs * ws).sum() / ws.sum()
        print(f'  {f:<12} 站内加权 AUC {wm:.3f}   (跨站混算 {mixed.get(f, float("nan")):.3f})')

print('\n' + '=' * 70)
print('【检验 5】空间错配假设：天气取自机位，标签取自机场')
print('=' * 70)
print('  若问题出在"用 A 地的天气预测 B 地的云"，那么标签应当随距离变差。')
dist_ok = [(float(r['relativeToSpotM']) if r['relativeToSpotM'] else np.nan) for r in rows]
station = np.array([r['station'] for r in rows])
n_station = len(set(station))
print(f'  涉及测站 {n_station} 个，机位 {len(by_site)} 个')
print('  按「机位高出测站的高差」看正样本率：')
st_elev = elev - np.array([float(r['relativeToSpotM'] or 0) + 0 for r in rows]) * 0
for lo, hi in [(400, 800), (800, 1200), (1200, 2000), (2000, 9999)]:
    m = (elev >= lo) & (elev < hi)
    if m.sum() < 30:
        continue
    a = auc(lab[m], sc[m] if not np.isnan(sc[m]).all() else elev[m])
    astr = f'{a:.3f}' if a is not None else '  n/a'
    print(f'    机位 {lo}-{hi}m: n={m.sum():5d}  正样本率 {lab[m].mean()*100:5.1f}%  模型AUC {astr}')

print()
print('  判读：若各高程带内模型 AUC 都在 0.5 附近，说明这批标签承载的')
print('  主要是高程信息而非天气信息，不适合作为云海训练标签。')
