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
npm run dist:win    # Windows NSIS .exe
npm run dist:linux  # Linux AppImage
```

Output is written to `desktop/dist/`.

Unsigned builds: on macOS, right-click the app and choose Open the first time. Windows SmartScreen may warn until the binaries are signed.

Tagged releases (`v1.0.0`, …) are built for Mac, Windows, and Linux by `.github/workflows/release.yml`.
