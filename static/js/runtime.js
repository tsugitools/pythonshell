/**
 * PythonShell runtime — worker lifecycle, request IDs, timeout recovery,
 * interactive stdin bridging.
 *
 * Exposed as window.PythonShellRuntime.
 */
(function (global) {
    'use strict';

    var PROTOCOL_VERSION = 1;
    var DEFAULT_TIMEOUT_MS = 5000;
    var DEFAULT_WORKER_URL = 'static/worker/pyodide-worker.js';

    function createRuntime(options) {
        options = options || {};
        var workerUrl = options.workerUrl || DEFAULT_WORKER_URL;
        var onStatus = typeof options.onStatus === 'function' ? options.onStatus : function () {};

        var worker = null;
        var nextSeq = 1;
        var currentRequestId = null;
        var pending = null;
        var timeoutTimer = null;
        var timeoutMsActive = DEFAULT_TIMEOUT_MS;
        var ready = false;
        var initPromise = null;
        var awaitingStdin = false;

        function clearTimeoutTimer() {
            if (timeoutTimer != null) {
                clearTimeout(timeoutTimer);
                timeoutTimer = null;
            }
        }

        function rejectPending(err) {
            clearTimeoutTimer();
            awaitingStdin = false;
            if (pending) {
                var p = pending;
                pending = null;
                currentRequestId = null;
                p.reject(err);
            }
        }

        function terminateWorker() {
            clearTimeoutTimer();
            awaitingStdin = false;
            if (worker) {
                try {
                    worker.terminate();
                } catch (e) {
                    /* ignore */
                }
                worker = null;
            }
            ready = false;
            initPromise = null;
        }

        function startTimeoutClock(timeoutMs, requestId, operation, reject) {
            clearTimeoutTimer();
            timeoutMsActive = timeoutMs == null ? DEFAULT_TIMEOUT_MS : timeoutMs;
            timeoutTimer = setTimeout(function () {
                if (!pending || currentRequestId !== requestId || awaitingStdin) return;
                pending = null;
                currentRequestId = null;
                timeoutTimer = null;
                awaitingStdin = false;
                onStatus('timeout', {
                    request_id: requestId,
                    operation: operation,
                    message: 'Execution timed out after ' + timeoutMsActive + 'ms'
                });
                terminateWorker();
                var err = new Error('Execution timed out after ' + timeoutMsActive + 'ms');
                err.code = 'timeout';
                err.request_id = requestId;
                err.operation = operation;
                err.recovered = init()
                    .then(function (msg) {
                        onStatus('ready', msg);
                        return msg;
                    })
                    .catch(function (initErr) {
                        onStatus('worker_error', {
                            message: (initErr && initErr.message) || String(initErr)
                        });
                        throw initErr;
                    });
                reject(err);
            }, timeoutMsActive);
        }

        function handleMessage(ev) {
            var msg = ev.data || {};
            if (msg.protocol_version !== PROTOCOL_VERSION) return;

            if (msg.status === 'loading') {
                onStatus('loading', msg);
                return;
            }

            if (pending && msg.request_id === currentRequestId) {
                if (msg.status === 'running') {
                    onStatus('running', msg);
                    return;
                }
                if (msg.status === 'stdout') {
                    onStatus('stdout', msg);
                    return;
                }
                if (msg.status === 'stdin') {
                    awaitingStdin = true;
                    clearTimeoutTimer();
                    onStatus('stdin', msg);
                    return;
                }
                if (
                    msg.status === 'complete' ||
                    msg.status === 'ready' ||
                    msg.status === 'worker_error'
                ) {
                    clearTimeoutTimer();
                    awaitingStdin = false;
                    var p = pending;
                    pending = null;
                    currentRequestId = null;
                    if (msg.status === 'worker_error') {
                        p.reject(Object.assign(new Error(msg.message || 'Worker error'), { result: msg }));
                    } else {
                        p.resolve(msg);
                    }
                    return;
                }
            }
        }

        function attachWorker(w) {
            worker = w;
            worker.onmessage = handleMessage;
            worker.onerror = function (err) {
                onStatus('worker_error', {
                    message: (err && err.message) || 'Worker script error'
                });
                rejectPending(new Error((err && err.message) || 'Worker script error'));
            };
        }

        function createWorker() {
            var w = new Worker(workerUrl);
            attachWorker(w);
            return w;
        }

        function callWorker(operation, payload, timeoutMs) {
            if (!worker) {
                return Promise.reject(new Error('Worker not initialized'));
            }
            if (pending) {
                return Promise.reject(new Error('Another operation is in progress'));
            }

            var requestId = operation + '-' + nextSeq++;
            currentRequestId = requestId;
            awaitingStdin = false;

            return new Promise(function (resolve, reject) {
                pending = { resolve: resolve, reject: reject, operation: operation };
                startTimeoutClock(
                    operation === 'init' ? (timeoutMs == null ? 120000 : timeoutMs) : timeoutMs,
                    requestId,
                    operation,
                    reject
                );

                worker.postMessage({
                    protocol_version: PROTOCOL_VERSION,
                    request_id: requestId,
                    operation: operation,
                    payload: payload || {}
                });
            });
        }

        function respondStdin(line) {
            if (!worker || !awaitingStdin || !currentRequestId || !pending) {
                return false;
            }
            awaitingStdin = false;
            worker.postMessage({
                protocol_version: PROTOCOL_VERSION,
                request_id: currentRequestId,
                operation: 'stdin_response',
                payload: { line: line == null ? '' : String(line) }
            });
            startTimeoutClock(timeoutMsActive, currentRequestId, pending.operation, pending.reject);
            onStatus('running', { operation: 'run', message: 'Running…' });
            return true;
        }

        function init() {
            if (initPromise) return initPromise;
            if (!worker) {
                createWorker();
            }
            onStatus('loading', { message: 'Starting worker…' });
            initPromise = callWorker('init', {}, 120000)
                .then(function (msg) {
                    ready = true;
                    onStatus('ready', msg);
                    return msg;
                })
                .catch(function (err) {
                    ready = false;
                    initPromise = null;
                    throw err;
                });
            return initPromise;
        }

        function restart() {
            rejectPending(new Error('Worker restarted'));
            terminateWorker();
            createWorker();
            return init();
        }

        function run(files, entry, timeoutMs) {
            return init().then(function () {
                onStatus('running', { operation: 'run' });
                return callWorker(
                    'run',
                    {
                        files: files || {},
                        entry: entry || 'main.py'
                    },
                    timeoutMs
                );
            }).then(function (msg) {
                onStatus('complete', msg);
                return msg;
            });
        }

        function isReady() {
            return ready;
        }

        function isAwaitingStdin() {
            return awaitingStdin;
        }

        return {
            init: init,
            restart: restart,
            run: run,
            respondStdin: respondStdin,
            isReady: isReady,
            isAwaitingStdin: isAwaitingStdin,
            terminate: terminateWorker
        };
    }

    global.PythonShellRuntime = {
        create: createRuntime,
        PROTOCOL_VERSION: PROTOCOL_VERSION,
        DEFAULT_TIMEOUT_MS: DEFAULT_TIMEOUT_MS
    };
})(typeof window !== 'undefined' ? window : self);
