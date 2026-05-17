const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3001;

// Keep track of the current state per room
// Each room will store: { lines: [], wallpaper: "URL", messages: [] }
const roomsData = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Join Room
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;
    console.log(`User ${socket.id} joined room: ${roomId}`);

    if (!roomsData[roomId]) {
      roomsData[roomId] = {
        lines: [],
        wallpaper: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        messages: []
      };
    }

    // Send the current room state to the user
    socket.emit('init-room', roomsData[roomId]);
  });

  // Handle a new line start (Live Drawing)
  socket.on('draw-start', (lineData) => {
    const roomId = socket.roomId;
    if (roomId && roomsData[roomId]) {
      roomsData[roomId].lines.push(lineData);
      socket.to(roomId).emit('draw-start', lineData);
    }
  });

  // Handle line updates (Live Drawing Points)
  socket.on('draw-update', (updateData) => {
    const roomId = socket.roomId;
    if (roomId && roomsData[roomId]) {
      const { id, point } = updateData;
      const line = roomsData[roomId].lines.find(l => l.id === id);
      if (line) {
        line.points.push(point);
      }
      socket.to(roomId).emit('draw-update', updateData);
    }
  });

  // Undo last line
  socket.on('undo', () => {
    const roomId = socket.roomId;
    if (roomId && roomsData[roomId] && roomsData[roomId].lines.length > 0) {
      roomsData[roomId].lines.pop();
      io.to(roomId).emit('undo-success', roomsData[roomId].lines);
    }
  });

  // Handle wallpaper change
  socket.on('change-wallpaper', (wallpaperUrl) => {
    const roomId = socket.roomId;
    if (roomId && roomsData[roomId]) {
      roomsData[roomId].wallpaper = wallpaperUrl;
      io.to(roomId).emit('wallpaper-changed', wallpaperUrl);
    }
  });

  // Handle clear canvas
  socket.on('clear', () => {
    const roomId = socket.roomId;
    if (roomId && roomsData[roomId]) {
      roomsData[roomId].lines = [];
      io.to(roomId).emit('clear');
    }
  });

  // Handle chat messages
  socket.on('chat-message', (data) => {
    const roomId = socket.roomId;
    if (roomId && roomsData[roomId]) {
      roomsData[roomId].messages.push(data);
      io.to(roomId).emit('chat-message', data);
    }
  });

  // Handle wallpaper force update
  socket.on('update-partner-wallpaper', () => {
    const roomId = socket.roomId;
    if (roomId) {
      socket.to(roomId).emit('force-wallpaper-update');
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
