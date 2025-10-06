"""
NFL Data Collection Script
Fetches historical game data, team stats, and creates training dataset
"""

import nfl_data_py as nfl
import pandas as pd
import os

# Create directory for data
os.makedirs('ml_model/data', exist_ok=True)

print("Fetching NFL historical data...")

# Get last 5 seasons (2019-2024)
seasons = [2019, 2020, 2021, 2022, 2023, 2024]

# 1. Get game schedules and results
print("\n1. Fetching game schedules and scores...")
games = nfl.import_schedules(seasons)
print(f"   > Loaded {len(games)} games")

# 2. Get weekly team stats
print("\n2. Fetching weekly team stats...")
weekly_stats = nfl.import_weekly_data(seasons)
print(f"   > Loaded {len(weekly_stats)} weekly records")

# 3. Get roster data (for injuries, key players)
print("\n3. Fetching roster data...")
rosters = nfl.import_seasonal_rosters(seasons)
print(f"   > Loaded {len(rosters)} player records")

# 4. Get seasonal team statistics
print("\n4. Fetching seasonal team statistics...")
seasonal_stats = nfl.import_seasonal_data(seasons)
print(f"   > Loaded {len(seasonal_stats)} seasonal records")

# Save raw data
print("\nSaving raw data to CSV files...")
games.to_csv('ml_model/data/games_raw.csv', index=False)
weekly_stats.to_csv('ml_model/data/weekly_stats_raw.csv', index=False)
rosters.to_csv('ml_model/data/rosters_raw.csv', index=False)
seasonal_stats.to_csv('ml_model/data/seasonal_stats_raw.csv', index=False)

print("\n" + "="*60)
print("DATA COLLECTION COMPLETE!")
print("="*60)
print(f"\nFiles saved in ml_model/data/:")
print(f"  - games_raw.csv ({len(games)} games)")
print(f"  - weekly_stats_raw.csv ({len(weekly_stats)} records)")
print(f"  - rosters_raw.csv ({len(rosters)} players)")
print(f"  - seasonal_stats_raw.csv ({len(seasonal_stats)} records)")

# Print sample of games data
print("\n" + "="*60)
print("SAMPLE GAME DATA:")
print("="*60)
print(games[['gameday', 'home_team', 'away_team', 'home_score', 'away_score', 'home_moneyline', 'spread_line']].head(10))

print("\n" + "="*60)
print("KEY FEATURES AVAILABLE:")
print("="*60)
print("Game Features:", games.columns.tolist()[:20], "...")
print("\nNext step: Run feature_engineering.py to prepare training data")
