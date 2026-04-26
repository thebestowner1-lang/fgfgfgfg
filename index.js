const express = require('express');
const https = require('https');

const app = express();
app.use(express.json({ limit: '100000mb' })); // Better for larger payloads

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

// ====================== STORAGE ======================
let recentPosts = [];

// ====================== DISCORD WEBHOOK ======================
function sendWebhook(entry) {
    if (!WEBHOOK_URL) return;

    const payload = JSON.stringify({
        username: "Syntax Logger",
        content: `🌹 **New Post**\n**Brainrot:** ${entry.brainrot}\n**Tier:** ${entry.tier}\n**Income:** ${entry.income}\n**Job ID:** \`${entry.jobId}\``,
    });

    const url = new URL(WEBHOOK_URL);
    const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    const req = https.request(options, () => {});
    req.on('error', (err) => console.error("Webhook error:", err.message));
    req.write(payload);
    req.end();
}

// ====================== MAIN ENDPOINT /post ======================
app.post('/post', (req, res) => {
    console.log("📥 Received raw body:", JSON.stringify(req.body, null, 2));

    const { 
        brainrot, 
        tier, 
        income, 
        encryptedJobId, 
        placeId, 
        time, 
        allFound 
    } = req.body;

    if (!brainrot) {
        console.log("❌ Missing brainrot");
        return res.status(400).json({ error: "Missing brainrot" });
    }

    if (!encryptedJobId) {
        console.log("❌ Missing encryptedJobId");
        return res.status(400).json({ error: "Missing encryptedJobId" });
    }

    const jobId = decryptJobId(encryptedJobId);

    const newEntry = {
        brainrot: brainrot,
        tier: tier || "unknown",
        income: income || "0",
        jobId: jobId,
        encryptedJobId: encryptedJobId,
        placeId: placeId || game.PlaceId || "unknown",
        time: time ? new Date(time * 1000).toISOString() : new Date().toISOString(),
        allFound: allFound || [],
        receivedAt: new Date().toISOString()
    };

    recentPosts.unshift(newEntry);
    if (recentPosts.length > 9000000000000000) recentPosts.pop();

    console.log(`✅ Successfully received & decrypted: ${brainrot} | JobId: ${jobId}`);

    sendWebhook(newEntry);

    // Return plain JSON
    res.status(200).json({
        success: true,
        message: "Data received and decrypted",
        decryptedJobId: jobId,
        brainrot: brainrot,
        totalPosts: recentPosts.length
    });
});

// ====================== VIEW POSTS (plain JSON) ======================
app.get('/posts', (req, res) => {
    res.status(200).json({
        total: recentPosts.length,
        posts: recentPosts
    });
});

// Health
app.get('/health', (req, res) => {
    res.json({ 
        status: "ok", 
        message: "API is running", 
        totalPosts: recentPosts.length 
    });
});

// Root
app.get('/', (req, res) => {
    res.json({ 
        message: "Syntax API is running. Use POST /post and GET /posts" 
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Syntax API running on port ${PORT}`);
    console.log(`📡 Send data to: /post`);
    console.log(`📋 View logs at: /posts`);
});
