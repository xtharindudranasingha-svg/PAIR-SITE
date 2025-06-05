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
const FormData = require('form-data');
const axios = require('axios');

// Improved file removal function
function removeFile(FilePath) {
    try {
        if (fs.existsSync(FilePath)) {
            fs.rmSync(FilePath, { recursive: true, force: true });
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error removing file:', error);
        return false;
    }
}

// Reliable Telegraph upload function
async function uploadToTelegraph(data) {
    try {
        // Create a temporary file with the session data
        const tempDir = path.join(__dirname, 'temp_uploads');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tempFilePath = path.join(tempDir, `session_${Date.now()}.txt`);
        fs.writeFileSync(tempFilePath, data);
        
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
            maxBodyLength: Infinity,
            timeout: 30000
        });
        
        // Clean up temporary file
        fs.unlinkSync(tempFilePath);
        
        if (!response.data?.[0]?.src) {
            throw new Error('Invalid response from Telegraph');
        }
        
        return `https://telegra.ph${response.data[0].src}`;
    } catch (error) {
        console.error('Telegraph upload failed:', error.message);
        throw new Error(`Upload failed: ${error.message}`);
    }
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
                    
                    // Read and prepare session data
                    const credsData = fs.readFileSync(credsPath, 'utf8');
                    const sessionData = `ANJU-XPRO~${credsData}`;
                    
                    // Upload to Telegraph
                    const telegraphUrl = await uploadToTelegraph(sessionData);
                    const fileId = telegraphUrl.split('/').pop();
                    const sessionCode = `ANJU-XPRO~${fileId}`;
                    
                    // Send session code to user
                    await sock.sendMessage(sock.user.id, { 
                        text: sessionCode,
                        contextInfo: {
                            externalAdReply: {
                                title: "QUEEN ANJU MD - SESSION CODE",
                                body: "Use this code to restore your session",
                                thumbnailUrl: "https://telegra.ph/file/adc46970456c26cad0c15.jpg",
                                sourceUrl: "https://github.com/Mrrashmika/Queen_Anju-MD",
                                mediaType: 1
                            }
                        }
                    });
                    
                    // Send instructions
                    const instructions = `*🔒 SESSION GENERATED SUCCESSFULLY 🔒*\n\n`
                        + `*⚠️ IMPORTANT:*\n`
                        + `• DO NOT share this code with anyone!\n`
                        + `• This code gives full access to your WhatsApp account\n\n`
                        + `*📌 How to use:*\n`
                        + `1. Copy the session code above\n`
                        + `2. Use it when setting up your bot\n\n`
                        + `*🔗 GitHub:* https://github.com/Mrrashmika/Queen_Anju-MD`;
                    
                    await sock.sendMessage(sock.user.id, { 
                        text: instructions,
                        contextInfo: {
                            externalAdReply: {
                                title: "QUEEN ANJU MD",
                                body: "Session generation complete",
                                thumbnailUrl: "https://telegra.ph/file/adc46970456c26cad0c15.jpg",
                                sourceUrl: "https://whatsapp.com/channel/0029Vaj5XmgFXUubAjlU5642",
                                mediaType: 1
                            }
                        }
                    });
                    
                } catch (error) {
                    console.error('Session generation error:', error);
                    await sock.sendMessage(sock.user.id, {
                        text: `❌ *SESSION GENERATION FAILED* ❌\n\n`
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
