/**
 * PythonShell simulated command shell.
 *
 * Builtins (ls, rm, …) use the workspace model. `python` is delegated
 * via options.runPython(entry).
 *
 * Exposed as window.PythonShellShell.
 */
(function (global) {
    'use strict';

    function tokenize(line) {
        var tokens = [];
        var re = /"([^"]*)"|'([^']*)'|(\S+)/g;
        var m;
        while ((m = re.exec(line)) !== null) {
            tokens.push(m[1] != null ? m[1] : m[2] != null ? m[2] : m[3]);
        }
        return tokens;
    }

    function createShell(options) {
        options = options || {};
        var workspace = options.workspace;
        var runPython = typeof options.runPython === 'function' ? options.runPython : null;
        var onClear = typeof options.onClear === 'function' ? options.onClear : function () {};
        var onMutate = typeof options.onMutate === 'function' ? options.onMutate : function () {};
        var onDownload = typeof options.onDownload === 'function' ? options.onDownload : null;
        var onUpload = typeof options.onUpload === 'function' ? options.onUpload : null;

        function helpText() {
            return [
                'Supported commands:',
                '  help              Show this help',
                '  ls [file]         List workspace files',
                '  rm <file...>      Delete file(s)',
                '  upload            Upload file(s) into the workspace',
                '  download <file>   Download a file',
                '  pwd               Print working directory',
                '  cd [path]         Change directory (workspace root only)',
                '  python <file.py>  Run a Python file',
                '  echo [args...]    Print arguments',
                '  clear             Clear the shell'
            ].join('\n');
        }

        function cmdHelp() {
            return { ok: true, output: helpText() };
        }

        function cmdPwd() {
            return { ok: true, output: workspace.getCwd() };
        }

        function cmdCd(args) {
            var target = args[0] == null ? '.' : args[0];
            var resolved = workspace.resolvePath(target);
            if (resolved == null) {
                return { ok: false, output: 'shell: cd: path not allowed: ' + target };
            }
            if (resolved !== '.') {
                // Flat workspace: only '.' is a directory.
                if (!workspace.getFile(resolved)) {
                    return { ok: false, output: 'shell: cd: no such file or directory: ' + target };
                }
                return { ok: false, output: 'shell: cd: not a directory: ' + target };
            }
            return { ok: true, output: '' };
        }

        function cmdLs(args) {
            var files = workspace.listFiles();
            if (args[0]) {
                var path = workspace.resolvePath(args[0]);
                if (path == null) {
                    return { ok: false, output: 'shell: ls: invalid path' };
                }
                if (path === '.') {
                    return { ok: true, output: files.join('  ') };
                }
                if (workspace.getFile(path) == null) {
                    return { ok: false, output: 'shell: ls: cannot access \'' + args[0] + '\': No such file' };
                }
                return { ok: true, output: path };
            }
            return { ok: true, output: files.join('  ') };
        }

        function cmdRm(args) {
            if (!args.length) {
                return { ok: false, output: 'shell: rm: missing operand' };
            }
            var errors = [];
            var removed = 0;
            for (var i = 0; i < args.length; i++) {
                var path = workspace.resolvePath(args[i]);
                if (path == null || path === '.') {
                    errors.push("shell: rm: cannot remove '" + args[i] + "': Invalid path");
                    continue;
                }
                if (workspace.getFile(path) == null) {
                    errors.push("shell: rm: cannot remove '" + args[i] + "': No such file");
                    continue;
                }
                var res = workspace.deleteFile(path);
                if (!res.ok) {
                    errors.push("shell: rm: cannot remove '" + args[i] + "': " + res.error);
                } else {
                    removed += 1;
                }
            }
            if (removed) onMutate();
            if (errors.length) {
                return { ok: false, output: errors.join('\n') };
            }
            return { ok: true, output: '' };
        }

        function cmdUpload() {
            if (!onUpload) {
                return { ok: false, output: 'shell: upload: not available' };
            }
            var res = onUpload();
            if (!res || !res.ok) {
                return {
                    ok: false,
                    output: 'shell: upload: ' + ((res && res.error) || 'failed')
                };
            }
            return { ok: true, output: 'Choose file(s) to upload…' };
        }

        function cmdDownload(args) {
            if (!args[0]) {
                return { ok: false, output: 'shell: download: missing file operand' };
            }
            var path = workspace.resolvePath(args[0]);
            if (path == null || path === '.') {
                return { ok: false, output: 'shell: download: invalid file: ' + args[0] };
            }
            if (workspace.getFile(path) == null) {
                return { ok: false, output: "shell: download: cannot download '" + args[0] + "': No such file" };
            }
            if (!onDownload) {
                return { ok: false, output: 'shell: download: not available' };
            }
            var res = onDownload(path);
            if (!res || !res.ok) {
                return {
                    ok: false,
                    output: 'shell: download: ' + ((res && res.error) || 'failed')
                };
            }
            return { ok: true, output: 'Downloaded ' + path };
        }

        function cmdEcho(args) {
            return { ok: true, output: args.join(' ') };
        }

        function cmdClear() {
            onClear();
            return { ok: true, output: '', cleared: true };
        }

        function cmdPython(args) {
            if (!args[0]) {
                return {
                    ok: false,
                    output:
                        'shell: python: missing file\n' +
                        'Usage: python <file.py>\n' +
                        '(Interactive REPL is not supported; run a file.)'
                };
            }
            var path = workspace.resolvePath(args[0]);
            if (path == null || path === '.') {
                return { ok: false, output: 'shell: python: invalid file: ' + args[0] };
            }
            if (workspace.getFile(path) == null) {
                return { ok: false, output: 'shell: python: ' + args[0] + ': No such file' };
            }
            if (!runPython) {
                return { ok: false, output: 'shell: python: runtime not available' };
            }
            return {
                ok: true,
                async: true,
                run: function () {
                    return runPython(path);
                }
            };
        }

        /**
         * Execute one shell line.
         * Returns a sync result, or { async: true, promise }.
         */
        function exec(line) {
            line = line == null ? '' : String(line).replace(/^\s+|\s+$/g, '');
            if (!line) return { ok: true, output: '' };

            if (/[|><*]/.test(line)) {
                return {
                    ok: false,
                    output:
                        'shell: pipes, redirects, and globs are not supported\n' +
                        "Type 'help' for supported commands."
                };
            }

            var tokens = tokenize(line);
            if (!tokens.length) return { ok: true, output: '' };

            var cmd = tokens[0];
            var args = tokens.slice(1);
            var result;

            switch (cmd) {
                case 'help':
                    result = cmdHelp();
                    break;
                case 'pwd':
                    result = cmdPwd();
                    break;
                case 'cd':
                    result = cmdCd(args);
                    break;
                case 'ls':
                    result = cmdLs(args);
                    break;
                case 'rm':
                    result = cmdRm(args);
                    break;
                case 'upload':
                    result = cmdUpload();
                    break;
                case 'download':
                    result = cmdDownload(args);
                    break;
                case 'echo':
                    result = cmdEcho(args);
                    break;
                case 'clear':
                    result = cmdClear();
                    break;
                case 'python':
                case 'python3':
                    result = cmdPython(args);
                    break;
                default:
                    result = {
                        ok: false,
                        output:
                            "shell: " + cmd + ": command not found\n" +
                            "Type 'help' for supported commands."
                    };
            }

            if (result && result.async && result.run) {
                return {
                    ok: true,
                    async: true,
                    promise: Promise.resolve().then(result.run)
                };
            }
            return result;
        }

        return {
            exec: exec,
            helpText: helpText
        };
    }

    global.PythonShellShell = {
        create: createShell,
        tokenize: tokenize
    };
})(typeof window !== 'undefined' ? window : self);
