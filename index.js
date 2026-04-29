const express = require('express');
const https = require('https');

const app = express();
app.use(express.json({ limit: '100000mb' }));

const ENCRYPT_KEY = "Syntax_AJ";
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "https://discord.com/api/webhooks/1497871118353301505/pxucTuyC0GFBkbkUc8oq8s5KWnhBl1x8BE_vD1mSzgcoHqCPToTOn4JBBbFKSvJufcdq";

// ====================== DECRYPTION ======================
function fromHex(hex) {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
}

function decryptJobId(hex) {
    try {
        const x = fromHex(hex);
        let out = '';
        for (let i = 0; i < x.length; i++) {
            const c = x.charCodeAt(i);
            const k = ENCRYPT_KEY.charCodeAt(i % ENCRYPT_KEY.length);
            out += String.fromCharCode(c ^ k);
        }
        return out || "[EMPTY]";
    } catch (error) {
        console.error("[DECRYPT ERROR]", error.message);
        return "[DECRYPTION_FAILED]";
    }
}

// ====================== SEPARATE STORAGE ======================
let scannerPosts = [];  // /post  → /posts
let botPosts     = [];  // /api   → /data

// ====================== DISCORD WEBHOOK ======================
function sendWebhook(entry, isBot) {
    if (!WEBHOOK_URL) return;

    const content = isBot
        ? `🤖 **Bot Find**\n**User:** ${entry.botName}\n**Brainrot:** ${entry.brainrot}\n**Tier:** ${entry.tier}\n**Income:** ${entry.income}\n**Bot Job ID:** \`${entry.botJobId}\`\n**Total Finds:** ${entry.totalFind}`
        : `🌹 **Scanner Find**\n**Brainrot:** ${entry.brainrot}\n**Tier:** ${entry.tier}\n**Income:** ${entry.income}\n**Job ID:** \`${entry.jobId}\``;

    const payload = JSON.stringify({ username: "Syntax Logger", content });

    const url = new URL(WEBHOOK_URL);
    const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    };

    const req = https.request(options, () => {});
    req.on('error', (err) => console.error("Webhook error:", err.message));
    req.write(payload);
    req.end();
}

// ====================== SHARED ENTRY BUILDER ======================
function buildEntry(body, isBot) {
    const { brainrot, tier, income, encryptedJobId, placeId, time, allFound, botName, botJobId, totalFind, timestamp } = body;

    if (!brainrot)       return { error: "Missing brainrot" };
    if (!encryptedJobId) return { error: "Missing encryptedJobId" };

    const jobId = decryptJobId(encryptedJobId);

    let resolvedTime;
    if (timestamp) {
        resolvedTime = isNaN(Number(timestamp))
            ? new Date(timestamp).toISOString()
            : new Date(Number(timestamp) * 1000).toISOString();
    } else if (time) {
        resolvedTime = new Date(time * 1000).toISOString();
    } else {
        resolvedTime = new Date().toISOString();
    }

    const entry = {
        brainrot:       brainrot,
        tier:           tier || "unknown",
        income:         income || "0",
        jobId:          jobId,
        encryptedJobId: encryptedJobId,
        placeId:        placeId || "unknown",
        time:           resolvedTime,
        allFound:       allFound || [],
        receivedAt:     new Date().toISOString(),
    };

    if (isBot) {
        entry.botName   = botName  || "unknown";
        entry.botJobId  = botJobId || "unknown";
        entry.totalFind = totalFind !== undefined ? Number(totalFind) : 0;
    }

    return entry;
}

// ====================== SCANNER: POST /post → GET /posts ======================
app.post('/post', (req, res) => {
    console.log("📥 [SCANNER] raw body:", JSON.stringify(req.body, null, 2));

    const entry = buildEntry(req.body, false);
    if (entry.error) return res.status(400).json({ error: entry.error });

    scannerPosts.unshift(entry);
    console.log(`✅ [SCANNER] ${entry.brainrot} | JobId: ${entry.jobId}`);
    sendWebhook(entry, false);

    return res.status(200).json({
        success:        true,
        message:        "Scanner data received",
        decryptedJobId: entry.jobId,
        brainrot:       entry.brainrot,
        totalPosts:     scannerPosts.length
    });
});

app.get('/posts', (req, res) => {
    return res.status(200).json({ total: scannerPosts.length, posts: scannerPosts });
});

// ====================== BOT: POST /api → GET /data ======================
app.post('/api', (req, res) => {
    console.log("📥 [BOT] raw body:", JSON.stringify(req.body, null, 2));

    const entry = buildEntry(req.body, true);
    if (entry.error) return res.status(400).json({ error: entry.error });

    botPosts.unshift(entry);
    console.log(`✅ [BOT] ${entry.brainrot} | User: ${entry.botName} | BotJobId: ${entry.botJobId} | TotalFind: ${entry.totalFind}`);
    sendWebhook(entry, true);

    return res.status(200).json({
        success:        true,
        message:        "Bot data received",
        decryptedJobId: entry.jobId,
        brainrot:       entry.brainrot,
        botName:        entry.botName,
        botJobId:       entry.botJobId,
        totalFind:      entry.totalFind,
        totalPosts:     botPosts.length
    });
});

app.get('/data', (req, res) => {
    return res.status(200).json({ total: botPosts.length, posts: botPosts });
});

// ====================== MISC ======================
app.get('/health', (req, res) => res.json({
    status:        "ok",
    scannerPosts:  scannerPosts.length,
    botPosts:      botPosts.length
}));

app.get('/', (req, res) => res.json({
    scanner: { post: "POST /post", logs: "GET /posts" },
    bot:     { post: "POST /api",  logs: "GET /data"  }
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Syntax API running on port ${PORT}`);
    console.log(`🔍 Scanner → POST /post  | GET /posts`);
    console.log(`🤖 Bot     → POST /api   | GET /data`);
});
