"""
Train NFL Prediction Model
Builds and validates machine learning model
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import TimeSeriesSplit
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from sklearn.metrics import accuracy_score, log_loss, roc_auc_score
import joblib
import warnings
warnings.filterwarnings('ignore')

print("Loading training data...")
data = pd.read_csv('ml_model/data/training_data.csv')
data['gameday'] = pd.to_datetime(data['gameday'])
data = data.sort_values('gameday')

print(f"Training dataset: {len(data)} games")

# Define features and target
feature_columns = [
    'home_rolling_ppg', 'home_rolling_papg', 'home_rolling_diff',
    'away_rolling_ppg', 'away_rolling_papg', 'away_rolling_diff',
    'ppg_differential', 'papg_differential', 'overall_differential',
    'home_advantage', 'week', 'is_divisional'
]

X = data[feature_columns]
y = data['home_win']

# Time series cross-validation (no data leakage!)
print("\n" + "="*60)
print("TRAINING MODELS WITH TIME-SERIES CROSS-VALIDATION")
print("="*60)

tscv = TimeSeriesSplit(n_splits=5)

models = {
    'Logistic Regression': LogisticRegression(max_iter=1000, random_state=42),
    'Random Forest': RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42),
    'XGBoost': XGBClassifier(n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42)
}

results = {}

for model_name, model in models.items():
    print(f"\n{model_name}:")
    accuracies = []
    aucs = []

    for fold, (train_idx, test_idx) in enumerate(tscv.split(X)):
        X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
        y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

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

    results[model_name] = {
        'model': model,
        'accuracy': avg_acc,
        'auc': avg_auc
    }

# Select best model
best_model_name = max(results, key=lambda x: results[x]['auc'])
best_model = results[best_model_name]['model']

print("\n" + "="*60)
print(f"BEST MODEL: {best_model_name}")
print("="*60)
print(f"Accuracy: {results[best_model_name]['accuracy']:.3f}")
print(f"AUC: {results[best_model_name]['auc']:.3f}")

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
model_path = 'ml_model/nfl_prediction_model.pkl'
joblib.dump(best_model, model_path)
print(f"\nModel saved to: {model_path}")

# Save feature columns for inference
joblib.dump(feature_columns, 'ml_model/feature_columns.pkl')

# Test predictions on recent games
print("\n" + "="*60)
print("SAMPLE PREDICTIONS (Last 10 games):")
print("="*60)

recent_games = data.tail(10).copy()
recent_predictions = best_model.predict_proba(recent_games[feature_columns])[:, 1]

for idx, (i, game) in enumerate(recent_games.iterrows()):
    pred_prob = recent_predictions[idx]
    actual = "HOME WIN" if game['home_win'] == 1 else "AWAY WIN"
    correct = "OK" if (pred_prob > 0.5 and game['home_win'] == 1) or (pred_prob < 0.5 and game['home_win'] == 0) else "X"

    print(f"{correct} {game['home_team']} vs {game['away_team']}: "
          f"Predicted {pred_prob*100:.1f}% (Actual: {actual})")

print("\n" + "="*60)
print("MODEL TRAINING COMPLETE!")
print("="*60)
print("\nNext steps:")
print("1. Run predict_upcoming.py to generate predictions for upcoming games")
print("2. Integrate model predictions into your React app")
print("3. Track model performance over time to validate accuracy")
