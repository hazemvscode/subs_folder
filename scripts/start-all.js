const { spawn } = require('child_process');
const path = require('path');

const run = (name, script) => {
    const child = spawn(process.execPath, [path.join(__dirname, '..', script)], {
        stdio: 'inherit',
        env: process.env
    });

    child.on('exit', (code) => {
        console.error(`${name} exited with code ${code}`);
        process.exit(code || 0);
    });

    return child;
};

run('web', 'web_subs/server.js');
run('bot', 'bot_subs/index.js');
