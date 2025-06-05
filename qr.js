const { makeid } = require('./gen-id');
const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const router = express.Router();
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
    const sessionId = makeid();
    const tempDir = path.join(__dirname, 'temp', sessionId);
    
    try {
        const { state, saveCreds } = await useMultiFileAuthState(tempDir);
        
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
            },
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS('Desktop'),
            syncFullHistory: false
        });

        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            // Send QR code if available
            if (qr) {
                try {
                    const qrBuffer = await QRCode.toBuffer(qr);
                    if (!res.headersSent) {
                        res.set('Content-Type', 'image/png');
                        res.end(qrBuffer);
                    }
                } catch (qrError) {
                    console.error('QR generation failed:', qrError);
                }
            }
            
            if (connection === 'open') {
                try {
                    await delay(3000); // Give some time for connection to stabilize
                    
                    // Get credentials file path
                    const credsPath = path.join(tempDir, 'creds.json');
                    if (!fs.existsSync(credsPath)) {
                        throw new Error('Credentials file not found');
                    }
                    
                    // Read credentials file
                    const credsData = fs.readFileSync(credsPath, 'utf8');
                    
                    // Send credentials file to user
                    await sock.sendMessage(sock.user.id, {
                        document: { url: credsPath },
                        fileName: 'creds.json',
                        mimetype: 'application/json',
                        caption: '⚠️ *DO NOT SHARE THIS FILE WITH ANYONE* ⚠️\n\nThis file contains your WhatsApp session credentials.'
                    });
                    
                    // Send instructions for repository upload
                    const instructions = `📁 *HOW TO SETUP YOUR SESSION* 📁\n\n`
                        + `1️⃣ *Save the creds.json file* you just received\n`
                        + `2️⃣ *Upload creds.json* to your repository\n`
                        + `🔒 *Security Note:*\n`
                        + `- Keep your repository private\n`
                        + `- Never commit this file to public repositories\n\n`
                        + `💻 *GitHub Guide:* https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository`;
                    
                    await sock.sendMessage(sock.user.id, { 
                        text: instructions,
                        contextInfo: {
                            externalAdReply: {
                                title: "QUEEN ANJU XPRO - SESSION SETUP",
                                body: "Follow these steps to complete your setup",
                                thumbnailUrl: "https://telegra.ph/file/adc46970456c26cad0c15.jpg",
                                sourceUrl: "https://github.com/XPRO-BOTZ-OFC",
                                mediaType: 1
                            }
                        }
                    });
                    
                    // Additional help message
                    await sock.sendMessage(sock.user.id, {
                        text: `Need help setting up? Join our support group:\nhttps://chat.whatsapp.com/YourSupportGroupLink`
                    });
                    
                } catch (error) {
                    console.error('Session generation error:', error);
                    await sock.sendMessage(sock.user.id, {
                        text: `❌ *ERROR GENERATING SESSION* ❌\n\n`
                            + `Error: ${error.message}\n\n`
                            + `Please try again or contact support.`
                    });
                } finally {
                    // Clean up and close connection
                    await delay(1000);
                    removeFile(tempDir);
                    sock.ws.close();
                    process.exit(0);
                }
            }
            
            if (connection === 'close') {
                if (lastDisconnect?.error?.output?.statusCode !== 401) {
                    console.log('Connection closed, reconnecting...');
                    await delay(5000);
                    removeFile(tempDir);
                    return router.handle(req, res); // Restart the process
                }
            }
        });
        
    } catch (error) {
        console.error('Initialization error:', error);
        removeFile(tempDir);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to initialize session' });
        }
    }
});

// Restart every 30 minutes to prevent memory leaks
setInterval(() => {
    console.log('🔄 Restarting process to maintain stability...');
    process.exit(0);
}, 1800000); // 30 minutes

module.exports = router;
