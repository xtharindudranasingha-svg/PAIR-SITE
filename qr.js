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
    Browsers,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");
const FormData = require('form-data');
const axios = require('axios');

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

// Improved Telegraph upload function
async function uploadToTelegraph(sessionData) {
    try {
        // Create a temporary text file with the session data
        const tempFilePath = path.join(__dirname, 'temp_session.txt');
        fs.writeFileSync(tempFilePath, sessionData);
        
        const form = new FormData();
        form.append('file', fs.createReadStream(tempFilePath), {
            filename: 'session.txt',
            contentType: 'text/plain'
        });
        
        const response = await axios.post('https://telegra.ph/upload', form, {
            headers: {
                ...form.getHeaders(),
                'Content-Length': form.getLengthSync()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        
        // Clean up temporary file
        fs.unlinkSync(tempFilePath);
        
        if (response.data && response.data[0] && response.data[0].src) {
            return `https://telegra.ph${response.data[0].src}`;
        }
        throw new Error('Invalid response from Telegraph');
    } catch (error) {
        console.error(`Telegraph upload error: ${error.message}`);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
        throw error;
    }
}

router.get('/', async (req, res) => {
    const id = makeid();
    async function GIFTED_MD_PAIR_CODE() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);
        try {
            let sock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: "silent" }),
                browser: Browsers.macOS("Desktop"),
            });
            
            sock.ev.on('creds.update', saveCreds);
            sock.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect, qr } = s;
                if (qr) await res.end(await QRCode.toBuffer(qr));
                
                if (connection == "open") {
                    await delay(5000);
                    try {
                        // Read and prepare session data
                        const credsPath = path.join(__dirname, `temp/${id}/creds.json`);
                        const sessionData = fs.readFileSync(credsPath, 'utf8');
                        const preparedData = "ANJU-XPRO~" + sessionData;
                        
                        // Upload to Telegraph
                        const telegraphUrl = await uploadToTelegraph(preparedData);
                        const fileId = telegraphUrl.split('/').pop();
                        const sessionCode = "ANJU-XPRO~" + fileId;
                        
                        // Send session code to user
                        let code = await sock.sendMessage(sock.user.id, { text: sessionCode });
                        
                        // Send info message
                        let desc = `*𝙳𝚘𝚗𝚝 𝚜𝚑𝚊𝚛𝚎 𝚝𝚑𝚒𝚜 𝚌𝚘𝚍𝚎 𝚠𝚒𝚝𝚑 𝚊𝚗𝚢𝚘𝚗𝚎!! 𝚄𝚜𝚎 𝚝𝚑𝚒𝚜 𝚌𝚘𝚍𝚎 𝚝𝚘 𝚌𝚛𝚎𝚊𝚝𝚎 QUEEN ANJU MD 𝚆𝚑𝚊𝚝𝚜𝚊𝚙𝚙 𝚄𝚜𝚎𝚛 𝚋𝚘𝚝.*\n\n ◦ *Github:* https://github.com/Mrrashmika/Queen_Anju-MD`;
                        
                        await sock.sendMessage(sock.user.id, {
                            text: desc,
                            contextInfo: {
                                externalAdReply: {
                                    title: "QUEEN ANJU MD",
                                    thumbnailUrl: "https://telegra.ph/file/adc46970456c26cad0c15.jpg",
                                    sourceUrl: "https://whatsapp.com/channel/0029Vaj5XmgFXUubAjlU5642",
                                    mediaType: 1,
                                    renderLargerThumbnail: true
                                }  
                            }
                        }, { quoted: code });
                    } catch (e) {
                        console.error('Error in session handling:', e);
                        let errorMsg = await sock.sendMessage(sock.user.id, { 
                            text: `Error: ${e.message}\n\nPlease try again or contact support.`
                        });
                        
                        let desc = `*Failed to generate session code. Please try again.*\n\n ◦ *Github:* https://github.com/Mrrashmika/Queen_Anju-MD`;
                        await sock.sendMessage(sock.user.id, {
                            text: desc,
                            contextInfo: {
                                externalAdReply: {
                                    title: "QUEEN ANJU MD",
                                    thumbnailUrl: "https://telegra.ph/file/adc46970456c26cad0c15.jpg",
                                    sourceUrl: "https://whatsapp.com/channel/0029Vaj5XmgFXUubAjlU5642",
                                    mediaType: 2,
                                    renderLargerThumbnail: true
                                }  
                            }
                        }, { quoted: errorMsg });
                    } finally {
                        await delay(100);
                        await sock.ws.close();
                        await removeFile('./temp/' + id);
                        console.log(`👤 ${sock.user.id} Session completed. Restarting process...`);
                        process.exit();
                    }
                } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                    await delay(10000);
                    GIFTED_MD_PAIR_CODE();
                }
            });
        } catch (err) {
            console.error("Initialization error:", err);
            await removeFile('./temp/' + id);
            if (!res.headersSent) {
                await res.send({ code: "❗ Service Unavailable" });
            }
        }
    }
    await GIFTED_MD_PAIR_CODE();
});

// Restart every 30 minutes
setInterval(() => {
    console.log("☘️ 𝗥𝗲𝘀𝘁𝗮𝗿𝘁𝗶𝗻𝗴 𝗽𝗿𝗼𝗰𝗲𝘀𝘀...");
    process.exit();
}, 1800000); // 30 minutes

module.exports = router;
