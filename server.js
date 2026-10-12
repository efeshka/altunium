const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const { AccessToken } = require('livekit-server-sdk');

const LIVEKIT_API_KEY = 'devkey';
const LIVEKIT_API_SECRET = 'secret';

app.get('/token', async (req, res) => {
  const name = req.query.name;
  const room = req.query.channel || 'general';

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: name,
    ttl: '2h',
  });

  token.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  res.json({ token: await token.toJwt() });
});

// Готовим запросы заранее — так быстрее и безопаснее
const insertMessage = db.prepare(`
  INSERT INTO messages (channel, name, text, created_at)
  VALUES (?, ?, ?, ?)
`);

const getHistory = db.prepare(`
  SELECT name, text, created_at
  FROM messages
  WHERE channel = ?
  ORDER BY id DESC
  LIMIT 50
`);

io.on('connection', (socket) => {
  console.log('Подключился:', socket.id);

  socket.on('join', (channel) => {
    for (const room of socket.rooms) {
      if (room !== socket.id) socket.leave(room);
    }
    socket.join(channel);

    // Отдаём последние 50 сообщений — в хронологическом порядке
    const history = getHistory.all(channel).reverse();
    socket.emit('history', history);

    console.log(`${socket.id} вошёл в #${channel}`);
  });

  socket.on('message', (data) => {
    const createdAt = Date.now();

    insertMessage.run(data.channel, data.name, data.text, createdAt);

    io.to(data.channel).emit('message', {
      name: data.name,
      text: data.text,
      created_at: createdAt,
    });
  });

  socket.on('disconnect', () => {
    console.log('Отключился:', socket.id);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Сервер: http://localhost:${PORT}`);
});