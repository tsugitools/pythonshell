# PythonShell Design

PythonShell is a standalone in-browser Python playground: a simple IDE with a multi-file workspace and a tiny simulated shell. It borrows Pyodide and Ace patterns from [PythonGrader](../pythongrader/DESIGN.md), but it is not a grader and does not require an LTI launch.

This document is intentionally implementation-oriented. The first version should be small, understandable, and useful for experimentation before richer terminal or course-integration features are added.

## Core principle

> Visit a URL and start coding. Work stays in the browser.

PythonShell is an experimentation space, not an assessment tool. There is no Grade button, no unittest harness, and no server-side save. Clearing browser storage loses the workspace; that trade-off is accepted and documented in the UI.

## Goals

- Run real Python in the browser with no server-side code execution.
- Support a fast **Edit → Run → Inspect** learner loop.
- Provide a multi-file editor workspace (create, open, rename, delete).
- Provide a deliberately small simulated shell (`python`, `ls`, `cat`, and a few companions).
- Persist the workspace only in `localStorage`.
- Work without an LTI launch: opening the tool URL is enough.
- Capture standard output, standard error, exceptions, and tracebacks.
- Stop runaway programs by terminating their Web Worker.
- Keep the runtime understandable by forking and sliming PythonGrader patterns rather than inventing a shared framework.

## Non-goals

PythonShell will not initially:

- require or use an LTI launch session;
- submit grades, attempts, or LTI score passback;
- provide unittest evaluation or instructor assignment authoring;
- save work on the application server;
- execute Python on the application server;
- emulate a full Unix shell, pipes, redirects, globbing, or a real PTY;
- provide a live Python REPL (Phase 1 is a command shell that can run files);
- provide a separate stdin textarea (input() prompts in the shell);
- support arbitrary native Python packages beyond the pinned Pyodide standard library;
- emulate operating-system processes, sockets, or unrestricted networking;
- claim high-stakes exam security;
- share a generalized runtime package with PythonGrader.

The browser is an educational execution environment, not a hostile-code sandbox.

## Relationship to PythonGrader

PythonShell reuses conventions and runtime ideas, not a shared library:

| Borrow from PythonGrader | Skip |
| ------------------------ | ---- |
| Ace vendor and editor init | Grade / dirty-for-grade lifecycle |
| Worker lifecycle, request IDs, timeout terminate | `harness.py`, evaluation, score UI |
| Clean work directory, FS write, stdout/stderr capture | `student-save.php`, `save.php`, catalog, Udemy |
| Pinned Pyodide version (0.27.5) | Settings / exercise picker / author mode |
| Exception sanitize / output truncation | LTI bootstrap fields (`PYTHONGRADER`, grade URLs) |

Copy and slim the relevant files into this repository. Do not import JavaScript or workers across tool directories in Phase 1.

## Learner experience

The basic page contains:

- a file tree (new file, rename, delete);
- a multi-file Ace editor with open tabs;
- a shell panel with a `$` prompt (`input()` prompts appear here);
- **Run** (current file), **Restart runtime**, and **Reset workspace** actions;
- a clear notice that work is stored only in this browser.

The learner workflow is:

1. Open the tool URL (no login or LTI required).
2. Edit `main.py` or create additional files.
3. Press **Run**, or type `python main.py` in the shell.
4. Inspect shell output or correct a syntax/runtime error.
5. Use `ls` and `cat` to explore the workspace.
6. Return later in the same browser; the workspace restores from `localStorage`.

Phase 1 is a **command shell**, not a Python REPL. The prompt is `$`, not `>>>`. Typing bare Python expressions at the prompt is not supported; learners run files with `python`.

## High-level architecture

```text
Static page (index.html or thin index.php)
        |
        | window.PYTHONSHELL bootstrap
        | (paths, Pyodide pin, defaults, storage key)
        v
Browser application
        |
        +-- file tree + Ace multi-file editor
        +-- localStorage workspace persistence
        +-- shell UI (prompt, history, output)
        |
        +-- Pyodide Web Worker
                |
                +-- virtual cwd /home/pyodide/work
                +-- workspace files synced into FS before python runs
                +-- run selected file or `python foo.py`
```

The server only serves static assets (and optionally a thin HTML shell). It never evaluates student Python and never stores student files.

## Repository layout

```text
pythonshell/
├── DESIGN.md
├── README.md
├── index.html              # preferred entry; thin index.php optional
├── css/
│   └── pythonshell.css
├── js/
│   ├── pythonshell.js      # UI: files, editor, shell wiring
│   ├── workspace.js        # localStorage model
│   ├── shell.js            # command parser + builtins
│   ├── runtime.js          # worker client (slimmed from pythongrader)
│   └── vendor/
│       └── ace/            # pinned Ace build
└── worker/
    ├── pyodide-worker.js
    └── result.py           # exception sanitize / truncate helpers
```

No `register.php`, grade endpoints, or assignment catalog in Phase 1. If the playground is later linked from a course navigation page, that link is just a normal URL to this tool.

## Bootstrap data

The page exposes a small configuration object:

```javascript
window.PYTHONSHELL = {
    pyodideVersion: '0.27.5',
    workerUrl: 'worker/pyodide-worker.js',
    storageKey: 'pythonshell-workspace-v1',
    defaultTimeoutMs: 5000,
    maxFileBytes: 200000,
    maxFiles: 40
};
```

No user identity, link id, or CSRF tokens are required for Phase 1.

## Workspace and localStorage

The editor workspace is the source of truth for files. One JSON object is stored under a stable `localStorage` key:

```json
{
  "schema": "pythonshell-workspace",
  "version": 1,
  "files": {
    "main.py": "print('Hello from PythonShell')\n"
  },
  "activeFile": "main.py",
  "openTabs": ["main.py"],
  "cwd": ".",
  "stdin": "",
  "updatedAt": "2026-07-31T00:00:00.000Z"
}
```

Rules:

- Debounce writes on edit (similar cadence to PythonGrader’s autosave, but local only).
- When storage is empty or invalid, seed a tiny default workspace with `main.py`.
- **Reset workspace** clears the key and restores defaults after confirmation.
- Enforce `maxFiles` and `maxFileBytes`; reject or block oversized writes and warn in the UI.
- Filenames must be safe relative paths: no absolute paths, no `..`, no empty segments; allow simple nested paths only if the UI supports folders (Phase 1 may stay flat: `name.ext` only).
- There is no cross-device or cross-browser sync. Document that clearing site data loses work.

Phase 1 recommendation: keep the namespace **flat** (no directories in the file tree) so `ls`, `cat`, and `cd` stay trivial. Nested folders can wait for Phase 2.

## Simulated shell

JavaScript parses each command line. Only `python` talks to the Pyodide worker. Builtins such as `ls` and `cat` read the workspace model in the main thread.

### Phase 1 command set

| Command | Behavior |
| ------- | -------- |
| `help` | List supported commands |
| `ls` `[path]` | List workspace files (default: cwd / root) |
| `cat` `<file>` | Print file contents from the workspace |
| `pwd` | Print current virtual directory |
| `cd` `[path]` | Change virtual directory within the workspace root only |
| `python` `<file.py>` | Sync workspace → worker FS, run file as `__main__` |
| `clear` | Clear shell scrollback |
| `echo` `[args...]` | Print arguments (trivial nicety) |

Unsupported commands print a short friendly error, for example:

```text
bash: foo: command not found
Type 'help' for supported commands.
```

(Use a consistent prefix such as `shell:` rather than pretending to be bash if that feels clearer during implementation.)

### Explicit shell non-features (Phase 1)

- No pipes (`|`), redirection (`>`, `<`), or globbing (`*`).
- No background jobs or process control.
- No real environment variables beyond a fixed cosmetic prompt.
- No interactive Python REPL at the `$` prompt.
- `cd` cannot escape the workspace root.

### Run consistency

The toolbar **Run** action and shell `python <file>` must share the same worker run path:

1. Flush the active editor buffer into the workspace model.
2. Persist to `localStorage` (debounced or immediate before run).
3. Project all workspace files into the worker work directory.
4. Set cwd, `sys.path`, and batch stdin.
5. Execute the target file with `runpy.run_path(..., run_name='__main__')`.
6. Append stdout, stderr, and sanitized exceptions to the shell output.

## Virtual filesystem

```text
Editor workspace (JS + localStorage)
        |
        | sync before each python run
        v
Worker FS: /home/pyodide/work/
├── main.py
├── helper.py
└── ...
```

- Each `python` run gets a clean work directory projection (same spirit as PythonGrader’s `resetWorkDir`).
- `ls`, `cat`, rename, and delete operate on the workspace model, not by spawning shell processes inside Pyodide.
- After a run, files created or modified by student Python may be harvested back into the workspace:
  - Phase 1: auto-merge new or changed non-reserved filenames into the workspace and refresh the file tree; or list them and offer **Keep**.
  - Reserved / internal names used by the runtime must never be imported as editable workspace files.

Mount and filename validation rejects absolute paths, `..`, and unsafe characters, following PythonGrader’s `isSafeMount` rules adapted for a multi-file playground (no collision with internal helper modules).

## Standard input and output

For **Run** / `python`:

- `sys.stdin` is an `io.StringIO` containing the complete contents of the stdin textarea.
- `input()` may echo prompts into captured stdout (same approach as PythonGrader).
- When stdin is exhausted, `input()` raises `EOFError`.
- stdout and stderr are captured and shown in the shell panel.
- Output is truncated after configured character and line limits.

Live line-at-a-time stdin is deferred.

## Pyodide runtime

### Loading

Pyodide is loaded from one pinned version (start from PythonGrader’s pin: **0.27.5**). Prefer a stable static location when available; do not request “latest” from a CDN in production.

UI states:

```text
Loading Python → Ready → Running → Complete
                           |
                           +→ Timed out / worker replaced
```

Do not enable **Run** or `python` until the worker is ready. Show honest loading progress on first visit.

### Worker requirement

Pyodide always runs inside a Web Worker. Running arbitrary learner Python on the main UI thread is not acceptable because an infinite loop would freeze the page.

The parent owns the timeout:

1. Send a run request with a unique request ID.
2. Start a timer.
3. Accept only messages with the current request ID.
4. On timeout, terminate the worker.
5. Report a timeout in the shell.
6. Create and initialize a replacement worker.

### Worker reuse

Normal runs may reuse a warm worker. Every execution still gets a clean working directory and clean module state. After a timeout, internal worker error, or failed reset, discard and rebuild the worker.

### Worker message protocol

Messages are versioned:

```json
{
  "protocol_version": 1,
  "request_id": "run-42",
  "operation": "run",
  "payload": {
    "files": {
      "main.py": "print(1)\n"
    },
    "entry": "main.py",
    "stdin": "",
    "timeout_ms": 5000
  }
}
```

The worker replies with `loading`, `ready`, `running`, `complete`, or `worker_error`. There is no `grade` operation.

Example completion:

```json
{
  "protocol_version": 1,
  "request_id": "run-42",
  "operation": "run",
  "status": "complete",
  "stdout": "1\n",
  "stderr": "",
  "exception": null,
  "duration_ms": 18,
  "created_files": []
}
```

`created_files` (or a richer file delta) may support post-run harvest. The browser ignores stale responses from a terminated or superseded request.

## UI sketch

```text
+------------------+----------------------------------------+
| Files            | main.py  | helper.py |                 |
|                  |----------------------------------------|
| main.py          |                                          |
| helper.py        |           Ace editor                     |
| [+ New file]     |                                          |
+------------------+----------------------------------------+
| Stdin (optional) | Shell                                    |
|                  | $ python main.py                         |
|                  | Hello from PythonShell                   |
|                  | $ ls                                     |
|                  | helper.py  main.py                       |
|                  | $ _                                      |
+------------------+----------------------------------------+
| [Run] [Restart runtime] [Reset workspace]   Python: Ready |
+-----------------------------------------------------------+
```

Layout notes:

- IDE-first: file tree left, editor center/top, shell bottom (or right on wide screens).
- Shell prompt is `$` to signal a command shell, not a REPL.
- Status line shows runtime state: Loading / Ready / Running / Timed out.
- Every control has a visible label; Run and shell input are keyboard accessible.

## Security and trust model

- Student code runs only in the browser.
- The application server never executes submitted Python and never stores the workspace.
- Worker termination protects UI responsiveness, not the learner’s browser from every possible vulnerability.
- Pyodide and Ace are pinned.
- Remote network access from Python is unavailable by default.
- Filenames and paths are validated before FS writes.
- Output and tracebacks are size-limited before display or storage in `localStorage`.
- `localStorage` is origin-scoped and visible to other scripts on the same origin; do not store secrets.

The design does not claim high-stakes exam security.

## Error categories

Errors should be visibly categorized:

- **Student syntax error** — invalid Python source.
- **Student runtime error** — exception while running student code.
- **Timeout** — worker was terminated.
- **Shell error** — unknown command, missing file, bad path.
- **Workspace error** — quota exceeded, invalid filename, storage failure.
- **Runtime error** — Pyodide or worker failed to initialize.

## Performance

Phase 1 targets are pragmatic:

- the UI remains responsive during Python execution;
- repeat runs use browser-cached Pyodide assets;
- normal introductory programs complete within the default timeout;
- output is truncated after configured limits;
- file counts and sizes have conservative limits;
- the worker is replaced after a timeout without requiring a page reload.

## Accessibility

- Every editor, file, and shell control has a visible label.
- Run, Restart, Reset, and shell submission are keyboard accessible.
- Status changes use an appropriate live region.
- Output and tracebacks are selectable text.
- The editor has a plain-textarea fallback on very small viewports if Ace is impractical.
- Reduced-motion preferences are respected.

## Testing strategy

### Workspace

- default seed when storage empty;
- save and restore round-trip;
- reset restores defaults;
- reject unsafe filenames;
- enforce max files and max bytes;
- corrupt JSON falls back to seed with a warning.

### Shell builtins

- `help`, `ls`, `cat`, `pwd`, `cd`, `echo`, `clear`;
- unknown command message;
- `cat` missing file;
- `cd` cannot leave workspace root;
- no pipe/redirect parsing.

### Worker runtime

- `print()` capture;
- `stderr` capture;
- syntax error;
- runtime exception;
- `input()` with batch stdin and exhausted input;
- multi-file import (`import helper`);
- infinite loop timeout and worker recovery;
- oversized output truncation;
- post-run file harvest for a simple `open(..., "w")` case.

### Browser

Test at least current Firefox, Chrome, and Safari on desktop. Phone layouts are best-effort only.

## Implementation phases

### Phase 0 — Runtime spike

Prove the risky pieces on a static page:

- load pinned Pyodide in a Web Worker;
- edit one file;
- run via button and via a fake shell `python main.py`;
- capture stdout, stderr, syntax errors, and exceptions;
- terminate an infinite loop and recover with a new worker.

Success criterion: repeated runs without reloading the page. The spike may be discarded.

### Phase 1 — Small complete playground

Deliver:

- static entry page with bootstrap config;
- file tree + multi-file Ace editor;
- `localStorage` workspace persistence and reset;
- shell panel with the Phase 1 command set;
- shared Run path for toolbar and `python`;
- batch stdin textarea;
- worker timeout recovery;
- basic post-run file harvest or keep prompt;
- README with usage and storage caveats.

Keep Phase 1 to:

- flat multi-file workspace;
- standard library only;
- command shell (not REPL);
- no LTI;
- no grading;
- no server-side save.

Success criteria:

- a learner can open the URL, edit multiple files, run them, and reload the page without losing work in the same browser;
- `ls` / `cat` / `python` behave consistently with the editor;
- an infinite loop does not require closing the tab.

### Phase 2 — Better playground ergonomics

Add only after Phase 1 is stable:

- richer file harvest UX;
- better stdin UX;
- additional commands (`touch`, `rm`, `mv`, `mkdir`) if still needed;
- optional shallow folders;
- clearer syntax-error annotations in the editor;
- download / upload a workspace ZIP entirely in browser memory.

### Explicitly deferred

- live Python REPL;
- interactive line-at-a-time `input()`;
- LTI wrapper or grade passback;
- unittest grading (use PythonGrader);
- micropip / extra packages;
- notebooks;
- collaborative editing;
- real PTY or xterm.js full terminal emulation;
- a generalized shared runtime framework with PythonGrader.

## Decisions that should remain firm

- Browser execution only.
- Pyodide always runs in a Web Worker.
- No LTI dependency for use.
- No server-side save; `localStorage` only.
- No grading in this tool.
- The shell is a simulation over the workspace model, not bash.
- Toolbar **Run** and shell `python` share one execution path.
- PHP/HTML stays thin and never executes Python.
- Fork and slim PythonGrader runtime code; do not abstract a shared framework in Phase 1.
- Simplicity beats abstraction.

## Final acceptance checklist

Phase 1 is complete when all are true:

- [ ] Pyodide version is pinned.
- [ ] All learner Python runs in a Web Worker.
- [ ] Infinite-loop timeout and worker recovery are tested.
- [ ] Multi-file create / open / rename / delete works.
- [ ] Workspace persists in `localStorage` and restores on reload.
- [ ] Reset workspace restores defaults.
- [ ] Shell supports `help`, `ls`, `cat`, `pwd`, `cd`, `python`, `clear`, and `echo`.
- [ ] Unknown commands show a helpful error.
- [ ] Standard input, stdout, stderr, syntax errors, and exceptions work.
- [ ] No LTI launch is required to use the tool.
- [ ] No grade or server save endpoints are required.
- [ ] README documents local-only storage and data-loss expectations.
