# Advanced NFL Player Props Prediction Model V2

Complete rebuild of the NFL player props model with advanced features and LightGBM + XGBoost stacking.

## Key Improvements Over V1

### 1. **Advanced Features**
- ✅ Snap count percentage (usage)
- ✅ Target share and touch share
- ✅ Red zone usage (targets/carries inside 20)
- ✅ Depth chart position & changes
- ✅ Teammate injury impact
- ✅ Opponent defensive EPA by position
- ✅ Game script (spread, implied totals)
- ✅ Weather data (temperature, wind)
- ✅ Rest days (short/long rest)
- ✅ Usage trends (exponential weighted moving avg)
- ✅ Home/away splits
- ✅ NextGen Stats (separation, air yards, etc.)

### 2. **Better Models**
- **LightGBM + XGBoost Stacking** (vs old Random Forest)
- **Separate models per prop type** (yards vs TDs vs receptions)
- **Time series cross-validation** (prevents data leakage)
- **Expected MAE improvement**: 12-15 yards (vs 15-20 in old model)

### 3. **Prop-Specific Models**
Each prop type has its own optimized model:
- Receiving Yards (emphasizes usage, opponent defense)
- Receiving TDs (emphasizes red zone usage)
- Receptions (emphasizes targets, game script)
- Rushing Yards (emphasizes game script, opponent rush defense)
- Passing Yards (emphasizes spread, weather)

## Installation

```bash
cd ml_model_v2
pip install -r requirements.txt
```

## Usage

### Step 1: Collect Data
```bash
python collect_data.py
```
Fetches comprehensive NFL data:
- Weekly player stats
- Snap counts
- Injuries
- Depth charts
- Play-by-play (for opponent defense)
- Schedules (for spreads, weather)
- NextGen Stats

**Time**: ~5-10 minutes first run, instant if loading cached data

### Step 2: Engineer Features
```bash
python build_features.py
```
Creates all advanced features from collected data.

**Output**: `data/features_engineered.parquet` (ready for training)

### Step 3: Train Models
```bash
python train_models.py
```
Trains 5 separate stacking ensembles:
1. Receiving Yards Model
2. Receiving TDs Model
3. Receptions Model
4. Rushing Yards Model
5. Passing Yards Model

**Time**: ~10-20 minutes
**Output**: `models/` directory with all trained models

### Step 4: Generate Predictions
```bash
python predict_props.py
```
Generates predictions for upcoming week.

**Output**: `../src/nfl_player_prop_predictions.json` (for React app)

## Quick Start (All Steps)

```bash
# First time setup
python collect_data.py  # Choose option 2 to collect fresh data
python build_features.py
python train_models.py

# Weekly predictions (fast)
python predict_props.py
```

## Model Performance

Expected performance on cross-validation:

| Prop Type | MAE | RMSE | R² |
|-----------|-----|------|-----|
| Receiving Yards | ~12-15 yards | ~20-25 yards | ~0.35-0.45 |
| Receiving TDs | ~0.3-0.4 TDs | ~0.5-0.6 TDs | ~0.20-0.30 |
| Receptions | ~1.5-2.0 catches | ~2.5-3.0 catches | ~0.40-0.50 |
| Rushing Yards | ~15-20 yards | ~25-30 yards | ~0.30-0.40 |
| Passing Yards | ~30-40 yards | ~45-55 yards | ~0.40-0.50 |

## Key Features by Prop Type

### Receiving Yards
1. Target share (L3 games)
2. Snap count %
3. Opponent pass defense EPA
4. Implied team total
5. Recent yardage (L3, L5)
6. Red zone targets
7. Depth chart position
8. Wind speed

### Receiving TDs
1. Red zone target share
2. Implied team total (scoring environment)
3. Target share
4. Snap count %
5. Historical TD rate
6. Depth chart position

### Receptions
1. Targets (L3, L5)
2. Target share
3. Completion % allowed by opponent
4. Game script (spread)
5. Snap count %

## How This Solves the "Khalil Herbert Problem"

**Old Model Issue**: Predicted low usage because Herbert historically was a backup.

**New Model Solution**:
1. **Depth Chart Position**: Knows Herbert moved to #1 on depth chart
2. **Snap Count Trends**: Detects recent snap % increase
3. **Teammate Injuries**: Knows D'Onta Foreman is out
4. **Usage Trends**: Exponential weighted average prioritizes recent games
5. **Touch Share**: Calculates % of team's touches going to Herbert

Result: Model accurately predicts increased usage for new starters.

## Files Structure

```
ml_model_v2/
├── collect_data.py          # Data collection from nfl_data_py
├── build_features.py        # Feature engineering pipeline
├── train_models.py          # Model training (stacking ensembles)
├── predict_props.py         # Generate weekly predictions
├── requirements.txt         # Python dependencies
├── README.md               # This file
├── data/                   # Cached data (gitignored)
│   ├── weekly_stats.parquet
│   ├── snap_counts.parquet
│   ├── injuries.parquet
│   └── features_engineered.parquet
└── models/                 # Trained models (gitignored)
    ├── receiving_yards_model.pkl
    ├── receiving_yards_features.pkl
    ├── receiving_tds_model.pkl
    ├── receptions_model.pkl
    ├── rushing_yards_model.pkl
    └── passing_yards_model.pkl
```

## Retraining Schedule

Retrain models:
- **Weekly**: Just run `predict_props.py` (uses existing models)
- **Monthly**: Run `train_models.py` to update with new data
- **Yearly**: Full rebuild including `collect_data.py`

## Troubleshooting

**Q: "No data found" error**
A: Run `python collect_data.py` first to download data

**Q: Model predictions seem off**
A: Retrain models with latest data: `python train_models.py`

**Q: Missing features error**
A: Run `python build_features.py` to regenerate features

**Q: Slow data collection**
A: Use cached data (option 1) when running `collect_data.py`

## Next Steps / Future Improvements

1. **Add betting line integration** - Compare predictions to market
2. **Injury impact quantification** - Learn historical impact patterns
3. **Neural network ensemble** - Add LSTM for sequence modeling
4. **Hyperparameter tuning** - Optimize with Optuna
5. **Live odds monitoring** - Auto-update when lines move
6. **Backtest framework** - Track prediction accuracy vs actual results

## Credits

Data source: [nfl_data_py](https://github.com/nflverse/nfl_data_py) (nflverse project)
Models: LightGBM, XGBoost, scikit-learn
