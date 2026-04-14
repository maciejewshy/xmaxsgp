import { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, X, Trash2, Plus, Edit2 } from 'lucide-react';

const BASE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const MSG_API_URL = `${BASE_API_URL}/api`;

export default function MessageRulesModal({ client, onClose }) {
  const [messages, setMessages] = useState([]);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [msgFormData, setMsgFormData] = useState({
    message_type: 'unofficial',
    message_template: '',
    template_id: '',
    template_data: '',
    days_from_due: 0,
    queue_id: '',
    queue_api_key: ''
  });

  useEffect(() => {
    if (client) fetchMessages(client.id);
  }, [client]);

  const fetchMessages = async (clientId) => {
    try {
      const response = await axios.get(`${MSG_API_URL}/clients/${clientId}/messages`);
      setMessages(response.data);
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
    }
  };

  const handleMsgInputChange = (e) => {
    const { name, value } = e.target;
    setMsgFormData({ 
      ...msgFormData, 
      [name]: name === 'open_new_chat' ? parseInt(value) : value 
    });
  };

  const handleMsgSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...msgFormData,
        days_from_due: parseInt(msgFormData.days_from_due, 10)
      };
      if (editingMsgId) {
        await axios.put(`${MSG_API_URL}/messages/${editingMsgId}`, payload);
      } else {
        await axios.post(`${MSG_API_URL}/clients/${client.id}/messages`, payload);
      }
      setMsgFormData({ message_type: 'unofficial', message_template: '', template_id: '', template_data: '', days_from_due: 0, queue_id: '', queue_api_key: '', open_new_chat: 1 });
      setEditingMsgId(null);
      fetchMessages(client.id);
    } catch (error) {
      console.error('Erro ao salvar mensagem:', error);
    }
  };

  const handleMsgEdit = (msg) => {
    setMsgFormData({
      ...msg,
      message_type: msg.message_type || 'unofficial',
      template_id: msg.template_id || '',
      template_data: msg.template_data || '',
      open_new_chat: msg.open_new_chat !== undefined && msg.open_new_chat !== null ? msg.open_new_chat : 1
    });
    setEditingMsgId(msg.id);
  };

  const handleMsgDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja remover esta regra de mensagem?')) {
      try {
        await axios.delete(`${MSG_API_URL}/messages/${id}`);
        fetchMessages(client.id);
      } catch (error) {
        console.error('Erro ao remover mensagem:', error);
      }
    }
  };

  const cancelMsgEdit = () => {
    setMsgFormData({ message_type: 'unofficial', message_template: '', template_id: '', template_data: '', days_from_due: 0, queue_id: '', queue_api_key: '', open_new_chat: 1 });
    setEditingMsgId(null);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '800px', width: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <h2 style={{ margin: 0, border: 'none', padding: 0 }}>Regras de Disparo - {client.name}</h2>
          <button type="button" className="btn-icon" onClick={onClose}><X size={24} color="#6b7280"/></button>
        </div>
        
        <form onSubmit={handleMsgSubmit} style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <h4 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--primary-color)' }}>{editingMsgId ? 'Editar Regra' : 'Nova Regra'}</h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontWeight: 600 }}>Tipo de Mensagem:</label>
              <select name="message_type" value={msgFormData.message_type} onChange={handleMsgInputChange} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                <option value="unofficial">Não Oficial (Texto Livre)</option>
                <option value="official">Oficial (Template META)</option>
              </select>
            </div>

            {msgFormData.message_type === 'unofficial' ? (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontWeight: 600 }}>Mensagem de Envio:</label>
                <textarea name="message_template" value={msgFormData.message_template} onChange={handleMsgInputChange} rows="4" required={msgFormData.message_type === 'unofficial'} style={{ resize: 'vertical', width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e5e7eb' }} />
                <small style={{color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '4px'}}>
                  <b>Variáveis Suportadas:</b> {`{nome}, {cpf}, {vencimento}, {valor}, {link_boleto}, {pix}, {linha_digitavel}`}
                </small>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', alignItems: 'start' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontWeight: 600 }}>ID do Template:</label>
                  <input type="number" name="template_id" value={msgFormData.template_id} onChange={handleMsgInputChange} required={msgFormData.message_type === 'official'} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e5e7eb' }} />
                  <small style={{color: '#6b7280', fontSize: '11px', display: 'block', marginTop: '4px'}}>Ex: 62</small>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontWeight: 600 }}>Variáveis do Template (separadas por vírgula):</label>
                  <input type="text" name="template_data" value={msgFormData.template_data} onChange={handleMsgInputChange} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e5e7eb' }} />
                  <small style={{color: '#6b7280', fontSize: '11px', display: 'block', marginTop: '4px'}}>Ex: {`{nome},{valor}`} (Deixe em branco se o template não tiver variáveis)</small>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontWeight: 600 }}>Dias de vencimento:</label>
                <input type="number" name="days_from_due" value={msgFormData.days_from_due} onChange={handleMsgInputChange} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e5e7eb', boxSizing: 'border-box' }} required />
                <small style={{color: '#6b7280', fontSize: '11px', display: 'block', marginTop: '4px', lineHeight: '1.4'}}>
                  Negativo (ex: -5) para ANTES. Zero (0) para HOJE. Positivo (ex: 3) para DEPOIS.
                </small>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontWeight: 600 }}>ID da Fila de Disparo:</label>
                <input type="text" name="queue_id" value={msgFormData.queue_id} onChange={handleMsgInputChange} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e5e7eb', boxSizing: 'border-box' }} required />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontWeight: 600 }}>API Key da Fila:</label>
                <input type="text" name="queue_api_key" value={msgFormData.queue_api_key} onChange={handleMsgInputChange} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e5e7eb', boxSizing: 'border-box' }} required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontWeight: 600 }}>Abrir Novo Chat?</label>
                <select name="open_new_chat" value={msgFormData.open_new_chat !== undefined ? msgFormData.open_new_chat : 1} onChange={handleMsgInputChange} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e5e7eb', boxSizing: 'border-box' }}>
                  <option value={1}>Sim</option>
                  <option value={0}>Não</option>
                </select>
                <small style={{color: '#6b7280', fontSize: '11px', display: 'block', marginTop: '4px'}}>Reabre o chat na fila informada</small>
              </div>
            </div>
          </div>

          <div className="actions" style={{ justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid #e5e7eb', paddingTop: '1.5rem' }}>
            {editingMsgId && (
              <button type="button" className="btn btn-secondary" onClick={cancelMsgEdit}>
                Cancelar Edição
              </button>
            )}
            <button type="submit" className="btn btn-primary" style={{ minWidth: '150px', justifyContent: 'center' }}>
              <Save size={16} /> {editingMsgId ? 'Atualizar Regra' : 'Adicionar Regra'}
            </button>
          </div>
        </form>

        <h3 style={{ margin: '0 0 1rem 0' }}>Regras Ativas</h3>
        <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <table style={{ margin: 0 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <th>Dias</th>
                <th>Status Fatura</th>
                <th>Fila</th>
                <th>Mensagem</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {messages.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhuma regra cadastrada.</td></tr>
              ) : (
                messages.map(msg => (
                  <tr key={msg.id}>
                    <td style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>{msg.days_from_due}</td>
                    <td>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '999px', 
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: msg.days_from_due < 0 ? '#fef3c7' : msg.days_from_due === 0 ? '#d1fae5' : '#fee2e2',
                        color: msg.days_from_due < 0 ? '#d97706' : msg.days_from_due === 0 ? '#059669' : '#dc2626'
                      }}>
                        {msg.days_from_due < 0 ? 'A Vencer' : msg.days_from_due === 0 ? 'Vencendo Hoje' : 'Vencida'}
                      </span>
                    </td>
                    <td>{msg.queue_id}</td>
                    <td style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {msg.message_type === 'official' ? (
                        <span style={{color: '#2563eb', fontWeight: 500}}>[Oficial] TPL {msg.template_id}: {msg.template_data}</span>
                      ) : (
                        msg.message_template
                      )}
                    </td>
                    <td className="table-actions" style={{ justifyContent: 'flex-end' }}>
                      <button type="button" className="btn-icon text-blue" onClick={() => handleMsgEdit(msg)} title="Editar">
                        <Edit2 size={18} />
                      </button>
                      <button type="button" className="btn-icon text-red" onClick={() => handleMsgDelete(msg.id)} title="Remover">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}