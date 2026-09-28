import React from 'react';

// Baseball Savant style diverging scale: blue (poor) -> grey (average) -> red (great)
const STOPS = [
  { p: 0, rgb: [50, 92, 168] },
  { p: 50, rgb: [178, 178, 178] },
  { p: 100, rgb: [214, 41, 46] }
];

export const percentileColor = (p) => {
  if (p === null || p === undefined) return '#94a3b8';
  const pct = Math.max(0, Math.min(100, p));
  const hi = pct <= 50 ? 1 : 2;
  const lo = hi - 1;
  const t = (pct - STOPS[lo].p) / (STOPS[hi].p - STOPS[lo].p);
  const rgb = STOPS[lo].rgb.map((c, i) => Math.round(c + (STOPS[hi].rgb[i] - c) * t));
  return `rgb(${rgb.join(',')})`;
};

/**
 * Small percentile circle, e.g. for lineup rows
 */
export const PercentileBadge = ({ percentile, estimated, size = 26, title }) => (
  <span
    title={title}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      background: percentile === null ? 'transparent' : percentileColor(percentile),
      border: percentile === null
        ? '2px dashed #64748b'
        : estimated ? '2px dashed rgba(255,255,255,0.85)' : '2px solid white',
      color: 'white',
      fontSize: `${Math.round(size * 0.42)}px`,
      fontWeight: '700',
      boxSizing: 'border-box',
      flexShrink: 0
    }}
  >
    {percentile === null ? '' : percentile}
  </span>
);

const SECTION_ICONS = {
  Batting: '🏏',
  Fielding: '🧤',
  Running: '🏃',
  Pitching: '⚾',
  'Pitch Arsenal': '🎯'
};

/**
 * Savant-style percentile rankings chart
 * @param {array} rows - output of buildPercentiles()
 * @param {object} theme - page theme colors
 */
const PercentileChart = ({ rows, theme }) => {
  const sections = [];
  rows.forEach(row => {
    let section = sections.find(s => s.name === row.section);
    if (!section) {
      section = { name: row.section, rows: [] };
      sections.push(section);
    }
    section.rows.push(row);
  });

  const hasEstimates = rows.some(r => r.estimated);

  return (
    <div>
      {/* POOR / AVERAGE / GREAT scale header */}
      <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 56px', gap: '12px', marginBottom: '4px' }}>
        <div />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px' }}>
          <span style={{ color: percentileColor(0) }}>▲ POOR</span>
          <span style={{ color: theme.textSecondary }}>AVERAGE</span>
          <span style={{ color: percentileColor(100) }}>GREAT ▲</span>
        </div>
        <div />
      </div>

      {sections.map(section => (
        <div key={section.name} style={{ marginBottom: '18px' }}>
          <div style={{
            fontSize: '18px',
            fontWeight: '800',
            color: theme.text,
            borderBottom: '2px solid #0d9488',
            paddingBottom: '4px',
            marginBottom: '10px'
          }}>
            {SECTION_ICONS[section.name]} {section.name}
          </div>

          {section.rows.map(row => (
            <div
              key={row.label}
              style={{
                display: 'grid',
                gridTemplateColumns: '130px 1fr 56px',
                gap: '12px',
                alignItems: 'center',
                padding: '5px 0',
                borderBottom: `1px dashed ${theme.border}`
              }}
            >
              <div style={{ fontSize: '13px', color: theme.text, textAlign: 'right' }}>
                {row.label}
              </div>

              {/* Track + bar */}
              <div style={{ position: 'relative', height: '26px', display: 'flex', alignItems: 'center' }}>
                <div style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  height: '8px',
                  borderRadius: '4px',
                  background: theme.border
                }} />
                {[0, 50, 100].map(tick => (
                  <div key={tick} style={{
                    position: 'absolute',
                    left: `${tick}%`,
                    top: '3px',
                    bottom: '3px',
                    width: '2px',
                    marginLeft: tick === 100 ? '-2px' : tick === 50 ? '-1px' : 0,
                    background: theme.cardBg,
                    zIndex: 1
                  }} />
                ))}
                {row.percentile !== null && (
                  <>
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      width: `${row.percentile}%`,
                      height: '20px',
                      borderRadius: '3px',
                      background: percentileColor(row.percentile),
                      opacity: row.estimated ? 0.6 : 1,
                      zIndex: 2
                    }} />
                    <div style={{
                      position: 'absolute',
                      left: `${row.percentile}%`,
                      transform: 'translateX(-50%)',
                      zIndex: 3
                    }}>
                      <PercentileBadge
                        percentile={row.percentile}
                        estimated={row.estimated}
                        title={row.estimated ? 'Estimated vs. qualified players (not enough PA for official Savant rank)' : 'Official Savant percentile'}
                      />
                    </div>
                  </>
                )}
                {row.percentile === null && (
                  <span style={{ position: 'relative', zIndex: 2, fontSize: '11px', color: theme.textSecondary, paddingLeft: '8px' }}>
                    Not enough data
                  </span>
                )}
              </div>

              <div style={{ fontSize: '13px', fontWeight: '600', color: theme.text, textAlign: 'right' }}>
                {row.value === null ? '—' : row.fmt(row.value)}
              </div>
            </div>
          ))}
        </div>
      ))}

      {hasEstimates && (
        <div style={{ fontSize: '11px', color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <PercentileBadge percentile={50} estimated size={18} /> Dashed circle = estimated rank (player hasn't hit Savant's qualifying threshold)
        </div>
      )}
    </div>
  );
};

export default PercentileChart;
