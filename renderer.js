const audio = document.getElementById("audio");
const playlistEl = document.getElementById("playlist");
const titleEl = document.getElementById("track-title");
const artistEl = document.getElementById("track-artist");
const albumEl = document.getElementById("track-album");
const techEl = document.getElementById("track-tech");
const coverEl = document.getElementById("cover-image");
const progressEl = document.getElementById("progress");
const playPauseBtn = document.getElementById("play-pause");
const hudTitleEl = document.getElementById("hud-title");
const hudArtistEl = document.getElementById("hud-artist");
const hudEl = document.getElementById("hud");
const appShell = document.getElementById("app-shell");
const fullscreenDockEl = document.getElementById("fullscreen-dock");
const fsTrackEl = document.getElementById("fs-track");
const fsPrevBtn = document.getElementById("fs-prev");
const fsPlayPauseBtn = document.getElementById("fs-play-pause");
const fsNextBtn = document.getElementById("fs-next");
const fsProgressEl = document.getElementById("fs-progress");
const fsCurrentTimeEl = document.getElementById("fs-current-time");
const fsTotalTimeEl = document.getElementById("fs-total-time");

const addFilesBtn = document.getElementById("add-files");
const addFolderBtn = document.getElementById("add-folder");
const toggleFullscreenBtn = document.getElementById("toggle-fullscreen");
const toggleShuffleBtn = document.getElementById("toggle-shuffle");
const toggleRepeatBtn = document.getElementById("toggle-repeat");
const toggleVisualizerModeBtn = document.getElementById("toggle-visualizer-mode");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const currentTimeEl = document.getElementById("current-time");
const totalTimeEl = document.getElementById("total-time");
const timelinePreviewEl = document.getElementById("timeline-preview");
const dropZoneEl = document.getElementById("drop-zone");
const winMinimizeBtn = document.getElementById("win-minimize");
const winMaximizeBtn = document.getElementById("win-maximize");
const winCloseBtn = document.getElementById("win-close");
const titlebarDragEl = document.getElementById("titlebar-drag");

let tracks = [];
let currentTrackIndex = -1;
let shuffleEnabled = false;
let repeatMode = "all";
let dragDepth = 0;
let visualizerMode = "ring";
let panelHideTimer = null;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 1024;
const source = audioCtx.createMediaElementSource(audio);
source.connect(analyser);
analyser.connect(audioCtx.destination);

const coverFallback =
  "data:image/svg+xml;base64," +
  btoa(`<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='#13314f'/>
        <stop offset='100%' stop-color='#0a1524'/>
      </linearGradient>
    </defs>
    <rect width='100%' height='100%' fill='url(#g)'/>
    <circle cx='150' cy='150' r='72' fill='none' stroke='#2ee5a8' stroke-width='8' opacity='0.8'/>
    <circle cx='150' cy='150' r='9' fill='#2ee5a8'/>
  </svg>`);

const visualCover = new Image();
visualCover.src = coverFallback;

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "--:--";
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
}

function updateQueueModeButtons() {
  toggleShuffleBtn.textContent = `Shuffle: ${shuffleEnabled ? "On" : "Off"}`;
  toggleRepeatBtn.textContent = `Repeat: ${repeatMode.charAt(0).toUpperCase()}${repeatMode.slice(1)}`;
}

function setNowPlaying(track) {
  titleEl.textContent = track.title;
  artistEl.textContent = track.artist;
  albumEl.textContent = track.album;
  techEl.textContent = `${track.codec} | ${track.sampleRate || "?"} Hz | ${formatDuration(track.duration)}`;

  const currentCover = track.coverDataUrl || coverFallback;
  coverEl.src = currentCover;
  visualCover.src = currentCover;

  hudTitleEl.textContent = track.title;
  hudArtistEl.textContent = `${track.artist} - ${track.album}`;
  fsTrackEl.textContent = `${track.title} - ${track.artist}`;
}

function clearNowPlaying() {
  titleEl.textContent = "No track loaded";
  artistEl.textContent = "Pick files or a folder to begin";
  albumEl.textContent = "";
  techEl.textContent = "";
  coverEl.src = coverFallback;
  visualCover.src = coverFallback;
  hudTitleEl.textContent = "No track";
  hudArtistEl.textContent = "";
  fsTrackEl.textContent = "No track";
  playPauseBtn.textContent = "Play";
  fsPlayPauseBtn.textContent = "Play";
  progressEl.value = "0";
  fsProgressEl.value = "0";
  currentTimeEl.textContent = "0:00";
  totalTimeEl.textContent = "0:00";
  fsCurrentTimeEl.textContent = "0:00";
  fsTotalTimeEl.textContent = "0:00";
}

function renderPlaylist() {
  playlistEl.innerHTML = "";

  tracks.forEach((track, index) => {
    const li = document.createElement("li");
    if (index === currentTrackIndex) {
      li.classList.add("active");
    }

    li.innerHTML = `<div class="playlist-item-main"><strong>${track.title}</strong><span>${track.artist}</span></div><button class="remove-track" title="Remove track" aria-label="Remove track">x</button>`;
    li.addEventListener("click", () => playTrack(index));

    const removeBtn = li.querySelector(".remove-track");
    removeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      removeTrack(index);
    });

    playlistEl.appendChild(li);
  });
}

async function removeTrack(index) {
  if (index < 0 || index >= tracks.length) {
    return;
  }

  const wasCurrent = index === currentTrackIndex;
  tracks.splice(index, 1);

  if (tracks.length === 0) {
    currentTrackIndex = -1;
    audio.pause();
    audio.src = "";
    renderPlaylist();
    clearNowPlaying();
    return;
  }

  if (index < currentTrackIndex) {
    currentTrackIndex -= 1;
  }

  if (wasCurrent) {
    const nextIndex = Math.min(index, tracks.length - 1);
    await playTrack(nextIndex);
    return;
  }

  renderPlaylist();
}

async function addTracks(newTracks) {
  if (!Array.isArray(newTracks) || newTracks.length === 0) {
    return;
  }

  const known = new Set(tracks.map((track) => track.path));
  const deduped = newTracks.filter((track) => track.path && !known.has(track.path));
  tracks = tracks.concat(deduped);

  if (tracks.length > 0 && currentTrackIndex === -1) {
    await playTrack(0);
  } else {
    renderPlaylist();
  }
}

async function ensureAudioCtx() {
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }
}

async function playTrack(index) {
  if (index < 0 || index >= tracks.length) {
    return;
  }

  currentTrackIndex = index;
  const track = tracks[index];
  audio.src = track.fileUrl;

  setNowPlaying(track);
  renderPlaylist();

  await ensureAudioCtx();
  await audio.play();
  playPauseBtn.textContent = "Pause";
  fsPlayPauseBtn.textContent = "Pause";
}

function playNext() {
  if (tracks.length === 0) {
    return;
  }

  if (repeatMode === "one") {
    playTrack(currentTrackIndex);
    return;
  }

  if (shuffleEnabled && tracks.length > 1) {
    let next = currentTrackIndex;
    while (next === currentTrackIndex) {
      next = Math.floor(Math.random() * tracks.length);
    }
    playTrack(next);
    return;
  }

  if (currentTrackIndex >= tracks.length - 1) {
    if (repeatMode === "all") {
      playTrack(0);
    } else {
      audio.pause();
      audio.currentTime = 0;
      playPauseBtn.textContent = "Play";
      fsPlayPauseBtn.textContent = "Play";
    }
    return;
  }

  const next = currentTrackIndex + 1;
  playTrack(next);
}

function playPrev() {
  if (tracks.length === 0) {
    return;
  }
  if (shuffleEnabled && tracks.length > 1) {
    let prev = currentTrackIndex;
    while (prev === currentTrackIndex) {
      prev = Math.floor(Math.random() * tracks.length);
    }
    playTrack(prev);
    return;
  }

  if (currentTrackIndex <= 0) {
    if (repeatMode === "all") {
      playTrack(tracks.length - 1);
    } else {
      playTrack(0);
    }
    return;
  }

  const prev = currentTrackIndex - 1;
  playTrack(prev);
}

audio.addEventListener("ended", playNext);

audio.addEventListener("timeupdate", () => {
  if (!audio.duration || !Number.isFinite(audio.duration)) {
    progressEl.value = 0;
    fsProgressEl.value = 0;
    currentTimeEl.textContent = "0:00";
    fsCurrentTimeEl.textContent = "0:00";
    return;
  }

  const progress = Math.floor((audio.currentTime / audio.duration) * 1000);
  progressEl.value = String(progress);
  fsProgressEl.value = String(progress);
  currentTimeEl.textContent = formatDuration(audio.currentTime);
  totalTimeEl.textContent = formatDuration(audio.duration);
  fsCurrentTimeEl.textContent = formatDuration(audio.currentTime);
  fsTotalTimeEl.textContent = formatDuration(audio.duration);
});

progressEl.addEventListener("input", () => {
  if (!audio.duration || !Number.isFinite(audio.duration)) {
    return;
  }

  const nextTime = (Number(progressEl.value) / 1000) * audio.duration;
  audio.currentTime = nextTime;
});

fsProgressEl.addEventListener("input", () => {
  if (!audio.duration || !Number.isFinite(audio.duration)) {
    return;
  }

  const nextTime = (Number(fsProgressEl.value) / 1000) * audio.duration;
  audio.currentTime = nextTime;
});

async function togglePlayback() {
  if (tracks.length === 0) {
    return;
  }

  await ensureAudioCtx();

  if (audio.paused) {
    await audio.play();
    playPauseBtn.textContent = "Pause";
    fsPlayPauseBtn.textContent = "Pause";
  } else {
    audio.pause();
    playPauseBtn.textContent = "Play";
    fsPlayPauseBtn.textContent = "Play";
  }
}

playPauseBtn.addEventListener("click", togglePlayback);
fsPlayPauseBtn.addEventListener("click", togglePlayback);

addFilesBtn.addEventListener("click", async () => {
  const selected = await window.musicApp.pickAudioFiles();
  addTracks(selected);
});

addFolderBtn.addEventListener("click", async () => {
  const selected = await window.musicApp.pickAudioFolder();
  addTracks(selected);
});

toggleShuffleBtn.addEventListener("click", () => {
  shuffleEnabled = !shuffleEnabled;
  updateQueueModeButtons();
});

toggleRepeatBtn.addEventListener("click", () => {
  if (repeatMode === "all") {
    repeatMode = "one";
  } else if (repeatMode === "one") {
    repeatMode = "none";
  } else {
    repeatMode = "all";
  }
  updateQueueModeButtons();
});

prevBtn.addEventListener("click", playPrev);
nextBtn.addEventListener("click", playNext);
fsPrevBtn.addEventListener("click", playPrev);
fsNextBtn.addEventListener("click", playNext);

toggleFullscreenBtn.addEventListener("click", toggleFullscreen);

winMinimizeBtn.addEventListener("click", () => {
  window.musicApp.windowMinimize();
});

winMaximizeBtn.addEventListener("click", async () => {
  const maximized = await window.musicApp.windowToggleMaximize();
  winMaximizeBtn.textContent = maximized ? "<>" : "[]";
});

winCloseBtn.addEventListener("click", () => {
  window.musicApp.windowClose();
});

titlebarDragEl.addEventListener("dblclick", async () => {
  const maximized = await window.musicApp.windowToggleMaximize();
  winMaximizeBtn.textContent = maximized ? "<>" : "[]";
});

document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "f") {
    toggleFullscreen();
  }

  if (event.code === "Space") {
    event.preventDefault();
    playPauseBtn.click();
  }
});

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
    return;
  }

  document.documentElement.requestFullscreen().catch(() => {
    // Ignore rejection when fullscreen is blocked by platform restrictions.
  });
}

function syncFullscreenUi(isFullscreen) {
  appShell.classList.toggle("fullscreen", isFullscreen);
  hudEl.classList.toggle("hidden", !isFullscreen);
  if (!isFullscreen) {
    appShell.classList.remove("bottom-peek");
  }
}

document.addEventListener("fullscreenchange", () => {
  syncFullscreenUi(Boolean(document.fullscreenElement));
});

syncFullscreenUi(Boolean(document.fullscreenElement));

function clearPanelHideTimer() {
  if (panelHideTimer) {
    clearTimeout(panelHideTimer);
    panelHideTimer = null;
  }
}

function showBottomPanelPeek() {
  if (!document.fullscreenElement) {
    return;
  }
  clearPanelHideTimer();
  appShell.classList.add("bottom-peek");
}

function hideBottomPanelSoon(delayMs = 120) {
  if (!document.fullscreenElement) {
    return;
  }

  clearPanelHideTimer();
  panelHideTimer = setTimeout(() => {
    if (!fullscreenDockEl.matches(":hover")) {
      appShell.classList.remove("bottom-peek");
    }
  }, delayMs);
}

document.addEventListener("mousemove", (event) => {
  if (!document.fullscreenElement) {
    return;
  }

  const revealThreshold = window.innerHeight - 20;
  if (event.clientY >= revealThreshold) {
    showBottomPanelPeek();
    return;
  }

  const dockTop = fullscreenDockEl.getBoundingClientRect().top;
  if (!fullscreenDockEl.matches(":hover") && event.clientY < dockTop - 12) {
    hideBottomPanelSoon(90);
  }
});

fullscreenDockEl.addEventListener("mouseenter", () => {
  clearPanelHideTimer();
});

fullscreenDockEl.addEventListener("mouseleave", () => {
  hideBottomPanelSoon(80);
});

function updateVisualizerModeButton() {
  toggleVisualizerModeBtn.textContent = `Visualizer: ${visualizerMode === "ring" ? "Ring" : "Vinyl"}`;
}

toggleVisualizerModeBtn.addEventListener("click", () => {
  visualizerMode = visualizerMode === "ring" ? "vinyl" : "ring";
  updateVisualizerModeButton();
});

function getPreviewFromMouseEvent(event) {
  const rect = progressEl.getBoundingClientRect();
  const relativeX = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
  const ratio = rect.width > 0 ? relativeX / rect.width : 0;
  return {
    leftPx: relativeX,
    seconds: ratio * (Number.isFinite(audio.duration) ? audio.duration : 0)
  };
}

function showTimelinePreview(event) {
  const preview = getPreviewFromMouseEvent(event);
  timelinePreviewEl.textContent = formatDuration(preview.seconds);
  timelinePreviewEl.style.left = `${preview.leftPx}px`;
  timelinePreviewEl.classList.add("visible");
}

progressEl.addEventListener("mousemove", showTimelinePreview);
progressEl.addEventListener("mouseenter", showTimelinePreview);
progressEl.addEventListener("mouseleave", () => {
  timelinePreviewEl.classList.remove("visible");
});

async function handleDrop(event) {
  event.preventDefault();
  dragDepth = 0;
  dropZoneEl.classList.add("hidden");

  const items = Array.from(event.dataTransfer?.files || []);
  const rawPaths = items.map((file) => file.path).filter(Boolean);
  if (rawPaths.length === 0) {
    return;
  }

  const loaded = await window.musicApp.loadFromPaths(rawPaths);
  addTracks(loaded);
}

document.addEventListener("dragenter", (event) => {
  event.preventDefault();
  dragDepth += 1;
  dropZoneEl.classList.remove("hidden");
});

document.addEventListener("dragover", (event) => {
  event.preventDefault();
});

document.addEventListener("dragleave", (event) => {
  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) {
    dropZoneEl.classList.add("hidden");
  }
});

document.addEventListener("drop", handleDrop);

const canvas = document.getElementById("visualizer");
const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
const dataArray = new Uint8Array(analyser.frequencyBinCount);
const waveformArray = new Uint8Array(analyser.fftSize);
let visualTick = 0;
let rafId = 0;
let lastPaintAt = performance.now();

function resizeCanvas() {
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.floor(width * devicePixelRatio);
  canvas.height = Math.floor(height * devicePixelRatio);
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function drawVisualizerFrame() {
  const targetWidth = Math.max(1, Math.floor(canvas.clientWidth * devicePixelRatio));
  const targetHeight = Math.max(1, Math.floor(canvas.clientHeight * devicePixelRatio));
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  analyser.getByteFrequencyData(dataArray);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  visualTick += 0.012;

  ctx.clearRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2;
  const coverRadius = Math.max(80, Math.min(width, height) * 0.14);

  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i];
  }
  const avg = sum / dataArray.length;
  const pulse = (avg / 255) * 25;

  if (visualizerMode === "vinyl") {
    drawVinylVisualizer(width, height, avg);
    lastPaintAt = performance.now();
    return;
  }

  if (visualizerMode === "scope") {
    drawScopeVisualizer(width, height, avg);
    lastPaintAt = performance.now();
    return;
  }

  // Vintage-industrial halo
  ctx.beginPath();
  ctx.arc(cx, cy, coverRadius + 30 + pulse, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(193, 134, 58, ${0.12 + (avg / 255) * 0.24})`;
  ctx.lineWidth = 24;
  ctx.stroke();

  // Ring etch for old-meter style
  ctx.beginPath();
  ctx.arc(cx, cy, coverRadius + 54, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(184, 172, 141, 0.18)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Vintage spokes
  const barCount = 100; // Reduced from 150
  const maxBarHeight = Math.min(width, height) * 0.28;
  const angleStep = (Math.PI * 2) / barCount;

  for (let i = 0; i < barCount; i++) {
    const angle = angleStep * i + visualTick;
    
    // Use a smaller portion of the frequency data
    const dataIndex = Math.floor((i / barCount) * (analyser.frequencyBinCount * 0.3));
    const rawEnergy = dataArray[dataIndex] / 255;
    const baselineMotion = 0.06 + Math.abs(Math.sin(visualTick + i * 0.22)) * 0.06;
    const energy = rawEnergy * rawEnergy * rawEnergy + baselineMotion;

    const inner = coverRadius + 40;
    const bar = 2 + energy * maxBarHeight;

    const x1 = cx + Math.cos(angle) * inner;
    const y1 = cy + Math.sin(angle) * inner;
    const x2 = cx + Math.cos(angle) * (inner + bar);
    const y2 = cy + Math.sin(angle) * (inner + bar);

    // Brass/sepia palette for vintage industrial look
    const hue = 32 + energy * 12;
    const lightness = 32 + energy * 34;
    const alpha = 0.3 + energy * 0.5;

    ctx.strokeStyle = `hsla(${hue}, 62%, ${lightness}%, ${alpha})`;
    ctx.lineWidth = 2 + energy * 2;
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Draw album art
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, coverRadius, 0, Math.PI * 2);
  ctx.clip();
  try {
    ctx.drawImage(visualCover, cx - coverRadius, cy - coverRadius, coverRadius * 2, coverRadius * 2);
  } catch {
    ctx.fillStyle = "#1b1b1b";
    ctx.fillRect(cx - coverRadius, cy - coverRadius, coverRadius * 2, coverRadius * 2);
  }
  ctx.restore();

  // Art border
  ctx.beginPath();
  ctx.arc(cx, cy, coverRadius, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(210, 193, 156, 0.22)";
  ctx.lineWidth = 1;
  ctx.stroke();
  
  ctx.beginPath();
  ctx.arc(cx, cy, coverRadius + 2, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();

  lastPaintAt = performance.now();
}

function drawVinylVisualizer(width, height, avg) {
  const cx = width * 0.52;
  const cy = height * 0.54;
  const radius = Math.min(width, height) * 0.32;
  const beat = Math.min(1, avg / 255);

  const bg = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 1.6);
  bg.addColorStop(0, "rgba(22, 20, 17, 0.9)");
  bg.addColorStop(1, "rgba(6, 6, 6, 0.96)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Platter shadow
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 18, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0, 0, 0, 0.36)";
  ctx.fill();

  // Vinyl disc body
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  const discGrad = ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius);
  discGrad.addColorStop(0, "rgba(36, 36, 36, 1)");
  discGrad.addColorStop(1, "rgba(10, 10, 10, 1)");
  ctx.fillStyle = discGrad;
  ctx.fill();

  // Groove rings
  ctx.strokeStyle = "rgba(182, 166, 132, 0.08)";
  for (let i = 0; i < 22; i++) {
    const r = radius * (0.18 + i * 0.035);
    if (r >= radius * 0.96) {
      break;
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Outer rotating strobe ticks
  const tickCount = 96;
  const tickBase = visualTick * 0.6;
  for (let i = 0; i < tickCount; i++) {
    const t = i / tickCount;
    const a = t * Math.PI * 2 + tickBase;
    const e = dataArray[Math.floor(t * dataArray.length)] / 255;
    const tickIn = radius + 8;
    const tickOut = tickIn + 10 + e * 9;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * tickIn, cy + Math.sin(a) * tickIn);
    ctx.lineTo(cx + Math.cos(a) * tickOut, cy + Math.sin(a) * tickOut);
    ctx.strokeStyle = `rgba(212, 161, 84, ${0.3 + e * 0.5})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Center label (album art clipped in circle)
  const labelR = radius * 0.34;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, labelR, 0, Math.PI * 2);
  ctx.clip();
  try {
    const rot = visualTick * 0.28;
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.drawImage(visualCover, -labelR, -labelR, labelR * 2, labelR * 2);
  } catch {
    ctx.fillStyle = "#26201a";
    ctx.fillRect(cx - labelR, cy - labelR, labelR * 2, labelR * 2);
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, labelR, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(215, 180, 118, 0.32)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Spindle
  ctx.beginPath();
  ctx.arc(cx, cy, 6 + beat * 2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(232, 204, 156, 0.95)";
  ctx.fill();

  // Tonearm
  const baseX = cx + radius * 0.88;
  const baseY = cy - radius * 0.86;
  const armAngle = Math.PI * (0.72 + beat * 0.08);
  const armLen = radius * 0.92;
  const tipX = baseX + Math.cos(armAngle) * armLen;
  const tipY = baseY + Math.sin(armAngle) * armLen;

  ctx.beginPath();
  ctx.arc(baseX, baseY, 10, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(148, 132, 101, 0.9)";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.lineTo(tipX, tipY);
  ctx.strokeStyle = "rgba(206, 188, 152, 0.85)";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - 12, tipY + 16);
  ctx.strokeStyle = "rgba(244, 198, 110, 0.9)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawScopeVisualizer(width, height, avg) {
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "rgba(11, 10, 9, 0.9)");
  bg.addColorStop(1, "rgba(6, 6, 6, 0.94)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(198, 166, 112, 0.08)";
  ctx.lineWidth = 1;
  for (let y = 0; y < height; y += 36) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
    ctx.stroke();
  }
  for (let x = 0; x < width; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
    ctx.stroke();
  }

  const barCount = 72;
  const barGap = 2;
  const barWidth = Math.max(3, Math.floor(width / barCount) - barGap);
  const maxBarHeight = height * 0.5;

  for (let i = 0; i < barCount; i++) {
    const dataIndex = Math.floor((i / barCount) * (analyser.frequencyBinCount * 0.8));
    const energy = dataArray[dataIndex] / 255;
    const heightBase = Math.max(0.03, energy * energy);
    const h = maxBarHeight * (heightBase + Math.sin(visualTick + i * 0.12) * 0.03 + 0.02);

    const x = i * (barWidth + barGap);
    const y = height - h - 18;

    const barGrad = ctx.createLinearGradient(0, y, 0, y + h);
    barGrad.addColorStop(0, "rgba(232, 198, 138, 0.88)");
    barGrad.addColorStop(1, "rgba(150, 102, 40, 0.66)");
    ctx.fillStyle = barGrad;
    ctx.fillRect(x, y, barWidth, h);
  }

  analyser.getByteTimeDomainData(waveformArray);
  const midY = height * 0.34;
  ctx.beginPath();
  for (let i = 0; i < waveformArray.length; i++) {
    const x = (i / (waveformArray.length - 1)) * width;
    const y = midY + ((waveformArray[i] - 128) / 128) * 58;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.strokeStyle = "rgba(228, 194, 132, 0.86)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const meterCx = width - 130;
  const meterCy = 90;
  const meterR = 58;
  const t = Math.min(1, avg / 255);
  const angle = Math.PI * (1.08 + t * 0.84);

  ctx.beginPath();
  ctx.arc(meterCx, meterCy, meterR, Math.PI * 1.06, Math.PI * 1.94);
  ctx.strokeStyle = "rgba(190, 160, 110, 0.42)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(meterCx, meterCy);
  ctx.lineTo(meterCx + Math.cos(angle) * (meterR - 8), meterCy + Math.sin(angle) * (meterR - 8));
  ctx.strokeStyle = "rgba(245, 214, 164, 0.95)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(meterCx, meterCy, 5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(226, 191, 134, 0.95)";
  ctx.fill();
}

function startVisualizerLoop() {
  const frame = () => {
    try {
      drawVisualizerFrame();
    } catch (err) {
      console.error("Visualizer frame error", err);
      lastPaintAt = performance.now();
    }
    rafId = requestAnimationFrame(frame);
  };

  if (rafId) {
    cancelAnimationFrame(rafId);
  }

  rafId = requestAnimationFrame(frame);
}

// Some Electron + GPU combinations intermittently stall RAF until window invalidation.
// Watchdog forces loop restart if no paint happened recently.
setInterval(() => {
  if (performance.now() - lastPaintAt > 300) {
    startVisualizerLoop();
  }
}, 200);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    startVisualizerLoop();
  }
});

startVisualizerLoop();
updateQueueModeButtons();
updateVisualizerModeButton();
