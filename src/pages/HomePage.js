import React from 'react';
import { Link } from 'react-router-dom';

const HomePage = () => {
  const darkMode = true;

  const theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    cardBg: darkMode ? '#1e293b' : '#ffffff',
    text: darkMode ? '#f1f5f9' : '#1e293b',
    textSecondary: darkMode ? '#94a3b8' : '#64748b'
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: theme.bg,
      padding: '60px 20px'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h1 style={{
            fontSize: '56px',
            color: theme.text,
            marginBottom: '20px',
            fontWeight: '800'
          }}>
            Welcome to MPOdds
          </h1>
          <p style={{
            fontSize: '24px',
            color: theme.textSecondary,
            maxWidth: '700px',
            margin: '0 auto'
          }}>
            Find your betting edge with real-time odds comparison
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '30px'
        }}>
          <Link
            to="/nfl"
            style={{
              textDecoration: 'none',
              background: theme.cardBg,
              borderRadius: '20px',
              padding: '40px',
              boxShadow: darkMode ? '0 10px 30px rgba(0,0,0,0.3)' : '0 10px 30px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              border: darkMode ? '1px solid #334155' : 'none'
            }}
          >
            <div style={{ fontSize: '64px', textAlign: 'center', marginBottom: '20px' }}>
              🏈
            </div>
            <h2 style={{
              fontSize: '32px',
              color: '#dc2626',
              textAlign: 'center',
              fontWeight: '700'
            }}>
              NFL
            </h2>
            <p style={{ fontSize: '16px', color: theme.textSecondary, textAlign: 'center' }}>
              Live odds and EV calculator
            </p>
          </Link>

          <Link
            to="/nba"
            style={{
              textDecoration: 'none',
              background: theme.cardBg,
              borderRadius: '20px',
              padding: '40px',
              boxShadow: darkMode ? '0 10px 30px rgba(0,0,0,0.3)' : '0 10px 30px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              border: darkMode ? '1px solid #334155' : 'none'
            }}
          >
            <div style={{ fontSize: '64px', textAlign: 'center', marginBottom: '20px' }}>
              🏀
            </div>
            <h2 style={{
              fontSize: '32px',
              color: '#f97316',
              textAlign: 'center',
              fontWeight: '700'
            }}>
              NBA
            </h2>
            <p style={{ fontSize: '16px', color: theme.textSecondary, textAlign: 'center' }}>
              Live odds and EV calculator
            </p>
          </Link>

          <Link
            to="/cfb"
            style={{
              textDecoration: 'none',
              background: theme.cardBg,
              borderRadius: '20px',
              padding: '40px',
              boxShadow: darkMode ? '0 10px 30px rgba(0,0,0,0.3)' : '0 10px 30px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              border: darkMode ? '1px solid #334155' : 'none'
            }}
          >
            <div style={{ fontSize: '64px', textAlign: 'center', marginBottom: '20px' }}>
              🏟️
            </div>
            <h2 style={{
              fontSize: '32px',
              color: '#3b82f6',
              textAlign: 'center',
              fontWeight: '700'
            }}>
              College Football
            </h2>
            <p style={{ fontSize: '16px', color: theme.textSecondary, textAlign: 'center' }}>
              Live odds and EV calculator
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HomePage;