# PythonShell desktop

Thin Electron window around the static PythonShell playground. The website is unchanged: this app serves the same `index.html` and `static/` files over a stable `pythonshell://app/` origin so Web Workers work and `localStorage` persists across launches.

The workspace is **not** stored as real disk files. Upload/download still use the in-page file picker, same as [shell.py4e.com](https://shell.py4e.com/). First launch needs internet so Pyodide can load from jsDelivr; later launches reuse Chromium’s cache.

Interactive `input()` needs Chromium JSPI (WebAssembly stack switching). The app enables that at launch (`WebAssemblyExperimentalJSPI`) and uses Electron 37+ (Chromium 138), where JSPI is on by default.

## Run from source

Requires Node.js 20+.

```bash
cd desktop
npm install
npm start
```

The window loads the files in the parent directory (`../index.html`, `../static/`), so you can edit the playground and reload.

`npm start` still shows as **Electron** in the macOS dock because it launches the Electron binary. Packaged installers are named **PythonShell**.

Electron keeps its own profile, so the desktop workspace is separate from Chrome/Firefox `localStorage`.

## Build installers

From `desktop/`:

```bash
npm run dist        # current OS
npm run dist:mac    # macOS .dmg (universal)
npm run dist:win    # Windows NSIS .exe and AppX/MSIX
npm run dist:linux  # Linux AppImage
```

Output is written to `desktop/dist/`.

Tagged releases (`v0.9.2`, …) are built for Mac, Windows, and Linux by `.github/workflows/release.yml`.

## macOS Gatekeeper (Sequoia and Tahoe)

The Mac `.dmg` is **not signed or notarized**. On Tahoe, Gatekeeper shows “PythonShell Not Opened” (Apple could not verify it) and often **moves the app to the Trash**.

1. Drag `PythonShell.app` out of Trash into `/Applications`.
2. Clear the download quarantine and open it:

```bash
xattr -cr /Applications/PythonShell.app
open /Applications/PythonShell.app
```

Alternatively: System Settings → Privacy & Security → **Open Anyway**.

Right-click → Open does **not** work on Sequoia/Tahoe. The lasting fix is an Apple Developer ID and notarization.

Windows SmartScreen may warn on the unsigned `.exe`. The tagged Windows build also includes an unsigned `.msix` (same package as AppX). Sideload it in Developer Mode:

```powershell
Add-AppxPackage .\PythonShell-0.9.2-win-x64.msix
```

Without a signing certificate, MSIX will not install on a stock Windows machine the way the NSIS `.exe` does. The Store would re-sign it if this app is ever submitted there.
