const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const db = require('./database');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/database/download', (req, res) => {
    const databasePath = path.resolve(__dirname, 'database.sqlite');
    const expectedToken = process.env.DB_DOWNLOAD_TOKEN;
    if (!expectedToken) {
        res.status(404).end();
        return;
    }
    const providedToken = req.query.token || req.header('x-db-download-token');
    if (providedToken !== expectedToken) {
        res.status(404).end();
        return;
    }
    if (!fs.existsSync(databasePath)) {
        res.status(404).end();
        return;
    }
    const fileName = `database-backup-${new Date().toISOString().slice(0, 10)}.sqlite`;
    res.download(databasePath, fileName, (err) => {
        if (err && !res.headersSent) {
            res.status(500).json({ error: 'Erro ao baixar banco de dados' });
        }
    });
});

// Autenticação (Login)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT id, name, username, role, client_id FROM users WHERE username = ? AND password = ?', [username, password], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });
        res.json(user);
    });
});

// Criar Usuário (Acesso para cliente)
app.post('/api/users', (req, res) => {
    const { name, username, password, role, client_id } = req.body;
    // Verificar se usuário já existe
    db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) return res.status(400).json({ error: 'Nome de usuário já existe' });

        const query = `INSERT INTO users (name, username, password, role, client_id) VALUES (?, ?, ?, ?, ?)`;
        db.run(query, [name, username, password, role, client_id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, message: 'Usuário criado com sucesso' });
        });
    });
});

// Clientes SGP
app.get('/api/clients', (req, res) => {
    db.all('SELECT * FROM clients', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/clients/:id', (req, res) => {
    db.get('SELECT * FROM clients WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Cliente não encontrado' });
        res.json(row);
    });
});

app.post('/api/clients', (req, res) => {
    const { name, sgp_url, sgp_token, atenderbem_link, is_active, username, password, dispatch_days, dispatch_start_time } = req.body;
    
    // Iniciar Transação (simulada) para garantir que cliente e usuário sejam criados juntos
    db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row && username) return res.status(400).json({ error: 'Nome de usuário já existe' });

        const queryClient = `
            INSERT INTO clients (
                name, sgp_url, sgp_token, atenderbem_link, is_active, dispatch_days, dispatch_start_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        db.run(
            queryClient,
            [
                name,
                sgp_url,
                sgp_token,
                atenderbem_link,
                is_active !== undefined ? is_active : 1,
                dispatch_days || '1,2,3,4,5',
                dispatch_start_time || '08:00'
            ],
            function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            const clientId = this.lastID;

            if (username && password) {
                const queryUser = `INSERT INTO users (name, username, password, role, client_id) VALUES (?, ?, ?, ?, ?)`;
                db.run(queryUser, [name, username, password, 'client', clientId], function(err) {
                    if (err) console.error("Erro ao criar usuário vinculado:", err);
                });
            }
            res.json({ id: clientId });
        });
    });
});

app.put('/api/clients/:id', (req, res) => {
    const { name, sgp_url, sgp_token, atenderbem_link, is_active, dispatch_days, dispatch_start_time } = req.body;
    const query = `
        UPDATE clients SET 
            name = ?, sgp_url = ?, sgp_token = ?, atenderbem_link = ?, is_active = ?, dispatch_days = ?, dispatch_start_time = ?
        WHERE id = ?
    `;
    db.run(
        query,
        [
            name,
            sgp_url,
            sgp_token,
            atenderbem_link,
            is_active,
            dispatch_days || '1,2,3,4,5',
            dispatch_start_time || '08:00',
            req.params.id
        ],
        function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ updated: this.changes });
    });
});

app.delete('/api/clients/:id', (req, res) => {
    db.run('DELETE FROM clients WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

// Mensagens de Disparo
app.get('/api/messages', (req, res) => {
    const query = `
        SELECT m.*, c.name as client_name 
        FROM dispatch_messages m
        JOIN clients c ON m.client_id = c.id
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/clients/:clientId/messages', (req, res) => {
    db.all('SELECT * FROM dispatch_messages WHERE client_id = ?', [req.params.clientId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/clients/:clientId/messages', (req, res) => {
    const { message_template, days_from_due, queue_id, queue_api_key, message_type, template_id, template_data, open_new_chat, trigger_type } = req.body;
    const query = `
        INSERT INTO dispatch_messages (client_id, message_template, days_from_due, queue_id, queue_api_key, message_type, template_id, template_data, open_new_chat, trigger_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(
        query,
        [
            req.params.clientId,
            message_template,
            days_from_due,
            queue_id,
            queue_api_key,
            message_type || 'unofficial',
            template_id || null,
            template_data || null,
            open_new_chat !== undefined ? open_new_chat : 1,
            trigger_type || 'due_date'
        ],
        function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

app.put('/api/messages/:id', (req, res) => {
    const { message_template, days_from_due, queue_id, queue_api_key, message_type, template_id, template_data, open_new_chat, trigger_type } = req.body;
    const query = `
        UPDATE dispatch_messages SET 
            message_template = ?, days_from_due = ?, queue_id = ?, queue_api_key = ?, message_type = ?, template_id = ?, template_data = ?, open_new_chat = ?, trigger_type = ?
        WHERE id = ?
    `;
    db.run(
        query,
        [
            message_template,
            days_from_due,
            queue_id,
            queue_api_key,
            message_type || 'unofficial',
            template_id || null,
            template_data || null,
            open_new_chat !== undefined ? open_new_chat : 1,
            trigger_type || 'due_date',
            req.params.id
        ],
        function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ updated: this.changes });
    });
});

app.delete('/api/messages/:id', (req, res) => {
    db.run('DELETE FROM dispatch_messages WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

// Histórico de Disparos
app.get('/api/clients/:clientId/logs', (req, res) => {
    db.all('SELECT * FROM dispatch_logs WHERE client_id = ? ORDER BY created_at DESC', [req.params.clientId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Verificar Status do Disparo na AtenderBem
app.post('/api/clients/:clientId/logs/check', async (req, res) => {
    const { logIds } = req.body;
    if (!logIds || logIds.length === 0) return res.json({ updated: 0 });

    console.log(`[STATUS CHECK] Iniciando verificação para ${logIds.length} logs em espera...`);

    try {
        db.all(`SELECT * FROM dispatch_logs WHERE id IN (${logIds.map(() => '?').join(',')})`, logIds, async (err, logs) => {
            if (err) {
                console.error(`[STATUS CHECK] Erro no banco de dados: ${err.message}`);
                return res.status(500).json({ error: err.message });
            }
            if (!logs || logs.length === 0) {
                console.log(`[STATUS CHECK] Nenhum log encontrado com os IDs fornecidos.`);
                return res.json({ updated: 0 });
            }

            let updatedCount = 0;
            const updatedLogs = [];

            // Precisamos da URL base do atenderbem. Pegar do client_id
            db.get('SELECT atenderbem_link FROM clients WHERE id = ?', [req.params.clientId], async (err, clientRow) => {
                if (err || !clientRow) {
                    console.error(`[STATUS CHECK] Cliente não encontrado para buscar URL da AtenderBem.`);
                    return res.status(500).json({ error: 'Cliente não encontrado' });
                }
                
                const atenderBemOrigin = new URL(clientRow.atenderbem_link).origin;

                for (const log of logs) {
                    if (log.enqueued_id && log.queue_id && log.queue_api_key) {
                        try {
                            const checkUrl = `${atenderBemOrigin}/int/checkEnqueuedMessage`;
                            const payloadCheck = {
                                queueId: parseInt(log.queue_id, 10),
                                apiKey: log.queue_api_key,
                                enqueuedId: parseInt(log.enqueued_id, 10)
                            };
                            
                            console.log(`[STATUS CHECK] Checando Log ID: ${log.id} (Enqueued: ${log.enqueued_id})`);
                            console.log(`   -> [POST] ${checkUrl}`);
                            console.log(`   -> [PAYLOAD] ${JSON.stringify(payloadCheck)}`);

                            const checkRes = await axios.post(checkUrl, payloadCheck);

                            let newStatus = log.status;
                            const statusApi = checkRes.data.status;
                            
                            console.log(`   -> [RESPOSTA] Status Code: ${checkRes.status} | Data: ${JSON.stringify(checkRes.data)}`);
                            
                            // Mapeamento provável de status: 
                            // 0: Na fila / Em espera, 1: Enviado, 2: Entregue, 3: Lido, 4: Erro
                            if (statusApi === 0) newStatus = 'Em espera';
                            else if (statusApi === 1) newStatus = 'Enviado';
                            else if (statusApi === 2) newStatus = 'Entregue';
                            else if (statusApi === 3) newStatus = 'Lido';
                            else if (statusApi === 4 || statusApi === -1) newStatus = 'Erro/Cancelado';
                            else newStatus = `Status: ${statusApi}`;

                            if (newStatus !== log.status) {
                                console.log(`   -> [ATUALIZAÇÃO] Log ID ${log.id} mudou de '${log.status}' para '${newStatus}'`);
                                await new Promise((resolve) => {
                                    db.run('UPDATE dispatch_logs SET status = ? WHERE id = ?', [newStatus, log.id], function() {
                                        updatedCount++;
                                        updatedLogs.push({ id: log.id, status: newStatus });
                                        resolve();
                                    });
                                });
                            } else {
                                console.log(`   -> [MANTIDO] Log ID ${log.id} continua '${newStatus}'`);
                            }
                        } catch (e) {
                            console.error(`[STATUS CHECK] Erro ao checar log ${log.id}:`, e.message);
                            if (e.response && e.response.data) {
                                console.error(`   -> [DETALHES DO ERRO API] ${JSON.stringify(e.response.data)}`);
                            }
                        }
                    } else {
                        console.log(`[STATUS CHECK] Log ID ${log.id} não possui dados completos de integração (enqueued_id, queue_id, apiKey). Pulando...`);
                    }
                }
                
                console.log(`[STATUS CHECK] Finalizado. ${updatedCount} logs atualizados no banco.`);
                res.json({ updated: updatedCount, logs: updatedLogs });
            });
        });
    } catch (error) {
        console.error(`[STATUS CHECK] Erro fatal: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Cancelar Mensagem Específica
app.post('/api/clients/:clientId/logs/:logId/cancel', async (req, res) => {
    db.get('SELECT * FROM dispatch_logs WHERE id = ? AND client_id = ?', [req.params.logId, req.params.clientId], async (err, log) => {
        if (err || !log) return res.status(404).json({ error: 'Log não encontrado' });
        if (!log.enqueued_id || !log.queue_id || !log.queue_api_key) return res.status(400).json({ error: 'Faltam dados de integração para cancelar' });

        db.get('SELECT atenderbem_link FROM clients WHERE id = ?', [req.params.clientId], async (err, clientRow) => {
            if (err || !clientRow) return res.status(500).json({ error: 'Cliente não encontrado' });
            
            try {
                const atenderBemOrigin = new URL(clientRow.atenderbem_link).origin;
                await axios.post(`${atenderBemOrigin}/int/cancelEnqueuedMessages`, {
                    queueId: parseInt(log.queue_id, 10),
                    apiKey: log.queue_api_key,
                    enqueuedIds: [parseInt(log.enqueued_id, 10)]
                });

                db.run('UPDATE dispatch_logs SET status = ? WHERE id = ?', ['Cancelado', log.id], function() {
                    res.json({ success: true, message: 'Mensagem cancelada com sucesso' });
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    });
});

// Cancelar Todas as Mensagens em Espera/Enviadas
app.post('/api/clients/:clientId/logs/cancel-all', async (req, res) => {
    db.all(`SELECT * FROM dispatch_logs WHERE client_id = ? AND status IN ('Em espera', 'Enviado')`, [req.params.clientId], async (err, logs) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (!logs || logs.length === 0) return res.json({ success: true, message: 'Nenhuma mensagem pendente para cancelar' });

        const idsLocais = logs.map(l => l.id);
        const placeholdersLocais = idsLocais.map(() => '?').join(',');

        // Filtrar apenas os que tem ID de enfileiramento da AtenderBem (para cancelar na API deles também)
        const logsParaCancelarNaApi = logs.filter(log => log.enqueued_id != null && log.queue_id != null);

        if (logsParaCancelarNaApi.length === 0) {
            // Cancela só localmente
            db.run(`UPDATE dispatch_logs SET status = 'Cancelado' WHERE id IN (${placeholdersLocais})`, idsLocais, function(errUpdate) {
                if (errUpdate) return res.status(500).json({ error: errUpdate.message });
                return res.json({ success: true, message: `${idsLocais.length} mensagens canceladas localmente` });
            });
            return;
        }

        db.get('SELECT atenderbem_link FROM clients WHERE id = ?', [req.params.clientId], async (err, clientRow) => {
            // Mesmo se não achar o cliente, precisamos garantir que o BD local seja limpo
            if (err || !clientRow) {
                db.run(`UPDATE dispatch_logs SET status = 'Cancelado' WHERE id IN (${placeholdersLocais})`, idsLocais);
                return res.status(500).json({ error: 'Cliente não encontrado para integração, mas logs locais foram cancelados.' });
            }
            
            try {
                const atenderBemOrigin = new URL(clientRow.atenderbem_link).origin;
                
                // Agrupar por queueId para enviar requisições separadas
                const queueGroups = {};
                logsParaCancelarNaApi.forEach(log => {
                    const key = `${log.queue_id}_${log.queue_api_key}`;
                    if (!queueGroups[key]) queueGroups[key] = { queueId: log.queue_id, apiKey: log.queue_api_key, enqueuedIds: [] };
                    queueGroups[key].enqueuedIds.push(parseInt(log.enqueued_id, 10));
                });

                for (const key in queueGroups) {
                    const group = queueGroups[key];
                    try {
                        await axios.post(`${atenderBemOrigin}/int/cancelEnqueuedMessages`, {
                            queueId: parseInt(group.queueId, 10),
                            apiKey: group.apiKey,
                            enqueuedIds: group.enqueuedIds
                        });
                    } catch (apiCancelErr) {
                        console.error(`Falha ao cancelar na API (Queue ${group.queueId}):`, apiCancelErr.message);
                        // Continua para tentar cancelar no banco mesmo assim
                    }
                }
            } catch (error) {
                console.error('Erro na url origin do atenderbem:', error.message);
            }

            // ATUALIZAÇÃO FORÇADA: Ocorra erro na API ou não, sempre vai limpar a tela atualizando o BD local.
            db.run(`UPDATE dispatch_logs SET status = 'Cancelado' WHERE id IN (${placeholdersLocais})`, idsLocais, function(errUpdate) {
                if (errUpdate) return res.status(500).json({ error: errUpdate.message });
                res.json({ success: true, message: `${idsLocais.length} mensagens canceladas` });
            });
        });
    });
});

// Teste de Disparo Real Redirecionado (para o Cliente)
app.post('/api/clients/:id/test-dispatch-real', async (req, res) => {
    try {
        const testPhone = req.body.testPhone || '5538988042960';
        const result = await processDispatch(false, null, req.params.id, testPhone);
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Lógica Central de Disparo e Simulação
async function processDispatch(isSimulation = false, ruleId = null, clientId = null, testPhoneOverride = null) {
    return new Promise((resolve, reject) => {
        let query = 'SELECT * FROM clients';
        let params = [];
        
        if (clientId) {
            query += ' WHERE id = ?';
            params.push(clientId);
        }

        db.all(query, params, async (err, clients) => {
            if (err) return reject(err);

            let processLogs = [];
            let simulationData = [];
            let simulationSteps = []; // Logs detalhados para o frontend
            let messagesSentCount = 0; // Usado para limite no teste real

            const logStep = (msg) => {
                console.log(msg);
                if (isSimulation || testPhoneOverride) simulationSteps.push(msg);
            };

            for (const client of clients) {
                const sgpUrl = client.sgp_url;
                const sgpToken = client.sgp_token;
                const sgpApp = 'cliente';

                if (!sgpUrl || !sgpToken) {
                    logStep(`[AVISO] Credenciais SGP incompletas para o cliente ${client.name}. Pulando.`);
                    continue;
                }

                const messages = await new Promise((res, rej) => {
                    let q = 'SELECT * FROM dispatch_messages WHERE client_id = ?';
                    let params = [client.id];
                    if (ruleId) {
                        q += ' AND id = ?';
                        params.push(ruleId);
                    }
                    db.all(q, params, (e, rows) => {
                        if (e) rej(e);
                        else res(rows);
                    });
                });

                if (messages.length === 0) continue;

                for (const msg of messages) {
                    const triggerType = msg.trigger_type || 'due_date';

                    if (triggerType === 'birthday') {
                        const hojeIso = new Intl.DateTimeFormat('en-CA', {
                            timeZone: 'America/Sao_Paulo',
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                        }).format(new Date());
                        const [, hojeMes, hojeDia] = hojeIso.split('-').map(n => parseInt(n, 10));
                        const days = 0;
                        const filterType = 'ANIVERSÁRIO';

                        logStep(`[${isSimulation ? 'SIMULAÇÃO' : 'DISPARO'}] Cliente: ${client.name} | Regra ID: ${msg.id} | Tipo: ${filterType} | Data Alvo: ${hojeIso}`);

                        const parseBirthDateParts = (raw) => {
                            if (!raw) return null;
                            const s = String(raw).trim();
                            const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
                            if (mIso) {
                                return { month: parseInt(mIso[2], 10), day: parseInt(mIso[3], 10) };
                            }
                            const mBr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
                            if (mBr) {
                                return { month: parseInt(mBr[2], 10), day: parseInt(mBr[1], 10) };
                            }
                            return null;
                        };

                        const extractBirthRaw = (registro) => {
                            return (
                                registro.data_nascimento ||
                                registro.dataNascimento ||
                                registro.nascimento ||
                                registro.dataNascimentoCliente ||
                                registro.data_nasc ||
                                registro.dt_nascimento ||
                                null
                            );
                        };

                        try {
                            let offset = 0;
                            const limit = 50;
                            let totalRegistrosEncontrados = 0;
                            let temMaisDados = true;

                            while (temMaisDados) {
                                const sgpPayload = {
                                    status: 'ativo',
                                    limit: limit,
                                    offset: offset
                                };

                                const endpointUrl = `${sgpUrl}/api/ura/clientes/`;
                                logStep(` -> [API] Fazendo POST para: ${endpointUrl}`);
                                logStep(` -> [PAYLOAD] ${JSON.stringify(sgpPayload)}`);

                                const sgpHeaders = {
                                    'Authorization': sgpToken,
                                    'Content-Type': 'application/json'
                                };

                                let clientesResponse;
                                try {
                                    clientesResponse = await axios.post(endpointUrl, sgpPayload, { headers: sgpHeaders });
                                    logStep(` -> [RESPOSTA] SGP respondeu com status ${clientesResponse.status}`);
                                    logStep(` -> [DADOS RETORNADOS] ${JSON.stringify(clientesResponse.data).substring(0, 500)}`);
                                } catch (apiErr) {
                                    const erroMsg = apiErr.response && apiErr.response.data ? JSON.stringify(apiErr.response.data) : '';
                                    const shouldRetryWithoutStatus = apiErr.response && apiErr.response.status === 400 && erroMsg.includes('[status]');
                                    if (shouldRetryWithoutStatus) {
                                        const retryPayload = { limit: limit, offset: offset };
                                        logStep(` -> [RETRY] Removendo filtro status (SGP retornou validação em status).`);
                                        logStep(` -> [RETRY PAYLOAD] ${JSON.stringify(retryPayload)}`);
                                        try {
                                            clientesResponse = await axios.post(endpointUrl, retryPayload, { headers: sgpHeaders });
                                            logStep(` -> [RESPOSTA] SGP respondeu com status ${clientesResponse.status}`);
                                            logStep(` -> [DADOS RETORNADOS] ${JSON.stringify(clientesResponse.data).substring(0, 500)}`);
                                        } catch (apiErr2) {
                                            logStep(` -> [ERRO] Falha ao comunicar com SGP: ${apiErr2.message}`);
                                            if (apiErr2.response && apiErr2.response.data) {
                                                logStep(` -> [DETALHES DO ERRO] ${JSON.stringify(apiErr2.response.data)}`);
                                            }
                                            break;
                                        }
                                    } else {
                                    logStep(` -> [ERRO] Falha ao comunicar com SGP: ${apiErr.message}`);
                                    if (apiErr.response && apiErr.response.data) {
                                        logStep(` -> [DETALHES DO ERRO] ${JSON.stringify(apiErr.response.data)}`);
                                    }
                                    break;
                                    }
                                }

                                let resultadosSgp = [];
                                const dataBody = clientesResponse.data;
                                let clientesArray = null;

                                if (dataBody.cliente_rawBody && Array.isArray(dataBody.cliente_rawBody.clientes)) {
                                    clientesArray = dataBody.cliente_rawBody.clientes;
                                } else if (dataBody.clientes && Array.isArray(dataBody.clientes)) {
                                    clientesArray = dataBody.clientes;
                                } else if (Array.isArray(dataBody)) {
                                    clientesArray = dataBody;
                                } else if (dataBody && Array.isArray(dataBody.results)) {
                                    clientesArray = dataBody.results;
                                }

                                if (clientesArray) {
                                    resultadosSgp = clientesArray;
                                } else if (dataBody && dataBody.error) {
                                    logStep(` -> [ERRO SGP] ${dataBody.error}`);
                                    break;
                                } else if (typeof dataBody === 'object' && dataBody !== null) {
                                    if (dataBody.id || dataBody.nome || dataBody.cliente_nome) {
                                        resultadosSgp = [dataBody];
                                    } else {
                                        logStep(` -> [AVISO] Formato de resposta não reconhecido ou vazio. Chaves: ${Object.keys(dataBody).join(', ')}`);
                                    }
                                }

                                if (resultadosSgp.length === 0) {
                                    logStep(` -> Nenhum registro encontrado nesta página (offset: ${offset}).`);
                                    temMaisDados = false;
                                    break;
                                }

                                logStep(` -> Encontrados ${resultadosSgp.length} registros (página atual).`);
                                totalRegistrosEncontrados += resultadosSgp.length;

                                for (const registro of resultadosSgp) {
                                    const nome = registro.nome || registro.cliente_nome || 'Desconhecido';
                                    const cpf = registro.cpf_cnpj || registro.cnpj_cpf || registro.cpfcnpj || registro.cpf || '';

                                    const birthRaw = extractBirthRaw(registro);
                                    const birthParts = parseBirthDateParts(birthRaw);
                                    if (!birthParts || birthParts.month !== hojeMes || birthParts.day !== hojeDia) {
                                        continue;
                                    }

                                    let isClientInactive = false;
                                    if (registro.status && registro.status.toLowerCase() !== 'ativo') {
                                        isClientInactive = true;
                                    }
                                    if (!isClientInactive && registro.contratos && Array.isArray(registro.contratos) && registro.contratos.length > 0) {
                                        const temContratoAtivo = registro.contratos.some(c => c.status && c.status.toLowerCase() === 'ativo');
                                        if (!temContratoAtivo) {
                                            isClientInactive = true;
                                        }
                                    }
                                    if (isClientInactive) {
                                        logStep(`   -> Ignorado: Cliente ${nome} inativo (Status SGP não é Ativo).`);
                                        if (isSimulation) {
                                            simulationData.push({
                                                clientName: client.name,
                                                ruleDays: days,
                                                filterType: filterType,
                                                targetDate: hojeIso,
                                                customerName: nome,
                                                phone: "N/A",
                                                invoiceId: "N/A",
                                                message: "Cliente Inativo no SGP",
                                                ignored: true,
                                                ignoreReason: "Cliente Inativo"
                                            });
                                        }
                                        continue;
                                    }

                                    let telefonesDisponiveis = [];
                                    if (registro.contatos) {
                                        if (Array.isArray(registro.contatos.celulares)) {
                                            telefonesDisponiveis.push(...registro.contatos.celulares);
                                        }
                                        if (Array.isArray(registro.contatos.telefones)) {
                                            telefonesDisponiveis.push(...registro.contatos.telefones);
                                        }
                                    }
                                    ['celular', 'telefone', 'contatos_celulares'].forEach(campo => {
                                        if (registro[campo]) {
                                            const nums = registro[campo].toString().split(',');
                                            telefonesDisponiveis.push(...nums);
                                        }
                                    });
                                    telefonesDisponiveis = telefonesDisponiveis.filter(t => t && t.toString().trim() !== '');
                                    telefonesDisponiveis = [...new Set(telefonesDisponiveis)];

                                    let telefoneLimpoFinal = '';
                                    let ignoradoMotivo = null;

                                    if (telefonesDisponiveis.length === 0) {
                                        logStep(`   -> Ignorado: Cliente ${nome} sem telefone cadastrado.`);
                                        ignoradoMotivo = 'Sem telefone cadastrado';
                                    } else {
                                        let encontrouWpp = false;
                                        let ultimoMotivoInvalido = 'Nenhum número válido';

                                        for (const tel of telefonesDisponiveis) {
                                            let telLimpo = tel.toString().replace(/\D/g, '');
                                            if (telLimpo.length >= 10 && !telLimpo.startsWith('55')) {
                                                telLimpo = '55' + telLimpo;
                                            }
                                            if (telLimpo.length < 12) {
                                                ultimoMotivoInvalido = `Número ${telLimpo} é curto demais`;
                                                logStep(`   -> [AVISO] ${nome}: ${ultimoMotivoInvalido}, tentando próximo...`);
                                                continue;
                                            }

                                            try {
                                                const urlObj = new URL(client.atenderbem_link);
                                                const atenderBemOrigin = urlObj.origin;

                                                const checkPayload = {
                                                    queueId: parseInt(msg.queue_id, 10),
                                                    apiKey: msg.queue_api_key,
                                                    number: telLimpo,
                                                    country: "BR"
                                                };

                                                logStep(`   -> [AtenderBem] Checando WPP para ${telLimpo} (${nome})...`);
                                                const checkRes = await axios.post(`${atenderBemOrigin}/int/checkIfUserExists`, checkPayload);
                                                const wppData = checkRes.data;
                                                logStep(`   -> [AtenderBem Resposta] ${JSON.stringify(wppData)}`);

                                                if (wppData.exists === false || wppData.numberExists === false || wppData.hasWhatsapp === false || wppData.status === 'invalid') {
                                                    ultimoMotivoInvalido = `Número ${telLimpo} não possui WhatsApp ativo`;
                                                    logStep(`   -> [AVISO] ${nome}: ${ultimoMotivoInvalido}. Ignorando teste e forçando envio.`);
                                                } else {
                                                    logStep(`   -> [SUCESSO] WPP válido encontrado para ${nome}: ${telLimpo}`);
                                                }

                                                encontrouWpp = true;
                                                telefoneLimpoFinal = telLimpo;
                                                break;
                                            } catch (wppErr) {
                                                logStep(`   -> [AVISO] Falha ao checar WPP para ${telLimpo}: ${wppErr.message}. Assumindo válido por precaução.`);
                                                encontrouWpp = true;
                                                telefoneLimpoFinal = telLimpo;
                                                break;
                                            }
                                        }

                                        if (!encontrouWpp) {
                                            ignoradoMotivo = ultimoMotivoInvalido;
                                            logStep(`   -> Ignorado: Cliente ${nome}. Motivo final: ${ignoradoMotivo}`);
                                        } else {
                                            if (!isSimulation) {
                                                const birthdayKey = `BIRTHDAY:${cpf || registro.id || nome}`;
                                                try {
                                                    const jaEnviado = await new Promise((resCheck) => {
                                                        db.get(
                                                            `SELECT id FROM dispatch_logs 
                                                             WHERE client_id = ? 
                                                             AND invoice_id = ? 
                                                             AND status NOT IN ('Erro', 'Cancelado', 'Erro/Cancelado')
                                                             AND date(created_at) = date('now', 'localtime')`,
                                                            [client.id, birthdayKey],
                                                            (errCheck, rowCheck) => {
                                                                if (errCheck) resCheck(false);
                                                                else resCheck(!!rowCheck);
                                                            }
                                                        );
                                                    });

                                                    if (jaEnviado) {
                                                        ignoradoMotivo = 'Mensagem de aniversário já enviada hoje';
                                                        logStep(`   -> [AVISO] ${nome}: ${ignoradoMotivo}.`);
                                                    }
                                                } catch (dbErr) {
                                                    logStep(`   -> [ERRO DB] Falha ao checar duplicidade: ${dbErr.message}`);
                                                }
                                            }
                                        }
                                    }

                                    const birthdayKey = `BIRTHDAY:${cpf || registro.id || nome}`;
                                    const vencimentoFormatado = `${pad2(hojeDia)}/${pad2(hojeMes)}`;
                                    const linhaDigitavel = '';
                                    const linkBoleto = '';
                                    const pix = '';
                                    const valorStr = '';

                                    let messageText = '';
                                    const isOfficial = msg.message_type === 'official';
                                    let dataArray = [];

                                    if (isOfficial) {
                                        if (msg.template_data) {
                                            const vars = msg.template_data.split(',');
                                            dataArray = vars.map(v => {
                                                let val = v.trim();
                                                if (val === 'nome' || val === '{nome}') return nome;
                                                if (val === 'cpf' || val === '{cpf}') return cpf;
                                                if (val === 'vencimento' || val === '{vencimento}' || val === 'data' || val === '{data}') return vencimentoFormatado;
                                                if (val === 'linha_digitavel' || val === '{linha_digitavel}') return linhaDigitavel;
                                                if (val === 'link_boleto' || val === '{link_boleto}' || val === 'link' || val === '{link}') return linkBoleto;
                                                if (val === 'valor' || val === '{valor}') return valorStr;
                                                if (val === 'pix' || val === '{pix}') return pix;
                                                return val
                                                    .replace(/{nome}/g, nome)
                                                    .replace(/{cpf}/g, cpf)
                                                    .replace(/{vencimento}/g, vencimentoFormatado)
                                                    .replace(/{data}/g, vencimentoFormatado)
                                                    .replace(/{linha_digitavel}/g, linhaDigitavel)
                                                    .replace(/{link_boleto}/g, linkBoleto)
                                                    .replace(/{link}/g, linkBoleto)
                                                    .replace(/{valor}/g, valorStr)
                                                    .replace(/{pix}/g, pix);
                                            });
                                        }
                                        messageText = `Template ID: ${msg.template_id} - Parâmetros: ${dataArray.join(', ')}`;
                                    } else {
                                        messageText = (msg.message_template || '')
                                            .replace(/{nome}/g, nome)
                                            .replace(/{cpf}/g, cpf)
                                            .replace(/{vencimento}/g, vencimentoFormatado)
                                            .replace(/{linha_digitavel}/g, linhaDigitavel)
                                            .replace(/{link_boleto}/g, linkBoleto)
                                            .replace(/{valor}/g, valorStr)
                                            .replace(/{pix}/g, pix);
                                    }

                                    if (isSimulation) {
                                        simulationData.push({
                                            clientName: client.name,
                                            ruleDays: days,
                                            filterType: filterType,
                                            targetDate: hojeIso,
                                            customerName: nome,
                                            phone: telefoneLimpoFinal,
                                            invoiceId: birthdayKey,
                                            message: messageText,
                                            ignored: ignoradoMotivo !== null,
                                            ignoreReason: ignoradoMotivo
                                        });
                                    } else {
                                        if (!ignoradoMotivo) {
                                            if (testPhoneOverride && messagesSentCount >= 3) {
                                                logStep(`   -> [TESTE] Limite de 3 mensagens atingido para este cliente. Interrompendo envio real.`);
                                                break;
                                            }
                                            let currentPayload = null;
                                            try {
                                                const finalPhone = testPhoneOverride ? testPhoneOverride : telefoneLimpoFinal;
                                                const baseAtenderBemUrl = client.atenderbem_link.endsWith('/') ? client.atenderbem_link.slice(0, -1) : client.atenderbem_link;
                                                let apiUrl = '';

                                                const shouldOpenNewChat = (msg.open_new_chat !== undefined && msg.open_new_chat !== null) ? (msg.open_new_chat == 1) : true;

                                                if (isOfficial) {
                                                    apiUrl = `${baseAtenderBemUrl}/int/sendWaTemplate`;
                                                    currentPayload = {
                                                        queueId: parseInt(msg.queue_id, 10),
                                                        apiKey: msg.queue_api_key,
                                                        number: finalPhone,
                                                        templateId: parseInt(msg.template_id, 10),
                                                        data: dataArray,
                                                        cancelIfAlreadyOpen: false,
                                                        openNewChat: shouldOpenNewChat
                                                    };
                                                } else {
                                                    apiUrl = `${baseAtenderBemUrl}/int/enqueueMessageToSend`;
                                                    currentPayload = {
                                                        queueId: parseInt(msg.queue_id, 10),
                                                        apiKey: msg.queue_api_key,
                                                        number: finalPhone,
                                                        text: messageText,
                                                        campaignName: `SGP - ${filterType}${testPhoneOverride ? ' (TESTE)' : ''}`,
                                                        extData: "SGP",
                                                        extFlag: 0,
                                                        hidden: false,
                                                        openNewChat: shouldOpenNewChat
                                                    };
                                                }

                                                logStep(`   -> [API DISPARO] Enviando POST para: ${apiUrl}`);
                                                logStep(`   -> [PAYLOAD] ${JSON.stringify(currentPayload)}`);

                                                const response = await axios.post(apiUrl, currentPayload, {
                                                    headers: {
                                                        'Accept': 'application/json',
                                                        'Content-Type': 'application/json'
                                                    }
                                                });

                                                logStep(`   -> [RESPOSTA DISPARO] Status ${response.status} | Data: ${JSON.stringify(response.data)}`);
                                                const enqueuedId = response.data ? response.data.enqueuedId : null;

                                                processLogs.push(`Enviado: ${client.name} - ${finalPhone} - Cliente: ${nome}`);

                                                db.run(
                                                    'INSERT INTO dispatch_logs (client_id, phone_number, invoice_id, message_sent, status, enqueued_id, queue_id, queue_api_key, api_request_log, api_response_log) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                                                    [client.id, finalPhone, birthdayKey, messageText, 'Enviado', enqueuedId, msg.queue_id, msg.queue_api_key, JSON.stringify(currentPayload), JSON.stringify(response.data)]
                                                );

                                                if (testPhoneOverride) {
                                                    messagesSentCount++;
                                                }
                                            } catch (errAtb) {
                                                console.error(`Erro ao enviar para AtenderBem (Cliente ${nome}):`, errAtb.message);
                                                const errorResponse = errAtb.response ? JSON.stringify(errAtb.response.data) : errAtb.message;
                                                db.run(
                                                    'INSERT INTO dispatch_logs (client_id, phone_number, invoice_id, message_sent, status, api_request_log, api_response_log) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                                    [client.id, testPhoneOverride ? testPhoneOverride : telefoneLimpoFinal, birthdayKey, messageText, 'Erro: ' + errAtb.message, currentPayload ? JSON.stringify(currentPayload) : JSON.stringify({}), errorResponse]
                                                );
                                            }
                                        }
                                    }
                                }

                                if (testPhoneOverride && messagesSentCount >= 3) {
                                    logStep(`   -> [TESTE] Interrompendo paginação do SGP para o cliente.`);
                                    temMaisDados = false;
                                    break;
                                }

                                if (resultadosSgp.length < limit) {
                                    temMaisDados = false;
                                } else {
                                    offset += limit;
                                }
                            }

                            logStep(` -> Total de ${totalRegistrosEncontrados} registros processados para a regra ${msg.id}.`);
                        } catch (errSgp) {
                            logStep(` -> [ERRO] Erro interno ao buscar dados no SGP: ${errSgp.message}`);
                        }

                        if (testPhoneOverride && messagesSentCount >= 3) {
                            logStep(`[TESTE] Fim do teste para o cliente (limite atingido).`);
                            break;
                        }

                        continue;
                    }

                    const days = msg.days_from_due;
                    let filterType = '';
                    
                    if (days < 0) {
                        filterType = 'A VENCER';
                    } else if (days === 0) {
                        filterType = 'VENCENDO HOJE';
                    } else {
                        filterType = 'VENCIDAS';
                    }

                    const calcDate = new Date();
                    calcDate.setDate(calcDate.getDate() - days);
                    const targetDate = calcDate.toISOString().split('T')[0];

                    logStep(`[${isSimulation ? 'SIMULAÇÃO' : 'DISPARO'}] Cliente: ${client.name} | Regra ID: ${msg.id} | Dias: ${days} (${filterType}) | Data Alvo: ${targetDate}`);
                    
                    try {
                        let offset = 0;
                        const limit = 50;
                        let totalRegistrosEncontrados = 0;
                        let temMaisDados = true;

                        while (temMaisDados) {
                            const sgpPayload = {
                                data_vencimento_inicio: targetDate,
                                data_vencimento_fim: targetDate,
                                status: 'aberto',
                                limit: limit,
                                offset: offset
                            };
                            
                            const endpointUrl = `${sgpUrl}/api/ura/clientes/`;
                            logStep(` -> [API] Fazendo POST para: ${endpointUrl}`);
                            logStep(` -> [PAYLOAD] ${JSON.stringify(sgpPayload)}`);

                            const sgpHeaders = {
                                'Authorization': sgpToken,
                                'Content-Type': 'application/json'
                            };
                            logStep(` -> [HEADERS] ${JSON.stringify(sgpHeaders)}`);

                            let clientesResponse;
                            try {
                                clientesResponse = await axios.post(endpointUrl, sgpPayload, { headers: sgpHeaders });
                                logStep(` -> [RESPOSTA] SGP respondeu com status ${clientesResponse.status}`);
                                logStep(` -> [DADOS RETORNADOS] ${JSON.stringify(clientesResponse.data).substring(0, 500)}`);
                            } catch (apiErr) {
                                logStep(` -> [ERRO] Falha ao comunicar com SGP: ${apiErr.message}`);
                                if (apiErr.response && apiErr.response.data) {
                                    logStep(` -> [DETALHES DO ERRO] ${JSON.stringify(apiErr.response.data)}`);
                                }
                                break;
                            }

                            let resultadosSgp = [];
                            let totalResponse = 0;

                            // Com base no JSON enviado: clientesResponse.data.cliente_rawBody.clientes
                            const dataBody = clientesResponse.data;
                            let clientesArray = null;

                            if (dataBody.cliente_rawBody && Array.isArray(dataBody.cliente_rawBody.clientes)) {
                                clientesArray = dataBody.cliente_rawBody.clientes;
                                totalResponse = dataBody.cliente_rawBody.paginacao ? dataBody.cliente_rawBody.paginacao.total : 0;
                            } else if (dataBody.clientes && Array.isArray(dataBody.clientes)) {
                                clientesArray = dataBody.clientes;
                                totalResponse = dataBody.paginacao ? dataBody.paginacao.total : 0;
                            } else if (Array.isArray(dataBody)) {
                                clientesArray = dataBody;
                            } else if (dataBody && Array.isArray(dataBody.results)) {
                                clientesArray = dataBody.results;
                            }

                            if (clientesArray) {
                                resultadosSgp = clientesArray;
                            } else if (dataBody && dataBody.error) {
                                logStep(` -> [ERRO SGP] ${dataBody.error}`);
                                break;
                            } else if (typeof dataBody === 'object' && dataBody !== null) {
                                if (dataBody.id || dataBody.nome || dataBody.cliente_nome) {
                                    resultadosSgp = [dataBody];
                                } else {
                                    logStep(` -> [AVISO] Formato de resposta não reconhecido ou vazio. Chaves: ${Object.keys(dataBody).join(', ')}`);
                                }
                            }

                            if (resultadosSgp.length === 0) {
                                logStep(` -> Nenhum registro encontrado nesta página (offset: ${offset}).`);
                                temMaisDados = false;
                                break;
                            }

                            logStep(` -> Encontrados ${resultadosSgp.length} registros (página atual).`);
                            totalRegistrosEncontrados += resultadosSgp.length;

                            for (const registro of resultadosSgp) {
                                const nome = registro.nome || registro.cliente_nome || 'Desconhecido';
                                const cpf = registro.cpf_cnpj || registro.cnpj_cpf || registro.cpfcnpj || registro.cpf || '';
                                
                                // Regra: Não fazer disparos para clientes inativos
                                let isClientInactive = false;
                                
                                // Checa status direto no registro
                                if (registro.status && registro.status.toLowerCase() !== 'ativo') {
                                    isClientInactive = true;
                                }
                                
                                // Checa status dentro dos contratos (se houver)
                                if (!isClientInactive && registro.contratos && Array.isArray(registro.contratos) && registro.contratos.length > 0) {
                                    const temContratoAtivo = registro.contratos.some(c => c.status && c.status.toLowerCase() === 'ativo');
                                    if (!temContratoAtivo) {
                                        isClientInactive = true;
                                    }
                                }

                                if (isClientInactive) {
                                    logStep(`   -> Ignorado: Cliente ${nome} inativo (Status SGP não é Ativo).`);
                                    if (isSimulation) {
                                        simulationData.push({
                                            clientName: client.name,
                                            ruleDays: days,
                                            filterType: filterType,
                                            targetDate: targetDate,
                                            customerName: nome,
                                            phone: "N/A",
                                            invoiceId: "N/A",
                                            message: "Cliente Inativo no SGP",
                                            ignored: true,
                                            ignoreReason: "Cliente Inativo"
                                        });
                                    }
                                    continue;
                                }

                                // Extrair dados do título (boleto) IMEDIATAMENTE para evitar problemas de escopo (hoisting/temporal dead zone)
                                var tituloObj = null;
                                if (Array.isArray(registro.titulos) && registro.titulos.length > 0) {
                                    tituloObj = registro.titulos[0];
                                } else if (registro.titulos && typeof registro.titulos === 'object' && registro.titulos.id) {
                                    tituloObj = registro.titulos; // Fallback
                                } else if (registro.contratos && Array.isArray(registro.contratos) && registro.contratos.length > 0) {
                                    for (const contrato of registro.contratos) {
                                        if (Array.isArray(contrato.titulos) && contrato.titulos.length > 0) {
                                            tituloObj = contrato.titulos[0];
                                            break;
                                        }
                                    }
                                }

                                var tituloId = tituloObj ? tituloObj.id : (registro.id || 'N/A');
                                
                                // Coletar todos os telefones possíveis do cliente em um array
                                let telefonesDisponiveis = [];
                                
                                if (registro.contatos) {
                                    if (Array.isArray(registro.contatos.celulares)) {
                                        telefonesDisponiveis.push(...registro.contatos.celulares);
                                    }
                                    if (Array.isArray(registro.contatos.telefones)) {
                                        telefonesDisponiveis.push(...registro.contatos.telefones);
                                    }
                                }
                                
                                // Fallback para a raiz do objeto
                                ['celular', 'telefone', 'contatos_celulares'].forEach(campo => {
                                    if (registro[campo]) {
                                        const nums = registro[campo].toString().split(',');
                                        telefonesDisponiveis.push(...nums);
                                    }
                                });

                                // Remover vazios e duplicados (limpando para comparar)
                                telefonesDisponiveis = telefonesDisponiveis.filter(t => t && t.toString().trim() !== '');
                                telefonesDisponiveis = [...new Set(telefonesDisponiveis)];

                                let telefoneLimpoFinal = '';
                                let ignoradoMotivo = null;

                                if (telefonesDisponiveis.length === 0) {
                                    logStep(`   -> Ignorado: Cliente ${nome} sem telefone cadastrado.`);
                                    ignoradoMotivo = 'Sem telefone cadastrado';
                                } else {
                                    let encontrouWpp = false;
                                    let ultimoMotivoInvalido = 'Nenhum número válido';

                                    for (const tel of telefonesDisponiveis) {
                                        let telLimpo = tel.toString().replace(/\D/g, '');
                                        
                                        // Formatar para o padrão que a maioria das APIs de WhatsApp aceita (ex: 55 + DDD + Numero)
                                        if (telLimpo.length >= 10 && !telLimpo.startsWith('55')) {
                                            telLimpo = '55' + telLimpo;
                                        }
                                        
                                        if (telLimpo.length < 12) { // Ex: 551199999999
                                            ultimoMotivoInvalido = `Número ${telLimpo} é curto demais`;
                                            logStep(`   -> [AVISO] ${nome}: ${ultimoMotivoInvalido}, tentando próximo...`);
                                            continue; // Tenta o próximo número
                                        }
                                        
                                        // Checar se o número tem WhatsApp na AtenderBem
                                        try {
                                            const urlObj = new URL(client.atenderbem_link);
                                            const atenderBemOrigin = urlObj.origin;
                                            
                                            const checkPayload = {
                                                queueId: parseInt(msg.queue_id, 10),
                                                apiKey: msg.queue_api_key,
                                                number: telLimpo,
                                                country: "BR"
                                            };
                                            
                                            logStep(`   -> [AtenderBem] Checando WPP para ${telLimpo} (${nome})...`);
                                            const checkRes = await axios.post(`${atenderBemOrigin}/int/checkIfUserExists`, checkPayload);
                                            
                                            const wppData = checkRes.data;
                                            logStep(`   -> [AtenderBem Resposta] ${JSON.stringify(wppData)}`);
                                            
                                            if (wppData.exists === false || wppData.numberExists === false || wppData.hasWhatsapp === false || wppData.status === 'invalid') {
                                                ultimoMotivoInvalido = `Número ${telLimpo} não possui WhatsApp ativo`;
                                                logStep(`   -> [AVISO] ${nome}: ${ultimoMotivoInvalido}. Ignorando teste e forçando envio.`);
                                            } else {
                                                logStep(`   -> [SUCESSO] WPP válido encontrado para ${nome}: ${telLimpo}`);
                                            }
                                            
                                            // Assume como válido independentemente do resultado
                                            encontrouWpp = true;
                                            telefoneLimpoFinal = telLimpo;
                                            break; // Sai do loop de verificação de telefones
                                        } catch (wppErr) {
                                            logStep(`   -> [AVISO] Falha ao checar WPP para ${telLimpo}: ${wppErr.message}. Assumindo válido por precaução.`);
                                            encontrouWpp = true;
                                            telefoneLimpoFinal = telLimpo;
                                            break; // Sai do loop e assume este como válido
                                        }
                                    }

                                    if (!encontrouWpp) {
                                        ignoradoMotivo = ultimoMotivoInvalido;
                                        logStep(`   -> Ignorado: Cliente ${nome}. Motivo final: ${ignoradoMotivo}`);
                                    } else {
                                        // VERIFICAÇÃO DE DUPLICIDADE (Apenas se encontrou um telefone válido)
                                        if (!isSimulation) {
                                            try {
                                                const jaEnviado = await new Promise((resCheck, rejCheck) => {
                                                    db.get(
                                                        `SELECT id FROM dispatch_logs 
                                                         WHERE client_id = ? 
                                                         AND invoice_id = ? 
                                                         AND status NOT IN ('Erro', 'Cancelado', 'Erro/Cancelado')
                                                         AND date(created_at) = date('now', 'localtime')`, 
                                                        [client.id, tituloId], 
                                                        (errCheck, rowCheck) => {
                                                            if (errCheck) resCheck(false);
                                                            else resCheck(!!rowCheck);
                                                        }
                                                    );
                                                });

                                                if (jaEnviado) {
                                                    ignoradoMotivo = 'Mensagem já enviada para este título hoje';
                                                    logStep(`   -> [AVISO] ${nome}: Mensagem já enviada para a fatura #${tituloId} hoje. Pulo de segurança.`);
                                                }
                                            } catch (dbErr) {
                                                logStep(`   -> [ERRO DB] Falha ao checar duplicidade: ${dbErr.message}`);
                                            }
                                        }
                                    }
                                }

                                const rawDate = tituloObj ? (tituloObj.dataVencimento || tituloObj.data_vencimento || tituloObj.vencimento) : null;
                                let vencimentoFormatado = targetDate.split('-').reverse().join('/');
                                if (rawDate && typeof rawDate === 'string' && rawDate.includes('-')) {
                                    vencimentoFormatado = rawDate.split('-').reverse().join('/');
                                }
                                
                                const linhaDigitavel = tituloObj ? (tituloObj.linhaDigitavel || tituloObj.codigoBarras || '') : '';
                                const linkBoleto = tituloObj ? (tituloObj.link || '') : '';
                                const pix = tituloObj ? (tituloObj.codigoPix || '') : '';
                                
                                let valorStr = '';
                                const valorNum = tituloObj ? Number(tituloObj.valor || 0) : 0;
                                if (valorNum > 0) {
                                    valorStr = valorNum.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
                                }

                                let messageText = '';
                                let isOfficial = msg.message_type === 'official';
                                let dataArray = [];

                                if (isOfficial) {
                                    if (msg.template_data) {
                                        const vars = msg.template_data.split(',');
                                        dataArray = vars.map(v => {
                                            let val = v.trim();
                                            // Permite variáveis com ou sem chaves e variações de nome
                                            if (val === 'nome' || val === '{nome}') return nome;
                                            if (val === 'cpf' || val === '{cpf}') return cpf;
                                            if (val === 'vencimento' || val === '{vencimento}' || val === 'data' || val === '{data}') return vencimentoFormatado;
                                            if (val === 'linha_digitavel' || val === '{linha_digitavel}') return linhaDigitavel;
                                            if (val === 'link_boleto' || val === '{link_boleto}' || val === 'link' || val === '{link}') return linkBoleto;
                                            if (val === 'valor' || val === '{valor}') return valorStr;
                                            if (val === 'pix' || val === '{pix}') return pix;
                                            
                                            // Fallback para textos mistos
                                            return val
                                                .replace(/{nome}/g, nome)
                                                .replace(/{cpf}/g, cpf)
                                                .replace(/{vencimento}/g, vencimentoFormatado)
                                                .replace(/{data}/g, vencimentoFormatado)
                                                .replace(/{linha_digitavel}/g, linhaDigitavel)
                                                .replace(/{link_boleto}/g, linkBoleto)
                                                .replace(/{link}/g, linkBoleto)
                                                .replace(/{valor}/g, valorStr)
                                                .replace(/{pix}/g, pix);
                                        });
                                    }
                                    messageText = `Template ID: ${msg.template_id} - Parâmetros: ${dataArray.join(', ')}`;
                                } else {
                                    messageText = (msg.message_template || '')
                                        .replace(/{nome}/g, nome)
                                        .replace(/{cpf}/g, cpf)
                                        .replace(/{vencimento}/g, vencimentoFormatado)
                                        .replace(/{linha_digitavel}/g, linhaDigitavel)
                                        .replace(/{link_boleto}/g, linkBoleto)
                                        .replace(/{valor}/g, valorStr)
                                        .replace(/{pix}/g, pix);
                                }

                                if (isSimulation) {
                                    simulationData.push({
                                        clientName: client.name,
                                        ruleDays: days,
                                        filterType: filterType,
                                        targetDate: targetDate,
                                        customerName: nome,
                                        phone: telefoneLimpoFinal,
                                        invoiceId: tituloId,
                                        message: messageText,
                                        ignored: ignoradoMotivo !== null,
                                        ignoreReason: ignoradoMotivo
                                    });
                                } else {
                                    // Disparo Real - Apenas se não for ignorado
                                    if (!ignoradoMotivo) {
                                        if (testPhoneOverride && messagesSentCount >= 3) {
                                            logStep(`   -> [TESTE] Limite de 3 mensagens atingido para este cliente. Interrompendo envio real.`);
                                            break;
                                        }
                                        let currentPayload = null;
                                        try {
                                            const finalPhone = testPhoneOverride ? testPhoneOverride : telefoneLimpoFinal;
                                            
                                            // Remover barra extra no final da URL se houver
                                            const baseAtenderBemUrl = client.atenderbem_link.endsWith('/') ? client.atenderbem_link.slice(0, -1) : client.atenderbem_link;
                                            let apiUrl = '';
                                            
                                            // Se for nulo ou undefined, assume true (1). Se for 0, false.
                                            const shouldOpenNewChat = (msg.open_new_chat !== undefined && msg.open_new_chat !== null) ? (msg.open_new_chat == 1) : true;

                                            if (isOfficial) {
                                                apiUrl = `${baseAtenderBemUrl}/int/sendWaTemplate`;
                                                currentPayload = {
                                                    queueId: parseInt(msg.queue_id, 10),
                                                    apiKey: msg.queue_api_key,
                                                    number: finalPhone,
                                                    templateId: parseInt(msg.template_id, 10),
                                                    data: dataArray,
                                                    cancelIfAlreadyOpen: false,
                                                    openNewChat: shouldOpenNewChat
                                                };
                                            } else {
                                                apiUrl = `${baseAtenderBemUrl}/int/enqueueMessageToSend`;
                                                currentPayload = {
                                                    queueId: parseInt(msg.queue_id, 10),
                                                    apiKey: msg.queue_api_key,
                                                    number: finalPhone,
                                                    text: messageText,
                                                    campaignName: `SGP - ${filterType} (${days} dias)${testPhoneOverride ? ' (TESTE)' : ''}`,
                                                    extData: "SGP",
                                                    extFlag: 0,
                                                    hidden: false,
                                                    openNewChat: shouldOpenNewChat
                                                };
                                            }
                                            
                                            logStep(`   -> [API DISPARO] Enviando POST para: ${apiUrl}`);
                                            logStep(`   -> [PAYLOAD] ${JSON.stringify(currentPayload)}`);

                                            const response = await axios.post(apiUrl, currentPayload, {
                                                headers: {
                                                    'Accept': 'application/json',
                                                    'Content-Type': 'application/json'
                                                }
                                            });
                                            
                                            logStep(`   -> [RESPOSTA DISPARO] Status ${response.status} | Data: ${JSON.stringify(response.data)}`);
                                            const enqueuedId = response.data ? response.data.enqueuedId : null;

                                            processLogs.push(`Enviado: ${client.name} - ${finalPhone} - Cliente: ${nome}`);
                                            
                                            db.run('INSERT INTO dispatch_logs (client_id, phone_number, invoice_id, message_sent, status, enqueued_id, queue_id, queue_api_key, api_request_log, api_response_log) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                                                [client.id, finalPhone, tituloId, messageText, 'Enviado', enqueuedId, msg.queue_id, msg.queue_api_key, JSON.stringify(currentPayload), JSON.stringify(response.data)]
                                            );
                                            
                                            if (testPhoneOverride) {
                                                messagesSentCount++;
                                            }
                                        } catch (errAtb) {
                                            console.error(`Erro ao enviar para AtenderBem (Cliente ${nome}):`, errAtb.message);
                                            
                                            const errorResponse = errAtb.response ? JSON.stringify(errAtb.response.data) : errAtb.message;
                                            db.run('INSERT INTO dispatch_logs (client_id, phone_number, invoice_id, message_sent, status, api_request_log, api_response_log) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                                [client.id, testPhoneOverride ? testPhoneOverride : telefoneLimpoFinal, tituloId, messageText, 'Erro: ' + errAtb.message, currentPayload ? JSON.stringify(currentPayload) : JSON.stringify({}), errorResponse]
                                            );
                                        }
                                    }
                                }
                            } // FECHAMENTO DO LOOP DOS REGISTROS AQUI

                            if (testPhoneOverride && messagesSentCount >= 3) {
                                logStep(`   -> [TESTE] Interrompendo paginação do SGP para o cliente.`);
                                temMaisDados = false;
                                break;
                            }

                            if (resultadosSgp.length < limit) {
                                temMaisDados = false;
                            } else {
                                offset += limit;
                            }
                        }
                        
                        logStep(` -> Total de ${totalRegistrosEncontrados} registros processados para a regra ${msg.id}.`);

                    } catch (errSgp) {
                        logStep(` -> [ERRO] Erro interno ao buscar dados no SGP: ${errSgp.message}`);
                    }
                    
                    if (testPhoneOverride && messagesSentCount >= 3) {
                        logStep(`[TESTE] Fim do teste para o cliente (limite atingido).`);
                        break; // Break the messages loop
                    }
                }
            }

            resolve({
                message: isSimulation ? 'Simulação concluída.' : 'Processo de disparo finalizado.',
                logs: processLogs,
                simulationData: simulationData,
                simulationSteps: simulationSteps
            });
        });
    });
}

// Endpoint de Disparo Real (Manual)
app.post('/api/dispatch/run', async (req, res) => {
    try {
        const { ruleId, clientId } = req.body;
        const result = await processDispatch(false, ruleId, clientId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint de Simulação
app.post('/api/dispatch/simulate', async (req, res) => {
    try {
        const { ruleId, clientId } = req.body;
        const result = await processDispatch(true, ruleId, clientId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Lógica do Cancelamento em Massa (18h)
async function processMassCancellation() {
    return new Promise((resolve, reject) => {
        // Selecionar logs de hoje que possuem enqueued_id e que ainda não foram cancelados
        db.all(`
            SELECT d.*, c.atenderbem_link 
            FROM dispatch_logs d
            JOIN clients c ON d.client_id = c.id
            WHERE date(d.created_at) = date('now')
            AND d.enqueued_id IS NOT NULL
            AND d.status != 'Cancelado'
        `, [], async (err, logs) => {
            if (err) return reject(err);
            if (!logs || logs.length === 0) {
                console.log('[CANCELAMENTO MASSA] Nenhum envio hoje para cancelar.');
                return resolve({ message: 'Nenhum envio pendente hoje.' });
            }

            // Agrupar por client_id, queue_id, queue_api_key
            const groups = {};
            for (const log of logs) {
                const key = `${log.client_id}_${log.queue_id}_${log.queue_api_key}`;
                if (!groups[key]) {
                    groups[key] = {
                        clientId: log.client_id,
                        atenderbemLink: log.atenderbem_link,
                        queueId: log.queue_id,
                        apiKey: log.queue_api_key,
                        enqueuedIds: [],
                        logIds: []
                    };
                }
                groups[key].enqueuedIds.push(parseInt(log.enqueued_id, 10));
                groups[key].logIds.push(log.id);
            }

            let totalCancelados = 0;

            for (const key in groups) {
                const group = groups[key];
                const baseAtenderBemUrl = group.atenderbemLink.endsWith('/') ? group.atenderbemLink.slice(0, -1) : group.atenderbemLink;
                const cancelUrl = `${baseAtenderBemUrl}/int/cancelEnqueuedMessages`;

                // Dividir em blocos de 50
                const chunkSize = 50;
                for (let i = 0; i < group.enqueuedIds.length; i += chunkSize) {
                    const chunkEnqueuedIds = group.enqueuedIds.slice(i, i + chunkSize);
                    const chunkLogIds = group.logIds.slice(i, i + chunkSize);

                    const payload = {
                        queueId: parseInt(group.queueId, 10),
                        apiKey: group.apiKey,
                        enqueuedIds: chunkEnqueuedIds
                    };

                    try {
                        console.log(`[CANCELAMENTO MASSA] Cliente ${group.clientId}, Fila ${group.queueId} - Cancelando ${chunkEnqueuedIds.length} mensagens...`);
                        await axios.post(cancelUrl, payload);
                        
                        // Atualizar status no banco localmente (Sucesso)
                        const placeholders = chunkLogIds.map(() => '?').join(',');
                        await new Promise((resUpdate) => {
                            db.run(`UPDATE dispatch_logs SET status = 'Cancelado' WHERE id IN (${placeholders})`, chunkLogIds, () => {
                                totalCancelados += chunkLogIds.length;
                                resUpdate();
                            });
                        });
                        console.log(`[CANCELAMENTO MASSA] Sucesso no bloco.`);
                    } catch (errApi) {
                        console.error(`[CANCELAMENTO MASSA] Erro na API para cliente ${group.clientId}:`, errApi.message);
                        // Mesmo com erro, atualiza localmente para não tentar cancelar de novo amanhã
                        const placeholders = chunkLogIds.map(() => '?').join(',');
                        await new Promise((resUpdate) => {
                            db.run(`UPDATE dispatch_logs SET status = 'Cancelado' WHERE id IN (${placeholders})`, chunkLogIds, () => {
                                totalCancelados += chunkLogIds.length;
                                resUpdate();
                            });
                        });
                    }
                }
            }
            resolve({ message: `Cancelamento concluído. ${totalCancelados} mensagens canceladas.` });
        });
    });
}

// Endpoint manual para testar o cancelamento em massa
app.post('/api/dispatch/test-mass-cancel', async (req, res) => {
    try {
        const result = await processMassCancellation();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

function pad2(n) {
    return String(n).padStart(2, '0');
}

function getLocalDateKey(now) {
    const y = now.getFullYear();
    const m = pad2(now.getMonth() + 1);
    const d = pad2(now.getDate());
    return `${y}-${m}-${d}`;
}

function parseDispatchDays(value) {
    if (!value || typeof value !== 'string') return null;
    const days = value
        .split(',')
        .map(s => parseInt(s.trim(), 10))
        .filter(n => Number.isInteger(n) && n >= 0 && n <= 6);
    return days.length > 0 ? days : null;
}

function shouldRunForClientNow(client, now) {
    const allowedDays = parseDispatchDays(client.dispatch_days);
    if (allowedDays && !allowedDays.includes(now.getDay())) return false;
    const currentTime = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    const startTime = (client.dispatch_start_time && String(client.dispatch_start_time).trim()) ? String(client.dispatch_start_time).trim() : '08:00';
    return currentTime === startTime;
}

function tryRegisterDispatchRun(clientId, runDate, runTime) {
    return new Promise((resolve) => {
        db.run(
            'INSERT OR IGNORE INTO dispatch_runs (client_id, run_date, run_time) VALUES (?, ?, ?)',
            [clientId, runDate, runTime],
            function(err) {
                if (err) return resolve(false);
                resolve(this.changes > 0);
            }
        );
    });
}

async function processScheduledDispatchRuns() {
    const now = new Date();
    const runDate = getLocalDateKey(now);
    const runTime = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

    return new Promise((resolve) => {
        db.all('SELECT id, name, is_active, dispatch_days, dispatch_start_time FROM clients WHERE is_active = 1', [], async (err, clients) => {
            if (err || !clients) return resolve({ ran: 0, checked: 0 });
            let ran = 0;

            for (const client of clients) {
                if (!shouldRunForClientNow(client, now)) continue;
                const registered = await tryRegisterDispatchRun(client.id, runDate, runTime);
                if (!registered) continue;

                try {
                    await processDispatch(false, null, client.id);
                    ran++;
                } catch (e) {
                    console.error(`[CRON] Erro ao disparar para o cliente ${client.name}:`, e.message);
                }
            }

            resolve({ ran, checked: clients.length });
        });
    });
}

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    
    cron.schedule('* * * * *', async () => {
        try {
            const result = await processScheduledDispatchRuns();
            if (result.ran > 0) {
                console.log(`[CRON] Disparos executados: ${result.ran} (clientes verificados: ${result.checked})`);
            }
        } catch (error) {
            console.error(`[CRON] Erro na rotina de disparos agendados:`, error.message);
        }
    }, {
        scheduled: true,
        timezone: "America/Sao_Paulo"
    });
    console.log(`Rotina de disparos agendados ativa (verificação a cada minuto, America/Sao_Paulo).`);

    // Iniciar Cron Job: Todos os dias às 18:00 (Cancelamento em massa de mensagens pendentes do dia)
    cron.schedule('0 18 * * *', async () => {
        console.log(`[CRON] Iniciando rotina de cancelamento das 18h (${new Date().toLocaleString()})`);
        try {
            await processMassCancellation();
        } catch (error) {
            console.error(`[CRON] Erro no cancelamento das 18h:`, error.message);
        }
    }, {
        scheduled: true,
        timezone: "America/Sao_Paulo"
    });
    console.log(`Rotina de cancelamento diário agendada para as 18:00 (America/Sao_Paulo).`);
});
