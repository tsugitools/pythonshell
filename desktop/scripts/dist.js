'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runBuilder(args) {
    const result = spawnSync(
        'npx',
        ['electron-builder', ...args],
        { stdio: 'inherit', shell: true }
    );
    if (result.status) process.exit(result.status || 1);
}

runBuilder(['--publish', 'never']);

const profile = path.join(__dirname, '..', 'build', 'embedded.provisionprofile');
if (process.platform === 'darwin' && fs.existsSync(profile)) {
    runBuilder(['--mac', 'mas', '--universal', '--publish', 'never']);
}
