import React, { useState, useEffect } from 'react';
import { getNFLOdds } from '../services/oddsAPI';
import { calculateEV, findBestOdds, americanToImplied, findBestTotals } from '../utils/oddsCalculations';

const NFLPage = () => {
  const [allGames, setAllGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [predictions, setPredictions] = useState({});
  const [darkMode, setDarkMode] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [weeks, setWeeks] = useState([]);

  useEffect(() => {
    fetchGames();
  }, []);

  const groupGamesByWeek = (games) => {
    const NFL_START_DATE = new Date('2024-09-05');
    const WEEK_DURATION = 7 * 24 * 60 * 60 * 1000;
    
    const gamesByWeek = {};
    
    games.forEach(game => {
      const gameDate = new Date(game.commence_time);
      const weeksSinceStart = Math.floor((gameDate - NFL_START_DATE) / WEEK_DURATION);
      const weekNumber = weeksSinceStart + 1;
      
      if (!gamesByWeek[weekNumber]) {
        gamesByWeek[weekNumber] = [];
      }
      gamesByWeek[weekNumber].push(game);
    });
    
    return gamesByWeek;
  };

  const fetchGames = async () => {
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
      
      const initialPredictions = {};
      data.forEach(game => {
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
      });
      
      setPredictions(initialPredictions);
      setError(null);
    } catch (err) {
      setError('Failed to fetch games. Check your API key.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
    
    const topBets = [];
    const seenGameTypes = new Set();
    
    for (const bet of rankedBets) {
      const key = `${bet.gameId}-${bet.type}`;
      if (!seenGameTypes.has(key)) {
        seenGameTypes.add(key);
        topBets.push(bet);
        if (topBets.length === 9) break;
      }
    }
    
    const position = topBets.findIndex(
      bet => bet.gameId === gameId && bet.type === type && bet.team === team
    );
    
    if (position === -1) return 'transparent';
    
    if (position < 3) return '#22c55e';
    if (position < 6) return '#fbbf24';
    if (position < 9) return '#ef4444';
    return 'transparent';
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
              gap: '15px'
            }}>
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
              
              const homeBestML = findBestOdds(game.bookmakers, 'h2h', homeTeam);
              const awayBestML = findBestOdds(game.bookmakers, 'h2h', awayTeam);
              const homePredML = predictions[game.id]?.[`${homeTeam}_ml`];
              const awayPredML = predictions[game.id]?.[`${awayTeam}_ml`];
              const homeEV_ML = homePredML && homeBestML ? calculateEV(homePredML, homeBestML.odds) : null;
              const awayEV_ML = awayPredML && awayBestML ? calculateEV(awayPredML, awayBestML.odds) : null;
              
              const homeBestSpread = findBestOdds(game.bookmakers, 'spreads', homeTeam);
              const awayBestSpread = findBestOdds(game.bookmakers, 'spreads', awayTeam);
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
              
              const overBest = findBestTotals(game.bookmakers, 'Over');
              const underBest = findBestTotals(game.bookmakers, 'Under');
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
                    fontSize: '14px', 
                    color: theme.textSecondary,
                    marginBottom: '20px',
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

                  <h3 style={{ color: theme.text, marginBottom: '15px', fontSize: '18px' }}>
                    💰 Moneyline
                  </h3>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1.5fr 1fr 1.5fr',
                    gap: '15px',
                    alignItems: 'center',
                    padding: '15px',
                    background: darkMode ? '#0f172a' : '#f8fafc',
                    borderRadius: '12px',
                    marginBottom: '10px',
                    border: `3px solid ${getBorderColor(game.id, 'ml', awayTeam)}`
                  }}>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: theme.text }}>
                        {awayTeam}
                      </div>
                    </div>

                    <div>
                      {awayBestML && (
                        <>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: theme.text }}>
                            {awayBestML.odds > 0 ? '+' : ''}{awayBestML.odds}
                          </div>
                          <div style={{ fontSize: '10px', color: theme.textSecondary }}>
                            {awayBestML.bookmaker}
                          </div>
                        </>
                      )}
                    </div>

                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#fbbf24' }}>
                      {awayPredML}%
                    </div>

                    <div>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={awayPredML || ''}
                        onChange={(e) => updatePrediction(game.id, `${awayTeam}_ml`, e.target.value)}
                        style={{
                          width: '70px',
                          padding: '6px',
                          fontSize: '13px',
                          border: `2px solid ${theme.border}`,
                          borderRadius: '6px',
                          background: theme.inputBg,
                          color: theme.text
                        }}
                      />
                      {awayEV_ML !== null && (
                        <div style={{
                          marginTop: '4px',
                          fontSize: '13px',
                          fontWeight: '700',
                          color: awayEV_ML > 0 ? '#16a34a' : '#dc2626'
                        }}>
                          {awayEV_ML > 0 ? '+' : ''}{awayEV_ML.toFixed(2)}%
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1.5fr 1fr 1.5fr',
                    gap: '15px',
                    alignItems: 'center',
                    padding: '15px',
                    background: darkMode ? '#0f172a' : '#f8fafc',
                    borderRadius: '12px',
                    marginBottom: '20px',
                    border: `3px solid ${getBorderColor(game.id, 'ml', homeTeam)}`
                  }}>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: theme.text }}>
                        {homeTeam}
                      </div>
                    </div>

                    <div>
                      {homeBestML && (
                        <>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: theme.text }}>
                            {homeBestML.odds > 0 ? '+' : ''}{homeBestML.odds}
                          </div>
                          <div style={{ fontSize: '10px', color: theme.textSecondary }}>
                            {homeBestML.bookmaker}
                          </div>
                        </>
                      )}
                    </div>

                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#fbbf24' }}>
                      {homePredML}%
                    </div>

                    <div>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={homePredML || ''}
                        onChange={(e) => updatePrediction(game.id, `${homeTeam}_ml`, e.target.value)}
                        style={{
                          width: '70px',
                          padding: '6px',
                          fontSize: '13px',
                          border: `2px solid ${theme.border}`,
                          borderRadius: '6px',
                          background: theme.inputBg,
                          color: theme.text
                        }}
                      />
                      {homeEV_ML !== null && (
                        <div style={{
                          marginTop: '4px',
                          fontSize: '13px',
                          fontWeight: '700',
                          color: homeEV_ML > 0 ? '#16a34a' : '#dc2626'
                        }}>
                          {homeEV_ML > 0 ? '+' : ''}{homeEV_ML.toFixed(2)}%
                        </div>
                      )}
                    </div>
                  </div>

                  {(homeBestSpread || awayBestSpread) && (
                    <>
                      <h3 style={{ color: theme.text, marginBottom: '15px', marginTop: '25px', fontSize: '18px' }}>
                        📊 Spreads
                      </h3>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={{
                          padding: '15px',
                          background: darkMode ? '#0f172a' : '#f8fafc',
                          borderRadius: '12px',
                          border: `3px solid ${getBorderColor(game.id, 'spread', awayTeam)}`
                        }}>
                          <div style={{ fontSize: '14px', color: theme.text, fontWeight: '700', marginBottom: '8px' }}>
                            {awayTeam}
                          </div>
                          {awayBestSpread && awaySpreadPoints !== null && (
                            <>
                              <div>
                                <span style={{ fontSize: '15px', fontWeight: '700', color: theme.text }}>
                                  {awaySpreadPoints > 0 ? '+' : ''}{awaySpreadPoints}
                                </span>
                                <span style={{ marginLeft: '8px', fontSize: '14px', color: theme.text }}>
                                  {awayBestSpread.odds > 0 ? '+' : ''}{awayBestSpread.odds}
                                </span>
                              </div>
                              <div style={{ fontSize: '10px', color: theme.textSecondary, marginTop: '4px' }}>
                                {awayBestSpread.bookmaker}
                              </div>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={awayPredSpread || ''}
                                onChange={(e) => updatePrediction(game.id, `${awayTeam}_spread`, e.target.value)}
                                style={{
                                  width: '70px',
                                  padding: '6px',
                                  fontSize: '12px',
                                  border: `2px solid ${theme.border}`,
                                  borderRadius: '6px',
                                  background: theme.inputBg,
                                  color: theme.text,
                                  marginTop: '8px'
                                }}
                              />
                              {homeEV_Spread !== null && (
                                <div style={{
                                  marginTop: '4px',
                                  fontSize: '13px',
                                  fontWeight: '700',
                                  color: homeEV_Spread > 0 ? '#16a34a' : '#dc2626'
                                }}>
                                  {homeEV_Spread > 0 ? '+' : ''}{homeEV_Spread.toFixed(2)}%
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {(overBest || underBest) && (
                    <>
                      <h3 style={{ color: theme.text, marginBottom: '15px', marginTop: '25px', fontSize: '18px' }}>
                        🎯 Totals
                      </h3>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        {overBest && (
                          <div style={{
                            padding: '15px',
                            background: darkMode ? '#0f172a' : '#f8fafc',
                            borderRadius: '12px',
                            border: `3px solid ${getBorderColor(game.id, 'total', 'Over')}`
                          }}>
                            <div style={{ fontSize: '14px', color: theme.text, fontWeight: '700', marginBottom: '8px' }}>
                              Over {overBest.points}
                            </div>
                            <div>
                              <span style={{ fontSize: '14px', fontWeight: '700', color: theme.text }}>
                                {overBest.odds > 0 ? '+' : ''}{overBest.odds}
                              </span>
                            </div>
                            <div style={{ fontSize: '10px', color: theme.textSecondary, marginTop: '4px' }}>
                              {overBest.bookmaker}
                            </div>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={overPred || ''}
                              onChange={(e) => updatePrediction(game.id, 'over', e.target.value)}
                              style={{
                                width: '70px',
                                padding: '6px',
                                fontSize: '12px',
                                border: `2px solid ${theme.border}`,
                                borderRadius: '6px',
                                background: theme.inputBg,
                                color: theme.text,
                                marginTop: '8px'
                              }}
                            />
                            {overEV !== null && (
                              <div style={{
                                marginTop: '4px',
                                fontSize: '13px',
                                fontWeight: '700',
                                color: overEV > 0 ? '#16a34a' : '#dc2626'
                              }}>
                                {overEV > 0 ? '+' : ''}{overEV.toFixed(2)}%
                              </div>
                            )}
                          </div>
                        )}
                        
                        {underBest && (
                          <div style={{
                            padding: '15px',
                            background: darkMode ? '#0f172a' : '#f8fafc',
                            borderRadius: '12px',
                            border: `3px solid ${getBorderColor(game.id, 'total', 'Under')}`
                          }}>
                            <div style={{ fontSize: '14px', color: theme.text, fontWeight: '700', marginBottom: '8px' }}>
                              Under {underBest.points}
                            </div>
                            <div>
                              <span style={{ fontSize: '14px', fontWeight: '700', color: theme.text }}>
                                {underBest.odds > 0 ? '+' : ''}{underBest.odds}
                              </span>
                            </div>
                            <div style={{ fontSize: '10px', color: theme.textSecondary, marginTop: '4px' }}>
                              {underBest.bookmaker}
                            </div>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={underPred || ''}
                              onChange={(e) => updatePrediction(game.id, 'under', e.target.value)}
                              style={{
                                width: '70px',
                                padding: '6px',
                                fontSize: '12px',
                                border: `2px solid ${theme.border}`,
                                borderRadius: '6px',
                                background: theme.inputBg,
                                color: theme.text,
                                marginTop: '8px'
                              }}
                            />
                            {underEV !== null && (
                              <div style={{
                                marginTop: '4px',
                                fontSize: '13px',
                                fontWeight: '700',
                                color: underEV > 0 ? '#16a34a' : '#dc2626'
                              }}>
                                {underEV > 0 ? '+' : ''}{underEV.toFixed(2)}%
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
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