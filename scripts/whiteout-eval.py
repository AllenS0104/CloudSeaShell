"""
云海 vs 云雾（白墙）的可分性检验。

问题
----
现有评分只算云底（cloudBase），用 gapToElevation = 机位高程 - 云底 打 25 分。
但云底低只保证"云从你脚下开始"，没说"云到你头顶就停了"：

    云底 1000m，云顶 1500m，机位 1860m  → 云海，机位在云上
    云底 1000m，云顶 2500m，机位 1860m  → 白墙，机位埋在云中

两种情况 gapToElevation 都是 860m，**当前评分完全无法区分**。
白墙时湿度接近 100、露点差接近 0、低云量满格，全是加分项，
所以白墙必然拿高分——这正是假阳性的主要来源。

检验思路
--------
云顶高度没有直接观测，但云层的垂直结构可以代理：
只有低云 → 云层浅，云顶低；低云中云都厚 → 云层深，云顶高。

若"云顶"这个概念真的有用，应当出现一个**交互效应**：
中层云对低机位（可能被埋在云里）是坏消息，
对足够高的机位（远在云顶之上）则无所谓。

这个交互如果不存在，说明云顶判据在现有数据上得不到支持，不该写进判据。
"""

import csv
import numpy as np

rows = list(csv.DictReader(open('data/features.csv', encoding='utf-8')))


def col(name):
    return np.array([float(r[name]) if r[name] not in ('', 'nan') else np.nan for r in rows])


def auc(y, s):
    y = np.asarray(y)
    s = np.asarray(s)
    m = ~np.isnan(s)
    y, s = y[m], s[m]
    p, n = (y == 1).sum(), (y == 0).sum()
    if p == 0 or n == 0:
        return None
    o = np.argsort(s, kind='mergesort')
    r = np.empty(len(s), float)
    ss = s[o]
    i = 0
    while i < len(ss):
        j = i
        while j < len(ss) and ss[j] == ss[i]:
            j += 1
        r[o[i:j]] = (i + j + 1) / 2
        i = j
    return (r[y == 1].sum() - p * (p + 1) / 2) / (p * n)


y = col('label')
elev = col('elevation')
low, mid, high = col('cloudLow'), col('cloudMid'), col('cloudHigh')
hum, dew = col('humidity'), col('dewSpread')

print(f'样本 {len(rows)}（正 {int(y.sum())} / 负 {int((y == 0).sum())}）')
print(f'机位高程 中位数 {np.nanmedian(elev):.0f}m  范围 {np.nanmin(elev):.0f}-{np.nanmax(elev):.0f}m')

print('\n' + '=' * 72)
print('【检验 1】中层云的影响是否随机位高程而变（云顶判据的核心预测）')
print('=' * 72)
print('  若云顶概念成立：中层云对低机位应是坏消息，对高机位应无所谓。')
print()
bands = [(0, 1200), (1200, 1800), (1800, 2600), (2600, 9999)]
for lo, hi in bands:
    m = (elev >= lo) & (elev < hi)
    if m.sum() < 40:
        continue
    a = auc(y[m], mid[m])
    # 同时看低云，作为对照：低云是云海的必要条件，不应有同样的高程依赖
    al = auc(y[m], low[m])
    astr = f'{a:.3f}' if a else ' n/a '
    alstr = f'{al:.3f}' if al else ' n/a '
    print(f'  机位 {lo:>4}-{hi:<4}m  n={m.sum():3d}  正样本率 {y[m].mean()*100:4.1f}%'
          f'   中层云AUC {astr}   低层云AUC {alstr}')
print()
print('  读法：中层云 AUC <0.5 表示"中层云越多越不容易出云海"。')
print('  若这个负向在低机位更强、在高机位减弱，就支持云顶判据。')

print('\n' + '=' * 72)
print('【检验 2】构造"云顶超过机位"的风险代理，看是否有判别力')
print('=' * 72)
# 云层深厚程度：低云和中云同时厚，说明云体垂直发展，云顶高
depth = np.fmin(low, mid)
# 机位越低越容易被埋，用高程做归一
risk = depth * np.clip((2600 - elev) / 2600, 0, 1)
for name, v in [('云层厚度 min(低,中)', depth), ('白墙风险 厚度x低机位', risk)]:
    a = auc(y, v)
    print(f'  {name:<24} AUC {a:.3f}   (<0.5 = 越大越不利)')

print('\n' + '=' * 72)
print('【检验 3】在"高湿度"子集里，什么把成功和失败分开')
print('=' * 72)
print('  高湿是云海和白墙的共同特征，模型在这里最容易误判。')
wet = (hum >= 90) & ~np.isnan(hum)
print(f'  湿度 >=90% 的样本 {wet.sum()} 条，正样本率 {y[wet].mean()*100:.1f}%')
if wet.sum() > 60:
    for name, v in [('中层云', mid), ('高层云', high), ('低层云', low),
                    ('机位高程', elev), ('露点差', dew), ('云层厚度', depth)]:
        a = auc(y[wet], v[wet])
        if a:
            d = '↓不利' if a < 0.5 else '↑有利'
            print(f'    {name:<10} AUC {a:.3f}  {d}')

print('\n' + '=' * 72)
print('【检验 4】高程本身在高湿子集里的作用')
print('=' * 72)
print('  云顶判据的一个直接推论：湿度都很高时，机位越高越可能在云上。')
if wet.sum() > 60:
    for lo, hi in [(0, 1200), (1200, 1800), (1800, 2600), (2600, 9999)]:
        m = wet & (elev >= lo) & (elev < hi)
        if m.sum() < 20:
            continue
        print(f'    机位 {lo:>4}-{hi:<4}m  n={m.sum():3d}  成功率 {y[m].mean()*100:5.1f}%')
