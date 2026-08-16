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
const inviteBtn = $("inviteBtn");
const inviteBadge = $("inviteBadge");
const inviteRoomText = $("inviteRoomText");
const splash = $("splash");
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
const topControls = $("topControls");
const themeBtn = $("themeBtn");
const drawer = $("drawer");
const drawerBackdrop = $("drawerBackdrop");
const closeDrawerBtn = $("closeDrawerBtn");
const historyList = $("historyList");
const clearHistoryBtn = $("clearHistoryBtn");
const inviteModal = $("inviteModal");
const inviteModalBackdrop = $("inviteModalBackdrop");
const closeInviteModalBtn = $("closeInviteModalBtn");
const inviteLinkBox = $("inviteLinkBox");
const copyInviteTextBtn = $("copyInviteTextBtn");
const copyInviteLinkBtn = $("copyInviteLinkBtn");
const friendQuickInvite = $("friendQuickInvite");
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
const remoteNoCam = $("remoteNoCam");
const remoteCamLabel = $("remoteCamLabel");
const chatCard = $("chatCard");
const collapseChatBtn = $("collapseChatBtn");
const collapseSourceBtn = $("collapseSourceBtn");
const sourceBody = $("sourceBody");
const accountBtn = $("accountBtn");
const drawerLoginBtn = $("drawerLoginBtn");
const accountStateBadge = $("accountStateBadge");
const guestAccountBox = $("guestAccountBox");
const signedAccountBox = $("signedAccountBox");
const profileDisplayName = $("profileDisplayName");
const profileUsername = $("profileUsername");
const logoutBtn = $("logoutBtn");
const authModal = $("authModal");
const authModalBackdrop = $("authModalBackdrop");
const closeAuthModalBtn = $("closeAuthModalBtn");
const loginTabBtn = $("loginTabBtn");
const registerTabBtn = $("registerTabBtn");
const loginForm = $("loginForm");
const registerForm = $("registerForm");
const loginEmail = $("loginEmail");
const loginPassword = $("loginPassword");
const registerDisplayName = $("registerDisplayName");
const registerUsername = $("registerUsername");
const registerEmail = $("registerEmail");
const registerPassword = $("registerPassword");
const authMessage = $("authMessage");
const showActivityToggle = $("showActivityToggle");
const showTitleToggle = $("showTitleToggle");
const allowJoinToggle = $("allowJoinToggle");
const privacySaveState = $("privacySaveState");
const friendRequestCount = $("friendRequestCount");
const friendRequestsList = $("friendRequestsList");
const friendSearchInput = $("friendSearchInput");
const friendSearchBtn = $("friendSearchBtn");
const friendSearchResults = $("friendSearchResults");
const realFriendsList = $("realFriendsList");
const refreshFriendsBtn = $("refreshFriendsBtn");
const roomRequestCount = $("roomRequestCount");
const roomRequestsList = $("roomRequestsList");
const notificationStack = $("notificationStack");

const roomPathMatch = location.pathname.match(/^\/room\/([A-Z0-9_-]{4,32})\/?$/i);
const legacyRoomParam = new URL(location.href).searchParams.get("room");
let invitedRoomId = roomPathMatch?.[1]?.toUpperCase() || legacyRoomParam?.toUpperCase() || "";
let roomId = "";
let myName = localStorage.getItem("wp_name") || "";

let player = null;
let playerReady = false;
let currentMode = null;
let suppressUntil = 0;
let localObjectUrl = null;
let latestParticipants = [];

let localStream = new MediaStream();
let remoteStream = new MediaStream();
let peerConnection = null;
let peerId = null;
let pendingIce = [];
let micEnabled = false;
let cameraEnabled = false;
let remoteSoundEnabled = true;
let makingOffer = false;
let ignoreOffer = false;
let polite = false;

const HISTORY_KEY = "amorelly_history_v4";
const THEME_KEY = "amorelly_theme";

nameInput.value = myName;
remoteAudio.srcObject = remoteStream;
remoteVideo.srcObject = remoteStream;

function applyTheme(theme) {
  const actual = theme === "dark" ? "dark" : "light";
  document.body.dataset.theme = actual;
  localStorage.setItem(THEME_KEY, actual);
  themeBtn.textContent = actual === "dark" ? "🌙 Тёмная" : "☀️ Светлая";
}
applyTheme(localStorage.getItem(THEME_KEY) || "light");
themeBtn.addEventListener("click", () => {
  applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
});
window.addEventListener("load", () => {
  setTimeout(() => splash?.classList.add("hide"), 520);
});
setTimeout(() => splash?.classList.add("hide"), 1600);

function makeRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
function sessionKey(id) { return `amw_joined_${id}`; }

function enterRoom(id, { auto = false } = {}) {
  roomId = String(id || "").toUpperCase();
  myName = nameInput.value.trim() || myName || "Гость";
  localStorage.setItem("wp_name", myName);
  sessionStorage.setItem(sessionKey(roomId), "1");
  history.replaceState({}, "", `/room/${encodeURIComponent(roomId)}`);

  lobby.classList.add("hidden");
  roomEl.classList.remove("hidden");
  topControls.classList.remove("hidden");
  roomCode.textContent = roomId;
  socket.emit("join-room", { roomId, name: myName });
  updateAccountActivity().catch(() => {});
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
    lobbyText.textContent = "Введи имя — и вы сразу окажетесь в одной комнате.";
    inviteBadge.classList.remove("hidden");
    inviteRoomText.textContent = `Комната ${invitedRoomId}`;
    createBtn.textContent = "Войти в комнату";
    if (legacyRoomParam && !roomPathMatch) {
      history.replaceState({}, "", `/room/${encodeURIComponent(invitedRoomId)}`);
    }
  } else {
    inviteBadge.classList.add("hidden");
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

async function copyText(text, button, successText = "Скопировано ✓") {
  try {
    await navigator.clipboard.writeText(text);
    const old = button?.textContent;
    if (button) {
      button.textContent = successText;
      setTimeout(() => button.textContent = old, 1400);
    }
  } catch {
    prompt("Скопируй:", text);
  }
}
copyBtn.addEventListener("click", () => copyText(location.href, copyBtn, "Готово ✓"));

function inviteMessage(friendName = "") {
  const hello = friendName ? `${friendName}, ` : "";
  return `${hello}давай посмотрим вместе в AmorellyWatch 💞
${location.href}`;
}
function openInviteModal() {
  inviteLinkBox.textContent = location.href;
  renderQuickInvite();
  inviteModal.classList.remove("hidden");
  inviteModalBackdrop.classList.remove("hidden");
}
function closeInviteModal() {
  inviteModal.classList.add("hidden");
  inviteModalBackdrop.classList.add("hidden");
}
inviteBtn.addEventListener("click", openInviteModal);
closeInviteModalBtn.addEventListener("click", closeInviteModal);
inviteModalBackdrop.addEventListener("click", closeInviteModal);
copyInviteTextBtn.addEventListener("click", () => copyText(inviteMessage(), copyInviteTextBtn));
copyInviteLinkBtn.addEventListener("click", () => copyText(location.href, copyInviteLinkBtn));

collapseChatBtn.addEventListener("click", () => {
  chatCard.classList.toggle("collapsed");
  collapseChatBtn.textContent = chatCard.classList.contains("collapsed") ? "+" : "−";
});
collapseSourceBtn.addEventListener("click", () => {
  sourceBody.classList.toggle("hidden");
  collapseSourceBtn.textContent = sourceBody.classList.contains("hidden") ? "+" : "−";
});

function openDrawer() {
  drawer.classList.remove("hidden");
  drawerBackdrop.classList.remove("hidden");
  renderHistory();
  refreshSocial().catch(() => {});
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
    return { time: player.getCurrentTime() || 0, playing: player.getPlayerState() === YT.PlayerState.PLAYING };
  }
  if (currentMode === "local" && localVideo.src) {
    return { time: localVideo.currentTime || 0, playing: !localVideo.paused };
  }
  return null;
}
function applyRemote(state) {
  if (!state) return;
  const networkDelay = Math.max(0, (Date.now() - (state.updatedAt || Date.now())) / 1000);
  const targetTime = Math.max(0, state.time + (state.playing ? networkDelay : 0));
  if (currentMode === "youtube" && player && playerReady) {
    suppressUntil = Date.now() + 850;
    const now = player.getCurrentTime() || 0;
    const drift = targetTime - now;
    if (Math.abs(drift) > 0.65) player.seekTo(targetTime, true);
    if (state.playing) player.playVideo(); else player.pauseVideo();
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
      setTimeout(() => { localVideo.playbackRate = 1; }, 1800);
    } else localVideo.playbackRate = 1;
    if (state.playing) localVideo.play().catch(() => {}); else localVideo.pause();
    syncState.textContent = Math.abs(drift) < 0.25 ? "Идеально синхронно" : `Коррекция ${Math.abs(drift).toFixed(1)} сек`;
  }
}
["play", "pause", "seeked"].forEach(evt => localVideo.addEventListener(evt, () => {
  if (Date.now() < suppressUntil) return;
  emitSync();
}));
syncBtn.addEventListener("click", () => {
  socket.emit("request-sync");
  syncState.textContent = "Проверяем позицию…";
});
setInterval(() => {
  const state = readPlayback();
  if (state?.playing) socket.emit("sync", state);
}, 1800);
fullscreenBtn.addEventListener("click", async () => {
  try { if (!document.fullscreenElement) await playerWrap.requestFullscreen(); else await document.exitFullscreen(); } catch {}
});

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
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
    left.querySelector(".historyTitle").textContent = item.title || "Сериал";
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
  updateAccountActivity().catch(() => {});
});
function applyEpisode(data) {
  if (!data) return;
  seasonInput.value = data.season || 1;
  episodeInput.value = data.episode || 1;
  episodeTitle.value = data.title || "";
  document.title = data.title ? `${data.title} — S${data.season || 1}E${data.episode || 1} · AmorellyWatch` : `AmorellyWatch — S${data.season || 1}E${data.episode || 1}`;
}

document.querySelectorAll(".reactionBtn").forEach(btn => btn.addEventListener("click", () => socket.emit("reaction", { emoji: btn.dataset.emoji })));
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
  const remote = latestParticipants.find(p => p.id !== socket.id);
  remoteCamLabel.textContent = remote?.name || "Собеседник";
  remoteNoCam.classList.toggle("hidden", !remote || remote.cameraReady);
}

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

function updateMediaButtons() {
  micBtn.classList.toggle("active", micEnabled);
  micBtn.textContent = micEnabled ? "🎙️ Микрофон: вкл" : "🎙️ Микрофон: выкл";
  cameraBtn.classList.toggle("active", cameraEnabled);
  cameraBtn.textContent = cameraEnabled ? "📷 Камера: вкл" : "📷 Камера: выкл";
  headphonesBtn.classList.toggle("active", remoteSoundEnabled);
  headphonesBtn.textContent = remoteSoundEnabled ? "🎧 Звук: вкл" : "🎧 Звук: выкл";
  hangupBtn.classList.toggle("hidden", !(micEnabled || cameraEnabled || peerConnection));
  localCamWrap.classList.toggle("hidden", !cameraEnabled);
  remoteAudio.muted = !remoteSoundEnabled;
  remoteVideo.muted = !remoteSoundEnabled;
  if (!micEnabled && !cameraEnabled) callStatus.textContent = "Голос и камера выключены";
}
function emitMediaReady() {
  socket.emit("media-ready", { voiceReady: micEnabled, cameraReady: cameraEnabled });
}
async function ensureTrack(kind) {
  const existing = localStream.getTracks().find(t => t.kind === kind && t.readyState === "live");
  if (existing) return existing;
  const constraints = kind === "audio"
    ? { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }
    : { audio: false, video: { width: { ideal: 640 }, height: { ideal: 360 }, facingMode: "user" } };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  const track = stream.getTracks().find(t => t.kind === kind);
  if (track) {
    localStream.addTrack(track);
    track.onended = () => {
      if (kind === "audio") micEnabled = false;
      if (kind === "video") {
        cameraEnabled = false;
        localCamWrap.classList.add("hidden");
      }
      updateMediaButtons();
      emitMediaReady();
    };
  }
  return track;
}
function stopAndRemoveTrack(kind) {
  const track = localStream.getTracks().find(t => t.kind === kind);
  if (!track) return;
  track.stop();
  localStream.removeTrack(track);
  const sender = peerConnection?.getSenders().find(s => s.track?.kind === kind);
  if (sender) sender.replaceTrack(null).catch(() => {});
}
async function syncLocalTracksIntoPeer() {
  if (!peerConnection) return;
  for (const kind of ["audio","video"]) {
    const track = localStream.getTracks().find(t => t.kind === kind && t.enabled);
    const sender = peerConnection.getSenders().find(s => s.track?.kind === kind);
    if (track && sender) {
      await sender.replaceTrack(track).catch(() => {});
    } else if (track && !sender) {
      peerConnection.addTrack(track, localStream);
    } else if (!track && sender) {
      await sender.replaceTrack(null).catch(() => {});
    }
  }
}
async function setMic(enabled) {
  try {
    if (enabled) {
      const track = await ensureTrack("audio");
      if (track) track.enabled = true;
      micEnabled = true;
    } else {
      micEnabled = false;
      stopAndRemoveTrack("audio");
    }
    if (peerConnection) {
      await syncLocalTracksIntoPeer();
      if (peerId) maybeRenegotiate();
    }
    emitMediaReady();
    updateMediaButtons();
  } catch {
    alert("Не удалось включить микрофон. Разреши доступ к микрофону для этого сайта.");
  }
}
async function setCamera(enabled) {
  try {
    if (enabled) {
      const track = await ensureTrack("video");
      if (track) track.enabled = true;
      cameraEnabled = true;
      localVideoCall.srcObject = localStream;
      localVideoCall.play().catch(() => {});
    } else {
      cameraEnabled = false;
      localCamWrap.classList.add("hidden");
      stopAndRemoveTrack("video");
    }
    if (peerConnection) {
      await syncLocalTracksIntoPeer();
      if (peerId) maybeRenegotiate();
    }
    emitMediaReady();
    updateMediaButtons();
  } catch {
    alert("Не удалось включить камеру. Разреши доступ к камере для этого сайта.");
  }
}
micBtn.addEventListener("click", () => setMic(!micEnabled));
cameraBtn.addEventListener("click", () => setCamera(!cameraEnabled));
headphonesBtn.addEventListener("click", async () => {
  remoteSoundEnabled = !remoteSoundEnabled;
  updateMediaButtons();
  if (remoteSoundEnabled) {
    try { await remoteAudio.play(); } catch {}
    try { await remoteVideo.play(); } catch {}
  }
});
hangupBtn.addEventListener("click", () => {
  localStream.getTracks().forEach(t => t.stop());
  localStream = new MediaStream();
  micEnabled = false;
  cameraEnabled = false;
  localCamWrap.classList.add("hidden");
  remoteCamWrap.classList.add("hidden");
  remoteNoCam.classList.add("hidden");
  remoteStream.getTracks().forEach(track => remoteStream.removeTrack(track));
  closePeer();
  emitMediaReady();
  updateMediaButtons();
});

function createPeer(targetId) {
  if (peerConnection && peerId === targetId && peerConnection.connectionState !== "closed") return peerConnection;
  closePeer(false);
  peerId = targetId;
  polite = socket.id > targetId;
  peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] },
      { urls: "stun:openrelay.metered.ca:80" },
      { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" }
    ]
  });
  remoteStream = new MediaStream();
  remoteAudio.srcObject = remoteStream;
  remoteVideo.srcObject = remoteStream;
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.ontrack = (event) => {
    for (const track of event.streams[0].getTracks()) {
      const exists = remoteStream.getTracks().some(t => t.id === track.id);
      if (!exists) remoteStream.addTrack(track);
    }
    const hasVideo = remoteStream.getVideoTracks().length > 0;
    remoteCamWrap.classList.toggle("hidden", !hasVideo);
    remoteNoCam.classList.toggle("hidden", hasVideo);
    remoteAudio.play().catch(() => {});
    remoteVideo.play().catch(() => {});
    callStatus.textContent = "Связь установлена";
  };
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && peerId) socket.emit("webrtc-ice", { targetId: peerId, candidate: event.candidate });
  };
  peerConnection.onconnectionstatechange = () => {
    const state = peerConnection?.connectionState;
    if (state === "connected") callStatus.textContent = "Связь установлена";
    if (state === "connecting") callStatus.textContent = "Подключаемся…";
    if (state === "failed") callStatus.textContent = "Не удалось соединиться — попробуйте выключить и включить связь";
    if (state === "disconnected") callStatus.textContent = "Связь потеряна, пробуем восстановить";
  };
  peerConnection.onnegotiationneeded = async () => {
    if (!peerId) return;
    await makeOffer(peerId);
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
  try {
    makingOffer = true;
    await syncLocalTracksIntoPeer();
    const offer = await pc.createOffer();
    if (pc.signalingState !== "stable") return;
    await pc.setLocalDescription(offer);
    socket.emit("webrtc-offer", { targetId, offer: pc.localDescription });
  } catch {} finally {
    makingOffer = false;
  }
}
async function maybeRenegotiate() {
  if (peerId && socket.id < peerId) {
    await makeOffer(peerId);
  } else if (peerId) {
    socket.emit("webrtc-renegotiate", { targetId: peerId });
  }
}

socket.on("start-call", async ({ peerId: targetId }) => {
  if (!(micEnabled || cameraEnabled)) return;
  await makeOffer(targetId);
});
socket.on("webrtc-renegotiate", async ({ fromId }) => {
  if (!(micEnabled || cameraEnabled)) return;
  if (socket.id < fromId) await makeOffer(fromId);
});
socket.on("webrtc-offer", async ({ fromId, offer }) => {
  if (!(micEnabled || cameraEnabled)) {
    callStatus.textContent = "Второй человек включил связь — включи микрофон или камеру";
    return;
  }
  const pc = createPeer(fromId);
  const offerCollision = makingOffer || pc.signalingState !== "stable";
  ignoreOffer = !polite && offerCollision;
  if (ignoreOffer) return;
  try {
    await pc.setRemoteDescription(offer);
    await flushPendingIce();
    await syncLocalTracksIntoPeer();
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("webrtc-answer", { targetId: fromId, answer: pc.localDescription });
  } catch {}
});
socket.on("webrtc-answer", async ({ fromId, answer }) => {
  if (!peerConnection) return;
  peerId = fromId;
  try {
    await peerConnection.setRemoteDescription(answer);
    await flushPendingIce();
  } catch {}
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

socket.on("room-full", () => {
  sessionStorage.removeItem(sessionKey(invitedRoomId || roomId));
  alert("В этой комнате уже два человека.");
  location.href = location.origin;
});
socket.on("participants", renderParticipants);
socket.on("room-state", (state) => {
  if (state?.episode) applyEpisode(state.episode);
  if (state?.media?.type === "youtube") loadYoutube(state.media.id);
  else if (state?.media?.type === "local") addSystem(`В комнате выбран файл «${state.media.name}». Выбери у себя тот же файл.`);
  if (state?.playback) applyRemote(state.playback);
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
  remoteNoCam.classList.add("hidden");
  remoteStream.getTracks().forEach(track => remoteStream.removeTrack(track));
  if (micEnabled || cameraEnabled) callStatus.textContent = "Ждём возвращения второго";
});
window.addEventListener("beforeunload", () => { if (localObjectUrl) URL.revokeObjectURL(localObjectUrl); });
renderHistory();
updateMediaButtons();

// ---------- AmorellyWatch v4: Supabase accounts & friends ----------
const supabaseConfigured = !!(
  window.AMORELLY_CONFIG?.supabaseUrl &&
  window.AMORELLY_CONFIG?.supabasePublishableKey &&
  window.supabase?.createClient
);
const sb = supabaseConfigured
  ? window.supabase.createClient(
      window.AMORELLY_CONFIG.supabaseUrl,
      window.AMORELLY_CONFIG.supabasePublishableKey,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
    )
  : null;

let authUser = null;
let myProfile = null;
let socialTimer = null;
let activityTimer = null;
let seenAcceptedJoinRequests = new Set();
let seenInvites = new Set();
let seenIncomingJoinRequests = new Set();

function notify(text, actions = []) {
  if (!notificationStack) return;
  const el = document.createElement("div");
  el.className = "notificationCard card";
  const body = document.createElement("div");
  body.className = "notificationText";
  body.textContent = text;
  el.appendChild(body);
  if (actions.length) {
    const row = document.createElement("div");
    row.className = "notificationActions";
    actions.forEach(({ label, primary, onClick }) => {
      const btn = document.createElement("button");
      btn.textContent = label;
      if (primary) btn.classList.add("primary");
      btn.onclick = async () => {
        try { await onClick(); } finally { el.remove(); }
      };
      row.appendChild(btn);
    });
    el.appendChild(row);
  }
  notificationStack.appendChild(el);
  if (!actions.length) setTimeout(() => el.remove(), 5200);
}

function openAuthModal(mode = "login") {
  if (!supabaseConfigured) {
    notify("Аккаунты ещё не подключены: добавь SUPABASE_URL и SUPABASE_PUBLISHABLE_KEY в Render.");
    return;
  }
  authModal.classList.remove("hidden");
  authModalBackdrop.classList.remove("hidden");
  setAuthMode(mode);
}
function closeAuthModal() {
  authModal.classList.add("hidden");
  authModalBackdrop.classList.add("hidden");
  authMessage.textContent = "";
}
function setAuthMode(mode) {
  const login = mode === "login";
  loginTabBtn.classList.toggle("active", login);
  registerTabBtn.classList.toggle("active", !login);
  loginForm.classList.toggle("hidden", !login);
  registerForm.classList.toggle("hidden", login);
  authMessage.textContent = "";
}
accountBtn?.addEventListener("click", () => authUser ? openDrawer() : openAuthModal("login"));
drawerLoginBtn?.addEventListener("click", () => openAuthModal("login"));
closeAuthModalBtn?.addEventListener("click", closeAuthModal);
authModalBackdrop?.addEventListener("click", closeAuthModal);
loginTabBtn?.addEventListener("click", () => setAuthMode("login"));
registerTabBtn?.addEventListener("click", () => setAuthMode("register"));

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!sb) return;
  authMessage.textContent = "Входим…";
  const { error } = await sb.auth.signInWithPassword({
    email: loginEmail.value.trim(),
    password: loginPassword.value
  });
  if (error) {
    authMessage.textContent = error.message;
    return;
  }
  closeAuthModal();
});

registerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!sb) return;
  const username = registerUsername.value.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    authMessage.textContent = "@username: 3–24 символа, только латиница, цифры и _.";
    return;
  }
  authMessage.textContent = "Создаём аккаунт…";
  const { data, error } = await sb.auth.signUp({
    email: registerEmail.value.trim(),
    password: registerPassword.value,
    options: {
      data: {
        username,
        display_name: registerDisplayName.value.trim()
      }
    }
  });
  if (error) {
    authMessage.textContent = error.message;
    return;
  }
  if (!data.session) {
    authMessage.textContent = "Аккаунт создан. Подтверди email по письму, затем войди.";
  } else {
    closeAuthModal();
  }
});

logoutBtn?.addEventListener("click", async () => {
  await updateAccountActivity({ forceOffline: true }).catch(() => {});
  await sb?.auth.signOut();
});

async function loadProfile() {
  if (!sb || !authUser) return null;
  const { data, error } = await sb.from("profiles").select("id,username,display_name").eq("id", authUser.id).single();
  if (error) return null;
  myProfile = data;
  return data;
}

async function loadPrivacy() {
  if (!sb || !authUser) return;
  const { data } = await sb.from("privacy_settings")
    .select("show_activity,show_title,allow_join_requests")
    .eq("user_id", authUser.id)
    .single();
  if (!data) return;
  showActivityToggle.checked = !!data.show_activity;
  showTitleToggle.checked = !!data.show_title;
  allowJoinToggle.checked = !!data.allow_join_requests;
}

async function savePrivacy() {
  if (!sb || !authUser) return;
  privacySaveState.textContent = "Сохраняем…";
  const { error } = await sb.from("privacy_settings").upsert({
    user_id: authUser.id,
    show_activity: showActivityToggle.checked,
    show_title: showTitleToggle.checked,
    allow_join_requests: allowJoinToggle.checked,
    updated_at: new Date().toISOString()
  });
  privacySaveState.textContent = error ? "Не удалось сохранить" : "Сохранено ✓";
  setTimeout(() => privacySaveState.textContent = "", 1600);
  await updateAccountActivity();
  await refreshFriends();
}
[showActivityToggle, showTitleToggle, allowJoinToggle].forEach(el => el?.addEventListener("change", savePrivacy));

async function updateAccountActivity({ forceOffline = false } = {}) {
  if (!sb || !authUser) return;
  const watchingTitle = episodeTitle?.value?.trim() || "Сериал";
  const payload = {
    user_id: authUser.id,
    is_online: !forceOffline,
    room_id: forceOffline ? null : (roomId || null),
    watching_title: forceOffline ? null : (roomId ? watchingTitle : null),
    season: forceOffline ? null : (roomId ? Number(seasonInput?.value || 1) : null),
    episode: forceOffline ? null : (roomId ? Number(episodeInput?.value || 1) : null),
    updated_at: new Date().toISOString()
  };
  await sb.from("user_activity").upsert(payload);
}

function renderAccountState() {
  const configured = supabaseConfigured;
  if (!configured) {
    accountBtn.textContent = "👤 Подключить аккаунты";
    accountStateBadge.textContent = "Не подключено";
    guestAccountBox.classList.remove("hidden");
    signedAccountBox.classList.add("hidden");
    return;
  }
  if (!authUser) {
    accountBtn.textContent = "👤 Войти";
    accountStateBadge.textContent = "Гость";
    guestAccountBox.classList.remove("hidden");
    signedAccountBox.classList.add("hidden");
    return;
  }
  accountBtn.textContent = myProfile?.username ? `♥ @${myProfile.username}` : "♥ Аккаунт";
  accountStateBadge.textContent = "В сети";
  guestAccountBox.classList.add("hidden");
  signedAccountBox.classList.remove("hidden");
  profileDisplayName.textContent = myProfile?.display_name || "Профиль";
  profileUsername.textContent = myProfile?.username ? `@${myProfile.username}` : authUser.email;
}

friendSearchBtn?.addEventListener("click", searchPeople);
friendSearchInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); searchPeople(); }
});
refreshFriendsBtn?.addEventListener("click", refreshSocial);

async function searchPeople() {
  if (!sb || !authUser) return openAuthModal("login");
  const q = friendSearchInput.value.trim().replace(/^@/, "").toLowerCase();
  if (!q) return;
  friendSearchResults.innerHTML = '<div class="historyEmpty">Ищем…</div>';
  const { data, error } = await sb.rpc("search_profiles", { search_text: q });
  if (error) {
    friendSearchResults.innerHTML = `<div class="historyEmpty">${escapeHtml(error.message)}</div>`;
    return;
  }
  friendSearchResults.innerHTML = "";
  if (!data?.length) {
    friendSearchResults.innerHTML = '<div class="historyEmpty">Никого не нашли.</div>';
    return;
  }
  data.forEach(person => {
    const row = socialRow(person.display_name || person.username, `@${person.username}`);
    const btn = document.createElement("button");
    btn.className = "primary smallBtn";
    btn.textContent = "Добавить";
    btn.onclick = async () => {
      btn.disabled = true;
      const { error } = await sb.rpc("send_friend_request", { target_username: person.username });
      notify(error ? error.message : `Запрос @${person.username} отправлен 💌`);
      btn.disabled = false;
    };
    row.actions.appendChild(btn);
    friendSearchResults.appendChild(row.el);
  });
}

function socialRow(title, subtitle = "") {
  const el = document.createElement("div");
  el.className = "socialItem";
  const info = document.createElement("div");
  const t = document.createElement("div");
  t.className = "socialTitle";
  t.textContent = title;
  const s = document.createElement("div");
  s.className = "socialMeta";
  s.textContent = subtitle;
  info.append(t, s);
  const actions = document.createElement("div");
  actions.className = "socialActions";
  el.append(info, actions);
  return { el, info, actions, subtitle: s };
}

async function refreshFriendRequests() {
  if (!sb || !authUser) return;
  const { data, error } = await sb.rpc("get_incoming_friend_requests");
  if (error) return;
  friendRequestCount.textContent = String(data?.length || 0);
  friendRequestsList.innerHTML = "";
  if (!data?.length) {
    friendRequestsList.innerHTML = '<div class="historyEmpty">Нет новых запросов.</div>';
    return;
  }
  data.forEach(req => {
    const row = socialRow(req.display_name || req.username, `@${req.username}`);
    const accept = document.createElement("button");
    accept.className = "primary smallBtn";
    accept.textContent = "Принять";
    accept.onclick = () => respondFriend(req.request_id, true);
    const reject = document.createElement("button");
    reject.className = "smallBtn";
    reject.textContent = "Отклонить";
    reject.onclick = () => respondFriend(req.request_id, false);
    row.actions.append(accept, reject);
    friendRequestsList.appendChild(row.el);
  });
}
async function respondFriend(requestId, accept) {
  const { error } = await sb.rpc("respond_friend_request", { request_id: requestId, accept_request: accept });
  if (error) notify(error.message);
  await refreshSocial();
}

async function refreshFriends() {
  if (!sb || !authUser) {
    realFriendsList.innerHTML = '<div class="historyEmpty">Войди в аккаунт, чтобы увидеть друзей.</div>';
    return;
  }
  const { data, error } = await sb.rpc("get_friends");
  if (error) {
    realFriendsList.innerHTML = `<div class="historyEmpty">${escapeHtml(error.message)}</div>`;
    return;
  }
  realFriendsList.innerHTML = "";
  if (!data?.length) {
    realFriendsList.innerHTML = '<div class="historyEmpty">Пока нет друзей. Найди человека по @username.</div>';
    return;
  }
  data.forEach(friend => {
    const online = !!friend.is_online;
    let meta = `${online ? "🟢 В сети" : "⚪ Не в сети"}`;
    if (friend.is_watching) {
      meta += friend.watching_title
        ? ` · 🎬 ${friend.watching_title}${friend.season ? ` · S${friend.season}E${friend.episode || 1}` : ""}`
        : " · 🎬 Смотрит что-то";
    }
    const row = socialRow(friend.display_name || friend.username, `@${friend.username} · ${meta}`);

    if (roomId) {
      const invite = document.createElement("button");
      invite.className = "primary smallBtn";
      invite.textContent = "Пригласить";
      invite.onclick = () => sendRoomInvite(friend.friend_id, friend.username);
      row.actions.appendChild(invite);
    }
    if (friend.can_request_join) {
      const ask = document.createElement("button");
      ask.className = "smallBtn";
      ask.textContent = "Попроситься";
      ask.onclick = () => requestJoin(friend.friend_id, friend.username);
      row.actions.appendChild(ask);
    }
    const remove = document.createElement("button");
    remove.className = "smallBtn";
    remove.textContent = "Удалить";
    remove.onclick = async () => {
      if (!confirm(`Удалить @${friend.username} из друзей?`)) return;
      const { error } = await sb.rpc("remove_friend", { target_user_id: friend.friend_id });
      if (error) notify(error.message);
      await refreshFriends();
    };
    row.actions.appendChild(remove);
    realFriendsList.appendChild(row.el);
  });
}

async function sendRoomInvite(friendId, username) {
  if (!roomId) return notify("Сначала создай или открой комнату.");
  if (latestParticipants.length >= 2) return notify("В комнате уже два человека. Сначала должен освободиться слот.");
  const { error } = await sb.rpc("send_room_invite", { friend_user_id: friendId, invite_room_id: roomId });
  notify(error ? error.message : `Приглашение @${username} отправлено 💌`);
}
async function requestJoin(friendId, username) {
  const { error } = await sb.rpc("request_to_join", { friend_user_id: friendId });
  notify(error ? error.message : `Запрос @${username} отправлен. Ждём ответа 💗`);
}

async function refreshRoomRequests() {
  if (!sb || !authUser) return;
  const [invitesRes, incomingJoinRes, outgoingJoinRes] = await Promise.all([
    sb.rpc("get_incoming_room_invites"),
    sb.rpc("get_incoming_join_requests"),
    sb.rpc("get_outgoing_join_requests")
  ]);
  const invites = invitesRes.data || [];
  const incoming = incomingJoinRes.data || [];
  const outgoing = outgoingJoinRes.data || [];
  roomRequestCount.textContent = String(invites.length + incoming.length);
  roomRequestsList.innerHTML = "";

  if (!invites.length && !incoming.length && !outgoing.some(x => x.status === "pending")) {
    roomRequestsList.innerHTML = '<div class="historyEmpty">Пока пусто.</div>';
  }

  invites.forEach(inv => {
    const row = socialRow(`${inv.display_name || inv.username} приглашает`, `@${inv.username} · комната ${inv.room_id}`);
    const accept = document.createElement("button");
    accept.className = "primary smallBtn";
    accept.textContent = "Войти";
    accept.onclick = () => respondInvite(inv.invite_id, true);
    const reject = document.createElement("button");
    reject.className = "smallBtn";
    reject.textContent = "Отклонить";
    reject.onclick = () => respondInvite(inv.invite_id, false);
    row.actions.append(accept, reject);
    roomRequestsList.appendChild(row.el);

    if (!seenInvites.has(inv.invite_id)) {
      seenInvites.add(inv.invite_id);
      notify(`${inv.display_name || '@'+inv.username} приглашает тебя смотреть вместе 💌`, [
        { label: "Войти", primary: true, onClick: () => respondInvite(inv.invite_id, true) },
        { label: "Не сейчас", onClick: () => respondInvite(inv.invite_id, false) }
      ]);
    }
  });

  incoming.forEach(req => {
    const row = socialRow(`${req.display_name || req.username} хочет присоединиться`, `@${req.username}`);
    const accept = document.createElement("button");
    accept.className = "primary smallBtn";
    accept.textContent = "Разрешить";
    accept.onclick = () => respondJoinRequest(req.request_id, true);
    const reject = document.createElement("button");
    reject.className = "smallBtn";
    reject.textContent = "Отклонить";
    reject.onclick = () => respondJoinRequest(req.request_id, false);
    row.actions.append(accept, reject);
    roomRequestsList.appendChild(row.el);
    if (!seenIncomingJoinRequests.has(req.request_id)) {
      seenIncomingJoinRequests.add(req.request_id);
      notify(`${req.display_name || '@'+req.username} хочет присоединиться к просмотру 💗`, [
        { label: "Разрешить", primary: true, onClick: () => respondJoinRequest(req.request_id, true) },
        { label: "Отклонить", onClick: () => respondJoinRequest(req.request_id, false) }
      ]);
    }
  });

  for (const req of outgoing) {
    if (req.status === "accepted" && req.room_id && !seenAcceptedJoinRequests.has(req.request_id)) {
      seenAcceptedJoinRequests.add(req.request_id);
      notify("Твой запрос приняли 💞 Можно войти в комнату.", [
        { label: "Войти", primary: true, onClick: async () => { sessionStorage.setItem(sessionKey(req.room_id), "1"); location.href = `/room/${encodeURIComponent(req.room_id)}`; } }
      ]);
    }
  }
}

async function respondInvite(inviteId, accept) {
  const { data, error } = await sb.rpc("respond_room_invite", { invite_id: inviteId, accept_invite: accept });
  if (error) return notify(error.message);
  await refreshRoomRequests();
  if (accept && data) { sessionStorage.setItem(sessionKey(data), "1"); location.href = `/room/${encodeURIComponent(data)}`; }
}
async function respondJoinRequest(requestId, accept) {
  if (accept && roomId && latestParticipants.length >= 2) return notify("Комната уже заполнена: в ней два человека.");
  const { data, error } = await sb.rpc("respond_join_request", { request_id: requestId, accept_request: accept });
  if (error) notify(error.message);
  else if (accept) notify("Запрос принят — другу отправлена комната 💞");
  await refreshRoomRequests();
}

async function refreshSocial() {
  renderAccountState();
  if (!sb || !authUser) return;
  await Promise.allSettled([
    loadPrivacy(),
    refreshFriendRequests(),
    refreshFriends(),
    refreshRoomRequests()
  ]);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}

function renderQuickInvite() {
  if (!friendQuickInvite) return;
  friendQuickInvite.innerHTML = "";
  if (!authUser || !sb) {
    friendQuickInvite.innerHTML = '<div class="muted">Войди в аккаунт, чтобы приглашать друзей прямо отсюда.</div>';
    return;
  }
  sb.rpc("get_friends").then(({ data }) => {
    friendQuickInvite.innerHTML = "";
    if (!data?.length) {
      friendQuickInvite.innerHTML = '<div class="muted">Добавь друзей в меню ☰.</div>';
      return;
    }
    const title = document.createElement("div");
    title.className = "quickInviteTitle";
    title.textContent = "Друзья";
    friendQuickInvite.appendChild(title);
    data.slice(0, 8).forEach(friend => {
      const btn = document.createElement("button");
      btn.className = "friendChip";
      btn.textContent = `💌 ${friend.display_name || friend.username}`;
      btn.onclick = () => sendRoomInvite(friend.friend_id, friend.username);
      friendQuickInvite.appendChild(btn);
    });
  });
}

async function handleAuthUser(user) {
  authUser = user || null;
  myProfile = null;
  if (authUser) {
    await loadProfile();
    if (myProfile?.display_name) {
      myName = myProfile.display_name;
      nameInput.value = myName;
      localStorage.setItem("wp_name", myName);
    }
    await updateAccountActivity();
    await refreshSocial();
    clearInterval(socialTimer);
    clearInterval(activityTimer);
    socialTimer = setInterval(() => refreshSocial().catch(() => {}), 9000);
    activityTimer = setInterval(() => updateAccountActivity().catch(() => {}), 30000);
  } else {
    clearInterval(socialTimer);
    clearInterval(activityTimer);
    renderAccountState();
  }
}

async function initAccounts() {
  renderAccountState();
  if (!sb) return;
  const { data } = await sb.auth.getSession();
  await handleAuthUser(data.session?.user || null);
  sb.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => handleAuthUser(session?.user || null).catch(() => {}), 0);
  });
}
initAccounts().catch(console.error);

