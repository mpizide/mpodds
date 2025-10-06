"""
Feature Engineering for NFL Prediction Model
Creates training features from raw data
"""

import pandas as pd
import numpy as np
from datetime import datetime

print("Loading raw data...")
games = pd.read_csv('ml_model/data/games_raw.csv')

# Filter only completed games (has scores)
games = games[(games['home_score'].notna()) & (games['away_score'].notna())].copy()
games['gameday'] = pd.to_datetime(games['gameday'])
games = games.sort_values('gameday')

print(f"Found {len(games)} completed games")

# Create target variable
games['home_win'] = (games['home_score'] > games['away_score']).astype(int)
games['point_diff'] = games['home_score'] - games['away_score']

print("\nEngineering features...")

# Calculate team rolling statistics
def calculate_team_stats(df):
    """Calculate rolling stats for each team"""
    teams = pd.concat([df['home_team'], df['away_team']]).unique()

    team_stats = {}

    for team in teams:
        # Get all games for this team
        home_games = df[df['home_team'] == team].copy()
        away_games = df[df['away_team'] == team].copy()

        home_games['is_home'] = 1
        home_games['points_for'] = home_games['home_score']
        home_games['points_against'] = home_games['away_score']

        away_games['is_home'] = 0
        away_games['points_for'] = away_games['away_score']
        away_games['points_against'] = away_games['home_score']

        all_games = pd.concat([
            home_games[['gameday', 'is_home', 'points_for', 'points_against']],
            away_games[['gameday', 'is_home', 'points_for', 'points_against']]
        ]).sort_values('gameday')

        # Calculate rolling averages (last 5 games)
        all_games['rolling_ppg'] = all_games['points_for'].rolling(5, min_periods=1).mean()
        all_games['rolling_papg'] = all_games['points_against'].rolling(5, min_periods=1).mean()
        all_games['rolling_diff'] = all_games['rolling_ppg'] - all_games['rolling_papg']

        team_stats[team] = all_games

    return team_stats

team_stats = calculate_team_stats(games)

# Add features to each game
features_list = []

for idx, game in games.iterrows():
    try:
        home_team = game['home_team']
        away_team = game['away_team']
        game_date = game['gameday']

        # Get team stats before this game
        home_history = team_stats[home_team][team_stats[home_team]['gameday'] < game_date]
        away_history = team_stats[away_team][team_stats[away_team]['gameday'] < game_date]

        if len(home_history) == 0 or len(away_history) == 0:
            continue  # Skip first game of season

        home_recent = home_history.iloc[-1]
        away_recent = away_history.iloc[-1]

        features = {
            'game_id': game['game_id'],
            'gameday': game_date,
            'home_team': home_team,
            'away_team': away_team,

            # Target variables
            'home_win': game['home_win'],
            'point_diff': game['point_diff'],

            # Home team features
            'home_rolling_ppg': home_recent['rolling_ppg'],
            'home_rolling_papg': home_recent['rolling_papg'],
            'home_rolling_diff': home_recent['rolling_diff'],

            # Away team features
            'away_rolling_ppg': away_recent['rolling_ppg'],
            'away_rolling_papg': away_recent['rolling_papg'],
            'away_rolling_diff': away_recent['rolling_diff'],

            # Matchup features
            'ppg_differential': home_recent['rolling_ppg'] - away_recent['rolling_ppg'],
            'papg_differential': home_recent['rolling_papg'] - away_recent['rolling_papg'],
            'overall_differential': home_recent['rolling_diff'] - away_recent['rolling_diff'],

            # Game context
            'home_advantage': 1,  # Home team indicator
            'week': game['week'],
            'is_divisional': 1 if game.get('div_game') == True else 0,

            # Odds data (if available)
            'spread_line': game.get('spread_line', None),
            'home_moneyline': game.get('home_moneyline', None),
            'away_moneyline': game.get('away_moneyline', None),
        }

        features_list.append(features)

    except Exception as e:
        continue

# Create final dataset
training_data = pd.DataFrame(features_list)

# Remove rows with missing critical features
training_data = training_data.dropna(subset=[
    'home_rolling_ppg', 'away_rolling_ppg',
    'home_rolling_papg', 'away_rolling_papg'
])

# Save training data
training_data.to_csv('ml_model/data/training_data.csv', index=False)

print("\n" + "="*60)
print("FEATURE ENGINEERING COMPLETE!")
print("="*60)
print(f"\nTraining dataset: {len(training_data)} games")
print(f"Features: {len(training_data.columns)} columns")
print(f"\nSample features:")
print(training_data.head())

print("\n" + "="*60)
print("FEATURE SUMMARY:")
print("="*60)
for col in training_data.columns:
    if col not in ['game_id', 'gameday', 'home_team', 'away_team']:
        print(f"  {col}: mean={training_data[col].mean():.2f}, std={training_data[col].std():.2f}")

print("\n" + "="*60)
print("TARGET VARIABLE DISTRIBUTION:")
print("="*60)
print(f"Home wins: {training_data['home_win'].sum()} ({training_data['home_win'].mean()*100:.1f}%)")
print(f"Away wins: {len(training_data) - training_data['home_win'].sum()} ({(1-training_data['home_win'].mean())*100:.1f}%)")

print("\nNext step: Run train_model.py to build ML model")
