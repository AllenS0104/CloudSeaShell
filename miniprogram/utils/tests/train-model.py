"""
Train ML calibration model for cloud sea prediction.
Run: python utils/tests/train-model.py

Strategy: Logistic regression on rule_score + 8 features
Validation: GroupKFold by location (no location leakage)
"""

import csv
import json
import math
import os
import sys
from collections import defaultdict

# === Load dataset ===
script_dir = os.path.dirname(os.path.abspath(__file__))
csv_path = os.path.join(script_dir, 'ml-dataset.csv')

if not os.path.exists(csv_path):
    print("❌ ml-dataset.csv not found. Run build-dataset.js first.")
    sys.exit(1)

data = []
with open(csv_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        data.append(row)

print(f"📊 Loaded {len(data)} samples")

# === Extract features and labels ===
FEATURES = ['rule_score', 'humidity', 'dew_gap', 'cloud_cover', 'low_cloud_cover',
            'low_cloud_ratio', 'wind_speed', 'pressure', 'inversion_detected']

X = []
y = []
groups = []  # location for GroupKFold

for row in data:
    features = []
    for f in FEATURES:
        features.append(float(row[f]))
    X.append(features)
    y.append(int(row['observed']))
    groups.append(row['location'].strip('"'))

n = len(X)
n_pos = sum(y)
n_neg = n - n_pos
print(f"   Positive: {n_pos}, Negative: {n_neg}")
print(f"   Locations: {len(set(groups))}")

# === Normalize features (z-score) ===
means = [0.0] * len(FEATURES)
stds = [0.0] * len(FEATURES)

for j in range(len(FEATURES)):
    vals = [X[i][j] for i in range(n)]
    means[j] = sum(vals) / n
    stds[j] = math.sqrt(sum((v - means[j])**2 for v in vals) / n) or 1.0

X_norm = []
for i in range(n):
    X_norm.append([(X[i][j] - means[j]) / stds[j] for j in range(len(FEATURES))])

# === Logistic Regression (pure Python, no sklearn needed) ===
def sigmoid(z):
    z = max(min(z, 500), -500)  # prevent overflow
    return 1.0 / (1.0 + math.exp(-z))

def predict_proba(weights, bias, x):
    z = bias + sum(w * xi for w, xi in zip(weights, x))
    return sigmoid(z)

def train_logistic(X_train, y_train, lr=0.1, epochs=1000, l2=0.1):
    """Train L2-regularized logistic regression with gradient descent"""
    n_features = len(X_train[0])
    weights = [0.0] * n_features
    bias = 0.0

    for epoch in range(epochs):
        dw = [0.0] * n_features
        db = 0.0

        for i in range(len(X_train)):
            p = predict_proba(weights, bias, X_train[i])
            error = p - y_train[i]
            for j in range(n_features):
                dw[j] += error * X_train[i][j]
            db += error

        m = len(X_train)
        for j in range(n_features):
            weights[j] -= lr * (dw[j] / m + l2 * weights[j] / m)
        bias -= lr * db / m

    return weights, bias

# === GroupKFold by location ===
unique_locations = sorted(set(groups))
n_folds = min(5, len(unique_locations))

# Assign locations to folds
loc_to_fold = {}
for i, loc in enumerate(unique_locations):
    loc_to_fold[loc] = i % n_folds

print(f"\n🔬 {n_folds}-fold GroupKFold cross-validation")
print("=" * 60)

all_preds = [None] * n
all_probas = [None] * n

for fold in range(n_folds):
    test_locs = [loc for loc, f in loc_to_fold.items() if f == fold]
    train_idx = [i for i in range(n) if groups[i] not in test_locs]
    test_idx = [i for i in range(n) if groups[i] in test_locs]

    if not test_idx or not train_idx:
        continue

    X_train = [X_norm[i] for i in train_idx]
    y_train = [y[i] for i in train_idx]
    X_test = [X_norm[i] for i in test_idx]
    y_test = [y[i] for i in test_idx]

    weights, bias_val = train_logistic(X_train, y_train, lr=0.05, epochs=2000, l2=0.5)

    # Predict with threshold tuning for high recall
    for i, ti in enumerate(test_idx):
        prob = predict_proba(weights, bias_val, X_test[i])
        all_probas[ti] = prob
        all_preds[ti] = 1 if prob >= 0.4 else 0  # lower threshold for recall

    fold_correct = sum(1 for i in test_idx if all_preds[i] == y[i])
    print(f"  Fold {fold}: test_locs={test_locs[:3]}{'...' if len(test_locs) > 3 else ''}, "
          f"samples={len(test_idx)}, acc={fold_correct}/{len(test_idx)}")

# === Overall metrics ===
valid = [i for i in range(n) if all_preds[i] is not None]
tp = sum(1 for i in valid if all_preds[i] == 1 and y[i] == 1)
fp = sum(1 for i in valid if all_preds[i] == 1 and y[i] == 0)
fn = sum(1 for i in valid if all_preds[i] == 0 and y[i] == 1)
tn = sum(1 for i in valid if all_preds[i] == 0 and y[i] == 0)

accuracy = (tp + tn) / len(valid) if valid else 0
precision = tp / (tp + fp) if (tp + fp) > 0 else 0
recall = tp / (tp + fn) if (tp + fn) > 0 else 0

print(f"\n{'=' * 60}")
print(f"📋 ML Model Results (GroupKFold, no location leakage)")
print(f"{'=' * 60}")
print(f"   Accuracy:  {accuracy:.1%} ({tp+tn}/{len(valid)})")
print(f"   Precision: {precision:.1%}")
print(f"   Recall:    {recall:.1%}")
print(f"   TP={tp} FP={fp} FN={fn} TN={tn}")

# === Compare with rule-based baseline ===
rule_tp = sum(1 for i in valid if float(data[i]['rule_score']) >= 55 and y[i] == 1)
rule_fp = sum(1 for i in valid if float(data[i]['rule_score']) >= 55 and y[i] == 0)
rule_fn = sum(1 for i in valid if float(data[i]['rule_score']) < 55 and y[i] == 1)
rule_tn = sum(1 for i in valid if float(data[i]['rule_score']) < 55 and y[i] == 0)
rule_acc = (rule_tp + rule_tn) / len(valid) if valid else 0
rule_prec = rule_tp / (rule_tp + rule_fp) if (rule_tp + rule_fp) > 0 else 0
rule_recall = rule_tp / (rule_tp + rule_fn) if (rule_tp + rule_fn) > 0 else 0

print(f"\n📋 Rule-Based Baseline (threshold=55)")
print(f"   Accuracy:  {rule_acc:.1%}")
print(f"   Precision: {rule_prec:.1%}")
print(f"   Recall:    {rule_recall:.1%}")
print(f"   TP={rule_tp} FP={rule_fp} FN={rule_fn} TN={rule_tn}")

print(f"\n📊 Comparison")
print(f"   Accuracy:  {'↑' if accuracy > rule_acc else '↓' if accuracy < rule_acc else '='} ML {accuracy:.1%} vs Rule {rule_acc:.1%}")
print(f"   Precision: {'↑' if precision > rule_prec else '↓' if precision < rule_prec else '='} ML {precision:.1%} vs Rule {rule_prec:.1%}")
print(f"   Recall:    {'↑' if recall > rule_recall else '↓' if recall < rule_recall else '='} ML {recall:.1%} vs Rule {rule_recall:.1%}")
print(f"   FP change: {rule_fp} → {fp} ({'↓ fewer FP' if fp < rule_fp else '↑ more FP' if fp > rule_fp else 'same'})")

# === Feature importance (absolute weight) ===
# Train on full dataset for feature importance
weights_full, bias_full = train_logistic(X_norm, y, lr=0.05, epochs=2000, l2=0.5)
print(f"\n📊 Feature Importance (|weight|)")
importance = sorted(zip(FEATURES, weights_full), key=lambda x: abs(x[1]), reverse=True)
for feat, w in importance:
    bar = '█' * int(abs(w) * 10)
    print(f"   {feat:20s} {w:+.3f} {bar}")

# === Export model for JS ===
model = {
    'type': 'logistic_regression',
    'features': FEATURES,
    'weights': weights_full,
    'bias': bias_full,
    'means': means,
    'stds': stds,
    'threshold': 0.4,
    'note': f'Trained on {n} samples, {len(set(groups))} locations, GroupKFold validated'
}

model_path = os.path.join(script_dir, 'ml-model.json')
with open(model_path, 'w') as f:
    json.dump(model, f, indent=2)
print(f"\n✅ Model exported: {model_path}")
