const express = require('express');
const https = require('https');

const app = express();
app.use(express.json({ limit: '10mb' }));

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
        return out || "[EMPTY]";
    } catch (error) {
        console.error("[DECRYPT ERROR]", error.message);
        return "[DECRYPTION_FAILED]";
    }
}

// ====================== STORAGE ======================
let recentPosts = [];

// FIX: Clear posts older than 10 seconds every second
const POST_TTL_MS = 10000; // 10 seconds

setInterval(() => {
    const now = Date.now();
    const before = recentPosts.length;
    recentPosts = recentPosts.filter(post => {
        const age = now - new Date(post.receivedAt).getTime();
        return age < POST_TTL_MS;
    });
    const removed = before - recentPosts.length;
    if (removed > 0) {
        console.log(`🗑 Cleared ${removed} expired post(s). Remaining: ${recentPosts.length}`);
    }
}, 1000);

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
    try {
    console.log("📥 Received raw body:", JSON.stringify(req.body, null, 2));

    const {
        brainrot,
        tier,
        income,
        encryptedJobId,
        jobId: rawJobId,
        placeId,
        time,
        allFound
    } = req.body;

    if (!brainrot) {
        console.log("❌ Missing brainrot");
        return res.status(400).json({ error: "Missing brainrot" });
    }

    // Accept either an encrypted jobId OR a plain jobId — whichever the client sends
    if (!encryptedJobId && !rawJobId) {
        console.log("❌ Missing jobId (need encryptedJobId or jobId)");
        return res.status(400).json({ error: "Missing jobId" });
    }

    // Decrypt if encrypted was provided, otherwise use plain jobId directly
    const jobId = encryptedJobId ? decryptJobId(encryptedJobId) : rawJobId;

    const newEntry = {
        brainrot: brainrot,
        tier: tier || "unknown",
        income: income || "0",
        jobId: jobId,
        encryptedJobId: encryptedJobId,
        placeId: placeId || "unknown",
        time: time ? new Date(time * 1000).toISOString() : new Date().toISOString(),
        allFound: allFound || [],
        receivedAt: new Date().toISOString()  // used for TTL expiry
    };

    recentPosts.unshift(newEntry);
    if (recentPosts.length > 30) recentPosts.pop();

    console.log(`✅ Successfully received & decrypted: ${brainrot} | JobId: ${jobId}`);

    sendWebhook(newEntry);

    res.status(200).json({
        success: true,
        message: "Data received and decrypted",
        decryptedJobId: jobId,
        brainrot: brainrot,
        totalPosts: recentPosts.length
    });
    } catch (err) {
        console.error("❌ /post handler crashed:", err);
        res.status(500).json({ error: "Internal server error", details: err.message });
    }
});

// ====================== VIEW POSTS ======================
app.get('/posts', (req, res) => {
    // Also filter on read so clients always get fresh data
    const now = Date.now();
    const livePosts = recentPosts.filter(post => {
        return now - new Date(post.receivedAt).getTime() < POST_TTL_MS;
    });

    res.status(200).json({
        total: livePosts.length,
        posts: livePosts
    });
});

// Health
app.get('/health', (req, res) => {
    res.json({
        status: "ok",
        message: "API is running",
        totalPosts: recentPosts.length,
        postTTL: `${POST_TTL_MS / 1000}s`
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
    console.log(`⏱ Posts expire after: ${POST_TTL_MS / 1000}s`);
});
