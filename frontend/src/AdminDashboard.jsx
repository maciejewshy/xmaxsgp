import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Edit2, Save, X, MessageCircle, UserPlus, Search, CheckCircle, XCircle, LogOut, Send, ListOrdered, PlayCircle, Activity } from 'lucide-react';
import DispatchLogsModal from './components/DispatchLogsModal';
import './App.css';

// Variável de ambiente do Vite ou fallback para localhost
const BASE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_URL = `${BASE_API_URL}/api/clients`;
const MSG_API_URL = `${BASE_API_URL}/api`;

function AdminDashboard({ user, onLogout }) {
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Controle de Modais
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [selectedClient, setSelectedClient] = useState(null);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [editingMsgId, setEditingMsgId] = useState(null);
  
  const [creatingUserFor, setCreatingUserFor] = useState(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [viewingLogsFor, setViewingLogsFor] = useState(null);
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResults, setSimulationResults] = useState(null);
  const [simulationSteps, setSimulationSteps] = useState([]);
  const [isSimulationModalOpen, setIsSimulationModalOpen] = useState(false);
  const [isSimulationConfigOpen, setIsSimulationConfigOpen] = useState(false);
  const [allMessages, setAllMessages] = useState([]);
  const [selectedSimulationRule, setSelectedSimulationRule] = useState('');
  const [simulatingClient, setSimulatingClient] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    sgp_url: '',
    sgp_token: '',
    atenderbem_link: '',
    username: '',
    password: '',
    is_active: 1
  });

  const [userFormData, setUserFormData] = useState({
    username: '',
    password: ''
  });

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    const filtered = clients.filter(c => 
      c.name.toLowerCase().includes(term) || 
      (c.atenderbem_link && c.atenderbem_link.toLowerCase().includes(term))
    );
    setFilteredClients(filtered);
  }, [searchTerm, clients]);

  const fetchClients = async () => {
    try {
      const response = await axios.get(API_URL);
      setClients(response.data);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`${API_URL}/${editingId}`, formData);
      } else {
        await axios.post(API_URL, formData);
      }
      setFormData({
        name: '', sgp_url: '', sgp_token: '', atenderbem_link: '', username: '', password: '', is_active: 1
      });
      setEditingId(null);
      setIsClientModalOpen(false);
      fetchClients();
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      alert(error.response?.data?.error || 'Erro ao salvar cliente');
    }
  };

  const handleEdit = (client) => {
    setFormData({
      ...client,
      username: '', // Nao exibir/editar usuario pela mesma tela de edição por enquanto
      password: ''
    });
    setEditingId(client.id);
    setIsClientModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja remover esta empresa?')) {
      try {
        await axios.delete(`${API_URL}/${id}`);
        fetchClients();
      } catch (error) {
        console.error('Erro ao remover cliente:', error);
      }
    }
  };

  const toggleActive = async (client) => {
    const newStatus = client.is_active === 1 ? 0 : 1;
    try {
      await axios.put(`${API_URL}/${client.id}`, { ...client, is_active: newStatus });
      fetchClients();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
    }
  };

  const cancelEdit = () => {
    setFormData({
      name: '', sgp_url: '', sgp_token: '', atenderbem_link: '', username: '', password: '', is_active: 1
    });
    setEditingId(null);
    setIsClientModalOpen(false);
  };

  const handleOpenCreateClient = () => {
    setFormData({
      name: '', sgp_url: '', sgp_token: '', atenderbem_link: '', username: '', password: '', is_active: 1
    });
    setEditingId(null);
    setIsClientModalOpen(true);
  };

  // Funções para mensagens de disparo
  const [msgFormData, setMsgFormData] = useState({
    message_type: 'unofficial',
    message_template: '',
    template_id: '',
    template_data: '',
    days_from_due: 0,
    queue_id: '',
    queue_api_key: ''
  });

  const handleMsgInputChange = (e) => {
    const { name, value } = e.target;
    setMsgFormData({ 
      ...msgFormData, 
      [name]: name === 'open_new_chat' ? parseInt(value) : value 
    });
  };

  const fetchMessages = async (clientId) => {
    try {
      const response = await axios.get(`${MSG_API_URL}/clients/${clientId}/messages`);
      setMessages(response.data);
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
    }
  };

  const handleManageMessages = (client) => {
    setSelectedClient(client);
    fetchMessages(client.id);
    setIsMessageModalOpen(true);
  };

  const handleMsgSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingMsgId) {
        await axios.put(`${MSG_API_URL}/messages/${editingMsgId}`, msgFormData);
      } else {
        await axios.post(`${MSG_API_URL}/clients/${selectedClient.id}/messages`, msgFormData);
      }
      setMsgFormData({ message_type: 'unofficial', message_template: '', template_id: '', template_data: '', days_from_due: 0, queue_id: '', queue_api_key: '', open_new_chat: 1 });
      setEditingMsgId(null);
      fetchMessages(selectedClient.id);
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
        fetchMessages(selectedClient.id);
      } catch (error) {
        console.error('Erro ao remover mensagem:', error);
      }
    }
  };

  const cancelMsgEdit = () => {
    setMsgFormData({ message_type: 'unofficial', message_template: '', template_id: '', template_data: '', days_from_due: 0, queue_id: '', queue_api_key: '' });
    setEditingMsgId(null);
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${MSG_API_URL}/users`, {
        name: creatingUserFor.name,
        username: userFormData.username,
        password: userFormData.password,
        role: 'client',
        client_id: creatingUserFor.id
      });
      alert('Usuário criado com sucesso!');
      setCreatingUserFor(null);
      setIsUserModalOpen(false);
      setUserFormData({ username: '', password: '' });
    } catch (error) {
      alert(error.response?.data?.error || 'Erro ao criar usuário');
    }
  };

  const handleOpenCreateUser = (client) => {
    setCreatingUserFor(client);
    setIsUserModalOpen(true);
  };

  const handleOpenLogs = (client) => {
    setViewingLogsFor(client);
    setIsLogsModalOpen(true);
  };

  const handleOpenSimulationConfig = async (client) => {
    try {
      setSimulatingClient(client);
      // Fetch apenas as regras do cliente selecionado
      const resMsg = await axios.get(`${MSG_API_URL}/clients/${client.id}/messages`);
      setAllMessages(resMsg.data);
      setSelectedSimulationRule('');
      setIsSimulationConfigOpen(true);
    } catch (error) {
      console.error('Erro ao buscar regras:', error);
      alert('Erro ao carregar regras para simulação.');
    }
  };

  const handleRunSimulation = async () => {
    setIsSimulationConfigOpen(false);
    setIsSimulating(true);
    setSimulationResults(null);
    setSimulationSteps([]);
    try {
      const payload = { clientId: simulatingClient.id };
      if (selectedSimulationRule) {
        payload.ruleId = selectedSimulationRule;
      }
      
      const response = await axios.post(`${MSG_API_URL}/dispatch/simulate`, payload);
      setSimulationResults(response.data.simulationData);
      setSimulationSteps(response.data.simulationSteps || []);
      setIsSimulationModalOpen(true);
    } catch (error) {
      console.error('Erro na simulação:', error);
      alert(error.response?.data?.error || 'Erro ao realizar a simulação.');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleRunProduction = async (client) => {
    if (!window.confirm(`⚠️ ATENÇÃO: Você está prestes a realizar um DISPARO REAL para os clientes da empresa ${client.name}.\n\nAs mensagens serão efetivamente enviadas e isso não pode ser desfeito.\n\nTem certeza que deseja continuar?`)) {
      return;
    }
    
    setIsSimulating(true);
    try {
      // Cria um endpoint específico ou passa isSimulation=false
      // O backend já tem o /api/dispatch/run, vamos ajustá-lo ou usá-lo com o clientId
      const payload = { clientId: client.id };
      const response = await axios.post(`${MSG_API_URL}/dispatch/run`, payload);
      alert(`Disparo finalizado!\nVerifique o histórico da empresa para ver o status das mensagens.`);
    } catch (error) {
      console.error('Erro no disparo real:', error);
      alert('Erro ao realizar o disparo.');
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '1400px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1rem', background: 'var(--card-bg)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div>
          <h1 style={{ margin: 0, textAlign: 'left', fontSize: '1.5rem', color: 'var(--primary-color)' }}>SGP Dashboard</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>Administrador: {user?.name}</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {isSimulating && (
             <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
               <Activity size={16} className="spin" /> Simulando...
             </span>
          )}
          <button onClick={handleOpenCreateClient} className="btn btn-primary">
            <Plus size={16} /> Nova Empresa
          </button>
          <button onClick={onLogout} className="btn btn-secondary">
            <LogOut size={16} /> Sair
          </button>
        </div>
      </div>
      
      {/* Modal Nova Empresa */}
      {isClientModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>{editingId ? 'Editar Empresa' : 'Nova Empresa'}</h2>
              <button className="btn-icon" onClick={cancelEdit}><X size={24} color="#6b7280"/></button>
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
              {!editingId && (
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
                      <input type="password" name="password" value={formData.password} onChange={handleInputChange} required />
                    </div>
                  </div>
                </>
              )}
              <div className="actions" style={{ justifyContent: 'flex-end', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <Save size={16} /> {editingId ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card list-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <h2 style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>Empresas Cadastradas</h2>
          <div style={{ display: 'flex', alignItems: 'center', background: '#f3f4f6', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
            <Search size={18} color="#6b7280" style={{ marginRight: '0.5rem' }} />
            <input 
              type="text" 
              placeholder="Buscar empresa ou link..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '200px' }}
            />
          </div>
        </div>

        {filteredClients.length === 0 ? (
          <p>Nenhuma empresa encontrada.</p>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Nome</th>
                  <th>Autenticação SGP</th>
                  <th>Link Disparo AtenderBem</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map(client => (
                  <tr key={client.id} style={{ opacity: client.is_active === 1 ? 1 : 0.6 }}>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        className="btn-icon" 
                        onClick={() => toggleActive(client)} 
                        title={client.is_active === 1 ? "Desativar Empresa" : "Ativar Empresa"}
                      >
                        {client.is_active === 1 ? <CheckCircle size={20} color="#10b981" /> : <XCircle size={20} color="#ef4444" />}
                      </button>
                    </td>
                    <td>{client.name}</td>
                    <td>
                      <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={client.sgp_url}>
                        {client.sgp_url}
                      </div>
                    </td>
                    <td>
                      <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={client.atenderbem_link}>
                        {client.atenderbem_link}
                      </div>
                    </td>
                    <td className="table-actions">
                      <button className="btn-icon text-yellow" onClick={() => handleOpenSimulationConfig(client)} title="Simular Disparos" disabled={isSimulating}>
                        <PlayCircle size={18} />
                      </button>
                      <button className="btn-icon" style={{ color: '#dc2626' }} onClick={() => handleRunProduction(client)} title="Executar Disparo Real Agora" disabled={isSimulating}>
                        <Send size={18} />
                      </button>
                      <button className="btn-icon text-blue" onClick={() => handleOpenLogs(client)} title="Ver Histórico de Disparos">
                        <ListOrdered size={18} />
                      </button>
                      <button className="btn-icon text-blue" onClick={() => handleOpenCreateUser(client)} title="Criar Acesso do Cliente">
                        <UserPlus size={18} />
                      </button>
                      <button className="btn-icon text-blue" onClick={() => handleManageMessages(client)} title="Gerenciar Mensagens / Filas">
                        <MessageCircle size={18} />
                      </button>
                      <button className="btn-icon text-blue" onClick={() => handleEdit(client)} title="Editar Empresa">
                        <Edit2 size={18} />
                      </button>
                      <button className="btn-icon text-red" onClick={() => handleDelete(client.id)} title="Remover Empresa">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isUserModalOpen && creatingUserFor && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px', borderTop: '4px solid #10b981' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Acesso: {creatingUserFor.name}</h2>
              <button className="btn-icon" onClick={() => setIsUserModalOpen(false)}><X size={24} color="#6b7280"/></button>
            </div>
            <form onSubmit={handleUserSubmit}>
              <div className="form-group">
                <label>Nome de Usuário (Login):</label>
                <input type="text" name="username" value={userFormData.username} onChange={(e) => setUserFormData({...userFormData, username: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Senha:</label>
                <input type="password" name="password" value={userFormData.password} onChange={(e) => setUserFormData({...userFormData, password: e.target.value})} required />
              </div>
              <div className="actions" style={{ justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#10b981', width: '100%', justifyContent: 'center' }}>
                  <Save size={16} /> Criar Acesso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isMessageModalOpen && selectedClient && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Regras de Disparo - {selectedClient.name}</h2>
              <button className="btn-icon" onClick={() => setIsMessageModalOpen(false)}><X size={24} color="#6b7280"/></button>
            </div>
            
            <form onSubmit={handleMsgSubmit} style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <h4 style={{ marginTop: 0 }}>{editingMsgId ? 'Editar Regra' : 'Nova Regra'}</h4>
              
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
                    <label style={{ fontWeight: 600 }}>Dias de Vencimento:</label>
                    <input type="number" name="days_from_due" value={msgFormData.days_from_due} onChange={handleMsgInputChange} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e5e7eb' }} required />
                    <small style={{color: '#6b7280', fontSize: '11px', display: 'block', marginTop: '4px'}}>Ex: -5 (Antes), 0 (Hoje), 3 (Depois)</small>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontWeight: 600 }}>ID da Fila (Queue):</label>
                    <input type="text" name="queue_id" value={msgFormData.queue_id} onChange={handleMsgInputChange} required style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e5e7eb' }} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontWeight: 600 }}>API Key (Fila):</label>
                    <input type="text" name="queue_api_key" value={msgFormData.queue_api_key} onChange={handleMsgInputChange} required style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e5e7eb' }} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontWeight: 600 }}>Abrir Novo Chat?</label>
                    <select name="open_new_chat" value={msgFormData.open_new_chat !== undefined ? msgFormData.open_new_chat : 1} onChange={handleMsgInputChange} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                      <option value={1}>Sim</option>
                      <option value={0}>Não</option>
                    </select>
                    <small style={{color: '#6b7280', fontSize: '11px', display: 'block', marginTop: '4px'}}>Reabre o chat na fila informada</small>
                  </div>
                </div>
              </div>
              <div className="actions" style={{ justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                {editingMsgId && (
                  <button type="button" className="btn btn-secondary" onClick={cancelMsgEdit}>
                    Cancelar Edição
                  </button>
                )}
                <button type="submit" className="btn btn-primary">
                  <Save size={16} /> {editingMsgId ? 'Atualizar Regra' : 'Adicionar Regra'}
                </button>
              </div>
            </form>

            <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Mensagem/Template</th>
                    <th>Dias</th>
                    <th>Status Fatura</th>
                    <th>Fila</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center' }}>Nenhuma regra cadastrada.</td></tr>
                  ) : (
                    messages.map(msg => (
                      <tr key={msg.id}>
                        <td style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {msg.message_type === 'official' ? (
                            <span style={{color: '#2563eb', fontWeight: 500}}>[Oficial] TPL {msg.template_id}: {msg.template_data}</span>
                          ) : (
                            msg.message_template
                          )}
                        </td>
                        <td>{msg.days_from_due}</td>
                        <td>
                          {msg.days_from_due < 0 ? 'A Vencer' : msg.days_from_due === 0 ? 'Vencendo Hoje' : 'Vencida'}
                        </td>
                        <td>{msg.queue_id}</td>
                        <td className="table-actions">
                          <button className="btn-icon text-blue" onClick={() => handleMsgEdit(msg)} title="Editar">
                            <Edit2 size={18} />
                          </button>
                          <button className="btn-icon text-red" onClick={() => handleMsgDelete(msg.id)} title="Remover">
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
      )}
      {isLogsModalOpen && viewingLogsFor && (
        <DispatchLogsModal client={viewingLogsFor} onClose={() => setIsLogsModalOpen(false)} />
      )}

      {/* Modal de Configuração de Simulação */}
      {isSimulationConfigOpen && simulatingClient && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Simular Disparos - {simulatingClient.name}</h2>
              <button className="btn-icon" onClick={() => setIsSimulationConfigOpen(false)}><X size={24} color="#6b7280"/></button>
            </div>
            <div className="form-group">
              <label>Selecionar Regra para Simular:</label>
              <select 
                value={selectedSimulationRule} 
                onChange={(e) => setSelectedSimulationRule(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e5e7eb' }}
              >
                <option value="">Todas as Regras desta Empresa</option>
                {allMessages.map(msg => (
                  <option key={msg.id} value={msg.id}>
                    {msg.days_from_due} dias ({msg.days_from_due < 0 ? 'A Vencer' : msg.days_from_due === 0 ? 'Vencendo Hoje' : 'Vencida'}) - Fila: {msg.queue_id}
                  </option>
                ))}
              </select>
              <small style={{color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '4px'}}>
                Escolha uma regra específica ou simule todas as regras da empresa de uma vez.
              </small>
            </div>
            <div className="actions" style={{ justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsSimulationConfigOpen(false)}>Cancelar</button>
              <button type="button" className="btn" style={{ backgroundColor: '#f59e0b', color: 'white' }} onClick={handleRunSimulation}>
                <PlayCircle size={16} /> Iniciar Simulação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Simulação */}
      {isSimulationModalOpen && simulationResults && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '1400px', width: '95%', height: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Resultados da Simulação - {simulatingClient?.name}</h2>
              <button className="btn-icon" onClick={() => setIsSimulationModalOpen(false)}><X size={24} color="#6b7280"/></button>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', background: '#f3f4f6', padding: '1rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                <label style={{ fontWeight: 'bold', color: '#374151', whiteSpace: 'nowrap' }}>Testar Regra:</label>
                <select 
                  value={selectedSimulationRule} 
                  onChange={(e) => setSelectedSimulationRule(e.target.value)}
                  style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', minWidth: '300px' }}
                  disabled={isSimulating}
                >
                  <option value="">Todas as Regras desta Empresa</option>
                  {allMessages.map(msg => (
                    <option key={msg.id} value={msg.id}>
                      {msg.days_from_due} dias ({msg.days_from_due < 0 ? 'A Vencer' : msg.days_from_due === 0 ? 'Vencendo Hoje' : 'Vencida'}) - Fila: {msg.queue_id}
                    </option>
                  ))}
                </select>
                <button 
                  className="btn" 
                  style={{ backgroundColor: '#f59e0b', color: 'white' }} 
                  onClick={handleRunSimulation}
                  disabled={isSimulating}
                >
                  {isSimulating ? <><Activity size={16} className="spin" /> Processando...</> : <><PlayCircle size={16} /> Nova Simulação</>}
                </button>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '1rem', color: '#374151' }}>
                  Encontrados <b>{simulationResults.length}</b> registros ativos.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flex: 1, gap: '1rem', overflow: 'hidden' }}>
              {/* Painel Esquerdo: Resultados em Tabela */}
              <div className="table-responsive" style={{ flex: 2, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
                {simulationResults.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#6b7280', marginTop: '2rem' }}>Nenhuma mensagem seria disparada no cenário atual.</p>
                ) : (
                  <table style={{ minWidth: '600px', margin: 0 }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f9fafb' }}>
                      <tr>
                        <th>Empresa (Regra)</th>
                        <th>Cliente</th>
                        <th>Telefone</th>
                        <th>Mensagem Gerada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulationResults.map((sim, index) => (
                        <tr key={index} style={{ opacity: sim.ignored ? 0.6 : 1, backgroundColor: sim.ignored ? '#fef2f2' : 'transparent' }}>
                          <td>
                            <b>{sim.clientName}</b><br/>
                            <small style={{ color: '#6b7280' }}>
                              {sim.ruleDays} dias ({sim.filterType})<br/>
                              Data Alvo: {sim.targetDate.split('-').reverse().join('/')}
                            </small>
                          </td>
                          <td>
                            {sim.customerName || <span style={{color:'#9ca3af'}}>N/A</span>}
                            {sim.ignored && (
                              <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', fontWeight: 'bold' }}>
                                ⚠️ IGNORADO: {sim.ignoreReason}
                              </div>
                            )}
                          </td>
                          <td>{sim.phone || <span style={{color:'#ef4444'}}>Sem WhatsApp</span>}</td>
                          <td>
                            <div style={{
                              whiteSpace: 'pre-wrap', 
                              background: '#f3f4f6', 
                              padding: '8px', 
                              borderRadius: '4px',
                              fontSize: '12px',
                              maxHeight: '100px',
                              overflowY: 'auto'
                            }}>
                              {sim.message}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Painel Direito: Logs dos Passos */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid #e5e7eb', borderRadius: '4px', background: '#111827', color: '#e5e7eb', fontFamily: 'monospace', fontSize: '12px' }}>
                <div style={{ padding: '0.5rem 1rem', background: '#1f2937', borderBottom: '1px solid #374151', fontWeight: 'bold' }}>
                  Logs de Execução
                </div>
                <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                  {simulationSteps.map((step, idx) => (
                    <div key={idx} style={{ marginBottom: '4px', color: step.includes('[ERRO]') ? '#f87171' : step.includes('[AVISO]') ? '#fbbf24' : '#e5e7eb' }}>
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
