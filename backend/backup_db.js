const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const databasePath = path.resolve(__dirname, 'database.sqlite');
const backupDir = path.resolve(__dirname, 'backups');

function pad(value) {
  return String(value).padStart(2, '0');
}

function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hour = pad(now.getHours());
  const minute = pad(now.getMinutes());
  const second = pad(now.getSeconds());
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function escapeSqlitePath(filePath) {
  return filePath.replace(/'/g, "''");
}

if (!fs.existsSync(databasePath)) {
  console.error(`Banco não encontrado em: ${databasePath}`);
  process.exit(1);
}

fs.mkdirSync(backupDir, { recursive: true });

const outputArg = process.argv[2];
const backupPath = outputArg
  ? path.resolve(process.cwd(), outputArg)
  : path.join(backupDir, `database-${getTimestamp()}.sqlite`);

if (fs.existsSync(backupPath)) {
  console.error(`Arquivo de backup já existe: ${backupPath}`);
  process.exit(1);
}

const db = new sqlite3.Database(databasePath, sqlite3.OPEN_READONLY, (openErr) => {
  if (openErr) {
    console.error('Erro ao abrir banco para backup:', openErr.message);
    process.exit(1);
  }

  const escapedBackupPath = escapeSqlitePath(backupPath);
  db.exec(`VACUUM INTO '${escapedBackupPath}'`, (backupErr) => {
    db.close(() => {
      if (backupErr) {
        console.error('Erro ao gerar backup:', backupErr.message);
        process.exit(1);
      }

      const stats = fs.statSync(backupPath);
      console.log(`Backup criado com sucesso: ${backupPath}`);
      console.log(`Tamanho: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    });
  });
});
