import React, { useState, useEffect } from 'react';

const SEED_ORDER = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15];
const REGIONS = ['East', 'West', 'South', 'Midwest'];
const ROUND_NAMES = ['First Round', 'Second Round', 'Sweet 16', 'Elite 8'];
const TEAM_H = 28, INNER_GAP = 2, OUTER_GAP = 6, TEAM_W = 148;
const BASE_MH = TEAM_H * 2 + INNER_GAP + OUTER_GAP;
const HDR_H = 16;

const getVPad = (r) => (BASE_MH * Math.pow(2, r) - TEAM_H * 2 - INNER_GAP) / 2;

// 2025 teams used as placeholders -- update TEAM_DATA when 2026 Selection Sunday bracket is released
const TEAM_DATA = {
  East: {
    1: 'Duke', 2: 'Alabama', 3: 'Wisconsin', 4: 'Arizona',
    5: 'Oregon', 6: 'BYU', 7: "St. Mary's", 8: 'Miss. State',
    9: 'Baylor', 10: 'Vanderbilt', 11: 'VCU', 12: 'Liberty',
    13: 'Akron', 14: 'Montana', 15: 'Robert Morris', 16: 'American',
  },
  West: {
    1: 'Florida', 2: "St. John's", 3: 'Texas Tech', 4: 'Maryland',
    5: 'Memphis', 6: 'Missouri', 7: 'Kansas', 8: 'UConn',
    9: 'Oklahoma', 10: 'Arkansas', 11: 'Drake', 12: 'Colorado St.',
    13: 'Grand Canyon', 14: 'UNC Wilmington', 15: 'Omaha', 16: 'Norfolk St.',
  },
  South: {
    1: 'Auburn', 2: 'Michigan St.', 3: 'Iowa State', 4: 'Texas A&M',
    5: 'Michigan', 6: 'Ole Miss', 7: 'Marquette', 8: 'Louisville',
    9: 'Creighton', 10: 'New Mexico', 11: 'San Diego St.', 12: 'UC San Diego',
    13: 'Yale', 14: 'Lipscomb', 15: 'Bryant', 16: 'Alabama St.',
  },
  Midwest: {
    1: 'Houston', 2: 'Tennessee', 3: 'Kentucky', 4: 'Purdue',
    5: 'Clemson', 6: 'Illinois', 7: 'UCLA', 8: 'Gonzaga',
    9: 'Georgia', 10: 'Utah State', 11: 'Texas', 12: 'McNeese',
    13: 'High Point', 14: 'Troy', 15: 'Wofford', 16: 'SIU Edwardsville',
  },
};

const makeTeams = () =>
  Object.fromEntries(REGIONS.map((r) => [r, SEED_ORDER.map((seed) => ({ seed, name: TEAM_DATA[r][seed] }))]));

const makePicks = () => ({
  East:    [Array(8).fill(null), Array(4).fill(null), Array(2).fill(null), [null]],
  West:    [Array(8).fill(null), Array(4).fill(null), Array(2).fill(null), [null]],
  South:   [Array(8).fill(null), Array(4).fill(null), Array(2).fill(null), [null]],
  Midwest: [Array(8).fill(null), Array(4).fill(null), Array(2).fill(null), [null]],
  ff: [null, null],
  champion: null,
});

const LINE_COLOR = '#334155';

const TeamSlot = ({ team, isWinner, onClick, width = TEAM_W }) => (
  <div
    onClick={team ? onClick : undefined}
    style={{
      height: TEAM_H, width,
      display: 'flex', alignItems: 'center', padding: '0 6px',
      backgroundColor: isWinner ? '#1d4ed8' : '#1e293b',
      border: `1px solid ${isWinner ? '#3b82f6' : '#334155'}`,
      borderRadius: 4,
      cursor: team && !isWinner ? 'pointer' : 'default',
      fontSize: 11, gap: 5, userSelect: 'none', boxSizing: 'border-box',
    }}
  >
    {team ? (
      <>
        <span style={{ color: isWinner ? '#93c5fd' : '#64748b', fontWeight: 700, minWidth: 14, fontSize: 10 }}>
          {team.seed}
        </span>
        <span style={{ color: isWinner ? '#fff' : '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {team.name}
        </span>
      </>
    ) : (
      <span style={{ color: '#334155', fontSize: 10 }}>--</span>
    )}
  </div>
);

const Matchup = ({ teamA, teamB, winner, onA, onB, ri }) => {
  const pad = getVPad(ri);
  const wA = winner && teamA && winner.seed === teamA.seed && winner.name === teamA.name;
  const wB = winner && teamB && winner.seed === teamB.seed && winner.name === teamB.name;
  return (
    <div style={{ paddingTop: pad, paddingBottom: pad }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: INNER_GAP }}>
        <TeamSlot team={teamA} isWinner={wA} onClick={onA} />
        <TeamSlot team={teamB} isWinner={wB} onClick={onB} />
      </div>
    </div>
  );
};

// Bracket connector lines between adjacent rounds
const ConnCol = ({ ri, mirrored }) => {
  const CONN_W = 10;
  const pairsCount = Math.pow(2, 2 - ri);
  const matchupH = BASE_MH * Math.pow(2, ri);
  const pairH = matchupH * 2;
  const topY = matchupH / 2;
  const botY = matchupH * 3 / 2;
  const midY = matchupH;
  const lineX = mirrored ? 1 : CONN_W - 2;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: CONN_W, flexShrink: 0 }}>
      <div style={{ height: HDR_H + 2 }} />
      {Array.from({ length: pairsCount }, (_, p) => (
        <div key={p} style={{ height: pairH, position: 'relative' }}>
          <div style={{ position: 'absolute', left: lineX, width: 1, top: topY, height: botY - topY, backgroundColor: LINE_COLOR }} />
          <div style={{ position: 'absolute', height: 1, backgroundColor: LINE_COLOR, top: topY, ...(mirrored ? { left: lineX, right: 0 } : { left: 0, right: CONN_W - lineX }) }} />
          <div style={{ position: 'absolute', height: 1, backgroundColor: LINE_COLOR, top: botY, ...(mirrored ? { left: lineX, right: 0 } : { left: 0, right: CONN_W - lineX }) }} />
          <div style={{ position: 'absolute', height: 1, backgroundColor: LINE_COLOR, top: midY, ...(mirrored ? { left: 0, right: CONN_W - lineX } : { left: lineX, right: 0 }) }} />
        </div>
      ))}
    </div>
  );
};

const BracketPage = () => {
  const [teams] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bracket_teams_2026')) || makeTeams(); }
    catch { return makeTeams(); }
  });
  const [picks, setPicks] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bracket_picks_2026')) || makePicks(); }
    catch { return makePicks(); }
  });

  useEffect(() => { localStorage.setItem('bracket_picks_2026', JSON.stringify(picks)); }, [picks]);

  const getTeams = (region, ri, mi) =>
    ri === 0
      ? [teams[region][mi * 2], teams[region][mi * 2 + 1]]
      : [picks[region][ri - 1][mi * 2], picks[region][ri - 1][mi * 2 + 1]];

  const pick = (region, ri, mi, team) =>
    setPicks((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[region][ri][mi] = team;
      let m = mi;
      for (let r = ri + 1; r < 4; r++) { m = Math.floor(m / 2); next[region][r][m] = null; }
      const fi = region === 'East' || region === 'West' ? 0 : 1;
      next.ff[fi] = null;
      next.champion = null;
      return next;
    });

  const pickFF = (fi, team) =>
    setPicks((p) => ({ ...p, ff: p.ff.map((t, i) => (i === fi ? team : t)), champion: null }));

  const pickChamp = (team) => setPicks((p) => ({ ...p, champion: team }));
  const reset = () => setPicks(makePicks());

  const col = (region, ri) => {
    const count = Math.pow(2, 3 - ri);
    return (
      <div key={ri} style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{
          textAlign: 'center', fontSize: 9, color: '#475569', height: HDR_H,
          textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600,
          width: TEAM_W + 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 2,
        }}>
          {ROUND_NAMES[ri]}
        </div>
        {Array.from({ length: count }, (_, i) => {
          const [tA, tB] = getTeams(region, ri, i);
          return (
            <Matchup key={i} teamA={tA} teamB={tB} winner={picks[region][ri][i]} ri={ri}
              onA={() => pick(region, ri, i, tA)} onB={() => pick(region, ri, i, tB)} />
          );
        })}
      </div>
    );
  };

  const regionEl = (name, mirrored) => {
    const rounds = mirrored ? [3, 2, 1, 0] : [0, 1, 2, 3];
    return (
      <div key={name} style={{ marginBottom: 8 }}>
        <div style={{
          textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#60a5fa',
          padding: '6px 0', borderBottom: '1px solid #1e293b', marginBottom: 4,
        }}>
          {name} Region
        </div>
        <div style={{ display: 'flex', gap: 0 }}>
          {rounds.map((r, idx) => (
            <React.Fragment key={r}>
              {col(name, r)}
              {idx < 3 && <ConnCol ri={Math.min(r, rounds[idx + 1])} mirrored={mirrored} />}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  const ffMatchup = (fi, lA, lB, tA, tB) => {
    const w = picks.ff[fi];
    const wA = w && tA && w.seed === tA.seed && w.name === tA.name;
    const wB = w && tB && w.seed === tB.seed && w.name === tB.name;
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 9, color: '#475569', textAlign: 'center', marginBottom: 3, textTransform: 'uppercase' }}>
          {lA} vs {lB}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: INNER_GAP }}>
          <TeamSlot team={tA} isWinner={wA} onClick={() => tA && pickFF(fi, tA)} width={160} />
          <TeamSlot team={tB} isWinner={wB} onClick={() => tB && pickFF(fi, tB)} width={160} />
        </div>
      </div>
    );
  };

  const eW = picks.East[3][0], wW = picks.West[3][0];
  const sW = picks.South[3][0], mW = picks.Midwest[3][0];
  const ff0 = picks.ff[0], ff1 = picks.ff[1], champ = picks.champion;
  const total = REGIONS.reduce((a, r) => a + picks[r].flat().filter(Boolean).length, 0)
    + picks.ff.filter(Boolean).length + (champ ? 1 : 0);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f1f5f9' }}>
      <div style={{
        background: 'linear-gradient(135deg,#1e3a8a,#1d4ed8)',
        padding: '16px 24px', borderBottom: '1px solid #1e40af',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>NCAA Tournament Bracket 2026</h1>
          <p style={{ margin: '2px 0 0', color: '#93c5fd', fontSize: 13 }}>
            March Madness &bull; {total}/63 picks &bull; Click a team to advance them
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {champ && (
            <div style={{
              padding: '6px 14px', backgroundColor: '#14532d',
              border: '1px solid #22c55e', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#4ade80',
            }}>
              Champion: ({champ.seed}) {champ.name}
            </div>
          )}
          <button onClick={reset} style={{
            backgroundColor: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b',
            borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13,
          }}>
            Reset
          </button>
        </div>
      </div>

      <div style={{
        backgroundColor: '#172554', borderBottom: '1px solid #1e40af',
        padding: '8px 24px', fontSize: 12, color: '#93c5fd', textAlign: 'center',
      }}>
        2025 teams shown as placeholders &mdash; bracket will update after Selection Sunday (Mar 15)
      </div>

      <div style={{ overflowX: 'auto', padding: 16 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', minWidth: 'max-content' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {regionEl('East', false)}
            {regionEl('West', false)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 188, padding: '56px 8px 0' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fbbf24', textAlign: 'center', letterSpacing: '0.08em', marginBottom: 16, textTransform: 'uppercase' }}>
              Final Four
            </div>
            {ffMatchup(0, 'East', 'West', eW, wW)}
            <div style={{ margin: '8px 0', width: '100%' }}>
              <div style={{ fontSize: 9, color: '#fbbf24', textAlign: 'center', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                Championship
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: INNER_GAP }}>
                <TeamSlot team={ff0} width={160}
                  isWinner={champ && ff0 && champ.seed === ff0.seed && champ.name === ff0.name}
                  onClick={() => ff0 && pickChamp(ff0)} />
                <TeamSlot team={ff1} width={160}
                  isWinner={champ && ff1 && champ.seed === ff1.seed && champ.name === ff1.name}
                  onClick={() => ff1 && pickChamp(ff1)} />
              </div>
              {champ && (
                <div style={{ marginTop: 10, padding: '8px 12px', backgroundColor: '#14532d', border: '1px solid #22c55e', borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ color: '#4ade80', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Champion</div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>({champ.seed}) {champ.name}</div>
                </div>
              )}
            </div>
            {ffMatchup(1, 'South', 'Midwest', sW, mW)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {regionEl('South', true)}
            {regionEl('Midwest', true)}
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 24px', borderTop: '1px solid #1e293b', fontSize: 11, color: '#475569' }}>
        Blue highlight = selected winner &nbsp;|&nbsp; Picks auto-saved in your browser
      </div>
    </div>
  );
};

export default BracketPage;
