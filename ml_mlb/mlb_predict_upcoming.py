"""
MLB Prediction Generator
Refreshes current-season data, then predicts every upcoming game in the next few days

Outputs predictions to: src/mlb_ml_predictions.json (read by the React app)
                        ml_mlb/data/upcoming_predictions.csv

Run this daily (probable pitchers change):
  python ml_mlb/mlb_predict_upcoming.py
"""

import json
import os
import sys
from datetime import datetime, timedelta, timezone

import joblib
import numpy as np
import pandas as pd

import mlb_data_collection as collection
from mlb_features import DATA_DIR, build_features, load_data

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_JSON = os.path.join(MODEL_DIR, '..', 'src', 'mlb_ml_predictions.json')
DAYS_AHEAD = 3

# A TBD starter is replaced by each of the team's last ROTATION_SIZE starters in turn;
# the game's prediction is the average over that rotation
ROTATION_SIZE = 5

# Lines we pre-compute probabilities for (the app picks the one the books are using)
TOTAL_LINES = [x / 2 for x in range(10, 29)]          # 5.0 .. 14.0
MARGIN_LINES = [-3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5]

print("=" * 70)
print("MLB PREDICTION GENERATOR")
print("=" * 70)

print("\nLoading trained models...")
win_model = joblib.load(os.path.join(MODEL_DIR, 'mlb_win_model.pkl'))
totals_model = joblib.load(os.path.join(MODEL_DIR, 'mlb_totals_model.pkl'))
feature_columns = joblib.load(os.path.join(MODEL_DIR, 'mlb_feature_columns.pkl'))
residuals = joblib.load(os.path.join(MODEL_DIR, 'mlb_residuals.pkl'))
with open(os.path.join(MODEL_DIR, 'mlb_model_metrics.json')) as f:
    metrics = json.load(f)
diff_res = residuals['run_diff']
total_res = residuals['total_runs']
print("Models loaded")

# Refresh the current season so rolling stats include last night's games
season = datetime.now().year
print(f"\nRefreshing {season} data...")
collection.collect([season])
games, pitchers, teams, xera = load_data()

# Make sure the next few days are in the schedule with the latest probable pitchers
today = datetime.now().date()
upcoming_sched = collection.fetch_schedule(
    season, start_date=str(today), end_date=str(today + timedelta(days=DAYS_AHEAD)))
upcoming_sched = upcoming_sched[
    upcoming_sched['home_id'].isin(collection.MLB_TEAM_IDS) & upcoming_sched['away_id'].isin(collection.MLB_TEAM_IDS)]
games = pd.concat([games[~games['game_pk'].isin(upcoming_sched['game_pk'])], upcoming_sched], ignore_index=True)

completed = games[games['status'].isin(collection.FINAL_STATES)].sort_values('game_datetime')


def recent_starters(team_id):
    """The team's last few distinct starting pitchers (its current rotation)"""
    rows = []
    for side in ('home', 'away'):
        t = completed[completed[f'{side}_id'] == team_id][['game_datetime', f'{side}_sp_id', f'{side}_sp_name']]
        rows.append(t.set_axis(['game_datetime', 'sp_id', 'sp_name'], axis=1))
    starters = pd.concat(rows).dropna().sort_values('game_datetime', ascending=False)
    return starters.drop_duplicates('sp_id').head(ROTATION_SIZE)[['sp_id', 'sp_name']].values.tolist()


now = datetime.now(timezone.utc)
starts = pd.to_datetime(games['game_datetime'], utc=True)
target = games[(~games['status'].isin(collection.FINAL_STATES | {'Cancelled', 'Postponed'}))
               & (starts > now) & (starts < now + timedelta(days=DAYS_AHEAD + 1))].copy()
target = target.sort_values('game_datetime')

# One scenario per (game, home starter option, away starter option); negative synthetic ids keep them apart
scenarios, scenario_games = [], []
for _, g in target.iterrows():
    options = {}
    for side in ('home', 'away'):
        if pd.notna(g[f'{side}_sp_id']):
            options[side] = [(g[f'{side}_sp_id'], g[f'{side}_sp_name'])]
        else:
            options[side] = recent_starters(g[f'{side}_id']) or [(np.nan, None)]
    n = 0
    for home_sp in options['home']:
        for away_sp in options['away']:
            row = g.copy()
            row['home_sp_id'], row['home_sp_name'] = home_sp
            row['away_sp_id'], row['away_sp_name'] = away_sp
            row['game_pk'] = -(int(g['game_pk']) * 100 + n)
            scenario_games.append(row)
            scenarios.append({'game_pk': int(g['game_pk']), 'scenario_pk': int(row['game_pk'])})
            n += 1

print("\nBuilding features...")
all_games = pd.concat([games, pd.DataFrame(scenario_games)], ignore_index=True) if scenario_games else games
df = build_features(all_games, pitchers, teams, xera).set_index('game_pk')
print(f"Found {len(target)} upcoming games ({len(scenarios)} starter scenarios)")


def margin_table(center):
    """P(home run differential > k) for each line, from the model's real error distribution.
    Baseball can't end tied: the "tie" mass (-0.5..0.5) becomes one-run extra-inning games,
    split 50/50. Home -1.5 covers if diff > 1.5; home +1.5 covers if diff > -1.5."""
    sims = center + diff_res
    tie = np.mean(np.abs(sims) < 0.5)
    table = {}
    for k in MARGIN_LINES:
        p = np.mean(sims > k)
        if k == 0.5:
            p += 0.5 * tie
        elif k == -0.5:
            p -= 0.5 * tie
        table[k] = float(p)
    return table


def diff_from_win_prob(p):
    """Center of the run-differential distribution that matches the win model
    (P(home wins) = p), found by bisection. Keeps moneyline, run line and projected
    score consistent with each other."""
    lo, hi = -6.0, 6.0
    for _ in range(40):
        mid = (lo + hi) / 2
        if margin_table(mid)[0.5] < p:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def margin_probs(centers):
    tables = [margin_table(c) for c in centers]
    return {str(k): round(float(np.mean([t[k] for t in tables])) * 100, 1) for k in MARGIN_LINES}


def total_probs(mean_totals):
    """P(over)/P(under) for each line from the model's real error distribution, averaged over
    starter scenarios. Runs are whole numbers, so a whole-number line can push."""
    sims = np.concatenate([m + total_res for m in mean_totals])
    out = {}
    for line in TOTAL_LINES:
        if line == int(line):
            over = float(np.mean(sims > line + 0.5))
            under = float(np.mean(sims < line - 0.5))
        else:
            over = float(np.mean(sims > line))
            under = 1 - over
        out[str(line)] = {'over': round(over * 100, 1), 'under': round(under * 100, 1)}
    return out


predictions = []
if scenarios:
    sc = pd.DataFrame(scenarios)
    X = df.loc[sc['scenario_pk'], feature_columns]
    sc['win_prob'] = win_model.predict_proba(X)[:, 1]
    sc['total'] = totals_model.predict(X)
    sc['diff_center'] = [diff_from_win_prob(p) for p in sc['win_prob']]

    for _, g in target.iterrows():
        rows = sc[sc['game_pk'] == g['game_pk']]
        win_prob = float(rows['win_prob'].mean())
        total = float(rows['total'].mean())
        diff = diff_from_win_prob(win_prob)
        first = df.loc[rows['scenario_pk'].iloc[0]]
        home_known, away_known = pd.notna(g['home_sp_id']), pd.notna(g['away_sp_id'])
        predictions.append({
            'game_id': int(g['game_pk']),
            'game_datetime': g['game_datetime'],
            'gameday': g['official_date'],
            'home_team': g['home_name'],
            'away_team': g['away_name'],
            'series': g['series_description'] if g['game_type'] != 'R' else None,
            'home_sp': g['home_sp_name'] if home_known else None,
            'away_sp': g['away_sp_name'] if away_known else None,
            'home_sp_fip': round(float(first['home_sp_fip']), 2) if home_known else None,
            'away_sp_fip': round(float(first['away_sp_fip']), 2) if away_known else None,
            'starter_scenarios': int(len(rows)),

            # Win probabilities
            'home_win_prob': round(win_prob * 100, 1),
            'away_win_prob': round((1 - win_prob) * 100, 1),

            # Run line
            'predicted_run_diff': round(diff, 2),
            'home_margin_probs': margin_probs(rows['diff_center'].values),

            # Totals
            'predicted_total': round(total, 2),
            'predicted_home_runs': round((total + diff) / 2, 2),
            'predicted_away_runs': round((total - diff) / 2, 2),
            'total_probs': total_probs(rows['total'].values),
        })

# How to combine model + market (chosen by mlb_evaluate_blend.py on real closing lines)
blend_path = os.path.join(MODEL_DIR, 'mlb_blend.json')
blend = None
if os.path.exists(blend_path):
    with open(blend_path) as f:
        blend = json.load(f)

# Run line probabilities for any final win probability, so the app can keep the run line
# consistent after blending the moneyline with the market
margin_by_win_prob = {str(p): margin_probs([diff_from_win_prob(p / 100)]) for p in range(1, 100)}

output = {
    'generated_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
    'model': metrics,
    'blend': blend,
    'margin_by_win_prob': margin_by_win_prob,
    'games': predictions,
}
with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2, ensure_ascii=False)
pd.DataFrame(predictions).drop(columns=['home_margin_probs', 'total_probs'], errors='ignore') \
    .to_csv(os.path.join(DATA_DIR, 'upcoming_predictions.csv'), index=False)

print("\n" + "=" * 70)
print("PREDICTIONS GENERATED!")
print("=" * 70)
for p in predictions:
    print(f"\n{p['away_team']} @ {p['home_team']} - {p['gameday']}")
    print(f"  SP: {p['away_sp'] or 'TBD (rotation avg)'} vs {p['home_sp'] or 'TBD (rotation avg)'}")
    print(f"  Win: {p['away_team']} {p['away_win_prob']}% | {p['home_team']} {p['home_win_prob']}%")
    print(f"  Projected score: {p['predicted_away_runs']:.1f} - {p['predicted_home_runs']:.1f} "
          f"(total {p['predicted_total']:.1f})")
print(f"\nSaved {len(predictions)} predictions to src/mlb_ml_predictions.json")
