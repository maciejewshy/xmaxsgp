const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run("DELETE FROM dispatch_logs", function(err) {
    if (err) {
      console.error(err.message);
    } else {
      console.log(`Tabela dispatch_logs limpa com sucesso. Registros deletados: ${this.changes}`);
    }
  });
});

db.close();