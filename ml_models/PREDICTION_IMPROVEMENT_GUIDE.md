# 🚀 NBA Prediction Improvement Guide

This guide shows you how to build the most accurate NBA predictions possible using real data and machine learning.

---

## 📊 **Current System vs. Advanced System**

| Feature | Current (Basic) | Advanced (Recommended) |
|---------|----------------|----------------------|
| **Data Source** | Manual/Dummy | Live NBA API |
| **Update Frequency** | Manual | Automated Daily |
| **Model Type** | Simple Stats | XGBoost/LightGBM |
| **Features** | 5-10 | 50+ |
| **Accuracy** | ~55-60% | 65-75% |
| **Player Props** | Season Averages | Matchup-Adjusted |

---

## 🎯 **Step 1: Set Up Python Environment**

```bash
# Create virtual environment
cd ml_models
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install required packages
pip install nba_api pandas numpy scikit-learn xgboost lightgbm
pip install requests beautifulsoup4 selenium
pip install schedule  # For automation
```

---

## 📈 **Step 2: Best Data Sources**

### **Free Data Sources:**

1. **NBA API (Official)** - Best for player/team stats
   ```python
   from nba_api.stats.endpoints import leaguegamefinder, playergamelog
   from nba_api.stats.static import teams, players
   ```
   - ✅ Official NBA data
   - ✅ Real-time stats
   - ✅ Historical data back to 1996
   - ⚠️ Rate limited (careful with requests)

2. **Basketball Reference** - Best for advanced metrics
   ```python
   import requests
   from bs4 import BeautifulSoup
   url = "https://www.basketball-reference.com/leagues/NBA_2024.html"
   ```
   - ✅ Advanced stats (PER, BPM, VORP)
   - ✅ Injury reports
   - ✅ Historical matchups
   - ⚠️ Requires web scraping

3. **ESPN API** - Best for current season
   ```python
   url = "http://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard"
   ```
   - ✅ Real-time scores
   - ✅ Betting odds
   - ✅ Injury status

### **Premium Data Sources (Paid):**

4. **Sportradar API** ($$$) - Most comprehensive
   - Real-time play-by-play
   - Advanced tracking data
   - Referee assignments

5. **SportsDataIO** ($$) - Good value
   - Player props history
   - Betting trends
   - Weather data (for outdoor games)

---

## 🤖 **Step 3: Features to Include**

### **For Game Predictions (Win/Loss/Spread):**

#### Basic Features (10):
- Home/Away win %
- Recent form (last 5-10 games)
- Points per game (offense)
- Points allowed (defense)
- Pace (possessions per game)
- Rest days since last game
- Home court advantage
- Head-to-head record
- Conference strength
- Current streak

#### Advanced Features (40+):
- **Team Stats:**
  - Offensive/Defensive Rating
  - True Shooting %
  - Effective FG %
  - Turnover Rate
  - Rebound Rate
  - Free Throw Rate
  - 3-Point Attempt Rate
  - Assist/Turnover Ratio

- **Situational:**
  - Back-to-back games
  - Travel distance
  - Time zone changes
  - Altitude (Denver effect)
  - Days rest differential
  - Injury impact (missing starters)
  - Recent trades
  - Playoff implications

- **Matchup Specific:**
  - Position matchup advantages
  - Defensive vs. offensive styles
  - Pace matchup
  - Historical performance vs opponent

- **Advanced Metrics:**
  - Net Rating (last 15 games)
  - SRS (Simple Rating System)
  - Expected Wins (Pythagorean)
  - Clutch performance (4th quarter)
  - Bench strength

### **For Player Props:**

#### Basic Features (8):
- Season average
- Last 5 games average
- Home vs. Away splits
- vs. Opponent average
- Minutes per game
- Usage rate
- Starting vs. bench
- Injury status

#### Advanced Features (30+):
- **Performance:**
  - Last 10 games trend
  - Month-by-month performance
  - Day of week splits
  - Time of season (early/mid/late)
  - Hot/cold streaks

- **Matchup:**
  - Opponent defensive ranking (vs. position)
  - Opponent pace
  - Historical vs. opponent
  - Opponent's recent form
  - Defensive player assignment

- **Context:**
  - Rest days
  - Back-to-back impact
  - Travel
  - Home/away/neutral
  - Altitude

- **Team Context:**
  - Team injuries (other players out)
  - Recent trades affecting role
  - Minutes restriction
  - Blowout likelihood
  - Playoff seeding importance

---

## 🧠 **Step 4: Machine Learning Models**

### **Recommended Models by Accuracy:**

1. **XGBoost** (Best Overall)
   ```python
   import xgboost as xgb

   model = xgb.XGBClassifier(
       n_estimators=1000,
       learning_rate=0.01,
       max_depth=6,
       subsample=0.8,
       colsample_bytree=0.8
   )
   ```
   - ✅ 65-70% accuracy on game outcomes
   - ✅ Handles feature interactions well
   - ✅ Fast training

2. **LightGBM** (Fastest)
   ```python
   import lightgbm as lgb

   model = lgb.LGBMClassifier(
       n_estimators=1000,
       learning_rate=0.01,
       num_leaves=31
   )
   ```
   - ✅ Very fast
   - ✅ Good with large datasets
   - ✅ Similar accuracy to XGBoost

3. **Neural Networks** (Most Complex)
   ```python
   from tensorflow import keras

   model = keras.Sequential([
       keras.layers.Dense(128, activation='relu'),
       keras.layers.Dropout(0.3),
       keras.layers.Dense(64, activation='relu'),
       keras.layers.Dense(3, activation='softmax')
   ])
   ```
   - ✅ Can capture complex patterns
   - ⚠️ Requires more data
   - ⚠️ Slower to train

### **Ensemble Approach (Best):**
Combine multiple models for best results:
```python
from sklearn.ensemble import VotingClassifier

ensemble = VotingClassifier(
    estimators=[
        ('xgb', xgb_model),
        ('lgb', lgb_model),
        ('rf', random_forest_model)
    ],
    voting='soft'  # Use probabilities
)
```

---

## 📅 **Step 5: Automated Daily Updates**

### **Option 1: Python Scheduler (Simple)**

Create `update_predictions.py`:
```python
import schedule
import time
from nba_predictor import main

def update_daily():
    print("Updating NBA predictions...")
    main()
    print("Predictions updated!")

# Run every day at 8 AM
schedule.every().day.at("08:00").do(update_daily)

while True:
    schedule.run_pending()
    time.sleep(60)
```

Run continuously:
```bash
python update_predictions.py
```

### **Option 2: Cron Job (Better)**

```bash
# Edit crontab
crontab -e

# Add this line (runs at 8 AM daily)
0 8 * * * cd /path/to/mpodds/ml_models && python nba_predictor.py --games --props
```

### **Option 3: GitHub Actions (Best)**

Create `.github/workflows/update-predictions.yml`:
```yaml
name: Update NBA Predictions

on:
  schedule:
    - cron: '0 8 * * *'  # 8 AM UTC daily
  workflow_dispatch:  # Manual trigger

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: '3.9'
      - run: |
          pip install -r ml_models/requirements.txt
          python ml_models/nba_predictor.py --games --props
      - name: Commit changes
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add src/nba_ml_predictions.json src/nba_player_prop_predictions.json
          git commit -m "Update NBA predictions" || exit 0
          git push
```

---

## 🎓 **Step 6: Model Training Best Practices**

### **Data Collection:**
```python
def collect_training_data(seasons=['2021-22', '2022-23', '2023-24']):
    """Collect historical data for training"""
    all_games = []

    for season in seasons:
        # Fetch all games
        games = fetch_season_games(season)

        # Add features
        for game in games:
            features = extract_features(game)
            all_games.append(features)

    return pd.DataFrame(all_games)
```

### **Train/Test Split:**
```python
from sklearn.model_selection import TimeSeriesSplit

# Use time series split (prevents data leakage)
tscv = TimeSeriesSplit(n_splits=5)

for train_idx, test_idx in tscv.split(X):
    X_train, X_test = X[train_idx], X[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]

    model.fit(X_train, y_train)
    accuracy = model.score(X_test, y_test)
    print(f"Accuracy: {accuracy}")
```

### **Feature Engineering:**
```python
def engineer_features(df):
    """Create advanced features"""

    # Rolling averages
    df['ppg_last_5'] = df.groupby('team')['points'].rolling(5).mean()
    df['ppg_last_10'] = df.groupby('team')['points'].rolling(10).mean()

    # Momentum
    df['win_streak'] = df.groupby('team')['win'].rolling(5).sum()

    # Rest advantage
    df['rest_advantage'] = df['rest_days'] - df['opp_rest_days']

    # Interaction features
    df['pace_x_efficiency'] = df['pace'] * df['offensive_rating']

    return df
```

### **Hyperparameter Tuning:**
```python
from sklearn.model_selection import GridSearchCV

param_grid = {
    'n_estimators': [500, 1000, 2000],
    'max_depth': [3, 5, 7],
    'learning_rate': [0.01, 0.05, 0.1],
    'subsample': [0.8, 0.9, 1.0]
}

grid_search = GridSearchCV(
    xgb.XGBClassifier(),
    param_grid,
    cv=5,
    scoring='accuracy',
    n_jobs=-1
)

grid_search.fit(X_train, y_train)
best_model = grid_search.best_estimator_
```

---

## 📊 **Step 7: Backtesting**

Test your model on historical data:

```python
def backtest_predictions(model, historical_games):
    """Test model accuracy on past games"""

    results = {
        'total_games': 0,
        'correct_predictions': 0,
        'ev_positive_bets': 0,
        'ev_positive_wins': 0,
        'roi': 0
    }

    for game in historical_games:
        # Get model prediction
        prediction = model.predict_proba(game['features'])[0]

        # Get actual outcome
        actual_winner = game['winner']

        # Get betting odds
        home_odds = game['home_odds']
        away_odds = game['away_odds']

        # Calculate EV
        home_ev = calculate_ev(prediction[0], home_odds)

        # Track results
        results['total_games'] += 1

        if prediction.argmax() == actual_winner:
            results['correct_predictions'] += 1

        # If we would have bet (positive EV)
        if home_ev > 0:
            results['ev_positive_bets'] += 1
            if actual_winner == 0:  # Home team won
                results['ev_positive_wins'] += 1
                results['roi'] += calculate_profit(home_odds)

    # Calculate metrics
    accuracy = results['correct_predictions'] / results['total_games']
    betting_accuracy = results['ev_positive_wins'] / max(results['ev_positive_bets'], 1)

    print(f"Overall Accuracy: {accuracy:.2%}")
    print(f"Betting Accuracy (EV > 0): {betting_accuracy:.2%}")
    print(f"ROI: {results['roi']:.2%}")

    return results
```

---

## 🔧 **Step 8: Quick Start Commands**

### **Initial Setup:**
```bash
cd ml_models
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### **Generate Predictions:**
```bash
# Generate all predictions
python nba_predictor.py

# Only game predictions
python nba_predictor.py --games

# Only player props
python nba_predictor.py --props

# Custom output directory
python nba_predictor.py --output ../src/
```

### **Train New Model:**
```bash
python train_model.py --seasons 2021-22 2022-23 2023-24
```

### **Backtest:**
```bash
python backtest.py --start-date 2024-01-01 --end-date 2024-03-01
```

---

## 📈 **Expected Improvements**

| Improvement | Expected Accuracy Gain |
|------------|----------------------|
| Real NBA API data | +5-8% |
| Add advanced features (20+) | +3-5% |
| XGBoost instead of simple stats | +5-7% |
| Matchup-specific adjustments | +2-3% |
| Injury impact modeling | +2-3% |
| Daily updates | +1-2% |
| Ensemble models | +1-2% |
| **TOTAL POTENTIAL** | **+19-30%** |

### **Realistic Targets:**
- **Game Winners**: 65-70% accuracy (vs. 55% baseline)
- **Spread Coverage**: 54-58% accuracy (vs. 50% random)
- **Player Props O/U**: 56-62% accuracy
- **Positive EV Bets**: 58-65% win rate

---

## 🚨 **Common Pitfalls to Avoid**

1. **Data Leakage** - Don't use future data to predict past
2. **Overfitting** - Model too complex for amount of data
3. **Not Accounting for Injuries** - Major impact on games
4. **Ignoring Rest Days** - Back-to-backs significantly affect performance
5. **Using Season Averages** - Recent form is more predictive
6. **Not Updating Daily** - Stale predictions lose accuracy
7. **Ignoring Line Movement** - Market wisdom is valuable
8. **Not Backtesting** - Can't improve what you don't measure

---

## 🎯 **Next Steps**

1. ✅ Run basic predictor: `python nba_predictor.py`
2. ✅ Set up daily automation (cron or GitHub Actions)
3. ✅ Start collecting historical data
4. ✅ Train XGBoost model
5. ✅ Add advanced features incrementally
6. ✅ Backtest and track accuracy
7. ✅ Iterate and improve

---

## 📚 **Resources**

- **NBA API Docs**: https://github.com/swar/nba_api
- **Basketball Reference**: https://www.basketball-reference.com/
- **XGBoost Tutorial**: https://xgboost.readthedocs.io/
- **Sports Betting ML Guide**: https://github.com/sports-betting-ml

---

## 💡 **Pro Tips**

1. **Start Simple** - Get basic version working first
2. **Track Everything** - Log all predictions and outcomes
3. **Iterate Quickly** - Small improvements compound
4. **Focus on EV** - Accuracy matters less than finding +EV bets
5. **Update Often** - NBA changes fast, update daily minimum
6. **Combine with Odds** - Your model + market odds = best results

---

**Good luck! 🍀 With these improvements, you can build one of the most accurate NBA prediction systems available!**
