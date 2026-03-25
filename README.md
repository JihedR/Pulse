# PulseDeck

PulseDeck is an Electron listening app with:

- FLAC + common audio format loading
- Metadata extraction (title/artist/album/duration/sample rate/codec)
- Cover art support from embedded tags or sidecar image files (cover.jpg/folder.jpg/front.jpg/etc.)
- Fullscreen reactive visualizer with album art in the center
- Playlist + transport controls
- Drag-and-drop for files and folders
- Queue modes: shuffle, repeat all, repeat one, repeat none
- Timeline hover preview with current/total time labels

## Run

1. Install dependencies:
   - `npm install`
2. Start app:
   - `npm start`

### If `npm install` fails on Electron TLS download

If your log shows errors like `ssl3_get_record:decryption failed or bad record mac`, npm is working but Electron's large binary download is getting corrupted by the local TLS path.

Use this fallback:

1. Install packages without postinstall download:
   - `npm install --ignore-scripts`
2. Run the chunked manual installer:
   - `powershell -ExecutionPolicy Bypass -File .\scripts\install-electron-manual.ps1`
3. Start app:
   - `npm start`

## Controls

- `Space`: play/pause
- `F`: toggle fullscreen visualizer mode
- `Shuffle` button: random next/prev track selection
- `Repeat` button: cycle `All -> One -> None`
- Drag files/folders into the window to add music instantly

## Notes

- Supported file extensions include: `.flac`, `.mp3`, `.wav`, `.aac`, `.m4a`, `.ogg`, `.opus`, `.webm`.
- In some Windows environments (VPN/proxy/AV), Electron download can fail with an SSL error during `npm install`. If that happens, retry with a stable network or a mirror for Electron binaries.
