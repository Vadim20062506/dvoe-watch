const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = new Map();

app.use(express.static(path.join(__dirname, "public")));

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      media: null,
      episode: { season: 1, episode: 1, title: "" },
      playback: { time: 0, playing: false, updatedAt: Date.now() },
      members: new Map()
    });
  }
  return rooms.get(roomId);
}

function emitParticipants(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  const participants = [...room.members.entries()].map(([id, member]) => ({
    id,
    name: member.name,
    voiceReady: !!member.voiceReady
  }));

  io.to(roomId).emit("participants", participants);
}

function maybeStartVoice(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  const ready = [...room.members.entries()]
    .filter(([, member]) => member.voiceReady)
    .sort((a, b) => a[1].joinedAt - b[1].joinedAt);

  if (ready.length === 2) {
    io.to(ready[0][0]).emit("start-call", { peerId: ready[1][0] });
  }
}

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
    socket.data.name = String(name || "Гость").slice(0, 30);

    const room = getRoom(roomId);
    room.members.set(socket.id, {
      name: socket.data.name,
      joinedAt: Date.now(),
      voiceReady: false
    });

    socket.emit("room-state", {
      media: room.media,
      episode: room.episode,
      playback: room.playback
    });

    emitParticipants(roomId);

    socket.to(roomId).emit("system-message", {
      text: `${socket.data.name} подключился`
    });
  });

  socket.on("set-name", ({ name }) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;

    const clean = String(name || "Гость").trim().slice(0, 30) || "Гость";
    socket.data.name = clean;

    const member = room.members.get(socket.id);
    if (member) member.name = clean;

    emitParticipants(roomId);
  });

  socket.on("set-media", (payload) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;

    room.media = payload;
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

    io.to(roomId).emit("set-episode", room.episode);
  });

  socket.on("sync", (payload) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;

    const state = {
      time: Math.max(0, Number(payload.time) || 0),
      playing: !!payload.playing,
      updatedAt: Date.now(),
      senderId: socket.id
    };

    room.playback = state;
    socket.to(roomId).emit("sync", state);
  });

  socket.on("request-sync", () => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;
    socket.emit("sync", room.playback);
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

  socket.on("reaction", ({ emoji }) => {
    const roomId = socket.data.roomId;
    const allowed = ["❤️", "😂", "😱", "🍿", "🔥"];
    if (!roomId || !allowed.includes(emoji)) return;

    io.to(roomId).emit("reaction", {
      emoji,
      name: socket.data.name || "Гость",
      id: socket.id,
      at: Date.now()
    });
  });

  socket.on("voice-ready", ({ ready }) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;

    const member = room.members.get(socket.id);
    if (!member) return;

    member.voiceReady = !!ready;
    emitParticipants(roomId);

    if (member.voiceReady) {
      maybeStartVoice(roomId);
    } else {
      socket.to(roomId).emit("voice-peer-left");
    }
  });

  socket.on("webrtc-offer", ({ targetId, offer }) => {
    if (targetId && offer) {
      io.to(targetId).emit("webrtc-offer", {
        fromId: socket.id,
        offer
      });
    }
  });

  socket.on("webrtc-answer", ({ targetId, answer }) => {
    if (targetId && answer) {
      io.to(targetId).emit("webrtc-answer", {
        fromId: socket.id,
        answer
      });
    }
  });

  socket.on("webrtc-ice", ({ targetId, candidate }) => {
    if (targetId && candidate) {
      io.to(targetId).emit("webrtc-ice", {
        fromId: socket.id,
        candidate
      });
    }
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (room) {
      room.members.delete(socket.id);
    }

    setTimeout(() => {
      const members = io.sockets.adapter.rooms.get(roomId);
      const count = members ? members.size : 0;

      if (count === 0) {
        rooms.delete(roomId);
      } else {
        emitParticipants(roomId);
        io.to(roomId).emit("voice-peer-left");
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
