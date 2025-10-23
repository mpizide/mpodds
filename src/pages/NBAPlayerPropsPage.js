import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getNBAPlayerProps } from '../services/oddsAPI';
import { calculateEV } from '../utils/oddsCalculations';
import { calculateNBAPropProbability } from '../utils/nbaPlayerPropPredictions';
import nbaPlayerTeamsData from '../nba_player_teams.json';

const NBAPlayerPropsPage = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [propsData, setPropsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const [gameInfo, setGameInfo] = useState({ homeTeam: '', awayTeam: '', commence_time: '' });
  const [selectedBookmakers, setSelectedBookmakers] = useState(() => {
    const saved = localStorage.getItem('nba_selectedBookmakers');
    return saved ? JSON.parse(saved) : [];
  });
  const [availableBookmakers, setAvailableBookmakers] = useState([]);
  const [showBookmakerDropdown, setShowBookmakerDropdown] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null); // null means show all teams
  const dropdownRef = useRef(null);

  const getTeamAbbreviation = (fullTeamName) => {
    const teamAbbreviations = {
      'Atlanta Hawks': 'ATL',
      'Boston Celtics': 'BOS',
      'Brooklyn Nets': 'BKN',
      'Charlotte Hornets': 'CHA',
      'Chicago Bulls': 'CHI',
      'Cleveland Cavaliers': 'CLE',
      'Dallas Mavericks': 'DAL',
      'Denver Nuggets': 'DEN',
      'Detroit Pistons': 'DET',
      'Golden State Warriors': 'GSW',
      'Houston Rockets': 'HOU',
      'Indiana Pacers': 'IND',
      'Los Angeles Clippers': 'LAC',
      'Los Angeles Lakers': 'LAL',
      'Memphis Grizzlies': 'MEM',
      'Miami Heat': 'MIA',
      'Milwaukee Bucks': 'MIL',
      'Minnesota Timberwolves': 'MIN',
      'New Orleans Pelicans': 'NOP',
      'New York Knicks': 'NYK',
      'Oklahoma City Thunder': 'OKC',
      'Orlando Magic': 'ORL',
      'Philadelphia 76ers': 'PHI',
      'Phoenix Suns': 'PHX',
      'Portland Trail Blazers': 'POR',
      'Sacramento Kings': 'SAC',
      'San Antonio Spurs': 'SAS',
      'Toronto Raptors': 'TOR',
      'Utah Jazz': 'UTA',
      'Washington Wizards': 'WAS'
    };
    return teamAbbreviations[fullTeamName] || '';
  };

  const getTeamLogo = (teamName) => {
    const teamLogos = {
      'Atlanta Hawks': 'https://a.espncdn.com/i/teamlogos/nba/500/atl.png',
      'Boston Celtics': 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png',
      'Brooklyn Nets': 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png',
      'Charlotte Hornets': 'https://a.espncdn.com/i/teamlogos/nba/500/cha.png',
      'Chicago Bulls': 'https://a.espncdn.com/i/teamlogos/nba/500/chi.png',
      'Cleveland Cavaliers': 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png',
      'Dallas Mavericks': 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png',
      'Denver Nuggets': 'https://a.espncdn.com/i/teamlogos/nba/500/den.png',
      'Detroit Pistons': 'https://a.espncdn.com/i/teamlogos/nba/500/det.png',
      'Golden State Warriors': 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png',
      'Houston Rockets': 'https://a.espncdn.com/i/teamlogos/nba/500/hou.png',
      'Indiana Pacers': 'https://a.espncdn.com/i/teamlogos/nba/500/ind.png',
      'Los Angeles Clippers': 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png',
      'Los Angeles Lakers': 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
      'Memphis Grizzlies': 'https://a.espncdn.com/i/teamlogos/nba/500/mem.png',
      'Miami Heat': 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png',
      'Milwaukee Bucks': 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png',
      'Minnesota Timberwolves': 'https://a.espncdn.com/i/teamlogos/nba/500/min.png',
      'New Orleans Pelicans': 'https://a.espncdn.com/i/teamlogos/nba/500/no.png',
      'New York Knicks': 'https://a.espncdn.com/i/teamlogos/nba/500/ny.png',
      'Oklahoma City Thunder': 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png',
      'Orlando Magic': 'https://a.espncdn.com/i/teamlogos/nba/500/orl.png',
      'Philadelphia 76ers': 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png',
      'Phoenix Suns': 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png',
      'Portland Trail Blazers': 'https://a.espncdn.com/i/teamlogos/nba/500/por.png',
      'Sacramento Kings': 'https://a.espncdn.com/i/teamlogos/nba/500/sac.png',
      'San Antonio Spurs': 'https://a.espncdn.com/i/teamlogos/nba/500/sa.png',
      'Toronto Raptors': 'https://a.espncdn.com/i/teamlogos/nba/500/tor.png',
      'Utah Jazz': 'https://a.espncdn.com/i/teamlogos/nba/500/utah.png',
      'Washington Wizards': 'https://a.espncdn.com/i/teamlogos/nba/500/wsh.png'
    };
    return teamLogos[teamName] || '';
  };

  const getPlayerTeam = (playerName, homeTeam, awayTeam) => {
    const playerTeamFull = nbaPlayerTeamsData[playerName];
    if (!playerTeamFull) {
      // Default to home team if not found
      console.log(`⚠️ Player ${playerName} not found in team data, defaulting to ${homeTeam}`);
      return homeTeam;
    }

    // Direct match with full team names
    if (playerTeamFull === homeTeam) return homeTeam;
    if (playerTeamFull === awayTeam) return awayTeam;

    // Try matching with abbreviations as fallback
    const homeAbbr = getTeamAbbreviation(homeTeam);
    const awayAbbr = getTeamAbbreviation(awayTeam);
    const playerTeamAbbr = getTeamAbbreviation(playerTeamFull);

    if (playerTeamAbbr === homeAbbr) return homeTeam;
    if (playerTeamAbbr === awayAbbr) return awayTeam;

    // If player's team doesn't match either (player not in this game), default to home
    console.log(`⚠️ Player ${playerName} team (${playerTeamFull}) doesn't match ${homeTeam} or ${awayTeam}`);
    return homeTeam;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowBookmakerDropdown(false);
      }
    };

    if (showBookmakerDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showBookmakerDropdown]);

  useEffect(() => {
    const getMarketDisplayName = (marketKey) => {
      const displayNames = {
        player_points: 'Points',
        player_rebounds: 'Rebounds',
        player_assists: 'Assists',
        player_threes: '3-Pointers',
        player_blocks: 'Blocks',
        player_steals: 'Steals',
        player_turnovers: 'Turnovers',
        player_points_rebounds_assists: 'PRA',
        player_points_rebounds: 'Pts+Reb',
        player_points_assists: 'Pts+Ast',
        player_rebounds_assists: 'Reb+Ast'
      };
      return displayNames[marketKey] || marketKey;
    };

    const getPositionFromMarkets = (markets) => {
      const hasPointsProps = markets.some(m => m.includes('points'));
      const hasReboundsProps = markets.some(m => m.includes('rebounds'));
      const hasAssistsProps = markets.some(m => m.includes('assists'));
      const hasBlocksProps = markets.some(m => m.includes('blocks'));

      if (hasAssistsProps && hasPointsProps && !hasReboundsProps && !hasBlocksProps) return 'Guard';
      if (hasReboundsProps || hasBlocksProps) return 'Forward';
      if (hasPointsProps || hasAssistsProps) return 'Guard';
      return 'Other';
    };

    const findBestOdds = (oddsArray, selectedBookmakers) => {
      if (!oddsArray || oddsArray.length === 0) return null;

      // Filter by selected bookmakers if any
      const filteredOdds = selectedBookmakers.length > 0
        ? oddsArray.filter(o => selectedBookmakers.includes(o.bookmaker))
        : oddsArray;

      if (filteredOdds.length === 0) return null;

      return filteredOdds.reduce((best, current) => {
        if (!best) return current;

        if ((current.odds > 0 && current.odds > best.odds) ||
            (current.odds < 0 && best.odds < 0 && current.odds > best.odds) ||
            (current.odds > 0 && best.odds < 0)) {
          return current;
        }
        return best;
      }, null);
    };

    const organizeProps = (data) => {
      if (!data || !data.bookmakers) return {};

      const bookmakerSet = new Set();
      const playerProps = {};

      // Collect all props from all bookmakers
      data.bookmakers.forEach(bookmaker => {
        bookmakerSet.add(bookmaker.title);

        bookmaker.markets?.forEach(market => {
          market.outcomes?.forEach(outcome => {
            const playerName = outcome.description;
            const marketKey = market.key;
            const line = outcome.point;

            if (!playerProps[playerName]) {
              playerProps[playerName] = {
                name: playerName,
                markets: []
              };
            }

            let existingMarket = playerProps[playerName].markets.find(
              m => m.market === marketKey && m.line === line
            );

            if (!existingMarket) {
              existingMarket = {
                market: marketKey,
                marketName: getMarketDisplayName(marketKey),
                line: line,
                overOdds: [],
                underOdds: []
              };
              playerProps[playerName].markets.push(existingMarket);
            }

            if (outcome.name === 'Over') {
              existingMarket.overOdds.push({ odds: outcome.price, bookmaker: bookmaker.title });
            } else if (outcome.name === 'Under') {
              existingMarket.underOdds.push({ odds: outcome.price, bookmaker: bookmaker.title });
            }
          });
        });
      });

      setAvailableBookmakers(Array.from(bookmakerSet).sort());

      // Calculate best odds and EV for each market
      Object.values(playerProps).forEach(player => {
        const marketKeys = player.markets.map(m => m.market);
        player.position = getPositionFromMarkets(marketKeys);

        player.markets.forEach(market => {
          market.bestOver = findBestOdds(market.overOdds, selectedBookmakers);
          market.bestUnder = findBestOdds(market.underOdds, selectedBookmakers);

          // Use ML predictions to calculate probabilities
          const propProbs = calculateNBAPropProbability(player.name, market.market, market.line);

          market.overEV = market.bestOver ? calculateEV(propProbs.overProb, market.bestOver.odds) : null;
          market.underEV = market.bestUnder ? calculateEV(propProbs.underProb, market.bestUnder.odds) : null;
          market.bestEV = Math.max(market.overEV || -Infinity, market.underEV || -Infinity);
          market.mlPrediction = propProbs.prediction; // Store ML prediction
        });
      });

      // Group by position
      const byPosition = {
        Guard: [],
        Forward: [],
        Center: [],
        Other: []
      };

      Object.values(playerProps).forEach(player => {
        byPosition[player.position].push(player);
      });

      return byPosition;
    };

    const fetchPlayerProps = async () => {
      try {
        setLoading(true);
        const response = await getNBAPlayerProps(eventId);
        const data = response.data;

        if (data) {
          setGameInfo({
            homeTeam: data.home_team,
            awayTeam: data.away_team,
            commence_time: data.commence_time
          });
        }

        const organizedProps = organizeProps(data);
        setPropsData(organizedProps);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchPlayerProps();
  }, [eventId, selectedBookmakers]);

  const getTopThreeByEV = (players) => {
    const allMarkets = [];
    players.forEach(player => {
      player.markets.forEach(market => {
        allMarkets.push({ player: player.name, market });
      });
    });

    return allMarkets
      .filter(m => m.market.bestEV !== null && m.market.bestEV !== -Infinity)
      .sort((a, b) => b.market.bestEV - a.market.bestEV)
      .slice(0, 3);
  };

  const getHighlightColor = (market, topThree) => {
    const found = topThree.find(t => t.market === market);
    if (!found) return null;

    const index = topThree.indexOf(found);
    if (index === 0) return '#10b981'; // Green
    if (index === 1) return '#fbbf24'; // Yellow
    if (index === 2) return '#ef4444'; // Red
    return null;
  };

  const theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    cardBg: darkMode ? '#1e293b' : '#ffffff',
    text: darkMode ? '#f1f5f9' : '#1e293b',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    inputBg: darkMode ? '#334155' : '#f1f5f9'
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: theme.bg,
        padding: '40px 20px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <div style={{ color: theme.text, fontSize: '18px' }}>Loading player props...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        background: theme.bg,
        padding: '40px 20px'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          background: theme.cardBg,
          padding: '40px',
          borderRadius: '16px',
          textAlign: 'center'
        }}>
          <div style={{ color: '#ef4444', fontSize: '18px', marginBottom: '20px' }}>
            Error loading player props
          </div>
          <div style={{ color: theme.textSecondary, marginBottom: '20px' }}>{error}</div>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '12px 24px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: theme.bg,
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px',
          flexWrap: 'wrap',
          gap: '15px'
        }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '10px 20px',
              background: theme.cardBg,
              color: theme.text,
              border: `2px solid ${theme.border}`,
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            ← Back to Games
          </button>

          {/* Bookmaker Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontSize: '14px', color: theme.text, fontWeight: '600' }}>
              📚 Sportsbooks:
            </label>
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowBookmakerDropdown(!showBookmakerDropdown)}
                style={{
                  padding: '8px 12px',
                  background: theme.cardBg,
                  color: theme.text,
                  border: `2px solid ${theme.border}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  minWidth: '200px',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>
                  {selectedBookmakers.length === 0
                    ? 'All Sportsbooks'
                    : `${selectedBookmakers.length} selected`}
                </span>
                <span>{showBookmakerDropdown ? '▲' : '▼'}</span>
              </button>

              {showBookmakerDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  background: theme.cardBg,
                  border: `2px solid ${theme.border}`,
                  borderRadius: '8px',
                  padding: '8px',
                  zIndex: 1000,
                  minWidth: '250px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                    paddingBottom: '8px',
                    borderBottom: `1px solid ${theme.border}`
                  }}>
                    <span style={{ fontSize: '12px', color: theme.textSecondary, fontWeight: '600' }}>
                      {selectedBookmakers.length} of {availableBookmakers.length} selected
                    </span>
                    {selectedBookmakers.length > 0 && (
                      <button
                        onClick={() => {
                          setSelectedBookmakers([]);
                          localStorage.removeItem('nba_selectedBookmakers');
                        }}
                        style={{
                          padding: '4px 8px',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  {availableBookmakers.map(book => {
                    const isSelected = selectedBookmakers.includes(book);
                    return (
                      <label
                        key={book}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '6px 8px',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          fontSize: '13px',
                          color: theme.text,
                          background: isSelected ? (darkMode ? '#334155' : '#f1f5f9') : 'transparent'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            const updated = isSelected
                              ? selectedBookmakers.filter(b => b !== book)
                              : [...selectedBookmakers, book];
                            setSelectedBookmakers(updated);
                            localStorage.setItem('nba_selectedBookmakers', JSON.stringify(updated));
                          }}
                          style={{
                            marginRight: '8px',
                            cursor: 'pointer'
                          }}
                        />
                        {book}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setDarkMode(!darkMode)}
            style={{
              padding: '10px 20px',
              background: theme.cardBg,
              color: theme.text,
              border: `2px solid ${theme.border}`,
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>

        {/* Game Info with Team Filter */}
        <div style={{
          background: theme.cardBg,
          padding: '30px',
          borderRadius: '16px',
          marginBottom: '30px',
          border: `1px solid ${theme.border}`
        }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '700',
            color: theme.text,
            margin: '0 0 10px 0'
          }}>
            {gameInfo.awayTeam} @ {gameInfo.homeTeam}
          </h1>
          <div style={{ color: theme.textSecondary, fontSize: '14px', marginBottom: '20px' }}>
            {new Date(gameInfo.commence_time).toLocaleString()}
          </div>

          {/* Team Filter Buttons */}
          <div style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            marginTop: '20px'
          }}>
            <span style={{ fontSize: '14px', color: theme.textSecondary, fontWeight: '600' }}>
              Filter by Team:
            </span>
            <button
              onClick={() => setSelectedTeam(null)}
              style={{
                padding: '8px 16px',
                background: selectedTeam === null ? '#3b82f6' : theme.inputBg,
                color: selectedTeam === null ? 'white' : theme.text,
                border: `2px solid ${selectedTeam === null ? '#3b82f6' : theme.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              All Teams
            </button>
            <button
              onClick={() => setSelectedTeam(gameInfo.homeTeam)}
              style={{
                padding: '8px 16px',
                background: selectedTeam === gameInfo.homeTeam ? '#3b82f6' : theme.inputBg,
                color: selectedTeam === gameInfo.homeTeam ? 'white' : theme.text,
                border: `2px solid ${selectedTeam === gameInfo.homeTeam ? '#3b82f6' : theme.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <img
                src={getTeamLogo(gameInfo.homeTeam)}
                alt={gameInfo.homeTeam}
                style={{ width: '20px', height: '20px', objectFit: 'contain' }}
              />
              {gameInfo.homeTeam}
            </button>
            <button
              onClick={() => setSelectedTeam(gameInfo.awayTeam)}
              style={{
                padding: '8px 16px',
                background: selectedTeam === gameInfo.awayTeam ? '#3b82f6' : theme.inputBg,
                color: selectedTeam === gameInfo.awayTeam ? 'white' : theme.text,
                border: `2px solid ${selectedTeam === gameInfo.awayTeam ? '#3b82f6' : theme.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <img
                src={getTeamLogo(gameInfo.awayTeam)}
                alt={gameInfo.awayTeam}
                style={{ width: '20px', height: '20px', objectFit: 'contain' }}
              />
              {gameInfo.awayTeam}
            </button>
          </div>
        </div>

        {/* Props by Position */}
        {propsData && Object.entries(propsData).map(([position, players]) => {
          if (!players || players.length === 0) return null;

          const topThree = getTopThreeByEV(players);

          return (
            <div key={position} style={{ marginBottom: '40px' }}>
              <h2 style={{
                fontSize: '24px',
                fontWeight: '700',
                color: theme.text,
                marginBottom: '20px'
              }}>
                {position}s
              </h2>

              {players
                .filter(player => player.markets.some(m => m.bestOver || m.bestUnder))
                .filter(player => {
                  if (!selectedTeam) return true; // Show all if no team selected
                  const playerTeam = getPlayerTeam(player.name, gameInfo.homeTeam, gameInfo.awayTeam);
                  return playerTeam === selectedTeam;
                })
                .map((player, idx) => (
                <div
                  key={idx}
                  style={{
                    background: theme.cardBg,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '15px'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '15px'
                  }}>
                    <img
                      src={getTeamLogo(getPlayerTeam(player.name, gameInfo.homeTeam, gameInfo.awayTeam))}
                      alt={getPlayerTeam(player.name, gameInfo.homeTeam, gameInfo.awayTeam)}
                      style={{ width: '35px', height: '35px', objectFit: 'contain' }}
                    />
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      color: theme.text,
                      margin: 0
                    }}>
                      {player.name}
                    </h3>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '12px'
                  }}>
                    {player.markets.filter(market => market.bestOver || market.bestUnder).map((market, mIdx) => {
                      const highlightColor = getHighlightColor(market, topThree);

                      return (
                        <div
                          key={mIdx}
                          style={{
                            background: theme.inputBg,
                            border: highlightColor
                              ? `2px solid ${highlightColor}`
                              : `1px solid ${theme.border}`,
                            borderRadius: '8px',
                            padding: '12px',
                            position: 'relative'
                          }}
                        >
                          {highlightColor && (
                            <div style={{
                              position: 'absolute',
                              top: '6px',
                              right: '6px',
                              fontSize: '16px'
                            }}>
                              {topThree.findIndex(t => t.market === market) === 0 ? '🥇' :
                               topThree.findIndex(t => t.market === market) === 1 ? '🥈' : '🥉'}
                            </div>
                          )}

                          <div style={{
                            fontSize: '12px',
                            fontWeight: '600',
                            color: theme.textSecondary,
                            marginBottom: '4px'
                          }}>
                            {market.marketName}
                          </div>
                          {market.mlPrediction && (
                            <div style={{
                              fontSize: '10px',
                              color: '#3b82f6',
                              marginBottom: '8px',
                              fontWeight: '600'
                            }}>
                              🤖 Pred: {market.mlPrediction.toFixed(1)}
                            </div>
                          )}

                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-around',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            {/* Over */}
                            {market.bestOver && (
                              <div style={{ textAlign: 'center', flex: 1 }}>
                                <div style={{
                                  fontSize: '10px',
                                  color: theme.textSecondary,
                                  marginBottom: '4px'
                                }}>
                                  O {market.line}
                                </div>
                                <div style={{
                                  width: '50px',
                                  height: '50px',
                                  borderRadius: '50%',
                                  border: `2px solid ${market.overEV > 0 ? '#10b981' : theme.border}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  margin: '0 auto',
                                  background: theme.cardBg
                                }}>
                                  <div style={{
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    color: theme.text
                                  }}>
                                    {market.bestOver.odds > 0 ? '+' : ''}{market.bestOver.odds}
                                  </div>
                                </div>
                                <div style={{
                                  fontSize: '9px',
                                  color: theme.textSecondary,
                                  marginTop: '4px'
                                }}>
                                  {market.bestOver.bookmaker}
                                </div>
                              </div>
                            )}

                            {/* Under */}
                            {market.bestUnder && (
                              <div style={{ textAlign: 'center', flex: 1 }}>
                                <div style={{
                                  fontSize: '10px',
                                  color: theme.textSecondary,
                                  marginBottom: '4px'
                                }}>
                                  U {market.line}
                                </div>
                                <div style={{
                                  width: '50px',
                                  height: '50px',
                                  borderRadius: '50%',
                                  border: `2px solid ${market.underEV > 0 ? '#10b981' : theme.border}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  margin: '0 auto',
                                  background: theme.cardBg
                                }}>
                                  <div style={{
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    color: theme.text
                                  }}>
                                    {market.bestUnder.odds > 0 ? '+' : ''}{market.bestUnder.odds}
                                  </div>
                                </div>
                                <div style={{
                                  fontSize: '9px',
                                  color: theme.textSecondary,
                                  marginTop: '4px'
                                }}>
                                  {market.bestUnder.bookmaker}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NBAPlayerPropsPage;
