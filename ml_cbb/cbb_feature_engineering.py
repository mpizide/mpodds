"""
College Basketball Feature Engineering
Creates training features with CBB-specific factors:

KEY FEATURES:
1. Momentum/Streaks - Win/loss streaks, recent form
2. Team Dynamics - Season progression (teams improve over time)
3. Roster Experience - New players vs returning players
4. Conference Strength - Power 6 vs mid-majors
5. Cross-Conference Matchups - Strong vs weak conference
6. Conference Record vs Overall Record
7. Home Court Advantage (stronger in CBB)
"""

import pandas as pd
import numpy as np
from datetime import datetime
from cbb_custom_features import calculate_custom_features, create_interaction_features

print("="*70)
print("COLLEGE BASKETBALL FEATURE ENGINEERING + CUSTOM TRENDS")
print("="*70)

print("\nLoading raw data...")
games = pd.read_csv('ml_cbb/data/cbb_games_raw.csv')

# Filter only completed games with scores
games = games[(games['home_score'].notna()) & (games['away_score'].notna())].copy()
games['date'] = pd.to_datetime(games['date'])
games = games.sort_values('date')

print(f"Found {len(games)} completed games")

# Create target variables
games['home_win'] = (games['home_score'] > games['away_score']).astype(int)
games['point_diff'] = games['home_score'] - games['away_score']
games['total_points'] = games['home_score'] + games['away_score']

print("\n" + "="*70)
print("ENGINEERING CBB-SPECIFIC FEATURES")
print("="*70)

def get_team_conference(team_name, games_df):
    """Extract conference for a team from available game data"""
    # Try to find conference info from games data
    # For now, use manual mapping of major conferences

    # Power 6 Conferences
    acc_teams = ['Duke', 'North Carolina', 'Virginia', 'Miami', 'NC State', 'Syracuse', 'Louisville',
                 'Florida State', 'Clemson', 'Wake Forest', 'Pittsburgh', 'Boston College', 'Georgia Tech',
                 'Notre Dame', 'Virginia Tech']
    big_ten_teams = ['Purdue', 'Michigan State', 'Illinois', 'Wisconsin', 'Indiana', 'Ohio State',
                     'Michigan', 'Iowa', 'Maryland', 'Penn State', 'Nebraska', 'Minnesota', 'Northwestern',
                     'Rutgers', 'UCLA', 'USC', 'Oregon', 'Washington']
    big_12_teams = ['Kansas', 'Baylor', 'Texas', 'Texas Tech', 'Kansas State', 'TCU', 'Oklahoma State',
                    'West Virginia', 'Iowa State', 'Oklahoma', 'Cincinnati', 'Houston', 'UCF', 'BYU']
    sec_teams = ['Alabama', 'Auburn', 'Arkansas', 'Florida', 'Georgia', 'Kentucky', 'LSU', 'Mississippi State',
                 'Missouri', 'Ole Miss', 'South Carolina', 'Tennessee', 'Texas A&M', 'Vanderbilt']
    big_east_teams = ['UConn', 'Villanova', 'Creighton', 'Marquette', 'Xavier', 'Providence', 'Butler',
                      'Seton Hall', 'St. John\'s', 'DePaul', 'Georgetown']
    pac_12_teams = ['Arizona', 'Arizona State', 'Colorado', 'Utah', 'Stanford', 'California']

    # Strong Mid-Majors
    wcc_teams = ['Gonzaga', 'Saint Mary\'s', 'San Francisco', 'BYU']
    mwc_teams = ['San Diego State', 'Nevada', 'New Mexico', 'Boise State', 'UNLV', 'Colorado State']
    aac_teams = ['Memphis', 'SMU', 'Temple', 'Wichita State', 'Tulsa']

    # Check which conference the team belongs to
    for word in team_name.split():
        if any(word in team for team in acc_teams):
            return 'ACC'
        if any(word in team for team in big_ten_teams):
            return 'Big Ten'
        if any(word in team for team in big_12_teams):
            return 'Big 12'
        if any(word in team for team in sec_teams):
            return 'SEC'
        if any(word in team for team in big_east_teams):
            return 'Big East'
        if any(word in team for team in pac_12_teams):
            return 'Pac-12'
        if any(word in team for team in wcc_teams):
            return 'WCC'
        if any(word in team for team in mwc_teams):
            return 'Mountain West'
        if any(word in team for team in aac_teams):
            return 'American'

    return 'Other'  # Low-major or unrecognized

def calculate_conference_strength(games_df):
    """
    Calculate strength rating for each conference
    Based on average team performance (wins, point differential)
    """
    print("\n📊 Calculating conference strength ratings...")

    conference_stats = {}

    # Get all unique teams
    all_teams = pd.concat([games_df['home_team'], games_df['away_team']]).unique()

    # Build team-to-conference mapping
    team_conferences = {}
    for team in all_teams:
        team_conferences[team] = get_team_conference(team, games_df)

    # Calculate conference performance
    for conf in set(team_conferences.values()):
        conf_teams = [t for t, c in team_conferences.items() if c == conf]

        if len(conf_teams) == 0:
            continue

        # Get all games for teams in this conference
        conf_games = games_df[
            (games_df['home_team'].isin(conf_teams)) |
            (games_df['away_team'].isin(conf_teams))
        ]

        # Calculate conference metrics
        total_wins = 0
        total_games = 0
        total_point_diff = 0

        for team in conf_teams:
            home_games = conf_games[conf_games['home_team'] == team]
            away_games = conf_games[conf_games['away_team'] == team]

            home_wins = (home_games['home_score'] > home_games['away_score']).sum()
            away_wins = (away_games['away_score'] > away_games['home_score']).sum()

            total_wins += home_wins + away_wins
            total_games += len(home_games) + len(away_games)

            home_diff = (home_games['home_score'] - home_games['away_score']).sum()
            away_diff = (away_games['away_score'] - away_games['home_score']).sum()
            total_point_diff += home_diff + away_diff

        win_pct = total_wins / total_games if total_games > 0 else 0.5
        avg_diff = total_point_diff / total_games if total_games > 0 else 0

        # Strength rating: combination of win % and point differential
        strength = (win_pct * 100) + (avg_diff * 2)

        conference_stats[conf] = {
            'strength': strength,
            'win_pct': win_pct,
            'avg_diff': avg_diff,
            'teams': len(conf_teams)
        }

    # Normalize strengths (0-100 scale)
    if conference_stats:
        max_strength = max(c['strength'] for c in conference_stats.values())
        min_strength = min(c['strength'] for c in conference_stats.values())

        for conf in conference_stats:
            if max_strength > min_strength:
                normalized = 100 * (conference_stats[conf]['strength'] - min_strength) / (max_strength - min_strength)
                conference_stats[conf]['normalized_strength'] = normalized
            else:
                conference_stats[conf]['normalized_strength'] = 50

    # Display conference rankings
    print("\n  Conference Strength Rankings:")
    sorted_confs = sorted(conference_stats.items(),
                         key=lambda x: x[1]['normalized_strength'],
                         reverse=True)
    for i, (conf, stats) in enumerate(sorted_confs[:15], 1):
        print(f"  {i:2d}. {conf:20s} - Strength: {stats['normalized_strength']:5.1f} "
              f"(Win%: {stats['win_pct']:.3f}, Avg Diff: {stats['avg_diff']:+.1f})")

    return conference_stats, team_conferences

def calculate_momentum_features(df):
    """
    Calculate momentum and streak features for each team
    This is CRITICAL for college basketball
    """
    teams = pd.concat([df['home_team'], df['away_team']]).unique()
    team_momentum = {}

    for team in teams:
        # Get all games for this team
        home_games = df[df['home_team'] == team].copy()
        away_games = df[df['away_team'] == team].copy()

        home_games['is_home'] = 1
        home_games['won'] = (home_games['home_score'] > home_games['away_score']).astype(int)
        home_games['points_for'] = home_games['home_score']
        home_games['points_against'] = home_games['away_score']

        away_games['is_home'] = 0
        away_games['won'] = (away_games['away_score'] > away_games['home_score']).astype(int)
        away_games['points_for'] = away_games['away_score']
        away_games['points_against'] = away_games['home_score']

        all_games = pd.concat([
            home_games[['date', 'season', 'is_home', 'won', 'points_for', 'points_against']],
            away_games[['date', 'season', 'is_home', 'won', 'points_for', 'points_against']]
        ]).sort_values('date')

        # Calculate rolling stats
        all_games['rolling_ppg'] = all_games['points_for'].rolling(5, min_periods=1).mean()
        all_games['rolling_papg'] = all_games['points_against'].rolling(5, min_periods=1).mean()
        all_games['rolling_diff'] = all_games['rolling_ppg'] - all_games['rolling_papg']

        # MOMENTUM FEATURES
        # 1. Current winning/losing streak
        all_games['streak'] = 0
        current_streak = 0
        last_result = None

        for idx, row in all_games.iterrows():
            if last_result is None:
                current_streak = 1 if row['won'] else -1
            elif (row['won'] == 1 and last_result == 1) or (row['won'] == 0 and last_result == 0):
                # Streak continues
                if current_streak > 0:
                    current_streak += 1
                else:
                    current_streak -= 1
            else:
                # Streak breaks
                current_streak = 1 if row['won'] else -1

            all_games.at[idx, 'streak'] = current_streak
            last_result = row['won']

        # 2. Recent form (last 3 games win %)
        all_games['recent_form'] = all_games['won'].rolling(3, min_periods=1).mean()

        # 3. Last 5 games form
        all_games['last5_wins'] = all_games['won'].rolling(5, min_periods=1).sum()

        # 4. Momentum score (weighted recent performance)
        # More recent games weighted higher
        def calculate_momentum(games_list):
            if len(games_list) == 0:
                return 0
            weights = np.array([0.4, 0.3, 0.2, 0.1])[:len(games_list)]
            weights = weights / weights.sum()
            return np.sum(games_list * weights)

        all_games['momentum_score'] = all_games['won'].rolling(4, min_periods=1).apply(
            lambda x: calculate_momentum(x.values)
        )

        # 5. Season progression (games played - teams improve over season)
        all_games['games_played'] = range(1, len(all_games) + 1)
        all_games['season_progress'] = all_games.groupby('season').cumcount() + 1

        # 6. Early season vs late season performance
        # First 10 games = early, last 10 = late
        all_games['is_early_season'] = (all_games['season_progress'] <= 10).astype(int)
        all_games['is_late_season'] = (all_games['season_progress'] >= 20).astype(int)

        team_momentum[team] = all_games

    return team_momentum


print("\n1. Calculating conference strength ratings...")
conference_stats, team_conferences = calculate_conference_strength(games)

print("\n2. Calculating momentum and streak features...")
team_momentum = calculate_momentum_features(games)
print(f"   ✓ Processed {len(team_momentum)} teams")

print("\n3. Building training dataset with conference features...")
features_list = []

for idx, game in games.iterrows():
    try:
        home_team = game['home_team']
        away_team = game['away_team']
        game_date = game['date']
        season = game.get('season', game_date.year)

        # Get team stats BEFORE this game (no data leakage!)
        home_history = team_momentum[home_team][team_momentum[home_team]['date'] < game_date]
        away_history = team_momentum[away_team][team_momentum[away_team]['date'] < game_date]

        if len(home_history) == 0 or len(away_history) == 0:
            continue  # Skip first games of season

        home_recent = home_history.iloc[-1]
        away_recent = away_history.iloc[-1]

        # Get conference information
        home_conf = team_conferences.get(home_team, 'Other')
        away_conf = team_conferences.get(away_team, 'Other')
        home_conf_strength = conference_stats.get(home_conf, {}).get('normalized_strength', 50)
        away_conf_strength = conference_stats.get(away_conf, {}).get('normalized_strength', 50)

        # Check if conference game (same conference)
        is_conference_game = 1 if (home_conf == away_conf and home_conf != 'Other') else 0

        # Conference game weight (increases as season progresses)
        # Conference play typically starts after ~10 games
        conf_game_weight = 1.0
        if is_conference_game and home_recent['season_progress'] > 10:
            # Weight conference games more heavily in late season
            conf_game_weight = 1.0 + (min(home_recent['season_progress'] - 10, 20) / 20) * 0.5  # Up to 1.5x

        # Home court advantage (stronger in CBB, ~4-5 points)
        home_advantage = 4.5
        if game.get('is_neutral', False):
            home_advantage = 0

        features = {
            'date': game_date,
            'season': season,
            'home_team': home_team,
            'away_team': away_team,

            # TARGET VARIABLES
            'home_win': game['home_win'],
            'point_diff': game['point_diff'],
            'total_points': game['total_points'],

            # BASIC TEAM STRENGTH
            'home_rolling_ppg': home_recent['rolling_ppg'],
            'home_rolling_papg': home_recent['rolling_papg'],
            'home_rolling_diff': home_recent['rolling_diff'],
            'away_rolling_ppg': away_recent['rolling_ppg'],
            'away_rolling_papg': away_recent['rolling_papg'],
            'away_rolling_diff': away_recent['rolling_diff'],

            # MATCHUP FEATURES
            'ppg_differential': home_recent['rolling_ppg'] - away_recent['rolling_ppg'],
            'papg_differential': home_recent['rolling_papg'] - away_recent['rolling_papg'],
            'overall_differential': home_recent['rolling_diff'] - away_recent['rolling_diff'],

            # HOME COURT ADVANTAGE
            'home_advantage': home_advantage,
            'is_neutral_site': 1 if game.get('is_neutral', False) else 0,

            # CONFERENCE FEATURES (NEW!)
            'home_conf_strength': home_conf_strength,
            'away_conf_strength': away_conf_strength,
            'conf_strength_differential': home_conf_strength - away_conf_strength,
            'is_conference_game': is_conference_game,
            'is_cross_conference': 1 - is_conference_game,
            'conf_game_weight': conf_game_weight,

            # MOMENTUM FEATURES (KEY FOR CBB!)
            'home_streak': home_recent['streak'],
            'away_streak': away_recent['streak'],
            'home_recent_form': home_recent['recent_form'],
            'away_recent_form': away_recent['recent_form'],
            'home_last5_wins': home_recent['last5_wins'],
            'away_last5_wins': away_recent['last5_wins'],
            'home_momentum_score': home_recent['momentum_score'],
            'away_momentum_score': away_recent['momentum_score'],

            # MOMENTUM DIFFERENTIALS
            'streak_differential': home_recent['streak'] - away_recent['streak'],
            'form_differential': home_recent['recent_form'] - away_recent['recent_form'],
            'momentum_differential': home_recent['momentum_score'] - away_recent['momentum_score'],

            # SEASON PROGRESSION FEATURES
            'home_games_played': home_recent['games_played'],
            'away_games_played': away_recent['games_played'],
            'home_season_progress': home_recent['season_progress'],
            'away_season_progress': away_recent['season_progress'],
            'experience_differential': home_recent['games_played'] - away_recent['games_played'],

            # EARLY VS LATE SEASON
            'is_early_season': int(home_recent['season_progress'] <= 10),
            'is_late_season': int(home_recent['season_progress'] >= 20),

            # GAME CONTEXT
            'is_conference_game': 1 if game.get('is_conference', False) else 0,
        }

        # ADD CUSTOM FEATURES (travel, rest, altitude, etc.)
        try:
            custom_features = calculate_custom_features(
                game, home_history, away_history, home_team, away_team
            )
            features.update(custom_features)

            # ADD AUTOMATIC FEATURE INTERACTIONS
            interaction_features = create_interaction_features(features)
            features.update(interaction_features)
        except Exception as e:
            # If custom features fail, continue with base features
            pass

        features_list.append(features)

        # Progress indicator
        if len(features_list) % 1000 == 0:
            print(f"   Progress: {len(features_list)} games processed...")

    except Exception as e:
        continue

# Create final training dataset
training_data = pd.DataFrame(features_list)

# Remove rows with missing critical features
critical_features = [
    'home_rolling_ppg', 'away_rolling_ppg',
    'home_momentum_score', 'away_momentum_score',
    'home_streak', 'away_streak'
]
training_data = training_data.dropna(subset=critical_features)

print(f"\n   ✓ Created {len(training_data)} training samples")

# Save training data
training_data.to_csv('ml_cbb/data/cbb_training_data.csv', index=False)

print("\n" + "="*70)
print("FEATURE ENGINEERING COMPLETE!")
print("="*70)
print(f"\nTraining dataset: {len(training_data)} games")
print(f"Features: {len(training_data.columns)} columns")
print(f"Date range: {training_data['date'].min()} to {training_data['date'].max()}")

# Display feature summary
print("\n" + "="*70)
print("KEY FEATURE STATISTICS")
print("="*70)

print("\nMOMENTUM FEATURES:")
momentum_features = ['home_streak', 'away_streak', 'home_momentum_score', 'away_momentum_score']
for feat in momentum_features:
    print(f"  {feat:30s} mean={training_data[feat].mean():7.2f}, std={training_data[feat].std():6.2f}")

print("\nSTREAK ANALYSIS:")
print(f"  Longest win streak: {training_data['home_streak'].max():.0f} games")
print(f"  Longest loss streak: {training_data['home_streak'].min():.0f} games")
print(f"  Teams on 3+ game win streak: {(training_data['home_streak'] >= 3).sum() + (training_data['away_streak'] >= 3).sum()}")

print("\nSEASON PROGRESSION:")
print(f"  Early season games (<= 10): {training_data['is_early_season'].sum()}")
print(f"  Late season games (>= 20): {training_data['is_late_season'].sum()}")
print(f"  Mid-season games: {len(training_data) - training_data['is_early_season'].sum() - training_data['is_late_season'].sum()}")

print("\nTARGET VARIABLE DISTRIBUTION:")
print(f"  Home wins: {training_data['home_win'].sum()} ({training_data['home_win'].mean()*100:.1f}%)")
print(f"  Away wins: {len(training_data) - training_data['home_win'].sum()} ({(1-training_data['home_win'].mean())*100:.1f}%)")
print(f"  Average point differential: {training_data['point_diff'].mean():.1f}")
print(f"  Average total points: {training_data['total_points'].mean():.1f}")

# Analyze streak impact on winning
print("\n" + "="*70)
print("STREAK IMPACT ANALYSIS")
print("="*70)

win_streak_games = training_data[training_data['home_streak'] >= 3]
loss_streak_games = training_data[training_data['home_streak'] <= -3]

print(f"\nTeams on 3+ game WIN streak:")
print(f"  Win rate: {win_streak_games['home_win'].mean()*100:.1f}%")
print(f"  Avg point differential: {win_streak_games['point_diff'].mean():+.1f}")

print(f"\nTeams on 3+ game LOSS streak:")
print(f"  Win rate: {loss_streak_games['home_win'].mean()*100:.1f}%")
print(f"  Avg point differential: {loss_streak_games['point_diff'].mean():+.1f}")

# Analyze conference impact on winning
print("\n" + "="*70)
print("CONFERENCE IMPACT ANALYSIS")
print("="*70)

conf_games = training_data[training_data['is_conference_game'] == 1]
non_conf_games = training_data[training_data['is_conference_game'] == 0]

print(f"\nConference Games (same conference):")
print(f"  Total: {len(conf_games)} games")
print(f"  Home win rate: {conf_games['home_win'].mean()*100:.1f}%")
print(f"  Avg point differential: {conf_games['point_diff'].mean():+.1f}")
print(f"  Avg total points: {conf_games['total_points'].mean():.1f}")

print(f"\nNon-Conference Games (cross-conference):")
print(f"  Total: {len(non_conf_games)} games")
print(f"  Home win rate: {non_conf_games['home_win'].mean()*100:.1f}%")
print(f"  Avg point differential: {non_conf_games['point_diff'].mean():+.1f}")
print(f"  Avg total points: {non_conf_games['total_points'].mean():.1f}")

# Analyze conference strength differential impact
print(f"\nCross-Conference Matchups (Strong vs Weak):")
strong_vs_weak = training_data[
    (training_data['is_conference_game'] == 0) &
    (training_data['conf_strength_differential'].abs() > 20)
]
print(f"  Total: {len(strong_vs_weak)} games with large strength difference")
if len(strong_vs_weak) > 0:
    print(f"  Stronger conference win rate: {(strong_vs_weak['conf_strength_differential'] * strong_vs_weak['point_diff'] > 0).mean()*100:.1f}%")
    print(f"  Avg margin when stronger conf wins: {strong_vs_weak[strong_vs_weak['conf_strength_differential'] * strong_vs_weak['point_diff'] > 0]['point_diff'].abs().mean():.1f} pts")

print("\n" + "="*70)
print("\nNext step: Run cbb_train_models.py")
print("This will train ML models using these CBB-specific features")
print("Conference strength will be a KEY predictor in cross-conference matchups!")
