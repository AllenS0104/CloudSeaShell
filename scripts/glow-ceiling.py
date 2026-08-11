#!/usr/bin/env python3
"""
晚霞标签的信息上界检验。

背景：晚霞评分模块 AUC 只有 0.566，接近随机。在动手调权重之前必须先回答
一个问题——**是评分写错了，还是这批标签本身就没有足够信息？**

METAR 那次的教训就是：拿到一批"客观"样本后急着下结论，结果发现标签
承载的是高程而不是天气。这次先做上界检验。

方法：用逻辑回归在同一批特征上做交叉验证。逻辑回归是这些特征能提取的
线性信息的上界（此前已验证 682 条云海样本上逻辑回归 0.677 优于决策树
0.623，样本量这个量级撑不起非线性模型）。
  - 若逻辑回归 AUC 明显高于 0.566 → 评分权重确实写错了，值得改
  - 若逻辑回归也在 0.6 以下 → 标签信息量不足，调参只是过拟合
"""

import csv
import os
import numpy as np

from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import roc_auc_score
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline

HERE = os.path.dirname(os.path.abspath(__file__))
CSV = os.path.join(HERE, '..', 'data', 'glow-features.csv')

rows = []
with open(CSV, newline='', encoding='utf-8') as f:
    for r in csv.DictReader(f):
        rows.append({k: float(v) for k, v in r.items()})

FEATS = ['cloudMid', 'cloudHigh', 'cloudLow', 'cloudTotal',
         'humidity', 'visibility', 'pressure', 'precip', 'wind']

y = np.array([r['label'] for r in rows])
X = np.array([[r[k] for k in FEATS] for r in rows])
score = np.array([r['score'] for r in rows])

print(f'样本 {len(y)} 条（正 {int(y.sum())} / 负 {int((1 - y).sum())}）\n')
print(f'现有评分 AUC              : {roc_auc_score(y, score):.3f}')

# 多种子重复交叉验证，避免被单次划分的运气误导
aucs = []
for seed in range(10):
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=seed)
    oof = np.zeros(len(y))
    for tr, te in cv.split(X, y):
        m = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, C=0.5))
        m.fit(X[tr], y[tr])
        oof[te] = m.predict_proba(X[te])[:, 1]
    aucs.append(roc_auc_score(y, oof))

print(f'逻辑回归 CV AUC（上界估计）: {np.mean(aucs):.3f} ± {np.std(aucs):.3f}\n')

# 拟合方向：系数符号告诉我们每个变量"应该"往哪边走
m = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, C=0.5))
m.fit(X, y)
coef = m[-1].coef_[0]
print('模型学到的方向（正=有利于晚霞，负=不利）')
print('特征            系数     现有评分的处理')
CURRENT = {
    'cloudMid': '最大正分 +28（30-70%最佳）',
    'cloudHigh': '正分 +18',
    'cloudLow': '惩罚 -20',
    'cloudTotal': '未直接使用',
    'humidity': '正分 +12（40-75%最佳）',
    'visibility': '正分 +12',
    'pressure': '未直接使用',
    'precip': '未直接使用',
    'wind': '未直接使用',
}
order = np.argsort(-np.abs(coef))
for i in order:
    print(f'{FEATS[i]:<14} {coef[i]:+.3f}   {CURRENT[FEATS[i]]}')

# 单独确认中层云的方向，因为它是现有评分权重最大的一项
print('\n中层云分档 → 晚霞出现率（现有评分认为 30-70% 最佳）')
mid = X[:, FEATS.index('cloudMid')]
for lo, hi in [(0, 10), (10, 30), (30, 70), (70, 90), (90, 101)]:
    sel = (mid >= lo) & (mid < hi)
    if sel.sum() >= 10:
        print(f'  {lo:3d}-{hi:3d}%  n={sel.sum():3d}  出现率 {y[sel].mean() * 100:5.1f}%')

print('\n高层云分档 → 晚霞出现率（SunsetWx 认为高层云最重要）')
high = X[:, FEATS.index('cloudHigh')]
for lo, hi in [(0, 10), (10, 30), (30, 60), (60, 90), (90, 101)]:
    sel = (high >= lo) & (high < hi)
    if sel.sum() >= 10:
        print(f'  {lo:3d}-{hi:3d}%  n={sel.sum():3d}  出现率 {y[sel].mean() * 100:5.1f}%')
