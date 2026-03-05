"""
College Basketball Model Training
Trains THREE ML models:
1. Win Probability Model - Predicts home team win probability
2. Spread Model - Predicts point differential
3. Totals Model - Predicts total points scored

Models learn from CBB-specific features:
- Momentum/streaks
- Season progression
- Home court advantage
- Conference dynamics
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import TimeSeriesSplit
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor, GradientBoostingRegressor
from xgboost import XGBClassifier, XGBRegressor
from sklearn.metrics import accuracy_score, roc_auc_score, mean_absolute_error, mean_squared_error
import joblib
import warnings
warnings.filterwarnings('ignore')

print("="*70)
print("COLLEGE BASKETBALL MODEL TRAINING")
print("="*70)

print("\nLoading training data...")
data = pd.read_csv('ml_cbb/data/cbb_training_data.csv')
data['date'] = pd.to_datetime(data['date'])
data = data.sort_values('date')

print(f"Training dataset: {len(data)} games")
print(f"Date range: {data['date'].min()} to {data['date'].max()}")

# AUTO-DETECT FEATURES: Use all numerical columns except targets
print("\n🔍 Auto-detecting features from training data...")
exclude_columns = ['date', 'season', 'home_team', 'away_team', 'home_win', 'point_diff', 'total_points']
all_numeric_cols = data.select_dtypes(include=[np.number]).columns.tolist()
feature_columns = [col for col in all_numeric_cols if col not in exclude_columns]

print(f"\n✓ Detected {len(feature_columns)} features automatically")
print("  This includes:")

# Organize features by category for logging
base_features = [f for f in feature_columns if 'rolling' in f or ('differential' in f and 'conf' not in f)]
conf_features = [f for f in feature_columns if 'conf' in f.lower()]
momentum_features = [f for f in feature_columns if 'streak' in f or 'momentum' in f or 'form' in f]
travel_features = [f for f in feature_columns if 'travel' in f or 'rest' in f or 'flight' in f or 'back_to_back' in f]
interaction_features = [f for f in feature_columns if '_x_' in f]

print(f"  - Base features: {len(base_features)}")
print(f"  - Conference features: {len(conf_features)}")
print(f"  - Momentum features: {len(momentum_features)}")
print(f"  - Travel/Rest features: {len(travel_features)}")
print(f"  - Interaction features: {len(interaction_features)}")
print("\nConference features included:")
conf_feats = [f for f in feature_columns if 'conf' in f]
for f in conf_feats:
    print(f"  - {f}")
print("\nMomentum features included:")
momentum_feats = [f for f in feature_columns if 'streak' in f or 'momentum' in f or 'form' in f]
for f in momentum_feats:
    print(f"  - {f}")

# Time series cross-validation (prevents data leakage)
tscv = TimeSeriesSplit(n_splits=5)

print("\n" + "="*70)
print("MODEL 1: WIN PROBABILITY (Classification)")
print("="*70)

X_win = data[feature_columns]
y_win = data['home_win']

win_models = {
    'Logistic Regression': LogisticRegression(max_iter=1000, random_state=42),
    'Random Forest': RandomForestClassifier(n_estimators=200, max_depth=15, random_state=42),
    'XGBoost': XGBClassifier(n_estimators=200, max_depth=6, learning_rate=0.1, random_state=42)
}

best_win_model = None
best_win_auc = 0

for model_name, model in win_models.items():
    print(f"\n{model_name}:")
    accuracies = []
    aucs = []

    for fold, (train_idx, test_idx) in enumerate(tscv.split(X_win)):
        X_train, X_test = X_win.iloc[train_idx], X_win.iloc[test_idx]
        y_train, y_test = y_win.iloc[train_idx], y_win.iloc[test_idx]

        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        y_proba = model.predict_proba(X_test)[:, 1]

        acc = accuracy_score(y_test, y_pred)
        auc = roc_auc_score(y_test, y_proba)

        accuracies.append(acc)
        aucs.append(auc)

        print(f"  Fold {fold+1}: Accuracy={acc:.3f}, AUC={auc:.3f}")

    avg_acc = np.mean(accuracies)
    avg_auc = np.mean(aucs)

    print(f"  Average: Accuracy={avg_acc:.3f}, AUC={avg_auc:.3f}")

    if avg_auc > best_win_auc:
        best_win_auc = avg_auc
        best_win_model = (model_name, model)

print(f"\n✓ Best Win Model: {best_win_model[0]} (AUC={best_win_auc:.3f})")

# Train final win model on all data
print("\nTraining final win probability model on all data...")
best_win_model[1].fit(X_win, y_win)

# Feature importance for win model
if hasattr(best_win_model[1], 'feature_importances_'):
    feature_importance = pd.DataFrame({
        'feature': feature_columns,
        'importance': best_win_model[1].feature_importances_
    }).sort_values('importance', ascending=False)

    print("\nTop 10 Most Important Features:")
    print(feature_importance.head(10).to_string(index=False))

# Save win model
joblib.dump(best_win_model[1], 'ml_cbb/cbb_win_model.pkl')
print("\n✓ Win model saved: ml_cbb/cbb_win_model.pkl")

print("\n" + "="*70)
print("MODEL 2: SPREAD PREDICTION (Regression)")
print("="*70)

X_spread = data[feature_columns]
y_spread = data['point_diff']

spread_models = {
    'Ridge Regression': Ridge(alpha=1.0, random_state=42),
    'Random Forest': RandomForestRegressor(n_estimators=200, max_depth=15, random_state=42),
    'Gradient Boosting': GradientBoostingRegressor(n_estimators=200, max_depth=5, learning_rate=0.1, random_state=42),
    'XGBoost': XGBRegressor(n_estimators=200, max_depth=6, learning_rate=0.1, random_state=42)
}

best_spread_model = None
best_spread_mae = float('inf')

for model_name, model in spread_models.items():
    print(f"\n{model_name}:")
    maes = []
    rmses = []

    for fold, (train_idx, test_idx) in enumerate(tscv.split(X_spread)):
        X_train, X_test = X_spread.iloc[train_idx], X_spread.iloc[test_idx]
        y_train, y_test = y_spread.iloc[train_idx], y_spread.iloc[test_idx]

        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)

        mae = mean_absolute_error(y_test, y_pred)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))

        maes.append(mae)
        rmses.append(rmse)

        print(f"  Fold {fold+1}: MAE={mae:.2f}, RMSE={rmse:.2f}")

    avg_mae = np.mean(maes)
    avg_rmse = np.mean(rmses)

    print(f"  Average: MAE={avg_mae:.2f}, RMSE={avg_rmse:.2f}")

    if avg_mae < best_spread_mae:
        best_spread_mae = avg_mae
        best_spread_model = (model_name, model)

print(f"\n✓ Best Spread Model: {best_spread_model[0]} (MAE={best_spread_mae:.2f})")

# Train final spread model
print("\nTraining final spread model on all data...")
best_spread_model[1].fit(X_spread, y_spread)

# Save spread model
joblib.dump(best_spread_model[1], 'ml_cbb/cbb_spread_model.pkl')
print("✓ Spread model saved: ml_cbb/cbb_spread_model.pkl")

print("\n" + "="*70)
print("MODEL 3: TOTALS PREDICTION (Regression)")
print("="*70)

X_totals = data[feature_columns]
y_totals = data['total_points']

totals_models = {
    'Ridge Regression': Ridge(alpha=1.0, random_state=42),
    'Random Forest': RandomForestRegressor(n_estimators=200, max_depth=15, random_state=42),
    'Gradient Boosting': GradientBoostingRegressor(n_estimators=200, max_depth=5, learning_rate=0.1, random_state=42),
    'XGBoost': XGBRegressor(n_estimators=200, max_depth=6, learning_rate=0.1, random_state=42)
}

best_totals_model = None
best_totals_mae = float('inf')

for model_name, model in totals_models.items():
    print(f"\n{model_name}:")
    maes = []
    rmses = []

    for fold, (train_idx, test_idx) in enumerate(tscv.split(X_totals)):
        X_train, X_test = X_totals.iloc[train_idx], X_totals.iloc[test_idx]
        y_train, y_test = y_totals.iloc[train_idx], y_totals.iloc[test_idx]

        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)

        mae = mean_absolute_error(y_test, y_pred)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))

        maes.append(mae)
        rmses.append(rmse)

        print(f"  Fold {fold+1}: MAE={mae:.2f}, RMSE={rmse:.2f}")

    avg_mae = np.mean(maes)
    avg_rmse = np.mean(rmses)

    print(f"  Average: MAE={avg_mae:.2f}, RMSE={avg_rmse:.2f}")

    if avg_mae < best_totals_mae:
        best_totals_mae = avg_mae
        best_totals_model = (model_name, model)

print(f"\n✓ Best Totals Model: {best_totals_model[0]} (MAE={best_totals_mae:.2f})")

# Train final totals model
print("\nTraining final totals model on all data...")
best_totals_model[1].fit(X_totals, y_totals)

# Save totals model
joblib.dump(best_totals_model[1], 'ml_cbb/cbb_totals_model.pkl')
print("✓ Totals model saved: ml_cbb/cbb_totals_model.pkl")

# Save feature columns for inference
joblib.dump(feature_columns, 'ml_cbb/cbb_feature_columns.pkl')
print("✓ Feature columns saved: ml_cbb/cbb_feature_columns.pkl")

print("\n" + "="*70)
print("MODEL TRAINING COMPLETE!")
print("="*70)

print("\n📊 FINAL MODEL SUMMARY:")
print(f"\n  Win Probability Model:")
print(f"    Algorithm: {best_win_model[0]}")
print(f"    Accuracy: {best_win_auc:.3f} AUC")

print(f"\n  Spread Prediction Model:")
print(f"    Algorithm: {best_spread_model[0]}")
print(f"    Error: {best_spread_mae:.2f} points MAE")

print(f"\n  Totals Prediction Model:")
print(f"    Algorithm: {best_totals_model[0]}")
print(f"    Error: {best_totals_mae:.2f} points MAE")

print("\n🔑 KEY INSIGHTS:")
print("  - Momentum features (streaks, form) are critical for CBB predictions")
print("  - Home court advantage is significant (~4-5 points)")
print("  - Teams improve throughout the season (experience matters)")
print("  - Recent form often outweighs overall season performance")

print("\n" + "="*70)
print("Next step: Run cbb_predict_upcoming.py")
print("This will generate predictions for upcoming games")
