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
const menuBtn = $("menuBtn");
const drawer = $("drawer");
const drawerBackdrop = $("drawerBackdrop");
const closeDrawerBtn = $("closeDrawerBtn");
const historyList = $("historyList");
const clearHistoryBtn = $("clearHistoryBtn");
const micBtn = $("micBtn");
const headphonesBtn = $("headphonesBtn");
const cameraBtn = $("cameraBtn");
const hangupBtn = $("hangupBtn");
const callStatus = $("callStatus");
const remoteAudio = $("remoteAudio");
const remoteVideo = $("remoteVideo");
const localVideoCall = $("localVideoCall");
const remoteCamWrap = $("remoteCamWrap");
const localCamWrap = $("localCamWrap");
const chatCard = $("chatCard");
const collapseChatBtn = $("collapseChatBtn");
const collapseSourceBtn = $("collapseSourceBtn");
const sourceBody = $("sourceBody");

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

// WebRTC state
let localStream = new MediaStream();
let peerConnection = null;
let peerId = null;
let pendingIce = [];
let micEnabled = false;
let cameraEnabled = false;
let remoteSoundEnabled = true;

nameInput.value = myName;

function makeRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function sessionKey(id) {
  return `wp_joined_${id}`;
}

function enterRoom(id, { auto = false } = {}) {
  roomId = String(id || "").toUpperCase();
  myName = nameInput.value.trim() || myName || "Гость";
  localStorage.setItem("wp_name", myName);
  sessionStorage.setItem(sessionKey(roomId), "1");

  history.replaceState({}, "", `/room/${encodeURIComponent(roomId)}`);

  lobby.classList.add("hidden");
  roomEl.classList.remove("hidden");
  menuBtn.classList.remove("hidden");
  roomCode.textContent = roomId;
  socket.emit("join-room", { roomId, name: myName });

  if (auto) addSystem("Комната восстановлена после обновления страницы");
}

function configureLobby() {
  if (invitedRoomId) {
    const wasJoined = sessionStorage.getItem(sessionKey(invitedRoomId)) === "1";
    if (wasJoined && myName) {
      enterRoom(invitedRoomId, { auto: true });
      return;
    }

    lobbyTitle.textContent = "Вас пригласили в AmorellyWatch";
    lobbyText.textContent = `Комната ${invitedRoomId}. Введи имя и присоединяйся.`;
    createBtn.textContent = "Войти в комнату";

    if (legacyRoomParam && !roomPathMatch) {
      history.replaceState({}, "", `/room/${encodeURIComponent(invitedRoomId)}`);
    }
  } else {
    lobbyTitle.textContent = "AmorellyWatch для двоих";
    lobbyText.textContent = "Создай комнату и отправь ссылку второму человеку.";
    createBtn.textContent = "Создать комнату";
  }
}

createBtn.addEventListener("click", () => {
  if (invitedRoomId) enterRoom(invitedRoomId);
  else enterRoom(makeRoomId());
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

// Collapsible panels
collapseChatBtn.addEventListener("click", () => {
  chatCard.classList.toggle("collapsed");
  collapseChatBtn.textContent = chatCard.classList.contains("collapsed") ? "+" : "−";
});
collapseSourceBtn.addEventListener("click", () => {
  sourceBody.classList.toggle("hidden");
  collapseSourceBtn.textContent = sourceBody.classList.contains("hidden") ? "+" : "−";
});

// Drawer
function openDrawer() {
  drawer.classList.remove("hidden");
  drawerBackdrop.classList.remove("hidden");
  renderHistory();
}
function closeDrawer() {
  drawer.classList.add("hidden");
  drawerBackdrop.classList.add("hidden");
}
menuBtn.addEventListener("click", openDrawer);
closeDrawerBtn.addEventListener("click", closeDrawer);
drawerBackdrop.addEventListener("click", closeDrawer);

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

  socket.emit("set-media", { type: "local", name: file.name, size: file.size });
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
    if (Math.abs(drift) > 0.65) player.seekTo(targetTime, true);
    if (state.playing) player.playVideo();
    else player.pauseVideo();
    syncState.textContent = Math.abs(drift) < 0.45 ? "Идеально синхронно" : `Поправили ${Math.abs(drift).toFixed(1)} сек`;
  }

  if (currentMode === "local" && localVideo.src) {
    suppressUntil = Date.now() + 850;
    const drift = targetTime - localVideo.currentTime;
    if (Math.abs(drift) > 1.0) {
      localVideo.currentTime = targetTime;
      localVideo.playbackRate = 1;
    } else if (state.playing && Math.abs(drift) > 0.16) {
      localVideo.playbackRate = drift > 0 ? 1.05 : 0.95;
      setTimeout(() => {
        if (localVideo) localVideo.playbackRate = 1;
      }, 1800);
    } else {
      localVideo.playbackRate = 1;
    }
    if (state.playing) localVideo.play().catch(() => {});
    else localVideo.pause();
    syncState.textContent = Math.abs(drift) < 0.25 ? "Идеально синхронно" : `Коррекция ${Math.abs(drift).toFixed(1)} сек`;
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

setInterval(() => {
  const state = readPlayback();
  if (state?.playing) socket.emit("sync", state);
}, 1800);

fullscreenBtn.addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) await playerWrap.requestFullscreen();
    else await document.exitFullscreen();
  } catch {}
});

// Episode progress + local history
const HISTORY_KEY = "wp_history_v3";

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
  catch { return []; }
}

function saveHistoryEntry(entry) {
  const list = getHistory();
  const key = `${entry.title}|${entry.season}|${entry.episode}`;
  const filtered = list.filter(x => `${x.title}|${x.season}|${x.episode}` !== key);
  filtered.unshift({ ...entry, savedAt: Date.now() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, 30)));
  renderHistory();
}

function renderHistory() {
  const list = getHistory();
  historyList.innerHTML = "";
  if (!list.length) {
    historyList.innerHTML = '<div class="historyEmpty">История пока пустая.</div>';
    return;
  }
  list.forEach(item => {
    const el = document.createElement("div");
    el.className = "historyItem";
    const left = document.createElement("div");
    left.innerHTML = `<div class="historyTitle"></div><div class="historyMeta"></div>`;
    left.querySelector(".historyTitle").textContent = item.title || "Без названия";
    left.querySelector(".historyMeta").textContent = `Сезон ${item.season}, серия ${item.episode} · ${new Date(item.savedAt).toLocaleDateString()}`;
    const btn = document.createElement("button");
    btn.className = "smallBtn";
    btn.textContent = "Вернуть";
    btn.onclick = () => {
      seasonInput.value = item.season;
      episodeInput.value = item.episode;
      episodeTitle.value = item.title || "";
      socket.emit("set-episode", item);
      closeDrawer();
    };
    el.append(left, btn);
    historyList.appendChild(el);
  });
}
clearHistoryBtn.addEventListener("click", () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
});

setEpisodeBtn.addEventListener("click", () => {
  const data = {
    season: Number(seasonInput.value) || 1,
    episode: Number(episodeInput.value) || 1,
    title: episodeTitle.value.trim()
  };
  socket.emit("set-episode", data);
  saveHistoryEntry(data);
});

function applyEpisode(data) {
  if (!data) return;
  seasonInput.value = data.season || 1;
  episodeInput.value = data.episode || 1;
  episodeTitle.value = data.title || "";
  document.title = data.title
    ? `${data.title} — S${data.season || 1}E${data.episode || 1} · AmorellyWatch`
    : `S${data.season || 1}E${data.episode || 1} · AmorellyWatch`;
}

// Reactions
document.querySelectorAll(".reactionBtn").forEach(btn => {
  btn.addEventListener("click", () => socket.emit("reaction", { emoji: btn.dataset.emoji }));
});

function showReaction(emoji) {
  const el = document.createElement("div");
  el.className = "floatingReaction";
  el.textContent = emoji;
  el.style.setProperty("--drift", `${Math.round((Math.random() - 0.5) * 240)}px`);
  el.style.setProperty("--rot", `${Math.round((Math.random() - 0.5) * 35)}deg`);
  reactionLayer.appendChild(el);
  setTimeout(() => el.remove(), 2100);
}

function renderParticipants(participants) {
  latestParticipants = participants || [];
  participantsEl.innerHTML = "";

  latestParticipants.forEach(p => {
    const el = document.createElement("div");
    el.className = "person";
    const isMe = p.id === socket.id;
    const icons = `${p.voiceReady ? "🎙️" : ""}${p.cameraReady ? "📷" : ""}`;
    el.innerHTML = `<span class="personDot"></span><span></span><span></span>`;
    el.children[1].textContent = isMe ? `${p.name} (ты)` : p.name;
    el.children[2].textContent = icons;
    participantsEl.appendChild(el);
  });

  const count = latestParticipants.length;
  presenceText.textContent = count === 2 ? "вы вдвоём" : "ожидаем второго";
  dot.classList.toggle("online", count > 0);
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
  if (!messages) return;
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

// WebRTC helpers
function updateMediaButtons() {
  micBtn.classList.toggle("active", micEnabled);
  micBtn.textContent = micEnabled ? "🎙️ Микрофон: вкл" : "🎙️ Микрофон: выкл";

  cameraBtn.classList.toggle("active", cameraEnabled);
  cameraBtn.textContent = cameraEnabled ? "📷 Камера: вкл" : "📷 Камера: выкл";

  headphonesBtn.classList.toggle("active", remoteSoundEnabled);
  headphonesBtn.textContent = remoteSoundEnabled ? "🎧 Звук: вкл" : "🎧 Звук: выкл";

  hangupBtn.classList.toggle("hidden", !(micEnabled || cameraEnabled || peerConnection));
  localCamWrap.classList.toggle("hidden", !cameraEnabled);

  if (!micEnabled && !cameraEnabled) callStatus.textContent = "Голос и камера выключены";
  else if (!peerConnection || peerConnection.connectionState !== "connected") callStatus.textContent = "Ждём подключение второго";
}

function emitMediaReady() {
  socket.emit("media-ready", {
    voiceReady: micEnabled,
    cameraReady: cameraEnabled
  });
}

async function ensureTrack(kind) {
  const existing = localStream.getTracks().find(t => t.kind === kind && t.readyState === "live");
  if (existing) return existing;

  const constraints = kind === "audio"
    ? { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }
    : { audio: false, video: { width: { ideal: 640 }, height: { ideal: 360 }, facingMode: "user" } };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  const track = stream.getTracks().find(t => t.kind === kind);
  if (track) localStream.addTrack(track);
  return track;
}

async function setMic(enabled) {
  try {
    let track = localStream.getAudioTracks()[0];
    if (enabled && !track) track = await ensureTrack("audio");
    if (track) track.enabled = enabled;
    micEnabled = enabled;

    if (peerConnection && track) {
      const sender = peerConnection.getSenders().find(s => s.track?.kind === "audio");
      if (!sender) peerConnection.addTrack(track, localStream);
    }

    emitMediaReady();
    updateMediaButtons();
    if (peerId) socket.emit("webrtc-renegotiate", { targetId: peerId });
  } catch {
    alert("Не удалось включить микрофон. Разреши доступ к микрофону для этого сайта.");
  }
}

async function setCamera(enabled) {
  try {
    let track = localStream.getVideoTracks()[0];
    if (enabled && !track) track = await ensureTrack("video");
    if (track) track.enabled = enabled;
    cameraEnabled = enabled;

    if (cameraEnabled) {
      localVideoCall.srcObject = localStream;
      localVideoCall.play().catch(() => {});
    }

    if (peerConnection && track) {
      const sender = peerConnection.getSenders().find(s => s.track?.kind === "video");
      if (!sender) peerConnection.addTrack(track, localStream);
    }

    emitMediaReady();
    updateMediaButtons();
    if (peerId) socket.emit("webrtc-renegotiate", { targetId: peerId });
  } catch {
    alert("Не удалось включить камеру. Разреши доступ к камере для этого сайта.");
  }
}

micBtn.addEventListener("click", () => setMic(!micEnabled));
cameraBtn.addEventListener("click", () => setCamera(!cameraEnabled));

headphonesBtn.addEventListener("click", () => {
  remoteSoundEnabled = !remoteSoundEnabled;
  remoteAudio.muted = !remoteSoundEnabled;
  remoteVideo.muted = !remoteSoundEnabled;
  updateMediaButtons();
});

hangupBtn.addEventListener("click", () => {
  localStream.getTracks().forEach(t => t.stop());
  localStream = new MediaStream();
  micEnabled = false;
  cameraEnabled = false;
  localCamWrap.classList.add("hidden");
  remoteCamWrap.classList.add("hidden");
  remoteVideo.srcObject = null;
  remoteAudio.srcObject = null;
  closePeer();
  emitMediaReady();
  updateMediaButtons();
});

function createPeer(targetId) {
  if (peerConnection && peerId === targetId && peerConnection.connectionState !== "closed") {
    return peerConnection;
  }
  closePeer(false);
  peerId = targetId;

  peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" }
    ]
  });

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    const stream = event.streams[0];
    const hasVideo = stream.getVideoTracks().length > 0;

    remoteAudio.srcObject = stream;
    remoteAudio.muted = !remoteSoundEnabled;
    remoteAudio.play().catch(() => {});

    if (hasVideo) {
      remoteVideo.srcObject = stream;
      remoteVideo.muted = !remoteSoundEnabled;
      remoteCamWrap.classList.remove("hidden");
      remoteVideo.play().catch(() => {});
    }
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate && peerId) {
      socket.emit("webrtc-ice", { targetId: peerId, candidate: event.candidate });
    }
  };

  peerConnection.onconnectionstatechange = () => {
    const state = peerConnection?.connectionState;
    if (state === "connected") callStatus.textContent = "Связь установлена";
    if (state === "connecting") callStatus.textContent = "Подключаемся…";
    if (state === "failed") callStatus.textContent = "Не удалось соединиться — попробуйте выключить/включить связь";
    if (state === "disconnected") callStatus.textContent = "Связь потеряна, пробуем восстановить";
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

async function makeOffer(targetId) {
  const pc = createPeer(targetId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("webrtc-offer", { targetId, offer: pc.localDescription });
}

socket.on("start-call", async ({ peerId: targetId }) => {
  if (!(micEnabled || cameraEnabled)) return;
  await makeOffer(targetId);
});

socket.on("webrtc-renegotiate", async ({ fromId }) => {
  // Only one side should be the offerer to avoid offer collision.
  if (socket.id < fromId) await makeOffer(fromId);
});

socket.on("webrtc-offer", async ({ fromId, offer }) => {
  if (!(micEnabled || cameraEnabled)) {
    callStatus.textContent = "Второй человек включил связь — включи микрофон или камеру";
    return;
  }
  const pc = createPeer(fromId);
  await pc.setRemoteDescription(offer);
  await flushPendingIce();
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("webrtc-answer", { targetId: fromId, answer: pc.localDescription });
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
  try { await peerConnection.addIceCandidate(candidate); } catch {}
});

// Socket room events
socket.on("room-full", () => {
  sessionStorage.removeItem(sessionKey(invitedRoomId || roomId));
  alert("В этой комнате уже два человека.");
  location.href = location.origin;
});

socket.on("participants", renderParticipants);

socket.on("room-state", (state) => {
  if (state?.episode) applyEpisode(state.episode);

  if (state?.media?.type === "youtube") {
    loadYoutube(state.media.id);
  } else if (state?.media?.type === "local") {
    addSystem(`В комнате выбран файл «${state.media.name}». Выбери у себя тот же файл.`);
  }

  if (state?.playback) lastRemoteState = state.playback;
});

socket.on("set-media", (media) => {
  if (media.type === "youtube") loadYoutube(media.id);
  else if (media.type === "local") addSystem(`Партнёр выбрал «${media.name}». Выбери у себя тот же видеофайл.`);
});

socket.on("set-episode", (data) => {
  applyEpisode(data);
  addSystem(`Сейчас смотрим: ${data.title ? `${data.title} · ` : ""}сезон ${data.season}, серия ${data.episode}`);
});

socket.on("sync", applyRemote);
socket.on("chat", addMessage);
socket.on("system-message", ({ text }) => addSystem(text));
socket.on("reaction", ({ emoji }) => showReaction(emoji));

socket.on("peer-disconnected", () => {
  if (peerConnection) closePeer();
  remoteCamWrap.classList.add("hidden");
  remoteVideo.srcObject = null;
  remoteAudio.srcObject = null;
  if (micEnabled || cameraEnabled) callStatus.textContent = "Ждём возвращения второго";
});

window.addEventListener("beforeunload", () => {
  if (localObjectUrl) URL.revokeObjectURL(localObjectUrl);
});

updateMediaButtons();
renderHistory();
