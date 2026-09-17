'use strict';

const { app, BrowserWindow, Menu, dialog, protocol, session, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const SCHEME = 'pythonshell';
const ORIGIN = SCHEME + '://app';

// input() uses Pyodide run_sync, which needs JSPI (Wasm stack switching).
// Chromium enables this by default from 137; keep the flags so older
// Electron builds and workers get the same runtime as a current Chrome tab.
app.commandLine.appendSwitch('enable-features', 'WebAssemblyExperimentalJSPI');
app.commandLine.appendSwitch('enable-experimental-webassembly-features');
app.commandLine.appendSwitch('js-flags', '--experimental-wasm-jspi');

// npm start runs Electron.app, so the macOS dock still says "Electron".
// Packaged builds use productName "PythonShell". setName fixes the menu now.
app.setName('PythonShell');

protocol.registerSchemesAsPrivileged([
    {
        scheme: SCHEME,
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
            stream: true,
            allowServiceWorkers: true
        }
    }
]);

const MIME = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.py': 'text/plain; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.wasm': 'application/wasm',
    '.zip': 'application/zip',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

function getWebRoot() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'web');
    }
    return path.join(__dirname, '..');
}

function getPyodideRoot() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'web', 'pyodide');
    }
    return path.join(__dirname, 'node_modules', 'pyodide');
}

function mimeFor(filePath) {
    return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function resolveWebFile(requestUrl) {
    let parsed;
    try {
        parsed = new URL(requestUrl);
    } catch (err) {
        return null;
    }
    if (parsed.protocol !== SCHEME + ':') return null;

    let rel = decodeURIComponent(parsed.pathname || '/');
    if (rel === '/' || rel === '') rel = '/index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    rel = rel.replace(/^\/+/, '');

    let root = path.resolve(getWebRoot());
    if (rel === 'pyodide' || rel.startsWith('pyodide/')) {
        root = path.resolve(getPyodideRoot());
        rel = rel === 'pyodide' ? '' : rel.slice('pyodide/'.length);
    }

    const full = path.resolve(root, rel || '.');
    const relative = path.relative(root, full);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
        return null;
    }
    return full;
}

function registerProtocol() {
    protocol.handle(SCHEME, function (request) {
        const filePath = resolveWebFile(request.url);
        if (!filePath) {
            return new Response('Not found', {
                status: 404,
                headers: { 'content-type': 'text/plain; charset=utf-8' }
            });
        }
        try {
            const data = fs.readFileSync(filePath);
            return new Response(data, {
                status: 200,
                headers: {
                    'content-type': mimeFor(filePath),
                    'cache-control': 'no-cache'
                }
            });
        } catch (err) {
            const status = err && err.code === 'ENOENT' ? 404 : 500;
            return new Response(status === 404 ? 'Not found' : 'Error', {
                status: status,
                headers: { 'content-type': 'text/plain; charset=utf-8' }
            });
        }
    });
}

function createWindow() {
    const iconPath = path.join(__dirname, 'icons', 'icon.png');
    const win = new BrowserWindow({
        width: 1280,
        height: 860,
        minWidth: 800,
        minHeight: 560,
        title: 'PythonShell',
        backgroundColor: '#eef2f5',
        icon: fs.existsSync(iconPath) ? iconPath : undefined,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    win.webContents.setWindowOpenHandler(function (details) {
        if (/^https?:/i.test(details.url)) {
            shell.openExternal(details.url);
        }
        return { action: 'deny' };
    });

    win.webContents.on('will-navigate', function (event, url) {
        if (url.startsWith(ORIGIN)) return;
        event.preventDefault();
        if (/^https?:/i.test(url)) {
            shell.openExternal(url);
        }
    });

    win.loadURL(ORIGIN + '/index.html');
}

const PY4E_URL = 'https://www.py4e.com/';
const ABOUT_DETAIL =
    'Provided free of charge by Python for Everybody (www.py4e.com)';

function showAbout(win) {
    const opts = {
        type: 'info',
        title: 'About PythonShell',
        message: 'PythonShell',
        detail: ABOUT_DETAIL + '\n\nVersion ' + app.getVersion(),
        buttons: ['Visit www.py4e.com', 'OK'],
        defaultId: 1,
        cancelId: 1,
        noLink: true
    };
    const shown = win ? dialog.showMessageBox(win, opts) : dialog.showMessageBox(opts);
    shown.then(function (result) {
        if (result.response === 0) {
            shell.openExternal(PY4E_URL);
        }
    });
}

function createMenu() {
    const isMac = process.platform === 'darwin';
    const aboutItem = {
        label: 'About PythonShell',
        click: function (_item, win) {
            showAbout(win);
        }
    };
    const template = [];
    if (isMac) {
        template.push({
            label: app.name,
            submenu: [
                aboutItem,
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        });
    }
    template.push(
        { role: 'fileMenu' },
        { role: 'editMenu' },
        { role: 'viewMenu' },
        { role: 'windowMenu' },
        {
            role: 'help',
            submenu: [
                {
                    label: 'Python for Everybody (www.py4e.com)',
                    click: function () {
                        shell.openExternal(PY4E_URL);
                    }
                }
            ].concat(isMac ? [] : [ { type: 'separator' }, aboutItem ])
        }
    );
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(function () {
    registerProtocol();

    session.defaultSession.setPermissionRequestHandler(function (_wc, _permission, callback) {
        callback(false);
    });

    app.setAboutPanelOptions({
        applicationName: 'PythonShell',
        applicationVersion: app.getVersion(),
        copyright: ABOUT_DETAIL,
        website: PY4E_URL
    });
    createMenu();

    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
