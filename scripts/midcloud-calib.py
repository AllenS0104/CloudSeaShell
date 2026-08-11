"""
中层云惩罚的定标。

上一步发现：在最易误判的高湿子集里，中层云 AUC 0.319、
云层厚度 min(低,中) AUC 0.311，判别力比我们测过的任何候选特征
都强一个量级。而现有评分里**根本没有中层云这一项**
（只有总云量 8 分、低云量 12 分）。

这一步要回答三件事：
  1. 切点应该定在哪
  2. 该惩罚多少分
  3. 它是不是只是"总云量"的影子（若是，加了也白加）
"""

import csv
import numpy as np

rows = list(csv.DictReader(open('data/features.csv', encoding='utf-8')))


def col(n):
    return np.array([float(r[n]) if r[n] not in ('', 'nan') else np.nan for r in rows])


y = col('label')
mid, low, tot = col('cloudMid'), col('cloudLow'), col('cloudTotal')
hum, elev = col('humidity'), col('elevation')

print('=' * 72)
print('【1】中层云分档看成功率')
print('=' * 72)
edges = [0, 10, 25, 50, 75, 90, 101]
for a, b in zip(edges[:-1], edges[1:]):
    m = (mid >= a) & (mid < b)
    if m.sum() < 15:
        continue
    print(f'  中层云 {a:>3}-{b:<3}%  n={m.sum():3d}   成功率 {y[m].mean()*100:5.1f}%')

print('\n  同一分档，但只看高湿样本（模型最容易误判的区域）：')
wet = hum >= 90
for a, b in zip(edges[:-1], edges[1:]):
    m = (mid >= a) & (mid < b) & wet
    if m.sum() < 12:
        continue
    print(f'  中层云 {a:>3}-{b:<3}%  n={m.sum():3d}   成功率 {y[m].mean()*100:5.1f}%')

print('\n' + '=' * 72)
print('【2】找最优切点（按成功率落差）')
print('=' * 72)
best = []
for cut in range(10, 95, 5):
    lo_m, hi_m = mid < cut, mid >= cut
    if lo_m.sum() < 50 or hi_m.sum() < 50:
        continue
    drop = y[lo_m].mean() - y[hi_m].mean()
    best.append((cut, drop, lo_m.sum(), hi_m.sum(), y[lo_m].mean(), y[hi_m].mean()))
best.sort(key=lambda x: -x[1])
for cut, drop, nlo, nhi, plo, phi in best[:5]:
    print(f'  切点 {cut:>2}%: 低于 {plo*100:5.1f}% (n={nlo})  高于 {phi*100:5.1f}% (n={nhi})'
          f'   落差 {drop*100:+5.1f}pp')

print('\n' + '=' * 72)
print('【3】它是不是总云量的影子？')
print('=' * 72)
m = ~np.isnan(mid) & ~np.isnan(tot)
print(f'  中层云 与 总云量 相关系数 {np.corrcoef(mid[m], tot[m])[0,1]:+.3f}')
m2 = ~np.isnan(mid) & ~np.isnan(low)
print(f'  中层云 与 低层云 相关系数 {np.corrcoef(mid[m2], low[m2])[0,1]:+.3f}')
print()
print('  控制总云量后，中层云还有没有独立信号：')
for a, b in [(0, 50), (50, 85), (85, 101)]:
    band = (tot >= a) & (tot < b)
    if band.sum() < 60:
        continue
    hi = band & (mid >= 40)
    lo = band & (mid < 40)
    if hi.sum() < 15 or lo.sum() < 15:
        continue
    print(f'    总云量 {a}-{b}%: 中层云<40% 成功率 {y[lo].mean()*100:5.1f}% (n={lo.sum():3d})'
          f'  |  >=40% 成功率 {y[hi].mean()*100:5.1f}% (n={hi.sum():3d})'
          f'   落差 {(y[lo].mean()-y[hi].mean())*100:+5.1f}pp')

print('\n' + '=' * 72)
print('【4】惩罚力度试算')
print('=' * 72)
print('  成功率落差换算成分数：现有满分 100，通过阈值 75。')
for cut in [40, 50]:
    lo_m, hi_m = mid < cut, mid >= cut
    plo, phi = y[lo_m].mean(), y[hi_m].mean()
    ratio = phi / plo if plo > 0 else 0
    print(f'  切点 {cut}%: 高中层云组成功率是低组的 {ratio*100:.0f}%，'
          f'相对下降 {(1-ratio)*100:.0f}%')
