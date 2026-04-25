const express = require('express');
const https = require('https');

const app = express();
app.use(express.json());

const ENCRYPT_KEY = "Syntax_AJ";
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";

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
        return out;
    } catch (error) {
        console.error("[DECRYPT ERROR]", error.message);
        return "[DECRYPTION_FAILED]";
    }
}

// ====================== STORAGE ======================
let recentPosts = [];

// ====================== DISCORD WEBHOOK (built-in) ======================
function sendWebhook(entry) {
    if (!WEBHOOK_URL) return;

    const payload = JSON.stringify({
        username: "Syntax Logger",
        content: `🌹 **New Brainrot Detected**\n**Brainrot:** ${entry.brainrot}\n**Tier:** ${entry.tier}\n**Income:** ${entry.income}\n**Job ID:** \`${entry.jobId}\``,
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

// ====================== MAIN ENDPOINT ======================
app.post('/post', (req, res) => {
    const { brainrot, tier, income, encryptedJobId, placeId, time, allFound } = req.body;

    if (!brainrot || !encryptedJobId) {
        return res.status(400).json({ error: "Missing brainrot or encryptedJobId" });
    }

    const jobId = decryptJobId(encryptedJobId);

    const newEntry = {
        brainrot,
        tier: tier || "unknown",
        income: income || "0",
        jobId,
        encryptedJobId,
        placeId: placeId || "unknown",
        time: time ? new Date(time * 1000).toISOString() : new Date().toISOString(),
        allFound: allFound || [],
        receivedAt: new Date().toISOString()
    };

    recentPosts.unshift(newEntry);
    if (recentPosts.length > 30) recentPosts.pop();

    console.log(`📥 Received: ${brainrot} | Income: ${income} | JobId: ${jobId}`);

    sendWebhook(newEntry);

    // Return plain JSON
    res.status(200).json({
        success: true,
        message: "Data received successfully",
        decryptedJobId: jobId,
        data: newEntry
    });
});

// ====================== GET RECENT POSTS (plain JSON) ======================
app.get('/posts', (req, res) => {
    res.status(200).json({
        total: recentPosts.length,
        posts: recentPosts
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: "ok", 
        message: "API is running",
        totalPosts: recentPosts.length 
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Syntax API running on port ${PORT}`);
    console.log(`📡 POST data to: /post`);
    console.log(`📋 View all posts (JSON) at: /posts`);
    if (!WEBHOOK_URL) {
        console.log(`⚠️  DISCORD_WEBHOOK_URL not set - webhook disabled`);
    }
});
