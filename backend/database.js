const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados SQLite:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite.');
        db.run(`
            CREATE TABLE IF NOT EXISTS clients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                sgp_url TEXT,
                sgp_token TEXT,
                atenderbem_link TEXT,
                is_active INTEGER DEFAULT 1,
                dispatch_days TEXT DEFAULT '1,2,3,4,5',
                dispatch_start_time TEXT DEFAULT '08:00'
            )
        `);
        // Migrações e Atualizações
        db.run('ALTER TABLE clients ADD COLUMN is_active INTEGER DEFAULT 1', (err) => {});
        db.run("ALTER TABLE clients ADD COLUMN dispatch_days TEXT DEFAULT '1,2,3,4,5'", (err) => {});
        db.run("ALTER TABLE clients ADD COLUMN dispatch_start_time TEXT DEFAULT '08:00'", (err) => {});
        db.run('ALTER TABLE clients ADD COLUMN sgp_url TEXT', (err) => {});
        db.run('ALTER TABLE clients ADD COLUMN sgp_token TEXT', (err) => {});
        db.run('ALTER TABLE dispatch_messages ADD COLUMN queue_api_key TEXT', (err) => {});
        db.run('ALTER TABLE dispatch_messages ADD COLUMN message_type TEXT DEFAULT "unofficial"', (err) => {});
        db.run('ALTER TABLE dispatch_messages ADD COLUMN template_id TEXT', (err) => {});
        db.run('ALTER TABLE dispatch_messages ADD COLUMN template_data TEXT', (err) => {});
        db.run('ALTER TABLE dispatch_messages ADD COLUMN open_new_chat INTEGER DEFAULT 1', (err) => {});
        db.run("UPDATE clients SET dispatch_days = '1,2,3,4,5' WHERE dispatch_days IS NULL OR dispatch_days = ''", (err) => {});
        db.run("UPDATE clients SET dispatch_start_time = '08:00' WHERE dispatch_start_time IS NULL OR dispatch_start_time = ''", (err) => {});

        db.run(`
            CREATE TABLE IF NOT EXISTS dispatch_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id INTEGER NOT NULL,
                message_template TEXT NOT NULL,
                days_from_due INTEGER NOT NULL,
                queue_id TEXT NOT NULL,
                queue_api_key TEXT,
                FOREIGN KEY (client_id) REFERENCES clients(id)
            )
        `);
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                client_id INTEGER,
                FOREIGN KEY (client_id) REFERENCES clients(id)
            )
        `, (err) => {
            if (!err) {
                db.get("SELECT id FROM users WHERE role = 'admin' LIMIT 1", [], (err, row) => {
                    if (!row) {
                        const adminUsername = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
                        const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
                        db.run(
                            "INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, 'admin')",
                            ['Administrador', adminUsername, adminPassword],
                            (insertErr) => {
                                if (!insertErr) {
                                    console.log(`Usuário admin criado (${adminUsername}/${adminPassword}).`);
                                }
                            }
                        );
                    }
                });
            }
        });

        db.run(`
            CREATE TABLE IF NOT EXISTS dispatch_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            phone_number TEXT NOT NULL,
            invoice_id TEXT,
            message_sent TEXT,
            status TEXT NOT NULL,
            enqueued_id INTEGER,
            queue_id INTEGER,
            queue_api_key TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id)
        )
    `);

        db.run(`
            CREATE TABLE IF NOT EXISTS dispatch_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id INTEGER NOT NULL,
                run_date TEXT NOT NULL,
                run_time TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(client_id, run_date, run_time),
                FOREIGN KEY (client_id) REFERENCES clients(id)
            )
        `);

    // Adicionar colunas se não existirem
    db.all("PRAGMA table_info(dispatch_logs)", (err, columns) => {
        if (!err && columns) {
            const colNames = columns.map(c => c.name);
            if (!colNames.includes('enqueued_id')) {
                db.run("ALTER TABLE dispatch_logs ADD COLUMN enqueued_id INTEGER");
            }
            if (!colNames.includes('queue_id')) {
                db.run("ALTER TABLE dispatch_logs ADD COLUMN queue_id INTEGER");
            }
            if (!colNames.includes('queue_api_key')) {
                db.run("ALTER TABLE dispatch_logs ADD COLUMN queue_api_key TEXT");
            }
            if (!colNames.includes('api_request_log')) {
                db.run("ALTER TABLE dispatch_logs ADD COLUMN api_request_log TEXT");
            }
            if (!colNames.includes('api_response_log')) {
                db.run("ALTER TABLE dispatch_logs ADD COLUMN api_response_log TEXT");
            }
        }
    });
    }
});

module.exports = db;
