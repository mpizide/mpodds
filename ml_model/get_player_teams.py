import nfl_data_py as nfl
import json

# Get current season rosters (2025)
rosters = nfl.import_seasonal_rosters([2025])

# Create player to team mapping
player_team_map = {}

for _, player in rosters.iterrows():
    player_name = player['player_name']
    team = player['team']

    # Store player name -> team abbreviation
    player_team_map[player_name] = team

# Save to JSON file
output_file = '../src/player_teams.json'
with open(output_file, 'w') as f:
    json.dump(player_team_map, f, indent=2)

print(f'OK - Player-team mappings saved to {output_file}')
print(f'Total players: {len(player_team_map)}')
