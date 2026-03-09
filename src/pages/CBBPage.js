import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCBBOdds } from '../services/oddsAPI';
import { calculateEV, findBestOdds, americanToImplied, findBestTotals } from '../utils/oddsCalculations';
import { loadCBBMLPredictions } from '../utils/cbbMLPredictions';
import { getCBBTeamLogo, getCBBTeamShortName } from '../utils/cbbLogos';

const CBBPage = () => {
  const navigate = useNavigate();
  const [allGames, setAllGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [predictions, setPredictions] = useState({});
  const [darkMode, setDarkMode] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dates, setDates] = useState([]);
  const [selectedBookmakers, setSelectedBookmakers] = useState(() => {
    const saved = localStorage.getItem('cbb_selectedBookmakers');
    return saved ? JSON.parse(saved) : [];
  });
  const [availableBookmakers, setAvailableBookmakers] = useState([]);
  const [showBookmakerDropdown, setShowBookmakerDropdown] = useState(false);
  const [unitSize, setUnitSize] = useState(() => {
    const saved = localStorage.getItem('cbb_unitSize');
    return saved ? parseFloat(saved) : 1.0;
  });
  const dropdownRef = useRef(null);

  // Save unit size to localStorage
  useEffect(() => {
    localStorage.setItem('cbb_unitSize', unitSize.toString());
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

  const getTeamLogo = getCBBTeamLogo;
  const getTeamShortName = getCBBTeamShortName;

  const groupGamesByDate = (games) => {
    const gamesByDate = {};
    const now = new Date();
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(now.getDate() + 7);
    sevenDaysFromNow.setHours(23, 59, 59, 999); // End of day 7

    games.forEach(game => {
      const gameDate = new Date(game.commence_time);

      // Only include games within the next 7 days
      if (gameDate >= now && gameDate <= sevenDaysFromNow) {
        const dateKey = gameDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });

        if (!gamesByDate[dateKey]) {
          gamesByDate[dateKey] = [];
        }
        gamesByDate[dateKey].push(game);
      }
    });

    return gamesByDate;
  };

  const fetchGames = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      const response = await getCBBOdds(forceRefresh);
      const data = response.data;

      setAllGames(data);

      const gamesByDate = groupGamesByDate(data);
      const dateKeys = Object.keys(gamesByDate).sort((a, b) => new Date(a) - new Date(b));
      setDates(dateKeys);

      if (dateKeys.length > 0 && !selectedDate) {
        // Select today's date or the next available date
        const today = new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        const todayIndex = dateKeys.indexOf(today);
        setSelectedDate(todayIndex >= 0 ? today : dateKeys[0]);
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
      const mlPredictions = loadCBBMLPredictions(data);
      console.log('🏀 CBB Games fetched:', data.length);
      console.log('🤖 ML Predictions loaded:', Object.keys(mlPredictions).length);

      const initialPredictions = {};
      data.forEach(game => {
        console.log(`📋 Game: ${game.away_team} @ ${game.home_team} (ID: ${game.id})`);

        // Use ML predictions if available, otherwise fall back to implied odds
        if (mlPredictions[game.id]) {
          console.log(`✅ Using ML predictions for ${game.away_team} @ ${game.home_team}`);
          initialPredictions[game.id] = {
            ...mlPredictions[game.id],
            _hasMLPredictions: true
          };
        } else {
          console.log(`⚠️ No ML predictions for ${game.away_team} @ ${game.home_team}, using implied odds`);

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
  }, [selectedDate]);

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
    if (!selectedDate) return [];
    const gamesByDate = groupGamesByDate(allGames);
    return gamesByDate[selectedDate] || [];
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
        if (homeBestML.odds < 300) {
          const ev = calculateEV(homePredML, homeBestML.odds, 'moneyline');
          if (ev !== null) {
            allBets.push({ gameId, type: 'ml', team: homeTeam, ev });
          }
        }
      }
      if (awayPredML && awayBestML) {
        if (awayBestML.odds < 300) {
          const ev = calculateEV(awayPredML, awayBestML.odds, 'moneyline');
          if (ev !== null) {
            allBets.push({ gameId, type: 'ml', team: awayTeam, ev });
          }
        }
      }

      const homeBestSpread = findBestOdds(game.bookmakers, 'spreads', homeTeam);
      const awayBestSpread = findBestOdds(game.bookmakers, 'spreads', awayTeam);
      const homePredSpread = predictions[gameId]?.[`${homeTeam}_spread`];
      const awayPredSpread = predictions[gameId]?.[`${awayTeam}_spread`];

      if (homePredSpread && homeBestSpread) {
        const ev = calculateEV(homePredSpread, homeBestSpread.odds, 'spread');
        if (ev !== null) {
          allBets.push({ gameId, type: 'spread', team: homeTeam, ev });
        }
      }
      if (awayPredSpread && awayBestSpread) {
        const ev = calculateEV(awayPredSpread, awayBestSpread.odds, 'spread');
        if (ev !== null) {
          allBets.push({ gameId, type: 'spread', team: awayTeam, ev });
        }
      }

      const overBest = findBestTotals(game.bookmakers, 'Over');
      const underBest = findBestTotals(game.bookmakers, 'Under');
      const overPred = predictions[gameId]?.['over'];
      const underPred = predictions[gameId]?.['under'];

      if (overPred && overBest) {
        const ev = calculateEV(overPred, overBest.odds, 'total');
        if (ev !== null) {
          allBets.push({ gameId, type: 'total', team: 'Over', ev });
        }
      }
      if (underPred && underBest) {
        const ev = calculateEV(underPred, underBest.odds, 'total');
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
    const seenGames = new Set();
    const seenGameBetTypes = new Map();

    for (const bet of rankedBets) {
      const gameKey = bet.gameId;

      if (bet.type === 'spread' || bet.type === 'ml') {
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

      if (bet.type === 'spread' || bet.type === 'ml') {
        seenGames.add(gameKey);
      }

      if (topBets.length === 9) break;
    }

    const position = topBets.findIndex(
      bet => bet.gameId === gameId && bet.type === type && bet.team === team
    );

    if (position === -1) return 'transparent';

    if (totalGames <= 2) {
      if (position === 0) return '#a855f7';
      return 'transparent';
    }

    if (position === 0) return '#a855f7'; // Purple for #1 pick
    if (position < 3) return '#22c55e';
    if (position < 6) return '#fbbf24';
    if (position < 9) return '#ef4444';
    return 'transparent';
  };

  const isTopPickOfDay = (gameId, type, team) => {
    const rankedBets = getAllRankedBets();
    if (rankedBets.length === 0) return false;

    const topBet = rankedBets[0];
    return topBet.gameId === gameId && topBet.type === type && topBet.team === team;
  };

  const savePickOfDay = (game, type, team, odds, points, prediction, ev) => {
    try {
      // Load existing pick history
      const existingHistory = JSON.parse(localStorage.getItem('cbb_pick_history') || '[]');

      const homeTeam = game.home_team;
      const awayTeam = game.away_team;
      const gameDate = new Date(game.commence_time);

      // Create description based on bet type
      let description = '';
      if (type === 'spread') {
        description = `${team} ${points > 0 ? '+' : ''}${points}`;
      } else if (type === 'ml') {
        description = `${team} ML`;
      } else if (type === 'total') {
        description = `${team} ${points}`;
      }

      // Create matchup string
      const matchup = `${awayTeam} @ ${homeTeam}`;

      // Check if this pick already exists
      const existingPick = existingHistory.find(pick =>
        pick.date === gameDate.toISOString().split('T')[0] &&
        pick.description === description &&
        pick.sport === 'CBB'
      );

      if (existingPick) {
        alert('This pick has already been saved for today!');
        return;
      }

      const newPick = {
        sport: 'CBB',
        date: gameDate.toISOString().split('T')[0],
        season: 2025, // 2024-2025 season
        description: description,
        matchup: matchup,
        bet_type: type === 'ml' ? 'moneyline' : type,
        odds: odds,
        bookmaker: 'Best Available',
        ev: ev,
        ml_prediction: prediction,
        result: 'pending',
        units_won: null,
        unit_size: unitSize,
        pick_rank: 'potd'
      };

      // Add to history
      existingHistory.unshift(newPick);

      // Save back to localStorage
      localStorage.setItem('cbb_pick_history', JSON.stringify(existingHistory));

      alert(`✅ Pick of Day saved!\n${description} - ${matchup}`);
    } catch (error) {
      console.error('Error saving pick:', error);
      alert('Failed to save pick. Please try again.');
    }
  };

  const getStreakIndicator = (gameId, team, isHome) => {
    const prediction = predictions[gameId];
    if (!prediction || !prediction._hasMLPredictions) return null;

    // Check for streak data in predictions
    const streakKey = isHome ? `${team}_home_streak` : `${team}_away_streak`;
    const streak = prediction[streakKey];

    if (!streak) return null;

    // Display streak indicator
    const streakType = streak > 0 ? '🔥' : '❄️';
    const streakText = Math.abs(streak);

    return (
      <div style={{
        fontSize: '10px',
        color: streak > 0 ? '#22c55e' : '#ef4444',
        display: 'flex',
        alignItems: 'center',
        gap: '2px'
      }}>
        <span>{streakType}</span>
        <span>{streakText}</span>
      </div>
    );
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
        Loading College Basketball games...
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
            🏀 College Basketball
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
                }}>★</span> Pick of Day
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
              onClick={() => navigate('/cbb-pick-history')}
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
              📊 CBB Pick History
            </button>

            <button
              onClick={() => fetchGames(true)}
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
            Filter by Date:
          </div>
          {dates.map(date => {
            const today = new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            });
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toLocaleDateString('en-US', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            });

            let label;
            if (date === today) {
              label = 'Today';
            } else if (date === tomorrowStr) {
              label = 'Tomorrow';
            } else {
              label = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }

            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                style={{
                  padding: '8px 16px',
                  background: selectedDate === date ? '#3b82f6' : theme.inputBg,
                  color: selectedDate === date ? 'white' : theme.text,
                  border: `2px solid ${selectedDate === date ? '#3b82f6' : theme.border}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px'
                }}
              >
                {label}
              </button>
            );
          })}
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
                        localStorage.removeItem('cbb_selectedBookmakers');
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
                          localStorage.setItem('cbb_selectedBookmakers', JSON.stringify(updated));
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
            No games found for {selectedDate}. Try another date!
          </div>
        ) : (
          <>
            <div style={{
              fontSize: '14px',
              color: theme.textSecondary,
              marginBottom: '20px',
              fontWeight: '600'
            }}>
              Showing {games.length} games for {selectedDate}
            </div>
            {games.map((game) => {
              const homeTeam = game.home_team;
              const awayTeam = game.away_team;

              const homeBestML = findBestOdds(game.bookmakers, 'h2h', homeTeam, selectedBookmakers);
              const awayBestML = findBestOdds(game.bookmakers, 'h2h', awayTeam, selectedBookmakers);
              const homePredML = predictions[game.id]?.[`${homeTeam}_ml`];
              const awayPredML = predictions[game.id]?.[`${awayTeam}_ml`];
              const homeEV_ML = homePredML && homeBestML ? calculateEV(homePredML, homeBestML.odds, 'moneyline') : null;
              const awayEV_ML = awayPredML && awayBestML ? calculateEV(awayPredML, awayBestML.odds, 'moneyline') : null;

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
              const homeEV_Spread = homePredSpread && homeBestSpread ? calculateEV(homePredSpread, homeBestSpread.odds, 'spread') : null;
              const awayEV_Spread = awayPredSpread && awayBestSpread ? calculateEV(awayPredSpread, awayBestSpread.odds, 'spread') : null;

              const overBest = findBestTotals(game.bookmakers, 'Over', selectedBookmakers);
              const underBest = findBestTotals(game.bookmakers, 'Under', selectedBookmakers);
              const overPred = predictions[game.id]?.['over'];
              const underPred = predictions[game.id]?.['under'];
              const overEV = overPred && overBest ? calculateEV(overPred, overBest.odds, 'total') : null;
              const underEV = underPred && underBest ? calculateEV(underPred, underBest.odds, 'total') : null;

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
                      {new Date(game.commence_time).toLocaleString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </div>
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
                            {getStreakIndicator(game.id, homeTeam, true)}
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
                            {getStreakIndicator(game.id, awayTeam, false)}
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
                            {isTopPickOfDay(game.id, 'spread', homeTeam) && (
                              <>
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
                                <button
                                  onClick={() => savePickOfDay(
                                    game,
                                    'spread',
                                    homeTeam,
                                    homeBestSpread.odds,
                                    homeSpreadPoints,
                                    homePredSpread,
                                    homeEV_Spread
                                  )}
                                  style={{
                                    position: 'absolute',
                                    top: '-8px',
                                    left: '-8px',
                                    padding: '4px 8px',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '10px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.5)',
                                    zIndex: 10
                                  }}
                                  title="Save as Pick of Day"
                                >
                                  💾 Save
                                </button>
                              </>
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
                              {predictions[game.id]?._hasMLPredictions && (
                                <span style={{ fontSize: '12px' }} title="ML Prediction">🤖</span>
                              )}
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
                            {isTopPickOfDay(game.id, 'spread', awayTeam) && (
                              <>
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
                                <button
                                  onClick={() => savePickOfDay(
                                    game,
                                    'spread',
                                    awayTeam,
                                    awayBestSpread.odds,
                                    awaySpreadPoints,
                                    awayPredSpread,
                                    awayEV_Spread
                                  )}
                                  style={{
                                    position: 'absolute',
                                    top: '-8px',
                                    left: '-8px',
                                    padding: '4px 8px',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '10px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.5)',
                                    zIndex: 10
                                  }}
                                  title="Save as Pick of Day"
                                >
                                  💾 Save
                                </button>
                              </>
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
                              {predictions[game.id]?._hasMLPredictions && (
                                <span style={{ fontSize: '12px' }} title="ML Prediction">🤖</span>
                              )}
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
                            {isTopPickOfDay(game.id, 'ml', homeTeam) && (
                              <>
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
                                <button
                                  onClick={() => savePickOfDay(
                                    game,
                                    'ml',
                                    homeTeam,
                                    homeBestML.odds,
                                    null,
                                    homePredML,
                                    homeEV_ML
                                  )}
                                  style={{
                                    position: 'absolute',
                                    top: '-8px',
                                    left: '-8px',
                                    padding: '4px 8px',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '10px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.5)',
                                    zIndex: 10
                                  }}
                                  title="Save as Pick of Day"
                                >
                                  💾 Save
                                </button>
                              </>
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
                              {predictions[game.id]?._hasMLPredictions && (
                                <span style={{ fontSize: '12px' }} title="ML Prediction">🤖</span>
                              )}
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
                            {isTopPickOfDay(game.id, 'ml', awayTeam) && (
                              <>
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
                                <button
                                  onClick={() => savePickOfDay(
                                    game,
                                    'ml',
                                    awayTeam,
                                    awayBestML.odds,
                                    null,
                                    awayPredML,
                                    awayEV_ML
                                  )}
                                  style={{
                                    position: 'absolute',
                                    top: '-8px',
                                    left: '-8px',
                                    padding: '4px 8px',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '10px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.5)',
                                    zIndex: 10
                                  }}
                                  title="Save as Pick of Day"
                                >
                                  💾 Save
                                </button>
                              </>
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
                              {predictions[game.id]?._hasMLPredictions && (
                                <span style={{ fontSize: '12px' }} title="ML Prediction">🤖</span>
                              )}
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
                            {isTopPickOfDay(game.id, 'total', 'Over') && (
                              <>
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
                                <button
                                  onClick={() => savePickOfDay(
                                    game,
                                    'total',
                                    'Over',
                                    overBest.odds,
                                    overBest.points,
                                    overPred,
                                    overEV
                                  )}
                                  style={{
                                    position: 'absolute',
                                    top: '-8px',
                                    left: '-8px',
                                    padding: '4px 8px',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '10px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.5)',
                                    zIndex: 10
                                  }}
                                  title="Save as Pick of Day"
                                >
                                  💾 Save
                                </button>
                              </>
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
                              {predictions[game.id]?._hasMLPredictions && (
                                <span style={{ fontSize: '12px' }} title="ML Prediction">🤖</span>
                              )}
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
                            {isTopPickOfDay(game.id, 'total', 'Under') && (
                              <>
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
                                <button
                                  onClick={() => savePickOfDay(
                                    game,
                                    'total',
                                    'Under',
                                    underBest.odds,
                                    underBest.points,
                                    underPred,
                                    underEV
                                  )}
                                  style={{
                                    position: 'absolute',
                                    top: '-8px',
                                    left: '-8px',
                                    padding: '4px 8px',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '10px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.5)',
                                    zIndex: 10
                                  }}
                                  title="Save as Pick of Day"
                                >
                                  💾 Save
                                </button>
                              </>
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
                              {predictions[game.id]?._hasMLPredictions && (
                                <span style={{ fontSize: '12px' }} title="ML Prediction">🤖</span>
                              )}
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

export default CBBPage;
