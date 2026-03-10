"""
College Basketball Data Collection Script
Fetches historical game data, team stats, and creates training dataset
"""

import pandas as pd
import numpy as np
import os
from datetime import datetime, timedelta
import requests

os.makedirs("ml_cbb/data", exist_ok=True)

print("=" * 70)
print("COLLEGE BASKETBALL DATA COLLECTION")
print("=" * 70)


def fetch_cbb_alternative(seasons, start_from_date=None):
    """Fetch CBB game data from ESPN public API."""
    print("Using ESPN API for data collection")
    all_games = []

    for season in seasons:
        if start_from_date:
            start_date = start_from_date
            print("Fetching {}-{} season from {} onward...".format(season-1, season, start_date.date()))
        else:
            start_date = datetime(season-1, 11, 1)
            print("Fetching full {}-{} season...".format(season-1, season))

        end_date = min(datetime(season, 4, 10), datetime.now())
        # Strip timezone info so comparisons work
        if hasattr(start_date, "tzinfo") and start_date.tzinfo is not None:
            start_date = start_date.replace(tzinfo=None)
        current_date = start_date

        while current_date <= end_date:
            # Skip offseason months (May through October - no CBB games)
            if current_date.month in (5, 6, 7, 8, 9, 10):
                current_date = current_date.replace(day=1, month=11)
                continue
            date_str = current_date.strftime("%Y%m%d")
            url = "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=" + date_str

            try:
                response = requests.get(url, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    if "events" in data:
                        for event in data["events"]:
                            try:
                                competition = event["competitions"][0]
                                comps = competition["competitors"]
                                home_team = comps[0] if comps[0]["homeAway"] == "home" else comps[1]
                                away_team = comps[1] if comps[0]["homeAway"] == "home" else comps[0]
                                if competition["status"]["type"]["completed"]:
                                    all_games.append({
                                        "season": season,
                                        "date": event["date"],
                                        "home_team": home_team["team"]["displayName"],
                                        "away_team": away_team["team"]["displayName"],
                                        "home_score": int(home_team["score"]),
                                        "away_score": int(away_team["score"]),
                                        "is_neutral": competition.get("neutralSite", False),
                                        "is_conference": event.get("season", {}).get("type") == 2,
                                        "home_abbr": home_team["team"]["abbreviation"],
                                        "away_abbr": away_team["team"]["abbreviation"],
                                    })
                            except Exception:
                                continue
                    if current_date.day == 1 and current_date.month % 2 == 0:
                        print("  Progress: {} ({} games)".format(current_date.strftime("%B %Y"), len(all_games)))
            except Exception as e:
                print("  Warning fetching {}: {}".format(date_str, str(e)))

            current_date += timedelta(days=1)

    games_df = pd.DataFrame(all_games) if all_games else pd.DataFrame()
    teams_stats = calculate_team_stats_from_games(games_df) if len(games_df) > 0 else pd.DataFrame()
    return games_df, teams_stats


def calculate_team_stats_from_games(games_df):
    """Calculate team statistics from game data."""
    all_teams = pd.concat([games_df["home_team"], games_df["away_team"]]).unique()
    team_stats = []

    for team in all_teams:
        home_games = games_df[games_df["home_team"] == team]
        away_games = games_df[games_df["away_team"] == team]
        total_games = len(home_games) + len(away_games)
        if total_games == 0:
            continue

        home_wins = (home_games["home_score"] > home_games["away_score"]).sum()
        away_wins = (away_games["away_score"] > away_games["home_score"]).sum()
        wins = home_wins + away_wins

        total_points = home_games["home_score"].sum() + away_games["away_score"].sum()
        total_opp = home_games["away_score"].sum() + away_games["home_score"].sum()

        team_stats.append({
            "team": team,
            "wins": wins,
            "losses": total_games - wins,
            "win_pct": wins / total_games,
            "ppg": total_points / total_games,
            "opp_ppg": total_opp / total_games,
            "point_diff": (total_points - total_opp) / total_games,
        })

    return pd.DataFrame(team_stats)


# Main execution
CURRENT_SEASON = datetime.now().year if datetime.now().month >= 10 else datetime.now().year
RAW_CSV = "ml_cbb/data/cbb_games_raw.csv"

if os.path.exists(RAW_CSV):
    existing_df = pd.read_csv(RAW_CSV)
    last_date = pd.to_datetime(existing_df["date"]).max()
    start_from = last_date + timedelta(days=1)

    print("Existing data: {} games (most recent: {})".format(len(existing_df), last_date.date()))
    print("Fetching new games from {} through today...".format(start_from.date()))

    new_games_df, _ = fetch_cbb_alternative([CURRENT_SEASON], start_from_date=start_from)

    if len(new_games_df) > 0:
        combined = pd.concat([existing_df, new_games_df], ignore_index=True)
        combined.drop_duplicates(subset=["date", "home_team", "away_team"], keep="last", inplace=True)
        games_df = combined
        teams_df = calculate_team_stats_from_games(games_df)
        print("Added {} new games! Total: {}".format(len(new_games_df), len(games_df)))
    else:
        print("No new completed games found since last update.")
        games_df = existing_df
        teams_df = calculate_team_stats_from_games(games_df)
else:
    print("First run -- collecting 3 seasons of history (2022-2025)...")
    games_df, teams_df = fetch_cbb_alternative([2022, 2023, 2024, 2025])

print("=" * 70)
print("SAVING DATA")
print("=" * 70)

games_df.to_csv("ml_cbb/data/cbb_games_raw.csv", index=False)
teams_df.to_csv("ml_cbb/data/cbb_teams_raw.csv", index=False)

print("Games saved: {} games".format(len(games_df)))
print("Most recent games:")
print(games_df.tail(5)[["date", "home_team", "away_team", "home_score", "away_score"]])

print("=" * 70)
print("DATA COLLECTION COMPLETE!")
print("=" * 70)
print("Next step: Run cbb_feature_engineering.py")
