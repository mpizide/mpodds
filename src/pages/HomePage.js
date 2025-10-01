import React from 'react';
import { Link } from 'react-router-dom';

const HomePage = () => {
  return (
    <div style={{ 
      maxWidth: '1200px', 
      margin: '0 auto', 
      padding: '60px 20px' 
    }}>
      <div style={{ textAlign: 'center', marginBottom: '60px' }}>
        <h1 style={{ 
          fontSize: '56px', 
          color: '#1e293b',
          marginBottom: '20px',
          fontWeight: '800'
        }}>
          Welcome to MPOdds
        </h1>
        <p style={{ 
          fontSize: '24px', 
          color: '#64748b',
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
            background: 'white',
            borderRadius: '20px',
            padding: '40px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
            cursor: 'pointer'
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
          <p style={{ fontSize: '16px', color: '#64748b', textAlign: 'center' }}>
            Live odds and EV calculator
          </p>
        </Link>
      </div>
    </div>
  );
};

export default HomePage;