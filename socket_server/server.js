require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();

const PORT = process.env.SOCKET_PORT || 3001;
const SOCKET_SECRET = process.env.SOCKET_SECRET || 'socket_secret_local';

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
}));

app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', socket => {
  console.log('Cliente conectado:', socket.id);

  socket.emit('socket:connected', {
    message: 'Conectado al servidor en tiempo real',
    socket_id: socket.id,
    server_time: new Date().toISOString(),
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Socket.IO server activo',
    server_time: new Date().toISOString(),
  });
});

app.post('/emit', (req, res) => {
  const secret = req.headers['x-socket-secret'];

  if (secret !== SOCKET_SECRET) {
    return res.status(401).json({
      success: false,
      message: 'No autorizado',
    });
  }

  const { event, payload } = req.body;

  if (!event) {
    return res.status(422).json({
      success: false,
      message: 'El evento es requerido',
    });
  }

  io.emit(event, {
    ...(payload || {}),
    emitted_at: new Date().toISOString(),
  });

  console.log('Evento emitido:', event);

  return res.json({
    success: true,
    message: 'Evento emitido correctamente',
    event,
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Socket.IO server corriendo en http://0.0.0.0:${PORT}`);
});