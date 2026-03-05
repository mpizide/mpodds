# How to Add New Features - Easy Guide

## ✅ System is NOW Set Up for Easy Feature Addition!

You can now add new trends/features **without touching the main code**. Everything goes in [cbb_custom_features.py](cbb_custom_features.py).

## 📝 How to Add a New Feature (3 Steps)

### **Step 1: Write Your Feature Function**

Open [cbb_custom_features.py](cbb_custom_features.py) and add your function at the bottom:

```python
def calculate_your_feature(home_team, away_team, game):
    """
    Your custom logic here
    """
    # Example: Check if it's a rivalry game
    rivalries = {
        'Duke': ['North Carolina'],
        'Kansas': ['Missouri'],
        'Kentucky': ['Louisville'],
    }

    is_rivalry = (
        away_team in rivalries.get(home_team, []) or
        home_team in rivalries.get(away_team, [])
    )

    return 1 if is_rivalry else 0
```

### **Step 2: Add to calculate_custom_features()**

In the same file, scroll to `calculate_custom_features()` and add your feature:

```python
def calculate_custom_features(game, home_team_games, away_team_games, home_team, away_team):
    # ... existing code ...

    features = {
        # ... existing features ...

        # YOUR NEW FEATURE HERE!
        'is_rivalry_game': calculate_your_feature(home_team, away_team, game),
    }

    return features
```

### **Step 3: Re-Run Everything**

```bash
python ml_cbb\cbb_feature_engineering.py  # Adds feature to training data
python ml_cbb\cbb_train_models.py         # Model learns from new feature
python ml_cbb\cbb_discover_trends.py      # See if it matters!
```

Done! The model will automatically:
- Detect your new feature
- Learn how important it is
- Use it in predictions

---

## 📊 Examples of Features You Can Add

### **Example 1: Referee Tendencies**

```python
def calculate_referee_bias(referee_name):
    """Some refs call more fouls = lower scoring games"""
    high_foul_refs = ['John Higgins', 'Ted Valentine']
    return 1 if referee_name in high_foul_refs else 0
```

### **Example 2: Star Player Out**

```python
def check_injury_impact(team, date):
    """Major injury hurts team performance"""
    injuries = {
        'Duke': {'player': 'Filipowski', 'dates': ['2025-02-10', '2025-02-15']},
    }

    team_injuries = injuries.get(team, {})
    if date in team_injuries.get('dates', []):
        return -5  # 5 point penalty
    return 0
```

### **Example 3: Coaching Changes**

```python
def check_coaching_change(team, season):
    """New coach = adjustment period"""
    coaching_changes = {
        'Louisville': 2025,
        'Stanford': 2025,
    }

    return 1 if coaching_changes.get(team) == season else 0
```

### **Example 4: Tournament Seeding Pressure**

```python
def calculate_tournament_pressure(team, date, season_progress):
    """Late season games matter more for tournament resume"""
    if season_progress < 20:
        return 0

    # Teams on bubble play harder in late games
    bubble_teams = ['Virginia', 'Texas A&M', 'Michigan State']

    return 2 if team in bubble_teams else 1  # 2x pressure for bubble teams
```

---

## 🤖 Automatic Feature Discovery

The system **automatically discovers trends** you haven't thought of!

Run this after training:

```bash
python ml_cbb\cbb_discover_trends.py
```

It will show:
- ✓ Which features matter most
- ✓ Surprising correlations
- ✓ Conditional trends (e.g., "travel matters MORE when tired")
- ✓ Recommendations for new features

---

## 🔥 Travel & Rest Features (Already Added!)

These are **already implemented** in the system:

| Feature | What It Tracks |
|---------|---------------|
| `travel_distance` | Miles away team traveled |
| `is_flight_game` | Game requires flight (>500 mi) |
| `is_long_flight` | Cross-country trip (>1500 mi) |
| `away_travel_miles_7days` | Cumulative travel last week |
| `away_flight_trips_7days` | Number of flights last week |
| `home_rest_days` | Days since last game (home) |
| `away_rest_days` | Days since last game (away) |
| `rest_advantage` | Rest differential |
| `is_back_to_back` | Playing 2 days in a row |
| `altitude_advantage` | Home team at high elevation |

---

## ⚡ Feature Interactions (Auto-Generated!)

The system **automatically creates** interaction features:

- `travel_x_fatigue` = Travel matters MORE when team is tired
- `momentum_x_conference` = Momentum matters MORE in conference games
- `conf_strength_x_neutral` = Conference gap matters MORE on neutral courts

These help the model discover **non-obvious patterns**.

---

## 📈 Tracking Feature Impact

After adding a feature, check its importance:

```bash
# Train models
python ml_cbb\cbb_train_models.py

# See what the model learned
python ml_cbb\cbb_discover_trends.py
```

Look for your feature in the "Top 20 Most Important Features" list!

---

## 💡 Pro Tips

1. **Start Simple**: Add one feature at a time
2. **Test Impact**: Use `cbb_discover_trends.py` to see if it matters
3. **Remove Low-Impact**: If a feature doesn't help, remove it
4. **Combine Features**: Travel + Rest might be more powerful than either alone
5. **Use Real Data**: Don't guess - use actual stats when possible

---

## 🚨 Common Mistakes to Avoid

❌ **Don't hardcode dates** - Use dynamic calculations
```python
# BAD
is_march = (date == '2025-03-15')

# GOOD
is_march = (date.month == 3)
```

❌ **Don't use future information** - Only use data available BEFORE the game
```python
# BAD - uses final score
won_last_game = (team_score > opponent_score)

# GOOD - uses date
won_last_game = check_result_before_date(team, date)
```

❌ **Don't over-complicate** - Simple features often work best
```python
# BAD - too complex
score = (ppg * 0.3 + opp_ppg * 0.2 - travel * 0.1) / (rest_days + 1) ** 0.5

# GOOD - let the model learn the relationship
features = {'ppg': ppg, 'opp_ppg': opp_ppg, 'travel': travel, 'rest_days': rest_days}
```

---

## 📁 File Reference

| File | Purpose |
|------|---------|
| `cbb_custom_features.py` | **← ADD YOUR FEATURES HERE** |
| `cbb_feature_engineering.py` | Runs automatically, includes your features |
| `cbb_train_models.py` | Auto-detects all features |
| `cbb_discover_trends.py` | Shows what model learned |
| `feature_importance.csv` | Detailed feature rankings |

---

## 🎯 Quick Start Checklist

- [x] System set up for easy feature addition
- [x] Travel/rest features included
- [x] Automatic feature detection working
- [x] Trend discovery tool ready

**To add your first custom feature:**

1. Open `cbb_custom_features.py`
2. Find the "ADD YOUR CUSTOM FEATURES" section
3. Write your function
4. Add it to the `features` dict
5. Re-run: `python ml_cbb\cbb_feature_engineering.py`
6. Check impact: `python ml_cbb\cbb_discover_trends.py`

---

**The system is now FULLY AUTOMATED and EASY TO EXTEND! 🚀**

Just add features to `cbb_custom_features.py` and the model will automatically:
- ✓ Use them in training
- ✓ Rank their importance
- ✓ Discover how they interact
- ✓ Tell you if they matter

Happy feature engineering! 🏀
