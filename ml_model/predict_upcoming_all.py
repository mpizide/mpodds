"""
Generate comprehensive ML predictions for upcoming NFL games
Uses all three models: Win Probability, Spread, and Totals
"""

import pandas as pd
import numpy as np
import joblib
import nfl_data_py as nfl
from datetime import datetime, timedelta
import json

print("Loading trained models...")
win_model = joblib.load('ml_model/nfl_prediction_model.pkl')
spread_model = joblib.load('ml_model/nfl_spread_model.pkl')
totals_model = joblib.load('ml_model/nfl_totals_model.pkl')
feature_columns = joblib.load('ml_model/feature_columns.pkl')

print("Fetching current season data...")
current_year = 2025
games_2024 = nfl.import_schedules([2024])
games_2025 = nfl.import_schedules([2025])
games_all = pd.concat([games_2024, games_2025])

# Calculate current team stats
print("Calculating team statistics...")
completed_games = games_all[(games_all['home_score'].notna()) & (games_all['away_score'].notna())].copy()
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
        recent_games = all_games.tail(5)
        team_stats[team] = {
            'rolling_ppg': recent_games['points_for'].mean(),
            'rolling_papg': recent_games['points_against'].mean(),
            'rolling_diff': recent_games['points_for'].mean() - recent_games['points_against'].mean()
        }

# Get upcoming games (Week 6+)
print("\nGenerating predictions for upcoming games...")
upcoming_games = games_2025[
    (games_2025['gameday'].notna()) &
    (games_2025['home_score'].isna()) &
    (games_2025['week'] >= 6)
].copy()

upcoming_games['gameday'] = pd.to_datetime(upcoming_games['gameday'])

predictions = []

for idx, game in upcoming_games.iterrows():
    home_team = game['home_team']
    away_team = game['away_team']

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

    # Get all three predictions
    win_prob = win_model.predict_proba(X)[0, 1]  # Home team win probability
    predicted_spread = spread_model.predict(X)[0]  # Predicted point differential
    predicted_total = totals_model.predict(X)[0]  # Predicted total points

    # Convert spread prediction to cover probabilities
    # Assume normal distribution around predicted spread
    # For now, use simple logic: if predicted > spread, home covers

    predictions.append({
        'game_id': game['game_id'],
        'gameday': game['gameday'].strftime('%Y-%m-%d'),
        'week': int(game['week']),
        'home_team': home_team,
        'away_team': away_team,

        # Win probabilities
        'home_win_prob': round(win_prob * 100, 1),
        'away_win_prob': round((1 - win_prob) * 100, 1),

        # Spread predictions
        'predicted_spread': round(predicted_spread, 1),
        'home_spread_prob': round(win_prob * 100, 1),  # For now, use win prob
        'away_spread_prob': round((1 - win_prob) * 100, 1),

        # Totals predictions
        'predicted_total': round(predicted_total, 1),
        'over_prob': 50.0,  # Need more sophisticated model for this
        'under_prob': 50.0
    })

predictions_df = pd.DataFrame(predictions)

# Save predictions
predictions_df.to_csv('ml_model/data/upcoming_predictions_all.csv', index=False)

# Also save as JSON for easy loading in React
predictions_json = predictions_df.to_dict('records')
with open('ml_model/data/upcoming_predictions_all.json', 'w') as f:
    json.dump(predictions_json, f, indent=2)

print("\n" + "="*60)
print("ALL PREDICTIONS GENERATED!")
print("="*60)
print(f"\nFound {len(predictions)} upcoming games")
print("\nSample predictions (Week 6):")
print("="*60)

week6 = predictions_df[predictions_df['week'] == 6].head(5)
for _, pred in week6.iterrows():
    print(f"\n{pred['home_team']} vs {pred['away_team']} - {pred['gameday']}")
    print(f"  Win: {pred['home_team']} {pred['home_win_prob']}% | {pred['away_team']} {pred['away_win_prob']}%")
    print(f"  Spread: {pred['predicted_spread']:+.1f} (Home perspective)")
    print(f"  Total: {pred['predicted_total']:.1f} points")

print("\n" + "="*60)
print("Files saved:")
print("  - ml_model/data/upcoming_predictions_all.csv")
print("  - ml_model/data/upcoming_predictions_all.json")
print("\nNext: Copy to React app and update mlPredictions.js to use all three models!")
