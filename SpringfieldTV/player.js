const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');

// === RANGE STAGIONI ===
const STAGIONI = {
    1:  [[11161, 11172]], 2:  [[11174, 11195]], 3:  [[11196, 11213]],
    4:  [[11220, 11241]], 5:  [[11242, 11263]], 6:  [[11264, 11288]],
    7:  [[11289, 11313]], 8:  [[11314, 11338]], 9:  [[11339, 11363]],
    10: [[11364, 11386]],11: [[11387, 11408]],12: [[11409, 11429]],
    13: [[11430, 11451]],14: [[11452, 11473]],15: [[11474, 11495]],
    16: [[11496, 11516]],17: [[11517, 11538]],18: [[11539, 11556]],
    19: [[11561, 11580]],20: [[11581, 11601]],21: [[11602, 11624]],
    22: [[11625, 11646]],23: [[11647, 11668]],24: [[11669, 11690]],
    25: [[11691, 11712]],26: [[11713, 11734]],27: [[11735, 11756]],
    28: [[11757, 11778]],29: [[11779, 11799]],30: [[11800, 11822]],
    31: [[11845, 11866]],32: [[11823, 11844]],33: [[11867, 11887]],
    34: [[57116, 57136]],
    35: [[80468, 80473], [81130, 81137], [81364, 81367]],
    36: [[211487, 211514]]
};

function episodioCasuale() {
    const stagioni = Object.keys(STAGIONI);
    const stagione = stagioni[Math.floor(Math.random() * stagioni.length)];
    const ranges = STAGIONI[stagione];
    const [min, max] = ranges[Math.floor(Math.random() * ranges.length)];
    const episodio = Math.floor(Math.random() * (max - min + 1)) + min;
    return { stagione: parseInt(stagione), id: episodio };
}

const CONFIG_URL = 'https://raw.githubusercontent.com/TheSimpsons-random-episode-player/blob/main/SpringfieldTV/config.json';

function scaricaConfig() {
    return new Promise((resolve) => {
        https.get(CONFIG_URL, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const remoteConfig = JSON.parse(data);
                    const configPath = path.join(__dirname, 'config.json');
                    fs.writeFileSync(configPath, JSON.stringify(remoteConfig, null, 2));
                    console.log(`[OK] Config aggiornato — dominio: ${remoteConfig.domain}`);
                } catch(e) {
                    console.log('[WARN] Config remoto non valido, uso quello locale.');
                }
                resolve();
            });
        }).on('error', () => {
            console.log('[WARN] Impossibile scaricare config, uso quello locale.');
            resolve();
        });
    });
}

let DOMINIO = 'streamingcommunityz.company';
try {
    const configPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.domain && typeof config.domain === 'string') {
            DOMINIO = config.domain;
        }
    }
    console.log(`Dominio impostato: ${DOMINIO}`);
} catch (e) {
    console.log('Impossibile leggere config.json, uso dominio di default.');
}

(async () => {
    await scaricaConfig();
    try {
        const configPath = path.join(__dirname, 'config.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.domain && typeof config.domain === 'string') {
            DOMINIO = config.domain;
        }
    } catch(e) {}

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: [
            '--start-fullscreen',
            '--autoplay-policy=no-user-gesture-required',
            '--no-first-run'
        ]
    });

    const pages = await browser.pages();
    const page = pages[0];

    for (let i = 1; i < pages.length; i++) {
        try { await pages[i].close(); } catch(e) {}
    }
    await page.bringToFront();

    browser.on('targetcreated', async (target) => {
        if (target.type() === 'page') {
            const newPage = await target.page();
            if (newPage && newPage !== page) {
                await newPage.close();
            }
        }
    });

    browser.on('disconnected', () => {
        console.log('Browser chiuso, arresto dello script.');
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        console.log('Interruzione manuale, chiusura browser...');
        await browser.close();
        process.exit(0);
    });

    const SERIE_ID = 1304;
    const FILE_VISTI = 'episodi_visti.json';

    let episodiVisti = [];
    try {
        episodiVisti = JSON.parse(fs.readFileSync(FILE_VISTI, 'utf8'));
        console.log(`Già visti: ${episodiVisti.length} episodi`);
    } catch(e) {
        episodiVisti = [];
    }

    const idVisti = () => episodiVisti.map(e => e.id);

    console.log('=== SPRINGFIELD TV PLAYER ===\n');
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    while (true) {
        let ep;
        let tentativi = 0;
        do {
            ep = episodioCasuale();
            tentativi++;
            if (tentativi > 100) {
                console.log('Reset lista episodi visti.');
                episodiVisti = [];
                fs.writeFileSync(FILE_VISTI, '[]');
            }
        } while (idVisti().includes(ep.id));

        const url = `https://${DOMINIO}/it/watch/${SERIE_ID}?e=${ep.id}`;
        console.log(`\n🎲 Stagione ${ep.stagione}, ID: ${ep.id}`);

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            console.log('[OK] Caricato');

            await page.bringToFront();

            await page.waitForSelector('iframe[data-v-6e2e9d2b]', { visible: true, timeout: 10000 }).catch(() => {});
            await sleep(1500);

            let played = false;
            const iframeElement = await page.$('iframe[data-v-6e2e9d2b]');
            if (iframeElement) {
                const frame = await iframeElement.contentFrame();
                if (frame) {
                    await frame.waitForSelector('.jw-icon-display', { timeout: 8000 }).catch(() => {});
                    await frame.click('.jw-icon-display').catch(() => {});
                    played = true;
                    console.log('[OK] Play (iframe)');
                }
            }

            if (!played) {
                console.log('[WARN] Fallback play');
                const iframeGenerico = await page.$('iframe[data-v-6e2e9d2b]') || await page.$('iframe');
                if (iframeGenerico) {
                    const box = await iframeGenerico.boundingBox();
                    if (box) {
                        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                        await sleep(500);
                        await page.keyboard.press('Space');
                        console.log('[OK] Play (fallback)');
                    }
                }
            }

            console.log('In attesa della fine episodio (22 min)...');
            await sleep(23 * 60 * 1000);

        } catch(e) {
            console.log('[ERRORE]', e.message);
            await sleep(23 * 60 * 1000); // anche in caso di errore aspetta 22 minuti
        }

        episodiVisti.push({
            id: ep.id,
            stagione: ep.stagione,
            visto: new Date().toLocaleString('it-IT')
        });
        fs.writeFileSync(FILE_VISTI, JSON.stringify(episodiVisti, null, 2));
        console.log(`[Visti: ${episodiVisti.length}] S${ep.stagione} ID:${ep.id}`);
    }
})();
