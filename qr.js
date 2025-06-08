const { makeid } = require('./gen-id');
const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
let router = express.Router();
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers
} = require("@whiskeysockets/baileys");
const { uploadFile } = require('telegra.ph-uploader');

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

async function uploadToTelegraph(filePath) {
    try {
        const result = await uploadFile(filePath);
        if (!Array.isArray(result) || !result[0]?.src) {
            throw new Error('Invalid response from Telegraph');
        }
        return `https://telegra.ph${result[0].src}`;
    } catch (error) {
        console.error('Telegraph upload error:', error);
        throw error;
    }
}

router.get('/', async (req, res) => {
    const id = makeid();
    const tempDir = path.join(__dirname, 'temp', id);
    
    async function GIFTED_MD_PAIR_CODE() {
        const { state, saveCreds } = await useMultiFileAuthState(tempDir);
        try {
            let sock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: "silent" }),
                browser: Browsers.macOS("Desktop"),
            });
            
            sock.ev.on('creds.update', saveCreds);
            sock.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect, qr } = update;
                
                if (qr) await res.end(await QRCode.toBuffer(qr));
                
                if (connection === "open") {
                    await delay(3000);
                    const credsPath = path.join(tempDir, 'creds.json');
                    
                    try {
                        const telegraphUrl = await uploadToTelegraph(credsPath);
                        const sessionCode = "ANJU-XPRO~" + telegraphUrl;
                        
                        await sock.sendMessage(sock.user.id, { text: sessionCode });
                        
                        const cap = `🔐 *𝙳𝙾 𝙽𝙾𝚃 𝚂𝙷𝙰𝚁𝙴 𝚃𝙷𝙸𝚂 𝙲𝙾𝙳𝙴!*\n\n` +
                                   `Use this to create your *𝚀𝚄𝙴𝙴𝙽 𝙰𝙽𝙹𝚄 𝚇𝙿𝚁𝙾* WhatsApp Bot\n\n` +
                                   `📌 *WEBSITE:* https://xpro-botz-ofc.vercel.app/\n\n` +
                                   `⚠️ *NEVER SHARE YOUR SESSION CODE!*`;
                        
                        await sock.sendMessage(sock.user.id, {
                            text: cap,
                            contextInfo: {
                                externalAdReply: {
                                    title: "QUEEN ANJU XPRO",
                                    thumbnailUrl: "https://telegra.ph/file/adc46970456c26cad0c15.jpg",
                                    sourceUrl: "https://whatsapp.com/channel/0029Vaj5XmgFXUubAjlU5642",
                                    mediaType: 2,
                                    renderLargerThumbnail: true
                                }
                            }
                        });
                        
                        await sock.ws.close();
                        removeFile(tempDir);
                        console.log(`✅ ${sock.user.id} Connected - Restarting...`);
                        process.exit(0);
                    } catch (e) {
                        console.error("Upload error:", e);
                        await sock.sendMessage(sock.user.id, { text: `Error: ${e.message}` });
                        removeFile(tempDir);
                        process.exit(1);
                    }
                }
            });
        } catch (err) {
            console.error("Service error:", err);
            removeFile(tempDir);
            if (!res.headersSent) res.send({ code: "Service Unavailable" });
        }
    }
    await GIFTED_MD_PAIR_CODE();
});

// Restart every 30 minutes
setInterval(() => {
    console.log("🔄 Restarting process...");
    process.exit(0);
}, 1800000);

module.exports = router;
