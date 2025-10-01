import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import HomePage from './pages/HomePage';
import NFLPage from './pages/NFLPage';

function App() {
  return (
    <Router>
      <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
        <Navigation />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/nfl" element={<NFLPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;