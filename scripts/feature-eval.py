#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
候选特征的增益评估 —— 检验建议是否真的成立

评估三件事：
  1. 每个候选特征单独的判别力（AUC）与显著性
  2. 浅层决策树 vs 线性加权，是否真有"质的飞跃"
  3. 交叉验证下的诚实估计（不是训练集上的自我表扬）

关键原则：所有指标都用交叉验证。在训练集上评估树模型必然虚高，
因为树可以记住样本。682 条样本很容易过拟合，不做 CV 的结论没有意义。
"""
import csv
import sys
import numpy as np
from sklearn.tree import DecisionTreeClassifier, export_text
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import cross_val_score, StratifiedKFold
from sklearn.metrics import roc_auc_score
from sklearn.impute import SimpleImputer
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

CSV = 'data/features.csv'

EXCLUDE = {'label', 'date', 'lat', 'lon', 'source'}

def load():
    rows = []
    with open(CSV, encoding='utf-8') as f:
        for r in csv.DictReader(f):
            rows.append(r)
    if not rows:
        sys.exit('features.csv 为空')
    cols = [c for c in rows[0].keys() if c not in EXCLUDE]
    X, y, src = [], [], []
    for r in rows:
        X.append([float(r[c]) if r[c] not in ('', None) else np.nan for c in cols])
        y.append(int(r['label']))
        src.append(r.get('source', ''))
    return np.array(X, float), np.array(y), cols, np.array(src)


def single_feature_auc(X, y, cols):
    """每个特征单独能分开多少。AUC<0.5 说明方向与直觉相反。"""
    print('=' * 74)
    print('【1】单特征判别力（AUC 距 0.5 越远越有信息量）')
    print('=' * 74)
    out = []
    for i, c in enumerate(cols):
        v = X[:, i]
        m = ~np.isnan(v)
        if m.sum() < 50 or len(np.unique(y[m])) < 2:
            continue
        try:
            a = roc_auc_score(y[m], v[m])
        except ValueError:
            continue
        out.append((abs(a - 0.5), a, c, int(m.sum())))
    out.sort(reverse=True)
    print(f"{'特征':<18}{'AUC':>8}{'方向':>6}{'样本':>7}")
    print('-' * 74)
    for strength, a, c, n in out:
        direction = '正' if a > 0.5 else '负'
        flag = ''
        if strength >= 0.10:
            flag = '  ← 强'
        elif strength >= 0.05:
            flag = '  ← 中'
        print(f'{c:<18}{a:>8.3f}{direction:>6}{n:>7}{flag}')
    return out


def compare_models(X, y, cols):
    print()
    print('=' * 74)
    print('【2】线性加权 vs 浅层决策树（5 折交叉验证，非训练集自评）')
    print('=' * 74)

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    imp = SimpleImputer(strategy='median')

    models = {
        '逻辑回归（≈线性加权）': make_pipeline(SimpleImputer(strategy='median'),
                                        StandardScaler(),
                                        LogisticRegression(max_iter=2000)),
        '决策树 depth=3': make_pipeline(SimpleImputer(strategy='median'),
                                     DecisionTreeClassifier(max_depth=3, random_state=42,
                                                            min_samples_leaf=20)),
        '决策树 depth=4': make_pipeline(SimpleImputer(strategy='median'),
                                     DecisionTreeClassifier(max_depth=4, random_state=42,
                                                            min_samples_leaf=20)),
        '决策树 depth=6（对照）': make_pipeline(SimpleImputer(strategy='median'),
                                        DecisionTreeClassifier(max_depth=6, random_state=42,
                                                               min_samples_leaf=10)),
        '梯度提升（上限参考）': make_pipeline(SimpleImputer(strategy='median'),
                                     GradientBoostingClassifier(random_state=42)),
    }

    print(f"{'模型':<26}{'CV AUC':>10}{'标准差':>10}   {'训练集 AUC':>10}")
    print('-' * 74)
    results = {}
    for name, m in models.items():
        s = cross_val_score(m, X, y, cv=cv, scoring='roc_auc')
        m.fit(X, y)
        train_auc = roc_auc_score(y, m.predict_proba(X)[:, 1])
        results[name] = s.mean()
        gap = train_auc - s.mean()
        warn = '  ⚠️ 过拟合' if gap > 0.15 else ''
        print(f'{name:<26}{s.mean():>10.3f}{s.std():>10.3f}   {train_auc:>10.3f}{warn}')
    return results


def show_tree(X, y, cols):
    print()
    print('=' * 74)
    print('【3】depth=3 决策树的实际结构（可直接转 if-else）')
    print('=' * 74)
    imp = SimpleImputer(strategy='median')
    Xi = imp.fit_transform(X)
    t = DecisionTreeClassifier(max_depth=3, random_state=42, min_samples_leaf=20)
    t.fit(Xi, y)
    print(export_text(t, feature_names=list(cols), decimals=1))

    print('特征重要性（树实际用到的）:')
    order = np.argsort(t.feature_importances_)[::-1]
    for i in order[:8]:
        if t.feature_importances_[i] > 0:
            print(f'  {cols[i]:<18}{t.feature_importances_[i]:.3f}')


def ablation(X, y, cols):
    """新特征到底带来多少增量 —— 去掉它们看 AUC 掉多少。"""
    print()
    print('=' * 74)
    print('【4】消融实验：新提议的特征是否真有增量')
    print('=' * 74)

    new_feats = ['precip24', 'precip48', 'precipToday', 'wetThenClear',
                 'nightCloudHigh', 'nightCloudTotal', 'nightCloudLow',
                 'nightCooling', 'humidityNight', 'humidityRise', 'windDir']
    idx_new = [i for i, c in enumerate(cols) if c in new_feats]
    idx_old = [i for i, c in enumerate(cols) if c not in new_feats]

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    mk = lambda: make_pipeline(SimpleImputer(strategy='median'),
                               GradientBoostingClassifier(random_state=42))

    a_old = cross_val_score(mk(), X[:, idx_old], y, cv=cv, scoring='roc_auc').mean()
    a_all = cross_val_score(mk(), X, y, cv=cv, scoring='roc_auc').mean()
    a_new = cross_val_score(mk(), X[:, idx_new], y, cv=cv, scoring='roc_auc').mean()

    print(f'  仅现有类特征      CV AUC {a_old:.3f}')
    print(f'  仅新提议特征      CV AUC {a_new:.3f}')
    print(f'  全部特征          CV AUC {a_all:.3f}')
    print(f'  → 新特征带来的增量: {a_all - a_old:+.3f}')

    print('\n  逐组增量:')
    groups = {
        '前期降水组': ['precip24', 'precip48', 'precipToday', 'wetThenClear'],
        '夜间辐射冷却组': ['nightCloudHigh', 'nightCloudTotal', 'nightCloudLow', 'nightCooling'],
        '湿度演变组': ['humidityNight', 'humidityRise'],
        '风向': ['windDir'],
    }
    for gname, feats in groups.items():
        idx = idx_old + [i for i, c in enumerate(cols) if c in feats]
        a = cross_val_score(mk(), X[:, idx], y, cv=cv, scoring='roc_auc').mean()
        print(f'    现有 + {gname:<14} {a:.3f}  ({a - a_old:+.3f})')


def by_source(X, y, cols, src):
    print()
    print('=' * 74)
    print('【5】幸存者偏差检验：模型是在学天气，还是在学"数据来自哪里"')
    print('=' * 74)
    is_ext = np.array([s.startswith('wikimedia') for s in src])
    print(f'  外部源样本 {is_ext.sum()} 条 / 人工标注 {(~is_ext).sum()} 条')
    if is_ext.sum() > 30 and (~is_ext).sum() > 30:
        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        mk = lambda: make_pipeline(SimpleImputer(strategy='median'),
                                   GradientBoostingClassifier(random_state=42))
        # 用天气特征预测"这条样本是不是来自外部源"
        a = cross_val_score(mk(), X, is_ext.astype(int), cv=cv, scoring='roc_auc').mean()
        print(f'  用天气特征反推数据来源的 AUC: {a:.3f}')
        if a > 0.75:
            print('  ⚠️  两个来源的天气分布差异极大。合并训练会让模型学到')
            print('     "来源特征"而非物理规律，这正是幸存者偏差的量化证据。')
        else:
            print('  两来源天气分布接近，合并训练风险可控。')


if __name__ == '__main__':
    X, y, cols, src = load()
    print(f'样本 {len(y)} 条，正样本 {y.sum()} 条（{y.mean() * 100:.1f}%），特征 {len(cols)} 个\n')
    single_feature_auc(X, y, cols)
    compare_models(X, y, cols)
    show_tree(X, y, cols)
    ablation(X, y, cols)
    by_source(X, y, cols, src)
