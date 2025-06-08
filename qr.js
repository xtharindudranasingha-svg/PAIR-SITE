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

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
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
                        // Read and encode creds.json to Base64
                        const credsData = fs.readFileSync(credsPath);
                        const base64Creds = credsData.toString('base64');
                        
                        // Send session code with Base64 data
                        const sessionCode = "ANJU-XPRO~" + base64Creds;
                        await sock.sendMessage(sock.user.id, { text: sessionCode });
                        
                        const cap = `🔐 *𝙳𝙾 �𝙽𝙾𝚃 𝚂𝙷𝙰𝚁𝙴 𝚃𝙷𝙸𝚂 𝙲𝙾𝙳𝙴!*\n\n` +
                                   `Your session credentials are encoded above\n\n` +
                                   `📌 *WEBSITE:* https://xpro-botz-ofc.vercel.app/\n\n` +
                                   `⚠️ *NEVER SHARE THIS MESSAGE!*`;
                        
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
                        console.error("Error:", e);
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
