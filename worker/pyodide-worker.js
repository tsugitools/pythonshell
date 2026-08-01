/**
 * PythonShell Pyodide Web Worker.
 * Loads a pinned Pyodide build and runs a multi-file workspace entry point.
 *
 * input() is interactive: student input() calls are AST-rewritten to await a
 * JS Promise so the worker event loop can receive stdin_response messages.
 *
 * Message protocol (DESIGN.md):
 *   { protocol_version, request_id, operation, payload }
 * Replies:
 *   { protocol_version, request_id, operation, status, ... }
 */
'use strict';

var PROTOCOL_VERSION = 1;
var PYODIDE_VERSION = '0.27.5';
var PYODIDE_INDEX = 'https://cdn.jsdelivr.net/pyodide/v' + PYODIDE_VERSION + '/full/';
var WORK_DIR = '/home/pyodide/work';
var MAX_OUTPUT_CHARS = 100000;
var RESERVED_NAMES = { 'result.py': true };

var pyodide = null;
var resultSource = null;
var ready = false;
var currentRunRequestId = null;
var stdinWaiter = null;

function reply(requestId, operation, status, extra) {
    var msg = Object.assign(
        {
            protocol_version: PROTOCOL_VERSION,
            request_id: requestId,
            operation: operation,
            status: status
        },
        extra || {}
    );
    self.postMessage(msg);
}

function truncateOutput(text) {
    if (text == null) return '';
    text = String(text);
    if (text.length <= MAX_OUTPUT_CHARS) return text;
    return text.slice(0, MAX_OUTPUT_CHARS - 20) + '\n... [truncated]';
}

function workerUrl(relativePath) {
    try {
        return new URL(relativePath, self.location.href).href;
    } catch (e) {
        return relativePath;
    }
}

async function fetchText(url) {
    var res = await fetch(url);
    if (!res.ok) {
        throw new Error('Failed to fetch ' + url + ' (' + res.status + ')');
    }
    return await res.text();
}

async function ensureResultSource() {
    if (resultSource) return;
    resultSource = await fetchText(workerUrl('./result.py'));
}

async function loadPyodideRuntime() {
    if (pyodide) return pyodide;
    reply(null, 'init', 'loading', {
        message: 'Loading Pyodide ' + PYODIDE_VERSION + '…'
    });
    importScripts(PYODIDE_INDEX + 'pyodide.js');
    pyodide = await loadPyodide({
        indexURL: PYODIDE_INDEX
    });
    await ensureResultSource();
    return pyodide;
}

function resetWorkDir() {
    var FS = pyodide.FS;
    try {
        if (FS.analyzePath(WORK_DIR).exists) {
            var walk = function (path) {
                var entries = FS.readdir(path);
                for (var i = 0; i < entries.length; i++) {
                    var name = entries[i];
                    if (name === '.' || name === '..') continue;
                    var child = path + '/' + name;
                    var stat = FS.stat(child);
                    if (FS.isDir(stat.mode)) {
                        walk(child);
                        FS.rmdir(child);
                    } else {
                        FS.unlink(child);
                    }
                }
            };
            walk(WORK_DIR);
        } else {
            FS.mkdirTree(WORK_DIR);
        }
    } catch (e) {
        try {
            FS.mkdirTree(WORK_DIR);
        } catch (e2) {
            /* ignore */
        }
    }
    FS.writeFile(WORK_DIR + '/result.py', resultSource);
}

function isSafeFilename(name) {
    if (!name || typeof name !== 'string') return false;
    name = name.replace(/\\/g, '/');
    if (!name || name.charAt(0) === '/' || name.indexOf('..') >= 0) return false;
    if (RESERVED_NAMES[name]) return false;
    return /^[A-Za-z0-9._][A-Za-z0-9._-]*$/.test(name);
}

function writeWorkspaceFiles(files) {
    var FS = pyodide.FS;
    var names = Object.keys(files || {});
    for (var i = 0; i < names.length; i++) {
        var name = names[i];
        if (!isSafeFilename(name)) {
            throw new Error('Invalid workspace filename: ' + name);
        }
        FS.writeFile(WORK_DIR + '/' + name, files[name] == null ? '' : String(files[name]));
    }
}

function listWorkFiles() {
    var FS = pyodide.FS;
    var out = {};
    var entries = FS.readdir(WORK_DIR);
    for (var i = 0; i < entries.length; i++) {
        var name = entries[i];
        if (name === '.' || name === '..') continue;
        if (RESERVED_NAMES[name]) continue;
        var full = WORK_DIR + '/' + name;
        var stat = FS.stat(full);
        if (FS.isDir(stat.mode)) continue;
        if (!isSafeFilename(name)) continue;
        try {
            out[name] = FS.readFile(full, { encoding: 'utf8' });
        } catch (e) {
            /* skip unreadable */
        }
    }
    return out;
}

function prepareExecution(files) {
    resetWorkDir();
    writeWorkspaceFiles(files);
    pyodide.runPython(
        [
            'import os, sys, importlib',
            'os.chdir(' + JSON.stringify(WORK_DIR) + ')',
            'work = ' + JSON.stringify(WORK_DIR),
            'if work in sys.path:',
            '    sys.path.remove(work)',
            'sys.path.insert(0, work)',
            'for name in list(sys.modules):',
            "    if name in ('result',) or name.startswith('_pythonshell'):",
            '        del sys.modules[name]',
            'for name in list(sys.modules):',
            '    mod = sys.modules.get(name)',
            '    path = getattr(mod, "__file__", None) or ""',
            '    if path.startswith(work + "/"):',
            '        del sys.modules[name]',
            'importlib.invalidate_caches()'
        ].join('\n')
    );
}

function parsePythonJson(globalName) {
    var raw = pyodide.globals.get(globalName);
    var text = typeof raw === 'string' ? raw : String(raw);
    return JSON.parse(text);
}

function fileDelta(before, after) {
    var created = [];
    var changed = [];
    var names = Object.keys(after || {});
    for (var i = 0; i < names.length; i++) {
        var name = names[i];
        if (!(name in before)) {
            created.push(name);
        } else if (before[name] !== after[name]) {
            changed.push(name);
        }
    }
    return { created: created, changed: changed, files: after };
}

function rejectStdinWaiter(err) {
    if (stdinWaiter) {
        var w = stdinWaiter;
        stdinWaiter = null;
        w.reject(err || new Error('stdin cancelled'));
    }
}

/**
 * Called from Python via await js.pythonshellReadline(prompt).
 * Yields the worker event loop so stdin_response can resolve this Promise.
 */
self.pythonshellReadline = function (prompt) {
    prompt = prompt == null ? '' : String(prompt);
    return new Promise(function (resolve, reject) {
        rejectStdinWaiter(new Error('superseded'));
        stdinWaiter = { resolve: resolve, reject: reject };
        reply(currentRunRequestId, 'run', 'stdin', { prompt: prompt });
    });
};

self.pythonshellFlushOutput = function (text) {
    text = text == null ? '' : String(text);
    if (!text) return;
    reply(currentRunRequestId, 'run', 'stdout', {
        stdout: truncateOutput(text)
    });
};

async function runWorkspace(payload) {
    var files = (payload && payload.files) || {};
    var entry = (payload && payload.entry) || 'main.py';

    if (!isSafeFilename(entry)) {
        throw new Error('Invalid entry filename: ' + entry);
    }
    if (!(entry in files)) {
        throw new Error('Entry file not in workspace: ' + entry);
    }

    prepareExecution(files);
    var before = listWorkFiles();

    // Patch input() with run_sync(Promise) so sync student code (including
    // input inside def) can wait while the worker still processes stdin_response.
    var setupCode = [
        'import io, sys, json, time, runpy, builtins',
        'from pyodide.ffi import run_sync',
        'import js',
        'from result import format_exception',
        '',
        '_stdout = io.StringIO()',
        '_stderr = io.StringIO()',
        'sys.stdout = _stdout',
        'sys.stderr = _stderr',
        '',
        'def __pythonshell_input__(prompt=""):',
        '    text = _stdout.getvalue()',
        '    if text:',
        '        js.pythonshellFlushOutput(text)',
        '        _stdout.seek(0)',
        '        _stdout.truncate(0)',
        '    line = run_sync(js.pythonshellReadline("" if prompt is None else str(prompt)))',
        '    line = "" if line is None else str(line)',
        '    if line.endswith("\\n"):',
        '        line = line[:-1]',
        '    if line.endswith("\\r"):',
        '        line = line[:-1]',
        '    return line',
        '',
        'builtins.input = __pythonshell_input__',
        '',
        '_entry = ' + JSON.stringify(entry),
        '_started = time.perf_counter()',
        '_exc = None',
        'try:',
        '    runpy.run_path(_entry, run_name="__main__")',
        'except SystemExit:',
        '    pass',
        'except Exception as e:',
        '    _exc = format_exception(e)',
        '_duration_ms = int(round((time.perf_counter() - _started) * 1000))',
        '_result_json = json.dumps({',
        "    'stdout': _stdout.getvalue(),",
        "    'stderr': _stderr.getvalue(),",
        "    'exception': _exc,",
        "    'duration_ms': _duration_ms,",
        '})'
    ].join('\n');

    // runPythonAsync allows run_sync to suspend and service stdin_response.
    await pyodide.runPythonAsync(setupCode);
    var result = parsePythonJson('_result_json');
    var after = listWorkFiles();
    var delta = fileDelta(before, after);

    return {
        stdout: truncateOutput(result.stdout),
        stderr: truncateOutput(result.stderr),
        exception: result.exception || null,
        duration_ms: result.duration_ms || 0,
        created_files: delta.created,
        changed_files: delta.changed,
        harvested_files: delta.files
    };
}

self.onmessage = async function (ev) {
    var msg = ev.data || {};
    var requestId = msg.request_id;
    var operation = msg.operation;
    var payload = msg.payload || {};

    try {
        if (operation === 'stdin_response') {
            if (stdinWaiter) {
                var w = stdinWaiter;
                stdinWaiter = null;
                w.resolve(payload.line == null ? '' : String(payload.line));
            }
            return;
        }

        if (operation === 'init') {
            await loadPyodideRuntime();
            ready = true;
            reply(requestId, 'init', 'ready', {
                pyodide_version: PYODIDE_VERSION,
                message: 'Pyodide ready'
            });
            return;
        }

        if (!ready || !pyodide) {
            await loadPyodideRuntime();
            ready = true;
        }

        if (operation === 'run') {
            currentRunRequestId = requestId;
            rejectStdinWaiter(new Error('new run'));
            reply(requestId, 'run', 'running');
            try {
                var runResult = await runWorkspace(payload);
                reply(requestId, 'run', 'complete', {
                    stdout: runResult.stdout,
                    stderr: runResult.stderr,
                    exception: runResult.exception || null,
                    duration_ms: runResult.duration_ms,
                    created_files: runResult.created_files,
                    changed_files: runResult.changed_files,
                    harvested_files: runResult.harvested_files
                });
            } finally {
                currentRunRequestId = null;
                rejectStdinWaiter(new Error('run finished'));
            }
            return;
        }

        reply(requestId, operation || 'unknown', 'worker_error', {
            message: 'Unknown operation: ' + operation
        });
    } catch (err) {
        currentRunRequestId = null;
        rejectStdinWaiter(err);
        reply(requestId, operation || 'unknown', 'worker_error', {
            message: (err && err.message) || String(err),
            traceback: (err && err.stack) || ''
        });
    }
};
