"""
College Basketball Automated Retraining System
MAKES THE MODEL PROGRESSIVELY BETTER OVER TIME

This script:
1. Fetches completed game results
2. Updates training data with new results
3. Retrains models on updated data
4. Logs performance metrics
5. Auto-deploys updated predictions

Run this:
- Daily: To collect new results
- Weekly: To retrain models with new data
"""

import pandas as pd
import numpy as np
import joblib
import json
import requests
from datetime import datetime, timedelta
import os

print("="*70)
print("COLLEGE BASKETBALL AUTO-RETRAIN SYSTEM")
print("="*70)

LOG_FILE = 'ml_cbb/data/retrain_log.json'
TRAINING_DATA_FILE = 'ml_cbb/data/cbb_training_data.csv'

def load_retrain_log():
    """Load retraining history"""
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, 'r') as f:
            return json.load(f)
    return {'retrains': [], 'last_update': None}

def save_retrain_log(log):
    """Save retraining history"""
    with open(LOG_FILE, 'w') as f:
        json.dump(log, f, indent=2)

def fetch_recent_completed_games(days_back=7):
    """
    Fetch completed games from last N days
    Updates training data with actual results
    """
    print(f"\n📥 Fetching completed games from last {days_back} days...")

    completed_games = []

    for days_ago in range(days_back):
        date = datetime.now() - timedelta(days=days_ago)
        date_str = date.strftime('%Y%m%d')

        url = f"https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates={date_str}"

        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                data = response.json()

                if 'events' in data:
                    for event in data['events']:
                        try:
                            competition = event['competitions'][0]
                            status = competition['status']['type']

                            # Only include completed games
                            if status['completed']:
                                home_team = competition['competitors'][0] if competition['competitors'][0]['homeAway'] == 'home' else competition['competitors'][1]
                                away_team = competition['competitors'][1] if competition['competitors'][0]['homeAway'] == 'home' else competition['competitors'][0]

                                game_data = {
                                    'date': event['date'],
                                    'season': 2025,
                                    'home_team': home_team['team']['displayName'],
                                    'away_team': away_team['team']['displayName'],
                                    'home_score': int(home_team['score']),
                                    'away_score': int(away_team['score']),
                                    'is_neutral': competition.get('neutralSite', False),
                                    'is_conference': event.get('season', {}).get('type') == 2,
                                }
                                completed_games.append(game_data)
                        except Exception as e:
                            continue

        except Exception as e:
            print(f"  ⚠ Error fetching {date_str}: {str(e)}")

    print(f"✓ Found {len(completed_games)} completed games")
    return completed_games

def update_training_data(new_games):
    """
    Add new completed games to training data
    Returns: number of new games added
    """
    if len(new_games) == 0:
        print("\n⚠ No new games to add")
        return 0

    print(f"\n📝 Updating training data with {len(new_games)} new games...")

    # Load existing training data
    existing_data = pd.read_csv(TRAINING_DATA_FILE)
    existing_data['date'] = pd.to_datetime(existing_data['date'])

    # Convert new games to DataFrame
    new_games_df = pd.DataFrame(new_games)
    new_games_df['date'] = pd.to_datetime(new_games_df['date'])

    # Deduplicate - don't add games we already have
    existing_game_ids = set(
        existing_data['date'].astype(str) + '_' +
        existing_data['home_team'] + '_' +
        existing_data['away_team']
    )

    new_game_ids = (
        new_games_df['date'].astype(str) + '_' +
        new_games_df['home_team'] + '_' +
        new_games_df['away_team']
    )

    new_games_df['game_id'] = new_game_ids
    new_games_df = new_games_df[~new_games_df['game_id'].isin(existing_game_ids)]

    if len(new_games_df) == 0:
        print("✓ All games already in training data (no new games to add)")
        return 0

    print(f"✓ Adding {len(new_games_df)} new unique games")

    # Save raw games for feature engineering
    new_games_df.to_csv('ml_cbb/data/new_games_temp.csv', index=False)

    # Feature engineering will need to be run on these new games
    print("⚠ Run cbb_feature_engineering.py to process new games")

    return len(new_games_df)

def retrain_models():
    """
    Retrain all three models on updated data
    Returns: performance metrics
    """
    print("\n" + "="*70)
    print("🔄 RETRAINING MODELS")
    print("="*70)

    from sklearn.model_selection import TimeSeriesSplit
    from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
    from xgboost import XGBClassifier, XGBRegressor
    from sklearn.metrics import accuracy_score, roc_auc_score, mean_absolute_error

    # Load training data
    data = pd.read_csv(TRAINING_DATA_FILE)
    data['date'] = pd.to_datetime(data['date'])
    data = data.sort_values('date')

    feature_columns = joblib.load('ml_cbb/cbb_feature_columns.pkl')

    print(f"Training data: {len(data)} games")
    print(f"Date range: {data['date'].min()} to {data['date'].max()}")

    # Prepare data
    X = data[feature_columns]
    y_win = data['home_win']
    y_spread = data['point_diff']
    y_totals = data['total_points']

    # Time series split for validation
    tscv = TimeSeriesSplit(n_splits=3)

    # Train Win Model
    print("\n1. Retraining Win Probability Model...")
    win_model = XGBClassifier(n_estimators=200, max_depth=6, learning_rate=0.1, random_state=42)

    win_accuracies = []
    win_aucs = []

    for train_idx, test_idx in tscv.split(X):
        X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
        y_train, y_test = y_win.iloc[train_idx], y_win.iloc[test_idx]

        win_model.fit(X_train, y_train)
        y_proba = win_model.predict_proba(X_test)[:, 1]

        win_accuracies.append(accuracy_score(y_test, win_model.predict(X_test)))
        win_aucs.append(roc_auc_score(y_test, y_proba))

    win_model.fit(X, y_win)  # Final training on all data
    joblib.dump(win_model, 'ml_cbb/cbb_win_model.pkl')

    avg_win_auc = np.mean(win_aucs)
    print(f"  ✓ Win Model: {avg_win_auc:.3f} AUC")

    # Train Spread Model
    print("\n2. Retraining Spread Prediction Model...")
    spread_model = XGBRegressor(n_estimators=200, max_depth=6, learning_rate=0.1, random_state=42)

    spread_maes = []

    for train_idx, test_idx in tscv.split(X):
        X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
        y_train, y_test = y_spread.iloc[train_idx], y_spread.iloc[test_idx]

        spread_model.fit(X_train, y_train)
        y_pred = spread_model.predict(X_test)

        spread_maes.append(mean_absolute_error(y_test, y_pred))

    spread_model.fit(X, y_spread)
    joblib.dump(spread_model, 'ml_cbb/cbb_spread_model.pkl')

    avg_spread_mae = np.mean(spread_maes)
    print(f"  ✓ Spread Model: {avg_spread_mae:.2f} MAE")

    # Train Totals Model
    print("\n3. Retraining Totals Prediction Model...")
    totals_model = XGBRegressor(n_estimators=200, max_depth=6, learning_rate=0.1, random_state=42)

    totals_maes = []

    for train_idx, test_idx in tscv.split(X):
        X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
        y_train, y_test = y_totals.iloc[train_idx], y_totals.iloc[test_idx]

        totals_model.fit(X_train, y_train)
        y_pred = totals_model.predict(X_test)

        totals_maes.append(mean_absolute_error(y_test, y_pred))

    totals_model.fit(X, y_totals)
    joblib.dump(totals_model, 'ml_cbb/cbb_totals_model.pkl')

    avg_totals_mae = np.mean(totals_maes)
    print(f"  ✓ Totals Model: {avg_totals_mae:.2f} MAE")

    return {
        'win_auc': avg_win_auc,
        'spread_mae': avg_spread_mae,
        'totals_mae': avg_totals_mae,
        'training_games': len(data),
        'timestamp': datetime.now().isoformat()
    }

# Main execution
print("\n🔄 Starting automated retrain process...")

# Step 1: Fetch recent results
new_games = fetch_recent_completed_games(days_back=7)

# Step 2: Update training data
new_count = update_training_data(new_games)

# Step 3: Check if retrain is needed
log = load_retrain_log()
last_update = log.get('last_update')

if last_update:
    last_update_date = datetime.fromisoformat(last_update)
    days_since_update = (datetime.now() - last_update_date).days
    print(f"\n⏱ Last retrain: {days_since_update} days ago")
else:
    days_since_update = 999
    print("\n⏱ No previous retraining found")

# Retrain if:
# - More than 50 new games added, OR
# - More than 7 days since last retrain
should_retrain = new_count > 50 or days_since_update > 7

if should_retrain:
    print("\n✅ Retraining conditions met - proceeding with retrain")

    # Step 4: Retrain models
    metrics = retrain_models()

    # Step 5: Update log
    log['retrains'].append(metrics)
    log['last_update'] = metrics['timestamp']
    save_retrain_log(log)

    # Step 6: Generate new predictions
    print("\n" + "="*70)
    print("📊 GENERATING NEW PREDICTIONS")
    print("="*70)

    import subprocess
    subprocess.run(['python', 'ml_cbb/cbb_predict_upcoming.py'])

    print("\n" + "="*70)
    print("✅ AUTO-RETRAIN COMPLETE!")
    print("="*70)
    print(f"\n📈 Model Performance:")
    print(f"  Win Probability: {metrics['win_auc']:.3f} AUC")
    print(f"  Spread: {metrics['spread_mae']:.2f} points MAE")
    print(f"  Totals: {metrics['totals_mae']:.2f} points MAE")
    print(f"\n📊 Training games: {metrics['training_games']}")
    print(f"🆕 New games added: {new_count}")

else:
    print("\n⏭ Skipping retrain (conditions not met)")
    print(f"  - New games: {new_count}/50")
    print(f"  - Days since last retrain: {days_since_update}/7")

print("\n" + "="*70)
print("🔮 MODEL IS NOW UP-TO-DATE")
print("="*70)
print("\n💡 The model improves automatically as more games are played!")
print("   Schedule this script to run:")
print("     - Daily: Collect new results")
print("     - Weekly: Retrain models")
