import nfl_data_py as nfl
import pandas as pd
import numpy as np

print("Collecting player statistics data...")

# Get weekly player stats for past 5 seasons
seasons = [2020, 2021, 2022, 2023, 2024]

# Collect weekly stats
print("Loading weekly player stats...")
weekly_stats = nfl.import_weekly_data(seasons)

# Filter to only include relevant stats
print(f"Total rows: {len(weekly_stats)}")

# Select relevant columns for predictions
columns_to_keep = [
    'player_id', 'player_name', 'player_display_name', 'position',
    'recent_team', 'season', 'week', 'opponent_team',
    # Passing stats
    'completions', 'attempts', 'passing_yards', 'passing_tds', 'interceptions',
    'passing_air_yards', 'passing_yards_after_catch', 'passing_first_downs',
    'passing_epa', 'passing_2pt_conversions',
    # Rushing stats
    'carries', 'rushing_yards', 'rushing_tds', 'rushing_fumbles',
    'rushing_first_downs', 'rushing_epa', 'rushing_2pt_conversions',
    # Receiving stats
    'receptions', 'targets', 'receiving_yards', 'receiving_tds',
    'receiving_fumbles', 'receiving_air_yards', 'receiving_yards_after_catch',
    'receiving_first_downs', 'receiving_epa', 'receiving_2pt_conversions',
    # Other
    'fantasy_points', 'fantasy_points_ppr'
]

# Keep only columns that exist
existing_columns = [col for col in columns_to_keep if col in weekly_stats.columns]
player_stats = weekly_stats[existing_columns].copy()

# Fill NaN values with 0 for numeric columns
numeric_columns = player_stats.select_dtypes(include=[np.number]).columns
player_stats[numeric_columns] = player_stats[numeric_columns].fillna(0)

# Save to CSV
output_file = 'player_weekly_stats.csv'
player_stats.to_csv(output_file, index=False)

print(f"OK - Player stats saved to {output_file}")
print(f"Total players: {player_stats['player_id'].nunique()}")
print(f"Total games: {len(player_stats)}")

# Print summary by position
print("\nStats by position:")
print(player_stats.groupby('position').size().sort_values(ascending=False).head(10))
