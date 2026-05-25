import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './Login';
import AdminDashboard from './AdminDashboard';
import ClientDashboard from './ClientDashboard';
import './App.css';

function App() {
  const basename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '/';
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('sgp_user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('sgp_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('sgp_user');
    }
  }, [user]);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <Router basename={basename}>
      <div className="app-container">
        <Routes>
          <Route path="/" element={
            !user ? <Login onLogin={handleLogin} /> :
            user.role === 'admin' ? <Navigate to="/admin" /> : <Navigate to="/client" />
          } />
          <Route path="/admin" element={
            user?.role === 'admin' ? <AdminDashboard onLogout={handleLogout} /> : <Navigate to="/" />
          } />
          <Route path="/client" element={
            user?.role === 'client' ? <ClientDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/" />
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
