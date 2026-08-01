# PythonShell

Standalone in-browser Python playground: multi-file editor, tiny simulated shell, Pyodide in a Web Worker.

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

## Learner flow

1. Open the page — no login required.
2. Edit `main.py` or create more files (+ / rename / delete).
3. Press **Run**, or type `python main.py` in the shell.
4. When `input()` runs, answer in the shell (the `$` prompt becomes the Python prompt).
5. Use `ls`, `cat`, `rm`, `help`, etc.
6. Reload the page; the workspace restores from localStorage.

## Shell commands

| Command | Purpose |
| ------- | ------- |
| `help` | List commands |
| `ls` | List files |
| `cat <file>` | Show file |
| `rm <file...>` | Delete file(s) (cannot remove the last file) |
| `pwd` / `cd` | Working directory (flat workspace root) |
| `python <file.py>` | Run a file |
| `echo` / `clear` | Niceties |

Pipes, redirects, globs, and a Python REPL are not supported.

## Storage warning

- Workspace key: `pythonshell-workspace-v1` (see `window.PYTHONSHELL.storageKey`).
- Clearing site data, using another browser, or private mode can lose work.
- **Reset workspace** clears localStorage for this tool and restores defaults: `main.py`, `romeo.txt`, and `mbox-short.txt` (from `files/`).

## Runtime

- Pyodide **0.27.5** (CDN on first load; then browser-cached).
- Always runs in a Web Worker; infinite loops time out and the worker is replaced.
- Ace editor (vendored under `js/vendor/ace/`).

## Relationship to PythonGrader

PythonShell forks slimmed runtime ideas from [PythonGrader](../pythongrader/). It does not share code at runtime and does not grade assignments. Use PythonGrader for scored exercises.
