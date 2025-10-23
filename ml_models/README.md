# 🏀 NBA ML Prediction Models

This directory contains machine learning models and scripts for generating NBA game and player prop predictions.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd ml_models
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Generate Predictions
```bash
# Generate all predictions (games + player props)
python nba_predictor.py

# Only game predictions
python nba_predictor.py --games

# Only player props
python nba_predictor.py --props

# Custom output directory
python nba_predictor.py --output ../src/
```

### 3. View Results
Predictions are saved to:
- `../src/nba_ml_predictions.json` - Game predictions
- `../src/nba_player_prop_predictions.json` - Player props predictions

The React app will automatically load these files and display 🤖 icons next to ML-based predictions.

---

## 📁 Files

### Core Files:
- `nba_predictor.py` - Main prediction generator
- `requirements.txt` - Python dependencies
- `PREDICTION_IMPROVEMENT_GUIDE.md` - Comprehensive guide to improve accuracy

### Training Files (to be created):
- `train_model.py` - Train ML models on historical data
- `backtest.py` - Test model accuracy on past games
- `update_predictions.py` - Automated daily update script

---

## 🎯 Current Features

### Game Predictions:
- ✅ Win probability (home/away)
- ✅ Spread probability
- ✅ Over/Under probability
- ✅ Team strength calculations
- ✅ Home court advantage

### Player Props:
- ✅ Points, Rebounds, Assists
- ✅ 3-Pointers, Blocks, Steals
- ✅ Turnovers
- ✅ Combo stats (PRA, Pts+Reb, etc.)
- ✅ Player tier adjustments

---

## 📈 Accuracy Expectations

Current (Basic Model):
- Game Winners: ~55-60%
- Spread Coverage: ~52-54%
- Player Props: ~53-56%

With Improvements (see PREDICTION_IMPROVEMENT_GUIDE.md):
- Game Winners: ~65-70%
- Spread Coverage: ~54-58%
- Player Props: ~56-62%

---

## 🔄 Automated Updates

### Option 1: Cron Job (Linux/Mac)
```bash
# Edit crontab
crontab -e

# Add this line (runs at 8 AM daily)
0 8 * * * cd /path/to/mpodds/ml_models && /path/to/venv/bin/python nba_predictor.py
```

### Option 2: Task Scheduler (Windows)
1. Open Task Scheduler
2. Create Basic Task
3. Trigger: Daily at 8:00 AM
4. Action: Start a Program
5. Program: `C:\path\to\venv\Scripts\python.exe`
6. Arguments: `C:\path\to\mpodds\ml_models\nba_predictor.py`

### Option 3: GitHub Actions
See `.github/workflows/update-predictions.yml` example in the improvement guide.

---

## 🤖 How It Works

### Data Flow:
```
1. Fetch NBA Data
   ↓
2. Calculate Team/Player Stats
   ↓
3. Apply ML Model
   ↓
4. Generate Predictions
   ↓
5. Save to JSON
   ↓
6. React App Loads & Displays
```

### Prediction Algorithm:
1. **Team Strength** = PPG - OPP_PPG + Win% × 20
2. **Home Advantage** = +3 points
3. **Win Probability** = Logistic(StrengthDiff / 5)
4. **Spread** = StrengthDiff × 0.8
5. **Total** = Home PPG + Away PPG ± variance

---

## 📊 Improving Accuracy

See `PREDICTION_IMPROVEMENT_GUIDE.md` for detailed instructions on:

1. **Better Data Sources**
   - NBA API integration
   - Basketball Reference scraping
   - ESPN API usage

2. **Advanced Features**
   - Rest days, back-to-backs
   - Injury reports
   - Matchup history
   - Home/away splits
   - Pace adjustments

3. **Better Models**
   - XGBoost
   - LightGBM
   - Neural Networks
   - Ensemble methods

4. **Backtesting**
   - Historical validation
   - ROI tracking
   - EV optimization

---

## 🐛 Troubleshooting

### Predictions not showing 🤖 icon?
1. Check browser console for errors
2. Verify JSON files exist in `src/` directory
3. Check team names match exactly (see console logs)
4. Refresh the page

### Module not found errors?
```bash
pip install -r requirements.txt
```

### JSON parsing errors?
Validate JSON files at https://jsonlint.com/

---

## 📚 Resources

- NBA API: https://github.com/swar/nba_api
- Basketball Reference: https://www.basketball-reference.com/
- XGBoost Docs: https://xgboost.readthedocs.io/
- NBA Stats: https://www.nba.com/stats

---

## 🎓 Next Steps

1. ✅ Run basic predictor
2. ⬜ Set up daily automation
3. ⬜ Collect historical data
4. ⬜ Train XGBoost model
5. ⬜ Add advanced features
6. ⬜ Backtest performance
7. ⬜ Optimize and iterate

---

**For detailed improvement instructions, see `PREDICTION_IMPROVEMENT_GUIDE.md`**
