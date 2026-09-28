import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getMLBOdds, getMLBPlayerProps } from '../services/oddsAPI';
import { evaluateMLBProps } from '../utils/mlbProps';
import {
  getScheduleForOddsGames,
  matchScheduleGame,
  getSavantData,
  getTeamLineup,
  getPlayers,
  buildPercentiles,
  BATTER_METRICS,
  PITCHER_METRICS
} from '../services/mlbData';
import { calculateEV } from '../utils/oddsCalculations';
import {
  findMLBPrediction,
  getMLBGameLines,
  computeMLBProbabilities,
  marketMLBProbabilities,
  MLB_MODEL_INFO
} from '../utils/mlbMLPredictions';
import { getMLBTeamLogo, getMLBTeamAbbr, getPlayerHeadshot } from '../utils/mlbTeams';
import PercentileChart, { PercentileBadge } from '../components/PercentileChart';

// Columns shown on each lineup row / pitcher card
const LINEUP_METRICS = BATTER_METRICS.filter(m =>
  ['xwOBA', 'xSLG', 'Barrel %', 'Hard-Hit %', 'K %', 'BB %'].includes(m.label)
);
const PITCHER_CARD_METRICS = PITCHER_METRICS.filter(m =>
  ['xERA', 'xwOBA', 'K %', 'BB %', 'Whiff %', 'Fastball Velo'].includes(m.label)
);

const SHORT_LABELS = {
  'xwOBA': 'xwOBA',
  'xSLG': 'xSLG',
  'Barrel %': 'Brl%',
  'Hard-Hit %': 'HH%',
  'K %': 'K%',
  'BB %': 'BB%',
  'xERA': 'xERA',
  'Whiff %': 'Whiff',
  'Fastball Velo': 'Velo'
};

// Batter has the platoon edge vs. this pitcher hand
const hasPlatoonEdge = (batSide, pitchHand) =>
  batSide && pitchHand && (batSide === 'S' || batSide !== pitchHand);

const MLBGamePage = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [game, setGame] = useState(null);
  const [scheduleGame, setScheduleGame] = useState(null);
  const [lineups, setLineups] = useState({ away: null, home: null });
  const [players, setPlayers] = useState({});
  const [savant, setSavant] = useState(null);
  const [selected, setSelected] = useState(null); // { id, type: 'batter' | 'pitcher' }
  const [propsEvent, setPropsEvent] = useState(null);
  const [propsError, setPropsError] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await getMLBOdds();
      const oddsGame = data.find(g => g.id === eventId);
      if (!oddsGame) {
        setError('Game not found — it may have already started. Head back to the MLB page for current games.');
        return;
      }
      setGame(oddsGame);

      const season = new Date(oddsGame.commence_time).getFullYear();
      const schedule = await getScheduleForOddsGames([oddsGame]);
      const match = matchScheduleGame(oddsGame, schedule);
      setScheduleGame(match);

      const [savantData, awayLineup, homeLineup] = await Promise.all([
        getSavantData(season),
        match ? getTeamLineup(match, 'away') : null,
        match ? getTeamLineup(match, 'home') : null
      ]);
      setSavant(savantData);
      setLineups({ away: awayLineup, home: homeLineup });

      const ids = [
        ...(awayLineup?.players || []).map(p => p.id),
        ...(homeLineup?.players || []).map(p => p.id),
        match?.teams.away.probablePitcher?.id,
        match?.teams.home.probablePitcher?.id
      ];
      setPlayers(await getPlayers(ids, season));

      // Player props are an extra: the page still works if they fail or aren't posted yet
      try {
        const props = await getMLBPlayerProps(eventId);
        setPropsEvent(props.data);
        setPropsError(null);
      } catch (err) {
        setPropsError('Player props unavailable right now.');
      }
      setError(null);
    } catch (err) {
      console.error('Error loading MLB game:', err);
      setError('Failed to load game details.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Close the player card with Escape
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setSelected(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const theme = {
    bg: darkMode ? '#0f172a' : '#f1f5f9',
    cardBg: darkMode ? '#1e293b' : '#ffffff',
    text: darkMode ? '#f1f5f9' : '#1e293b',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    innerBg: darkMode ? '#0f172a' : '#f8fafc',
    hover: darkMode ? '#273449' : '#eef2f7'
  };

  const cardStyle = {
    background: theme.cardBg,
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '20px',
    boxShadow: darkMode ? '0 4px 6px rgba(0,0,0,0.3)' : '0 4px 6px rgba(0,0,0,0.1)',
    border: `1px solid ${theme.border}`
  };

  const backButton = (
    <button
      onClick={() => navigate('/mlb')}
      style={{
        padding: '10px 20px', background: theme.cardBg, color: theme.text, border: `2px solid ${theme.border}`,
        borderRadius: '8px', cursor: 'pointer', fontWeight: '600'
      }}
    >
      ← Back to MLB
    </button>
  );

  if (loading) {
    return (
      <div style={{ padding: '100px', textAlign: 'center', fontSize: '24px', background: theme.bg, color: theme.text, minHeight: '100vh' }}>
        Loading lineups & percentiles...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '100px', textAlign: 'center', background: theme.bg, minHeight: '100vh' }}>
        <div style={{ fontSize: '20px', color: '#dc2626', marginBottom: '20px' }}>{error}</div>
        {backButton}
      </div>
    );
  }

  const awayTeam = game.away_team;
  const homeTeam = game.home_team;
  const awayPitcher = scheduleGame?.teams.away.probablePitcher;
  const homePitcher = scheduleGame?.teams.home.probablePitcher;

  // Implied team run totals from the game odds (market total split by the market win probability;
  // ~10 runs of margin per 100% win probability matches MLB run-differential/win-rate data)
  const gameLines = getMLBGameLines(game || { bookmakers: [], home_team: '', away_team: '' });
  const gameMarket = game ? marketMLBProbabilities(game, gameLines) : {};
  const teamTotals = {};
  if (gameLines.over?.points && gameMarket.mlHome !== null && gameMarket.mlHome !== undefined) {
    const margin = 10 * (gameMarket.mlHome / 100 - 0.5);
    teamTotals.home = gameLines.over.points / 2 + margin / 2;
    teamTotals.away = gameLines.over.points / 2 - margin / 2;
  }
  const propEval = propsEvent
    ? evaluateMLBProps(propsEvent, lineups, players, { away: awayPitcher?.id, home: homePitcher?.id }, teamTotals)
    : { byPlayerId: {}, highlights: { away: null, home: null }, projections: {} };
  const fmtEV = (ev) => (ev === null ? '—' : `${ev > 0 ? '+' : ''}${ev.toFixed(1)}%`);
  const propLabel = (r) => `${r.side === 'Over' ? 'O' : 'U'} ${r.line} ${r.short}`;

  const renderPropPill = (highlight, compact = false) => {
    const r = highlight.prop;
    const color = r.agree ? '#22c55e' : '#f59e0b';
    return (
      <span
        title={r.agree
          ? 'Market fair odds AND the stat projection both say this price is +EV'
          : 'Best prop on this team, but the market and projection do not both show +EV'}
        style={{
          marginLeft: compact ? '6px' : 0, padding: '1px 7px', borderRadius: '999px', fontSize: '10px', fontWeight: '800',
          background: `${color}22`, color, border: `1px solid ${color}88`, whiteSpace: 'nowrap'
        }}
      >
        {r.agree ? '💎 VALUE' : '👀 LEAN'}{!compact && ` ${propLabel(r)} ${fmtOdds(r.best.odds)}`}
      </span>
    );
  };

  const fmtOdds = (o) => (o > 0 ? `+${o}` : `${o}`);

  // Best-price summary for the header
  const lines = getMLBGameLines(game);
  const fmtPoint = (p) => `${p > 0 ? '+' : ''}${p}`;
  const oddsSummary = (team) => {
    const ml = team === homeTeam ? lines.homeML : lines.awayML;
    const rl = team === homeTeam ? lines.homeSpread : lines.awaySpread;
    return {
      ml: ml ? fmtOdds(ml.odds) : '—',
      rl: rl ? `${fmtPoint(rl.points)} (${fmtOdds(rl.odds)})` : '—'
    };
  };
  const { over, under } = lines;

  const projection = findMLBPrediction(game);
  const probs = projection ? computeMLBProbabilities(projection, game, lines) : null;

  const renderModelCard = () => {
    if (!projection) {
      return (
        <div style={{ ...cardStyle, color: theme.textSecondary, fontSize: '14px' }}>
          🤖 This game isn't in the latest model run yet. Run <code>python ml_mlb/mlb_predict_upcoming.py</code> to project it.
        </div>
      );
    }

    const row = (label, best, key, type) => best && {
      label, best, type, model: probs.model[key], market: probs.market[key], final: probs[key]
    };
    const betRows = [
      row(`${getMLBTeamAbbr(awayTeam)} ML`, lines.awayML, 'mlAway', 'moneyline'),
      row(`${getMLBTeamAbbr(homeTeam)} ML`, lines.homeML, 'mlHome', 'moneyline'),
      lines.awaySpread && row(`${getMLBTeamAbbr(awayTeam)} ${fmtPoint(lines.awaySpread.points)}`, lines.awaySpread, 'rlAway', 'spread'),
      lines.homeSpread && row(`${getMLBTeamAbbr(homeTeam)} ${fmtPoint(lines.homeSpread.points)}`, lines.homeSpread, 'rlHome', 'spread'),
      over && row(`Over ${over.points}`, over, 'over', 'total'),
      under && row(`Under ${under.points}`, under, 'under', 'total')
    ].filter(Boolean);
    const pct = (v) => (v === null || v === undefined ? '—' : `${v.toFixed(1)}%`);

    const methodText = (kind) => {
      const m = MLB_MODEL_INFO.blend?.[kind]?.method;
      return m === 'blend' ? 'model + market blend' : m === 'market' ? 'market only' : 'model only';
    };
    const blendNote = MLB_MODEL_INFO.blend
      ? `FINAL = most accurate option on ${MLB_MODEL_INFO.blend.moneyline.games.toLocaleString()} past games vs real closing lines: moneyline & run line use ${methodText('moneyline')}, totals use ${methodText('totals')}.`
      : 'FINAL = model only (run python ml_mlb/mlb_evaluate_blend.py to test against the market).';
    const awayPct = probs.mlAway ?? projection.away_win_prob;
    return (
      <div style={{ ...cardStyle, border: '1px solid rgba(168, 85, 247, 0.45)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          <div style={{ fontSize: '20px', fontWeight: '800', color: theme.text }}>🤖 Model Projection</div>
          <div style={{ fontSize: '12px', color: theme.textSecondary }}>
            {MLB_MODEL_INFO.generatedAt && `Updated ${MLB_MODEL_INFO.generatedAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
            {(!projection.home_sp || !projection.away_sp) && " · TBD starter averaged over the team's recent rotation"}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: theme.textSecondary, letterSpacing: '0.5px' }}>PROJECTED SCORE</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: theme.text }}>
              {getMLBTeamAbbr(awayTeam)} {projection.predicted_away_runs.toFixed(1)}
              <span style={{ color: theme.textSecondary, margin: '0 10px' }}>–</span>
              {projection.predicted_home_runs.toFixed(1)} {getMLBTeamAbbr(homeTeam)}
            </div>
            <div style={{ fontSize: '12px', color: theme.textSecondary }}>Total {projection.predicted_total.toFixed(1)} runs</div>
          </div>

          <div style={{ flex: '1 1 320px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '700', color: theme.text, marginBottom: '6px' }}>
              <span>{getMLBTeamAbbr(awayTeam)} {awayPct}%</span>
              <span style={{ color: theme.textSecondary, fontSize: '11px' }}>WIN PROBABILITY</span>
              <span>{probs.mlHome ?? projection.home_win_prob}% {getMLBTeamAbbr(homeTeam)}</span>
            </div>
            <div style={{ display: 'flex', height: '14px', borderRadius: '7px', overflow: 'hidden', background: theme.border }}>
              <div style={{ width: `${awayPct}%`, background: '#3b82f6' }} />
              <div style={{ flex: 1, background: '#ef4444' }} />
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: theme.text, minWidth: '520px' }}>
            <thead>
              <tr style={{ color: theme.textSecondary, fontSize: '11px', letterSpacing: '0.5px', textAlign: 'right' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>BET</th>
                <th style={{ padding: '6px 8px' }}>BEST ODDS</th>
                <th style={{ padding: '6px 8px' }}>MODEL</th>
                <th style={{ padding: '6px 8px' }}>MARKET (NO-VIG)</th>
                <th style={{ padding: '6px 8px' }} title="What the page uses: the backtest's most accurate combination">FINAL</th>
                <th style={{ padding: '6px 8px' }}>EV</th>
              </tr>
            </thead>
            <tbody>
              {betRows.map(r => {
                const ev = r.final !== null ? calculateEV(r.final, r.best.odds, r.type) : null;
                return (
                  <tr key={r.label} style={{ borderTop: `1px solid ${theme.border}`, textAlign: 'right' }}>
                    <td style={{ textAlign: 'left', padding: '8px', fontWeight: '700' }}>{r.label}</td>
                    <td style={{ padding: '8px' }}>
                      {fmtOdds(r.best.odds)} <span style={{ fontSize: '10px', color: theme.textSecondary }}>{r.best.bookmaker}</span>
                    </td>
                    <td style={{ padding: '8px', color: theme.textSecondary }}>{pct(r.model)}</td>
                    <td style={{ padding: '8px', color: theme.textSecondary }}>{pct(r.market)}</td>
                    <td style={{ padding: '8px', fontWeight: '800' }}>{pct(r.final)}</td>
                    <td style={{ padding: '8px', fontWeight: '700', color: ev === null ? theme.textSecondary : ev > 0 ? '#22c55e' : '#ef4444' }}>
                      {ev === null ? '—' : `${ev > 0 ? '+' : ''}${ev.toFixed(2)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: '11px', color: theme.textSecondary, marginTop: '8px', lineHeight: 1.5 }}>
          {blendNote}
          {probs.push > 0 && ` Whole-number total: ${probs.push}% chance of a push; totals probabilities leave pushes out.`}
        </div>
      </div>
    );
  };

  const renderTeamHeader = (team, side) => {
    const record = scheduleGame?.teams[side].leagueRecord;
    const odds = oddsSummary(team);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minWidth: '160px' }}>
        <img src={getMLBTeamLogo(team)} alt={team} style={{ width: '72px', height: '72px' }} />
        <div style={{ fontSize: '20px', fontWeight: '800', color: theme.text, textAlign: 'center' }}>{team}</div>
        {record && record.wins + record.losses > 0 && (
          <div style={{ fontSize: '13px', color: theme.textSecondary }}>{record.wins}-{record.losses}</div>
        )}
        <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
          <span style={{ padding: '4px 8px', borderRadius: '6px', background: theme.innerBg, color: theme.text }}>ML {odds.ml}</span>
          <span style={{ padding: '4px 8px', borderRadius: '6px', background: theme.innerBg, color: theme.text }}>RL {odds.rl}</span>
        </div>
      </div>
    );
  };

  const renderPitcherCard = (probable, team, opposingLineup) => {
    if (!probable) {
      return (
        <div style={{ ...cardStyle, marginBottom: 0, flex: '1 1 420px', color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src={getMLBTeamLogo(team)} alt="" style={{ width: '36px', height: '36px' }} />
          {getMLBTeamAbbr(team)} probable pitcher not announced yet
        </div>
      );
    }
    const info = players[probable.id];
    const stats = info?.pitching;
    const rows = buildPercentiles(savant?.pitchers, probable.id, PITCHER_CARD_METRICS);
    const edgeCount = (opposingLineup?.players || []).filter(p =>
      hasPlatoonEdge(players[p.id]?.batSide, info?.pitchHand)
    ).length;

    return (
      <div
        onClick={() => setSelected({ id: probable.id, type: 'pitcher' })}
        style={{ ...cardStyle, marginBottom: 0, flex: '1 1 420px', cursor: 'pointer', transition: 'transform 0.15s' }}
        onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
        onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; }}
      >
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '16px' }}>
          <img
            src={getPlayerHeadshot(probable.id)}
            alt={probable.fullName}
            style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', background: theme.border }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src={getMLBTeamLogo(team)} alt="" style={{ width: '18px', height: '18px' }} />
              <span style={{ fontSize: '12px', color: theme.textSecondary, fontWeight: '700' }}>
                {getMLBTeamAbbr(team)} PROBABLE {info?.pitchHand ? `· ${info.pitchHand}HP` : ''}
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: theme.text }}>{probable.fullName}</div>
            {stats && (
              <div style={{ fontSize: '13px', color: theme.textSecondary }}>
                {stats.wins}-{stats.losses} · {stats.era} ERA · {stats.whip} WHIP · {stats.inningsPitched} IP · {stats.strikeOuts} K
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
          {rows.map(r => (
            <div key={r.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 }}>
              <PercentileBadge percentile={r.percentile} estimated={r.estimated} size={34} title={`${r.label} percentile`} />
              <span style={{ fontSize: '11px', color: theme.textSecondary }}>{SHORT_LABELS[r.label]}</span>
              <span style={{ fontSize: '12px', fontWeight: '700', color: theme.text }}>{r.value === null ? '—' : r.fmt(r.value)}</span>
            </div>
          ))}
        </div>
        {opposingLineup?.players?.length > 0 && info?.pitchHand && (
          <div style={{ marginTop: '14px', fontSize: '12px', color: theme.textSecondary }}>
            {edgeCount} of {opposingLineup.players.length} opposing hitters have the platoon edge
          </div>
        )}
      </div>
    );
  };

  const renderLineup = (team, lineup, opposingPitcher, side) => {
    const pitchHand = opposingPitcher ? players[opposingPitcher.id]?.pitchHand : null;
    const batterRows = (lineup?.players || []).map(p => ({
      player: p,
      info: players[p.id],
      metrics: buildPercentiles(savant?.batters, p.id, LINEUP_METRICS)
    }));
    const xwobas = batterRows.map(r => savant?.batters?.[r.player.id]?.raw.xwoba).filter(v => v !== undefined);
    const avgXwoba = xwobas.length ? xwobas.reduce((a, b) => a + b, 0) / xwobas.length : null;

    const statusPill = {
      confirmed: { text: '✓ Confirmed', bg: '#16a34a' },
      projected: {
        text: `Projected · most frequent starters, last ${lineup?.gamesUsed} games`,
        bg: '#d97706'
      },
      unavailable: { text: 'Lineup unavailable', bg: '#64748b' }
    }[lineup?.status || 'unavailable'];

    return (
      <div style={{ ...cardStyle, marginBottom: 0, flex: '1 1 560px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <img src={getMLBTeamLogo(team)} alt="" style={{ width: '32px', height: '32px' }} />
          <div style={{ fontSize: '20px', fontWeight: '800', color: theme.text }}>{getMLBTeamAbbr(team)} Lineup</div>
          <span style={{ padding: '3px 10px', borderRadius: '999px', background: statusPill.bg, color: 'white', fontSize: '11px', fontWeight: '700' }}>
            {statusPill.text}
          </span>
          {avgXwoba !== null && (
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: theme.textSecondary }}>
              Avg xwOBA <strong style={{ color: theme.text }}>{avgXwoba.toFixed(3).replace(/^0/, '')}</strong>
            </span>
          )}
        </div>

        {batterRows.length === 0 ? (
          <div style={{ color: theme.textSecondary, padding: '20px 0' }}>No lineup posted yet and no recent lineup found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: '520px' }}>
              {/* Column headers */}
              <div style={{
                display: 'grid', gridTemplateColumns: `24px 1fr repeat(${LINEUP_METRICS.length}, 42px)`, gap: '6px',
                padding: '0 8px 6px', fontSize: '10px', fontWeight: '700', color: theme.textSecondary, letterSpacing: '0.5px'
              }}>
                <span>#</span>
                <span>PLAYER</span>
                {LINEUP_METRICS.map(m => <span key={m.label} style={{ textAlign: 'center' }}>{SHORT_LABELS[m.label]}</span>)}
              </div>

              {batterRows.map(({ player, info, metrics }, i) => {
                const hitting = info?.hitting;
                const edge = hasPlatoonEdge(info?.batSide, pitchHand);
                return (
                  <div
                    key={player.id}
                    onClick={() => setSelected({ id: player.id, type: 'batter' })}
                    style={{
                      display: 'grid', gridTemplateColumns: `24px 1fr repeat(${LINEUP_METRICS.length}, 42px)`, gap: '6px',
                      alignItems: 'center', padding: '8px', borderRadius: '10px', cursor: 'pointer',
                      borderTop: i === 0 ? 'none' : `1px solid ${theme.border}`
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = theme.hover; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ fontSize: '15px', fontWeight: '800', color: theme.textSecondary }}>{i + 1}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <img
                        src={getPlayerHeadshot(player.id)}
                        alt=""
                        style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', background: theme.border, flexShrink: 0 }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {player.fullName}
                          {propEval.highlights[side]?.playerId === player.id && renderPropPill(propEval.highlights[side], true)}
                          {edge && (
                            <span title={`Platoon edge vs ${pitchHand}HP`} style={{ marginLeft: '6px', fontSize: '10px', color: '#22c55e', fontWeight: '700' }}>
                              ▲ vs {pitchHand}HP
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: theme.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {player.primaryPosition?.abbreviation}
                          {info?.batSide && ` · Bats ${info.batSide}`}
                          {lineup.status === 'projected' && ` · ${player.recentStarts}/${lineup.gamesUsed} GS`}
                          {hitting && ` · ${hitting.avg} / ${hitting.homeRuns} HR / ${hitting.ops} OPS`}
                        </div>
                      </div>
                    </div>
                    {metrics.map(m => (
                      <div key={m.label} style={{ display: 'flex', justifyContent: 'center' }}>
                        <PercentileBadge
                          percentile={m.percentile}
                          estimated={m.estimated}
                          title={`${m.label}: ${m.value === null ? '—' : m.fmt(m.value)}${m.percentile !== null ? ` (${m.percentile}th pct${m.estimated ? ', est.' : ''})` : ''}`}
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPlayerProps = (playerId) => {
    const rows = propEval.byPlayerId[playerId] || [];
    const projection = propEval.projections[playerId];
    return (
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '16px', fontWeight: '800', color: theme.text, marginBottom: '6px' }}>🎯 Today's Props</div>
        {projection && (
          <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '10px' }}>
            Projection (~{projection.paExp.toFixed(1)} PA): {projection.expected.hits.toFixed(2)} H ·{' '}
            {projection.expected.hr.toFixed(2)} HR · {projection.expected.rbi.toFixed(2)} RBI
          </div>
        )}
        {rows.length === 0 ? (
          <div style={{ fontSize: '13px', color: theme.textSecondary, padding: '8px 0' }}>
            {propsEvent ? 'No hits / HR / RBI props posted for this player yet.' : propsError || 'Loading props...'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: theme.text, minWidth: '520px' }}>
              <thead>
                <tr style={{ color: theme.textSecondary, fontSize: '10px', letterSpacing: '0.5px', textAlign: 'right' }}>
                  <th style={{ textAlign: 'left', padding: '5px 6px' }}>PROP</th>
                  <th style={{ padding: '5px 6px' }}>BEST PRICE</th>
                  <th style={{ padding: '5px 6px' }} title="Consensus no-vig probability across books">MARKET</th>
                  <th style={{ padding: '5px 6px' }} title="From season per-PA rates, opposing starter and lineup spot">PROJECTION</th>
                  <th style={{ padding: '5px 6px' }}>EV (MKT / PROJ)</th>
                  <th style={{ padding: '5px 6px' }} />
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={`${r.market}-${r.line}-${r.side}`} style={{ borderTop: `1px solid ${theme.border}`, textAlign: 'right' }}>
                    <td style={{ textAlign: 'left', padding: '6px', fontWeight: '700' }}>{r.side} {r.line} {r.marketLabel}</td>
                    <td style={{ padding: '6px' }}>
                      {fmtOdds(r.best.odds)} <span style={{ fontSize: '10px', color: theme.textSecondary }}>{r.best.bookmaker}</span>
                    </td>
                    <td style={{ padding: '6px', color: theme.textSecondary }}>
                      {r.marketProb === null ? '—' : `${r.marketProb.toFixed(1)}%`}
                      {r.marketEstimated && <span title="Only 'Over' is offered, so the vig is estimated from each book's other props"> *</span>}
                    </td>
                    <td style={{ padding: '6px', color: theme.textSecondary }}>{r.projProb === null ? '—' : `${r.projProb.toFixed(1)}%`}</td>
                    <td style={{ padding: '6px', fontWeight: '700' }}>
                      <span style={{ color: r.evMarket > 0 ? '#22c55e' : '#ef4444' }}>{fmtEV(r.evMarket)}</span>
                      <span style={{ color: theme.textSecondary }}> / </span>
                      <span style={{ color: r.evProj > 0 ? '#22c55e' : '#ef4444' }}>{fmtEV(r.evProj)}</span>
                    </td>
                    <td style={{ padding: '6px', textAlign: 'center' }}>{r.agree ? '💎' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: '10px', color: theme.textSecondary, marginTop: '6px' }}>
              💎 = both the market's fair odds and the projection say the best price is +EV.
              {rows.some(r => r.marketEstimated) && ' * vig estimated (one-sided market).'}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPlayerModal = () => {
    if (!selected) return null;
    const info = players[selected.id];
    const hasBatting = !!savant?.batters?.[selected.id];
    const hasPitching = !!savant?.pitchers?.[selected.id];
    const isPitcher = selected.type === 'pitcher';
    const rows = isPitcher
      ? buildPercentiles(savant?.pitchers, selected.id, PITCHER_METRICS)
      : buildPercentiles(savant?.batters, selected.id, BATTER_METRICS);
    const sample = (isPitcher ? savant?.pitchers : savant?.batters)?.[selected.id]?.raw.pa;
    const hitting = info?.hitting;
    const pitching = info?.pitching;

    const statLine = isPitcher
      ? pitching && [
        ['W-L', `${pitching.wins}-${pitching.losses}`], ['ERA', pitching.era], ['WHIP', pitching.whip],
        ['IP', pitching.inningsPitched], ['K', pitching.strikeOuts], ['BB', pitching.baseOnBalls]
      ]
      : hitting && [
        ['AVG', hitting.avg], ['OBP', hitting.obp], ['SLG', hitting.slg], ['OPS', hitting.ops],
        ['HR', hitting.homeRuns], ['RBI', hitting.rbi], ['SB', hitting.stolenBases]
      ];

    return (
      <div
        onClick={() => setSelected(null)}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.7)', zIndex: 2000,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto'
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ ...cardStyle, width: '100%', maxWidth: '640px', marginBottom: 0, position: 'relative' }}
        >
          <button
            onClick={() => setSelected(null)}
            aria-label="Close"
            style={{
              position: 'absolute', top: '14px', right: '14px', width: '32px', height: '32px', borderRadius: '50%',
              border: `1px solid ${theme.border}`, background: theme.innerBg, color: theme.text, cursor: 'pointer', fontSize: '16px'
            }}
          >
            ✕
          </button>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
            <img
              src={getPlayerHeadshot(selected.id)}
              alt=""
              style={{ width: '84px', height: '84px', borderRadius: '50%', objectFit: 'cover', background: theme.border }}
            />
            <div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: theme.text }}>{info?.fullName || 'Player'}</div>
              <div style={{ fontSize: '13px', color: theme.textSecondary }}>
                {[
                  info?.position,
                  info?.number && `#${info.number}`,
                  info?.batSide && info?.pitchHand && `B/T: ${info.batSide}/${info.pitchHand}`,
                  info?.age && `Age ${info.age}`
                ].filter(Boolean).join(' · ')}
              </div>
              {sample !== undefined && (
                <div style={{ fontSize: '12px', color: theme.textSecondary, marginTop: '2px' }}>
                  {sample} {isPitcher ? 'batters faced' : 'PA'} this season
                </div>
              )}
            </div>
          </div>

          {hasBatting && hasPitching && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {['batter', 'pitcher'].map(type => (
                <button
                  key={type}
                  onClick={() => setSelected({ ...selected, type })}
                  style={{
                    padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px',
                    border: `2px solid ${selected.type === type ? '#3b82f6' : theme.border}`,
                    background: selected.type === type ? '#3b82f6' : 'transparent',
                    color: selected.type === type ? 'white' : theme.text
                  }}
                >
                  {type === 'batter' ? 'Batting' : 'Pitching'}
                </button>
              ))}
            </div>
          )}

          {statLine && (
            <div style={{
              display: 'grid', gridTemplateColumns: `repeat(${statLine.length}, 1fr)`, gap: '4px', marginBottom: '20px',
              background: theme.innerBg, borderRadius: '10px', padding: '10px'
            }}>
              {statLine.map(([label, value]) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: theme.textSecondary, fontWeight: '700' }}>{label}</div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: theme.text }}>{value ?? '—'}</div>
                </div>
              ))}
            </div>
          )}

          {!isPitcher && renderPlayerProps(selected.id)}

          <div style={{ fontSize: '16px', fontWeight: '800', color: theme.text, marginBottom: '10px' }}>
            {game && new Date(game.commence_time).getFullYear()} Percentile Rankings
          </div>
          <PercentileChart rows={rows} theme={theme} />

          <a
            href={`https://baseballsavant.mlb.com/savant-player/${selected.id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-block', marginTop: '16px', fontSize: '13px', color: '#3b82f6', fontWeight: '600' }}
          >
            View on Baseball Savant ↗
          </a>
        </div>
      </div>
    );
  };

  return (
    <div style={{ background: theme.bg, minHeight: '100vh', paddingBottom: '40px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '10px' }}>
          {backButton}
          <button
            onClick={() => setDarkMode(!darkMode)}
            style={{
              padding: '10px 20px', background: theme.cardBg, color: theme.text, border: `2px solid ${theme.border}`,
              borderRadius: '8px', cursor: 'pointer', fontSize: '20px'
            }}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Matchup header */}
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', fontSize: '13px', color: theme.textSecondary, fontWeight: '600', marginBottom: '16px' }}>
            {new Date(game.commence_time).toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            {scheduleGame?.venue?.name && ` · ${scheduleGame.venue.name}`}
            {scheduleGame?.seriesDescription && scheduleGame.gameType !== 'R' && (
              <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '6px', background: '#7c3aed', color: 'white', fontSize: '11px' }}>
                {scheduleGame.seriesDescription}{scheduleGame.seriesGameNumber ? ` · Game ${scheduleGame.seriesGameNumber}` : ''}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '40px', flexWrap: 'wrap' }}>
            {renderTeamHeader(awayTeam, 'away')}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: '800', color: theme.textSecondary }}>@</div>
              {over && under && (
                <div style={{ fontSize: '12px', color: theme.text, marginTop: '8px', padding: '4px 10px', borderRadius: '6px', background: theme.innerBg }}>
                  O/U {over.points} ({fmtOdds(over.odds)} / {fmtOdds(under.odds)})
                </div>
              )}
            </div>
            {renderTeamHeader(homeTeam, 'home')}
          </div>
        </div>

        {renderModelCard()}

        {/* Probable pitchers */}
        <h2 style={{ color: theme.text, fontSize: '22px', margin: '30px 0 14px' }}>⚾ Probable Pitchers</h2>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          {renderPitcherCard(awayPitcher, awayTeam, lineups.home)}
          {renderPitcherCard(homePitcher, homeTeam, lineups.away)}
        </div>

        {/* Lineups */}
        <h2 style={{ color: theme.text, fontSize: '22px', margin: '30px 0 6px' }}>📋 Lineups</h2>
        <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '14px' }}>
          Circles are Baseball Savant percentiles (red = great, blue = poor). Click any player for full rankings and today's props.
        </div>
        {(propEval.highlights.away || propEval.highlights.home || propsError) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', padding: '10px 14px', marginBottom: '14px',
            background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: '12px', fontSize: '13px', color: theme.text
          }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: theme.textSecondary, letterSpacing: '0.5px' }}>🎯 PROP STANDOUTS</span>
            {propsError && <span style={{ color: theme.textSecondary }}>{propsError}</span>}
            {['away', 'home'].map(side => {
              const h = propEval.highlights[side];
              if (!h) return null;
              return (
                <span
                  key={side}
                  onClick={() => setSelected({ id: h.playerId, type: 'batter' })}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                >
                  <img src={getMLBTeamLogo(side === 'away' ? awayTeam : homeTeam)} alt="" style={{ width: '18px', height: '18px' }} />
                  <strong>{h.name}</strong>
                  {renderPropPill(h)}
                </span>
              );
            })}
            <span style={{ fontSize: '11px', color: theme.textSecondary }}>
              💎 = market odds and stat projection both say +EV · 👀 = best on the team, not confirmed
            </span>
          </div>
        )}
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          {renderLineup(awayTeam, lineups.away, homePitcher, 'away')}
          {renderLineup(homeTeam, lineups.home, awayPitcher, 'home')}
        </div>
      </div>

      {renderPlayerModal()}
    </div>
  );
};

export default MLBGamePage;
