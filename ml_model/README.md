# NFL Prediction ML Model

Machine learning model for predicting NFL game outcomes and win probabilities.

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

## Running the Model

### Step 1: Collect Historical Data
```bash
python ml_model/data_collection.py
```
This fetches 5 seasons of NFL data (2019-2024) including:
- Game schedules and scores
- Weekly team statistics
- Roster data
- Seasonal statistics

### Step 2: Engineer Features
```bash
python ml_model/feature_engineering.py
```
Creates training dataset with features like:
- Rolling points per game (last 5 games)
- Points allowed per game
- Point differential
- Home/away indicators
- Divisional game flags

### Step 3: Train Model
```bash
python ml_model/train_model.py
```
Trains multiple models (Logistic Regression, Random Forest, XGBoost) and selects the best one.
Uses time-series cross-validation to prevent data leakage.

### Step 4: Generate Predictions
```bash
python ml_model/predict_upcoming.py
```
Generates predictions for upcoming games in the next 14 days.
Outputs to:
- `ml_model/data/upcoming_predictions.csv`
- `ml_model/data/upcoming_predictions.json`

## Model Features

The model uses these features for prediction:
- `home_rolling_ppg` - Home team points per game (last 5)
- `home_rolling_papg` - Home team points allowed per game (last 5)
- `home_rolling_diff` - Home team point differential (last 5)
- `away_rolling_ppg` - Away team points per game (last 5)
- `away_rolling_papg` - Away team points allowed per game (last 5)
- `away_rolling_diff` - Away team point differential (last 5)
- `ppg_differential` - Offensive matchup (home PPG - away PPG)
- `papg_differential` - Defensive matchup (home PAPG - away PAPG)
- `overall_differential` - Overall team strength differential
- `home_advantage` - Home field advantage (always 1)
- `week` - Week number in season
- `is_divisional` - Whether it's a division game

## Integration with React App

Load predictions in your React app:

```javascript
import predictions from './ml_model/data/upcoming_predictions.json';

// Auto-fill predictions for each game
predictions.forEach(pred => {
  const gameId = pred.game_id;
  setPredictions(prev => ({
    ...prev,
    [gameId]: {
      [`${pred.home_team}_ml`]: pred.home_win_prob,
      [`${pred.away_team}_ml`]: pred.away_win_prob
    }
  }));
});
```

## Updating Predictions

Run these scripts weekly to keep predictions fresh:

```bash
# Update data and regenerate predictions
python ml_model/data_collection.py
python ml_model/feature_engineering.py
python ml_model/train_model.py
python ml_model/predict_upcoming.py
```

## Model Performance

The model is validated using time-series cross-validation to ensure no future data leakage.
Typical performance metrics:
- Accuracy: 60-65% (beating the spread baseline)
- AUC: 0.65-0.70

**Important:** Always compare model predictions against closing lines to validate positive expected value!

## Future Improvements

1. Add more features:
   - Weather data (temperature, wind, precipitation)
   - Injury reports for key players
   - Rest days between games
   - Quarterback ratings
   - Advanced metrics (EPA, DVOA, success rate)

2. Improve model:
   - Separate models for spread and totals
   - Neural networks with more historical data
   - Ensemble methods combining multiple models

3. Validation:
   - Track CLV (Closing Line Value)
   - Calculate ROI over time
   - Compare against Vegas lines
