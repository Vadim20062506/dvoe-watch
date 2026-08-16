const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = new Map();

app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, name }) => {
    if (!roomId) return;

    const members = io.sockets.adapter.rooms.get(roomId);
    const memberCount = members ? members.size : 0;

    if (memberCount >= 2) {
      socket.emit("room-full");
      return;
    }

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.name = (name || "Гость").slice(0, 30);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        media: null,
        playback: { time: 0, playing: false, updatedAt: Date.now() }
      });
    }

    const room = rooms.get(roomId);
    socket.emit("room-state", room);

    io.to(roomId).emit("presence", {
      count: io.sockets.adapter.rooms.get(roomId)?.size || 0
    });

    socket.to(roomId).emit("system-message", {
      text: `${socket.data.name} подключился`
    });
  });

  socket.on("set-media", (payload) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms.has(roomId)) return;

    rooms.get(roomId).media = payload;
    socket.to(roomId).emit("set-media", payload);
  });

  socket.on("sync", (payload) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms.has(roomId)) return;

    const state = {
      time: Number(payload.time) || 0,
      playing: !!payload.playing,
      updatedAt: Date.now()
    };

    rooms.get(roomId).playback = state;
    socket.to(roomId).emit("sync", state);
  });

  socket.on("chat", ({ text }) => {
    const roomId = socket.data.roomId;
    const clean = String(text || "").trim().slice(0, 500);
    if (!roomId || !clean) return;

    io.to(roomId).emit("chat", {
      id: socket.id,
      name: socket.data.name || "Гость",
      text: clean,
      at: Date.now()
    });
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    setTimeout(() => {
      const members = io.sockets.adapter.rooms.get(roomId);
      const count = members ? members.size : 0;

      io.to(roomId).emit("presence", { count });

      if (count === 0) {
        rooms.delete(roomId);
      } else {
        io.to(roomId).emit("system-message", {
          text: `${socket.data.name || "Гость"} отключился`
        });
      }
    }, 50);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`WatchParty running on http://localhost:${port}`);
});
