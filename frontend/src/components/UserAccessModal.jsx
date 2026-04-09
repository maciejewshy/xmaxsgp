import { useState } from 'react';
import axios from 'axios';
import { Save, X, Eye, EyeOff } from 'lucide-react';

const BASE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const MSG_API_URL = `${BASE_API_URL}/api`;

export default function UserAccessModal({ client, onClose }) {
  const [userFormData, setUserFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${MSG_API_URL}/users`, {
        name: client.name,
        username: userFormData.username,
        password: userFormData.password,
        role: 'client',
        client_id: client.id
      });
      alert('Usuário criado com sucesso!');
      onClose();
    } catch (error) {
      alert(error.response?.data?.error || 'Erro ao criar usuário');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '400px', borderTop: '4px solid #10b981' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', border: 'none' }}>Acesso: {client.name}</h2>
          <button type="button" className="btn-icon" onClick={onClose}><X size={24} color="#6b7280"/></button>
        </div>
        <form onSubmit={handleUserSubmit}>
          <div className="form-group">
            <label>Nome de Usuário (Login):</label>
            <input type="text" name="username" value={userFormData.username} onChange={(e) => setUserFormData({...userFormData, username: e.target.value})} required />
          </div>
          <div className="form-group">
            <label>Senha:</label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? "text" : "password"} 
                name="password" 
                value={userFormData.password} 
                onChange={(e) => setUserFormData({...userFormData, password: e.target.value})} 
                required 
                style={{ width: '100%', paddingRight: '40px' }}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                style={{ 
                  position: 'absolute', 
                  right: '10px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  color: '#6b7280'
                }}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          <div className="actions" style={{ justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#10b981', width: '100%', justifyContent: 'center' }}>
              <Save size={16} /> Criar Acesso
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}