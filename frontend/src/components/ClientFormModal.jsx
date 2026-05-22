import { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, X, Eye, EyeOff } from 'lucide-react';

const BASE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_URL = `${BASE_API_URL}/api/clients`;

const DISPATCH_DAY_OPTIONS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' }
];

export default function ClientFormModal({ client, onClose, onSaveSuccess }) {
  const [formData, setFormData] = useState({
    name: '', sgp_url: '', sgp_token: '', atenderbem_link: '', username: '', password: '', is_active: 1, dispatch_days: '1,2,3,4,5', dispatch_start_time: '08:00'
  });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (client) {
      setFormData({
        ...client,
        username: '', 
        password: '',
        dispatch_days: client.dispatch_days || '1,2,3,4,5',
        dispatch_start_time: client.dispatch_start_time || '08:00'
      });
    }
  }, [client]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const parseDispatchDays = (value) => {
    if (!value || typeof value !== 'string') return [];
    return value
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => Number.isInteger(n) && n >= 0 && n <= 6);
  };

  const toggleDispatchDay = (day) => {
    const current = parseDispatchDays(formData.dispatch_days);
    const exists = current.includes(day);
    const next = exists ? current.filter(d => d !== day) : [...current, day];
    next.sort((a, b) => a - b);
    setFormData(prev => ({ ...prev, dispatch_days: next.join(',') }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (client) {
        await axios.put(`${API_URL}/${client.id}`, formData);
      } else {
        await axios.post(API_URL, formData);
      }
      onSaveSuccess();
    } catch (error) {
      console.error('Erro ao salvar empresa:', error);
      alert(error.response?.data?.error || 'Erro ao salvar empresa');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, border: 'none' }}>{client ? 'Editar Empresa' : 'Nova Empresa'}</h2>
          <button type="button" className="btn-icon" onClick={onClose}><X size={24} color="#6b7280"/></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nome da Empresa (Cliente SGP):</label>
            <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
          </div>
          <div className="form-group" style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label>URL da API SGP:</label>
              <input type="text" name="sgp_url" value={formData.sgp_url} onChange={handleInputChange} placeholder="ex: https://api.sgp.net.br" required />
            </div>
            <div style={{ flex: 1 }}>
              <label>Token SGP:</label>
              <input type="text" name="sgp_token" value={formData.sgp_token} onChange={handleInputChange} required />
            </div>
          </div>
          <div className="form-group">
            <label>Link do AtenderBem para disparos:</label>
            <input type="text" name="atenderbem_link" value={formData.atenderbem_link} onChange={handleInputChange} placeholder="ex: https://api.atenderbem.com/webhook/..." required />
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '1.5rem 0' }} />
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: '#374151' }}>Agendamento de Disparos</h3>
          <div className="form-group">
            <label>Dias da semana:</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {DISPATCH_DAY_OPTIONS.map(day => {
                const selectedDays = parseDispatchDays(formData.dispatch_days);
                const checked = selectedDays.includes(day.value);
                return (
                  <label key={day.value} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDispatchDay(day.value)}
                    />
                    <span>{day.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="form-group">
            <label>Horário início dos disparos:</label>
            <input
              type="time"
              name="dispatch_start_time"
              value={formData.dispatch_start_time || '08:00'}
              onChange={handleInputChange}
              required
            />
          </div>
          {!client && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '1.5rem 0' }} />
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: '#374151' }}>Acesso do Cliente</h3>
              <div className="form-group" style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label>Usuário (Login):</label>
                  <input type="text" name="username" value={formData.username} onChange={handleInputChange} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Senha:</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={showPassword ? "text" : "password"} 
                      name="password" 
                      value={formData.password} 
                      onChange={handleInputChange} 
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
              </div>
            </>
          )}
          <div className="actions" style={{ justifyContent: 'flex-end', marginTop: '2rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              <Save size={16} /> {client ? 'Atualizar' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
