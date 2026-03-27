const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(__dirname)); // serve slides & demos
app.use(express.json());

// -- Shared message store (used by polling / SSE) --
let messages = [];
let longPollWaiters = []; // pending long-poll responses
let sseClients = []; // active SSE connections

// Broadcast a new message to long-poll waiters and SSE clients
function pushToHttpClients(msg) {
  messages.push(msg);
  longPollWaiters.forEach((res) => res.json({ messages: [msg] }));
  longPollWaiters = [];
  sseClients.forEach((res) => res.write(`data: ${JSON.stringify(msg)}\n\n`));
}

// POST /api/message — inject a message into all channels at once
app.post('/api/message', (req, res) => {
  const msg = {
    user: req.body.user || 'Anonymous',
    text: req.body.text || '',
    time: Date.now(),
  };
  pushToHttpClients(msg);
  io.emit('chat message', msg);
  res.json({ ok: true });
});

// GET /api/poll — Short Polling (returns immediately)
// ?since=<timestamp> returns only messages after that time
app.get('/api/poll', (req, res) => {
  const since =
    req.query.since !== undefined ? parseInt(req.query.since) : null;
  const filtered =
    since !== null ? messages.filter((m) => m.time > since) : messages;
  res.json({ messages: filtered });
});

// GET /api/long-poll — Long Polling (holds connection until new message or 30s timeout)
app.get('/api/long-poll', (_req, res) => {
  const timer = setTimeout(() => {
    longPollWaiters = longPollWaiters.filter((r) => r !== res);
    res.json({ messages: [] });
  }, 30000);

  res.on('close', () => {
    clearTimeout(timer);
    longPollWaiters = longPollWaiters.filter((r) => r !== res);
  });

  longPollWaiters.push(res);
});

// GET /api/sse — Server-Sent Events (persistent one-way stream)
app.get('/api/sse', (_req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  sseClients.push(res);
  _req.on('close', () => {
    sseClients = sseClients.filter((r) => r !== res);
  });
});

// GET /chat — Serve the live chat page (Slide 18)
app.get('/chat', (_req, res) => {
  res.sendFile(__dirname + '/chat.html');
});

// -- Chat user tracking --
const chatUsers = new Map(); // socketId → { nickname, room, socketId }
let registerCount = 0; // for round-robin room assignment

// -- Socket.IO — WebSocket handling --
io.on('connection', (socket) => {
  console.log(`[ws] connected: ${socket.id}`);

  // Lifecycle events
  socket.emit('welcome', { id: socket.id, time: Date.now() });

  socket.on('ping-server', () => {
    socket.emit('pong-server', { time: Date.now() });
  });

  // --- Chat user registration ---
  socket.on('register', ({ nickname }) => {
    const room = registerCount % 2 === 0 ? 'Room A' : 'Room B';
    registerCount++;
    const user = { nickname, room, socketId: socket.id };
    chatUsers.set(socket.id, user);
    socket.join(room);
    console.log(`[chat] registered: ${nickname} (${socket.id}) → ${room}`);
    socket.emit('registered', { nickname, room });
    io.emit('user list', Array.from(chatUsers.values()));
  });

  // --- Presenter message (slide 15 demo) ---
  socket.on(
    'presenter message',
    ({ mode, text, user, targetRoom, targetSocketId }) => {
      const time = Date.now();
      if (mode === 'broadcast') {
        const payload = { user: user || 'Presenter', text, time };
        io.emit('chat message', payload);
        pushToHttpClients(payload);
      } else if (mode === 'roomA' || mode === 'roomB') {
        const room = targetRoom || (mode === 'roomA' ? 'Room A' : 'Room B');
        io.to(room).emit('room message', {
          room,
          user: user || 'Presenter',
          text,
          time,
        });
      } else if (mode === 'direct') {
        const payload = {
          from: 'presenter',
          user: user || 'Presenter',
          text,
          time,
        };
        if (targetSocketId) {
          io.to(targetSocketId).emit('private message', payload);
        }
        socket.emit('private message', payload); // echo to presenter
      }
    },
  );

  socket.on('disconnect', (reason) => {
    const user = chatUsers.get(socket.id);
    if (user) {
      console.log(`[chat] unregistered: ${user.nickname} (${socket.id})`);
      chatUsers.delete(socket.id);
      io.emit('user list', Array.from(chatUsers.values()));
    }
    console.log(`[ws] disconnected: ${socket.id} (${reason})`);
  });

  // Chat messages — broadcast to everyone
  socket.on('chat message', (msg) => {
    const payload = {
      user: msg.user || 'Anonymous',
      text: msg.text,
      time: Date.now(),
    };
    io.emit('chat message', payload);
    pushToHttpClients(payload);
  });

  // Room support (Room A, Room B, etc.)
  socket.on('join room', (room) => {
    socket.join(room);
    socket.emit('room joined', { room });
    console.log(`[ws] ${socket.id} joined "${room}"`);
  });

  socket.on('leave room', (room) => {
    socket.leave(room);
    socket.emit('room left', { room });
  });

  socket.on('room message', ({ room, text, user }) => {
    io.to(room).emit('room message', {
      room,
      user: user || 'Anonymous',
      text,
      time: Date.now(),
    });
  });

  // One-to-one messaging
  socket.on('private message', ({ to, text, user }) => {
    const payload = {
      from: socket.id,
      user: user || 'Anonymous',
      text,
      time: Date.now(),
    };
    io.to(to).emit('private message', payload);
    socket.emit('private message', payload); // echo to sender
  });

  // Force-disconnect (for lifecycle demo, Slide 12)
  socket.on('force disconnect', () => {
    socket.disconnect(true);
  });
});

// -- Start server --
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
