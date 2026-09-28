"""
Which is most accurate: our model, the betting market, or a blend of both?

Scores each option on real closing lines (SportsBookReview) using the model's out-of-fold
predictions, walk-forward by season (blend weights for season S are fit only on earlier
seasons). Saves the winning method + weights to mlb_blend.json, which the prediction
script passes to the app.

Candidates (moneyline and totals):
  model   - model probability alone
  market  - consensus no-vig closing probability alone
  blend   - logistic stack of both: logit(p) = a*logit(model) + b*logit(market) + c  (Benter-style)

Run after mlb_train_models.py and mlb_odds_collection.py.
"""

import json
import os
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss

from mlb_features import DATA_DIR

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
EPS = 1e-4


def logit(p):
    p = np.clip(p, EPS, 1 - EPS)
    return np.log(p / (1 - p))


def score(y, p):
    p = np.clip(p, EPS, 1 - EPS)
    return log_loss(y, p, labels=[0, 1]), brier_score_loss(y, p)


def walk_forward(df, model_col, market_col, target):
    """Out-of-sample predictions for each candidate, one test season at a time"""
    seasons = sorted(df['season'].unique())
    rows = []
    for s in seasons[1:]:
        train, test = df[df['season'] < s], df[df['season'] == s]
        Xtr = np.column_stack([logit(train[model_col]), logit(train[market_col])])
        Xte = np.column_stack([logit(test[model_col]), logit(test[market_col])])
        stack = LogisticRegression(C=1.0).fit(Xtr, train[target])
        out = test[['season', target]].copy()
        out['model'] = test[model_col].values
        out['market'] = test[market_col].values
        out['blend'] = stack.predict_proba(Xte)[:, 1]
        rows.append(out)
    return pd.concat(rows)


def report(name, preds, target):
    print("\n" + "=" * 70)
    print(f"{name}: out-of-sample, walk-forward ({len(preds)} games)")
    print("=" * 70)
    print(f"{'season':>8} " + ''.join(f"{c:>18}" for c in ['model', 'market', 'blend']))
    results = {}
    for s, g in list(preds.groupby('season')) + [('ALL', preds)]:
        line = f"{s:>8} "
        for c in ['model', 'market', 'blend']:
            ll, br = score(g[target], g[c])
            line += f"   LL {ll:.4f} B {br:.4f}"
            if s == 'ALL':
                results[c] = {'log_loss': round(ll, 5), 'brier': round(br, 5)}
        print(line)
    best = min(results, key=lambda c: results[c]['log_loss'])
    print(f"\nMost accurate: {best.upper()}  (lower log loss = better)")
    return results, best


def final_weights(df, model_col, market_col, target):
    X = np.column_stack([logit(df[model_col]), logit(df[market_col])])
    stack = LogisticRegression(C=1.0).fit(X, df[target])
    return {'model_coef': float(stack.coef_[0][0]), 'market_coef': float(stack.coef_[0][1]),
            'intercept': float(stack.intercept_[0])}


oof = pd.read_csv(os.path.join(DATA_DIR, 'oof_predictions.csv'))
odds = pd.read_csv(os.path.join(DATA_DIR, 'historical_odds.csv'))
df = oof.merge(odds.drop(columns=['season']), on='game_pk', how='inner')
print(f"Games with model predictions + closing odds: {len(df)}")

# ---- Moneyline -------------------------------------------------------------
ml = df.dropna(subset=['ml_home_prob']).copy()
ml['home_win'] = ml['home_win'].astype(int)
ml_preds = walk_forward(ml, 'oof_win_prob', 'ml_home_prob', 'home_win')
ml_results, ml_best = report('MONEYLINE (home win)', ml_preds, 'home_win')

# ---- Totals ----------------------------------------------------------------
# Model P(over closing line) from the projected total + the model's real error distribution
residuals = joblib.load(os.path.join(MODEL_DIR, 'mlb_residuals.pkl'))['total_runs']
tot = df.dropna(subset=['total_line', 'total_over_prob']).copy()


def model_over_prob(mean, line):
    sims = mean + residuals
    if line == int(line):  # exclude pushes, matching how the market prices it
        over, under = np.mean(sims > line + 0.5), np.mean(sims < line - 0.5)
        return over / (over + under)
    return np.mean(sims > line)


tot['model_over'] = [model_over_prob(m, l) for m, l in zip(tot['oof_total'], tot['total_line'])]
tot = tot[tot['total_runs'] != tot['total_line']]  # pushes don't count
tot['over'] = (tot['total_runs'] > tot['total_line']).astype(int)
tot_preds = walk_forward(tot, 'model_over', 'total_over_prob', 'over')
tot_results, tot_best = report('TOTALS (over)', tot_preds, 'over')

# ---- Save ------------------------------------------------------------------
blend = {
    'moneyline': {'method': ml_best, **final_weights(ml, 'oof_win_prob', 'ml_home_prob', 'home_win'),
                  'evaluation': ml_results, 'games': int(len(ml_preds))},
    'totals': {'method': tot_best, **final_weights(tot, 'model_over', 'total_over_prob', 'over'),
               'evaluation': tot_results, 'games': int(len(tot_preds))},
}
with open(os.path.join(MODEL_DIR, 'mlb_blend.json'), 'w') as f:
    json.dump(blend, f, indent=2)

print("\n" + "=" * 70)
print("FINAL (fit on all seasons)")
print("=" * 70)
print(json.dumps({k: {kk: vv for kk, vv in v.items() if kk != 'evaluation'} for k, v in blend.items()}, indent=2))
print("\nSaved ml_mlb/mlb_blend.json. Next: python ml_mlb/mlb_predict_upcoming.py")
