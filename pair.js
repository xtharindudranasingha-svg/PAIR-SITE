const { makeid } = require('./gen-id');
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const pino = require('pino');
const logger = pino({ level: 'info' });
const {
    makeWASocket,
    useMultiFileAuthState,
    delay,
    Browsers,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const { uploadFile } = require('telegra.ph-uploader');

function removeFile(filePath) {
    if (!fs.existsSync(filePath)) return false;
    fs.rmSync(filePath, { recursive: true, force: true });
}

async function uploadToTelegraph(filePath) {
    try {
        const result = await uploadFile(filePath);
        if (!Array.isArray(result) || !result[0]?.src) {
            throw new Error('Invalid Telegraph response');
        }
        return `https://telegra.ph${result[0].src}`;
    } catch (error) {
        logger.error(`Telegraph upload failed: ${error}`);
        throw error;
    }
}

async function GIFTED_MD_PAIR_CODE(id, num, res) {
    const tempDir = path.join(__dirname, 'temp', id);
    const { state, saveCreds } = await useMultiFileAuthState(tempDir);
    
    try {
        const { version } = await fetchLatestBaileysVersion();
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger,
            browser: Browsers.macOS('Safari'),
            version
        });

        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                await delay(3000);
                const credsPath = path.join(tempDir, 'creds.json');
                
                try {
                    const telegraphUrl = await uploadToTelegraph(credsPath);
                    const sessionCode = "ANJU-XPRO~" + telegraphUrl;
                    
                    await sock.sendMessage(sock.user.id, { text: sessionCode });
                    
                    const cap = `🔐 *𝙳𝙾 𝙽𝙾𝚃 𝚂𝙷𝙰𝚁𝙴 𝚃𝙷𝙸𝚂 𝙲𝙾𝙳𝙴!*\n\n` +
                               `Pairing successful for: ${num}\n\n` +
                               `📌 *WEBSITE:* https://xpro-botz-ofc.vercel.app/\n\n` +
                               `⚠️ *NEVER SHARE YOUR SESSION CODE!*`;
                    
                    await sock.sendMessage(sock.user.id, {
                        text: cap,
                        contextInfo: {
                            externalAdReply: {
                                title: "QUEEN ANJU XPRO",
                                thumbnailUrl: "https://telegra.ph/file/adc46970456c26cad0c15.jpg",
                                sourceUrl: "https://whatsapp.com/channel/0029Vaj5XmgFXUubAjlU5642",
                                mediaType: 2
                            }
                        }
                    });
                    
                    await sock.ws.close();
                    removeFile(tempDir);
                    logger.info(`✅ ${sock.user.id} Connected - Restarting...`);
                    process.exit(0);
                } catch (e) {
                    logger.error(`Upload failed: ${e}`);
                    await sock.sendMessage(sock.user.id, { text: `Error: ${e.message}` });
                    removeFile(tempDir);
                    process.exit(1);
                }
            }
        });
        
        if (!sock.authState.creds.registered) {
            await delay(1500);
            const cleanNum = num.replace(/[^0-9]/g, '');
            const code = await sock.requestPairingCode(cleanNum);
            if (!res.headersSent) res.send({ code });
        }
    } catch (error) {
        logger.error(`Pairing error: ${error}`);
        removeFile(tempDir);
        if (!res.headersSent) res.status(500).send({ error: "Pairing failed" });
    }
}

router.get('/', async (req, res) => {
    const num = req.query.number;
    if (!num) return res.status(400).send({ error: "Number required" });
    
    await GIFTED_MD_PAIR_CODE(makeid(), num, res);
});

// Restart every 30 minutes
setInterval(() => {
    logger.info("🔄 Restarting process...");
    process.exit(0);
}, 1800000);

module.exports = router;
