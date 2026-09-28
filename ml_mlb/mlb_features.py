"""
MLB feature builder (shared by training and prediction so they can never drift apart)

Every feature for a game is computed ONLY from games completed before that game starts,
so there is no data leakage. Current-season stats are blended with last season and then
shrunk toward league average, which keeps early-season / small-sample numbers sane.
"""

import os

import numpy as np
import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
FINAL_STATES = {'Final', 'Game Over', 'Completed Early'}

# League-average priors (roughly 2021-2025 MLB)
LG = {
    'runs_pg': 4.45,
    'obp': 0.315,
    'slg': 0.405,
    'era': 4.15,
    'xera': 4.20,
    'k_pct': 0.225,
    'bb_pct': 0.083,
    'hr_per_out': 1.20 / 27,
    'bb_hbp_per_out': 3.6 / 27,
    'k_per_out': 8.6 / 27,
    'outs_per_start': 16.0,
}
FIP_CONSTANT = 3.15
PREV_SEASON_WEIGHT = 0.6  # how much last season's counts count toward this season's numbers

# Features fed to the models (order matters for the saved models)
TEAM_FEATURES = ['win_pct', 'rd_pg', 'rf_pg', 'ra_pg', 'rf_10', 'ra_10', 'win_10', 'obp', 'slg',
                 'ops_15', 'bullpen_era', 'rest_days']
SP_FEATURES = ['sp_fip', 'sp_era', 'sp_k_pct', 'sp_bb_pct', 'sp_hr9', 'sp_outs_per_start',
               'sp_xera_prev', 'sp_starts', 'sp_known']

FEATURE_COLUMNS = (
    [f'home_{f}' for f in TEAM_FEATURES + SP_FEATURES]
    + [f'away_{f}' for f in TEAM_FEATURES + SP_FEATURES]
    + ['win_pct_diff', 'rd_pg_diff', 'ops_diff', 'bullpen_era_diff', 'sp_fip_diff', 'sp_xera_diff',
       'park_factor', 'is_postseason', 'is_night', 'season_progress']
)


def load_data():
    games = pd.read_csv(os.path.join(DATA_DIR, 'games.csv'))
    pitchers = pd.read_csv(os.path.join(DATA_DIR, 'pitcher_logs.csv'))
    teams = pd.read_csv(os.path.join(DATA_DIR, 'team_logs.csv'))
    xera_path = os.path.join(DATA_DIR, 'savant_xera.csv')
    xera = pd.read_csv(xera_path) if os.path.exists(xera_path) else pd.DataFrame(columns=['pitcher_id', 'season', 'xera', 'pa'])
    return games, pitchers, teams, xera


def _prep_games(games):
    games = games.copy()
    games['dt'] = pd.to_datetime(games['game_datetime'], utc=True).dt.tz_localize(None)
    games['date'] = pd.to_datetime(games['official_date'])
    games['completed'] = games['status'].isin(FINAL_STATES) & games['home_score'].notna() & games['away_score'].notna()
    return games.sort_values('dt').reset_index(drop=True)


# ---------------------------------------------------------------------------
# Team features
# ---------------------------------------------------------------------------

def _team_game_table(games, pitchers, teams):
    """One row per team per completed game, with running season totals and rolling form"""
    done = games[games['completed']]
    rows = []
    for side, opp in (('home', 'away'), ('away', 'home')):
        t = pd.DataFrame({
            'team_id': done[f'{side}_id'],
            'season': done['season'],
            'game_pk': done['game_pk'],
            'dt': done['dt'],
            'date': done['date'],
            'sp_id': done[f'{side}_sp_id'],
            'rf': done[f'{side}_score'],
            'ra': done[f'{opp}_score'],
        })
        rows.append(t)
    tg = pd.concat(rows, ignore_index=True)
    tg['win'] = (tg['rf'] > tg['ra']).astype(int)

    tg = tg.merge(teams.drop(columns=['season', 'date']), on=['team_id', 'game_pk'], how='left')

    # Bullpen = team pitching minus the starter's line
    starts = pitchers[pitchers['started'] == 1][['pitcher_id', 'game_pk', 'outs', 'er']]
    starts = starts.rename(columns={'pitcher_id': 'sp_id', 'outs': 'sp_outs', 'er': 'sp_er'})
    tg = tg.merge(starts, on=['sp_id', 'game_pk'], how='left')
    valid_bp = tg['pit_outs'].notna() & tg['sp_outs'].notna()
    tg['bp_outs'] = np.where(valid_bp, (tg['pit_outs'] - tg['sp_outs']).clip(lower=0), 0)
    tg['bp_er'] = np.where(valid_bp, (tg['pit_er'] - tg['sp_er']).clip(lower=0), 0)

    bat_cols = ['bat_pa', 'bat_ab', 'bat_h', 'bat_2b', 'bat_3b', 'bat_hr', 'bat_bb', 'bat_hbp', 'bat_sf']
    tg[bat_cols] = tg[bat_cols].fillna(0)
    tg['bat_on'] = tg['bat_h'] + tg['bat_bb'] + tg['bat_hbp']
    tg['bat_obp_den'] = tg['bat_ab'] + tg['bat_bb'] + tg['bat_hbp'] + tg['bat_sf']
    tg['bat_tb'] = tg['bat_h'] + tg['bat_2b'] + 2 * tg['bat_3b'] + 3 * tg['bat_hr']

    tg = tg.sort_values(['team_id', 'dt']).reset_index(drop=True)

    # Running season totals (inclusive of this game; the lookup later takes strictly-earlier rows)
    cum_cols = ['win', 'rf', 'ra', 'bat_on', 'bat_obp_den', 'bat_tb', 'bat_ab', 'bp_outs', 'bp_er']
    grp = tg.groupby(['team_id', 'season'])
    for c in cum_cols:
        tg[f'cum_{c}'] = grp[c].cumsum()
    tg['cum_games'] = grp.cumcount() + 1

    # Rolling form across seasons
    tgrp = tg.groupby('team_id')
    tg['rf_10'] = tgrp['rf'].transform(lambda s: s.rolling(10, min_periods=1).mean())
    tg['ra_10'] = tgrp['ra'].transform(lambda s: s.rolling(10, min_periods=1).mean())
    tg['win_10'] = tgrp['win'].transform(lambda s: s.rolling(10, min_periods=1).mean())
    on15 = tgrp['bat_on'].transform(lambda s: s.rolling(15, min_periods=1).sum())
    den15 = tgrp['bat_obp_den'].transform(lambda s: s.rolling(15, min_periods=1).sum())
    tb15 = tgrp['bat_tb'].transform(lambda s: s.rolling(15, min_periods=1).sum())
    ab15 = tgrp['bat_ab'].transform(lambda s: s.rolling(15, min_periods=1).sum())
    tg['ops_15'] = np.where(den15 > 0, on15 / den15.replace(0, np.nan), LG['obp']) + \
        np.where(ab15 > 0, tb15 / ab15.replace(0, np.nan), LG['slg'])
    tg['ops_15'] = tg['ops_15'].fillna(LG['obp'] + LG['slg'])
    return tg


def _team_features(games, tg):
    """Point-in-time team features for both sides of every game"""
    season_totals = tg.groupby(['team_id', 'season']).last().reset_index()
    prev = season_totals[['team_id', 'season', 'cum_games', 'cum_win', 'cum_rf', 'cum_ra',
                          'cum_bat_on', 'cum_bat_obp_den', 'cum_bat_tb', 'cum_bat_ab', 'cum_bp_outs', 'cum_bp_er']].copy()
    prev['season'] += 1  # becomes "previous season" for the next year
    prev = prev.add_prefix('prev_').rename(columns={'prev_team_id': 'team_id', 'prev_season': 'season'})

    lookup_cols = ['team_id', 'dt', 'season', 'date', 'cum_games', 'cum_win', 'cum_rf', 'cum_ra', 'cum_bat_on',
                   'cum_bat_obp_den', 'cum_bat_tb', 'cum_bat_ab', 'cum_bp_outs', 'cum_bp_er',
                   'rf_10', 'ra_10', 'win_10', 'ops_15']
    right = tg[lookup_cols].rename(columns={'dt': 'last_dt', 'season': 'last_season', 'date': 'last_date'})
    right = right.sort_values('last_dt')

    out = {}
    for side in ('home', 'away'):
        left = games[['game_pk', 'dt', 'date', 'season', f'{side}_id']].rename(columns={f'{side}_id': 'team_id'})
        left = left.sort_values('dt')
        m = pd.merge_asof(left, right, left_on='dt', right_on='last_dt', by='team_id',
                          allow_exact_matches=False, direction='backward')

        # A match from last season means no current-season games yet
        same_season = m['last_season'] == m['season']
        cum_cols = [c for c in m.columns if c.startswith('cum_')]
        m.loc[~same_season, cum_cols] = 0
        m[cum_cols] = m[cum_cols].fillna(0)
        m = m.merge(prev, on=['team_id', 'season'], how='left')

        g = m['cum_games']
        pg = m['prev_cum_games']
        has_prev = pg.fillna(0) > 0

        prior_wpct = np.where(has_prev, 0.5 + 0.5 * (m['prev_cum_win'] / pg - 0.5), 0.5)
        prior_rf = np.where(has_prev, 0.5 * (m['prev_cum_rf'] / pg) + 0.5 * LG['runs_pg'], LG['runs_pg'])
        prior_ra = np.where(has_prev, 0.5 * (m['prev_cum_ra'] / pg) + 0.5 * LG['runs_pg'], LG['runs_pg'])
        K = 30
        f = pd.DataFrame({'game_pk': m['game_pk']})
        f['win_pct'] = (m['cum_win'] + K * prior_wpct) / (g + K)
        f['rf_pg'] = (m['cum_rf'] + K * prior_rf) / (g + K)
        f['ra_pg'] = (m['cum_ra'] + K * prior_ra) / (g + K)
        f['rd_pg'] = f['rf_pg'] - f['ra_pg']

        prev_obp = np.where(has_prev & (m['prev_cum_bat_obp_den'] > 0),
                            m['prev_cum_bat_on'] / m['prev_cum_bat_obp_den'].replace(0, np.nan), LG['obp'])
        prev_slg = np.where(has_prev & (m['prev_cum_bat_ab'] > 0),
                            m['prev_cum_bat_tb'] / m['prev_cum_bat_ab'].replace(0, np.nan), LG['slg'])
        prior_obp = 0.5 * np.nan_to_num(prev_obp, nan=LG['obp']) + 0.5 * LG['obp']
        prior_slg = 0.5 * np.nan_to_num(prev_slg, nan=LG['slg']) + 0.5 * LG['slg']
        f['obp'] = (m['cum_bat_on'] + 1000 * prior_obp) / (m['cum_bat_obp_den'] + 1000)
        f['slg'] = (m['cum_bat_tb'] + 900 * prior_slg) / (m['cum_bat_ab'] + 900)

        prev_bp = np.where(has_prev & (m['prev_cum_bp_outs'] > 0),
                           27 * m['prev_cum_bp_er'] / m['prev_cum_bp_outs'].replace(0, np.nan), LG['era'])
        prior_bp = 0.5 * np.nan_to_num(prev_bp, nan=LG['era']) + 0.5 * LG['era']
        K_OUTS = 450
        f['bullpen_era'] = 27 * (m['cum_bp_er'] + prior_bp / 27 * K_OUTS) / (m['cum_bp_outs'] + K_OUTS)

        f['rf_10'] = m['rf_10'].fillna(LG['runs_pg'])
        f['ra_10'] = m['ra_10'].fillna(LG['runs_pg'])
        f['win_10'] = m['win_10'].fillna(0.5)
        f['ops_15'] = m['ops_15'].fillna(LG['obp'] + LG['slg'])
        rest = (m['date'] - m['last_date']).dt.days
        f['rest_days'] = np.where(same_season, rest, 5)
        f['rest_days'] = pd.Series(f['rest_days']).fillna(5).clip(0, 5).values
        f['games_played'] = g.values
        out[side] = f.set_index('game_pk')
    return out


# ---------------------------------------------------------------------------
# Starting pitcher features
# ---------------------------------------------------------------------------

def _pitcher_features(games, pitchers, xera):
    p = pitchers.copy()
    p['date'] = pd.to_datetime(p['date'])
    p['start_outs'] = p['outs'] * p['started']
    p = p.sort_values(['pitcher_id', 'date']).reset_index(drop=True)
    cnt = ['outs', 'er', 'hr', 'bb', 'hbp', 'k', 'bf', 'started', 'start_outs']
    grp = p.groupby(['pitcher_id', 'season'])
    for c in cnt:
        p[f'cum_{c}'] = grp[c].cumsum()

    season_totals = p.groupby(['pitcher_id', 'season'])[cnt].sum().reset_index()
    prev = season_totals.copy()
    prev['season'] += 1
    prev = prev.rename(columns={c: f'prev_{c}' for c in cnt})

    xera = xera.copy()
    xera['season'] = xera['season'] + 1
    xera = xera.rename(columns={'xera': 'prev_xera', 'pa': 'prev_xera_pa'})[['pitcher_id', 'season', 'prev_xera', 'prev_xera_pa']]

    right = p[['pitcher_id', 'date', 'season'] + [f'cum_{c}' for c in cnt]].rename(
        columns={'date': 'log_date', 'season': 'log_season'}).sort_values('log_date')

    out = {}
    for side in ('home', 'away'):
        left = games[['game_pk', 'date', 'season', f'{side}_sp_id']].rename(columns={f'{side}_sp_id': 'pitcher_id'})
        left['pitcher_id'] = left['pitcher_id'].fillna(-1).astype(int)
        left = left.sort_values('date')
        m = pd.merge_asof(left, right, left_on='date', right_on='log_date', by='pitcher_id',
                          allow_exact_matches=False, direction='backward')
        same = m['log_season'] == m['season']
        cum_cols = [f'cum_{c}' for c in cnt]
        m.loc[~same, cum_cols] = 0
        m[cum_cols] = m[cum_cols].fillna(0)
        m = m.merge(prev, on=['pitcher_id', 'season'], how='left')
        m = m.merge(xera, on=['pitcher_id', 'season'], how='left')
        for c in cnt:
            m[f'prev_{c}'] = m[f'prev_{c}'].fillna(0)

        w = PREV_SEASON_WEIGHT
        pool = {c: m[f'cum_{c}'] + w * m[f'prev_{c}'] for c in cnt}

        f = pd.DataFrame({'game_pk': m['game_pk']})
        K_BF = 170
        f['sp_k_pct'] = (pool['k'] + LG['k_pct'] * K_BF) / (pool['bf'] + K_BF)
        f['sp_bb_pct'] = (pool['bb'] + LG['bb_pct'] * 220) / (pool['bf'] + 220)
        K_OUTS = 240
        hr = pool['hr'] + LG['hr_per_out'] * K_OUTS
        bbh = pool['bb'] + pool['hbp'] + LG['bb_hbp_per_out'] * K_OUTS
        k = pool['k'] + LG['k_per_out'] * K_OUTS
        ip = (pool['outs'] + K_OUTS) / 3
        f['sp_fip'] = (13 * hr + 3 * bbh - 2 * k) / ip + FIP_CONSTANT
        f['sp_hr9'] = 9 * hr / ip
        f['sp_era'] = 27 * (pool['er'] + LG['era'] / 27 * 300) / (pool['outs'] + 300)
        f['sp_outs_per_start'] = (pool['start_outs'] + LG['outs_per_start'] * 5) / (pool['started'] + 5)
        xpa = m['prev_xera_pa'].fillna(0)
        f['sp_xera_prev'] = (m['prev_xera'].fillna(LG['xera']) * xpa + LG['xera'] * 250) / (xpa + 250)
        f['sp_starts'] = m['cum_started']
        f['sp_known'] = 1

        # Unknown starter (TBD): league-average pitcher
        unknown = m['pitcher_id'] == -1
        defaults = {'sp_k_pct': LG['k_pct'], 'sp_bb_pct': LG['bb_pct'], 'sp_fip': LG['era'], 'sp_hr9': LG['hr_per_out'] * 27,
                    'sp_era': LG['era'], 'sp_outs_per_start': LG['outs_per_start'], 'sp_xera_prev': LG['xera'],
                    'sp_starts': 0, 'sp_known': 0}
        for col, val in defaults.items():
            f.loc[unknown.values, col] = val
        out[side] = f.set_index('game_pk')
    return out


# ---------------------------------------------------------------------------
# Park factors
# ---------------------------------------------------------------------------

def _park_factors(games):
    """Runs-per-game at each venue vs league, using only seasons before the game's season"""
    done = games[games['completed']].copy()
    done['total'] = done['home_score'] + done['away_score']
    factors = {}
    for season in sorted(games['season'].unique()):
        prior = done[(done['season'] < season) & (done['game_type'] == 'R')]
        if prior.empty:
            continue
        league = prior['total'].mean()
        by_venue = prior.groupby('venue_id')['total'].agg(['mean', 'count'])
        raw = by_venue['mean'] / league
        shrunk = (raw * by_venue['count'] + 1.0 * 150) / (by_venue['count'] + 150)
        for venue_id, pf in shrunk.items():
            factors[(season, venue_id)] = pf
    return games.apply(lambda g: factors.get((g['season'], g['venue_id']), 1.0), axis=1).values


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def build_features(games, pitchers, teams, xera):
    """
    Returns one row per game in `games` (completed AND upcoming) with FEATURE_COLUMNS,
    plus targets (home_win, run_diff, total_runs) for completed games.
    """
    games = _prep_games(games)
    tg = _team_game_table(games, pitchers, teams)
    team = _team_features(games, tg)
    sp = _pitcher_features(games, pitchers, xera)

    df = games[['game_pk', 'season', 'game_type', 'game_datetime', 'official_date', 'status', 'completed',
                'home_id', 'away_id', 'home_name', 'away_name', 'home_sp_id', 'away_sp_id',
                'home_sp_name', 'away_sp_name', 'home_score', 'away_score', 'day_night',
                'series_description', 'series_game_number']].copy()
    df = df.set_index('game_pk')

    for side in ('home', 'away'):
        tf = team[side][TEAM_FEATURES + ['games_played']]
        tf = tf[~tf.index.duplicated(keep='last')]
        df = df.join(tf.add_prefix(f'{side}_'))
        pf = sp[side][SP_FEATURES]
        pf = pf[~pf.index.duplicated(keep='last')]
        df = df.join(pf.add_prefix(f'{side}_'))
    df = df.reset_index()

    df['win_pct_diff'] = df['home_win_pct'] - df['away_win_pct']
    df['rd_pg_diff'] = df['home_rd_pg'] - df['away_rd_pg']
    df['ops_diff'] = (df['home_obp'] + df['home_slg']) - (df['away_obp'] + df['away_slg'])
    df['bullpen_era_diff'] = df['away_bullpen_era'] - df['home_bullpen_era']  # positive favors home
    df['sp_fip_diff'] = df['away_sp_fip'] - df['home_sp_fip']                 # positive favors home
    df['sp_xera_diff'] = df['away_sp_xera_prev'] - df['home_sp_xera_prev']
    df['park_factor'] = _park_factors(games.set_index('game_pk').loc[df['game_pk']].reset_index())
    df['is_postseason'] = (df['game_type'] != 'R').astype(int)
    df['is_night'] = (df['day_night'] == 'night').astype(int)
    df['season_progress'] = (df[['home_games_played', 'away_games_played']].mean(axis=1) / 162).clip(0, 1)

    # Targets
    df['home_win'] = np.where(df['completed'], (df['home_score'] > df['away_score']).astype(float), np.nan)
    df['run_diff'] = np.where(df['completed'], df['home_score'] - df['away_score'], np.nan)
    df['total_runs'] = np.where(df['completed'], df['home_score'] + df['away_score'], np.nan)
    return df
