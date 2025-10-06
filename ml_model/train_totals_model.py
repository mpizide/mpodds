"""
Train NFL Totals (Over/Under) Prediction Model
Predicts total points scored in a game
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import TimeSeriesSplit
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.ensemble import RandomForestRegressor
from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
import warnings
warnings.filterwarnings('ignore')

print("Loading training data...")
data = pd.read_csv('ml_model/data/training_data.csv')
data['gameday'] = pd.to_datetime(data['gameday'])
data = data.sort_values('gameday')

# Load raw data to get actual scores
games_raw = pd.read_csv('ml_model/data/games_raw.csv')
games_raw = games_raw[(games_raw['home_score'].notna()) & (games_raw['away_score'].notna())]
games_raw['total_points'] = games_raw['home_score'] + games_raw['away_score']

# Merge total points into training data
data = pd.merge(
    data,
    games_raw[['game_id', 'total_points']],
    on='game_id',
    how='inner',
    suffixes=('', '_raw')
)

print(f"Merged data shape: {data.shape}")
print(f"Training dataset: {len(data)} games with totals data")

# Define features and target
feature_columns = [
    'home_rolling_ppg', 'home_rolling_papg', 'home_rolling_diff',
    'away_rolling_ppg', 'away_rolling_papg', 'away_rolling_diff',
    'ppg_differential', 'papg_differential', 'overall_differential',
    'home_advantage', 'week', 'is_divisional'
]

X = data[feature_columns]
y = data['total_points']

# Time series cross-validation
print("\n" + "="*60)
print("TRAINING TOTALS MODELS WITH TIME-SERIES CROSS-VALIDATION")
print("="*60)

tscv = TimeSeriesSplit(n_splits=5)

models = {
    'Linear Regression': LinearRegression(),
    'Ridge Regression': Ridge(alpha=1.0, random_state=42),
    'Random Forest': RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42),
    'XGBoost': XGBRegressor(n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42)
}

results = {}

for model_name, model in models.items():
    print(f"\n{model_name}:")
    maes = []
    rmses = []
    r2s = []

    for fold, (train_idx, test_idx) in enumerate(tscv.split(X)):
        X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
        y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)

        mae = mean_absolute_error(y_test, y_pred)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))
        r2 = r2_score(y_test, y_pred)

        maes.append(mae)
        rmses.append(rmse)
        r2s.append(r2)

        print(f"  Fold {fold+1}: MAE={mae:.2f}, RMSE={rmse:.2f}, R2={r2:.3f}")

    avg_mae = np.mean(maes)
    avg_rmse = np.mean(rmses)
    avg_r2 = np.mean(r2s)

    print(f"  Average: MAE={avg_mae:.2f}, RMSE={avg_rmse:.2f}, R2={avg_r2:.3f}")

    results[model_name] = {
        'model': model,
        'mae': avg_mae,
        'rmse': avg_rmse,
        'r2': avg_r2
    }

# Select best model (lowest MAE)
best_model_name = min(results, key=lambda x: results[x]['mae'])
best_model = results[best_model_name]['model']

print("\n" + "="*60)
print(f"BEST MODEL: {best_model_name}")
print("="*60)
print(f"MAE: {results[best_model_name]['mae']:.2f} points")
print(f"RMSE: {results[best_model_name]['rmse']:.2f} points")
print(f"R2: {results[best_model_name]['r2']:.3f}")

# Train final model on all data
print("\nTraining final model on all historical data...")
best_model.fit(X, y)

# Feature importance
if hasattr(best_model, 'feature_importances_'):
    feature_importance = pd.DataFrame({
        'feature': feature_columns,
        'importance': best_model.feature_importances_
    }).sort_values('importance', ascending=False)

    print("\n" + "="*60)
    print("FEATURE IMPORTANCE:")
    print("="*60)
    print(feature_importance.to_string(index=False))

# Save model
model_path = 'ml_model/nfl_totals_model.pkl'
joblib.dump(best_model, model_path)
print(f"\nModel saved to: {model_path}")

# Test predictions on recent games
print("\n" + "="*60)
print("SAMPLE TOTALS PREDICTIONS (Last 10 games):")
print("="*60)

recent_games = data.tail(10).copy()
recent_predictions = best_model.predict(recent_games[feature_columns])

for idx, (i, game) in enumerate(recent_games.iterrows()):
    pred_total = recent_predictions[idx]
    actual_total = game['total_points']

    print(f"{game['home_team']} vs {game['away_team']}")
    print(f"   Predicted Total: {pred_total:.1f} | Actual Total: {actual_total:.1f} | "
          f"Error: {abs(pred_total - actual_total):.1f}")

print("\n" + "="*60)
print("TOTALS MODEL TRAINING COMPLETE!")
print("="*60)
print("\nInterpretation:")
print(f"- MAE of {results[best_model_name]['mae']:.2f} means predictions are off by ~{results[best_model_name]['mae']:.1f} points on average")
print("- Use this model to predict total points scored")
print("- Compare predicted total vs O/U line to find value")
print("\nNext: Run predict_upcoming_all.py to generate all predictions (win/spread/totals)")
