import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const NBAPickHistoryPage = () => {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(true);
  const [pickHistory, setPickHistory] = useState([]);

  // Load pick history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('nba_pick_history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setPickHistory(parsed);
      } catch (err) {
        console.error('Error loading NBA pick history from localStorage:', err);
        setPickHistory([]);
      }
    } else {
      // Initialize with Milwaukee -10 as first pick
      const initialPick = {
        sport: 'NBA',
        date: new Date().toISOString().split('T')[0],
        season: 2024,
        description: 'Bucks -10',
        matchup: 'Bucks @ Hawks',
        bet_type: 'spread',
        odds: -110,
        bookmaker: 'Best Available',
        ev: null,
        ml_prediction: null,
        result: 'pending',
        units_won: null,
        unit_size: 1.0,
        pick_rank: 'potd'
      };
      setPickHistory([initialPick]);
      localStorage.setItem('nba_pick_history', JSON.stringify([initialPick]));
    }
  }, []);

  const theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    cardBg: darkMode ? '#1e293b' : '#ffffff',
    text: darkMode ? '#f1f5f9' : '#1e293b',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    inputBg: darkMode ? '#334155' : '#f1f5f9'
  };

  // Group picks by date
  const picksByDate = pickHistory.reduce((acc, pick) => {
    const date = pick.date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(pick);
    return acc;
  }, {});

  // Sort dates in descending order
  const sortedDates = Object.keys(picksByDate).sort((a, b) => new Date(b) - new Date(a));

  // Calculate overall stats
  const totalPicks = pickHistory.filter(p => p.result !== 'pending').length;
  const wins = pickHistory.filter(p => p.result === 'win').length;
  const losses = pickHistory.filter(p => p.result === 'loss').length;
  const pushes = pickHistory.filter(p => p.result === 'push').length;
  const winRate = totalPicks > 0 ? ((wins / totalPicks) * 100).toFixed(1) : 0;
  const totalUnits = pickHistory.reduce((sum, p) => {
    const unitSize = p.unit_size || 1.0;
    if (p.result === 'win') return sum + (p.units_won || (unitSize * (p.odds > 0 ? p.odds / 100 : 100 / Math.abs(p.odds))));
    if (p.result === 'loss') return sum - unitSize;
    return sum;
  }, 0);

  // Calculate units won for a pick
  const calculateUnitsWon = (pick) => {
    if (pick.result === 'win') {
      const unitSize = pick.unit_size || 1.0;
      if (pick.units_won !== null && pick.units_won !== undefined) {
        return pick.units_won;
      }
      // Calculate from odds
      return unitSize * (pick.odds > 0 ? pick.odds / 100 : 100 / Math.abs(pick.odds));
    }
    if (pick.result === 'loss') {
      return -(pick.unit_size || 1.0);
    }
    return 0;
  };

  const getResultColor = (result) => {
    if (result === 'win') return '#10b981';
    if (result === 'loss') return '#ef4444';
    if (result === 'push') return '#fbbf24';
    return theme.textSecondary;
  };

  const getResultIcon = (result) => {
    if (result === 'win') return '✓';
    if (result === 'loss') return '✗';
    if (result === 'push') return '−';
    return '⏳';
  };

  const getBetTypeDisplay = (betType) => {
    const types = {
      'moneyline': 'ML',
      'spread': 'Spread',
      'total': 'Total',
      'total_over': 'Over',
      'total_under': 'Under',
      'player_prop': 'Player Prop'
    };
    return types[betType] || betType;
  };

  const updatePickResult = (date, pickIndex, result) => {
    const updatedHistory = [...pickHistory];
    const pickInHistory = updatedHistory.findIndex((p, idx) => {
      return p.date === date && picksByDate[date][pickIndex] === p;
    });

    if (pickInHistory !== -1) {
      updatedHistory[pickInHistory].result = result;

      // Calculate units won
      if (result === 'win') {
        const unitSize = updatedHistory[pickInHistory].unit_size || 1.0;
        const odds = updatedHistory[pickInHistory].odds;
        updatedHistory[pickInHistory].units_won = unitSize * (odds > 0 ? odds / 100 : 100 / Math.abs(odds));
      } else if (result === 'loss') {
        updatedHistory[pickInHistory].units_won = -(updatedHistory[pickInHistory].unit_size || 1.0);
      } else if (result === 'push') {
        updatedHistory[pickInHistory].units_won = 0;
      }

      setPickHistory(updatedHistory);
      localStorage.setItem('nba_pick_history', JSON.stringify(updatedHistory));
    }
  };

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
          marginBottom: '30px'
        }}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <button
              onClick={() => navigate('/nba')}
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
              ← Back to NBA
            </button>
            <h1 style={{
              fontSize: '32px',
              fontWeight: '700',
              color: theme.text,
              margin: 0
            }}>
              🏀 NBA Pick History
            </h1>
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

        {/* Overall Stats */}
        <div style={{
          background: theme.cardBg,
          padding: '30px',
          borderRadius: '16px',
          marginBottom: '30px',
          border: `1px solid ${theme.border}`
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '700',
            color: theme.text,
            margin: '0 0 20px 0'
          }}>
            Overall Performance
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '20px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '36px', fontWeight: '700', color: '#10b981' }}>
                {wins}
              </div>
              <div style={{ fontSize: '14px', color: theme.textSecondary }}>Wins</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '36px', fontWeight: '700', color: '#ef4444' }}>
                {losses}
              </div>
              <div style={{ fontSize: '14px', color: theme.textSecondary }}>Losses</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '36px', fontWeight: '700', color: '#fbbf24' }}>
                {pushes}
              </div>
              <div style={{ fontSize: '14px', color: theme.textSecondary }}>Pushes</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '36px', fontWeight: '700', color: '#3b82f6' }}>
                {winRate}%
              </div>
              <div style={{ fontSize: '14px', color: theme.textSecondary }}>Win Rate</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '36px',
                fontWeight: '700',
                color: totalUnits >= 0 ? '#10b981' : '#ef4444'
              }}>
                {totalUnits >= 0 ? '+' : ''}{totalUnits.toFixed(2)}u
              </div>
              <div style={{ fontSize: '14px', color: theme.textSecondary }}>Total Units</div>
            </div>
          </div>
        </div>

        {/* Pick History by Date */}
        {sortedDates.length === 0 ? (
          <div style={{
            background: theme.cardBg,
            padding: '60px',
            borderRadius: '16px',
            textAlign: 'center',
            border: `1px solid ${theme.border}`
          }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>📊</div>
            <h3 style={{ fontSize: '24px', color: theme.text, marginBottom: '10px' }}>
              No Picks Yet
            </h3>
            <p style={{ fontSize: '16px', color: theme.textSecondary }}>
              Start tracking your NBA Pick of Day to see your performance over time!
            </p>
          </div>
        ) : (
          sortedDates.map(date => (
            <div
              key={date}
              style={{
                background: theme.cardBg,
                padding: '30px',
                borderRadius: '16px',
                marginBottom: '20px',
                border: `1px solid ${theme.border}`
              }}
            >
              <h3 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: theme.text,
                marginBottom: '20px'
              }}>
                {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {picksByDate[date].map((pick, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: theme.inputBg,
                      padding: '20px',
                      borderRadius: '12px',
                      border: `2px solid ${getResultColor(pick.result)}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '15px'
                    }}
                  >
                    {/* Pick Details */}
                    <div style={{ flex: '1 1 300px' }}>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: theme.text,
                        marginBottom: '8px'
                      }}>
                        {pick.description}
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: theme.textSecondary,
                        marginBottom: '4px'
                      }}>
                        {pick.matchup}
                      </div>
                      <div style={{
                        fontSize: '13px',
                        color: theme.textSecondary
                      }}>
                        {getBetTypeDisplay(pick.bet_type)} • {pick.odds > 0 ? '+' : ''}{pick.odds} • {pick.bookmaker}
                      </div>
                    </div>

                    {/* EV & Stats */}
                    <div style={{
                      display: 'flex',
                      gap: '20px',
                      alignItems: 'center'
                    }}>
                      {pick.ev !== null && pick.ev !== undefined && (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{
                            fontSize: '12px',
                            color: theme.textSecondary,
                            marginBottom: '4px'
                          }}>
                            Expected Value
                          </div>
                          <div style={{
                            fontSize: '20px',
                            fontWeight: '700',
                            color: pick.ev >= 0 ? '#10b981' : '#ef4444'
                          }}>
                            {pick.ev >= 0 ? '+' : ''}{pick.ev.toFixed(2)}%
                          </div>
                        </div>
                      )}

                      {pick.ml_prediction && (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{
                            fontSize: '12px',
                            color: theme.textSecondary,
                            marginBottom: '4px'
                          }}>
                            ML Prediction
                          </div>
                          <div style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            color: '#3b82f6'
                          }}>
                            🤖 {pick.ml_prediction}%
                          </div>
                        </div>
                      )}

                      {pick.result !== 'pending' && (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{
                            fontSize: '12px',
                            color: theme.textSecondary,
                            marginBottom: '4px'
                          }}>
                            Units
                          </div>
                          <div style={{
                            fontSize: '20px',
                            fontWeight: '700',
                            color: calculateUnitsWon(pick) >= 0 ? '#10b981' : '#ef4444'
                          }}>
                            {calculateUnitsWon(pick) >= 0 ? '+' : ''}{calculateUnitsWon(pick).toFixed(2)}u
                          </div>
                        </div>
                      )}

                      {pick.result === 'pending' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <button
                            onClick={() => updatePickResult(date, idx, 'win')}
                            style={{
                              padding: '8px 16px',
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontWeight: '600',
                              fontSize: '13px'
                            }}
                          >
                            ✓ Win
                          </button>
                          <button
                            onClick={() => updatePickResult(date, idx, 'loss')}
                            style={{
                              padding: '8px 16px',
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontWeight: '600',
                              fontSize: '13px'
                            }}
                          >
                            ✗ Loss
                          </button>
                          <button
                            onClick={() => updatePickResult(date, idx, 'push')}
                            style={{
                              padding: '8px 16px',
                              background: '#fbbf24',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontWeight: '600',
                              fontSize: '13px'
                            }}
                          >
                            − Push
                          </button>
                        </div>
                      ) : (
                        <div style={{
                          width: '80px',
                          height: '80px',
                          borderRadius: '50%',
                          background: getResultColor(pick.result),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '36px',
                          fontWeight: '700'
                        }}>
                          {getResultIcon(pick.result)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NBAPickHistoryPage;
