import pandas as pd
import numpy as np
import joblib
import json

print("Loading models and data...")

# Load all trained models
models = {
    'passing_yards': joblib.load('player_prop_passing_yards_model.pkl'),
    'passing_tds': joblib.load('player_prop_passing_tds_model.pkl'),
    'rushing_yards': joblib.load('player_prop_rushing_yards_model.pkl'),
    'rushing_tds': joblib.load('player_prop_rushing_tds_model.pkl'),
    'receiving_yards': joblib.load('player_prop_receiving_yards_model.pkl'),
    'receiving_tds': joblib.load('player_prop_receiving_tds_model.pkl'),
    'receptions': joblib.load('player_prop_receptions_model.pkl')
}

# Load latest player features
df_features = pd.read_csv('player_features_latest.csv')

# Get most recent stats for each player (last 5 games average)
latest_player_stats = df_features.sort_values(['player_id', 'season', 'week']).groupby('player_id').tail(1)

print(f"Loaded stats for {len(latest_player_stats)} players")

# Generate predictions
predictions = []

for _, player in latest_player_stats.iterrows():
    player_pred = {
        'player_name': player['player_display_name'],
        'position': player['position'],
        'team': player['recent_team']
    }

    # Passing predictions (QBs)
    if player['position'] == 'QB' and player['pass_attempts_l5'] > 0:
        X_pass = [[player['pass_yds_l5'], player['pass_attempts_l5'],
                   player['completions_l5'], player['pass_tds_l5']]]
        player_pred['predicted_passing_yards'] = float(models['passing_yards'].predict(X_pass)[0])

        X_pass_td = [[player['pass_tds_l5'], player['pass_yds_l5'],
                      player['pass_attempts_l5'], player['completions_l5']]]
        player_pred['predicted_passing_tds'] = float(models['passing_tds'].predict(X_pass_td)[0])

    # Rushing predictions (RBs, QBs, WRs)
    if player['position'] in ['RB', 'QB', 'WR'] and player['carries_l5'] > 0:
        X_rush = [[player['rush_yds_l5'], player['carries_l5'], player['rush_tds_l5']]]
        player_pred['predicted_rushing_yards'] = float(models['rushing_yards'].predict(X_rush)[0])

        X_rush_td = [[player['rush_tds_l5'], player['rush_yds_l5'], player['carries_l5']]]
        player_pred['predicted_rushing_tds'] = float(models['rushing_tds'].predict(X_rush_td)[0])

    # Receiving predictions (WRs, TEs, RBs)
    if player['position'] in ['WR', 'TE', 'RB'] and player['targets_l5'] > 0:
        X_rec = [[player['rec_yds_l5'], player['receptions_l5'],
                  player['targets_l5'], player['rec_tds_l5']]]
        player_pred['predicted_receiving_yards'] = float(models['receiving_yards'].predict(X_rec)[0])

        X_rec_td = [[player['rec_tds_l5'], player['rec_yds_l5'],
                     player['receptions_l5'], player['targets_l5']]]
        player_pred['predicted_receiving_tds'] = float(models['receiving_tds'].predict(X_rec_td)[0])

        X_receptions = [[player['receptions_l5'], player['targets_l5'], player['rec_yds_l5']]]
        player_pred['predicted_receptions'] = float(models['receptions'].predict(X_receptions)[0])

    # Add rolling averages for reference
    player_pred['avg_pass_yds_l5'] = float(player['pass_yds_l5']) if not pd.isna(player['pass_yds_l5']) else 0
    player_pred['avg_rush_yds_l5'] = float(player['rush_yds_l5']) if not pd.isna(player['rush_yds_l5']) else 0
    player_pred['avg_rec_yds_l5'] = float(player['rec_yds_l5']) if not pd.isna(player['rec_yds_l5']) else 0

    predictions.append(player_pred)

# Save predictions to JSON (NFL-labeled)
output_file = '../src/nfl_player_prop_predictions.json'
with open(output_file, 'w') as f:
    json.dump(predictions, f, indent=2)

print(f"\nOK - Generated predictions for {len(predictions)} players")
print(f"Saved to {output_file}")

# Print sample predictions
print("\n=== Sample Predictions ===")
for pred in predictions[:5]:
    print(f"\n{pred['player_name']} ({pred['position']}) - {pred['team']}")
    for key, value in pred.items():
        if key.startswith('predicted_'):
            stat_name = key.replace('predicted_', '').replace('_', ' ').title()
            print(f"  {stat_name}: {value:.1f}")
