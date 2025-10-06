"""
Generate ML predictions for upcoming NFL games
Outputs predictions that can be loaded into the React app
"""

import pandas as pd
import numpy as np
import joblib
import nfl_data_py as nfl
from datetime import datetime, timedelta
import json

print("Loading trained model...")
model = joblib.load('ml_model/nfl_prediction_model.pkl')
feature_columns = joblib.load('ml_model/feature_columns.pkl')

print("Fetching current season data...")
current_year = 2024
games = nfl.import_schedules([current_year])

# Calculate current team stats
print("Calculating team statistics...")
completed_games = games[(games['home_score'].notna()) & (games['away_score'].notna())].copy()
completed_games['gameday'] = pd.to_datetime(completed_games['gameday'])
completed_games = completed_games.sort_values('gameday')

# Calculate rolling stats for each team
team_stats = {}
teams = pd.concat([completed_games['home_team'], completed_games['away_team']]).unique()

for team in teams:
    home_games = completed_games[completed_games['home_team'] == team].copy()
    away_games = completed_games[completed_games['away_team'] == team].copy()

    home_games['points_for'] = home_games['home_score']
    home_games['points_against'] = home_games['away_score']

    away_games['points_for'] = away_games['away_score']
    away_games['points_against'] = away_games['home_score']

    all_games = pd.concat([
        home_games[['gameday', 'points_for', 'points_against']],
        away_games[['gameday', 'points_for', 'points_against']]
    ]).sort_values('gameday')

    if len(all_games) > 0:
        # Last 5 games rolling average
        recent_games = all_games.tail(5)
        team_stats[team] = {
            'rolling_ppg': recent_games['points_for'].mean(),
            'rolling_papg': recent_games['points_against'].mean(),
            'rolling_diff': recent_games['points_for'].mean() - recent_games['points_against'].mean()
        }

# Get upcoming games (next 7 days)
print("\nGenerating predictions for upcoming games...")
today = datetime.now()
upcoming_games = games[
    (games['gameday'].notna()) &
    (games['home_score'].isna())  # Not yet played
].copy()

upcoming_games['gameday'] = pd.to_datetime(upcoming_games['gameday'])
upcoming_games = upcoming_games[
    (upcoming_games['gameday'] >= today) &
    (upcoming_games['gameday'] <= today + timedelta(days=14))
]

predictions = []

for idx, game in upcoming_games.iterrows():
    home_team = game['home_team']
    away_team = game['away_team']

    # Skip if we don't have stats for both teams
    if home_team not in team_stats or away_team not in team_stats:
        continue

    home_stats = team_stats[home_team]
    away_stats = team_stats[away_team]

    # Create feature vector
    features = {
        'home_rolling_ppg': home_stats['rolling_ppg'],
        'home_rolling_papg': home_stats['rolling_papg'],
        'home_rolling_diff': home_stats['rolling_diff'],
        'away_rolling_ppg': away_stats['rolling_ppg'],
        'away_rolling_papg': away_stats['rolling_papg'],
        'away_rolling_diff': away_stats['rolling_diff'],
        'ppg_differential': home_stats['rolling_ppg'] - away_stats['rolling_ppg'],
        'papg_differential': home_stats['rolling_papg'] - away_stats['rolling_papg'],
        'overall_differential': home_stats['rolling_diff'] - away_stats['rolling_diff'],
        'home_advantage': 1,
        'week': game['week'],
        'is_divisional': 1 if game.get('div_game') == True else 0
    }

    X = pd.DataFrame([features])[feature_columns]
    prob = model.predict_proba(X)[0, 1]  # Probability home team wins

    predictions.append({
        'game_id': game['game_id'],
        'gameday': game['gameday'].strftime('%Y-%m-%d'),
        'home_team': home_team,
        'away_team': away_team,
        'home_win_prob': round(prob * 100, 1),
        'away_win_prob': round((1 - prob) * 100, 1),
        'week': int(game['week'])
    })

predictions_df = pd.DataFrame(predictions)

# Save predictions
predictions_df.to_csv('ml_model/data/upcoming_predictions.csv', index=False)

# Also save as JSON for easy loading in React
predictions_json = predictions_df.to_dict('records')
with open('ml_model/data/upcoming_predictions.json', 'w') as f:
    json.dump(predictions_json, f, indent=2)

print("\n" + "="*60)
print("PREDICTIONS GENERATED!")
print("="*60)
print(f"\nFound {len(predictions)} upcoming games")
print("\nPredictions:")
print("="*60)

for pred in predictions:
    print(f"\n{pred['home_team']} vs {pred['away_team']}")
    print(f"  Date: {pred['gameday']}")
    print(f"  Prediction: {pred['home_team']} {pred['home_win_prob']}% | {pred['away_team']} {pred['away_win_prob']}%")
    favorite = pred['home_team'] if pred['home_win_prob'] > 50 else pred['away_team']
    confidence = max(pred['home_win_prob'], pred['away_win_prob'])
    print(f"  Pick: {favorite} ({confidence}% confidence)")

print("\n" + "="*60)
print("Files saved:")
print("  - ml_model/data/upcoming_predictions.csv")
print("  - ml_model/data/upcoming_predictions.json")
print("\nNext: Load predictions in your React app to auto-fill probabilities!")
