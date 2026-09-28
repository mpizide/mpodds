"""
Train MLB Prediction Models
  1. Win probability  (classifier)  -> moneyline
  2. Run differential (regressor)   -> run line
  3. Total runs       (regressor)   -> over/under

Uses time-series cross-validation (always trains on the past, tests on the future) and keeps
the best model of each type. Also saves the out-of-fold prediction errors, which the prediction
script uses to turn a projected total / run differential into real over/under and run line
probabilities instead of a rule of thumb.
"""

import json
import os
import sys
import warnings

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss, mean_absolute_error, roc_auc_score
from sklearn.model_selection import TimeSeriesSplit
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier, XGBRegressor

from mlb_features import DATA_DIR, FEATURE_COLUMNS

warnings.filterwarnings('ignore')
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

MODEL_DIR = os.path.dirname(__file__)

print("Loading training data...")
data = pd.read_csv(os.path.join(DATA_DIR, 'training_data.csv'))
data = data.sort_values('game_datetime').reset_index(drop=True)
print(f"Training dataset: {len(data)} games")

X = data[FEATURE_COLUMNS]
tscv = TimeSeriesSplit(n_splits=5)


# ---------------------------------------------------------------------------
# 1. Win probability
# ---------------------------------------------------------------------------
print("\n" + "=" * 60)
print("WIN PROBABILITY MODEL (time-series CV)")
print("=" * 60)

y_win = data['home_win'].astype(int)
classifiers = {
    'Logistic Regression': make_pipeline(StandardScaler(), LogisticRegression(C=0.05, max_iter=2000)),
    'Random Forest': RandomForestClassifier(n_estimators=400, max_depth=6, min_samples_leaf=50, random_state=42, n_jobs=-1),
    'XGBoost': XGBClassifier(n_estimators=300, max_depth=3, learning_rate=0.03, subsample=0.8,
                             colsample_bytree=0.7, min_child_weight=20, random_state=42, eval_metric='logloss'),
}

win_results = {}
for name, model in classifiers.items():
    losses, aucs, accs, briers = [], [], [], []
    oof = np.full(len(y_win), np.nan)
    for fold, (tr, te) in enumerate(tscv.split(X)):
        model.fit(X.iloc[tr], y_win.iloc[tr])
        proba = model.predict_proba(X.iloc[te])[:, 1]
        oof[te] = proba
        losses.append(log_loss(y_win.iloc[te], proba))
        aucs.append(roc_auc_score(y_win.iloc[te], proba))
        accs.append(accuracy_score(y_win.iloc[te], proba > 0.5))
        briers.append(brier_score_loss(y_win.iloc[te], proba))
    win_results[name] = {'log_loss': np.mean(losses), 'auc': np.mean(aucs), 'accuracy': np.mean(accs), 'brier': np.mean(briers), 'oof': oof}
    print(f"{name:20s} LogLoss={np.mean(losses):.4f}  AUC={np.mean(aucs):.3f}  Acc={np.mean(accs):.3f}  Brier={np.mean(briers):.4f}")

# Baseline: always predict the historical home win rate
base_losses = []
for tr, te in tscv.split(X):
    p = np.full(len(te), y_win.iloc[tr].mean())
    base_losses.append(log_loss(y_win.iloc[te], p))
print(f"{'Baseline (home %)':20s} LogLoss={np.mean(base_losses):.4f}")

best_win = min(win_results, key=lambda k: win_results[k]['log_loss'])
print(f"\nBEST WIN MODEL: {best_win}")


# ---------------------------------------------------------------------------
# 2 & 3. Run differential and total runs
# ---------------------------------------------------------------------------
def make_regressors():
    return {
        'Ridge': make_pipeline(StandardScaler(), Ridge(alpha=50.0)),
        'Random Forest': RandomForestRegressor(n_estimators=400, max_depth=6, min_samples_leaf=50, random_state=42, n_jobs=-1),
        'XGBoost': XGBRegressor(n_estimators=300, max_depth=3, learning_rate=0.03, subsample=0.8,
                                colsample_bytree=0.7, min_child_weight=20, random_state=42),
    }


def train_regressor(target, label):
    print("\n" + "=" * 60)
    print(f"{label} MODEL (time-series CV)")
    print("=" * 60)
    y = data[target]
    results = {}
    for name, model in make_regressors().items():
        maes, oof = [], np.full(len(y), np.nan)
        for tr, te in tscv.split(X):
            model.fit(X.iloc[tr], y.iloc[tr])
            pred = model.predict(X.iloc[te])
            oof[te] = pred
            maes.append(mean_absolute_error(y.iloc[te], pred))
        results[name] = {'mae': np.mean(maes), 'oof': oof}
        print(f"{name:20s} MAE={np.mean(maes):.3f}")

    base = [mean_absolute_error(y.iloc[te], np.full(len(te), y.iloc[tr].mean())) for tr, te in tscv.split(X)]
    print(f"{'Baseline (average)':20s} MAE={np.mean(base):.3f}")

    best = min(results, key=lambda k: results[k]['mae'])
    print(f"\nBEST {label} MODEL: {best}")
    oof = results[best]['oof']
    mask = ~np.isnan(oof)
    residuals = (y.values[mask] - oof[mask]).astype(float)
    print(f"Prediction error std: {residuals.std():.2f} runs")
    return best, results, residuals, np.mean(base)


best_diff, diff_results, diff_residuals, diff_base = train_regressor('run_diff', 'RUN DIFFERENTIAL')
best_total, total_results, total_residuals, total_base = train_regressor('total_runs', 'TOTAL RUNS')


# ---------------------------------------------------------------------------
# Fit final models on all data and save
# ---------------------------------------------------------------------------
print("\nTraining final models on all historical data...")
win_model = classifiers[best_win].fit(X, y_win)
diff_model = make_regressors()[best_diff].fit(X, data['run_diff'])
total_model = make_regressors()[best_total].fit(X, data['total_runs'])

joblib.dump(win_model, os.path.join(MODEL_DIR, 'mlb_win_model.pkl'))
joblib.dump(diff_model, os.path.join(MODEL_DIR, 'mlb_run_diff_model.pkl'))
joblib.dump(total_model, os.path.join(MODEL_DIR, 'mlb_totals_model.pkl'))
joblib.dump(FEATURE_COLUMNS, os.path.join(MODEL_DIR, 'mlb_feature_columns.pkl'))
joblib.dump({'run_diff': diff_residuals, 'total_runs': total_residuals}, os.path.join(MODEL_DIR, 'mlb_residuals.pkl'))

# Out-of-fold predictions (each made by a model that never saw that game) for mlb_evaluate_blend.py
pd.DataFrame({
    'game_pk': data['game_pk'],
    'season': data['season'],
    'oof_win_prob': win_results[best_win]['oof'],
    'oof_run_diff': diff_results[best_diff]['oof'],
    'oof_total': total_results[best_total]['oof'],
    'home_win': data['home_win'],
    'total_runs': data['total_runs'],
}).dropna().to_csv(os.path.join(DATA_DIR, 'oof_predictions.csv'), index=False)

metrics = {
    'trained_on_games': int(len(data)),
    'seasons': f"{int(data['season'].min())}-{int(data['season'].max())}",
    'win_model': best_win,
    'win_log_loss': round(win_results[best_win]['log_loss'], 4),
    'win_baseline_log_loss': round(float(np.mean(base_losses)), 4),
    'win_accuracy': round(win_results[best_win]['accuracy'], 3),
    'win_auc': round(win_results[best_win]['auc'], 3),
    'run_diff_model': best_diff,
    'run_diff_mae': round(diff_results[best_diff]['mae'], 3),
    'run_diff_baseline_mae': round(float(diff_base), 3),
    'totals_model': best_total,
    'totals_mae': round(total_results[best_total]['mae'], 3),
    'totals_baseline_mae': round(float(total_base), 3),
}
with open(os.path.join(MODEL_DIR, 'mlb_model_metrics.json'), 'w') as f:
    json.dump(metrics, f, indent=2)

# Feature importance / coefficients for the win model
final = win_model[-1] if hasattr(win_model, 'steps') else win_model
if hasattr(final, 'feature_importances_'):
    weights = final.feature_importances_
elif hasattr(final, 'coef_'):
    weights = final.coef_[0]
else:
    weights = None
if weights is not None:
    fi = pd.DataFrame({'feature': FEATURE_COLUMNS, 'weight': weights})
    fi = fi.reindex(fi['weight'].abs().sort_values(ascending=False).index)
    print("\n" + "=" * 60)
    print("TOP WIN-MODEL FEATURES:")
    print("=" * 60)
    print(fi.head(15).to_string(index=False))

print("\n" + "=" * 60)
print("MODEL TRAINING COMPLETE!")
print("=" * 60)
print(json.dumps(metrics, indent=2))
print("\nNext step: python ml_mlb/mlb_predict_upcoming.py")
