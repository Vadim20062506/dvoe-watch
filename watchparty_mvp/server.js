const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = new Map();
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;

app.use(express.static(path.join(__dirname, "public"), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
}));

app.get("/room/:roomId", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      media: null,
      episode: { season: 1, episode: 1, title: "" },
      playback: { time: 0, playing: false, updatedAt: Date.now() },
      members: new Map(),
      lastActiveAt: Date.now()
    });
  }
  const room = rooms.get(roomId);
  room.lastActiveAt = Date.now();
  return room;
}

function touchRoom(roomId) {
  const room = rooms.get(roomId);
  if (room) room.lastActiveAt = Date.now();
}

function emitParticipants(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  const participants = [...room.members.entries()].map(([id, member]) => ({
    id,
    name: member.name,
    voiceReady: !!member.voiceReady,
    cameraReady: !!member.cameraReady
  }));

  io.to(roomId).emit("participants", participants);
}

function maybeStartCall(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  const ready = [...room.members.entries()]
    .filter(([, member]) => member.voiceReady || member.cameraReady)
    .sort((a, b) => a[1].joinedAt - b[1].joinedAt);

  if (ready.length === 2) {
    io.to(ready[0][0]).emit("start-call", { peerId: ready[1][0] });
  }
}

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, name }) => {
    roomId = String(roomId || "").toUpperCase();
    if (!roomId) return;

    const room = getRoom(roomId);

    for (const memberId of room.members.keys()) {
      if (!io.sockets.sockets.get(memberId)) {
        room.members.delete(memberId);
      }
    }

    if (room.members.size >= 2 && !room.members.has(socket.id)) {
      socket.emit("room-full");
      return;
    }

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.name = String(name || "Гость").slice(0, 30);

    room.members.set(socket.id, {
      name: socket.data.name,
      joinedAt: Date.now(),
      voiceReady: false,
      cameraReady: false
    });

    socket.emit("room-state", {
      media: room.media,
      episode: room.episode,
      playback: room.playback
    });

    emitParticipants(roomId);
    socket.to(roomId).emit("system-message", { text: `${socket.data.name} подключился` });
  });

  socket.on("set-media", (payload) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;
    room.media = payload;
    touchRoom(roomId);
    socket.to(roomId).emit("set-media", payload);
  });

  socket.on("set-episode", (payload) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;

    room.episode = {
      season: Math.max(1, Number(payload.season) || 1),
      episode: Math.max(1, Number(payload.episode) || 1),
      title: String(payload.title || "").slice(0, 80)
    };

    touchRoom(roomId);
    io.to(roomId).emit("set-episode", room.episode);
  });

  socket.on("sync", (payload) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;

    room.playback = {
      time: Math.max(0, Number(payload.time) || 0),
      playing: !!payload.playing,
      updatedAt: Date.now(),
      senderId: socket.id
    };

    touchRoom(roomId);
    socket.to(roomId).emit("sync", room.playback);
  });

  socket.on("request-sync", () => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;
    touchRoom(roomId);
    socket.emit("sync", room.playback);
  });

  socket.on("chat", ({ text }) => {
    const roomId = socket.data.roomId;
    const clean = String(text || "").trim().slice(0, 500);
    if (!roomId || !clean) return;
    touchRoom(roomId);
    io.to(roomId).emit("chat", {
      id: socket.id,
      name: socket.data.name || "Гость",
      text: clean,
      at: Date.now()
    });
  });

  socket.on("reaction", ({ emoji }) => {
    const roomId = socket.data.roomId;
    const allowed = ["❤️", "😂", "😱", "🍿", "🔥", "💖"];
    if (!roomId || !allowed.includes(emoji)) return;
    touchRoom(roomId);
    io.to(roomId).emit("reaction", {
      emoji,
      name: socket.data.name || "Гость",
      id: socket.id,
      at: Date.now()
    });
  });

  socket.on("media-ready", ({ voiceReady, cameraReady }) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;
    const member = room.members.get(socket.id);
    if (!member) return;

    member.voiceReady = !!voiceReady;
    member.cameraReady = !!cameraReady;
    touchRoom(roomId);
    emitParticipants(roomId);
    maybeStartCall(roomId);
  });

  socket.on("webrtc-offer", ({ targetId, offer }) => {
    if (targetId && offer) io.to(targetId).emit("webrtc-offer", { fromId: socket.id, offer });
  });

  socket.on("webrtc-answer", ({ targetId, answer }) => {
    if (targetId && answer) io.to(targetId).emit("webrtc-answer", { fromId: socket.id, answer });
  });

  socket.on("webrtc-ice", ({ targetId, candidate }) => {
    if (targetId && candidate) io.to(targetId).emit("webrtc-ice", { fromId: socket.id, candidate });
  });

  socket.on("webrtc-renegotiate", ({ targetId }) => {
    if (targetId) io.to(targetId).emit("webrtc-renegotiate", { fromId: socket.id });
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (room) {
      room.members.delete(socket.id);
      room.lastActiveAt = Date.now();
    }

    setTimeout(() => {
      const current = rooms.get(roomId);
      if (!current) return;
      emitParticipants(roomId);
      io.to(roomId).emit("peer-disconnected", { id: socket.id });
      if (socket.data.name) {
        io.to(roomId).emit("system-message", { text: `${socket.data.name} отключился` });
      }
    }, 100);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    if (room.members.size === 0 && now - room.lastActiveAt > ROOM_TTL_MS) {
      rooms.delete(roomId);
    }
  }
}, 10 * 60 * 1000);

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`AmorellyWatch v3.2 running on http://localhost:${port}`);
});
