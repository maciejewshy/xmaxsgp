import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { X, CheckCircle, XCircle, Search, Clock, Trash2, ChevronLeft, ChevronRight, Activity } from 'lucide-react';

const BASE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const MSG_API_URL = `${BASE_API_URL}/api`;

export default function DispatchLogsModal({ client, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const pollingInterval = useRef(null);

  useEffect(() => {
    if (client) {
      fetchLogs(client.id);
    }
    return () => stopPolling();
  }, [client]);

  // Começa o polling de 5 em 5 segundos se houver mensagens em espera
  useEffect(() => {
    const hasWaiting = logs.some(log => log.status === 'Em espera');
    if (hasWaiting) {
      startPolling();
    } else {
      stopPolling();
    }
  }, [logs]);

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

  const fetchLogs = async (clientId) => {
    try {
      setLoading(true);
      const response = await axios.get(`${MSG_API_URL}/clients/${clientId}/logs`);
      setLogs(response.data);
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkWaitingStatuses = async () => {
    const waitingLogs = logs.filter(log => log.status === 'Em espera').map(l => l.id);
    if (waitingLogs.length === 0) return;

    try {
      const res = await axios.post(`${MSG_API_URL}/clients/${client.id}/logs/check`, { logIds: waitingLogs });
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

  const handleCancelMessage = async (logId) => {
    if (!window.confirm('Tem certeza que deseja cancelar este envio?')) return;
    try {
      await axios.post(`${MSG_API_URL}/clients/${client.id}/logs/${logId}/cancel`);
      setLogs(prevLogs => prevLogs.map(l => l.id === logId ? { ...l, status: 'Cancelado' } : l));
    } catch (err) {
      alert('Erro ao cancelar a mensagem.');
    }
  };

  const handleCancelAllWaiting = async () => {
    if (!window.confirm('Tem certeza que deseja cancelar TODOS os envios em espera desta empresa?')) return;
    try {
      const res = await axios.post(`${MSG_API_URL}/clients/${client.id}/logs/cancel-all`);
      alert(res.data.message);
      fetchLogs(client.id); // Recarregar para pegar os novos status
    } catch (err) {
      alert('Erro ao cancelar mensagens em espera.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(date);
  };

  // Filtragem
  const filteredLogs = logs.filter(log => {
    const searchStr = filterText.toLowerCase();
    return (
      (log.phone_number && log.phone_number.toLowerCase().includes(searchStr)) ||
      (log.message_sent && log.message_sent.toLowerCase().includes(searchStr)) ||
      (log.status && log.status.toLowerCase().includes(searchStr)) ||
      (log.invoice_id && log.invoice_id.toString().toLowerCase().includes(searchStr))
    );
  });

  // Paginação
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

  const hasWaitingLogs = logs.some(l => l.status === 'Em espera');

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '1200px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, border: 'none', padding: 0 }}>Histórico de Disparos - {client.name}</h2>
          <button type="button" className="btn-icon" onClick={onClose}><X size={24} color="#6b7280"/></button>
        </div>

        {/* Toolbar superior (Filtros e Ações globais) */}
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
            {hasWaitingLogs && (
              <>
                <span style={{ fontSize: '0.875rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Activity size={16} className="spin" /> Atualizando status...
                </span>
                <button onClick={handleCancelAllWaiting} className="btn" style={{ backgroundColor: '#ef4444', color: 'white', padding: '0.5rem 1rem' }}>
                  <Trash2 size={16} /> Cancelar Todos em Espera
                </button>
              </>
            )}
            <button onClick={() => fetchLogs(client.id)} className="btn btn-secondary">
              Atualizar Manual
            </button>
          </div>
        </div>

        {loading ? (
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
                    <th>Mensagem Enviada</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>Status</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {currentLogs.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Nenhum disparo encontrado.</td></tr>
                  ) : (
                    currentLogs.map(log => (
                      <tr key={log.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{formatDate(log.created_at)}</td>
                        <td style={{ fontWeight: '500' }}>{log.phone_number}</td>
                        <td style={{ fontSize: '0.875rem', color: '#6b7280' }}>#{log.invoice_id}</td>
                        <td>
                          <div style={{ maxHeight: '80px', overflowY: 'auto', fontSize: '0.875rem', paddingRight: '0.5rem', whiteSpace: 'pre-wrap', color: '#374151' }}>
                            {log.message_sent}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {getStatusBadge(log.status)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {log.status === 'Em espera' && log.enqueued_id && (
                            <button 
                              onClick={() => handleCancelMessage(log.id)}
                              className="btn-icon" 
                              style={{ color: '#ef4444', padding: '4px' }}
                              title="Cancelar Envio"
                            >
                              <XCircle size={18} />
                            </button>
                          )}
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
    </div>
  );
}