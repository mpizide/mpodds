# 🤖 How to Update NBA ML Predictions for Today's Games

The robot icons (🤖) will only appear when the predictions in `nba_ml_predictions.json` match the EXACT team names and games from the live NBA API.

---

## 🔍 **Step 1: Check What Games Are Available**

1. Open your browser console (F12)
2. Go to http://localhost:3000/nba
3. Look for these console messages:
   ```
   🎯 NBA Games fetched: 5
   🤖 ML Predictions loaded: 15
   📋 Game: Portland Trail Blazers @ Minnesota Timberwolves (ID: abc123)
   ⚠️ No ML predictions for Portland Trail Blazers @ Minnesota Timberwolves, using implied odds
   ```

4. **Copy the exact team names** from the console (e.g., "Portland Trail Blazers", "Minnesota Timberwolves")

---

## ✏️ **Step 2: Update Predictions JSON Manually (Quick Fix)**

Edit `src/nba_ml_predictions.json` and add predictions for TODAY's games:

```json
[
  {
    "game_id": "any_unique_id",
    "gameday": "2024-10-23",
    "home_team": "Minnesota Timberwolves",
    "away_team": "Portland Trail Blazers",
    "home_win_prob": 62.5,
    "away_win_prob": 37.5,
    "home_spread_prob": 58.0,
    "away_spread_prob": 42.0,
    "over_prob": 51.5,
    "under_prob": 48.5
  }
]
```

**IMPORTANT**:
- Team names must match EXACTLY what the API returns
- Use the names from the console logs
- Update the gameday to today's date

---

## 🤖 **Step 3: Run the Python Predictor (Automated)**

### Quick Command:
```bash
cd ml_models
python nba_predictor.py
```

This will:
1. Fetch today's NBA games
2. Generate predictions for all games
3. Save to `src/nba_ml_predictions.json`
4. Automatically use correct team names

### Expected Output:
```
🏀 NBA ML Predictions Generator
==================================================

📊 Generating game predictions...
✅ Generated 10 game predictions
📁 Saved to: ../src/nba_ml_predictions.json

🎯 Generating player props predictions...
✅ Generated 15 player predictions
📁 Saved to: ../src/nba_player_prop_predictions.json

✨ Done! Predictions updated successfully.
```

---

## 🔄 **Step 4: Automate Daily Updates**

### Option 1: Cron Job (Linux/Mac)
```bash
crontab -e
# Add this line (runs at 8 AM daily):
0 8 * * * cd /path/to/mpodds/ml_models && python nba_predictor.py
```

### Option 2: Task Scheduler (Windows)
1. Open Task Scheduler
2. Create Basic Task
3. Trigger: Daily at 8:00 AM
4. Action: Start a Program
   - Program: `python`
   - Arguments: `nba_predictor.py`
   - Start in: `C:\path\to\mpodds\ml_models`

### Option 3: GitHub Actions
Create `.github/workflows/update-nba-predictions.yml`:
```yaml
name: Update NBA Predictions

on:
  schedule:
    - cron: '0 12 * * *'  # 12 PM UTC (8 AM EST) daily
  workflow_dispatch:  # Manual trigger

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
      - run: |
          pip install -r ml_models/requirements.txt
          python ml_models/nba_predictor.py
      - name: Commit
        run: |
          git config user.name "GitHub Action"
          git config user.email "action@github.com"
          git add src/nba_ml_predictions.json
          git commit -m "Update NBA predictions [skip ci]" || exit 0
          git push
```

---

## 🎯 **Step 5: Verify Robot Icons Appear**

After updating predictions:

1. **Refresh** the NBA page (Ctrl+R or Cmd+R)
2. **Check console** for:
   ```
   ✅ Using ML predictions for Portland Trail Blazers @ Minnesota Timberwolves
   ```
3. **Look for 🤖** icons next to prediction inputs
4. **Pick of Day** should now use ML predictions

---

## 🐛 **Troubleshooting**

### Robot icons still not showing?

#### Check 1: Team Names Match Exactly
```javascript
// Console shows:
📋 Game: Portland Trail Blazers @ Minnesota Timberwolves

// JSON must have:
"home_team": "Minnesota Timberwolves"  // ✅ Correct
"home_team": "Timberwolves"            // ❌ Wrong
"home_team": "MIN"                     // ❌ Wrong
```

#### Check 2: Predictions Loaded
```javascript
// Should see:
🤖 ML Predictions loaded: 10  // At least 1

// If you see:
🤖 ML Predictions loaded: 0   // No predictions loaded - check JSON file
```

#### Check 3: Games Within 2 Days
The NBA page only shows games in the next 2 days. Make sure your predictions are for upcoming games.

#### Check 4: JSON Valid
Validate your JSON at https://jsonlint.com/

---

## 📊 **Example: Complete Workflow**

### Morning of Game Day:

1. **Check games** (open console at /nba):
   ```
   📋 Game: Los Angeles Lakers @ Denver Nuggets
   📋 Game: Phoenix Suns @ Golden State Warriors
   ```

2. **Run predictor**:
   ```bash
   cd ml_models
   python nba_predictor.py
   ```

3. **Verify update**:
   ```bash
   cat ../src/nba_ml_predictions.json
   # Should see today's games
   ```

4. **Refresh browser**:
   - Go to http://localhost:3000/nba
   - See 🤖 icons
   - Pick of Day uses ML predictions

---

## 🎓 **Pro Tips**

1. **Update Before Games Start**
   - Run predictor in the morning (8-10 AM)
   - Games usually start at 7 PM ET

2. **Keep Historical Predictions**
   - Save old predictions for backtesting
   - Track accuracy over time

3. **Monitor Console Daily**
   - Check if predictions are matching
   - Fix team name mismatches

4. **Set Reminders**
   - Phone reminder at 8 AM to run predictor
   - Or automate with cron/GitHub Actions

---

## 🚀 **Quick Reference**

| Task | Command |
|------|---------|
| **Generate predictions** | `python ml_models/nba_predictor.py` |
| **Check console logs** | Open browser F12, go to /nba |
| **Validate JSON** | https://jsonlint.com/ |
| **View predictions** | `cat src/nba_ml_predictions.json` |

---

**After updating predictions, you should see 🤖 icons and the Pick of Day will use ML predictions!** 🏀🤖
