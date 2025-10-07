import pandas as pd
import numpy as np
from sklearn.model_selection import TimeSeriesSplit
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
import warnings
warnings.filterwarnings('ignore')

print("Loading player statistics...")
df = pd.read_csv('player_weekly_stats.csv')

# Create rolling averages for each player
def create_player_features(data):
    features = []

    for player_id in data['player_id'].unique():
        player_data = data[data['player_id'] == player_id].sort_values(['season', 'week'])

        if len(player_data) < 5:
            continue

        # Calculate rolling averages (last 5 games)
        player_data['pass_yds_l5'] = player_data['passing_yards'].rolling(5, min_periods=1).mean().shift(1)
        player_data['pass_tds_l5'] = player_data['passing_tds'].rolling(5, min_periods=1).mean().shift(1)
        player_data['pass_attempts_l5'] = player_data['attempts'].rolling(5, min_periods=1).mean().shift(1)
        player_data['completions_l5'] = player_data['completions'].rolling(5, min_periods=1).mean().shift(1)

        player_data['rush_yds_l5'] = player_data['rushing_yards'].rolling(5, min_periods=1).mean().shift(1)
        player_data['rush_tds_l5'] = player_data['rushing_tds'].rolling(5, min_periods=1).mean().shift(1)
        player_data['carries_l5'] = player_data['carries'].rolling(5, min_periods=1).mean().shift(1)

        player_data['rec_yds_l5'] = player_data['receiving_yards'].rolling(5, min_periods=1).mean().shift(1)
        player_data['rec_tds_l5'] = player_data['receiving_tds'].rolling(5, min_periods=1).mean().shift(1)
        player_data['receptions_l5'] = player_data['receptions'].rolling(5, min_periods=1).mean().shift(1)
        player_data['targets_l5'] = player_data['targets'].rolling(5, min_periods=1).mean().shift(1)

        features.append(player_data)

    return pd.concat(features, ignore_index=True)

print("Creating features...")
df_features = create_player_features(df)

# Remove rows with NaN (first few games for each player)
df_features = df_features.dropna()

print(f"Total training samples: {len(df_features)}")

# Train models for each prop type
models = {}
results = {}

# 1. PASSING YARDS MODEL (QBs only)
print("\n=== Training Passing Yards Model ===")
qb_data = df_features[df_features['position'] == 'QB'].copy()
if len(qb_data) > 100:
    X_pass = qb_data[['pass_yds_l5', 'pass_attempts_l5', 'completions_l5', 'pass_tds_l5']]
    y_pass = qb_data['passing_yards']

    tscv = TimeSeriesSplit(n_splits=5)
    model_pass = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)

    mae_scores = []
    for train_idx, test_idx in tscv.split(X_pass):
        model_pass.fit(X_pass.iloc[train_idx], y_pass.iloc[train_idx])
        preds = model_pass.predict(X_pass.iloc[test_idx])
        mae_scores.append(mean_absolute_error(y_pass.iloc[test_idx], preds))

    model_pass.fit(X_pass, y_pass)
    models['passing_yards'] = model_pass
    results['passing_yards'] = {'MAE': np.mean(mae_scores)}
    print(f"Passing Yards MAE: {np.mean(mae_scores):.2f} yards")

# 2. PASSING TDS MODEL
print("\n=== Training Passing TDs Model ===")
if len(qb_data) > 100:
    X_pass_td = qb_data[['pass_tds_l5', 'pass_yds_l5', 'pass_attempts_l5', 'completions_l5']]
    y_pass_td = qb_data['passing_tds']

    model_pass_td = RandomForestRegressor(n_estimators=100, max_depth=8, random_state=42, n_jobs=-1)

    mae_scores = []
    for train_idx, test_idx in tscv.split(X_pass_td):
        model_pass_td.fit(X_pass_td.iloc[train_idx], y_pass_td.iloc[train_idx])
        preds = model_pass_td.predict(X_pass_td.iloc[test_idx])
        mae_scores.append(mean_absolute_error(y_pass_td.iloc[test_idx], preds))

    model_pass_td.fit(X_pass_td, y_pass_td)
    models['passing_tds'] = model_pass_td
    results['passing_tds'] = {'MAE': np.mean(mae_scores)}
    print(f"Passing TDs MAE: {np.mean(mae_scores):.3f} TDs")

# 3. RUSHING YARDS MODEL (RBs, QBs, WRs)
print("\n=== Training Rushing Yards Model ===")
rush_data = df_features[df_features['position'].isin(['RB', 'QB', 'WR'])].copy()
rush_data = rush_data[rush_data['carries_l5'] > 0]
if len(rush_data) > 100:
    X_rush = rush_data[['rush_yds_l5', 'carries_l5', 'rush_tds_l5']]
    y_rush = rush_data['rushing_yards']

    model_rush = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)

    tscv_rush = TimeSeriesSplit(n_splits=5)
    mae_scores = []
    for train_idx, test_idx in tscv_rush.split(X_rush):
        model_rush.fit(X_rush.iloc[train_idx], y_rush.iloc[train_idx])
        preds = model_rush.predict(X_rush.iloc[test_idx])
        mae_scores.append(mean_absolute_error(y_rush.iloc[test_idx], preds))

    model_rush.fit(X_rush, y_rush)
    models['rushing_yards'] = model_rush
    results['rushing_yards'] = {'MAE': np.mean(mae_scores)}
    print(f"Rushing Yards MAE: {np.mean(mae_scores):.2f} yards")

# 4. RUSHING TDS MODEL
print("\n=== Training Rushing TDs Model ===")
if len(rush_data) > 100:
    X_rush_td = rush_data[['rush_tds_l5', 'rush_yds_l5', 'carries_l5']]
    y_rush_td = rush_data['rushing_tds']

    model_rush_td = RandomForestRegressor(n_estimators=100, max_depth=8, random_state=42, n_jobs=-1)

    mae_scores = []
    for train_idx, test_idx in tscv_rush.split(X_rush_td):
        model_rush_td.fit(X_rush_td.iloc[train_idx], y_rush_td.iloc[train_idx])
        preds = model_rush_td.predict(X_rush_td.iloc[test_idx])
        mae_scores.append(mean_absolute_error(y_rush_td.iloc[test_idx], preds))

    model_rush_td.fit(X_rush_td, y_rush_td)
    models['rushing_tds'] = model_rush_td
    results['rushing_tds'] = {'MAE': np.mean(mae_scores)}
    print(f"Rushing TDs MAE: {np.mean(mae_scores):.3f} TDs")

# 5. RECEIVING YARDS MODEL (WRs, TEs, RBs)
print("\n=== Training Receiving Yards Model ===")
rec_data = df_features[df_features['position'].isin(['WR', 'TE', 'RB'])].copy()
rec_data = rec_data[rec_data['targets_l5'] > 0]
if len(rec_data) > 100:
    X_rec = rec_data[['rec_yds_l5', 'receptions_l5', 'targets_l5', 'rec_tds_l5']]
    y_rec = rec_data['receiving_yards']

    model_rec = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)

    tscv_rec = TimeSeriesSplit(n_splits=5)
    mae_scores = []
    for train_idx, test_idx in tscv_rec.split(X_rec):
        model_rec.fit(X_rec.iloc[train_idx], y_rec.iloc[train_idx])
        preds = model_rec.predict(X_rec.iloc[test_idx])
        mae_scores.append(mean_absolute_error(y_rec.iloc[test_idx], preds))

    model_rec.fit(X_rec, y_rec)
    models['receiving_yards'] = model_rec
    results['receiving_yards'] = {'MAE': np.mean(mae_scores)}
    print(f"Receiving Yards MAE: {np.mean(mae_scores):.2f} yards")

# 6. RECEIVING TDS MODEL
print("\n=== Training Receiving TDs Model ===")
if len(rec_data) > 100:
    X_rec_td = rec_data[['rec_tds_l5', 'rec_yds_l5', 'receptions_l5', 'targets_l5']]
    y_rec_td = rec_data['receiving_tds']

    model_rec_td = RandomForestRegressor(n_estimators=100, max_depth=8, random_state=42, n_jobs=-1)

    mae_scores = []
    for train_idx, test_idx in tscv_rec.split(X_rec_td):
        model_rec_td.fit(X_rec_td.iloc[train_idx], y_rec_td.iloc[train_idx])
        preds = model_rec_td.predict(X_rec_td.iloc[test_idx])
        mae_scores.append(mean_absolute_error(y_rec_td.iloc[test_idx], preds))

    model_rec_td.fit(X_rec_td, y_rec_td)
    models['receiving_tds'] = model_rec_td
    results['receiving_tds'] = {'MAE': np.mean(mae_scores)}
    print(f"Receiving TDs MAE: {np.mean(mae_scores):.3f} TDs")

# 7. RECEPTIONS MODEL
print("\n=== Training Receptions Model ===")
if len(rec_data) > 100:
    X_receptions = rec_data[['receptions_l5', 'targets_l5', 'rec_yds_l5']]
    y_receptions = rec_data['receptions']

    model_receptions = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)

    mae_scores = []
    for train_idx, test_idx in tscv_rec.split(X_receptions):
        model_receptions.fit(X_receptions.iloc[train_idx], y_receptions.iloc[train_idx])
        preds = model_receptions.predict(X_receptions.iloc[test_idx])
        mae_scores.append(mean_absolute_error(y_receptions.iloc[test_idx], preds))

    model_receptions.fit(X_receptions, y_receptions)
    models['receptions'] = model_receptions
    results['receptions'] = {'MAE': np.mean(mae_scores)}
    print(f"Receptions MAE: {np.mean(mae_scores):.2f} receptions")

# Save all models
print("\n=== Saving Models ===")
for prop_type, model in models.items():
    filename = f'player_prop_{prop_type}_model.pkl'
    joblib.dump(model, filename)
    print(f"Saved {filename}")

# Save feature data for prediction
df_features.to_csv('player_features_latest.csv', index=False)
print("Saved player_features_latest.csv")

print("\n=== Summary ===")
for prop_type, metrics in results.items():
    print(f"{prop_type}: MAE = {metrics['MAE']:.3f}")

print("\nOK - All models trained and saved")
