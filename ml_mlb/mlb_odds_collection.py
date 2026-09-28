"""
Historical MLB closing odds (SportsBookReview)

Used only to evaluate/calibrate the model against the betting market:
mlb_evaluate_blend.py compares model vs market vs a blend of both on real closing lines.

Output: ml_mlb/data/historical_odds.csv
  one row per game: consensus no-vig home win prob, closing total line and no-vig over prob

Usage:
  python ml_mlb/mlb_odds_collection.py                  # 2022-now (~15 min)
  python ml_mlb/mlb_odds_collection.py --seasons 2026
"""

import argparse
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

import numpy as np
import pandas as pd
import requests

from mlb_features import DATA_DIR, FINAL_STATES

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE = 'https://www.sportsbookreview.com/betting-odds/mlb-baseball'
PAGES = {'ml': f'{BASE}/', 'total': f'{BASE}/totals/full-game/'}
NEXT_DATA = re.compile(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', re.S)
OUTPUT = os.path.join(DATA_DIR, 'historical_odds.csv')
# Parsed pages are cached per date so an interrupted run picks up where it left off
CACHE_DIR = os.path.join(DATA_DIR, 'sbr_cache')

session = requests.Session()
session.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'


def implied(odds):
    odds = float(odds)
    return 100 / (odds + 100) if odds > 0 else -odds / (-odds + 100)


def no_vig(a, b):
    ia, ib = implied(a), implied(b)
    return ia / (ia + ib)


def nickname(full_name):
    """'Boston Red Sox' -> 'red sox', 'Oakland Athletics' -> 'athletics'"""
    words = (full_name or '').lower().replace('.', '').split()
    if not words:
        return None
    return ' '.join(words[-2:]) if words[-1] in ('sox', 'jays') else words[-1]


def consensus(probs):
    """Median across books, ignoring stale/live outliers far from the pack"""
    probs = np.array([p for p in probs if 0.02 < p < 0.98])
    if len(probs) == 0:
        return None, 0
    med = np.median(probs)
    keep = probs[np.abs(probs - med) < 0.08]
    return float(np.median(keep)), int(len(keep))


def fetch_page(kind, date):
    for attempt in range(3):
        try:
            r = session.get(PAGES[kind], params={'date': date}, timeout=30)
            if r.status_code == 404:
                return []
            r.raise_for_status()
            m = NEXT_DATA.search(r.text)
            if not m:
                return []
            data = json.loads(m.group(1))
            tables = data['props']['pageProps'].get('oddsTables') or []
            return tables[0]['oddsTableModel']['gameRows'] if tables else []
        except Exception:
            time.sleep(2 * (attempt + 1))
    print(f"  could not fetch {kind} {date}")
    return []


def parse_date(date):
    cache_file = os.path.join(CACHE_DIR, f'{date}.json')
    if os.path.exists(cache_file):
        with open(cache_file) as f:
            return json.load(f)

    rows = {}
    for kind in ('ml', 'total'):
        for g in fetch_page(kind, date):
            try:
                gv = g['gameView']
                home, away = nickname(gv['homeTeam'].get('fullName')), nickname(gv['awayTeam'].get('fullName'))
                if not home or not away:
                    continue
                key = (gv['startDate'], home, away)
                row = rows.setdefault(key, {'date': date, 'start': gv['startDate'], 'home_nick': home, 'away_nick': away})
                lines = [ov['currentLine'] for ov in g.get('oddsViews', []) if ov and ov.get('currentLine')]
                if kind == 'ml':
                    probs = [no_vig(l['homeOdds'], l['awayOdds']) for l in lines if l.get('homeOdds') and l.get('awayOdds')]
                    row['ml_home_prob'], row['ml_books'] = consensus(probs)
                else:
                    totals = [l for l in lines if l.get('total') and l.get('overOdds') and l.get('underOdds')]
                    if totals:
                        line = pd.Series([l['total'] for l in totals]).mode().iloc[0]
                        probs = [no_vig(l['overOdds'], l['underOdds']) for l in totals if l['total'] == line]
                        row['total_line'] = float(line)
                        row['total_over_prob'], row['total_books'] = consensus(probs)
            except Exception as e:
                print(f"  skipped a game on {date}: {e}")

    result = list(rows.values())
    if result:
        with open(cache_file, 'w') as f:
            json.dump(result, f)
    return result


def match_to_games(odds, games):
    """Attach game_pk by date + team nicknames (closest start time for doubleheaders)"""
    games = games.copy()
    games['home_nick'] = games['home_name'].map(nickname)
    games['away_nick'] = games['away_name'].map(nickname)
    games['start_ts'] = pd.to_datetime(games['game_datetime'], utc=True)
    odds['start_ts'] = pd.to_datetime(odds['start'], utc=True)

    pks = []
    for _, o in odds.iterrows():
        cand = games[(games['home_nick'] == o['home_nick']) & (games['away_nick'] == o['away_nick'])
                     & ((games['start_ts'] - o['start_ts']).abs() < pd.Timedelta(hours=14))]
        if cand.empty:
            pks.append(None)
        else:
            pks.append(int(cand.loc[(cand['start_ts'] - o['start_ts']).abs().idxmin(), 'game_pk']))
    odds['game_pk'] = pks
    return odds.drop(columns=['start_ts'])


def collect(seasons):
    games = pd.read_csv(os.path.join(DATA_DIR, 'games.csv'))
    done = games[games['status'].isin(FINAL_STATES) & games['season'].isin(seasons)]
    dates = sorted(done['official_date'].unique())
    os.makedirs(CACHE_DIR, exist_ok=True)
    print(f"Fetching closing odds for {len(dates)} dates...")

    results = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        for i, rows in enumerate(pool.map(parse_date, dates)):
            results.extend(rows)
            if (i + 1) % 25 == 0:
                print(f"  {i + 1}/{len(dates)} dates, {len(results)} games")

    odds = match_to_games(pd.DataFrame(results), games)
    matched = odds['game_pk'].notna().sum()
    odds = odds.dropna(subset=['game_pk']).drop_duplicates('game_pk', keep='last')
    odds['game_pk'] = odds['game_pk'].astype(int)
    odds['season'] = odds['game_pk'].map(games.set_index('game_pk')['season'])

    if os.path.exists(OUTPUT):
        old = pd.read_csv(OUTPUT)
        odds = pd.concat([old[~old['season'].isin(seasons)], odds], ignore_index=True)
    odds.to_csv(OUTPUT, index=False)
    print(f"\nMatched {matched} games to the schedule; saved {len(odds)} rows to {OUTPUT}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--seasons', nargs='+', type=int, default=list(range(2022, datetime.now().year + 1)))
    collect(parser.parse_args().seasons)
