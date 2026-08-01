/**
 * PythonShell UI — file tree, Ace editor, shell wiring.
 */
(function () {
    'use strict';

    var cfg = window.PYTHONSHELL || {};
    var workspace = null;
    var shell = null;
    var runtime = null;
    var editor = null;
    var ignoreAceChange = false;
    var busy = false;
    var awaitingInput = false;
    var inputPrompt = '';
    var history = [];
    var historyIndex = 0;
    var historyDraft = '';
    var HISTORY_MAX = 200;

    function $(sel) {
        return document.querySelector(sel);
    }

    function announce(msg) {
        var el = $('#a11y-status');
        if (el) el.textContent = msg || '';
    }

    function setStatus(kind, text) {
        var el = $('#runtime-status');
        if (!el) return;
        el.textContent = text;
        el.className = 'status' + (kind ? ' is-' + kind : '');
    }

    function setShellPrompt(text) {
        var el = $('.shell-prompt');
        if (el) el.textContent = text;
    }

    function enterInputMode(prompt) {
        awaitingInput = true;
        inputPrompt = prompt == null ? '' : String(prompt);
        setShellPrompt(inputPrompt);
        setStatus('running', 'Waiting for input…');
        announce('Python is waiting for input');
        var shellInput = $('#shell-input');
        if (shellInput) {
            shellInput.disabled = false;
            shellInput.placeholder = 'Type a response, then Enter';
            shellInput.focus();
        }
        var runBtn = $('#btn-run');
        if (runBtn) runBtn.disabled = true;
    }

    function exitInputMode() {
        awaitingInput = false;
        inputPrompt = '';
        setShellPrompt('$');
        var shellInput = $('#shell-input');
        if (shellInput) {
            shellInput.placeholder = 'help, ls, rm, python main.py';
        }
    }

    function isPythonFile(name) {
        return /\.py$/i.test(name || '');
    }

    function updateRunButtonVisibility() {
        var runBtn = $('#btn-run');
        if (!runBtn || !workspace) return;
        var active = workspace.getState().activeFile;
        var show = isPythonFile(active);
        runBtn.hidden = !show;
        if (!show) {
            runBtn.disabled = true;
        } else {
            runBtn.disabled = busy || !(runtime && runtime.isReady());
        }
    }

    function setBusy(isBusy) {
        busy = !!isBusy;
        var restartBtn = $('#btn-restart');
        var shellInput = $('#shell-input');
        updateRunButtonVisibility();
        // Restart stays available so a stuck input()/run can be killed.
        if (restartBtn) restartBtn.disabled = !runtime;
        if (shellInput) shellInput.disabled = busy && !awaitingInput;
    }

    function appendShell(text, className) {
        var out = $('#shell-output');
        if (!out || text == null || text === '') return;
        var div = document.createElement('div');
        div.className = className || 'line-out';
        div.textContent = text;
        out.appendChild(div);
        out.scrollTop = out.scrollHeight;
    }

    function clearShell() {
        var out = $('#shell-output');
        if (out) out.innerHTML = '';
    }

    function formatException(exc) {
        if (!exc) return '';
        var parts = [];
        if (exc.traceback) parts.push(exc.traceback);
        else {
            parts.push((exc.type || 'Error') + ': ' + (exc.message || ''));
        }
        return parts.join('\n');
    }

    function flushEditorToWorkspace() {
        var st = workspace.getState();
        var name = st.activeFile;
        var content;
        if (editor) {
            content = editor.getValue();
        } else {
            var ta = $('#source-fallback');
            content = ta ? ta.value : '';
        }
        workspace.setFileContent(name, content);
        workspace.flushPersist();
    }

    function downloadWorkspaceFile(name) {
        flushEditorToWorkspace();
        if (!name || workspace.getFile(name) == null) {
            return { ok: false, error: 'File not found: ' + name };
        }
        var content = workspace.getFile(name);
        var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 1000);
        announce('Downloaded ' + name);
        return { ok: true };
    }

    function basenameFromUpload(path) {
        var name = String(path || '').replace(/\\/g, '/');
        var slash = name.lastIndexOf('/');
        if (slash >= 0) name = name.slice(slash + 1);
        return name;
    }

    function readUploadedFile(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
                resolve(reader.result == null ? '' : String(reader.result));
            };
            reader.onerror = function () {
                reject(new Error('Could not read ' + (file && file.name)));
            };
            reader.readAsText(file);
        });
    }

    function uploadFiles(fileList) {
        var files = Array.prototype.slice.call(fileList || []);
        if (!files.length) return Promise.resolve([]);

        flushEditorToWorkspace();

        var results = [];
        var chain = Promise.resolve();
        files.forEach(function (file) {
            chain = chain.then(function () {
                var name = basenameFromUpload(file.name);
                if (!workspace.isSafeFilename(name)) {
                    results.push({ ok: false, name: name || file.name, error: 'Invalid filename' });
                    return;
                }
                if (workspace.getFile(name) != null) {
                    if (!window.confirm('Replace existing file "' + name + '"?')) {
                        results.push({ ok: false, name: name, error: 'Skipped' });
                        return;
                    }
                }
                return readUploadedFile(file).then(function (text) {
                    var res = workspace.putFile(name, text, { activate: true });
                    if (!res.ok) {
                        results.push({ ok: false, name: name, error: res.error });
                    } else {
                        results.push({
                            ok: true,
                            name: name,
                            overwritten: !!res.overwritten
                        });
                    }
                });
            });
        });

        return chain.then(function () {
            loadActiveIntoEditor();
            renderFiles();
            renderTabs();
            return results;
        });
    }

    function openUploadPicker() {
        var input = $('#file-upload-input');
        if (!input) return;
        input.value = '';
        input.click();
    }

    function loadActiveIntoEditor() {
        var st = workspace.getState();
        var content = workspace.getFile(st.activeFile) || '';
        ignoreAceChange = true;
        if (editor) {
            editor.setValue(content, -1);
            editor.session.setMode(
                isPythonFile(st.activeFile) ? 'ace/mode/python' : 'ace/mode/text'
            );
            editor.clearSelection();
        }
        var ta = $('#source-fallback');
        if (ta) ta.value = content;
        ignoreAceChange = false;
        updateRunButtonVisibility();
    }

    function renderFiles() {
        var st = workspace.getState();
        var list = $('#file-list');
        if (!list) return;
        list.innerHTML = '';
        workspace.listFiles().forEach(function (name) {
            var li = document.createElement('li');
            if (name === st.activeFile) li.className = 'active';
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'file-item';
            btn.textContent = name;
            btn.addEventListener('click', function () {
                flushEditorToWorkspace();
                workspace.setActiveFile(name);
                loadActiveIntoEditor();
                renderFiles();
                renderTabs();
            });
            li.appendChild(btn);
            list.appendChild(li);
        });
    }

    function renderTabs() {
        var st = workspace.getState();
        var tabs = $('#tabs');
        if (!tabs) return;
        tabs.innerHTML = '';
        st.openTabs.forEach(function (name) {
            var tab = document.createElement('div');
            tab.className = 'tab' + (name === st.activeFile ? ' active' : '');
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-selected', name === st.activeFile ? 'true' : 'false');

            var openBtn = document.createElement('button');
            openBtn.type = 'button';
            openBtn.className = 'tab-open';
            openBtn.textContent = name;
            openBtn.addEventListener('click', function () {
                flushEditorToWorkspace();
                workspace.setActiveFile(name);
                loadActiveIntoEditor();
                renderFiles();
                renderTabs();
            });

            var closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'tab-close';
            closeBtn.setAttribute('aria-label', 'Close ' + name);
            closeBtn.textContent = '×';
            closeBtn.addEventListener('click', function (ev) {
                ev.stopPropagation();
                flushEditorToWorkspace();
                var res = workspace.closeTab(name);
                if (!res.ok) {
                    appendShell(res.error, 'line-err');
                    return;
                }
                loadActiveIntoEditor();
                renderFiles();
                renderTabs();
            });

            tab.appendChild(openBtn);
            tab.appendChild(closeBtn);
            tabs.appendChild(tab);
        });
    }

    function initEditor() {
        var ta = $('#source-fallback');
        var wrap = $('#editor-wrap');
        if (!ta || !wrap || typeof ace === 'undefined') return;
        if (window.matchMedia && window.matchMedia('(max-width: 480px)').matches) {
            return;
        }

        var host = document.createElement('div');
        host.id = 'ace-host';
        host.setAttribute('role', 'presentation');
        wrap.insertBefore(host, ta);

        ta.classList.add('ace-backed');
        ta.setAttribute('aria-hidden', 'true');
        ta.setAttribute('tabindex', '-1');

        ace.config.set('basePath', 'static/js/vendor/ace');
        editor = ace.edit(host);
        editor.setTheme('ace/theme/chrome');
        editor.session.setMode('ace/mode/python');
        editor.setShowPrintMargin(false);
        editor.session.setTabSize(4);
        editor.session.setUseSoftTabs(true);
        editor.session.setUseWorker(false);
        editor.setOptions({
            fontSize: '15px',
            fontFamily: 'IBM Plex Mono, Courier, monospace',
            showLineNumbers: true,
            highlightActiveLine: true,
            behavioursEnabled: true,
            wrap: false
        });
        editor.session.on('change', function () {
            if (ignoreAceChange) return;
            var st = workspace.getState();
            workspace.setFileContent(st.activeFile, editor.getValue());
        });
        try {
            var aceInput = editor.textInput && editor.textInput.getElement
                ? editor.textInput.getElement()
                : null;
            if (aceInput) aceInput.setAttribute('aria-label', 'Code editor');
        } catch (e) { /* ignore */ }
        editor.resize();
    }

    function harvestFromResult(msg) {
        if (!msg || !msg.harvested_files) return;
        var names = []
            .concat(msg.created_files || [])
            .concat(msg.changed_files || []);
        if (!names.length) return;

        var subset = {};
        for (var i = 0; i < names.length; i++) {
            var n = names[i];
            if (msg.harvested_files[n] != null) {
                subset[n] = msg.harvested_files[n];
            }
        }
        var st = workspace.getState();
        var active = st.activeFile;
        var merged = workspace.mergeHarvested(subset);
        if (!merged.length) return;

        if (merged.indexOf(active) >= 0) {
            loadActiveIntoEditor();
        }
        renderFiles();
        renderTabs();
        appendShell('Updated workspace files: ' + merged.join(', '), 'line-out');
    }

    function presentRunResult(msg) {
        if (msg.stdout) appendShell(msg.stdout.replace(/\n$/, ''), 'line-out');
        if (msg.stderr) appendShell(msg.stderr.replace(/\n$/, ''), 'line-err');
        if (msg.exception) appendShell(formatException(msg.exception), 'line-err');
        harvestFromResult(msg);
    }

    function runEntry(entry) {
        if (busy) {
            return Promise.reject(new Error('Already running'));
        }
        flushEditorToWorkspace();
        var files = workspace.getState().files;

        exitInputMode();
        setBusy(true);
        setStatus('running', 'Running…');
        announce('Running ' + entry);

        var timeoutMs = cfg.defaultTimeoutMs || 5000;
        return runtime
            .run(files, entry, timeoutMs)
            .then(function (msg) {
                exitInputMode();
                presentRunResult(msg);
                setStatus('ready', 'Ready');
                announce('Finished running ' + entry);
                return msg;
            })
            .catch(function (err) {
                exitInputMode();
                if (err && err.code === 'timeout') {
                    appendShell(err.message || 'Timed out', 'line-err');
                    setStatus('error', 'Timed out — runtime restarted');
                    announce('Execution timed out');
                    if (err.recovered) {
                        return err.recovered.then(function () {
                            setStatus('ready', 'Ready');
                            setBusy(false);
                        }).catch(function () {
                            setBusy(false);
                        });
                    }
                } else {
                    appendShell((err && err.message) || String(err), 'line-err');
                    setStatus('error', 'Error');
                    announce('Run failed');
                }
                throw err;
            })
            .then(
                function (msg) {
                    setBusy(false);
                    return msg;
                },
                function (err) {
                    setBusy(false);
                    throw err;
                }
            );
    }

    function historyStorageKey() {
        return (cfg.storageKey || 'pythonshell-workspace-v1') + '-history';
    }

    function loadShellHistory() {
        try {
            var raw = localStorage.getItem(historyStorageKey());
            if (!raw) return;
            var parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return;
            history = parsed
                .filter(function (line) {
                    return typeof line === 'string' && line.length > 0;
                })
                .slice(-HISTORY_MAX);
        } catch (e) {
            history = [];
        }
        historyIndex = history.length;
        historyDraft = '';
    }

    function persistShellHistory() {
        try {
            localStorage.setItem(historyStorageKey(), JSON.stringify(history));
        } catch (e) {
            /* quota */
        }
    }

    function pushShellHistory(line) {
        line = line == null ? '' : String(line).replace(/^\s+|\s+$/g, '');
        if (!line) return;
        if (history.length && history[history.length - 1] === line) {
            historyIndex = history.length;
            historyDraft = '';
            return;
        }
        history.push(line);
        if (history.length > HISTORY_MAX) {
            history = history.slice(-HISTORY_MAX);
        }
        historyIndex = history.length;
        historyDraft = '';
        persistShellHistory();
    }

    function setShellInputValue(input, value) {
        input.value = value == null ? '' : String(value);
        try {
            var len = input.value.length;
            input.setSelectionRange(len, len);
        } catch (e) {
            /* ignore */
        }
    }

    function historyUp(input) {
        if (!history.length) return;
        if (historyIndex === history.length) {
            historyDraft = input.value;
        }
        historyIndex = Math.max(0, historyIndex - 1);
        setShellInputValue(input, history[historyIndex] || '');
    }

    function historyDown(input) {
        if (!history.length) return;
        historyIndex = Math.min(history.length, historyIndex + 1);
        if (historyIndex >= history.length) {
            setShellInputValue(input, historyDraft);
        } else {
            setShellInputValue(input, history[historyIndex] || '');
        }
    }

    function onRunClick() {
        var st = workspace.getState();
        if (!isPythonFile(st.activeFile)) return;
        var cmd = 'python ' + st.activeFile;
        appendShell('$ ' + cmd, 'line-cmd');
        pushShellHistory(cmd);
        runEntry(st.activeFile).catch(function () { /* already displayed */ });
    }

    function execShellLine(line) {
        flushEditorToWorkspace();
        appendShell('$ ' + line, 'line-cmd');
        pushShellHistory(line);

        var result = shell.exec(line);
        if (result.async && result.promise) {
            // runEntry owns busy/status; do not setBusy here or python sees "Already running".
            return result.promise.catch(function (err) {
                if (err && err.message === 'Already running') {
                    appendShell(err.message, 'line-err');
                }
                // Other errors are presented inside runEntry.
            });
        }
        if (result.cleared) return Promise.resolve();
        if (result.output) {
            appendShell(result.output, result.ok ? 'line-out' : 'line-err');
        }
        return Promise.resolve();
    }

    function bindShellInput() {
        var input = $('#shell-input');
        if (!input) return;
        input.addEventListener('keydown', function (ev) {
            if (ev.key === 'Enter') {
                ev.preventDefault();
                var line = input.value;
                input.value = '';
                if (awaitingInput || (runtime && runtime.isAwaitingStdin())) {
                    appendShell((inputPrompt || '') + line, 'line-cmd');
                    exitInputMode();
                    setBusy(true);
                    setStatus('running', 'Running…');
                    if (!runtime.respondStdin(line)) {
                        appendShell('shell: no program is waiting for input', 'line-err');
                        setBusy(false);
                        setStatus('ready', 'Ready');
                    }
                    return;
                }
                execShellLine(line);
                return;
            }
            if (awaitingInput) return; // no command history while answering input()
            if (ev.key === 'ArrowUp' || (ev.ctrlKey && (ev.key === 'p' || ev.key === 'P'))) {
                ev.preventDefault();
                historyUp(input);
                return;
            }
            if (ev.key === 'ArrowDown' || (ev.ctrlKey && (ev.key === 'n' || ev.key === 'N'))) {
                ev.preventDefault();
                historyDown(input);
            }
        });
    }

    function bindButtons() {
        $('#btn-run').addEventListener('click', onRunClick);
        $('#btn-restart').addEventListener('click', function () {
            exitInputMode();
            setBusy(true);
            setStatus('loading', 'Restarting…');
            runtime
                .restart()
                .then(function () {
                    setStatus('ready', 'Ready');
                    appendShell('Runtime restarted.', 'line-out');
                    setBusy(false);
                })
                .catch(function (err) {
                    setStatus('error', 'Restart failed');
                    appendShell((err && err.message) || String(err), 'line-err');
                    setBusy(false);
                });
        });
        $('#btn-reset').addEventListener('click', function () {
            if (!window.confirm('Reset workspace? This clears localStorage for PythonShell.')) {
                return;
            }
            if (!window.confirm('Are you sure? All files in this workspace will be replaced with the defaults.')) {
                return;
            }
            exitInputMode();
            workspace.reset().then(function () {
                loadActiveIntoEditor();
                renderFiles();
                renderTabs();
                clearShell();
                appendShell('Workspace reset. Type help for commands.', 'line-out');
                announce('Workspace reset');
            });
        });
        $('#btn-new-file').addEventListener('click', function () {
            var name = window.prompt('New file name', 'script.py');
            if (!name) return;
            flushEditorToWorkspace();
            var res = workspace.createFile(name, '# ' + name + '\n');
            if (!res.ok) {
                window.alert(res.error);
                return;
            }
            loadActiveIntoEditor();
            renderFiles();
            renderTabs();
        });
        $('#btn-rename-file').addEventListener('click', function () {
            var st = workspace.getState();
            var name = window.prompt('Rename file', st.activeFile);
            if (!name || name === st.activeFile) return;
            flushEditorToWorkspace();
            var res = workspace.renameFile(st.activeFile, name);
            if (!res.ok) {
                window.alert(res.error);
                return;
            }
            loadActiveIntoEditor();
            renderFiles();
            renderTabs();
        });
        $('#btn-upload-file').addEventListener('click', function () {
            openUploadPicker();
        });
        var uploadInput = $('#file-upload-input');
        if (uploadInput) {
            uploadInput.addEventListener('change', function () {
                uploadFiles(uploadInput.files).then(function (results) {
                    var ok = results.filter(function (r) {
                        return r.ok;
                    });
                    var bad = results.filter(function (r) {
                        return !r.ok && r.error !== 'Skipped';
                    });
                    if (ok.length) {
                        appendShell(
                            'Uploaded: ' +
                                ok
                                    .map(function (r) {
                                        return r.name + (r.overwritten ? ' (replaced)' : '');
                                    })
                                    .join(', '),
                            'line-out'
                        );
                        announce('Uploaded ' + ok.length + ' file(s)');
                    }
                    bad.forEach(function (r) {
                        appendShell('Upload failed (' + r.name + '): ' + r.error, 'line-err');
                    });
                    uploadInput.value = '';
                });
            });
        }
        $('#btn-download-file').addEventListener('click', function () {
            var st = workspace.getState();
            var res = downloadWorkspaceFile(st.activeFile);
            if (!res.ok) window.alert(res.error);
        });
        $('#btn-delete-file').addEventListener('click', function () {
            var st = workspace.getState();
            if (!window.confirm('Delete ' + st.activeFile + '?')) return;
            var res = workspace.deleteFile(st.activeFile);
            if (!res.ok) {
                window.alert(res.error);
                return;
            }
            loadActiveIntoEditor();
            renderFiles();
            renderTabs();
        });

        var ta = $('#source-fallback');
        if (ta) {
            ta.addEventListener('input', function () {
                if (editor) return;
                var st = workspace.getState();
                workspace.setFileContent(st.activeFile, ta.value);
            });
        }
    }

    function boot() {
        workspace = window.PythonShellWorkspace.create({
            storageKey: cfg.storageKey || 'pythonshell-workspace-v1',
            maxFiles: cfg.maxFiles || 40,
            maxFileBytes: cfg.maxFileBytes || 200000,
            onWarning: function (msg) {
                appendShell(msg, 'line-err');
            }
        });

        runtime = window.PythonShellRuntime.create({
            workerUrl: cfg.workerUrl || 'static/worker/pyodide-worker.js',
            onStatus: function (status, msg) {
                if (status === 'loading') {
                    setStatus('loading', (msg && msg.message) || 'Loading Python…');
                } else if (status === 'ready') {
                    exitInputMode();
                    setStatus('ready', 'Ready');
                    setBusy(false);
                } else if (status === 'running') {
                    if (!awaitingInput) setStatus('running', 'Running…');
                } else if (status === 'stdout') {
                    if (msg && msg.stdout) {
                        appendShell(String(msg.stdout).replace(/\n$/, ''), 'line-out');
                    }
                } else if (status === 'stdin') {
                    enterInputMode(msg && msg.prompt);
                } else if (status === 'timeout') {
                    exitInputMode();
                    setStatus('error', 'Timed out');
                } else if (status === 'worker_error') {
                    exitInputMode();
                    setStatus('error', 'Runtime error');
                }
            }
        });

        shell = window.PythonShellShell.create({
            workspace: workspace,
            onClear: clearShell,
            onMutate: function () {
                loadActiveIntoEditor();
                renderFiles();
                renderTabs();
            },
            onDownload: function (name) {
                return downloadWorkspaceFile(name);
            },
            onUpload: function () {
                openUploadPicker();
                return { ok: true };
            },
            runPython: function (entry) {
                return runEntry(entry);
            }
        });

        bindButtons();
        bindShellInput();
        loadShellHistory();
        setShellPrompt('$');

        clearShell();
        appendShell('PythonShell — work is saved only in this browser (localStorage).', 'line-out');
        appendShell("Type 'help' for commands, or press Run.", 'line-out');

        setBusy(true);
        setStatus('loading', 'Loading…');

        Promise.all([workspace.load(), runtime.init()])
            .then(function () {
                initEditor();
                loadActiveIntoEditor();
                renderFiles();
                renderTabs();
                setStatus('ready', 'Ready');
                setBusy(false);
                announce('Python ready');
            })
            .catch(function (err) {
                initEditor();
                loadActiveIntoEditor();
                renderFiles();
                renderTabs();
                setStatus('error', 'Failed to load');
                appendShell((err && err.message) || String(err), 'line-err');
                setBusy(false);
            });

        window.addEventListener('resize', function () {
            if (editor) editor.resize();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
