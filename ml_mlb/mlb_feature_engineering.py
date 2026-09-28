"""
Feature Engineering for MLB Prediction Model
Creates the training dataset from raw data (see mlb_features.py for how each feature is built)

Output: ml_mlb/data/training_data.csv
"""

import os
import sys

from mlb_features import DATA_DIR, FEATURE_COLUMNS, build_features, load_data

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# 2020 is only used as "last season" context
FIRST_TRAINING_SEASON = 2021

print("Loading raw data...")
games, pitchers, teams, xera = load_data()

print("Engineering features (point-in-time, no leakage)...")
df = build_features(games, pitchers, teams, xera)

training = df[df['completed'] & (df['season'] >= FIRST_TRAINING_SEASON)].copy()
training = training.dropna(subset=FEATURE_COLUMNS + ['home_win'])
training = training.sort_values('game_datetime')
training.to_csv(os.path.join(DATA_DIR, 'training_data.csv'), index=False)

print("\n" + "=" * 60)
print("FEATURE ENGINEERING COMPLETE!")
print("=" * 60)
print(f"\nTraining dataset: {len(training)} games ({training['season'].min()}-{training['season'].max()})")
print(f"Features: {len(FEATURE_COLUMNS)}")

print("\n" + "=" * 60)
print("FEATURE SUMMARY:")
print("=" * 60)
for col in FEATURE_COLUMNS:
    print(f"  {col}: mean={training[col].mean():.3f}, std={training[col].std():.3f}")

print("\n" + "=" * 60)
print("TARGET VARIABLE DISTRIBUTION:")
print("=" * 60)
print(f"Home wins: {int(training['home_win'].sum())} ({training['home_win'].mean() * 100:.1f}%)")
print(f"Avg run differential (home): {training['run_diff'].mean():+.2f}")
print(f"Avg total runs: {training['total_runs'].mean():.2f}")

print("\nNext step: python ml_mlb/mlb_train_models.py")
