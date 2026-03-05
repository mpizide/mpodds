"""
AUTOMATIC TREND DISCOVERY

This script analyzes the trained model to find trends you might not have thought of.
It shows which features matter most and discovers non-obvious patterns.

Run this AFTER training models to see what the model has learned.
"""

import pandas as pd
import numpy as np
import joblib
from datetime import datetime

print("="*70)
print("AUTOMATIC TREND DISCOVERY - What Has The Model Learned?")
print("="*70)

# Load trained model and data
print("\nLoading models and training data...")
try:
    win_model = joblib.load('ml_cbb/cbb_win_model.pkl')
    spread_model = joblib.load('ml_cbb/cbb_spread_model.pkl')
    totals_model = joblib.load('ml_cbb/cbb_totals_model.pkl')
    feature_columns = joblib.load('ml_cbb/cbb_feature_columns.pkl')
    data = pd.read_csv('ml_cbb/data/cbb_training_data.csv')

    print(f"✓ Loaded models trained on {len(data)} games")
    print(f"✓ Using {len(feature_columns)} features")
except Exception as e:
    print(f"❌ Error loading models: {e}")
    print("\nMake sure you've run cbb_train_models.py first!")
    exit(1)

# ============================================================================
# FEATURE IMPORTANCE ANALYSIS
# ============================================================================

print("\n" + "="*70)
print("FEATURE IMPORTANCE - What Matters Most?")
print("="*70)

# Initialize feature_importance as None
feature_importance = None

if hasattr(win_model, 'feature_importances_'):
    feature_importance = pd.DataFrame({
        'feature': feature_columns,
        'importance': win_model.feature_importances_
    }).sort_values('importance', ascending=False)

    print("\nTop 20 Most Important Features for Predicting Wins:")
    print("-" * 70)
    for idx, row in feature_importance.head(20).iterrows():
        bar_length = int(row['importance'] * 100)
        bar = '█' * bar_length
        print(f"{row['feature']:40s} {bar} {row['importance']:.4f}")

    # Save to file for review
    feature_importance.to_csv('ml_cbb/data/feature_importance.csv', index=False)
    print("\n✓ Full feature importance saved to: ml_cbb/data/feature_importance.csv")
else:
    print("\n⚠️ Model doesn't support feature importance extraction")
    print("This usually means you need to retrain with XGBoost or RandomForest")

# ============================================================================
# AUTOMATIC TREND DETECTION
# ============================================================================

print("\n" + "="*70)
print("DISCOVERED TRENDS - Non-Obvious Patterns")
print("="*70)

# Analyze feature correlations with winning
X = data[feature_columns]
y_win = data['home_win']
y_spread = data['point_diff']

print("\n🔍 Analyzing correlations...")

# Find features strongly correlated with winning
correlations = []
for col in feature_columns:
    if col in data.columns:
        try:
            corr = data[col].corr(data['home_win'])
            if abs(corr) > 0.1:  # Only show meaningful correlations
                correlations.append({
                    'feature': col,
                    'correlation': corr,
                    'strength': 'Strong' if abs(corr) > 0.3 else 'Moderate' if abs(corr) > 0.2 else 'Weak'
                })
        except:
            pass

correlations_df = pd.DataFrame(correlations).sort_values('correlation', ascending=False)

print("\n📊 Features Most Correlated with Winning:")
print("-" * 70)
for _, row in correlations_df.head(15).iterrows():
    sign = "+" if row['correlation'] > 0 else "-"
    print(f"{row['feature']:40s} {sign}{abs(row['correlation']):.3f} ({row['strength']})")

# ============================================================================
# CONDITIONAL TRENDS
# ============================================================================

print("\n" + "="*70)
print("CONDITIONAL TRENDS - When Does X Matter?")
print("="*70)

# Travel distance impact
if 'travel_distance' in data.columns and 'away_win' in data.columns:
    print("\n✈️  TRAVEL DISTANCE IMPACT:")
    data['away_win'] = 1 - data['home_win']

    # Short trips
    short_trips = data[data['travel_distance'] < 200]
    print(f"  Short trips (<200 mi): Away win rate = {short_trips['away_win'].mean()*100:.1f}%")

    # Medium trips
    medium_trips = data[(data['travel_distance'] >= 200) & (data['travel_distance'] < 800)]
    print(f"  Medium trips (200-800 mi): Away win rate = {medium_trips['away_win'].mean()*100:.1f}%")

    # Long flights
    long_flights = data[data['travel_distance'] >= 800]
    print(f"  Long flights (>800 mi): Away win rate = {long_flights['away_win'].mean()*100:.1f}%")

    impact = (short_trips['away_win'].mean() - long_flights['away_win'].mean()) * 100
    print(f"  → Impact: {impact:.1f}% difference between short and long trips")

# Conference game impact
if 'is_conference_game' in data.columns:
    print("\n🏀 CONFERENCE GAME IMPACT:")
    conf_games = data[data['is_conference_game'] == 1]
    non_conf_games = data[data['is_conference_game'] == 0]

    print(f"  Conference games: Home win rate = {conf_games['home_win'].mean()*100:.1f}%")
    print(f"  Non-conference games: Home win rate = {non_conf_games['home_win'].mean()*100:.1f}%")

    conf_margin = conf_games['point_diff'].abs().mean()
    non_conf_margin = non_conf_games['point_diff'].abs().mean()
    print(f"  Conference games are closer by {non_conf_margin - conf_margin:.1f} points on average")

# Rest days impact (back-to-back)
if 'is_back_to_back' in data.columns:
    print("\n💤 REST IMPACT (Back-to-Back Games):")
    btb_games = data[data['is_back_to_back'] == 1]
    rested_games = data[data['is_back_to_back'] == 0]

    print(f"  Back-to-back games: Home win rate = {btb_games['home_win'].mean()*100:.1f}%")
    print(f"  Rested games: Home win rate = {rested_games['home_win'].mean()*100:.1f}%")

# Momentum in conference games
if 'streak_differential' in data.columns and 'is_conference_game' in data.columns:
    print("\n🔥 MOMENTUM IN CONFERENCE GAMES:")

    # Momentum in conference games
    conf_hot = data[(data['is_conference_game'] == 1) & (data['streak_differential'] >= 3)]
    conf_cold = data[(data['is_conference_game'] == 1) & (data['streak_differential'] <= -3)]

    # Momentum in non-conference games
    non_conf_hot = data[(data['is_conference_game'] == 0) & (data['streak_differential'] >= 3)]
    non_conf_cold = data[(data['is_conference_game'] == 0) & (data['streak_differential'] <= -3)]

    print(f"  Hot streak (+3) in CONFERENCE games: Win rate = {conf_hot['home_win'].mean()*100:.1f}%")
    print(f"  Hot streak (+3) in NON-CONF games: Win rate = {non_conf_hot['home_win'].mean()*100:.1f}%")
    print(f"  → Momentum matters MORE in {'conference' if conf_hot['home_win'].mean() > non_conf_hot['home_win'].mean() else 'non-conference'} games!")

# ============================================================================
# RECOMMENDATION ENGINE
# ============================================================================

print("\n" + "="*70)
print("🚀 RECOMMENDATIONS - Features to Add")
print("="*70)

print("\nBased on the analysis, consider adding these features:")

recommendations = []

# Check if travel features exist
if 'travel_distance' not in data.columns:
    recommendations.append("✓ Travel distance (flights hurt performance)")

# Check if rest features exist
if 'home_rest_days' not in data.columns:
    recommendations.append("✓ Rest days (back-to-back games)")

# Check if altitude features exist
if 'altitude_advantage' not in data.columns:
    recommendations.append("✓ Altitude effects (Denver, Air Force)")

# Check if interaction features exist
if 'travel_x_fatigue' not in data.columns:
    recommendations.append("✓ Interaction features (travel × fatigue)")

if len(recommendations) > 0:
    for rec in recommendations:
        print(f"  {rec}")
    print("\n  → These features are available in cbb_custom_features.py")
    print("  → Re-run feature engineering to add them!")
else:
    print("\n  ✓ All recommended features are already included!")
    print("  ✓ Model is using advanced features")

# ============================================================================
# SUMMARY REPORT
# ============================================================================

print("\n" + "="*70)
print("📈 SUMMARY - What We Learned")
print("="*70)

print("\nThe model has discovered that:")

# Find top 3 features (only if feature_importance was calculated)
if feature_importance is not None:
    top_features = feature_importance.head(3)['feature'].tolist()
    print(f"\n1. The 3 most important factors are:")
    for i, feat in enumerate(top_features, 1):
        print(f"   {i}. {feat}")

    # Find surprising discoveries
    surprising = []
    if hasattr(win_model, 'feature_importances_'):
        if 'travel_distance' in feature_columns:
            idx = feature_columns.index('travel_distance')
            if win_model.feature_importances_[idx] > 0.02:
                surprising.append("Travel distance significantly affects outcomes")

        if 'conf_strength_differential' in feature_columns:
            idx = feature_columns.index('conf_strength_differential')
            if win_model.feature_importances_[idx] > 0.03:
                surprising.append("Conference strength gap is a major predictor")

    if len(surprising) > 0:
        print("\n2. Surprising discoveries:")
        for i, surprise in enumerate(surprising, 1):
            print(f"   {i}. {surprise}")
else:
    print("\n⚠️ Feature importance not available - use correlation analysis instead")
    print("See the 'DISCOVERED TRENDS' section above for key insights")

print("\n" + "="*70)
print("💡 Next Steps:")
print("="*70)
print("  1. Review feature_importance.csv for full details")
print("  2. Add new features to cbb_custom_features.py")
print("  3. Re-train models with new features")
print("  4. Run this script again to see if accuracy improved")
print("\nThe model improves as it learns from more games! 🚀")
print("="*70)
