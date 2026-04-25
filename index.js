const express = require('express');
const axios = require('axios');   // For sending webhook

const app = express();
app.use(express.json());

const ENCRYPT_KEY = "Syntax_AJ";
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || ""; // Set this in Railway Variables

// ====================== DECRYPTION (Exact match to your Roblox) ======================
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

// ====================== SEND DISCORD WEBHOOK ======================
async function sendWebhook(entry) {
    if (!WEBHOOK_URL) return;

    const embed = {
        title: "🌹 New Brainrot Server Found",
        color: 0xff69b4,
        fields: [
            { name: "Brainrot", value: entry.brainrot, inline: true },
            { name: "Tier", value: entry.tier, inline: true },
            { name: "Income", value: entry.income, inline: true },
            { name: "Job ID", value: `\`${entry.jobId}\``, inline: false },
            { name: "Place ID", value: entry.placeId.toString(), inline: true },
            { name: "Time", value: entry.time.toLocaleString(), inline: true }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "Syntax Railway Logger" }
    };

    try {
        await axios.post(WEBHOOK_URL, {
            username: "Syntax Logger",
            embeds: [embed]
        });
        console.log(`✅ Webhook sent for ${entry.brainrot}`);
    } catch (err) {
        console.error("❌ Webhook failed:", err.message);
    }
}

// ====================== MAIN ENDPOINT ======================
app.post('/post', async (req, res) => {
    const { 
        brainrot, 
        tier, 
        income, 
        encryptedJobId, 
        placeId, 
        time, 
        allFound 
    } = req.body;

    if (!brainrot || !encryptedJobId) {
        return res.status(400).json({ error: "Missing brainrot or encryptedJobId" });
    }

    const jobId = decryptJobId(encryptedJobId);

    const newEntry = {
        brainrot: brainrot,
        tier: tier || "unknown",
        income: income || "0",
        jobId: jobId,
        encryptedJobId: encryptedJobId,
        placeId: placeId || "unknown",
        time: time ? new Date(time * 1000) : new Date(),
        allFound: allFound || [],
        receivedAt: new Date()
    };

    // Add to recent posts (newest first)
    recentPosts.unshift(newEntry);
    if (recentPosts.length > 30) recentPosts.pop();

    console.log(`📥 Received: ${brainrot} | Income: ${income} | JobId: ${jobId}`);

    // Send Discord Webhook
    sendWebhook(newEntry);

    return res.status(200).json({
        success: true,
        message: "Data received and decrypted",
        jobId: jobId,
        brainrot: brainrot
    });
});

// ====================== VIEW PAGE ======================
app.get('/', (req, res) => {
    let html = `
    <html>
    <head>
        <title>Syntax Posts</title>
        <style>
            body { font-family: Arial; background: #0f0f0f; color: #fff; padding: 20px; }
            h1 { color: #ff69b4; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #444; padding: 10px; text-align: left; }
            th { background: #1f1f1f; }
            .copy { cursor: pointer; color: #00ff88; }
        </style>
    </head>
    <body>
        <h1>🌹 Syntax Live Posts</h1>
        <p>Total: ${recentPosts.length} posts</p>
        <table>
            <tr>
                <th>Brainrot</th>
                <th>Tier</th>
                <th>Income</th>
                <th>Job ID</th>
                <th>Time</th>
            </tr>`;

    if (recentPosts.length === 0) {
        html += `<tr><td colspan="5">No posts yet...</td></tr>`;
    } else {
        recentPosts.forEach(entry => {
            html += `
            <tr>
                <td><strong>${entry.brainrot}</strong></td>
                <td>${entry.tier}</td>
                <td>${entry.income}</td>
                <td><span class="copy" onclick="navigator.clipboard.writeText('${entry.jobId}')">${entry.jobId}</span></td>
                <td>${entry.time.toLocaleTimeString()}</td>
            </tr>`;
        });
    }

    html += `</table></body></html>`;
    res.send(html);
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: "ok", posts: recentPosts.length });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Syntax Small API running on port ${PORT}`);
    console.log(`📡 Roblox → POST to /post`);
    if (WEBHOOK_URL) {
        console.log(`🪝 Discord webhook notifications enabled`);
    } else {
        console.log(`⚠️  No DISCORD_WEBHOOK_URL set in environment variables`);
    }
});
