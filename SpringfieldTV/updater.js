process.chdir(__dirname);
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const REPO_RAW = 'https://raw.githubusercontent.com/tuoUsername/springfieldtv/main';
const EXE_NAME = 'SpringfieldTV.exe';

function getRemoteConfig() {
    return new Promise((resolve, reject) => {
        https.get(`${REPO_RAW}/config.json`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
            });
        }).on('error', reject);
    });
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        }).on('error', reject);
    });
}

async function checkAndUpdate() {
    let localConfig;
    try {
        localConfig = JSON.parse(fs.readFileSync('config.json', 'utf8'));
    } catch(e) {
        console.log('Config locale non trovato, aggiorno forzatamente');
        localConfig = { version: '0.0.0' };
    }

    let remoteConfig;
    try {
        remoteConfig = await getRemoteConfig();
    } catch(e) {
        console.log('Impossibile controllare aggiornamenti, proseguo');
        return;
    }

    if (remoteConfig.version !== localConfig.version) {
        console.log(`Nuova versione disponibile: ${remoteConfig.version}. Scarico...`);
        const exePath = path.join(process.cwd(), EXE_NAME);
        const newExePath = exePath + '.new';
        await downloadFile(`${REPO_RAW}/${EXE_NAME}`, newExePath);

        // Rimpiazza il vecchio exe (funziona su Windows)
        const batch = `
@echo off
timeout /t 2 /nobreak >nul
move /Y "${newExePath}" "${exePath}"
start "" "${exePath}"
del "%~f0"
`;
        const batchFile = path.join(process.cwd(), 'update.bat');
        fs.writeFileSync(batchFile, batch);
        exec(`start "" "${batchFile}"`);
        process.exit(0);
    } else {
        console.log('Versione già aggiornata');
    }
}

// Prima avvia il controllo aggiornamenti, poi esegue player.js
checkAndUpdate().then(() => {
    require('./player.js');
}).catch(err => {
    console.error('Errore aggiornamento:', err);
    require('./player.js');
});