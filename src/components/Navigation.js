import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navigation = () => {
  const location = useLocation();
  
  const navItems = [
    { path: '/', label: 'Home', icon: '🏠' },
    { path: '/nfl', label: 'NFL', icon: '🏈' },
    { path: '/nba', label: 'NBA', icon: '🏀' },
    { path: '/cbb', label: 'College BB', icon: '🏀' },
    { path: '/cfb', label: 'College FB', icon: '🏟️' },
    { path: '/bracket', label: 'Bracket', icon: '🏆' }
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav style={{
      background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
      padding: '20px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '20px'
      }}>
        <div style={{
          color: 'white',
          fontSize: '28px',
          fontWeight: '700'
        }}>
          📊 MPOdds
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                textDecoration: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                background: isActive(item.path) ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                color: 'white',
                fontWeight: '600'
              }}
            >
              {item.icon} {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;