const socket = io();

const $ = (id) => document.getElementById(id);

const lobby = $("lobby");
const roomEl = $("room");
const lobbyTitle = $("lobbyTitle");
const lobbyText = $("lobbyText");
const nameInput = $("nameInput");
const createBtn = $("createBtn");
const roomCode = $("roomCode");
const copyBtn = $("copyBtn");
const presenceText = $("presenceText");
const dot = $("dot");
const participantsEl = $("participants");
const messages = $("messages");
const chatForm = $("chatForm");
const chatInput = $("chatInput");
const youtubeUrl = $("youtubeUrl");
const loadYoutubeBtn = $("loadYoutubeBtn");
const fileInput = $("fileInput");
const localVideo = $("localVideo");
const emptyState = $("emptyState");
const syncBtn = $("syncBtn");
const syncState = $("syncState");
const fullscreenBtn = $("fullscreenBtn");
const playerWrap = $("playerWrap");
const reactionLayer = $("reactionLayer");
const seasonInput = $("seasonInput");
const episodeInput = $("episodeInput");
const episodeTitle = $("episodeTitle");
const setEpisodeBtn = $("setEpisodeBtn");
const episodeBadge = $("episodeBadge");
const voiceBtn = $("voiceBtn");
const muteBtn = $("muteBtn");
const voiceStatus = $("voiceStatus");
const remoteAudio = $("remoteAudio");

const roomPathMatch = location.pathname.match(/^\/room\/([A-Z0-9_-]{4,32})\/?$/i);
const legacyRoomParam = new URL(location.href).searchParams.get("room");
let invitedRoomId = roomPathMatch?.[1]?.toUpperCase() || legacyRoomParam?.toUpperCase() || "";
let roomId = "";
let myName = localStorage.getItem("wp_name") || "";
let player = null;
let playerReady = false;
let currentMode = null;
let suppressUntil = 0;
let lastRemoteState = null;
let localObjectUrl = null;
let latestParticipants = [];

// Voice / WebRTC
let localStream = null;
let peerConnection = null;
let peerId = null;
let voiceEnabled = false;
let micMuted = false;
let pendingIce = [];

nameInput.value = myName;

function makeRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function enterRoom(id) {
  roomId = String(id || "").toUpperCase();
  myName = nameInput.value.trim() || myName || "Гость";
  localStorage.setItem("wp_name", myName);

  // Надёжная ссылка: ID комнаты хранится в path, а не в ?room=...
  history.replaceState({}, "", `/room/${encodeURIComponent(roomId)}`);

  lobby.classList.add("hidden");
  roomEl.classList.remove("hidden");
  roomCode.textContent = roomId;
  socket.emit("join-room", { roomId, name: myName });
}

function configureLobby() {
  if (invitedRoomId) {
    lobbyTitle.textContent = "Вас пригласили смотреть вместе";
    lobbyText.textContent = `Комната ${invitedRoomId}. Введи имя и присоединяйся.`;
    createBtn.textContent = "Войти в комнату";

    // Старые ссылки ?room=... сразу превращаем в новый формат /room/...
    if (legacyRoomParam && !roomPathMatch) {
      history.replaceState({}, "", `/room/${encodeURIComponent(invitedRoomId)}`);
    }
  } else {
    lobbyTitle.textContent = "Совместный просмотр на двоих";
    lobbyText.textContent = "Создай комнату и отправь ссылку второму человеку.";
    createBtn.textContent = "Создать комнату";
  }
}

createBtn.addEventListener("click", () => {
  if (invitedRoomId) {
    enterRoom(invitedRoomId);
  } else {
    enterRoom(makeRoomId());
  }
});

configureLobby();

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    copyBtn.textContent = "Ссылка скопирована ✓";
    setTimeout(() => copyBtn.textContent = "Скопировать ссылку", 1400);
  } catch {
    prompt("Скопируй ссылку:", location.href);
  }
});

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    const target = btn.dataset.tab;
    $("youtubeTab").classList.toggle("hidden", target !== "youtube");
    $("localTab").classList.toggle("hidden", target !== "local");
  });
});

function getYoutubeId(input) {
  const value = input.trim();
  if (/^[\w-]{11}$/.test(value)) return value;
  try {
    const u = new URL(value);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const m = u.pathname.match(/\/(embed|shorts)\/([\w-]{11})/);
    if (m) return m[2];
  } catch {}
  return null;
}

loadYoutubeBtn.addEventListener("click", () => {
  const id = getYoutubeId(youtubeUrl.value);
  if (!id) {
    alert("Не получилось распознать ссылку YouTube.");
    return;
  }

  socket.emit("set-media", { type: "youtube", id });
  loadYoutube(id, true);
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  if (localObjectUrl) URL.revokeObjectURL(localObjectUrl);
  localObjectUrl = URL.createObjectURL(file);

  currentMode = "local";
  emptyState.classList.add("hidden");
  localVideo.classList.remove("hidden");
  $("youtubePlayer").classList.add("hidden");
  localVideo.src = localObjectUrl;
  localVideo.playbackRate = 1;
  localVideo.load();

  socket.emit("set-media", {
    type: "local",
    name: file.name,
    size: file.size
  });

  addSystem(`Выбран локальный файл: ${file.name}`);
  setTimeout(() => socket.emit("request-sync"), 600);
});

function ensureYT(cb) {
  if (window.YT && window.YT.Player) cb();
  else setTimeout(() => ensureYT(cb), 150);
}

function loadYoutube(id, emitInitialSync = false) {
  ensureYT(() => {
    currentMode = "youtube";
    emptyState.classList.add("hidden");
    localVideo.classList.add("hidden");
    $("youtubePlayer").classList.remove("hidden");

    if (!player) {
      player = new YT.Player("youtubePlayer", {
        videoId: id,
        playerVars: { rel: 0, playsinline: 1 },
        events: {
          onReady: () => {
            playerReady = true;
            syncState.textContent = "Готово к синхронизации";
            if (emitInitialSync) emitSync();
            else socket.emit("request-sync");
          },
          onStateChange: (event) => {
            if (Date.now() < suppressUntil) return;
            if ([YT.PlayerState.PLAYING, YT.PlayerState.PAUSED].includes(event.data)) {
              emitSync();
            }
          }
        }
      });
    } else {
      suppressUntil = Date.now() + 1000;
      player.cueVideoById(id);
      setTimeout(() => socket.emit("request-sync"), 800);
    }
  });
}

function emitSync() {
  if (!roomId) return;
  const state = readPlayback();
  if (!state) return;
  socket.emit("sync", state);
  syncState.textContent = "Синхронизировано";
}

function readPlayback() {
  if (currentMode === "youtube" && player && playerReady) {
    return {
      time: player.getCurrentTime() || 0,
      playing: player.getPlayerState() === YT.PlayerState.PLAYING
    };
  }

  if (currentMode === "local" && localVideo.src) {
    return {
      time: localVideo.currentTime || 0,
      playing: !localVideo.paused
    };
  }

  return null;
}

function applyRemote(state) {
  if (!state) return;
  lastRemoteState = state;

  const networkDelay = Math.max(0, (Date.now() - (state.updatedAt || Date.now())) / 1000);
  const targetTime = Math.max(0, state.time + (state.playing ? networkDelay : 0));

  if (currentMode === "youtube" && player && playerReady) {
    suppressUntil = Date.now() + 850;
    const now = player.getCurrentTime() || 0;
    const drift = targetTime - now;

    if (Math.abs(drift) > 0.65) {
      player.seekTo(targetTime, true);
    }

    if (state.playing) {
      player.playVideo();
    } else {
      player.pauseVideo();
    }

    syncState.textContent =
      Math.abs(drift) < 0.45 ? "Идеально синхронно" : `Поправили ${Math.abs(drift).toFixed(1)} сек`;
  }

  if (currentMode === "local" && localVideo.src) {
    suppressUntil = Date.now() + 850;
    const drift = targetTime - localVideo.currentTime;

    if (Math.abs(drift) > 1.0) {
      localVideo.currentTime = targetTime;
      localVideo.playbackRate = 1;
    } else if (state.playing && Math.abs(drift) > 0.16) {
      // Мягкая коррекция без заметного прыжка.
      localVideo.playbackRate = drift > 0 ? 1.05 : 0.95;
      setTimeout(() => {
        if (localVideo) localVideo.playbackRate = 1;
      }, 1800);
    } else {
      localVideo.playbackRate = 1;
    }

    if (state.playing) {
      localVideo.play().catch(() => {
        syncState.textContent = "Нажми Play один раз — браузер ждёт разрешения";
      });
    } else {
      localVideo.pause();
    }

    syncState.textContent =
      Math.abs(drift) < 0.25 ? "Идеально синхронно" : `Коррекция ${Math.abs(drift).toFixed(1)} сек`;
  }
}

["play", "pause", "seeked"].forEach(evt => {
  localVideo.addEventListener(evt, () => {
    if (Date.now() < suppressUntil) return;
    emitSync();
  });
});

syncBtn.addEventListener("click", () => {
  socket.emit("request-sync");
  syncState.textContent = "Проверяем позицию…";
});

// Более частая автоматическая синхронизация.
setInterval(() => {
  const state = readPlayback();
  if (state?.playing) {
    socket.emit("sync", state);
  }
}, 1800);

// Fullscreen
fullscreenBtn.addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) {
      await playerWrap.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch {}
});

// Episode info
setEpisodeBtn.addEventListener("click", () => {
  socket.emit("set-episode", {
    season: seasonInput.value,
    episode: episodeInput.value,
    title: episodeTitle.value
  });
});

function applyEpisode(data) {
  if (!data) return;
  seasonInput.value = data.season || 1;
  episodeInput.value = data.episode || 1;
  episodeTitle.value = data.title || "";
  episodeBadge.textContent = `S${data.season || 1} · E${data.episode || 1}`;
  document.title = data.title
    ? `${data.title} — S${data.season || 1}E${data.episode || 1} · Двое`
    : `S${data.season || 1}E${data.episode || 1} · Двое`;
}

// Reactions
document.querySelectorAll(".reactionBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    socket.emit("reaction", { emoji: btn.dataset.emoji });
  });
});

function showReaction(emoji) {
  const el = document.createElement("div");
  el.className = "floatingReaction";
  el.textContent = emoji;
  const drift = Math.round((Math.random() - 0.5) * 240);
  const rot = Math.round((Math.random() - 0.5) * 35);
  el.style.setProperty("--drift", `${drift}px`);
  el.style.setProperty("--rot", `${rot}deg`);
  reactionLayer.appendChild(el);
  setTimeout(() => el.remove(), 2100);
}

// Participants
function renderParticipants(participants) {
  latestParticipants = participants || [];
  participantsEl.innerHTML = "";

  latestParticipants.forEach(p => {
    const el = document.createElement("div");
    el.className = "person";

    const isMe = p.id === socket.id;
    const displayName = isMe ? `${p.name} (ты)` : p.name;

    el.innerHTML = `
      <span class="personDot"></span>
      <span></span>
      <span class="personVoice ${p.voiceReady ? "on" : ""}">🎙️</span>
    `;
    el.children[1].textContent = displayName;
    participantsEl.appendChild(el);
  });

  const count = latestParticipants.length;
  presenceText.textContent = count === 2 ? "вы вдвоём" : "ожидаем второго";
  dot.classList.toggle("online", count > 0);

  if (voiceEnabled) {
    const otherReady = latestParticipants.some(p => p.id !== socket.id && p.voiceReady);
    voiceStatus.textContent = otherReady
      ? "Оба готовы — соединяем голос"
      : "Микрофон включён, ждём второго";
  }
}

// Chat
function addMessage({ name, text, at }) {
  const div = document.createElement("div");
  div.className = "msg";
  const time = new Date(at || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  div.innerHTML = `<div class="meta"></div><div class="text"></div>`;
  div.querySelector(".meta").textContent = `${name} · ${time}`;
  div.querySelector(".text").textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function addSystem(text) {
  const div = document.createElement("div");
  div.className = "msg system";
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  socket.emit("chat", { text });
  chatInput.value = "";
});

// Voice
async function enableVoice() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });

    voiceEnabled = true;
    micMuted = false;
    voiceBtn.textContent = "Выключить голос";
    voiceBtn.classList.add("danger");
    muteBtn.classList.remove("hidden");
    muteBtn.textContent = "Выключить микрофон";
    voiceStatus.textContent = "Микрофон включён, ждём второго";

    socket.emit("voice-ready", { ready: true });
  } catch (err) {
    voiceStatus.textContent = "Нет доступа к микрофону";
    alert("Браузер не дал доступ к микрофону. Разреши микрофон для этого сайта и попробуй ещё раз.");
  }
}

function disableVoice() {
  voiceEnabled = false;
  micMuted = false;

  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }

  closePeer();
  remoteAudio.srcObject = null;

  voiceBtn.textContent = "Включить голос";
  voiceBtn.classList.remove("danger");
  muteBtn.classList.add("hidden");
  voiceStatus.textContent = "Микрофон выключен";

  socket.emit("voice-ready", { ready: false });
}

voiceBtn.addEventListener("click", () => {
  if (!voiceEnabled) enableVoice();
  else disableVoice();
});

muteBtn.addEventListener("click", () => {
  if (!localStream) return;
  micMuted = !micMuted;
  localStream.getAudioTracks().forEach(track => {
    track.enabled = !micMuted;
  });
  muteBtn.textContent = micMuted ? "Включить микрофон" : "Выключить микрофон";
  voiceStatus.textContent = micMuted ? "Твой микрофон выключен" : "Голос подключён";
});

function createPeer(targetId) {
  closePeer(false);
  peerId = targetId;

  peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }
    ]
  });

  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }

  peerConnection.ontrack = (event) => {
    remoteAudio.srcObject = event.streams[0];
    voiceStatus.textContent = "Голос подключён";
    remoteAudio.play().catch(() => {});
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate && peerId) {
      socket.emit("webrtc-ice", {
        targetId: peerId,
        candidate: event.candidate
      });
    }
  };

  peerConnection.onconnectionstatechange = () => {
    const state = peerConnection?.connectionState;
    if (state === "connected") voiceStatus.textContent = "Голос подключён";
    if (state === "failed") voiceStatus.textContent = "Не удалось соединить голос";
    if (state === "disconnected") voiceStatus.textContent = "Голос временно потерян";
  };

  return peerConnection;
}

function closePeer(clearPeer = true) {
  if (peerConnection) {
    try { peerConnection.close(); } catch {}
    peerConnection = null;
  }
  pendingIce = [];
  if (clearPeer) peerId = null;
}

async function flushPendingIce() {
  if (!peerConnection?.remoteDescription) return;
  const queue = [...pendingIce];
  pendingIce = [];
  for (const candidate of queue) {
    try { await peerConnection.addIceCandidate(candidate); } catch {}
  }
}

socket.on("start-call", async ({ peerId: targetId }) => {
  if (!voiceEnabled || !localStream) return;

  const pc = createPeer(targetId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  socket.emit("webrtc-offer", {
    targetId,
    offer: pc.localDescription
  });
});

socket.on("webrtc-offer", async ({ fromId, offer }) => {
  if (!voiceEnabled || !localStream) return;

  const pc = createPeer(fromId);
  await pc.setRemoteDescription(offer);
  await flushPendingIce();

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  socket.emit("webrtc-answer", {
    targetId: fromId,
    answer: pc.localDescription
  });
});

socket.on("webrtc-answer", async ({ fromId, answer }) => {
  if (!peerConnection) return;
  peerId = fromId;
  await peerConnection.setRemoteDescription(answer);
  await flushPendingIce();
});

socket.on("webrtc-ice", async ({ fromId, candidate }) => {
  if (!peerConnection) {
    pendingIce.push(candidate);
    peerId = fromId;
    return;
  }

  if (!peerConnection.remoteDescription) {
    pendingIce.push(candidate);
    return;
  }

  try {
    await peerConnection.addIceCandidate(candidate);
  } catch {}
});

socket.on("voice-peer-left", () => {
  if (peerConnection) closePeer();
  remoteAudio.srcObject = null;
  if (voiceEnabled) voiceStatus.textContent = "Голос включён, ждём второго";
});

// Socket events
socket.on("room-full", () => {
  alert("В этой комнате уже два человека.");
  location.href = location.pathname;
});

socket.on("participants", renderParticipants);

socket.on("room-state", (state) => {
  if (state?.episode) applyEpisode(state.episode);

  if (state?.media?.type === "youtube") {
    loadYoutube(state.media.id);
  } else if (state?.media?.type === "local") {
    addSystem(`Партнёр выбрал файл «${state.media.name}». Выбери у себя тот же файл.`);
  }

  if (state?.playback) {
    lastRemoteState = state.playback;
  }
});

socket.on("set-media", (media) => {
  if (media.type === "youtube") {
    loadYoutube(media.id);
  } else if (media.type === "local") {
    addSystem(`Партнёр выбрал «${media.name}». Выбери у себя тот же видеофайл.`);
  }
});

socket.on("set-episode", (data) => {
  applyEpisode(data);
  addSystem(`Сейчас смотрим: ${data.title ? `${data.title} · ` : ""}сезон ${data.season}, серия ${data.episode}`);
});

socket.on("sync", applyRemote);
socket.on("chat", addMessage);
socket.on("system-message", ({ text }) => addSystem(text));

socket.on("reaction", ({ emoji }) => {
  showReaction(emoji);
});

window.addEventListener("beforeunload", () => {
  if (localObjectUrl) URL.revokeObjectURL(localObjectUrl);
  if (localStream) localStream.getTracks().forEach(t => t.stop());
});
