"""
MLB Data Collection
Fetches historical game data from the free MLB Stats API and Baseball Savant

Outputs (ml_mlb/data/):
  - games.csv          every game with scores, probable/actual starting pitchers, venue
  - pitcher_logs.csv   game-by-game lines for every starting pitcher
  - team_logs.csv      game-by-game team hitting + pitching
  - savant_xera.csv    season xERA for every pitcher (used as a prior-season feature)

Usage:
  python ml_mlb/mlb_data_collection.py                 # all seasons (first run, ~5 min)
  python ml_mlb/mlb_data_collection.py --seasons 2026  # refresh just the current season
"""

import argparse
import io
import os
import sys
import time
from datetime import datetime

import pandas as pd
import requests

# Windows consoles default to cp1252; make status symbols printable
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

STATS_API = 'https://statsapi.mlb.com/api/v1'
SAVANT = 'https://baseballsavant.mlb.com/leaderboard'
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')

# 2020 (60-game season) is only collected as "previous season" context for 2021
ALL_SEASONS = list(range(2020, datetime.now().year + 1))
GAME_TYPES = 'R,F,D,L,W'  # regular season + all postseason rounds
FINAL_STATES = {'Final', 'Game Over', 'Completed Early'}

# The 30 MLB clubs (placeholder ids like "NL Wild Card Winner" are dropped)
MLB_TEAM_IDS = {108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 133,
                134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 158}

session = requests.Session()


def get_json(url, params=None, retries=3):
    for attempt in range(retries):
        try:
            response = session.get(url, params=params, timeout=30)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            if attempt == retries - 1:
                raise
            print(f"  ⚠ Retry {attempt + 1} for {url}: {e}")
            time.sleep(2)


def fetch_schedule(season, start_date=None, end_date=None):
    """All games for a season (or date range) with scores and probable pitchers"""
    params = {
        'sportId': 1,
        'gameType': GAME_TYPES,
        'hydrate': 'probablePitcher',
        'startDate': start_date or f'{season}-02-15',
        'endDate': end_date or f'{season}-11-30',
    }
    data = get_json(f'{STATS_API}/schedule', params)

    rows = []
    for date in data.get('dates', []):
        for g in date['games']:
            home, away = g['teams']['home'], g['teams']['away']
            rows.append({
                'game_pk': g['gamePk'],
                'season': int(g['season']),
                'game_type': g['gameType'],
                'game_datetime': g['gameDate'],
                'official_date': g.get('officialDate', date['date']),
                'status': g['status']['detailedState'],
                'home_id': home['team']['id'],
                'away_id': away['team']['id'],
                'home_name': home['team']['name'],
                'away_name': away['team']['name'],
                'home_score': home.get('score'),
                'away_score': away.get('score'),
                'home_sp_id': home.get('probablePitcher', {}).get('id'),
                'away_sp_id': away.get('probablePitcher', {}).get('id'),
                'home_sp_name': home.get('probablePitcher', {}).get('fullName'),
                'away_sp_name': away.get('probablePitcher', {}).get('fullName'),
                'venue_id': g['venue']['id'],
                'day_night': g.get('dayNight'),
                'double_header': g.get('doubleHeader'),
                'series_description': g.get('seriesDescription'),
                'series_game_number': g.get('seriesGameNumber'),
            })
    return pd.DataFrame(rows)


def fetch_pitcher_logs(pitcher_ids, season, batch_size=40):
    """Game-by-game pitching lines, fetched in batches through the people endpoint"""
    rows = []
    ids = sorted({int(p) for p in pitcher_ids if pd.notna(p)})
    for i in range(0, len(ids), batch_size):
        batch = ids[i:i + batch_size]
        data = get_json(f'{STATS_API}/people', {
            'personIds': ','.join(map(str, batch)),
            'hydrate': f'stats(group=[pitching],type=[gameLog],season={season},gameType=[R,F,D,L,W])',
        })
        for person in data.get('people', []):
            for stat_group in person.get('stats', []):
                for split in stat_group.get('splits', []):
                    s = split['stat']
                    rows.append({
                        'pitcher_id': person['id'],
                        'season': season,
                        'game_pk': split['game']['gamePk'],
                        'date': split['date'],
                        'started': s.get('gamesStarted', 0),
                        'outs': s.get('outs', 0),
                        'er': s.get('earnedRuns', 0),
                        'runs': s.get('runs', 0),
                        'hits': s.get('hits', 0),
                        'hr': s.get('homeRuns', 0),
                        'bb': s.get('baseOnBalls', 0),
                        'hbp': s.get('hitByPitch', 0),
                        'k': s.get('strikeOuts', 0),
                        'bf': s.get('battersFaced', 0),
                    })
        print(f"  pitchers {min(i + batch_size, len(ids))}/{len(ids)}", end='\r')
    print()
    return pd.DataFrame(rows)


def fetch_team_logs(team_ids, season):
    """Game-by-game team hitting and pitching (regular season)"""
    rows = []
    for team_id in sorted(set(team_ids)):
        data = get_json(f'{STATS_API}/teams/{team_id}/stats', {
            'stats': 'gameLog', 'group': 'hitting,pitching', 'season': season, 'gameType': 'R'
        })
        by_game = {}
        for stat_group in data.get('stats', []):
            group = stat_group['group']['displayName']
            for split in stat_group.get('splits', []):
                s = split['stat']
                row = by_game.setdefault(split['game']['gamePk'], {
                    'team_id': team_id, 'season': season, 'game_pk': split['game']['gamePk'], 'date': split['date']
                })
                if group == 'hitting':
                    row.update({
                        'bat_pa': s.get('plateAppearances', 0), 'bat_ab': s.get('atBats', 0),
                        'bat_h': s.get('hits', 0), 'bat_2b': s.get('doubles', 0), 'bat_3b': s.get('triples', 0),
                        'bat_hr': s.get('homeRuns', 0), 'bat_bb': s.get('baseOnBalls', 0),
                        'bat_hbp': s.get('hitByPitch', 0), 'bat_sf': s.get('sacFlies', 0),
                        'bat_k': s.get('strikeOuts', 0),
                    })
                else:
                    row.update({
                        'pit_outs': s.get('outs', 0), 'pit_er': s.get('earnedRuns', 0),
                        'pit_bf': s.get('battersFaced', 0), 'pit_k': s.get('strikeOuts', 0),
                        'pit_bb': s.get('baseOnBalls', 0), 'pit_hr': s.get('homeRuns', 0),
                    })
        rows.extend(by_game.values())
        print(f"  team {team_id} done", end='\r')
    print()
    return pd.DataFrame(rows)


def fetch_savant_xera(season):
    response = session.get(f'{SAVANT}/custom', params={
        'year': season, 'type': 'pitcher', 'min': 1, 'selections': 'xera,pa', 'csv': 'true'
    }, timeout=60)
    response.raise_for_status()
    df = pd.read_csv(io.StringIO(response.content.decode('utf-8-sig')))
    df = df.rename(columns={'player_id': 'pitcher_id'})[['pitcher_id', 'xera', 'pa']]
    df['season'] = season
    return df.dropna(subset=['xera'])


def upsert(path, new_df, season_col='season', seasons=None):
    """Replace the given seasons in an existing CSV (or create it)"""
    if os.path.exists(path) and seasons:
        old = pd.read_csv(path)
        old = old[~old[season_col].isin(seasons)]
        new_df = pd.concat([old, new_df], ignore_index=True)
    new_df.to_csv(path, index=False)
    return new_df


def collect(seasons):
    os.makedirs(DATA_DIR, exist_ok=True)
    all_games, all_pitchers, all_teams, all_xera = [], [], [], []

    for season in seasons:
        print(f"\n=== {season} ===")
        games = fetch_schedule(season)
        # Suspended/resumed games can appear twice; keep the latest entry
        games = games.drop_duplicates('game_pk', keep='last')
        games = games[games['home_id'].isin(MLB_TEAM_IDS) & games['away_id'].isin(MLB_TEAM_IDS)]
        finals = games[games['status'].isin(FINAL_STATES)]
        print(f"  {len(games)} games ({len(finals)} final)")
        all_games.append(games)

        sp_ids = pd.concat([games['home_sp_id'], games['away_sp_id']]).dropna().unique()
        all_pitchers.append(fetch_pitcher_logs(sp_ids, season))

        team_ids = pd.concat([games['home_id'], games['away_id']]).unique()
        all_teams.append(fetch_team_logs(team_ids, season))

        try:
            all_xera.append(fetch_savant_xera(season))
        except Exception as e:
            print(f"  ⚠ Savant xERA unavailable for {season}: {e}")

    games = upsert(os.path.join(DATA_DIR, 'games.csv'), pd.concat(all_games), seasons=seasons)
    pitchers = upsert(os.path.join(DATA_DIR, 'pitcher_logs.csv'), pd.concat(all_pitchers), seasons=seasons)
    teams = upsert(os.path.join(DATA_DIR, 'team_logs.csv'), pd.concat(all_teams), seasons=seasons)
    if all_xera:
        upsert(os.path.join(DATA_DIR, 'savant_xera.csv'), pd.concat(all_xera), seasons=seasons)

    print("\n" + "=" * 60)
    print("DATA COLLECTION COMPLETE!")
    print("=" * 60)
    print(f"  games.csv:        {len(games)} rows")
    print(f"  pitcher_logs.csv: {len(pitchers)} rows")
    print(f"  team_logs.csv:    {len(teams)} rows")
    print("\nNext step: python ml_mlb/mlb_feature_engineering.py")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--seasons', nargs='+', type=int, default=ALL_SEASONS)
    args = parser.parse_args()
    collect(args.seasons)
