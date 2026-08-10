#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
对初评结论做稳健性复核。

单次交叉验证的差异可能只是随机划分造成的。这里用多个随机种子重复，
看结论是否稳定。同时对"前期降水"给出更公平的检验——
也许它不是线性有效，而是只在特定条件下有效。
"""
import csv
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import cross_val_score, StratifiedKFold
from sklearn.impute import SimpleImputer
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score

EXCLUDE = {'label', 'date', 'lat', 'lon', 'source'}

rows = list(csv.DictReader(open('data/features.csv', encoding='utf-8')))
cols = [c for c in rows[0] if c not in EXCLUDE]
X = np.array([[float(r[c]) if r[c] else np.nan for c in cols] for r in rows])
y = np.array([int(r['label']) for r in rows])
src = np.array([r.get('source', '') for r in rows])
ci = {c: i for i, c in enumerate(cols)}

NEW = ['precip24', 'precip48', 'precipToday', 'wetThenClear', 'nightCloudHigh',
       'nightCloudTotal', 'nightCloudLow', 'nightCooling', 'humidityNight',
       'humidityRise', 'windDir']
OLD = [c for c in cols if c not in NEW]


def cv_auc(idx, seeds=(1, 7, 42, 99, 2024), model='gb'):
    """多种子重复交叉验证，返回均值与标准差。"""
    scores = []
    for s in seeds:
        if model == 'gb':
            m = make_pipeline(SimpleImputer(strategy='median'),
                              GradientBoostingClassifier(random_state=s))
        elif model == 'lr':
            m = make_pipeline(SimpleImputer(strategy='median'), StandardScaler(),
                              LogisticRegression(max_iter=2000))
        else:
            m = make_pipeline(SimpleImputer(strategy='median'),
                              DecisionTreeClassifier(max_depth=3, min_samples_leaf=20,
                                                     random_state=s))
        cv = StratifiedKFold(5, shuffle=True, random_state=s)
        scores.append(cross_val_score(m, X[:, idx], y, cv=cv, scoring='roc_auc').mean())
    return np.mean(scores), np.std(scores)


print('=' * 74)
print('【复核 1】夜间辐射冷却的增益是否稳定（5 个随机种子）')
print('=' * 74)
base_idx = [ci[c] for c in OLD]
night = ['nightCloudHigh', 'nightCloudTotal', 'nightCloudLow', 'nightCooling']
night_idx = base_idx + [ci[c] for c in night]

b_m, b_s = cv_auc(base_idx)
n_m, n_s = cv_auc(night_idx)
print(f'  仅现有特征        {b_m:.3f} ± {b_s:.3f}')
print(f'  + 夜间辐射冷却组   {n_m:.3f} ± {n_s:.3f}')
print(f'  → 增益 {n_m - b_m:+.3f}')
print(f'  {"✅ 增益大于种子间波动，可信" if (n_m - b_m) > b_s else "⚠️ 增益小于随机波动，存疑"}')

print()
print('  逐个拆解，哪一个在起作用:')
for f in night:
    m, s = cv_auc(base_idx + [ci[f]])
    print(f'    + {f:<18}{m:.3f}  ({m - b_m:+.3f})')

print()
print('=' * 74)
print('【复核 2】给"前期降水"一个更公平的检验')
print('=' * 74)
print('  初评里 precip24 的 AUC 是 0.433（方向为负，即前期降水越多云海越少），')
print('  与"久雨初晴出云海"相反。但也许它并非线性有效，而是有条件的。')
print()

p24 = X[:, ci['precip24']]
ptoday = X[:, ci['precipToday']]
cloud = X[:, ci['cloudTotal']]

# 只看"当天不下雨"的子集，此时前期降水才可能体现"久雨初晴"
clear_today = ptoday < 0.5
print(f'  当天无降水的样本: {clear_today.sum()} 条（正样本率 {y[clear_today].mean()*100:.1f}%）')
for lo, hi, name in [(-1, 0.5, '前期无雨'), (0.5, 5, '前期小雨'), (5, 20, '前期中雨'), (20, 1e9, '前期大雨')]:
    m = clear_today & (p24 > lo) & (p24 <= hi)
    if m.sum() >= 20:
        print(f'    {name:<8} n={m.sum():>3}  云海发生率 {y[m].mean()*100:>5.1f}%')

print()
print('  基准（全样本）云海发生率: %.1f%%' % (y.mean() * 100))

print()
print('=' * 74)
print('【复核 3】决策树 vs 线性，多种子确认')
print('=' * 74)
all_idx = list(range(len(cols)))
for name, mdl in [('逻辑回归（≈线性加权）', 'lr'), ('决策树 depth=3', 'dt'), ('梯度提升', 'gb')]:
    m, s = cv_auc(all_idx, model=mdl)
    print(f'  {name:<24}{m:.3f} ± {s:.3f}')

print()
print('=' * 74)
print('【复核 4】幸存者偏差的实际后果')
print('=' * 74)

# 控制日的 source 统一是 'control-day'，丢失了出身。
# 但控制日与其母样本共享同一坐标，可据此还原归属，
# 否则「外部源」子集会只剩正样本，跨源检验无从做起。
ext_coords = {(r['lat'], r['lon']) for r in rows if r.get('source', '').startswith('wikimedia')}
is_ext = np.array([(r['lat'], r['lon']) in ext_coords for r in rows])
print(f'  按坐标还原归属后 → 外部源家族 {is_ext.sum()} 条'
      f'（正 {y[is_ext].sum()}）/ 国内家族 {(~is_ext).sum()} 条（正 {y[~is_ext].sum()}）')
print()

for train_name, train_mask, test_name, test_mask in [
        ('国内家族', ~is_ext, '外部源家族', is_ext),
        ('外部源家族', is_ext, '国内家族', ~is_ext)]:
    if train_mask.sum() < 50 or test_mask.sum() < 50:
        continue
    if len(np.unique(y[train_mask])) < 2 or len(np.unique(y[test_mask])) < 2:
        print(f'  {train_name} → {test_name}: 跳过（某侧只有单一类别）')
        continue
    m = make_pipeline(SimpleImputer(strategy='median'),
                      GradientBoostingClassifier(random_state=42))
    m.fit(X[train_mask], y[train_mask])
    p = m.predict_proba(X[test_mask])[:, 1]
    a = roc_auc_score(y[test_mask], p)
    print(f'  在「{train_name}」上训练 → 在「{test_name}」上测试: AUC {a:.3f}')

print()
print('  若跨源 AUC 明显低于同源 CV AUC(~0.685)，说明两个数据源学到的规律不通用，')
print('  合并训练得到的高分有相当部分来自"识别数据来源"而非预测天气。')
