"""
College Basketball Prediction Generator
Generates ML predictions for upcoming games

Outputs predictions to: ../src/cbb_ml_predictions.json
This file is cached and used by the React app
"""

import pandas as pd
import numpy as np
import joblib
import json
from datetime import datetime, timedelta
import requests

print("="*70)
print("COLLEGE BASKETBALL PREDICTION GENERATOR")
print("="*70)

print("\nLoading trained models...")
win_model = joblib.load('ml_cbb/cbb_win_model.pkl')
spread_model = joblib.load('ml_cbb/cbb_spread_model.pkl')
totals_model = joblib.load('ml_cbb/cbb_totals_model.pkl')
feature_columns = joblib.load('ml_cbb/cbb_feature_columns.pkl')

print("✓ Models loaded successfully")

print("\nFetching current season data...")

# Load historical data to calculate current team stats
data = pd.read_csv('ml_cbb/data/cbb_training_data.csv')
data['date'] = pd.to_datetime(data['date'])

# Get unique teams
all_teams = pd.concat([data['home_team'], data['away_team']]).unique()

print(f"✓ Found {len(all_teams)} teams")

# Calculate current team momentum and stats
print("\nCalculating current team statistics...")

def get_current_team_stats(team_name, data_df):
    """Get most recent stats for a team"""
    # Get all recent games for this team
    home_games = data_df[data_df['home_team'] == team_name].tail(10)
    away_games = data_df[data_df['away_team'] == team_name].tail(10)

    if len(home_games) == 0 and len(away_games) == 0:
        return None

    # Get most recent record
    if len(home_games) > 0:
        recent = home_games.iloc[-1]
    else:
        recent = away_games.iloc[-1]

    # Extract stats (use column names from feature engineering)
    stats = {}

    # If team is home
    if team_name in home_games['home_team'].values:
        stats = {
            'rolling_ppg': recent['home_rolling_ppg'],
            'rolling_papg': recent['home_rolling_papg'],
            'rolling_diff': recent['home_rolling_diff'],
            'streak': recent['home_streak'],
            'recent_form': recent['home_recent_form'],
            'last5_wins': recent['home_last5_wins'],
            'momentum_score': recent['home_momentum_score'],
            'games_played': recent['home_games_played'],
            'season_progress': recent['home_season_progress'],
        }
    else:
        stats = {
            'rolling_ppg': recent['away_rolling_ppg'],
            'rolling_papg': recent['away_rolling_papg'],
            'rolling_diff': recent['away_rolling_diff'],
            'streak': recent['away_streak'],
            'recent_form': recent['away_recent_form'],
            'last5_wins': recent['away_last5_wins'],
            'momentum_score': recent['away_momentum_score'],
            'games_played': recent['away_games_played'],
            'season_progress': recent['away_season_progress'],
        }

    return stats

# Build team stats dictionary
team_stats = {}
for team in all_teams:
    stats = get_current_team_stats(team, data)
    if stats:
        team_stats[team] = stats

print(f"✓ Calculated stats for {len(team_stats)} teams")

print("\nFetching upcoming games from ESPN API...")

def fetch_upcoming_cbb_games():
    """Fetch upcoming CBB games from ESPN API"""
    upcoming_games = []

    # Get games for next 7 days
    for days_ahead in range(7):
        date = datetime.now() + timedelta(days=days_ahead)
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

                            # Only include scheduled games (not completed or in-progress)
                            if status['state'] in ['pre', 'scheduled']:
                                home_team = competition['competitors'][0] if competition['competitors'][0]['homeAway'] == 'home' else competition['competitors'][1]
                                away_team = competition['competitors'][1] if competition['competitors'][0]['homeAway'] == 'home' else competition['competitors'][0]

                                game_data = {
                                    'game_id': event['id'],
                                    'date': event['date'],
                                    'home_team': home_team['team']['displayName'],
                                    'away_team': away_team['team']['displayName'],
                                    'home_abbr': home_team['team']['abbreviation'],
                                    'away_abbr': away_team['team']['abbreviation'],
                                    'is_neutral': competition.get('neutralSite', False),
                                    'is_conference': event.get('season', {}).get('type') == 2,
                                }
                                upcoming_games.append(game_data)
                        except Exception as e:
                            continue

            print(f"  {date.strftime('%b %d')}: {len([g for g in upcoming_games if g['date'].startswith(date.strftime('%Y-%m-%d'))])} games")

        except Exception as e:
            print(f"  ⚠ Error fetching {date_str}: {str(e)}")

    return upcoming_games

upcoming_games = fetch_upcoming_cbb_games()
print(f"\n✓ Found {len(upcoming_games)} upcoming games")

print("\nGenerating ML predictions...")
print("⚠️  NOTE: Conference and travel features using default values")
print("    Run full feature engineering for more accurate predictions")

predictions = []
skipped = 0

for game in upcoming_games:
    home_team = game['home_team']
    away_team = game['away_team']

    # Check if we have stats for both teams
    if home_team not in team_stats or away_team not in team_stats:
        skipped += 1
        continue

    home_stats = team_stats[home_team]
    away_stats = team_stats[away_team]

    # Build feature vector
    home_advantage = 4.5 if not game['is_neutral'] else 0

    features = {
        # Basic team strength
        'home_rolling_ppg': home_stats['rolling_ppg'],
        'home_rolling_papg': home_stats['rolling_papg'],
        'home_rolling_diff': home_stats['rolling_diff'],
        'away_rolling_ppg': away_stats['rolling_ppg'],
        'away_rolling_papg': away_stats['rolling_papg'],
        'away_rolling_diff': away_stats['rolling_diff'],
        'ppg_differential': home_stats['rolling_ppg'] - away_stats['rolling_ppg'],
        'papg_differential': home_stats['rolling_papg'] - away_stats['rolling_papg'],
        'overall_differential': home_stats['rolling_diff'] - away_stats['rolling_diff'],

        # Home court advantage
        'home_advantage': home_advantage,
        'is_neutral_site': 1 if game['is_neutral'] else 0,

        # Momentum features
        'home_streak': home_stats['streak'],
        'away_streak': away_stats['streak'],
        'home_recent_form': home_stats['recent_form'],
        'away_recent_form': away_stats['recent_form'],
        'home_last5_wins': home_stats['last5_wins'],
        'away_last5_wins': away_stats['last5_wins'],
        'home_momentum_score': home_stats['momentum_score'],
        'away_momentum_score': away_stats['momentum_score'],
        'streak_differential': home_stats['streak'] - away_stats['streak'],
        'form_differential': home_stats['recent_form'] - away_stats['recent_form'],
        'momentum_differential': home_stats['momentum_score'] - away_stats['momentum_score'],

        # Season progression
        'home_games_played': home_stats['games_played'],
        'away_games_played': away_stats['games_played'],
        'home_season_progress': home_stats['season_progress'],
        'away_season_progress': away_stats['season_progress'],
        'experience_differential': home_stats['games_played'] - away_stats['games_played'],
        'is_early_season': int(home_stats['season_progress'] <= 10),
        'is_late_season': int(home_stats['season_progress'] >= 20),

        # Game context
        'is_conference_game': 1 if game['is_conference'] else 0,
    }

    # Add missing features with default values
    # These will be properly calculated once the full system is integrated
    missing_features = {
        'home_conf_strength': 50,
        'away_conf_strength': 50,
        'conf_strength_differential': 0,
        'is_cross_conference': 0,
        'conf_game_weight': 1.0,
        'travel_distance': 0,
        'is_flight_game': 0,
        'is_long_flight': 0,
        'away_travel_miles_7days': 0,
        'away_flight_trips_7days': 0,
        'home_rest_days': 2,
        'away_rest_days': 2,
        'rest_advantage': 0,
        'is_back_to_back': 0,
        'altitude_advantage': 0,
        'is_early_season_phase': 0,
        'is_tournament_time': 0,
        'travel_x_fatigue': 0,
        'momentum_x_conference': 0,
        'conf_strength_x_neutral': 0,
    }

    # Add missing features only if they're in the model's feature columns
    for feat, default_val in missing_features.items():
        if feat in feature_columns and feat not in features:
            features[feat] = default_val

    # Create feature vector with only columns the model expects
    # If any features are still missing, add them with 0 as default
    for feat in feature_columns:
        if feat not in features:
            features[feat] = 0

    X = pd.DataFrame([features])[feature_columns]

    # Generate predictions from all three models
    win_prob = win_model.predict_proba(X)[0, 1]  # Home team win probability
    predicted_spread = spread_model.predict(X)[0]  # Point differential
    predicted_total = totals_model.predict(X)[0]  # Total points

    # Calculate spread cover probabilities (simplified)
    # Higher win probability = higher spread cover probability
    home_spread_prob = 50 + (win_prob - 0.5) * 40  # Maps 0-1 to 30-70 range
    home_spread_prob = max(30, min(70, home_spread_prob))

    # Calculate over/under probabilities
    # Use predicted total vs average
    avg_total = home_stats['rolling_ppg'] + away_stats['rolling_ppg']
    over_prob = 50 + (predicted_total - avg_total) * 2
    over_prob = max(35, min(65, over_prob))

    prediction = {
        'game_id': f"cbb_{game['date'][:10]}_{game['away_abbr']}_{game['home_abbr']}",
        'gameday': game['date'][:10],
        'home_team': home_team,
        'away_team': away_team,

        # Win probabilities
        'home_win_prob': round(win_prob * 100, 1),
        'away_win_prob': round((1 - win_prob) * 100, 1),

        # Spread predictions
        'predicted_spread': round(predicted_spread, 1),
        'home_spread_prob': round(home_spread_prob, 1),
        'away_spread_prob': round(100 - home_spread_prob, 1),

        # Totals predictions
        'predicted_total': round(predicted_total, 1),
        'over_prob': round(over_prob, 1),
        'under_prob': round(100 - over_prob, 1),

        # Additional context
        'home_streak': int(home_stats['streak']),
        'away_streak': int(away_stats['streak']),
        'is_neutral_site': game['is_neutral'],
    }

    predictions.append(prediction)

print(f"✓ Generated {len(predictions)} predictions")
if skipped > 0:
    print(f"⚠ Skipped {skipped} games (teams not in database)")

# Save predictions to JSON for React app
output_file = 'src/cbb_ml_predictions.json'

with open(output_file, 'w') as f:
    json.dump(predictions, f, indent=2)

print("\n" + "="*70)
print("PREDICTIONS GENERATED SUCCESSFULLY!")
print("="*70)
print(f"\n✓ Saved to: {output_file}")
print(f"✓ Total predictions: {len(predictions)}")

# Display sample predictions
if len(predictions) > 0:
    print("\n📊 SAMPLE PREDICTIONS:")
    print("="*70)

    for pred in predictions[:5]:
        print(f"\n{pred['away_team']} @ {pred['home_team']}")
        print(f"  Date: {pred['gameday']}")
        print(f"  Win Prob: {pred['home_team']} {pred['home_win_prob']}% | {pred['away_team']} {pred['away_win_prob']}%")
        print(f"  Spread: {pred['predicted_spread']:+.1f} (home)")
        print(f"  Total: {pred['predicted_total']:.1f} points")
        print(f"  Momentum: Home {pred['home_streak']:+d} streak | Away {pred['away_streak']:+d} streak")

print("\n" + "="*70)
print("🚀 READY FOR DEPLOYMENT!")
print("="*70)
print("\nThe predictions are now available for your React app.")
print("Run this script daily to keep predictions fresh.")
print("\nSuggested schedule:")
print("  - Run daily at 6 AM: cbb_predict_upcoming.py")
print("  - Auto-retrain weekly: cbb_auto_retrain.py")
