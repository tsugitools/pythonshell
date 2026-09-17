# PythonShell

Standalone in-browser Python playground: multi-file editor, tiny Linux-like shell, Pyodide in a Web Worker.

No LTI launch. No grading. Work is saved only in **localStorage** in this browser.

See [DESIGN.md](DESIGN.md) for architecture and goals.

## Use

Serve this directory over HTTP (Web Workers and ES modules-adjacent fetches require a real origin; `file://` will not work reliably).

Examples:

```bash
# from this directory
python3 -m http.server 8765
# open http://localhost:8765/
```

Or place the folder under your course / Tsugi `mod/` tree and open its URL.

## Desktop app

A downloadable Electron wrapper (Mac, Windows, Linux) lives in [`desktop/`](desktop/). It serves the same static files over `pythonshell://app/` so Web Workers and `localStorage` work without a random localhost port.

```bash
cd desktop
npm install
npm start
```

To build installers for the OS you are on:

```bash
cd desktop
npm run dist        # current OS; on this Mac also the App Store .pkg if the profile is present
```

Output is `desktop/dist/`. Other targets (`dist:mac`, `dist:win`, `dist:linux`, Mac App Store `dist:mas`) are in [desktop/README.md](desktop/README.md). The playground is unchanged: workspace stays in `localStorage`, not on the real disk. The desktop app bundles Pyodide, so Python starts offline; the website still needs internet on first visit.

**Install locally on a Mac** (the unsigned `.dmg`, not the App Store `.pkg`):

1. `open dist/PythonShell-*-mac-universal.dmg`.
2. Drag `PythonShell.app` into `/Applications`.
3. Clear Gatekeeper quarantine and launch (Sequoia/Tahoe will otherwise refuse it and often **move the app to the Trash**):

```bash
xattr -cr /Applications/PythonShell.app
open /Applications/PythonShell.app
```

Or System Settings → Privacy & Security → **Open Anyway**. Right-click → Open does not work on Tahoe.

Installers for tagged releases: [github.com/tsugitools/pythonshell/releases](https://github.com/tsugitools/pythonshell/releases). Windows SmartScreen may warn on the unsigned `.exe`. Tagged Windows releases also include an unsigned `.msix` (sideload in Developer Mode; the NSIS installer is the usual path).

## Learner flow

1. Open the page — no login required.
2. Edit `hello.py` or create more files (+ / rename / delete).
3. Press **Run**, or type `python hello.py` in the shell.
4. When `input()` runs, answer in the shell (the `$` prompt becomes the Python prompt).
5. Use `ls`, `rm`, `help`, etc.
6. Reload the page; the workspace restores from localStorage.

## Shell commands

| Command | Purpose |
| ------- | ------- |
| `help` | List commands |
| `ls` | List files |
| `rm <file...>` | Delete file(s) (cannot remove the last file) |
| `upload` | Open a file picker to upload into the workspace |
| `download <file>` | Download a file to your computer |
| `pwd` / `cd` | Working directory (flat workspace root) |
| `python --version` / `python -V` | Show the Pyodide Python version |
| `python <file.py>` | Run a file |
| `echo` / `clear` | Niceties |

Pipes, redirects, globs, and a Python REPL are not supported.

## Storage warning

- Workspace key: `pythonshell-workspace-v1` (see `window.PYTHONSHELL.storageKey`).
- Clearing site data, using another browser, or private mode can lose work.
- **Reset workspace** clears localStorage for this tool and restores defaults: `hello.py`, `main.py`, `about.txt`, `romeo.txt`, and `mbox-short.txt` (from `static/files/`).

## Caching

- Put a long TTL on `/static/*` (Cloudflare or similar).
- Leave `index.html` lightly cached or bypassed so clients see updated `workerUrl` `?v=N` values.
- After editing `static/worker/`, run `./scripts/bump-worker-cache.sh`.

## Runtime

- Pyodide **0.27.5** (website: CDN on first load, then browser-cached; desktop app: bundled).
- Always runs in a Web Worker; infinite loops time out and the worker is replaced.
- Ace editor (vendored under `static/js/vendor/ace/`).

## Relationship to PythonGrader

PythonShell forks slimmed runtime ideas from [PythonGrader](../pythongrader/). It does not share code at runtime and does not grade assignments. Use PythonGrader for scored exercises.
