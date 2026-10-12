const Database = require('better-sqlite3');

const db = new Database('chat.db');

// Создаём таблицу, если её ещё нет
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT NOT NULL,
    name TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

// Индекс по каналу — ускорит выборку последних сообщений
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_messages_channel
  ON messages (channel, id DESC)
`);

module.exports = db;