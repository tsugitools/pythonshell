/**
 * PythonShell workspace model + localStorage persistence.
 *
 * Exposed as window.PythonShellWorkspace.
 */
(function (global) {
    'use strict';

    var SCHEMA = 'pythonshell-workspace';
    var VERSION = 1;
    var DEFAULT_MAIN =
        "# Welcome to PythonShell — edit, Run, or type: python main.py\n" +
        "name = input('What is your name? ')\n" +
        "print('Hello', name)\n";
    var DEFAULT_SEED_FILES = [
        { name: 'about.txt', url: 'static/files/about.txt' },
        { name: 'romeo.txt', url: 'static/files/romeo.txt' },
        { name: 'mbox-short.txt', url: 'static/files/mbox-short.txt' }
    ];

    function emptyDefaultWorkspace() {
        return {
            schema: SCHEMA,
            version: VERSION,
            files: { 'main.py': DEFAULT_MAIN },
            activeFile: 'main.py',
            openTabs: ['main.py'],
            cwd: '.',
            stdin: '',
            updatedAt: new Date().toISOString()
        };
    }

    function isSafeFilename(name) {
        if (!name || typeof name !== 'string') return false;
        name = name.replace(/\\/g, '/').trim();
        if (!name || name.charAt(0) === '/' || name.indexOf('..') >= 0) return false;
        if (name === 'result.py') return false;
        return /^[A-Za-z0-9._][A-Za-z0-9._-]*$/.test(name);
    }

    function createWorkspace(options) {
        options = options || {};
        var storageKey = options.storageKey || 'pythonshell-workspace-v1';
        var maxFiles = typeof options.maxFiles === 'number' ? options.maxFiles : 40;
        var maxFileBytes =
            typeof options.maxFileBytes === 'number' ? options.maxFileBytes : 200000;
        var seedFiles = Array.isArray(options.seedFiles) ? options.seedFiles : DEFAULT_SEED_FILES;
        var onChange = typeof options.onChange === 'function' ? options.onChange : function () {};
        var onWarning = typeof options.onWarning === 'function' ? options.onWarning : function () {};

        var state = emptyDefaultWorkspace();
        var saveTimer = null;
        var SAVE_DEBOUNCE_MS = 400;

        function fetchSeedFiles() {
            if (!seedFiles.length) return Promise.resolve([]);
            return Promise.all(
                seedFiles.map(function (f) {
                    if (!f || !f.name || !f.url || !isSafeFilename(f.name)) {
                        return Promise.reject(new Error('Invalid seed file declaration'));
                    }
                    return fetch(f.url, { credentials: 'same-origin' }).then(function (resp) {
                        if (!resp.ok) {
                            throw new Error('Missing seed file: ' + f.url + ' (' + resp.status + ')');
                        }
                        return resp.text().then(function (text) {
                            if (byteLength(text) > maxFileBytes) {
                                throw new Error('Seed file too large: ' + f.name);
                            }
                            return { name: f.name, text: text };
                        });
                    });
                })
            );
        }

        function buildDefaultWorkspace() {
            return fetchSeedFiles().then(function (seeds) {
                var files = { 'main.py': DEFAULT_MAIN };
                for (var i = 0; i < seeds.length; i++) {
                    files[seeds[i].name] = seeds[i].text;
                }
                return {
                    schema: SCHEMA,
                    version: VERSION,
                    files: files,
                    activeFile: 'main.py',
                    openTabs: ['main.py'],
                    cwd: '.',
                    stdin: '',
                    updatedAt: new Date().toISOString()
                };
            });
        }

        function cloneState() {
            return JSON.parse(JSON.stringify(state));
        }

        function notify() {
            onChange(cloneState());
        }

        function byteLength(text) {
            try {
                return new Blob([text || '']).size;
            } catch (e) {
                return String(text || '').length;
            }
        }

        function persistNow() {
            state.updatedAt = new Date().toISOString();
            try {
                localStorage.setItem(storageKey, JSON.stringify(state));
            } catch (e) {
                onWarning('Could not save workspace to localStorage (quota or private mode).');
            }
        }

        function schedulePersist() {
            if (saveTimer) clearTimeout(saveTimer);
            saveTimer = setTimeout(function () {
                saveTimer = null;
                persistNow();
            }, SAVE_DEBOUNCE_MS);
        }

        function normalizeLoaded(raw) {
            if (!raw || typeof raw !== 'object') return null;
            if (raw.schema !== SCHEMA) return null;
            if (!raw.files || typeof raw.files !== 'object') return null;
            var files = {};
            var names = Object.keys(raw.files);
            if (!names.length) return null;
            for (var i = 0; i < names.length; i++) {
                var n = names[i];
                if (!isSafeFilename(n)) continue;
                var content = raw.files[n] == null ? '' : String(raw.files[n]);
                if (byteLength(content) > maxFileBytes) {
                    onWarning('Skipped oversized file: ' + n);
                    continue;
                }
                files[n] = content;
                if (Object.keys(files).length >= maxFiles) break;
            }
            if (!Object.keys(files).length) return null;

            var active = isSafeFilename(raw.activeFile) && files[raw.activeFile]
                ? raw.activeFile
                : Object.keys(files).sort()[0];
            var tabs = Array.isArray(raw.openTabs) ? raw.openTabs : [active];
            var openTabs = [];
            for (var t = 0; t < tabs.length; t++) {
                if (files[tabs[t]] != null && openTabs.indexOf(tabs[t]) < 0) {
                    openTabs.push(tabs[t]);
                }
            }
            if (openTabs.indexOf(active) < 0) openTabs.unshift(active);

            return {
                schema: SCHEMA,
                version: VERSION,
                files: files,
                activeFile: active,
                openTabs: openTabs,
                cwd: raw.cwd === '.' || raw.cwd === '' || raw.cwd == null ? '.' : '.',
                stdin: raw.stdin == null ? '' : String(raw.stdin),
                updatedAt: raw.updatedAt || new Date().toISOString()
            };
        }

        function applyDefaultWorkspace() {
            return buildDefaultWorkspace()
                .then(function (ws) {
                    state = ws;
                    persistNow();
                    notify();
                    return state;
                })
                .catch(function (err) {
                    onWarning((err && err.message) || 'Could not load seed files; using main.py only.');
                    state = emptyDefaultWorkspace();
                    persistNow();
                    notify();
                    return state;
                });
        }

        function load() {
            try {
                var raw = localStorage.getItem(storageKey);
                if (raw) {
                    var parsed = normalizeLoaded(JSON.parse(raw));
                    if (parsed) {
                        state = parsed;
                        notify();
                        return Promise.resolve(state);
                    }
                    onWarning('Stored workspace was invalid; restored defaults.');
                }
            } catch (e) {
                onWarning('Could not read localStorage; restored defaults.');
            }
            return applyDefaultWorkspace();
        }

        function reset() {
            return applyDefaultWorkspace();
        }

        function getState() {
            return cloneState();
        }

        function listFiles() {
            return Object.keys(state.files).sort();
        }

        function getFile(name) {
            return state.files[name] != null ? state.files[name] : null;
        }

        function setFileContent(name, content) {
            if (!isSafeFilename(name)) {
                return { ok: false, error: 'Invalid filename: ' + name };
            }
            if (!(name in state.files)) {
                return { ok: false, error: 'File not found: ' + name };
            }
            content = content == null ? '' : String(content);
            if (byteLength(content) > maxFileBytes) {
                return {
                    ok: false,
                    error: 'File exceeds size limit (' + maxFileBytes + ' bytes): ' + name
                };
            }
            state.files[name] = content;
            schedulePersist();
            notify();
            return { ok: true };
        }

        function createFile(name, content) {
            name = (name || '').trim();
            if (!isSafeFilename(name)) {
                return { ok: false, error: 'Invalid filename. Use letters, numbers, ., _, -' };
            }
            if (name in state.files) {
                return { ok: false, error: 'File already exists: ' + name };
            }
            if (Object.keys(state.files).length >= maxFiles) {
                return { ok: false, error: 'Too many files (max ' + maxFiles + ')' };
            }
            content = content == null ? '' : String(content);
            if (byteLength(content) > maxFileBytes) {
                return { ok: false, error: 'File exceeds size limit' };
            }
            state.files[name] = content;
            if (state.openTabs.indexOf(name) < 0) state.openTabs.push(name);
            state.activeFile = name;
            schedulePersist();
            notify();
            return { ok: true, name: name };
        }

        /** Create or overwrite a file (used by upload). */
        function putFile(name, content, options) {
            options = options || {};
            name = (name || '').trim();
            if (!isSafeFilename(name)) {
                return { ok: false, error: 'Invalid filename. Use letters, numbers, ., _, -' };
            }
            content = content == null ? '' : String(content);
            if (byteLength(content) > maxFileBytes) {
                return {
                    ok: false,
                    error: 'File exceeds size limit (' + maxFileBytes + ' bytes): ' + name
                };
            }
            var existed = name in state.files;
            if (!existed && Object.keys(state.files).length >= maxFiles) {
                return { ok: false, error: 'Too many files (max ' + maxFiles + ')' };
            }
            state.files[name] = content;
            if (options.activate !== false) {
                if (state.openTabs.indexOf(name) < 0) state.openTabs.push(name);
                state.activeFile = name;
            } else if (state.openTabs.indexOf(name) < 0) {
                /* leave inactive unless already open */
            }
            schedulePersist();
            notify();
            return { ok: true, name: name, overwritten: existed };
        }

        function deleteFile(name) {
            if (!(name in state.files)) {
                return { ok: false, error: 'File not found: ' + name };
            }
            if (Object.keys(state.files).length <= 1) {
                return { ok: false, error: 'Cannot delete the last file' };
            }
            delete state.files[name];
            state.openTabs = state.openTabs.filter(function (t) {
                return t !== name;
            });
            if (state.activeFile === name) {
                state.activeFile = state.openTabs[0] || Object.keys(state.files).sort()[0];
                if (state.openTabs.indexOf(state.activeFile) < 0) {
                    state.openTabs.push(state.activeFile);
                }
            }
            schedulePersist();
            notify();
            return { ok: true };
        }

        function renameFile(oldName, newName) {
            newName = (newName || '').trim();
            if (!(oldName in state.files)) {
                return { ok: false, error: 'File not found: ' + oldName };
            }
            if (!isSafeFilename(newName)) {
                return { ok: false, error: 'Invalid filename' };
            }
            if (newName !== oldName && newName in state.files) {
                return { ok: false, error: 'File already exists: ' + newName };
            }
            if (newName === oldName) return { ok: true, name: newName };
            state.files[newName] = state.files[oldName];
            delete state.files[oldName];
            state.openTabs = state.openTabs.map(function (t) {
                return t === oldName ? newName : t;
            });
            if (state.activeFile === oldName) state.activeFile = newName;
            schedulePersist();
            notify();
            return { ok: true, name: newName };
        }

        function setActiveFile(name) {
            if (!(name in state.files)) {
                return { ok: false, error: 'File not found: ' + name };
            }
            state.activeFile = name;
            if (state.openTabs.indexOf(name) < 0) state.openTabs.push(name);
            schedulePersist();
            notify();
            return { ok: true };
        }

        function closeTab(name) {
            if (state.openTabs.length <= 1 && state.openTabs[0] === name) {
                return { ok: false, error: 'Cannot close the last tab' };
            }
            var idx = state.openTabs.indexOf(name);
            if (idx < 0) return { ok: true };
            state.openTabs.splice(idx, 1);
            if (state.activeFile === name) {
                state.activeFile = state.openTabs[Math.max(0, idx - 1)];
            }
            schedulePersist();
            notify();
            return { ok: true };
        }

        function setStdin(text) {
            state.stdin = text == null ? '' : String(text);
            schedulePersist();
            notify();
        }

        function getStdin() {
            return state.stdin || '';
        }

        function getCwd() {
            return '.';
        }

        function resolvePath(path) {
            path = (path == null || path === '') ? '.' : String(path).trim();
            if (path === '.' || path === './' || path === '') return '.';
            path = path.replace(/^\.\//, '');
            if (path.charAt(0) === '/' || path.indexOf('..') >= 0 || path.indexOf('/') >= 0) {
                return null;
            }
            return path;
        }

        function mergeHarvested(harvested) {
            if (!harvested || typeof harvested !== 'object') return [];
            var merged = [];
            var names = Object.keys(harvested);
            for (var i = 0; i < names.length; i++) {
                var name = names[i];
                if (!isSafeFilename(name)) continue;
                var content = harvested[name] == null ? '' : String(harvested[name]);
                if (byteLength(content) > maxFileBytes) {
                    onWarning('Skipped oversized harvested file: ' + name);
                    continue;
                }
                if (!(name in state.files)) {
                    if (Object.keys(state.files).length >= maxFiles) {
                        onWarning('Workspace full; could not add ' + name);
                        continue;
                    }
                    state.files[name] = content;
                    merged.push(name);
                } else if (state.files[name] !== content) {
                    // Do not overwrite an open editor buffer that differs unless it was written by Python.
                    // Auto-merge changed files from the run (DESIGN: auto-merge non-reserved).
                    state.files[name] = content;
                    merged.push(name);
                }
            }
            if (merged.length) {
                schedulePersist();
                notify();
            }
            return merged;
        }

        function flushPersist() {
            if (saveTimer) {
                clearTimeout(saveTimer);
                saveTimer = null;
            }
            persistNow();
        }

        return {
            load: load,
            reset: reset,
            getState: getState,
            listFiles: listFiles,
            getFile: getFile,
            setFileContent: setFileContent,
            createFile: createFile,
            putFile: putFile,
            deleteFile: deleteFile,
            renameFile: renameFile,
            setActiveFile: setActiveFile,
            closeTab: closeTab,
            setStdin: setStdin,
            getStdin: getStdin,
            getCwd: getCwd,
            resolvePath: resolvePath,
            mergeHarvested: mergeHarvested,
            flushPersist: flushPersist,
            isSafeFilename: isSafeFilename
        };
    }

    global.PythonShellWorkspace = {
        create: createWorkspace,
        isSafeFilename: isSafeFilename,
        SCHEMA: SCHEMA,
        VERSION: VERSION
    };
})(typeof window !== 'undefined' ? window : self);
