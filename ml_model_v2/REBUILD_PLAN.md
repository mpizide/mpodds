# NFL Player Props Model V2 - Rebuild Plan

## What Happened in This Session

### What We Accomplished:
1. ✅ Researched comprehensive data sources and features for NFL player props
2. ✅ Designed complete feature engineering pipeline with:
   - Snap count % (usage)
   - Target share
   - Red zone usage
   - Depth chart position
   - Opponent defense EPA
   - Game script (spread, implied totals)
   - Weather data
   - Injury impact
   - Usage trends
3. ✅ Created initial Python scripts for V2 model
4. ✅ Successfully collected NFL data (29MB in `data/` folder)
5. ✅ Installed all required dependencies (LightGBM, XGBoost, etc.)

### What Went Wrong:
- Unicode character replacement command corrupted 4 Python files (build_features.py, train_models.py, predict_props.py, collect_data.py)
- Files were reduced to 0 bytes when trying to replace checkmark symbols (✓) with [OK]
- The command used was: `python -c "import re; ...` which had issues with file writing

### Current State:
- ✅ Data collected successfully (all 9 data files in `data/` folder)
- ✅ collect_data.py restored and working
- ❌ build_features.py - needs recreation
- ❌ train_models.py - needs recreation
- ❌ predict_props.py - needs recreation
- ✅ README.md and requirements.txt intact

## Plan for Next Session

### Approach: Start Fresh with Lessons Learned

**Lesson Learned**: Don't use complex shell commands to modify files in-place. Use proper file editing.

### Steps for Clean Rebuild:

1. **Remove corrupted ml_model_v2 folder**
   ```bash
   cd C:\Users\piz44\OneDrive\Desktop\mpodds
   rm -rf ml_model_v2
   mkdir ml_model_v2
   ```

2. **Recreate files one at a time, testing each**
   - Create collect_data.py → test it
   - Create build_features.py → test it
   - Create train_models.py → test it
   - Create predict_props.py → test it

3. **Use proper Unicode handling from the start**
   - Save all .py files with UTF-8 encoding
   - Use `print("OK")` instead of `print("✓")`
   - Test imports after each file creation

4. **Run pipeline step by step**
   ```bash
   python collect_data.py   # Should load existing data fast
   python build_features.py # ~2 minutes
   python train_models.py   # ~15-20 minutes
   python predict_props.py  # ~1 minute
   ```

## What V2 Will Give You

### The Problem It Solves:
**Current Model Issue**: Doesn't know when a backup becomes a starter (Khalil Herbert problem)

**V2 Model Solution**:
- Knows depth chart changes (Herbert = RB1 now)
- Tracks snap count trends (30% → 70%)
- Detects teammate injuries (Foreman out = more touches)
- Weights recent games more (last 3 games > old average)
- Calculates touch share % (team opportunity)

### Expected Performance Improvement:
- Current MAE: ~15-20 yards
- V2 Expected MAE: ~12-15 yards
- Better predictions for role changes, injuries, and usage trends

## Key Features by Priority

### Must-Have Features (Tier 1):
1. **Snap count %** - Single most important feature
2. **Target share** - % of team's targets
3. **Depth chart position** - Who's actually starting
4. **Recent performance trends** - Last 3 games weighted more

### Important Features (Tier 2):
5. Red zone usage
6. Opponent defensive EPA
7. Game script (spread, totals)
8. Teammate injuries

### Nice-to-Have Features (Tier 3):
9. Weather data
10. Home/away splits
11. Rest days
12. NextGen Stats

## Files We Need to Recreate

### 1. build_features.py (~200 lines)
Core functionality:
- Load data from parquet files
- Merge snap counts (join on player name + team + week)
- Create rolling averages (L3, L5, season)
- Calculate target share
- Add opponent defense metrics
- Save engineered features

### 2. train_models.py (~150 lines)
Core functionality:
- Load engineered features
- Train 5 separate models (receiving yards, TDs, receptions, rushing, passing)
- Use LightGBM + XGBoost stacking
- Time series cross-validation
- Save models to disk

### 3. predict_props.py (~120 lines)
Core functionality:
- Load trained models
- Fetch current week data
- Engineer features for current week
- Generate predictions
- Save to `../src/nfl_player_prop_predictions.json`

## Alternative: Incremental Enhancement

Instead of full rebuild, we could add features incrementally to your existing `ml_model/` system:

1. Add snap count data collection
2. Add target share calculation
3. Retrain existing models with new features
4. Test improvement
5. Repeat

This is safer but less comprehensive than V2.

## Resources Created

All research and documentation is saved:
- Comprehensive feature engineering guide (in conversation)
- Data source documentation (nfl_data_py capabilities)
- Model architecture recommendations (LightGBM + XGBoost)
- Feature importance rankings

## Next Session Checklist

- [ ] Decide: Full V2 rebuild or incremental enhancement?
- [ ] If V2: Recreate 3 Python files one at a time
- [ ] Test each file before moving to next
- [ ] Run full pipeline
- [ ] Validate predictions look reasonable
- [ ] Compare V2 predictions to V1 predictions
- [ ] Update React app to use new predictions

## Contact Info

All code and research from this session is preserved in conversation history.
Ready to continue in next session!
