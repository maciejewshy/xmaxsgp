const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./backend/database.sqlite');

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