"""
Advanced NFL Player Props Model - Data Collection
Collects all necessary data for comprehensive feature engineering
"""

import pandas as pd
import numpy as np
import nfl_data_py as nfl
import os
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

def collect_all_data(seasons=[2020, 2021, 2022, 2023, 2024]):
    """
    Collect comprehensive NFL data from all sources
    """
    print("=" * 80)
    print("COLLECTING COMPREHENSIVE NFL DATA")
    print("=" * 80)

    data = {}

    # 1. Core Weekly Stats
    print("\n[1/9] Fetching weekly player stats...")
    try:
        data['weekly_stats'] = nfl.import_weekly_data(seasons)
        print(f"  [OK] Loaded {len(data['weekly_stats'])} player-week records")
    except Exception as e:
        print(f"  [ERROR] {e}")
        data['weekly_stats'] = pd.DataFrame()

    # 2. Seasonal Stats (includes target share!)
    print("\n[2/9] Fetching seasonal stats with target share...")
    try:
        data['seasonal_stats'] = nfl.import_seasonal_data(seasons, s_type='REG')
        print(f"  [OK] Loaded {len(data['seasonal_stats'])} player-season records")
        if 'tgt_sh' in data['seasonal_stats'].columns:
            print("  [OK] Target share data available")
    except Exception as e:
        print(f"  [ERROR] {e}")
        data['seasonal_stats'] = pd.DataFrame()

    # 3. Snap Counts (CRITICAL)
    print("\n[3/9] Fetching snap counts...")
    try:
        data['snap_counts'] = nfl.import_snap_counts(seasons)
        print(f"  [OK] Loaded {len(data['snap_counts'])} snap count records")
    except Exception as e:
        print(f"  [ERROR] {e}")
        data['snap_counts'] = pd.DataFrame()

    # 4. Injuries
    print("\n[4/9] Fetching injury reports...")
    try:
        data['injuries'] = nfl.import_injuries(seasons)
        print(f"  [OK] Loaded {len(data['injuries'])} injury records")
    except Exception as e:
        print(f"  [ERROR] {e}")
        data['injuries'] = pd.DataFrame()

    # 5. Depth Charts
    print("\n[5/9] Fetching depth charts...")
    try:
        data['depth_charts'] = nfl.import_depth_charts(seasons)
        print(f"  [OK] Loaded {len(data['depth_charts'])} depth chart records")
    except Exception as e:
        print(f"  [ERROR] {e}")
        data['depth_charts'] = pd.DataFrame()

    # 6. Rosters
    print("\n[6/9] Fetching rosters...")
    try:
        data['rosters'] = nfl.import_seasonal_rosters(seasons)
        print(f"  [OK] Loaded {len(data['rosters'])} roster records")
    except Exception as e:
        print(f"  [ERROR] {e}")
        data['rosters'] = pd.DataFrame()

    # 7. Play-by-Play (for advanced metrics)
    print("\n[7/9] Fetching play-by-play data (this may take a few minutes)...")
    try:
        # Only load essential columns to save memory
        columns = [
            'play_id', 'game_id', 'season', 'week', 'posteam', 'defteam',
            'pass', 'rush', 'play_type', 'yards_gained', 'touchdown',
            'epa', 'success', 'yardline_100',
            'passer_id', 'passer', 'receiver_id', 'receiver', 'rusher_id', 'rusher',
            'complete_pass', 'air_yards', 'yards_after_catch'
        ]
        data['pbp'] = nfl.import_pbp_data(seasons, columns=columns)
        print(f"  [OK] Loaded {len(data['pbp'])} plays")
    except Exception as e:
        print(f"  [ERROR] {e}")
        data['pbp'] = pd.DataFrame()

    # 8. Schedules (for spreads, totals, weather)
    print("\n[8/9] Fetching game schedules...")
    try:
        data['schedules'] = nfl.import_schedules(seasons)
        print(f"  [OK] Loaded {len(data['schedules'])} games")
    except Exception as e:
        print(f"  [ERROR] {e}")
        data['schedules'] = pd.DataFrame()

    # 9. NextGen Stats (optional - rich receiving data)
    print("\n[9/9] Fetching NextGen Stats (receiving)...")
    try:
        data['ngs_receiving'] = nfl.import_ngs_data('receiving', seasons)
        print(f"  [OK] Loaded {len(data['ngs_receiving'])} NGS receiving records")
    except Exception as e:
        print(f"  [ERROR] {e}")
        data['ngs_receiving'] = pd.DataFrame()

    return data


def save_data(data, output_dir='data'):
    """
    Save collected data to disk for faster reloading
    """
    os.makedirs(output_dir, exist_ok=True)

    print("\n" + "=" * 80)
    print("SAVING DATA TO DISK")
    print("=" * 80)

    for name, df in data.items():
        if not df.empty:
            filepath = os.path.join(output_dir, f'{name}.parquet')
            df.to_parquet(filepath, index=False)
            size_mb = os.path.getsize(filepath) / (1024 * 1024)
            print(f"  [OK] Saved {name}: {len(df)} rows, {size_mb:.2f} MB")

    print(f"\n[OK] All data saved to '{output_dir}/' directory")


def load_data(data_dir='data'):
    """
    Load previously saved data
    """
    print("Loading data from disk...")
    data = {}

    for filename in os.listdir(data_dir):
        if filename.endswith('.parquet'):
            name = filename.replace('.parquet', '')
            filepath = os.path.join(data_dir, filename)
            data[name] = pd.read_parquet(filepath)
            print(f"  [OK] Loaded {name}: {len(data[name])} rows")

    return data


def get_data_summary(data):
    """
    Print summary statistics of collected data
    """
    print("\n" + "=" * 80)
    print("DATA SUMMARY")
    print("=" * 80)

    for name, df in data.items():
        if not df.empty:
            print(f"\n{name.upper()}:")
            print(f"  Rows: {len(df):,}")
            print(f"  Columns: {len(df.columns)}")

            # Show seasons covered
            if 'season' in df.columns:
                seasons = sorted(df['season'].unique())
                print(f"  Seasons: {seasons}")

            # Show key columns
            if name == 'weekly_stats':
                key_cols = ['player_id', 'player_display_name', 'position', 'targets', 'receiving_yards']
                print(f"  Key columns: {[c for c in key_cols if c in df.columns]}")
            elif name == 'snap_counts':
                key_cols = ['player', 'offense_pct', 'defense_pct']
                print(f"  Key columns: {[c for c in key_cols if c in df.columns]}")


if __name__ == "__main__":
    print("Advanced NFL Player Props Model")
    print("Data Collection Module")
    print("=" * 80)

    # Check if data already exists
    if os.path.exists('data') and len(os.listdir('data')) > 0:
        print("\nFound existing data. Options:")
        print("1. Load existing data (fast)")
        print("2. Re-collect fresh data (slow, ~5-10 minutes)")

        choice = input("\nEnter choice (1 or 2): ").strip()

        if choice == '1':
            data = load_data('data')
        else:
            data = collect_all_data()
            save_data(data)
    else:
        # Collect fresh data
        data = collect_all_data()
        save_data(data)

    # Show summary
    get_data_summary(data)

    print("\n" + "=" * 80)
    print("DATA COLLECTION COMPLETE")
    print("=" * 80)
    print("\nNext step: Run 'python build_features.py' to engineer features")
