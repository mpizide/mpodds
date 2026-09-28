# MLB Prediction ML Model

Predicts MLB moneyline, run line and totals. Same structure as the NFL model (`ml_model/`): collect data → engineer features → train → predict. There's one extra step: the model is tested against real closing betting lines, and the site uses whichever source proved most accurate. All data is free (MLB Stats API, Baseball Savant, SportsBookReview), so no API keys are needed.

## Setup

```bash
pip install -r ml_mlb/requirements.txt
```

## Daily use

```bash
python ml_mlb/mlb_predict_upcoming.py
```

This refreshes the current season, pulls the next 3 days of games with their probable pitchers, and writes `src/mlb_ml_predictions.json` for the MLB page. Run it every day, because probable pitchers change. The page header warns when the file is more than a day old.

## Full rebuild (first time, or to retrain)

```bash
python ml_mlb/mlb_data_collection.py      # 2020-now: games, starter + team game logs, Savant xERA (~2 min)
python ml_mlb/mlb_feature_engineering.py  # builds data/training_data.csv
python ml_mlb/mlb_train_models.py         # trains + picks the best models, saves out-of-fold predictions
python ml_mlb/mlb_odds_collection.py      # historical closing lines 2022-now (~10 min, cached per date)
python ml_mlb/mlb_evaluate_blend.py       # model vs market vs blend -> mlb_blend.json
python ml_mlb/mlb_predict_upcoming.py
```

## How it works

- **Point-in-time features (52):** each game's features use only games completed before it. They cover the starting pitcher (FIP, ERA, K%, BB%, HR/9, innings per start, prior-season Savant xERA), team win %, run differential, runs scored/allowed, last-10 form, OBP/SLG, last-15 OPS, bullpen ERA, rest days, park run factor, playoff flag, day/night and season progress. Current-season stats are blended with last season and shrunk toward league average.
- **Models:** a win-probability classifier, plus run-differential and total-runs regressors. Each tries Logistic/Ridge, Random Forest and XGBoost with time-series cross-validation and keeps the best.
- **Run line and totals:** probabilities come from the model's real out-of-sample errors. Games can't end tied, and whole-number totals can push.
- **TBD starters:** the game is predicted once with each of the team's last 5 starters, and the results are averaged.

## Model vs market (`mlb_evaluate_blend.py`)

This compares three options on real closing lines, walk-forward by season, so every score is out of sample:

| Moneyline (9,823 games, 2023-2026) | Log loss |
|---|---|
| Model | 0.6810 |
| **Market consensus (no-vig)** | **0.6768** |
| Model + market blend (logistic stack) | 0.6770 |

| Totals (9,514 games) | Log loss |
|---|---|
| Model | 0.7004 |
| **Market consensus** | **0.6926** |
| Blend | 0.6933 |

The market was more accurate in every season. A Benter-style model that starts from the market line and learns corrections from all 52 features was also worse out of sample (0.6774 at best). The site therefore uses **market consensus probabilities**, so positive EV means a book is offering a better price than the fair consensus (line shopping). The model's projected score and win probability are still shown for context. If a future retrain beats the market, `mlb_blend.json` switches automatically and the site follows.
