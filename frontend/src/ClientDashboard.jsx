import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { LogOut, Save, X, Edit2, CheckCircle, XCircle, Clock, Search, Trash2, ChevronLeft, ChevronRight, Activity, MessageCircle, ListOrdered, FileText } from 'lucide-react';
import './App.css';

const BASE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_URL = `${BASE_API_URL}/api/clients`;
const MSG_API_URL = `${BASE_API_URL}/api`;

function ClientDashboard({ user, onLogout }) {
  const [clientData, setClientData] = useState(null);
  const [activeTab, setActiveTab] = useState('history'); // 'history' ou 'messages'
  const [testingDispatch, setTestingDispatch] = useState(false);
  const [testLogs, setTestLogs] = useState(null);
  const [showTestLogsModal, setShowTestLogsModal] = useState(false); // Controle do modal de logs do teste
  const [selectedLog, setSelectedLog] = useState(null); // Para o modal de log detalhado

  // Estado para Histórico de Disparos
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const pollingInterval = useRef(null);

  // Estado para Mensagens
  const [messages, setMessages] = useState([]);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [msgFormData, setMsgFormData] = useState({
    message_template: '',
    days_from_due: 0,
    queue_id: '',
    queue_api_key: ''
  });

  useEffect(() => {
    fetchClientData();
    fetchMessages();
    fetchLogs();
    return () => stopPolling();
  }, [user.client_id]);

  useEffect(() => {
    // Polling desativado temporariamente devido a instabilidade na API da AtenderBem
    /*
    if (activeTab === 'history') {
      const hasWaiting = logs.some(log => log.status === 'Em espera');
      if (hasWaiting) {
        startPolling();
      } else {
        stopPolling();
      }
    } else {
      stopPolling();
    }
    */
    stopPolling();
  }, [logs, activeTab]);

  const startPolling = () => {
    if (!pollingInterval.current) {
      pollingInterval.current = setInterval(() => {
        checkWaitingStatuses();
      }, 5000);
    }
  };

  const stopPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  };

  const fetchClientData = async () => {
    try {
      const response = await axios.get(`${API_URL}/${user.client_id}`);
      setClientData(response.data);
    } catch (error) {
      console.error('Erro ao buscar dados do cliente:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await axios.get(`${MSG_API_URL}/clients/${user.client_id}/messages`);
      setMessages(response.data);
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const response = await axios.get(`${MSG_API_URL}/clients/${user.client_id}/logs`);
      setLogs(response.data);
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const checkWaitingStatuses = async () => {
    const waitingLogs = logs.filter(log => log.status === 'Em espera').map(l => l.id);
    if (waitingLogs.length === 0) return;

    try {
      const res = await axios.post(`${MSG_API_URL}/clients/${user.client_id}/logs/check`, { logIds: waitingLogs });
      if (res.data.updated > 0) {
        setLogs(prevLogs => {
          const newLogs = [...prevLogs];
          res.data.logs.forEach(updatedLog => {
            const idx = newLogs.findIndex(l => l.id === updatedLog.id);
            if (idx !== -1) newLogs[idx].status = updatedLog.status;
          });
          return newLogs;
        });
      }
    } catch (err) {
      console.error('Erro ao checar status:', err);
    }
  };

  const handleTestMassCancel = async () => {
    if (!window.confirm('Isto irá disparar a rotina das 18h, cancelando todos os envios de HOJE (agrupados de 50 em 50). Deseja continuar?')) return;
    try {
      const res = await axios.post(`${MSG_API_URL}/dispatch/test-mass-cancel`);
      alert(res.data.message);
      fetchLogs();
    } catch (err) {
      alert('Erro ao executar rotina de cancelamento em massa.');
    }
  };

  const handleCancelMessage = async (logId) => {
    if (!window.confirm('Tem certeza que deseja cancelar este envio?')) return;
    try {
      await axios.post(`${MSG_API_URL}/clients/${user.client_id}/logs/${logId}/cancel`);
      setLogs(prevLogs => prevLogs.map(l => l.id === logId ? { ...l, status: 'Cancelado' } : l));
    } catch (err) {
      alert('Erro ao cancelar a mensagem.');
    }
  };

  const handleCancelAllWaiting = async () => {
    if (!window.confirm('Tem certeza que deseja cancelar TODOS os envios em espera?')) return;
    try {
      const res = await axios.post(`${MSG_API_URL}/clients/${user.client_id}/logs/cancel-all`);
      alert(res.data.message);
      fetchLogs();
    } catch (err) {
      alert('Erro ao cancelar mensagens em espera.');
    }
  };

  const handleTestDispatch = async () => {
    if (!window.confirm('Isto iniciará um disparo de teste real. As mensagens serão geradas com base nos clientes reais inadimplentes do SGP, mas enviadas exclusivamente para o número 38984044593, limitadas a 3 mensagens. Deseja continuar?')) return;
    
    setTestingDispatch(true);
    setTestLogs(null);
    setShowTestLogsModal(false);
    try {
      const response = await axios.post(`${API_URL}/${user.client_id}/test-dispatch-real`, {
        testPhone: '5538984044593'
      });
      setTestLogs(response.data.result.simulationSteps || ['Nenhum log retornado pelo servidor.']);
      alert('Teste de disparo concluído. Verifique o histórico e o WhatsApp de destino.');
      fetchLogs();
      setActiveTab('history');
    } catch (error) {
      console.error('Erro no disparo de teste:', error);
      setTestLogs([`Erro fatal: ${error.response?.data?.error || error.message}`]);
      alert('Erro ao executar disparo de teste. Verifique os logs.');
    } finally {
      setTestingDispatch(false);
    }
  };

  const handleMsgInputChange = (e) => {
    setMsgFormData({ ...msgFormData, [e.target.name]: e.target.value });
  };

  const handleMsgSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingMsgId) {
        await axios.put(`${MSG_API_URL}/messages/${editingMsgId}`, msgFormData);
      } else {
        await axios.post(`${MSG_API_URL}/clients/${user.client_id}/messages`, msgFormData);
      }
      setMsgFormData({ message_template: '', days_from_due: 0, queue_id: '', queue_api_key: '' });
      setEditingMsgId(null);
      fetchMessages();
    } catch (error) {
      console.error('Erro ao salvar mensagem:', error);
    }
  };

  const handleMsgEdit = (msg) => {
    setMsgFormData(msg);
    setEditingMsgId(msg.id);
  };

  const handleMsgDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja remover esta regra de mensagem?')) {
      try {
        await axios.delete(`${MSG_API_URL}/messages/${id}`);
        fetchMessages();
      } catch (error) {
        console.error('Erro ao remover mensagem:', error);
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    // Ajuste de fuso horário: o SQLite salva em UTC (CURRENT_TIMESTAMP), então adicionamos o 'Z'
    // para forçar o JavaScript a interpretar a string corretamente e converter para a hora local (Brasil)
    const dateStr = dateString.endsWith('Z') ? dateString : dateString.replace(' ', 'T') + 'Z';
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(date);
  };

  // Filtragem e Paginação de Logs
  const filteredLogs = logs.filter(log => {
    const searchStr = filterText.toLowerCase();
    return (
      (log.phone_number && log.phone_number.toLowerCase().includes(searchStr)) ||
      (log.message_sent && log.message_sent.toLowerCase().includes(searchStr)) ||
      (log.status && log.status.toLowerCase().includes(searchStr)) ||
      (log.invoice_id && log.invoice_id.toString().toLowerCase().includes(searchStr))
    );
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentLogs = filteredLogs.slice(startIndex, startIndex + itemsPerPage);

  const getStatusBadge = (status) => {
    if (status === 'Sucesso' || status === 'Enviado' || status === 'Entregue' || status === 'Lido') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#059669', fontSize: '0.75rem', fontWeight: '500', background: '#d1fae5', padding: '4px 8px', borderRadius: '999px' }}>
          <CheckCircle size={14} /> {status}
        </span>
      );
    } else if (status === 'Em espera') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#d97706', fontSize: '0.75rem', fontWeight: '500', background: '#fef3c7', padding: '4px 8px', borderRadius: '999px' }}>
          <Clock size={14} /> {status}
        </span>
      );
    } else if (status === 'Cancelado') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#6b7280', fontSize: '0.75rem', fontWeight: '500', background: '#f3f4f6', padding: '4px 8px', borderRadius: '999px' }}>
          <XCircle size={14} /> Cancelado
        </span>
      );
    } else {
      return (
        <span title={status} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#dc2626', fontSize: '0.75rem', fontWeight: '500', background: '#fee2e2', padding: '4px 8px', borderRadius: '999px', cursor: 'help' }}>
          <XCircle size={14} /> {status.length > 15 ? 'Erro' : status}
        </span>
      );
    }
  };

  const hasWaitingLogs = logs.some(l => l.status === 'Em espera' || l.status === 'Enviado');

  const formatJSON = (str) => {
    if (!str) return 'Nenhum log registrado.';
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch (e) {
      return str;
    }
  };

  if (!clientData) return <div style={{ textAlign: 'center', marginTop: '2rem' }}>Carregando dados...</div>;

  return (
    <div className="container" style={{ maxWidth: '1400px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem', padding: '1rem', background: 'var(--card-bg)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ flex: '1 1 min-content' }}>
          <h1 style={{ margin: 0, textAlign: 'left', fontSize: '1.5rem', color: 'var(--primary-color)' }}>Painel da Empresa</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>Olá, {user.name} | Empresa: {clientData.name}</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setActiveTab('history')} 
            className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <ListOrdered size={16} /> Histórico de Disparos
          </button>
          <button 
            onClick={() => setActiveTab('messages')} 
            className={`btn ${activeTab === 'messages' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <MessageCircle size={16} /> Mensagens
          </button>
          <button onClick={onLogout} className="btn btn-secondary">
            <LogOut size={16} /> Sair
          </button>
        </div>
      </div>

      {activeTab === 'history' && (
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '75vh' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ position: 'relative', width: '300px' }}>
              <Search size={18} color="#9ca3af" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                placeholder="Buscar telefone, mensagem, status..." 
                value={filterText}
                onChange={(e) => { setFilterText(e.target.value); setCurrentPage(1); }}
                style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button onClick={handleTestMassCancel} className="btn" style={{ backgroundColor: '#ef4444', color: 'white', padding: '0.5rem 1rem' }}>
                <Trash2 size={16} /> Testar Cancelamento (18h)
              </button>
              {hasWaitingLogs && (
                <>
                  <button onClick={handleCancelAllWaiting} className="btn" style={{ backgroundColor: '#ef4444', color: 'white', padding: '0.5rem 1rem' }}>
                    <Trash2 size={16} /> Cancelar Todos Pendentes
                  </button>
                </>
              )}
              <button onClick={handleTestDispatch} disabled={testingDispatch} className="btn btn-primary" style={{ backgroundColor: '#8b5cf6', color: 'white' }}>
                {testingDispatch ? <><Activity size={16} className="spin" /> Testando...</> : 'Testar Disparo Real'}
              </button>
              {testLogs && (
                <button onClick={() => setShowTestLogsModal(true)} className="btn" style={{ backgroundColor: '#10b981', color: 'white' }}>
                  <FileText size={16} /> Ver Logs do Teste
                </button>
              )}
              <button onClick={() => fetchLogs()} className="btn btn-secondary">
                Atualizar Manual
              </button>
            </div>
          </div>

          {loadingLogs ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Carregando histórico...</div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div className="table-responsive" style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px 8px 0 0', borderBottom: 'none' }}>
                <table style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f9fafb' }}>
                    <tr>
                      <th style={{ width: '150px' }}>Data/Hora</th>
                      <th style={{ width: '140px' }}>Telefone</th>
                      <th style={{ width: '100px' }}>ID Título</th>
                      <th style={{ width: '100px' }}>ID Fila (XMAX)</th>
                      <th>Mensagem Enviada</th>
                      <th style={{ width: '120px', textAlign: 'center' }}>Status</th>
                      <th style={{ width: '100px', textAlign: 'center' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentLogs.length === 0 ? (
                      <tr><td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Nenhum disparo encontrado.</td></tr>
                    ) : (
                      currentLogs.map(log => (
                        <tr key={log.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{formatDate(log.created_at)}</td>
                          <td style={{ fontWeight: '500' }}>{log.phone_number}</td>
                          <td style={{ fontSize: '0.875rem', color: '#6b7280' }}>#{log.invoice_id}</td>
                          <td style={{ fontSize: '0.875rem', color: '#8b5cf6', fontWeight: 'bold' }}>{log.enqueued_id ? `#${log.enqueued_id}` : '-'}</td>
                          <td>
                            <div style={{ maxHeight: '80px', overflowY: 'auto', fontSize: '0.875rem', paddingRight: '0.5rem', whiteSpace: 'pre-wrap', color: '#374151' }}>
                              {log.message_sent}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {getStatusBadge(log.status)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                              {(log.api_request_log || log.api_response_log) && (
                                <button 
                                  onClick={() => setSelectedLog(log)}
                                  className="btn-icon" 
                                  style={{ color: '#3b82f6', padding: '4px' }}
                                  title="Ver Log de Integração"
                                >
                                  <FileText size={18} />
                                </button>
                              )}
                              {(log.status === 'Em espera' || log.status === 'Enviado') && log.enqueued_id && (
                                <button 
                                  onClick={() => handleCancelMessage(log.id)}
                                  className="btn-icon" 
                                  style={{ color: '#ef4444', padding: '4px' }}
                                  title="Cancelar Envio"
                                >
                                  <XCircle size={18} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#f9fafb', border: '1px solid var(--border-color)', borderRadius: '0 0 8px 8px' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    Mostrando {startIndex + 1} até {Math.min(startIndex + itemsPerPage, filteredLogs.length)} de {filteredLogs.length} registros
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.5rem' }}
                    >
                      <ChevronLeft size={16} /> Anterior
                    </button>
                    <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                      Página {currentPage} de {totalPages}
                    </span>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.5rem' }}
                    >
                      Próxima <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'messages' && (
        <div className="card message-card" style={{ padding: '2rem' }}>
          <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Regras de Disparo</h2>
          
          {editingMsgId ? (
            <form onSubmit={handleMsgSubmit} style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <h4 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--primary-color)' }}>Editar Regra</h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontWeight: 600 }}>Mensagem de Envio:</label>
                  <textarea name="message_template" value={msgFormData.message_template} onChange={handleMsgInputChange} rows="4" required style={{ resize: 'vertical', width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e5e7eb', boxSizing: 'border-box' }} />
                  <small style={{color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '4px'}}>
                    <b>Variáveis Suportadas:</b> {`{nome}, {cpf}, {vencimento}, {valor}, {link_boleto}, {pix}, {linha_digitavel}`}
                  </small>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontWeight: 600 }}>Dias (em relação ao vencimento):</label>
                    <input type="number" name="days_from_due" value={msgFormData.days_from_due} onChange={handleMsgInputChange} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e5e7eb', boxSizing: 'border-box' }} required />
                    <small style={{color: '#6b7280', fontSize: '11px', display: 'block', marginTop: '4px', lineHeight: '1.4'}}>
                      Negativo (ex: -5) para ANTES. Zero (0) para HOJE. Positivo (ex: 3) para DEPOIS.
                    </small>
                  </div>
                  
                  {/* Ocultando campos de Fila para o Cliente, mantendo os valores originais no state caso seja edição */}
                  <input type="hidden" name="queue_id" value={msgFormData.queue_id} />
                  <input type="hidden" name="queue_api_key" value={msgFormData.queue_api_key} />
                </div>
              </div>

              <div className="actions" style={{ justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid #e5e7eb', paddingTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setMsgFormData({ message_template: '', days_from_due: 0, queue_id: '', queue_api_key: '' }); setEditingMsgId(null); }}>
                  Cancelar Edição
                </button>
                <button type="submit" className="btn btn-primary" style={{ minWidth: '150px', justifyContent: 'center' }}>
                  <Save size={16} /> Atualizar Regra
                </button>
              </div>
            </form>
          ) : (
            <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#fef3c7', color: '#92400e', borderRadius: '8px', border: '1px solid #fcd34d' }}>
              <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MessageCircle size={18} />
                Selecione uma regra na tabela abaixo para editá-la. A criação de novas regras e alteração de filas é feita pelo administrador.
              </p>
            </div>
          )}

          <h3 style={{ margin: '0 0 1rem 0' }}>Regras Ativas</h3>
          <div className="table-responsive" style={{ border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <table style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Dias</th>
                  <th>Status Fatura</th>
                  <th>Mensagem</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {messages.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhuma regra cadastrada.</td></tr>
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
                      <td style={{ maxWidth: '400px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.message_template}</td>
                      <td className="table-actions" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn-icon text-blue" onClick={() => { setMsgFormData(msg); setEditingMsgId(msg.id); }} title="Editar">
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
      )}

      {/* Modal para os Logs do Teste */}
      {showTestLogsModal && testLogs && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
        }}>
          <div style={{
            background: 'white', borderRadius: '8px', width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1f2937' }}>
                <FileText size={20} className="text-green" />
                Logs do Último Teste de Disparo
              </h3>
              <button onClick={() => setShowTestLogsModal(false)} className="btn-icon" style={{ color: '#6b7280' }}>
                <X size={24} />
              </button>
            </div>
            
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, background: '#1f2937', color: '#10b981', fontFamily: 'monospace', fontSize: '0.875rem' }}>
              {testLogs.map((log, i) => (
                <div key={i} style={{ borderBottom: '1px solid #374151', padding: '4px 0' }}>{log}</div>
              ))}
            </div>
            
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb', textAlign: 'right', background: '#f9fafb', borderRadius: '0 0 8px 8px', display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => { setTestLogs(null); setShowTestLogsModal(false); }} className="btn btn-secondary" style={{ color: '#ef4444' }}>
                Limpar Logs
              </button>
              <button onClick={() => setShowTestLogsModal(false)} className="btn btn-secondary">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedLog && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
        }}>
          <div style={{
            background: 'white', borderRadius: '8px', width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1f2937' }}>
                <FileText size={20} className="text-blue" />
                Logs de Integração (AtenderBem)
              </h3>
              <button onClick={() => setSelectedLog(null)} className="btn-icon" style={{ color: '#6b7280' }}>
                <X size={24} />
              </button>
            </div>
            
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#4b5563', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payload Enviado (Requisição)</h4>
                <pre style={{ 
                  background: '#1f2937', color: '#a7f3d0', padding: '1rem', borderRadius: '6px', 
                  overflowX: 'auto', fontSize: '0.875rem', margin: 0, whiteSpace: 'pre-wrap'
                }}>
                  {formatJSON(selectedLog.api_request_log)}
                </pre>
              </div>

              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#4b5563', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resposta da API</h4>
                <pre style={{ 
                  background: '#1f2937', color: '#fca5a5', padding: '1rem', borderRadius: '6px', 
                  overflowX: 'auto', fontSize: '0.875rem', margin: 0, whiteSpace: 'pre-wrap'
                }}>
                  {formatJSON(selectedLog.api_response_log)}
                </pre>
              </div>
            </div>
            
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb', textAlign: 'right', background: '#f9fafb', borderRadius: '0 0 8px 8px' }}>
              <button onClick={() => setSelectedLog(null)} className="btn btn-secondary">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientDashboard;
