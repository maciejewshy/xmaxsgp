import { useState } from 'react';
import Login from './Login';
import AdminDashboard from './AdminDashboard';
import ClientDashboard from './ClientDashboard';
import './App.css';

function App() {
  const [user, setUser] = useState(null);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (user.role === 'admin') {
    return <AdminDashboard user={user} onLogout={handleLogout} />;
  }

  if (user.role === 'client') {
    return <ClientDashboard user={user} onLogout={handleLogout} />;
  }

  return <div>Role desconhecida</div>;
}

export default App;
