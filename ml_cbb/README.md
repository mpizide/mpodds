# College Basketball ML Prediction System

## Overview

This is a **self-improving machine learning system** for predicting college basketball game outcomes. The models automatically get better over time as they learn from new game results.

### Key Features

- **Win Probability Model**: Predicts home team win probability
- **Spread Model**: Predicts point differential
- **Totals Model**: Predicts total points scored
- **Momentum-Aware**: Tracks win/loss streaks and recent form
- **Season Progression**: Accounts for teams improving throughout the season
- **Auto-Retraining**: Models update weekly with new data

## CBB-Specific Features

Unlike NBA/NFL, college basketball has unique dynamics:

1. **High Roster Turnover**: Transfers, one-and-done players
2. **Momentum Matters**: Win/loss streaks heavily impact performance
3. **Team Chemistry**: New players need time to gel
4. **Conference Strength**: Power 6 vs mid-major conferences
5. **Home Court**: Stronger advantage (~4-5 points vs NBA's ~3)

## Installation

### 1. Install Python Dependencies

```bash
cd ml_cbb
pip install -r requirements.txt
```

### 2. Verify Installation

```bash
python -c "import pandas, sklearn, xgboost; print('✅ All dependencies installed')"
```

## Quick Start

### Initial Setup (First Time Only)

Run these scripts in order to build your initial models:

```bash
# Step 1: Collect historical data (2020-2025 seasons)
python ml_cbb/cbb_data_collection.py

# Step 2: Engineer features (momentum, streaks, etc.)
python ml_cbb/cbb_feature_engineering.py

# Step 3: Train ML models
python ml_cbb/cbb_train_models.py

# Step 4: Generate predictions for upcoming games
python ml_cbb/cbb_predict_upcoming.py
```

This will create:
- `ml_cbb/data/cbb_training_data.csv` - Training dataset
- `ml_cbb/cbb_win_model.pkl` - Win probability model
- `ml_cbb/cbb_spread_model.pkl` - Spread prediction model
- `ml_cbb/cbb_totals_model.pkl` - Totals prediction model
- `src/cbb_ml_predictions.json` - Predictions for React app

## Daily Usage

Once models are trained, run this daily to update predictions:

```bash
python ml_cbb/cbb_predict_upcoming.py
```

This:
- Fetches upcoming games from ESPN API
- Calculates current team stats
- Generates ML predictions
- Saves to `src/cbb_ml_predictions.json`

## Automated Retraining

Run this weekly to improve the models with new data:

```bash
python ml_cbb/cbb_auto_retrain.py
```

This script:
1. ✅ Fetches completed games from last 7 days
2. ✅ Updates training data with actual results
3. ✅ Retrains models if conditions met:
   - More than 50 new games added, OR
   - More than 7 days since last retrain
4. ✅ Generates fresh predictions
5. ✅ Logs performance metrics

### Scheduling Automated Updates

**Windows (Task Scheduler):**

```bash
# Daily predictions (6 AM)
schtasks /create /tn "CBB Predictions" /tr "python C:\path\to\ml_cbb\cbb_predict_upcoming.py" /sc daily /st 06:00

# Weekly retraining (Sunday 3 AM)
schtasks /create /tn "CBB Retrain" /tr "python C:\path\to\ml_cbb\cbb_auto_retrain.py" /sc weekly /d SUN /st 03:00
```

**macOS/Linux (cron):**

```bash
# Edit crontab
crontab -e

# Add these lines:
# Daily predictions at 6 AM
0 6 * * * cd /path/to/mpodds && python ml_cbb/cbb_predict_upcoming.py

# Weekly retraining Sunday 3 AM
0 3 * * 0 cd /path/to/mpodds && python ml_cbb/cbb_auto_retrain.py
```

## Model Performance

After training, you'll see metrics like:

```
Win Probability Model:
  Accuracy: 0.683 AUC
  Algorithm: XGBoost

Spread Prediction Model:
  Error: 11.24 points MAE
  Algorithm: XGBoost

Totals Prediction Model:
  Error: 15.67 points MAE
  Algorithm: XGBoost
```

### What Do These Mean?

- **AUC (0.683)**: Area under ROC curve. 0.5 = random, 1.0 = perfect
  - 0.68 is good for sports betting (edges exist)

- **MAE (Mean Absolute Error)**: Average prediction error in points
  - 11.24 for spreads = model is off by ~11 points on average
  - This is reasonable for CBB (high variance sport)

## Feature Importance

The model uses these features (ranked by importance):

1. **Momentum Differential** - Streak difference between teams
2. **Overall Differential** - Point differential over last 5 games
3. **Home Advantage** - Home court boost (~4.5 points)
4. **Recent Form** - Win % in last 3 games
5. **Rolling PPG** - Points per game (last 5)
6. **Season Progress** - Games played this season
7. **Streak Length** - Current win/loss streak
8. **Conference Game** - In-conference vs out-of-conference

## File Structure

```
ml_cbb/
├── data/
│   ├── cbb_games_raw.csv           # Raw game data
│   ├── cbb_teams_raw.csv           # Team statistics
│   ├── cbb_training_data.csv       # Processed training data
│   └── retrain_log.json            # Retraining history
├── cbb_data_collection.py          # Fetch game data
├── cbb_feature_engineering.py      # Create ML features
├── cbb_train_models.py             # Train models
├── cbb_predict_upcoming.py         # Generate predictions
├── cbb_auto_retrain.py             # Auto-update system
├── cbb_win_model.pkl               # Trained model
├── cbb_spread_model.pkl            # Trained model
├── cbb_totals_model.pkl            # Trained model
├── cbb_feature_columns.pkl         # Feature list
├── requirements.txt                # Python dependencies
└── README.md                       # This file

src/
├── cbb_ml_predictions.json         # Predictions for React app
└── utils/cbbMLPredictions.js       # Load predictions
```

## Troubleshooting

### No predictions generated

**Problem:** `cbb_predict_upcoming.py` outputs 0 predictions

**Solution:**
```bash
# Check if training data exists
ls ml_cbb/data/cbb_training_data.csv

# If missing, run setup steps again
python ml_cbb/cbb_data_collection.py
python ml_cbb/cbb_feature_engineering.py
python ml_cbb/cbb_train_models.py
```

### Team names don't match

**Problem:** API returns "Duke Blue Devils" but model expects "Duke"

**Solution:** The prediction script uses fuzzy matching. It should automatically handle this. If issues persist, check the matching logic in `cbb_predict_upcoming.py` lines 70-100.

### Models perform poorly

**Problem:** High MAE or low AUC scores

**Solution:**
1. Collect more historical data (add more seasons)
2. Let the auto-retrain system run for a few weeks
3. Models improve as they see more game results

### API rate limits

**Problem:** ESPN API returns errors

**Solution:**
```python
# Add delays between requests in cbb_data_collection.py
import time
time.sleep(1)  # Wait 1 second between requests
```

## Advanced Configuration

### Adjust Lookback Window

Change how many recent games to consider:

```python
# In cbb_feature_engineering.py, line 51
all_games['rolling_ppg'] = all_games['points_for'].rolling(5, min_periods=1).mean()
# Change 5 to 10 for longer window
all_games['rolling_ppg'] = all_games['points_for'].rolling(10, min_periods=1).mean()
```

### Tune Model Hyperparameters

```python
# In cbb_train_models.py, line 43
XGBClassifier(n_estimators=200, max_depth=6, learning_rate=0.1, random_state=42)
# Increase n_estimators for better performance (slower training)
XGBClassifier(n_estimators=500, max_depth=8, learning_rate=0.05, random_state=42)
```

### Add More Features

Edit `cbb_feature_engineering.py` to add custom features:

```python
features = {
    # ... existing features ...

    # Your custom feature
    'home_free_throw_pct': home_stats.get('ft_pct', 0.75),
    'rivalry_game': 1 if is_rivalry(home_team, away_team) else 0,
}
```

## Data Sources

- **Game Data**: ESPN API (free, public)
- **Team Stats**: Calculated from game results
- **Alternative**: `sportsipy` library (Sports Reference data)

## Model Improvements Over Time

The system logs each retrain with performance metrics:

```json
{
  "retrains": [
    {
      "win_auc": 0.683,
      "spread_mae": 11.24,
      "totals_mae": 15.67,
      "training_games": 4523,
      "timestamp": "2025-03-04T10:30:00"
    }
  ]
}
```

Track improvements in `ml_cbb/data/retrain_log.json`

## FAQ

**Q: How accurate are the predictions?**
A: The win probability model has ~68% AUC, which provides a betting edge. Spreads are accurate within ~11 points on average.

**Q: Can I use this for sports betting?**
A: These are predictions, not guarantees. Always bet responsibly and within your means. The models provide edges, not certainties.

**Q: How long until models are accurate?**
A: Initial models train on 5 years of data. They improve as they see more games through the season (auto-retrain).

**Q: What if my team isn't in the database?**
A: The data collection script fetches all Division I teams. If a team is missing, it's likely a new D1 program. They'll appear once they play games.

**Q: Do models account for injuries?**
A: Not directly. But momentum/form features indirectly capture team performance with current roster.

**Q: Can I add player-level data?**
A: Yes! Extend `cbb_feature_engineering.py` to include player stats. You'll need additional data sources (Sports Reference, ESPN).

## Support

For issues or questions:
1. Check this README
2. Review the script comments
3. Examine the retrain log for errors

## License

This is part of the MPOdds project. Use responsibly.

---

**Remember:** The models improve automatically as more games are played. The longer you run this system, the better it gets! 🚀
