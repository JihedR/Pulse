const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const mime = require("mime-types");
const mm = require("music-metadata");

const SUPPORTED_EXTENSIONS = new Set([
  ".mp3",
  ".flac",
  ".wav",
  ".aac",
  ".m4a",
  ".ogg",
  ".opus",
  ".webm"
]);

const COVER_CANDIDATES = ["cover", "artist", "folder", "front", "album", "art"];

app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  win.setMenuBarVisibility(false);
  win.loadFile("index.html");
}

function isSupportedAudioFile(filePath) {
  return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

async function pickCoverFromDisk(audioPath) {
  const dir = path.dirname(audioPath);

  const files = fs.readdirSync(dir, { withFileTypes: true });
  const imageNames = files
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /\.(jpg|jpeg|png|webp)$/i.test(name));

  if (imageNames.length === 0) {
    return null;
  }

  // 1) Exact preferred sidecar names (cover.jpg, artist.jpg, etc.)
  for (const baseName of COVER_CANDIDATES) {
    const hit = imageNames.find((name) => {
      const stem = path.parse(name).name.trim().toLowerCase();
      return stem === baseName;
    });
    if (hit) {
      return fileToDataUrl(path.join(dir, hit));
    }
  }

  // 2) Fuzzy matches (cover-art.jpg, artist photo.png, etc.)
  for (const baseName of COVER_CANDIDATES) {
    const hit = imageNames.find((name) => {
      const stem = path.parse(name).name.trim().toLowerCase();
      return stem.startsWith(baseName) || stem.includes(baseName);
    });
    if (hit) {
      return fileToDataUrl(path.join(dir, hit));
    }
  }

  // 3) Fallback: first image in folder.
  return fileToDataUrl(path.join(dir, imageNames[0]));
}

function fileToDataUrl(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const fileType = mime.lookup(filePath) || "image/jpeg";
  return `data:${fileType};base64,${fileBuffer.toString("base64")}`;
}

function walkDirectory(rootDir) {
  const stack = [rootDir];
  const matches = [];

  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && isSupportedAudioFile(fullPath)) {
        matches.push(fullPath);
      }
    }
  }

  return matches.sort((a, b) => a.localeCompare(b));
}

function collectAudioFromPaths(inputPaths) {
  const found = new Set();

  for (const rawPath of inputPaths) {
    if (!rawPath || !fs.existsSync(rawPath)) {
      continue;
    }

    const stat = fs.statSync(rawPath);
    if (stat.isDirectory()) {
      for (const p of walkDirectory(rawPath)) {
        found.add(p);
      }
      continue;
    }

    if (stat.isFile() && isSupportedAudioFile(rawPath)) {
      found.add(rawPath);
    }
  }

  return Array.from(found).sort((a, b) => a.localeCompare(b));
}

async function buildTrackInfo(filePath) {
  let metadata;

  try {
    metadata = await mm.parseFile(filePath, { duration: true });
  } catch {
    metadata = { common: {}, format: {} };
  }

  const common = metadata.common || {};
  const format = metadata.format || {};
  const title = common.title || path.basename(filePath, path.extname(filePath));
  const artist = common.artist || "Unknown artist";
  const album = common.album || "Unknown album";

  let coverDataUrl = await pickCoverFromDisk(filePath);

  // If no sidecar image exists, fall back to embedded artwork.
  if (!coverDataUrl && Array.isArray(common.picture) && common.picture.length > 0) {
    const picture = common.picture[0];
    const mimeType = picture.format || "image/jpeg";
    coverDataUrl = `data:${mimeType};base64,${picture.data.toString("base64")}`;
  }

  return {
    id: `${filePath}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    path: filePath,
    fileUrl: pathToFileURL(filePath).href,
    title,
    artist,
    album,
    duration: format.duration || 0,
    sampleRate: format.sampleRate || 0,
    codec: format.codec || path.extname(filePath).slice(1).toUpperCase(),
    coverDataUrl
  };
}

async function buildTrackList(paths) {
  const results = [];
  for (const p of paths) {
    results.push(await buildTrackInfo(p));
  }
  return results;
}

ipcMain.handle("pick-audio-files", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Choose audio files",
    properties: ["openFile", "multiSelections"],
    filters: [
      {
        name: "Audio",
        extensions: Array.from(SUPPORTED_EXTENSIONS).map((x) => x.slice(1))
      }
    ]
  });

  if (canceled || filePaths.length === 0) {
    return [];
  }

  const selected = filePaths.filter((p) => isSupportedAudioFile(p));
  return buildTrackList(selected);
});

ipcMain.handle("pick-audio-folder", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Choose a music folder",
    properties: ["openDirectory"]
  });

  if (canceled || filePaths.length === 0) {
    return [];
  }

  const allAudio = walkDirectory(filePaths[0]);
  return buildTrackList(allAudio);
});

ipcMain.handle("load-from-paths", async (_event, inputPaths) => {
  if (!Array.isArray(inputPaths) || inputPaths.length === 0) {
    return [];
  }

  const audioPaths = collectAudioFromPaths(inputPaths);
  return buildTrackList(audioPaths);
});

ipcMain.handle("window-minimize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.minimize();
  }
});

ipcMain.handle("window-toggle-maximize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) {
    return false;
  }

  if (win.isMaximized()) {
    win.unmaximize();
    return false;
  }

  win.maximize();
  return true;
});

ipcMain.handle("window-close", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.close();
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
