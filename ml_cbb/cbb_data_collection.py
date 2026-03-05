"""
College Basketball Data Collection Script
Fetches historical game data, team stats, and creates training dataset

Key CBB Features:
- High roster turnover (transfers, one-and-done)
- Momentum/streaks matter significantly
- Team chemistry evolves through season
"""

import pandas as pd
import numpy as np
import os
from datetime import datetime, timedelta
import requests
import json

# Create directory for data
os.makedirs('ml_cbb/data', exist_ok=True)

print("="*70)
print("COLLEGE BASKETBALL DATA COLLECTION")
print("="*70)

def fetch_cbb_from_sportsreference(seasons):
    """
    Fetch CBB data using sportsreference/sportsipy

    Alternative if library not available: Use ESPN or NCAA.com API
    """
    try:
        from sportsipy.ncaab.schedule import Schedule
        from sportsipy.ncaab.teams import Teams

        print("\n✓ Using sportsipy library for data collection")

        all_games = []
        all_teams_stats = []

        for season in seasons:
            print(f"\nFetching {season} season data...")

            # Get all teams for this season
            teams = Teams(season)

            for team in teams:
                try:
                    print(f"  - {team.name} ({team.abbreviation})")

                    # Get team schedule
                    schedule = Schedule(team.abbreviation, season)

                    for game in schedule:
                        game_data = {
                            'season': season,
                            'date': game.datetime,
                            'home_team': game.opponent_name if game.location == 'Away' else team.name,
                            'away_team': team.name if game.location == 'Away' else game.opponent_name,
                            'home_score': game.opponent_points if game.location == 'Away' else game.points_scored,
                            'away_score': game.points_scored if game.location == 'Away' else game.opponent_points,
                            'location': game.location,
                            'is_conference': game.type == 'Conference',
                            'is_neutral': game.location == 'Neutral',
                        }
                        all_games.append(game_data)

                    # Get team stats
                    team_stats = {
                        'season': season,
                        'team': team.name,
                        'abbreviation': team.abbreviation,
                        'wins': team.wins,
                        'losses': team.losses,
                        'win_pct': team.win_percentage,
                        'conference': team.conference,
                        'ppg': team.points_per_game,
                        'opp_ppg': team.points_allowed_per_game,
                        'fg_pct': team.field_goal_percentage,
                        'three_pct': team.three_point_percentage,
                        'ft_pct': team.free_throw_percentage,
                        'rebounds_pg': team.rebounds_per_game,
                        'assists_pg': team.assists_per_game,
                        'turnovers_pg': team.turnovers_per_game,
                        'steals_pg': team.steals_per_game,
                        'blocks_pg': team.blocks_per_game,
                    }
                    all_teams_stats.append(team_stats)

                except Exception as e:
                    print(f"    ⚠ Error with {team.name}: {str(e)}")
                    continue

        return pd.DataFrame(all_games), pd.DataFrame(all_teams_stats)

    except ImportError:
        print("\n⚠ sportsipy not installed. Using alternative data source...")
        return fetch_cbb_alternative(seasons)


def fetch_cbb_alternative(seasons):
    """
    Alternative data collection using ESPN API
    ESPN has public CBB endpoints
    """
    print("\n✓ Using ESPN API for data collection")

    all_games = []

    for season in seasons:
        print(f"\nFetching {season-1}-{season} season...")

        # ESPN uses academic year format (2024-25 = 2025)
        # Fetch games from November through March
        start_date = datetime(season-1, 11, 1)
        end_date = datetime(season, 4, 10)  # Through NCAA Tournament

        # ESPN Scoreboard API (public)
        current_date = start_date

        while current_date <= end_date:
            date_str = current_date.strftime('%Y%m%d')
            url = f"https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates={date_str}"

            try:
                response = requests.get(url, timeout=10)
                if response.status_code == 200:
                    data = response.json()

                    if 'events' in data:
                        for event in data['events']:
                            try:
                                competition = event['competitions'][0]
                                home_team = competition['competitors'][0] if competition['competitors'][0]['homeAway'] == 'home' else competition['competitors'][1]
                                away_team = competition['competitors'][1] if competition['competitors'][0]['homeAway'] == 'home' else competition['competitors'][0]

                                # Only include completed games
                                if competition['status']['type']['completed']:
                                    game_data = {
                                        'season': season,
                                        'date': event['date'],
                                        'home_team': home_team['team']['displayName'],
                                        'away_team': away_team['team']['displayName'],
                                        'home_score': int(home_team['score']),
                                        'away_score': int(away_team['score']),
                                        'is_neutral': competition.get('neutralSite', False),
                                        'is_conference': event.get('season', {}).get('type') == 2,  # 2 = Conference
                                        'home_abbr': home_team['team']['abbreviation'],
                                        'away_abbr': away_team['team']['abbreviation'],
                                    }
                                    all_games.append(game_data)
                            except Exception as e:
                                continue

                    if current_date.day == 1 and current_date.month % 2 == 0:
                        print(f"  Progress: {current_date.strftime('%B %Y')} ({len(all_games)} games)")

            except Exception as e:
                print(f"  ⚠ Error fetching {date_str}: {str(e)}")

            current_date += timedelta(days=1)

    games_df = pd.DataFrame(all_games)

    # Calculate team stats from games
    teams_stats = calculate_team_stats_from_games(games_df)

    return games_df, teams_stats


def calculate_team_stats_from_games(games_df):
    """Calculate team statistics from game data"""
    all_teams = pd.concat([games_df['home_team'], games_df['away_team']]).unique()

    team_stats = []

    for team in all_teams:
        home_games = games_df[games_df['home_team'] == team]
        away_games = games_df[games_df['away_team'] == team]

        total_games = len(home_games) + len(away_games)

        if total_games == 0:
            continue

        # Calculate wins
        home_wins = (home_games['home_score'] > home_games['away_score']).sum()
        away_wins = (away_games['away_score'] > away_games['home_score']).sum()
        wins = home_wins + away_wins
        losses = total_games - wins

        # Calculate scoring
        home_points = home_games['home_score'].sum()
        away_points = away_games['away_score'].sum()
        total_points = home_points + away_points

        home_opp_points = home_games['away_score'].sum()
        away_opp_points = away_games['home_score'].sum()
        total_opp_points = home_opp_points + away_opp_points

        stats = {
            'team': team,
            'wins': wins,
            'losses': losses,
            'win_pct': wins / total_games if total_games > 0 else 0,
            'ppg': total_points / total_games if total_games > 0 else 0,
            'opp_ppg': total_opp_points / total_games if total_games > 0 else 0,
            'point_diff': (total_points - total_opp_points) / total_games if total_games > 0 else 0,
        }

        team_stats.append(stats)

    return pd.DataFrame(team_stats)


# Main execution
print("\nStarting data collection for college basketball...")
print("Seasons: 2020-2025 (6 seasons)")

seasons = [2020, 2021, 2022, 2023, 2024, 2025]

# Try sportsipy first, fall back to ESPN API
games_df, teams_df = fetch_cbb_alternative(seasons)

# Save raw data
print("\n" + "="*70)
print("SAVING DATA")
print("="*70)

games_df.to_csv('ml_cbb/data/cbb_games_raw.csv', index=False)
teams_df.to_csv('ml_cbb/data/cbb_teams_raw.csv', index=False)

print(f"\n✓ Games saved: {len(games_df)} games")
print(f"✓ Teams saved: {len(teams_df)} team-seasons")

# Display sample
print("\n" + "="*70)
print("SAMPLE DATA")
print("="*70)
print("\nRecent games:")
print(games_df.tail(10)[['date', 'home_team', 'away_team', 'home_score', 'away_score']])

print("\nTop teams by point differential:")
top_teams = teams_df.nlargest(10, 'point_diff')[['team', 'wins', 'losses', 'ppg', 'opp_ppg', 'point_diff']]
print(top_teams)

print("\n" + "="*70)
print("DATA COLLECTION COMPLETE!")
print("="*70)
print("\nNext step: Run cbb_feature_engineering.py")
print("This will add momentum, streaks, and team dynamics features")
