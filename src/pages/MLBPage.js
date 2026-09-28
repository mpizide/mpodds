import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMLBOdds } from '../services/oddsAPI';
import {
  getScheduleForOddsGames,
  matchScheduleGame,
  getSavantData,
  getPlayers,
  buildPercentiles,
  PITCHER_METRICS
} from '../services/mlbData';
import { calculateEV } from '../utils/oddsCalculations';
import { loadMLBMLPredictions, getMLBGameLines, impliedMLBProbabilities, MLB_MODEL_INFO } from '../utils/mlbMLPredictions';
import { getMLBTeamLogo, getMLBTeamAbbr, getPlayerHeadshot } from '../utils/mlbTeams';
import { PercentileBadge } from '../components/PercentileChart';

const DATE_FORMAT = { year: 'numeric', month: '2-digit', day: '2-digit' };

// Pitcher metrics shown on the game card
const CARD_PITCHER_METRICS = PITCHER_METRICS.filter(m => ['xERA', 'K %', 'Whiff %'].includes(m.label));

const groupGamesByDate = (games) => {
  const gamesByDate = {};
  const now = new Date();
  const twoDaysFromNow = new Date(now);
  twoDaysFromNow.setDate(now.getDate() + 2);
  twoDaysFromNow.setHours(23, 59, 59, 999);

  games.forEach(game => {
    const gameDate = new Date(game.commence_time);
    if (gameDate >= now && gameDate <= twoDaysFromNow) {
      const dateKey = gameDate.toLocaleDateString('en-US', DATE_FORMAT);
      if (!gamesByDate[dateKey]) gamesByDate[dateKey] = [];
      gamesByDate[dateKey].push(game);
    }
  });

  return gamesByDate;
};

const MLBPage = () => {
  const navigate = useNavigate();
  const [allGames, setAllGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [predictions, setPredictions] = useState({});
  const [darkMode, setDarkMode] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dates, setDates] = useState([]);
  const [scheduleByEvent, setScheduleByEvent] = useState({});
  const [pitchers, setPitchers] = useState({});
  const [savant, setSavant] = useState(null);
  const [selectedBookmakers, setSelectedBookmakers] = useState(() => {
    const saved = localStorage.getItem('mlb_selectedBookmakers');
    return saved ? JSON.parse(saved) : [];
  });
  const [availableBookmakers, setAvailableBookmakers] = useState([]);
  const [showBookmakerDropdown, setShowBookmakerDropdown] = useState(false);
  const dropdownRef = useRef(null);

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
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBookmakerDropdown]);

  // Probable pitchers + Savant data are extras: the page still works without them
  const loadGameDetails = useCallback(async (games, forceRefresh) => {
    try {
      const schedule = await getScheduleForOddsGames(games, forceRefresh);
      const byEvent = {};
      games.forEach(g => {
        const match = matchScheduleGame(g, schedule);
        if (match) byEvent[g.id] = match;
      });
      setScheduleByEvent(byEvent);

      const season = games.length ? new Date(games[0].commence_time).getFullYear() : new Date().getFullYear();
      const pitcherIds = Object.values(byEvent).flatMap(g => [
        g.teams.away.probablePitcher?.id,
        g.teams.home.probablePitcher?.id
      ]);

      const [players, savantData] = await Promise.all([
        getPlayers(pitcherIds, season),
        getSavantData(season, forceRefresh)
      ]);
      setPitchers(players);
      setSavant(savantData);
    } catch (err) {
      console.error('Error loading MLB game details:', err);
    }
  }, []);

  const fetchGames = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      const response = await getMLBOdds(forceRefresh);
      const data = response.data;
      setAllGames(data);

      const gamesByDate = groupGamesByDate(data);
      const dateKeys = Object.keys(gamesByDate).sort((a, b) => new Date(a) - new Date(b));
      setDates(dateKeys);

      setSelectedDate(prev => {
        if (prev && dateKeys.includes(prev)) return prev;
        const today = new Date().toLocaleDateString('en-US', DATE_FORMAT);
        return dateKeys.includes(today) ? today : dateKeys[0] || null;
      });

      const bookmakerSet = new Set();
      data.forEach(game => game.bookmakers?.forEach(book => bookmakerSet.add(book.title)));
      setAvailableBookmakers(Array.from(bookmakerSet).sort());

      // Model projections first; market no-vig odds for any game the model hasn't covered
      const mlPredictions = loadMLBMLPredictions(data);
      const initialPredictions = {};
      data.forEach(game => {
        initialPredictions[game.id] = mlPredictions[game.id] || impliedMLBProbabilities(game);
      });
      setPredictions(initialPredictions);
      setError(null);

      loadGameDetails(data, forceRefresh);
    } catch (err) {
      setError('Failed to fetch games. Check your API key.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [loadGameDetails]);

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
    return groupGamesByDate(allGames)[selectedDate] || [];
  };

  // Rank every bet on the selected date by EV (same rules as the other sport pages)
  const getTopBets = (games) => {
    const allBets = [];
    games.forEach(game => {
      const { id: gameId, home_team: homeTeam, away_team: awayTeam } = game;
      const pred = predictions[gameId] || {};
      const lines = getMLBGameLines(game);

      [[homeTeam, lines.homeML, lines.homeSpread], [awayTeam, lines.awayML, lines.awaySpread]].forEach(([team, bestML, bestSpread]) => {
        if (pred[`${team}_ml`] && bestML && bestML.odds < 300) {
          const ev = calculateEV(pred[`${team}_ml`], bestML.odds, 'moneyline');
          if (ev !== null) allBets.push({ gameId, type: 'ml', team, ev });
        }
        if (pred[`${team}_spread`] && bestSpread) {
          const ev = calculateEV(pred[`${team}_spread`], bestSpread.odds, 'spread');
          if (ev !== null) allBets.push({ gameId, type: 'spread', team, ev });
        }
      });

      [['Over', lines.over], ['Under', lines.under]].forEach(([side, best]) => {
        const p = pred[side.toLowerCase()];
        if (p && best) {
          const ev = calculateEV(p, best.odds, 'total');
          if (ev !== null) allBets.push({ gameId, type: 'total', team: side, ev });
        }
      });
    });

    allBets.sort((a, b) => b.ev - a.ev);

    // One side bet (ML or run line) and one total per game, top 9 overall
    const topBets = [];
    const seenSide = new Set();
    const seenTotal = new Set();
    for (const bet of allBets) {
      if (bet.type === 'total') {
        if (seenTotal.has(bet.gameId)) continue;
        seenTotal.add(bet.gameId);
      } else {
        if (seenSide.has(bet.gameId)) continue;
        seenSide.add(bet.gameId);
      }
      topBets.push(bet);
      if (topBets.length === 9) break;
    }
    return topBets;
  };

  const theme = {
    bg: darkMode ? '#0f172a' : '#f1f5f9',
    cardBg: darkMode ? '#1e293b' : '#ffffff',
    text: darkMode ? '#f1f5f9' : '#1e293b',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    inputBg: darkMode ? '#334155' : '#ffffff',
    innerBg: darkMode ? '#0f172a' : '#f8fafc'
  };

  if (loading) {
    return (
      <div style={{ padding: '100px', textAlign: 'center', fontSize: '24px', background: theme.bg, color: theme.text, minHeight: '100vh' }}>
        Loading MLB games...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '100px', textAlign: 'center', background: theme.bg, minHeight: '100vh' }}>
        <div style={{ fontSize: '24px', color: '#dc2626', marginBottom: '20px' }}>{error}</div>
        <button
          onClick={() => fetchGames()}
          style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}
        >
          Retry
        </button>
      </div>
    );
  }

  const games = getFilteredGames();
  const finalSource = MLB_MODEL_INFO.blend?.moneyline?.method || 'model';
  const modelStale = MLB_MODEL_INFO.generatedAt && Date.now() - MLB_MODEL_INFO.generatedAt.getTime() > 24 * 60 * 60 * 1000;
  const topBets = getTopBets(games);

  const getBorderColor = (gameId, type, team) => {
    const position = topBets.findIndex(b => b.gameId === gameId && b.type === type && b.team === team);
    if (position === -1) return 'transparent';
    if (position === 0) return '#a855f7';
    if (games.length <= 2) return 'transparent';
    if (position < 3) return '#22c55e';
    if (position < 6) return '#fbbf24';
    return '#ef4444';
  };

  const isTopPick = (gameId, type, team) =>
    topBets[0]?.gameId === gameId && topBets[0]?.type === type && topBets[0]?.team === team;

  const renderBetCell = ({ game, type, team, line, best, predKey }) => {
    if (!best) return <div key={`${type}-${team}`} style={{ minHeight: '88px' }} />;
    const pred = predictions[game.id]?.[predKey];
    const evType = type === 'ml' ? 'moneyline' : type;
    const ev = pred ? calculateEV(pred, best.odds, evType) : null;

    return (
      <div key={`${type}-${team}`} style={{
        padding: '12px',
        background: theme.innerBg,
        borderRadius: '10px',
        border: `3px solid ${getBorderColor(game.id, type, team)}`,
        minHeight: '88px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        boxSizing: 'border-box'
      }}>
        {isTopPick(game.id, type, team) && (
          <div style={{
            position: 'absolute', top: '-8px', right: '-8px', width: '24px', height: '24px', borderRadius: '50%',
            background: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
            fontSize: '12px', fontWeight: '700', boxShadow: '0 2px 8px rgba(168, 85, 247, 0.5)'
          }}>★</div>
        )}
        <div style={{ marginBottom: '6px' }}>
          {line !== null && (
            <span style={{ fontSize: '14px', fontWeight: '700', color: theme.text, marginRight: '6px' }}>{line}</span>
          )}
          <span style={{ fontSize: line !== null ? '13px' : '14px', fontWeight: line !== null ? '400' : '700', color: theme.text }}>
            {best.odds > 0 ? '+' : ''}{best.odds}
          </span>
        </div>
        <div style={{ fontSize: '9px', color: theme.textSecondary, marginBottom: '6px' }}>{best.bookmaker}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {predictions[game.id]?._hasMLPredictions && (
            finalSource === 'market'
              ? <span style={{ fontSize: '12px' }} title="Market consensus (no-vig): beat the model in the backtest">📈</span>
              : <span style={{ fontSize: '12px' }} title="ML model prediction">🤖</span>
          )}
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={pred || ''}
            onChange={(e) => updatePrediction(game.id, predKey, e.target.value)}
            style={{
              width: '55px', padding: '4px', fontSize: '11px', border: `2px solid ${theme.border}`,
              borderRadius: '6px', background: theme.inputBg, color: theme.text
            }}
          />
          {ev !== null && (
            <span style={{ fontSize: '11px', fontWeight: '700', color: ev > 0 ? '#16a34a' : '#dc2626' }}>
              {ev > 0 ? '+' : ''}{ev.toFixed(2)}%
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderPitcherRow = (probable, teamName) => {
    if (!probable) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: theme.textSecondary, fontSize: '13px' }}>
          <img src={getMLBTeamLogo(teamName)} alt="" style={{ width: '20px', height: '20px' }} />
          Probable pitcher TBD
        </div>
      );
    }
    const info = pitchers[probable.id];
    const stats = info?.pitching;
    const rows = savant ? buildPercentiles(savant.pitchers, probable.id, CARD_PITCHER_METRICS) : [];

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <img
          src={getPlayerHeadshot(probable.id)}
          alt={probable.fullName}
          style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', background: theme.border }}
        />
        <div style={{ minWidth: '150px' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: theme.text }}>
            {probable.fullName}
            {info?.pitchHand && <span style={{ color: theme.textSecondary, fontWeight: '600' }}> ({info.pitchHand}HP)</span>}
          </div>
          <div style={{ fontSize: '12px', color: theme.textSecondary }}>
            {getMLBTeamAbbr(teamName)}
            {stats && ` · ${stats.wins}-${stats.losses} · ${stats.era} ERA · ${stats.inningsPitched} IP · ${stats.strikeOuts} K`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {rows.map(r => (
            <div key={r.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <PercentileBadge percentile={r.percentile} estimated={r.estimated} title={`${r.label} percentile`} />
              <span style={{ fontSize: '10px', color: theme.textSecondary }}>{r.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const buttonStyle = {
    padding: '10px 20px',
    background: theme.cardBg,
    color: theme.text,
    border: `2px solid ${theme.border}`,
    borderRadius: '8px',
    cursor: 'pointer'
  };

  return (
    <div style={{ background: theme.bg, minHeight: '100vh', paddingBottom: '40px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h1 style={{ fontSize: '36px', color: theme.text, margin: 0 }}>⚾ MLB Games</h1>
            <div style={{ fontSize: '12px', marginTop: '6px', color: modelStale ? '#f59e0b' : theme.textSecondary }}>
              {MLB_MODEL_INFO.generatedAt
                ? <>
                  {finalSource === 'market'
                    ? '📈 Probabilities = sharp market consensus (beat our model on 9.8k past games), so +EV means a book is off-market'
                    : '🤖 Probabilities from the ML model'}
                  {` · 🤖 model projections from ${MLB_MODEL_INFO.generatedAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
                  {modelStale && ' · over a day old: run python ml_mlb/mlb_predict_upcoming.py'}</>
                : '🤖 No model predictions yet: run python ml_mlb/mlb_predict_upcoming.py'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '12px', color: theme.textSecondary, display: 'flex', gap: '15px', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px',
                  borderRadius: '50%', background: '#a855f7', color: 'white', fontSize: '10px'
                }}>★</span> Pick of Day
              </span>
              <span><span style={{ color: '#22c55e' }}>●</span> Top 3</span>
              <span><span style={{ color: '#fbbf24' }}>●</span> 4-6</span>
              <span><span style={{ color: '#ef4444' }}>●</span> 7-9</span>
            </div>

            <button onClick={() => setDarkMode(!darkMode)} style={{ ...buttonStyle, fontSize: '20px' }}>
              {darkMode ? '☀️' : '🌙'}
            </button>

            <button
              onClick={() => fetchGames(true)}
              style={{ padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Date filter */}
        <div style={{
          display: 'flex', gap: '10px', marginBottom: '30px', flexWrap: 'wrap', padding: '20px',
          background: theme.cardBg, borderRadius: '12px', border: `1px solid ${theme.border}`
        }}>
          <div style={{ fontSize: '16px', fontWeight: '600', color: theme.text, marginRight: '10px', display: 'flex', alignItems: 'center' }}>
            Filter by Date:
          </div>
          {dates.map(date => {
            const today = new Date().toLocaleDateString('en-US', DATE_FORMAT);
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toLocaleDateString('en-US', DATE_FORMAT);

            let label;
            if (date === today) label = 'Today';
            else if (date === tomorrowStr) label = 'Tomorrow';
            else label = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

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

        {/* Bookmaker filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '30px', position: 'relative' }}>
          <label style={{ fontSize: '14px', color: theme.text, fontWeight: '600' }}>📚 Sportsbooks:</label>
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowBookmakerDropdown(!showBookmakerDropdown)}
              style={{
                padding: '8px 12px', background: theme.cardBg, color: theme.text, border: `2px solid ${theme.border}`,
                borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', minWidth: '200px',
                textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}
            >
              <span>{selectedBookmakers.length === 0 ? 'All Sportsbooks' : `${selectedBookmakers.length} selected`}</span>
              <span>{showBookmakerDropdown ? '▲' : '▼'}</span>
            </button>

            {showBookmakerDropdown && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: '4px', background: theme.cardBg,
                border: `2px solid ${theme.border}`, borderRadius: '8px', padding: '8px', zIndex: 1000,
                minWidth: '250px', maxHeight: '300px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px',
                  paddingBottom: '8px', borderBottom: `1px solid ${theme.border}`
                }}>
                  <span style={{ fontSize: '12px', color: theme.textSecondary, fontWeight: '600' }}>
                    {selectedBookmakers.length} of {availableBookmakers.length} selected
                  </span>
                  {selectedBookmakers.length > 0 && (
                    <button
                      onClick={() => {
                        setSelectedBookmakers([]);
                        localStorage.removeItem('mlb_selectedBookmakers');
                      }}
                      style={{ padding: '4px 8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
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
                        display: 'flex', alignItems: 'center', padding: '6px 8px', cursor: 'pointer', borderRadius: '4px',
                        fontSize: '13px', color: theme.text, background: isSelected ? (darkMode ? '#334155' : '#f1f5f9') : 'transparent'
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
                          localStorage.setItem('mlb_selectedBookmakers', JSON.stringify(updated));
                        }}
                        style={{ marginRight: '8px', cursor: 'pointer' }}
                      />
                      {book}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {games.length === 0 ? (
          <div style={{ background: theme.cardBg, padding: '40px', borderRadius: '16px', textAlign: 'center', color: theme.textSecondary }}>
            {selectedDate ? `No games found for ${selectedDate}. Try another date!` : 'No MLB games with odds in the next few days.'}
          </div>
        ) : (
          <>
            <div style={{ fontSize: '14px', color: theme.textSecondary, marginBottom: '20px', fontWeight: '600' }}>
              Showing {games.length} games for {selectedDate}
            </div>
            {games.map(game => {
              const homeTeam = game.home_team;
              const awayTeam = game.away_team;
              const scheduleGame = scheduleByEvent[game.id];

              const {
                homeML: homeBestML, awayML: awayBestML, homeSpread: homeBestSpread,
                awaySpread: awayBestSpread, over: overBest, under: underBest
              } = getMLBGameLines(game, selectedBookmakers);
              const projection = predictions[game.id]?._projection;
              const fmtLine = (p) => (p === null || p === undefined ? null : `${p > 0 ? '+' : ''}${p}`);

              // Away on top, baseball-style
              const teams = [
                { name: awayTeam, side: 'away', ml: awayBestML, spread: awayBestSpread, total: overBest, totalSide: 'Over', opp: homeBestML },
                { name: homeTeam, side: 'home', ml: homeBestML, spread: homeBestSpread, total: underBest, totalSide: 'Under', opp: awayBestML }
              ];

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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '14px', color: theme.textSecondary, fontWeight: '600' }}>
                      {new Date(game.commence_time).toLocaleString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                      })}
                      {scheduleGame?.venue?.name && ` · ${scheduleGame.venue.name}`}
                      {scheduleGame?.seriesDescription && scheduleGame.gameType !== 'R' && (
                        <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '6px', background: '#7c3aed', color: 'white', fontSize: '11px' }}>
                          {scheduleGame.seriesDescription}{scheduleGame.seriesGameNumber ? ` · Game ${scheduleGame.seriesGameNumber}` : ''}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => navigate(`/mlb/game/${game.id}`)}
                      style={{
                        padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px',
                        cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'background 0.2s'
                      }}
                      onMouseOver={(e) => e.target.style.background = '#2563eb'}
                      onMouseOut={(e) => e.target.style.background = '#3b82f6'}
                    >
                      📋 Lineups & Percentiles
                    </button>
                  </div>

                  {/* Probable pitchers */}
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px 16px', marginBottom: '20px',
                    background: theme.innerBg, borderRadius: '10px'
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: theme.textSecondary, letterSpacing: '0.5px' }}>
                      PROBABLE PITCHERS
                    </div>
                    {renderPitcherRow(scheduleGame?.teams.away.probablePitcher, awayTeam)}
                    {renderPitcherRow(scheduleGame?.teams.home.probablePitcher, homeTeam)}
                  </div>

                  {/* Model projection */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', padding: '10px 16px',
                    marginBottom: '20px', borderRadius: '10px', fontSize: '13px',
                    background: projection ? (darkMode ? 'rgba(168, 85, 247, 0.12)' : '#f5f3ff') : theme.innerBg,
                    border: `1px solid ${projection ? 'rgba(168, 85, 247, 0.4)' : theme.border}`,
                    color: theme.text
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: projection ? '#a855f7' : theme.textSecondary, letterSpacing: '0.5px' }}>
                      🤖 MODEL PROJECTION
                    </span>
                    {projection ? (
                      <>
                        <span>
                          <strong>{getMLBTeamAbbr(awayTeam)} {projection.predicted_away_runs.toFixed(1)}</strong>
                          {' – '}
                          <strong>{getMLBTeamAbbr(homeTeam)} {projection.predicted_home_runs.toFixed(1)}</strong>
                        </span>
                        <span>Total <strong>{projection.predicted_total.toFixed(1)}</strong></span>
                        <span>
                          Model win: {getMLBTeamAbbr(awayTeam)} <strong>{projection.away_win_prob}%</strong>
                          {' · '}{getMLBTeamAbbr(homeTeam)} <strong>{projection.home_win_prob}%</strong>
                        </span>
                        {finalSource === 'market' && predictions[game.id]?._probabilities?.market?.mlHome != null && (
                          <span style={{ color: theme.textSecondary }}>
                            Market: {getMLBTeamAbbr(awayTeam)} {predictions[game.id]._probabilities.market.mlAway.toFixed(1)}%
                            {' · '}{getMLBTeamAbbr(homeTeam)} {predictions[game.id]._probabilities.market.mlHome.toFixed(1)}%
                          </span>
                        )}
                        {(!projection.home_sp || !projection.away_sp) && (
                          <span style={{ fontSize: '11px', color: theme.textSecondary }}>
                            (TBD starter: averaged over the team's recent rotation)
                          </span>
                        )}
                      </>
                    ) : (
                      <span style={{ color: theme.textSecondary }}>Not in the latest model run: using market odds</span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: '10px' }}>
                    {['Team', '📊 Run Line', '💰 Moneyline', '🎯 Totals'].map(h => (
                      <h3 key={h} style={{ color: theme.text, margin: '0 0 2px', fontSize: '16px' }}>{h}</h3>
                    ))}

                    {teams.map(t => {
                      const record = scheduleGame?.teams[t.side].leagueRecord;
                      return (
                        <React.Fragment key={t.side}>
                          <div style={{
                            padding: '12px 10px', background: theme.innerBg, borderRadius: '10px', display: 'flex',
                            alignItems: 'center', gap: '8px', minHeight: '88px', boxSizing: 'border-box'
                          }}>
                            <img src={getMLBTeamLogo(t.name)} alt={t.name} style={{ width: '32px', height: '32px' }} />
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: '700', color: theme.text }}>{getMLBTeamAbbr(t.name)}</div>
                              {record && record.wins + record.losses > 0 && (
                                <div style={{ fontSize: '10px', color: theme.textSecondary }}>{record.wins}-{record.losses}</div>
                              )}
                              {t.ml && t.opp && (
                                <div style={{ fontSize: '10px', color: t.ml.odds < t.opp.odds ? '#22c55e' : theme.textSecondary }}>
                                  {t.ml.odds < t.opp.odds ? 'FAV' : 'DOG'}
                                </div>
                              )}
                            </div>
                          </div>
                          {renderBetCell({ game, type: 'spread', team: t.name, line: fmtLine(t.spread?.points), best: t.spread, predKey: `${t.name}_spread` })}
                          {renderBetCell({ game, type: 'ml', team: t.name, line: null, best: t.ml, predKey: `${t.name}_ml` })}
                          {renderBetCell({
                            game,
                            type: 'total',
                            team: t.totalSide,
                            line: t.total ? `${t.totalSide[0]} ${t.total.points}` : null,
                            best: t.total,
                            predKey: t.totalSide.toLowerCase()
                          })}
                        </React.Fragment>
                      );
                    })}
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

export default MLBPage;
