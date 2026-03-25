const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("musicApp", {
  pickAudioFiles: () => ipcRenderer.invoke("pick-audio-files"),
  pickAudioFolder: () => ipcRenderer.invoke("pick-audio-folder"),
  loadFromPaths: (paths) => ipcRenderer.invoke("load-from-paths", paths),
  windowMinimize: () => ipcRenderer.invoke("window-minimize"),
  windowToggleMaximize: () => ipcRenderer.invoke("window-toggle-maximize"),
  windowClose: () => ipcRenderer.invoke("window-close")
});
