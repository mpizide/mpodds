"""
CUSTOM FEATURE ENGINEERING - ADD YOUR OWN TRENDS HERE!

This file is separate from the main feature engineering so you can easily
add new features as you notice trends throughout the season.

HOW TO ADD A NEW FEATURE:
1. Create a function that calculates your feature
2. Add it to the calculate_custom_features() function
3. Re-run feature engineering and model training

EXAMPLES OF FEATURES TO ADD:
- Rest days (back-to-back games hurt performance)
- Referee tendencies (some refs call more fouls)
- Altitude effects (Denver, Air Force)
- Tournament time (March Madness affects motivation)
- Star player injury impact
- Coaching changes
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# ============================================================================
# FEATURE 1: TRAVEL DISTANCE TRACKING
# ============================================================================

def get_team_location(team_name):
    """
    Get latitude/longitude for team's home city
    Used to calculate travel distance
    """
    # Major college basketball team locations
    team_locations = {
        # ACC
        'Duke': (35.9940, -78.8986),  # Durham, NC
        'North Carolina': (35.9132, -79.0558),  # Chapel Hill, NC
        'NC State': (35.7847, -78.6821),  # Raleigh, NC
        'Virginia': (38.0336, -78.5080),  # Charlottesville, VA
        'Miami': (25.7617, -80.1918),  # Miami, FL
        'Syracuse': (43.0481, -76.1474),  # Syracuse, NY
        'Louisville': (38.2527, -85.7585),  # Louisville, KY
        'Florida State': (30.4383, -84.2807),  # Tallahassee, FL
        'Clemson': (34.6834, -82.8374),  # Clemson, SC
        'Wake Forest': (36.1349, -80.2795),  # Winston-Salem, NC
        'Pittsburgh': (40.4406, -79.9959),  # Pittsburgh, PA
        'Boston College': (42.3601, -71.0589),  # Boston, MA
        'Georgia Tech': (33.7756, -84.3963),  # Atlanta, GA
        'Notre Dame': (41.6764, -86.2520),  # South Bend, IN
        'Virginia Tech': (37.2296, -80.4139),  # Blacksburg, VA

        # Big Ten
        'Purdue': (40.4237, -86.9212),  # West Lafayette, IN
        'Michigan State': (42.7325, -84.5555),  # East Lansing, MI
        'Illinois': (40.1106, -88.2073),  # Champaign, IL
        'Wisconsin': (43.0731, -89.4012),  # Madison, WI
        'Indiana': (39.1653, -86.5264),  # Bloomington, IN
        'Ohio State': (40.0067, -83.0305),  # Columbus, OH
        'Michigan': (42.2808, -83.7430),  # Ann Arbor, MI
        'Iowa': (41.6611, -91.5302),  # Iowa City, IA
        'Maryland': (38.9869, -76.9426),  # College Park, MD
        'Penn State': (40.7982, -77.8599),  # State College, PA
        'UCLA': (34.0689, -118.4452),  # Los Angeles, CA
        'USC': (34.0224, -118.2851),  # Los Angeles, CA

        # Big 12
        'Kansas': (38.9543, -95.2558),  # Lawrence, KS
        'Baylor': (31.5497, -97.1143),  # Waco, TX
        'Texas': (30.2849, -97.7341),  # Austin, TX
        'Texas Tech': (33.5779, -101.8552),  # Lubbock, TX
        'Kansas State': (39.1836, -96.5717),  # Manhattan, KS
        'TCU': (32.7357, -97.3314),  # Fort Worth, TX
        'Oklahoma State': (36.1280, -97.0722),  # Stillwater, OK
        'West Virginia': (39.6295, -79.9559),  # Morgantown, WV
        'Iowa State': (42.0267, -93.6465),  # Ames, IA
        'Houston': (29.7604, -95.3698),  # Houston, TX
        'Cincinnati': (39.1031, -84.5120),  # Cincinnati, OH
        'UCF': (28.5383, -81.3792),  # Orlando, FL
        'BYU': (40.2338, -111.6585),  # Provo, UT

        # SEC
        'Alabama': (33.2098, -87.5692),  # Tuscaloosa, AL
        'Auburn': (32.5990, -85.4808),  # Auburn, AL
        'Arkansas': (36.0686, -94.1748),  # Fayetteville, AR
        'Florida': (29.6516, -82.3248),  # Gainesville, FL
        'Georgia': (33.9519, -83.3576),  # Athens, GA
        'Kentucky': (38.0406, -84.5037),  # Lexington, KY
        'LSU': (30.4515, -91.1871),  # Baton Rouge, LA
        'Mississippi State': (33.4551, -88.7884),  # Starkville, MS
        'Missouri': (38.9517, -92.3341),  # Columbia, MO
        'Ole Miss': (34.3665, -89.5348),  # Oxford, MS
        'South Carolina': (34.0007, -81.0348),  # Columbia, SC
        'Tennessee': (35.9606, -83.9210),  # Knoxville, TN
        'Texas A&M': (30.6280, -96.3344),  # College Station, TX
        'Vanderbilt': (36.1447, -86.8027),  # Nashville, TN

        # Big East
        'UConn': (41.8084, -72.2529),  # Storrs, CT
        'Villanova': (40.0379, -75.3437),  # Villanova, PA
        'Creighton': (41.2565, -95.9345),  # Omaha, NE
        'Marquette': (43.0389, -87.9065),  # Milwaukee, WI
        'Xavier': (39.1015, -84.5120),  # Cincinnati, OH
        'Providence': (41.8240, -71.4128),  # Providence, RI
        'Butler': (39.8403, -86.1686),  # Indianapolis, IN
        'Seton Hall': (40.7357, -74.1724),  # South Orange, NJ

        # Other Major Programs
        'Gonzaga': (47.6588, -117.4260),  # Spokane, WA
        'San Diego State': (32.7157, -117.1611),  # San Diego, CA
        'Memphis': (35.1495, -90.0490),  # Memphis, TN
        'Wichita State': (37.6872, -97.3301),  # Wichita, KS
    }

    # Try to match team name
    for key, location in team_locations.items():
        if key.lower() in team_name.lower() or team_name.lower() in key.lower():
            return location

    # Default to middle of US if not found
    return (39.8283, -98.5795)  # Geographic center of US


def calculate_travel_distance(team1, team2):
    """
    Calculate travel distance in miles between two teams
    Uses Haversine formula for great circle distance
    """
    lat1, lon1 = get_team_location(team1)
    lat2, lon2 = get_team_location(team2)

    # Haversine formula
    R = 3959  # Earth radius in miles

    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)

    a = (np.sin(dlat/2) * np.sin(dlat/2) +
         np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) *
         np.sin(dlon/2) * np.sin(dlon/2))

    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1-a))
    distance = R * c

    return distance


def calculate_travel_fatigue(team_games, current_date, team_name):
    """
    Calculate cumulative travel fatigue
    Tracks total miles traveled in last 7 days
    """
    # Get games in last 7 days
    week_ago = current_date - timedelta(days=7)
    recent_games = team_games[team_games['date'] >= week_ago]

    total_miles = 0
    flight_trips = 0  # Trips > 500 miles (requires flight)

    for _, game in recent_games.iterrows():
        # Determine if team was home or away
        if game.get('is_home', 0) == 0:  # Away game
            opponent = game.get('opponent', '')
            distance = calculate_travel_distance(team_name, opponent)
            total_miles += distance

            if distance > 500:
                flight_trips += 1

    return {
        'total_miles_7days': total_miles,
        'flight_trips_7days': flight_trips,
        'avg_trip_distance': total_miles / len(recent_games) if len(recent_games) > 0 else 0
    }


# ============================================================================
# FEATURE 2: REST DAYS (Easy to add!)
# ============================================================================

def calculate_rest_days(team_games, current_date):
    """
    Calculate days of rest since last game
    Back-to-back games (0 days rest) hurt performance
    """
    past_games = team_games[team_games['date'] < current_date].sort_values('date')

    if len(past_games) == 0:
        return 7  # Default if no prior games

    last_game_date = past_games.iloc[-1]['date']
    days_rest = (current_date - last_game_date).days

    return min(days_rest, 7)  # Cap at 7 days


# ============================================================================
# FEATURE 3: YOUR CUSTOM FEATURES GO HERE!
# ============================================================================

def calculate_altitude_effect(home_team, away_team):
    """
    Example: High altitude affects visiting teams
    Denver, Air Force, New Mexico are at high elevation

    ADD YOUR OWN LOGIC HERE!
    """
    high_altitude_teams = ['Denver', 'Air Force', 'New Mexico', 'Wyoming', 'Colorado State']

    home_altitude = 1 if any(team in home_team for team in high_altitude_teams) else 0
    away_altitude = 1 if any(team in away_team for team in high_altitude_teams) else 0

    # Advantage if home team at altitude and away team isn't
    altitude_advantage = home_altitude * (1 - away_altitude)

    return altitude_advantage


def calculate_time_of_season(season_progress):
    """
    Example: Teams play differently in March Madness time

    ADD YOUR OWN LOGIC HERE!
    """
    if season_progress < 10:
        return 'early'  # Non-conference
    elif season_progress < 25:
        return 'mid'  # Conference play
    else:
        return 'late'  # Tournament time - intensity increases


# ============================================================================
# MAIN FUNCTION: ADD ALL YOUR CUSTOM FEATURES HERE
# ============================================================================

def calculate_custom_features(game, home_team_games, away_team_games, home_team, away_team):
    """
    Calculate all custom features for a game

    TO ADD A NEW FEATURE:
    1. Write a function above (like calculate_altitude_effect)
    2. Call it here and add to the features dict
    3. Re-run feature engineering
    """
    game_date = game['date']
    home_progress = home_team_games[home_team_games['date'] < game_date].iloc[-1]['season_progress'] if len(home_team_games[home_team_games['date'] < game_date]) > 0 else 0
    away_progress = away_team_games[away_team_games['date'] < game_date].iloc[-1]['season_progress'] if len(away_team_games[away_team_games['date'] < game_date]) > 0 else 0

    # TRAVEL FEATURES
    travel_distance = calculate_travel_distance(away_team, home_team)
    away_travel_fatigue = calculate_travel_fatigue(away_team_games, game_date, away_team)

    # REST FEATURES
    home_rest_days = calculate_rest_days(home_team_games, game_date)
    away_rest_days = calculate_rest_days(away_team_games, game_date)

    # ALTITUDE FEATURES
    altitude_advantage = calculate_altitude_effect(home_team, away_team)

    # TIME OF SEASON
    season_phase = calculate_time_of_season(home_progress)

    features = {
        # TRAVEL
        'travel_distance': travel_distance,
        'is_flight_game': 1 if travel_distance > 500 else 0,
        'is_long_flight': 1 if travel_distance > 1500 else 0,
        'away_travel_miles_7days': away_travel_fatigue['total_miles_7days'],
        'away_flight_trips_7days': away_travel_fatigue['flight_trips_7days'],

        # REST
        'home_rest_days': home_rest_days,
        'away_rest_days': away_rest_days,
        'rest_advantage': home_rest_days - away_rest_days,
        'is_back_to_back': 1 if (home_rest_days <= 1 or away_rest_days <= 1) else 0,

        # ALTITUDE
        'altitude_advantage': altitude_advantage,

        # SEASON PHASE
        'is_early_season_phase': 1 if season_phase == 'early' else 0,
        'is_tournament_time': 1 if season_phase == 'late' else 0,

        # ADD YOUR CUSTOM FEATURES BELOW THIS LINE!
        # ==========================================
        # Example:
        # 'rivalry_game': check_if_rivalry(home_team, away_team),
        # 'coach_history': get_coach_matchup_history(home_team, away_team),
        # 'star_player_out': check_injuries(home_team, away_team),
    }

    return features


# ============================================================================
# AUTOMATIC FEATURE INTERACTION DISCOVERY
# ============================================================================

def create_interaction_features(features_dict):
    """
    Automatically creates interaction features
    Model can discover non-obvious patterns like:
    - "Travel distance matters MORE when team is on back-to-back"
    - "Momentum matters MORE in conference games"
    """
    interactions = {}

    # Key interactions to explore
    if 'travel_distance' in features_dict and 'away_rest_days' in features_dict:
        # Travel hurts more when tired
        interactions['travel_x_fatigue'] = features_dict['travel_distance'] * (1 / max(features_dict['away_rest_days'], 1))

    if 'streak_differential' in features_dict and 'is_conference_game' in features_dict:
        # Momentum matters more in conference games
        interactions['momentum_x_conference'] = features_dict.get('streak_differential', 0) * features_dict['is_conference_game']

    if 'conf_strength_differential' in features_dict and 'is_neutral_site' in features_dict:
        # Conference strength matters more on neutral courts
        interactions['conf_strength_x_neutral'] = features_dict.get('conf_strength_differential', 0) * features_dict['is_neutral_site']

    return interactions


# ============================================================================
# USAGE EXAMPLE
# ============================================================================

if __name__ == "__main__":
    print("="*70)
    print("CUSTOM FEATURES MODULE")
    print("="*70)
    print("\nThis module contains custom features you can easily modify.")
    print("\nAvailable features:")
    print("  - Travel distance tracking")
    print("  - Rest days (back-to-back games)")
    print("  - Altitude effects")
    print("  - Season phase (early/mid/late)")
    print("  - Automatic feature interactions")
    print("\nTo add a new feature:")
    print("  1. Add your function to this file")
    print("  2. Call it in calculate_custom_features()")
    print("  3. Re-run: python ml_cbb/cbb_feature_engineering.py")
    print("="*70)
