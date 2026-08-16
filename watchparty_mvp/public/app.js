const socket = io();

const $ = (id) => document.getElementById(id);

const lobby = $("lobby");
const roomEl = $("room");
const nameInput = $("nameInput");
const createBtn = $("createBtn");
const roomCode = $("roomCode");
const copyBtn = $("copyBtn");
const presenceText = $("presenceText");
const dot = $("dot");
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

let roomId = new URL(location.href).searchParams.get("room") || "";
let myName = localStorage.getItem("wp_name") || "";
let player = null;
let playerReady = false;
let currentMode = null;
let suppressUntil = 0;
let lastRemoteState = null;

nameInput.value = myName;

function makeRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function enterRoom(id) {
  roomId = id;
  myName = nameInput.value.trim() || "Гость";
  localStorage.setItem("wp_name", myName);

  const url = new URL(location.href);
  url.searchParams.set("room", roomId);
  history.replaceState({}, "", url);

  lobby.classList.add("hidden");
  roomEl.classList.remove("hidden");
  roomCode.textContent = roomId;
  socket.emit("join-room", { roomId, name: myName });
}

createBtn.addEventListener("click", () => enterRoom(makeRoomId()));

if (roomId) {
  enterRoom(roomId);
}

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

  const url = URL.createObjectURL(file);
  currentMode = "local";
  emptyState.classList.add("hidden");
  localVideo.classList.remove("hidden");
  $("youtubePlayer").classList.add("hidden");
  localVideo.src = url;
  localVideo.load();

  socket.emit("set-media", {
    type: "local",
    name: file.name,
    size: file.size
  });

  addSystem(`Выбран локальный файл: ${file.name}`);
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
      suppressUntil = Date.now() + 800;
      player.cueVideoById(id);
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
  lastRemoteState = state;
  suppressUntil = Date.now() + 900;

  const networkDelay = Math.max(0, (Date.now() - (state.updatedAt || Date.now())) / 1000);
  const targetTime = state.time + (state.playing ? networkDelay : 0);

  if (currentMode === "youtube" && player && playerReady) {
    const now = player.getCurrentTime() || 0;
    if (Math.abs(now - targetTime) > 0.75) {
      player.seekTo(targetTime, true);
    }
    if (state.playing) player.playVideo();
    else player.pauseVideo();
    syncState.textContent = "Синхронно";
  }

  if (currentMode === "local" && localVideo.src) {
    if (Math.abs(localVideo.currentTime - targetTime) > 0.75) {
      localVideo.currentTime = targetTime;
    }
    if (state.playing) localVideo.play().catch(() => {});
    else localVideo.pause();
    syncState.textContent = "Синхронно";
  }
}

["play", "pause", "seeked"].forEach(evt => {
  localVideo.addEventListener(evt, () => {
    if (Date.now() < suppressUntil) return;
    emitSync();
  });
});

syncBtn.addEventListener("click", () => {
  if (lastRemoteState) applyRemote(lastRemoteState);
  else emitSync();
});

setInterval(() => {
  const state = readPlayback();
  if (state?.playing) {
    socket.emit("sync", state);
  }
}, 4000);

socket.on("room-full", () => {
  alert("В этой комнате уже два человека.");
  location.href = location.pathname;
});

socket.on("presence", ({ count }) => {
  presenceText.textContent = count === 2 ? "вы вдвоём" : "ожидаем второго";
  dot.classList.toggle("online", count > 0);
});

socket.on("room-state", (state) => {
  if (state?.media?.type === "youtube") {
    loadYoutube(state.media.id);
  } else if (state?.media?.type === "local") {
    addSystem(`Партнёр выбрал файл «${state.media.name}». Выбери у себя тот же файл.`);
  }
  if (state?.playback) lastRemoteState = state.playback;
});

socket.on("set-media", (media) => {
  if (media.type === "youtube") {
    loadYoutube(media.id);
  } else if (media.type === "local") {
    addSystem(`Партнёр выбрал «${media.name}». Выбери у себя тот же видеофайл.`);
  }
});

socket.on("sync", applyRemote);

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

socket.on("chat", addMessage);
socket.on("system-message", ({ text }) => addSystem(text));

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  socket.emit("chat", { text });
  chatInput.value = "";
});
