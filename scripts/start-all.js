const { spawn } = require('child_process');
const path = require('path');

const run = (name, script) => {
    console.log(`[System] Starting ${name} process...`);
    const child = spawn(process.execPath, [path.join(__dirname, '..', script)], {
        stdio: 'inherit',
        env: process.env
    });

    child.on('exit', (code) => {
        console.error(`[System] CRITICAL: ${name} exited with code ${code}. Shutting down app.`);
        process.exit(code || 0);
    });

    return child;
};

run('web', 'web_subs/server.js');
run('bot', 'bot_subs/index.js');
