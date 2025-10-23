import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import HomePage from './pages/HomePage';
import NFLPage from './pages/NFLPage';
import CFBPage from './pages/CFBPage';
import NBAPage from './pages/NBAPage';
import PlayerPropsPage from './pages/PlayerPropsPage';
import NBAPlayerPropsPage from './pages/NBAPlayerPropsPage';
import PickHistoryPage from './pages/PickHistoryPage';

function App() {
  return (
    <Router>
      <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
        <Navigation />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/nfl" element={<NFLPage />} />
          <Route path="/cfb" element={<CFBPage />} />
          <Route path="/nba" element={<NBAPage />} />
          <Route path="/nfl/props/:eventId" element={<PlayerPropsPage />} />
          <Route path="/nba/props/:eventId" element={<NBAPlayerPropsPage />} />
          <Route path="/pick-history" element={<PickHistoryPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;