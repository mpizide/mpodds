import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNFLOdds } from '../services/oddsAPI';
import { calculateEV, findBestOdds, americanToImplied, findBestTotals } from '../utils/oddsCalculations';
import { loadMLPredictions } from '../utils/mlPredictions';

const NFLPage = () => {
  const navigate = useNavigate();
  const [allGames, setAllGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [predictions, setPredictions] = useState({});
  const [darkMode, setDarkMode] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [weeks, setWeeks] = useState([]);
  const [selectedBookmakers, setSelectedBookmakers] = useState(() => {
    // Load from localStorage or default to all
    const saved = localStorage.getItem('selectedBookmakers');
    return saved ? JSON.parse(saved) : [];
  });
  const [availableBookmakers, setAvailableBookmakers] = useState([]);
  const [showBookmakerDropdown, setShowBookmakerDropdown] = useState(false);
  const [unitSize, setUnitSize] = useState(() => {
    const saved = localStorage.getItem('unitSize');
    return saved ? parseFloat(saved) : 1.0;
  });
  const dropdownRef = useRef(null);

  // Save unit size to localStorage
  useEffect(() => {
    localStorage.setItem('unitSize', unitSize.toString());
  }, [unitSize]);

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

  const getTeamLogo = (teamName) => {
    const teamLogos = {
      'Arizona Cardinals': 'https://a.espncdn.com/i/teamlogos/nfl/500/ari.png',
      'Atlanta Falcons': 'https://a.espncdn.com/i/teamlogos/nfl/500/atl.png',
      'Baltimore Ravens': 'https://a.espncdn.com/i/teamlogos/nfl/500/bal.png',
      'Buffalo Bills': 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png',
      'Carolina Panthers': 'https://a.espncdn.com/i/teamlogos/nfl/500/car.png',
      'Chicago Bears': 'https://a.espncdn.com/i/teamlogos/nfl/500/chi.png',
      'Cincinnati Bengals': 'https://a.espncdn.com/i/teamlogos/nfl/500/cin.png',
      'Cleveland Browns': 'https://a.espncdn.com/i/teamlogos/nfl/500/cle.png',
      'Dallas Cowboys': 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png',
      'Denver Broncos': 'https://a.espncdn.com/i/teamlogos/nfl/500/den.png',
      'Detroit Lions': 'https://a.espncdn.com/i/teamlogos/nfl/500/det.png',
      'Green Bay Packers': 'https://a.espncdn.com/i/teamlogos/nfl/500/gb.png',
      'Houston Texans': 'https://a.espncdn.com/i/teamlogos/nfl/500/hou.png',
      'Indianapolis Colts': 'https://a.espncdn.com/i/teamlogos/nfl/500/ind.png',
      'Jacksonville Jaguars': 'https://a.espncdn.com/i/teamlogos/nfl/500/jax.png',
      'Kansas City Chiefs': 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
      'Las Vegas Raiders': 'https://a.espncdn.com/i/teamlogos/nfl/500/lv.png',
      'Los Angeles Chargers': 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png',
      'Los Angeles Rams': 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
      'Miami Dolphins': 'https://a.espncdn.com/i/teamlogos/nfl/500/mia.png',
      'Minnesota Vikings': 'https://a.espncdn.com/i/teamlogos/nfl/500/min.png',
      'New England Patriots': 'https://a.espncdn.com/i/teamlogos/nfl/500/ne.png',
      'New Orleans Saints': 'https://a.espncdn.com/i/teamlogos/nfl/500/no.png',
      'New York Giants': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png',
      'New York Jets': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png',
      'Philadelphia Eagles': 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png',
      'Pittsburgh Steelers': 'https://a.espncdn.com/i/teamlogos/nfl/500/pit.png',
      'San Francisco 49ers': 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png',
      'Seattle Seahawks': 'https://a.espncdn.com/i/teamlogos/nfl/500/sea.png',
      'Tampa Bay Buccaneers': 'https://a.espncdn.com/i/teamlogos/nfl/500/tb.png',
      'Tennessee Titans': 'https://a.espncdn.com/i/teamlogos/nfl/500/ten.png',
      'Washington Commanders': 'https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png'
    };
    return teamLogos[teamName] || '';
  };

  const getTeamShortName = (teamName) => {
    const teamShortNames = {
      'Arizona Cardinals': 'ARI',
      'Atlanta Falcons': 'ATL',
      'Baltimore Ravens': 'BAL',
      'Buffalo Bills': 'BUF',
      'Carolina Panthers': 'CAR',
      'Chicago Bears': 'CHI',
      'Cincinnati Bengals': 'CIN',
      'Cleveland Browns': 'CLE',
      'Dallas Cowboys': 'DAL',
      'Denver Broncos': 'DEN',
      'Detroit Lions': 'DET',
      'Green Bay Packers': 'GB',
      'Houston Texans': 'HOU',
      'Indianapolis Colts': 'IND',
      'Jacksonville Jaguars': 'JAX',
      'Kansas City Chiefs': 'KC',
      'Las Vegas Raiders': 'LV',
      'Los Angeles Chargers': 'LAC',
      'Los Angeles Rams': 'LAR',
      'Miami Dolphins': 'MIA',
      'Minnesota Vikings': 'MIN',
      'New England Patriots': 'NE',
      'New Orleans Saints': 'NO',
      'New York Giants': 'NYG',
      'New York Jets': 'NYJ',
      'Philadelphia Eagles': 'PHI',
      'Pittsburgh Steelers': 'PIT',
      'San Francisco 49ers': 'SF',
      'Seattle Seahawks': 'SEA',
      'Tampa Bay Buccaneers': 'TB',
      'Tennessee Titans': 'TEN',
      'Washington Commanders': 'WAS'
    };
    return teamShortNames[teamName] || teamName;
  };

  const groupGamesByWeek = (games) => {
    // 2025 NFL Season starts September 4, 2025 (Week 1)
    const NFL_START_DATE = new Date('2025-09-04T00:00:00');
    const WEEK_DURATION = 7 * 24 * 60 * 60 * 1000;

    const gamesByWeek = {};

    games.forEach(game => {
      const gameDate = new Date(game.commence_time);

      // Calculate weeks since season start
      const weeksSinceStart = Math.floor((gameDate - NFL_START_DATE) / WEEK_DURATION);
      const weekNumber = weeksSinceStart + 1;

      // Ensure week numbers are reasonable (1-22 for regular season + playoffs)
      if (weekNumber > 0 && weekNumber <= 22) {
        if (!gamesByWeek[weekNumber]) {
          gamesByWeek[weekNumber] = [];
        }
        gamesByWeek[weekNumber].push(game);
      }
    });

    return gamesByWeek;
  };

  const fetchGames = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getNFLOdds();
      setAllGames(data);
      
      const gamesByWeek = groupGamesByWeek(data);
      const weekNumbers = Object.keys(gamesByWeek).map(Number).sort((a, b) => a - b);
      setWeeks(weekNumbers);
      
      if (weekNumbers.length > 0 && !selectedWeek) {
        const currentWeek = weekNumbers.find(week => {
          const weekGames = gamesByWeek[week];
          return weekGames.some(game => new Date(game.commence_time) > new Date());
        }) || weekNumbers[0];
        setSelectedWeek(currentWeek);
      }

      // Extract all unique bookmakers from games
      const bookmakerSet = new Set();
      data.forEach(game => {
        game.bookmakers?.forEach(book => {
          bookmakerSet.add(book.title);
        });
      });
      const allBookmakers = Array.from(bookmakerSet).sort();
      setAvailableBookmakers(allBookmakers);

      // Try to load ML predictions first
      const mlPredictions = loadMLPredictions(data);

      const initialPredictions = {};
      data.forEach(game => {
        // Use ML predictions if available, otherwise fall back to implied odds
        if (mlPredictions[game.id]) {
          initialPredictions[game.id] = mlPredictions[game.id];
        } else {
          // Fallback to implied odds calculation
          const homeBest = findBestOdds(game.bookmakers, 'h2h', game.home_team);
          const awayBest = findBestOdds(game.bookmakers, 'h2h', game.away_team);

          initialPredictions[game.id] = {};

          if (homeBest && awayBest) {
            const homeImplied = americanToImplied(homeBest.odds);
            const awayImplied = americanToImplied(awayBest.odds);
            const total = homeImplied + awayImplied;

            initialPredictions[game.id][`${game.home_team}_ml`] = ((homeImplied / total) * 100).toFixed(1);
            initialPredictions[game.id][`${game.away_team}_ml`] = ((awayImplied / total) * 100).toFixed(1);
          }

          const homeBestSpread = findBestOdds(game.bookmakers, 'spreads', game.home_team);
          const awayBestSpread = findBestOdds(game.bookmakers, 'spreads', game.away_team);

          if (homeBestSpread && awayBestSpread) {
            const homeSpreadImplied = americanToImplied(homeBestSpread.odds);
            const awaySpreadImplied = americanToImplied(awayBestSpread.odds);
            const spreadTotal = homeSpreadImplied + awaySpreadImplied;

            initialPredictions[game.id][`${game.home_team}_spread`] = ((homeSpreadImplied / spreadTotal) * 100).toFixed(1);
            initialPredictions[game.id][`${game.away_team}_spread`] = ((awaySpreadImplied / spreadTotal) * 100).toFixed(1);
          } else {
            initialPredictions[game.id][`${game.home_team}_spread`] = '50.0';
            initialPredictions[game.id][`${game.away_team}_spread`] = '50.0';
          }

          const overBest = findBestTotals(game.bookmakers, 'Over');
          const underBest = findBestTotals(game.bookmakers, 'Under');

          if (overBest && underBest) {
            const overImplied = americanToImplied(overBest.odds);
            const underImplied = americanToImplied(underBest.odds);
            const totalsTotal = overImplied + underImplied;

            initialPredictions[game.id]['over'] = ((overImplied / totalsTotal) * 100).toFixed(1);
            initialPredictions[game.id]['under'] = ((underImplied / totalsTotal) * 100).toFixed(1);
          } else {
            initialPredictions[game.id]['over'] = '50.0';
            initialPredictions[game.id]['under'] = '50.0';
          }
        }
      });

      setPredictions(initialPredictions);
      setError(null);
    } catch (err) {
      setError('Failed to fetch games. Check your API key.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedWeek]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  const updatePrediction = (gameId, key, probability) => {
    setPredictions(prev => ({
      ...prev,
      [gameId]: { ...prev[gameId], [key]: probability }
    }));
  };

  const getFilteredGames = () => {
    if (!selectedWeek) return [];
    const gamesByWeek = groupGamesByWeek(allGames);
    return gamesByWeek[selectedWeek] || [];
  };

  const getAllRankedBets = () => {
    const games = getFilteredGames();
    const allBets = [];
    
    games.forEach(game => {
      const gameId = game.id;
      const homeTeam = game.home_team;
      const awayTeam = game.away_team;
      
      const homeBestML = findBestOdds(game.bookmakers, 'h2h', homeTeam);
      const awayBestML = findBestOdds(game.bookmakers, 'h2h', awayTeam);
      const homePredML = predictions[gameId]?.[`${homeTeam}_ml`];
      const awayPredML = predictions[gameId]?.[`${awayTeam}_ml`];
      
      if (homePredML && homeBestML) {
        const ev = calculateEV(homePredML, homeBestML.odds);
        if (ev !== null) {
          allBets.push({ gameId, type: 'ml', team: homeTeam, ev });
        }
      }
      if (awayPredML && awayBestML) {
        const ev = calculateEV(awayPredML, awayBestML.odds);
        if (ev !== null) {
          allBets.push({ gameId, type: 'ml', team: awayTeam, ev });
        }
      }
      
      const homeBestSpread = findBestOdds(game.bookmakers, 'spreads', homeTeam);
      const awayBestSpread = findBestOdds(game.bookmakers, 'spreads', awayTeam);
      const homePredSpread = predictions[gameId]?.[`${homeTeam}_spread`];
      const awayPredSpread = predictions[gameId]?.[`${awayTeam}_spread`];
      
      if (homePredSpread && homeBestSpread) {
        const ev = calculateEV(homePredSpread, homeBestSpread.odds);
        if (ev !== null) {
          allBets.push({ gameId, type: 'spread', team: homeTeam, ev });
        }
      }
      if (awayPredSpread && awayBestSpread) {
        const ev = calculateEV(awayPredSpread, awayBestSpread.odds);
        if (ev !== null) {
          allBets.push({ gameId, type: 'spread', team: awayTeam, ev });
        }
      }
      
      const overBest = findBestTotals(game.bookmakers, 'Over');
      const underBest = findBestTotals(game.bookmakers, 'Under');
      const overPred = predictions[gameId]?.['over'];
      const underPred = predictions[gameId]?.['under'];
      
      if (overPred && overBest) {
        const ev = calculateEV(overPred, overBest.odds);
        if (ev !== null) {
          allBets.push({ gameId, type: 'total', team: 'Over', ev });
        }
      }
      if (underPred && underBest) {
        const ev = calculateEV(underPred, underBest.odds);
        if (ev !== null) {
          allBets.push({ gameId, type: 'total', team: 'Under', ev });
        }
      }
    });
    
    return allBets.sort((a, b) => b.ev - a.ev);
  };

  const getBorderColor = (gameId, type, team) => {
    const rankedBets = getAllRankedBets();
    const games = getFilteredGames();
    const totalGames = games.length;

    const topBets = [];
    const seenGames = new Set(); // Track which games already have a bet highlighted
    const seenGameBetTypes = new Map(); // Track game + bet type combinations

    for (const bet of rankedBets) {
      const gameKey = bet.gameId;

      // Skip if this game already has a spread or moneyline bet highlighted
      if (bet.type === 'spread' || bet.type === 'ml') {
        if (seenGames.has(gameKey)) {
          continue; // Skip this bet, game already has a spread/ml highlighted
        }
      }

      // For totals, only allow one per game (either over or under, not both)
      if (bet.type === 'total') {
        const totalKey = `${bet.gameId}-total`;
        if (seenGameBetTypes.has(totalKey)) {
          continue; // Skip, this game already has a total bet
        }
        seenGameBetTypes.set(totalKey, true);
      }

      // Add this bet to the list
      topBets.push(bet);

      // Mark this game as having a spread/ml bet
      if (bet.type === 'spread' || bet.type === 'ml') {
        seenGames.add(gameKey);
      }

      if (topBets.length === 9) break;
    }

    const position = topBets.findIndex(
      bet => bet.gameId === gameId && bet.type === type && bet.team === team
    );

    if (position === -1) return 'transparent';

    // If 2 or fewer games, only show purple for #1
    if (totalGames <= 2) {
      if (position === 0) return '#a855f7';
      return 'transparent';
    }

    // Otherwise, show all colored borders
    if (position === 0) return '#a855f7'; // Purple for #1 pick
    if (position < 3) return '#22c55e';
    if (position < 6) return '#fbbf24';
    if (position < 9) return '#ef4444';
    return 'transparent';
  };

  const isTopPickOfWeek = (gameId, type, team) => {
    const rankedBets = getAllRankedBets();
    if (rankedBets.length === 0) return false;

    const topBet = rankedBets[0];
    return topBet.gameId === gameId && topBet.type === type && topBet.team === team;
  };

  const saveTopPicks = async () => {
    const games = getFilteredGames();
    const allBets = [];

    games.forEach(game => {
      const gameId = game.id;
      const homeTeam = game.home_team;
      const awayTeam = game.away_team;

      // Moneyline bets
      const homeBestML = findBestOdds(game.bookmakers, 'h2h', homeTeam, selectedBookmakers);
      const awayBestML = findBestOdds(game.bookmakers, 'h2h', awayTeam, selectedBookmakers);
      const homePredML = predictions[gameId]?.[`${homeTeam}_ml`];
      const awayPredML = predictions[gameId]?.[`${awayTeam}_ml`];

      if (homePredML && homeBestML) {
        const ev = calculateEV(homePredML, homeBestML.odds);
        if (ev !== null) {
          allBets.push({
            gameId,
            type: 'moneyline',
            team: homeTeam,
            ev,
            odds: homeBestML.odds,
            bookmaker: homeBestML.bookmaker,
            prediction: homePredML,
            matchup: `${awayTeam} @ ${homeTeam}`,
            description: `${homeTeam} ML`
          });
        }
      }
      if (awayPredML && awayBestML) {
        const ev = calculateEV(awayPredML, awayBestML.odds);
        if (ev !== null) {
          allBets.push({
            gameId,
            type: 'moneyline',
            team: awayTeam,
            ev,
            odds: awayBestML.odds,
            bookmaker: awayBestML.bookmaker,
            prediction: awayPredML,
            matchup: `${awayTeam} @ ${homeTeam}`,
            description: `${awayTeam} ML`
          });
        }
      }

      // Spread bets
      const homeBestSpread = findBestOdds(game.bookmakers, 'spreads', homeTeam, selectedBookmakers);
      const awayBestSpread = findBestOdds(game.bookmakers, 'spreads', awayTeam, selectedBookmakers);
      const homePredSpread = predictions[gameId]?.[`${homeTeam}_spread`];
      const awayPredSpread = predictions[gameId]?.[`${awayTeam}_spread`];

      if (homePredSpread && homeBestSpread) {
        const ev = calculateEV(homePredSpread, homeBestSpread.odds);
        if (ev !== null) {
          allBets.push({
            gameId,
            type: 'spread',
            team: homeTeam,
            ev,
            odds: homeBestSpread.odds,
            bookmaker: homeBestSpread.bookmaker,
            prediction: homePredSpread,
            line: homeBestSpread.point,
            matchup: `${awayTeam} @ ${homeTeam}`,
            description: `${homeTeam} ${homeBestSpread.point > 0 ? '+' : ''}${homeBestSpread.point}`
          });
        }
      }
      if (awayPredSpread && awayBestSpread) {
        const ev = calculateEV(awayPredSpread, awayBestSpread.odds);
        if (ev !== null) {
          allBets.push({
            gameId,
            type: 'spread',
            team: awayTeam,
            ev,
            odds: awayBestSpread.odds,
            bookmaker: awayBestSpread.bookmaker,
            prediction: awayPredSpread,
            line: awayBestSpread.point,
            matchup: `${awayTeam} @ ${homeTeam}`,
            description: `${awayTeam} ${awayBestSpread.point > 0 ? '+' : ''}${awayBestSpread.point}`
          });
        }
      }

      // Totals bets
      const overBest = findBestTotals(game.bookmakers, 'Over', selectedBookmakers);
      const underBest = findBestTotals(game.bookmakers, 'Under', selectedBookmakers);
      const overPred = predictions[gameId]?.['over'];
      const underPred = predictions[gameId]?.['under'];

      if (overPred && overBest) {
        const ev = calculateEV(overPred, overBest.odds);
        if (ev !== null) {
          allBets.push({
            gameId,
            type: 'total',
            team: 'Over',
            ev,
            odds: overBest.odds,
            bookmaker: overBest.bookmaker,
            prediction: overPred,
            line: overBest.point,
            matchup: `${awayTeam} @ ${homeTeam}`,
            description: `Over ${overBest.point}`
          });
        }
      }
      if (underPred && underBest) {
        const ev = calculateEV(underPred, underBest.odds);
        if (ev !== null) {
          allBets.push({
            gameId,
            type: 'total',
            team: 'Under',
            ev,
            odds: underBest.odds,
            bookmaker: underBest.bookmaker,
            prediction: underPred,
            line: underBest.point,
            matchup: `${awayTeam} @ ${homeTeam}`,
            description: `Under ${underBest.point}`
          });
        }
      }
    });

    // Sort by EV
    const rankedBets = allBets.sort((a, b) => b.ev - a.ev);

    // Get top 3 picks (green)
    const topBets = [];
    const seenGames = new Set();
    const seenGameBetTypes = new Map();

    for (const bet of rankedBets) {
      const gameKey = bet.gameId;

      if (bet.type === 'spread' || bet.type === 'moneyline') {
        if (seenGames.has(gameKey)) {
          continue;
        }
      }

      if (bet.type === 'total') {
        const totalKey = `${bet.gameId}-total`;
        if (seenGameBetTypes.has(totalKey)) {
          continue;
        }
        seenGameBetTypes.set(totalKey, true);
      }

      topBets.push(bet);

      if (bet.type === 'spread' || bet.type === 'moneyline') {
        seenGames.add(gameKey);
      }

      if (topBets.length === 3) break;
    }

    // Load existing pick history
    try {
      const response = await fetch('/pick_history.json');
      let pickHistory = [];

      if (response.ok) {
        pickHistory = await response.json();
      }

      // Add new picks
      const currentYear = new Date().getFullYear();

      topBets.forEach((bet, index) => {
        const pick = {
          week: selectedWeek,
          season: currentYear,
          description: bet.description,
          matchup: bet.matchup,
          bet_type: bet.type,
          odds: bet.odds,
          bookmaker: bet.bookmaker,
          ev: parseFloat(bet.ev.toFixed(2)),
          ml_prediction: parseFloat(bet.prediction),
          result: 'pending',
          units_won: null,
          unit_size: unitSize,
          pick_rank: index === 0 ? 'potw' : 'top3'
        };

        pickHistory.push(pick);
      });

      // Save to localStorage for now (will need backend to persist)
      localStorage.setItem('pickHistory', JSON.stringify(pickHistory));

      alert(`✅ Saved ${topBets.length} picks for Week ${selectedWeek}!`);

    } catch (err) {
      console.error('Error saving picks:', err);
      alert('❌ Failed to save picks');
    }
  };

  const theme = {
    bg: darkMode ? '#0f172a' : '#f1f5f9',
    cardBg: darkMode ? '#1e293b' : '#ffffff',
    text: darkMode ? '#f1f5f9' : '#1e293b',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    inputBg: darkMode ? '#334155' : '#ffffff'
  };

  if (loading) {
    return (
      <div style={{ 
        padding: '100px', 
        textAlign: 'center', 
        fontSize: '24px',
        background: theme.bg,
        color: theme.text,
        minHeight: '100vh'
      }}>
        Loading NFL games...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '100px', 
        textAlign: 'center',
        background: theme.bg,
        minHeight: '100vh'
      }}>
        <div style={{ fontSize: '24px', color: '#dc2626', marginBottom: '20px' }}>
          {error}
        </div>
        <button 
          onClick={fetchGames}
          style={{
            padding: '10px 20px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const games = getFilteredGames();

  return (
    <div style={{ 
      background: theme.bg,
      minHeight: '100vh',
      paddingBottom: '40px'
    }}>
      <div style={{ 
        maxWidth: '1400px', 
        margin: '0 auto', 
        padding: '40px 20px' 
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px',
          flexWrap: 'wrap',
          gap: '20px'
        }}>
          <h1 style={{ fontSize: '36px', color: theme.text, margin: 0 }}>
            🏈 NFL Games
          </h1>
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{
              fontSize: '12px',
              color: theme.textSecondary,
              display: 'flex',
              gap: '15px',
              alignItems: 'center'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: '#a855f7',
                  color: 'white',
                  fontSize: '10px'
                }}>★</span> Pick of Week
              </span>
              <span><span style={{color: '#22c55e'}}>●</span> Top 3</span>
              <span><span style={{color: '#fbbf24'}}>●</span> 4-6</span>
              <span><span style={{color: '#ef4444'}}>●</span> 7-9</span>
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
                fontSize: '20px'
              }}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '14px', color: theme.text, fontWeight: '600' }}>
                💵 Unit:
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={unitSize}
                onChange={(e) => setUnitSize(parseFloat(e.target.value) || 1.0)}
                style={{
                  padding: '8px 12px',
                  background: theme.inputBg,
                  color: theme.text,
                  border: `2px solid ${theme.border}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  width: '80px'
                }}
              />
            </div>

            <button
              onClick={saveTopPicks}
              style={{
                padding: '10px 20px',
                background: '#a855f7',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px'
              }}
            >
              💾 Save Top Picks
            </button>

            <button
              onClick={() => navigate('/pick-history')}
              style={{
                padding: '10px 20px',
                background: theme.cardBg,
                color: theme.text,
                border: `2px solid ${theme.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px'
              }}
            >
              📊 Pick History
            </button>

            <button
              onClick={fetchGames}
              style={{
                padding: '10px 20px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '30px',
          flexWrap: 'wrap',
          padding: '20px',
          background: theme.cardBg,
          borderRadius: '12px',
          border: `1px solid ${theme.border}`
        }}>
          <div style={{ 
            fontSize: '16px', 
            fontWeight: '600', 
            color: theme.text,
            marginRight: '10px',
            display: 'flex',
            alignItems: 'center'
          }}>
            Filter by Week:
          </div>
          {weeks.map(week => (
            <button
              key={week}
              onClick={() => setSelectedWeek(week)}
              style={{
                padding: '8px 16px',
                background: selectedWeek === week ? '#3b82f6' : theme.inputBg,
                color: selectedWeek === week ? 'white' : theme.text,
                border: `2px solid ${selectedWeek === week ? '#3b82f6' : theme.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px'
              }}
            >
              Week {week}
            </button>
          ))}
        </div>

        {/* Bookmaker Filter Dropdown */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '30px',
          position: 'relative'
        }}>
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
                        localStorage.removeItem('selectedBookmakers');
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
                          localStorage.setItem('selectedBookmakers', JSON.stringify(updated));
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
          {selectedBookmakers.length > 0 && !showBookmakerDropdown && (
            <div style={{
              fontSize: '12px',
              color: theme.textSecondary,
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap'
            }}>
              {selectedBookmakers.map(book => (
                <span
                  key={book}
                  style={{
                    background: darkMode ? '#334155' : '#e2e8f0',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px'
                  }}
                >
                  {book}
                </span>
              ))}
            </div>
          )}
        </div>

        {games.length === 0 ? (
          <div style={{
            background: theme.cardBg,
            padding: '40px',
            borderRadius: '16px',
            textAlign: 'center',
            color: theme.textSecondary
          }}>
            No games found for Week {selectedWeek}. Try another week!
          </div>
        ) : (
          <>
            <div style={{
              fontSize: '14px',
              color: theme.textSecondary,
              marginBottom: '20px',
              fontWeight: '600'
            }}>
              Showing {games.length} games for Week {selectedWeek}
            </div>
            {games.map((game) => {
              const homeTeam = game.home_team;
              const awayTeam = game.away_team;
              
              const homeBestML = findBestOdds(game.bookmakers, 'h2h', homeTeam, selectedBookmakers);
              const awayBestML = findBestOdds(game.bookmakers, 'h2h', awayTeam, selectedBookmakers);
              const homePredML = predictions[game.id]?.[`${homeTeam}_ml`];
              const awayPredML = predictions[game.id]?.[`${awayTeam}_ml`];
              const homeEV_ML = homePredML && homeBestML ? calculateEV(homePredML, homeBestML.odds) : null;
              const awayEV_ML = awayPredML && awayBestML ? calculateEV(awayPredML, awayBestML.odds) : null;
              
              const homeBestSpread = findBestOdds(game.bookmakers, 'spreads', homeTeam, selectedBookmakers);
              const awayBestSpread = findBestOdds(game.bookmakers, 'spreads', awayTeam, selectedBookmakers);
              let homeSpreadPoints = null;
              let awaySpreadPoints = null;
              game.bookmakers.forEach(book => {
                const spreadMarket = book.markets && book.markets.find(m => m.key === 'spreads');
                if (spreadMarket) {
                  const homeOutcome = spreadMarket.outcomes && spreadMarket.outcomes.find(o => o.name === homeTeam);
                  const awayOutcome = spreadMarket.outcomes && spreadMarket.outcomes.find(o => o.name === awayTeam);
                  if (homeOutcome) homeSpreadPoints = homeOutcome.point;
                  if (awayOutcome) awaySpreadPoints = awayOutcome.point;
                }
              });
              const homePredSpread = predictions[game.id]?.[`${homeTeam}_spread`];
              const awayPredSpread = predictions[game.id]?.[`${awayTeam}_spread`];
              const homeEV_Spread = homePredSpread && homeBestSpread ? calculateEV(homePredSpread, homeBestSpread.odds) : null;
              const awayEV_Spread = awayPredSpread && awayBestSpread ? calculateEV(awayPredSpread, awayBestSpread.odds) : null;
              
              const overBest = findBestTotals(game.bookmakers, 'Over', selectedBookmakers);
              const underBest = findBestTotals(game.bookmakers, 'Under', selectedBookmakers);
              const overPred = predictions[game.id]?.['over'];
              const underPred = predictions[game.id]?.['under'];
              const overEV = overPred && overBest ? calculateEV(overPred, overBest.odds) : null;
              const underEV = underPred && underBest ? calculateEV(underPred, underBest.odds) : null;

              return (
                <div 
                  key={game.id}
                  style={{
                    background: theme.cardBg,
                    borderRadius: '16px',
                    padding: '30px',
                    marginBottom: '20px',
                    boxShadow: darkMode ? '0 4px 6px rgba(0,0,0,0.3)' : '0 4px 6px rgba(0,0,0,0.1)',
                    border: `1px solid ${theme.border}`
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      color: theme.textSecondary,
                      fontWeight: '600'
                    }}>
                      {new Date(game.commence_time).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </div>
                    <button
                      onClick={() => navigate(`/nfl/props/${game.id}`)}
                      style={{
                        padding: '8px 16px',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '600',
                        transition: 'background 0.2s'
                      }}
                      onMouseOver={(e) => e.target.style.background = '#2563eb'}
                      onMouseOut={(e) => e.target.style.background = '#3b82f6'}
                    >
                      📊 Player Props
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                    {/* Team Column */}
                    <div>
                      <h3 style={{ color: theme.text, marginBottom: '10px', fontSize: '16px', height: '24px' }}>
                        Team
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Home Team */}
                        <div style={{
                          padding: '12px 10px',
                          background: darkMode ? '#0f172a' : '#f8fafc',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          minHeight: '118px',
                          border: '3px solid transparent',
                          boxSizing: 'border-box'
                        }}>
                          <img src={getTeamLogo(homeTeam)} alt={homeTeam} style={{ width: '32px', height: '32px' }} />
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '700', color: theme.text }}>
                              {getTeamShortName(homeTeam)}
                            </div>
                            {homeBestML && awayBestML && (
                              <div style={{ fontSize: '10px', color: homeBestML.odds < awayBestML.odds ? '#22c55e' : theme.textSecondary }}>
                                {homeBestML.odds < awayBestML.odds ? 'FAV' : 'DOG'}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Away Team */}
                        <div style={{
                          padding: '12px 10px',
                          background: darkMode ? '#0f172a' : '#f8fafc',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          minHeight: '118px',
                          border: '3px solid transparent',
                          boxSizing: 'border-box'
                        }}>
                          <img src={getTeamLogo(awayTeam)} alt={awayTeam} style={{ width: '32px', height: '32px' }} />
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '700', color: theme.text }}>
                              {getTeamShortName(awayTeam)}
                            </div>
                            {homeBestML && awayBestML && (
                              <div style={{ fontSize: '10px', color: awayBestML.odds < homeBestML.odds ? '#22c55e' : theme.textSecondary }}>
                                {awayBestML.odds < homeBestML.odds ? 'FAV' : 'DOG'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Spread Column */}
                    <div>
                      <h3 style={{ color: theme.text, marginBottom: '10px', fontSize: '16px', height: '24px' }}>
                        📊 Spread
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Home Spread */}
                        {homeBestSpread && homeSpreadPoints !== null && (
                          <div style={{
                            padding: '12px',
                            background: darkMode ? '#0f172a' : '#f8fafc',
                            borderRadius: '10px',
                            border: `3px solid ${getBorderColor(game.id, 'spread', homeTeam)}`,
                            minHeight: '88px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            position: 'relative'
                          }}>
                            {isTopPickOfWeek(game.id, 'spread', homeTeam) && (
                              <div style={{
                                position: 'absolute',
                                top: '-8px',
                                right: '-8px',
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: '#a855f7',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '12px',
                                fontWeight: '700',
                                boxShadow: '0 2px 8px rgba(168, 85, 247, 0.5)'
                              }}>
                                ★
                              </div>
                            )}
                            <div style={{ marginBottom: '6px' }}>
                              <span style={{ fontSize: '14px', fontWeight: '700', color: theme.text }}>
                                {homeSpreadPoints > 0 ? '+' : ''}{homeSpreadPoints}
                              </span>
                              <span style={{ marginLeft: '6px', fontSize: '13px', color: theme.text }}>
                                {homeBestSpread.odds > 0 ? '+' : ''}{homeBestSpread.odds}
                              </span>
                            </div>
                            <div style={{ fontSize: '9px', color: theme.textSecondary, marginBottom: '6px' }}>
                              {homeBestSpread.bookmaker}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={homePredSpread || ''}
                                onChange={(e) => updatePrediction(game.id, `${homeTeam}_spread`, e.target.value)}
                                style={{
                                  width: '55px',
                                  padding: '4px',
                                  fontSize: '11px',
                                  border: `2px solid ${theme.border}`,
                                  borderRadius: '6px',
                                  background: theme.inputBg,
                                  color: theme.text
                                }}
                              />
                              {homeEV_Spread !== null && (
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  color: homeEV_Spread > 0 ? '#16a34a' : '#dc2626'
                                }}>
                                  {homeEV_Spread > 0 ? '+' : ''}{homeEV_Spread.toFixed(2)}%
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Away Spread */}
                        {awayBestSpread && awaySpreadPoints !== null && (
                          <div style={{
                            padding: '12px',
                            background: darkMode ? '#0f172a' : '#f8fafc',
                            borderRadius: '10px',
                            border: `3px solid ${getBorderColor(game.id, 'spread', awayTeam)}`,
                            minHeight: '88px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            position: 'relative'
                          }}>
                            {isTopPickOfWeek(game.id, 'spread', awayTeam) && (
                              <div style={{
                                position: 'absolute',
                                top: '-8px',
                                right: '-8px',
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: '#a855f7',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '12px',
                                fontWeight: '700',
                                boxShadow: '0 2px 8px rgba(168, 85, 247, 0.5)'
                              }}>
                                ★
                              </div>
                            )}
                            <div style={{ marginBottom: '6px' }}>
                              <span style={{ fontSize: '14px', fontWeight: '700', color: theme.text }}>
                                {awaySpreadPoints > 0 ? '+' : ''}{awaySpreadPoints}
                              </span>
                              <span style={{ marginLeft: '6px', fontSize: '13px', color: theme.text }}>
                                {awayBestSpread.odds > 0 ? '+' : ''}{awayBestSpread.odds}
                              </span>
                            </div>
                            <div style={{ fontSize: '9px', color: theme.textSecondary, marginBottom: '6px' }}>
                              {awayBestSpread.bookmaker}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={awayPredSpread || ''}
                                onChange={(e) => updatePrediction(game.id, `${awayTeam}_spread`, e.target.value)}
                                style={{
                                  width: '55px',
                                  padding: '4px',
                                  fontSize: '11px',
                                  border: `2px solid ${theme.border}`,
                                  borderRadius: '6px',
                                  background: theme.inputBg,
                                  color: theme.text
                                }}
                              />
                              {awayEV_Spread !== null && (
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  color: awayEV_Spread > 0 ? '#16a34a' : '#dc2626'
                                }}>
                                  {awayEV_Spread > 0 ? '+' : ''}{awayEV_Spread.toFixed(2)}%
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Moneyline Column */}
                    <div>
                      <h3 style={{ color: theme.text, marginBottom: '10px', fontSize: '16px', height: '24px' }}>
                        💰 Moneyline
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Home Moneyline */}
                        {homeBestML && (
                          <div style={{
                            padding: '12px',
                            background: darkMode ? '#0f172a' : '#f8fafc',
                            borderRadius: '10px',
                            border: `3px solid ${getBorderColor(game.id, 'ml', homeTeam)}`,
                            minHeight: '88px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            position: 'relative'
                          }}>
                            {isTopPickOfWeek(game.id, 'ml', homeTeam) && (
                              <div style={{
                                position: 'absolute',
                                top: '-8px',
                                right: '-8px',
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: '#a855f7',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '12px',
                                fontWeight: '700',
                                boxShadow: '0 2px 8px rgba(168, 85, 247, 0.5)'
                              }}>
                                ★
                              </div>
                            )}
                            <div style={{ marginBottom: '6px' }}>
                              <span style={{ fontSize: '14px', fontWeight: '700', color: theme.text }}>
                                {homeBestML.odds > 0 ? '+' : ''}{homeBestML.odds}
                              </span>
                            </div>
                            <div style={{ fontSize: '9px', color: theme.textSecondary, marginBottom: '6px' }}>
                              {homeBestML.bookmaker}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={homePredML || ''}
                                onChange={(e) => updatePrediction(game.id, `${homeTeam}_ml`, e.target.value)}
                                style={{
                                  width: '55px',
                                  padding: '4px',
                                  fontSize: '11px',
                                  border: `2px solid ${theme.border}`,
                                  borderRadius: '6px',
                                  background: theme.inputBg,
                                  color: theme.text
                                }}
                              />
                              {homeEV_ML !== null && (
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  color: homeEV_ML > 0 ? '#16a34a' : '#dc2626'
                                }}>
                                  {homeEV_ML > 0 ? '+' : ''}{homeEV_ML.toFixed(2)}%
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Away Moneyline */}
                        {awayBestML && (
                          <div style={{
                            padding: '12px',
                            background: darkMode ? '#0f172a' : '#f8fafc',
                            borderRadius: '10px',
                            border: `3px solid ${getBorderColor(game.id, 'ml', awayTeam)}`,
                            minHeight: '88px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            position: 'relative'
                          }}>
                            {isTopPickOfWeek(game.id, 'ml', awayTeam) && (
                              <div style={{
                                position: 'absolute',
                                top: '-8px',
                                right: '-8px',
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: '#a855f7',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '12px',
                                fontWeight: '700',
                                boxShadow: '0 2px 8px rgba(168, 85, 247, 0.5)'
                              }}>
                                ★
                              </div>
                            )}
                            <div style={{ marginBottom: '6px' }}>
                              <span style={{ fontSize: '14px', fontWeight: '700', color: theme.text }}>
                                {awayBestML.odds > 0 ? '+' : ''}{awayBestML.odds}
                              </span>
                            </div>
                            <div style={{ fontSize: '9px', color: theme.textSecondary, marginBottom: '6px' }}>
                              {awayBestML.bookmaker}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={awayPredML || ''}
                                onChange={(e) => updatePrediction(game.id, `${awayTeam}_ml`, e.target.value)}
                                style={{
                                  width: '55px',
                                  padding: '4px',
                                  fontSize: '11px',
                                  border: `2px solid ${theme.border}`,
                                  borderRadius: '6px',
                                  background: theme.inputBg,
                                  color: theme.text
                                }}
                              />
                              {awayEV_ML !== null && (
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  color: awayEV_ML > 0 ? '#16a34a' : '#dc2626'
                                }}>
                                  {awayEV_ML > 0 ? '+' : ''}{awayEV_ML.toFixed(2)}%
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Totals Column */}
                    <div>
                      <h3 style={{ color: theme.text, marginBottom: '10px', fontSize: '16px', height: '24px' }}>
                        🎯 Totals
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Over */}
                        {overBest && (
                          <div style={{
                            padding: '12px',
                            background: darkMode ? '#0f172a' : '#f8fafc',
                            borderRadius: '10px',
                            border: `3px solid ${getBorderColor(game.id, 'total', 'Over')}`,
                            minHeight: '88px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            position: 'relative'
                          }}>
                            {isTopPickOfWeek(game.id, 'total', 'Over') && (
                              <div style={{
                                position: 'absolute',
                                top: '-8px',
                                right: '-8px',
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: '#a855f7',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '12px',
                                fontWeight: '700',
                                boxShadow: '0 2px 8px rgba(168, 85, 247, 0.5)'
                              }}>
                                ★
                              </div>
                            )}
                            <div style={{ marginBottom: '6px' }}>
                              <span style={{ fontSize: '14px', fontWeight: '700', color: theme.text }}>
                                O {overBest.points}
                              </span>
                              <span style={{ marginLeft: '6px', fontSize: '13px', color: theme.text }}>
                                {overBest.odds > 0 ? '+' : ''}{overBest.odds}
                              </span>
                            </div>
                            <div style={{ fontSize: '9px', color: theme.textSecondary, marginBottom: '6px' }}>
                              {overBest.bookmaker}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={overPred || ''}
                                onChange={(e) => updatePrediction(game.id, 'over', e.target.value)}
                                style={{
                                  width: '55px',
                                  padding: '4px',
                                  fontSize: '11px',
                                  border: `2px solid ${theme.border}`,
                                  borderRadius: '6px',
                                  background: theme.inputBg,
                                  color: theme.text
                                }}
                              />
                              {overEV !== null && (
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  color: overEV > 0 ? '#16a34a' : '#dc2626'
                                }}>
                                  {overEV > 0 ? '+' : ''}{overEV.toFixed(2)}%
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Under */}
                        {underBest && (
                          <div style={{
                            padding: '12px',
                            background: darkMode ? '#0f172a' : '#f8fafc',
                            borderRadius: '10px',
                            border: `3px solid ${getBorderColor(game.id, 'total', 'Under')}`,
                            minHeight: '88px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            position: 'relative'
                          }}>
                            {isTopPickOfWeek(game.id, 'total', 'Under') && (
                              <div style={{
                                position: 'absolute',
                                top: '-8px',
                                right: '-8px',
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: '#a855f7',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '12px',
                                fontWeight: '700',
                                boxShadow: '0 2px 8px rgba(168, 85, 247, 0.5)'
                              }}>
                                ★
                              </div>
                            )}
                            <div style={{ marginBottom: '6px' }}>
                              <span style={{ fontSize: '14px', fontWeight: '700', color: theme.text }}>
                                U {underBest.points}
                              </span>
                              <span style={{ marginLeft: '6px', fontSize: '13px', color: theme.text }}>
                                {underBest.odds > 0 ? '+' : ''}{underBest.odds}
                              </span>
                            </div>
                            <div style={{ fontSize: '9px', color: theme.textSecondary, marginBottom: '6px' }}>
                              {underBest.bookmaker}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={underPred || ''}
                                onChange={(e) => updatePrediction(game.id, 'under', e.target.value)}
                                style={{
                                  width: '55px',
                                  padding: '4px',
                                  fontSize: '11px',
                                  border: `2px solid ${theme.border}`,
                                  borderRadius: '6px',
                                  background: theme.inputBg,
                                  color: theme.text
                                }}
                              />
                              {underEV !== null && (
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  color: underEV > 0 ? '#16a34a' : '#dc2626'
                                }}>
                                  {underEV > 0 ? '+' : ''}{underEV.toFixed(2)}%
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};

export default NFLPage;