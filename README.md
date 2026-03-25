# PulseDeck

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
