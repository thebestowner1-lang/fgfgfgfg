const express = require("express");
const app = express();
app.use(express.json());

// ====================== CONFIGURATION ======================
// Put your exact same encryption key from Roblox Lua here
const ENCRYPT_KEY = process.env.ENCRYPT_KEY || "Syntax_AJ"; 

// ====================== ENCRYPTION / DECRYPTION FUNCTIONS ======================

function xorBytes(str, key) {
    const out = [];
    const keyLen = key.length;
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        const k = key.charCodeAt(i % keyLen);
        out.push(String.fromCharCode(c ^ k));
    }
    return out.join("");
}

function fromHex(hex) {
    let str = "";
    for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
}

function decryptJobId(encryptedHex) {
    try {
        if (!encryptedHex || typeof encryptedHex !== "string") {
            return "[INVALID_JOBID]";
        }
        const xorResult = fromHex(encryptedHex);
        return xorBytes(xorResult, ENCRYPT_KEY);
    } catch (error) {
        console.error("[DECRYPT ERROR]", error.message);
        return "[DECRYPTION_FAILED]";
    }
}

// ====================== IN-MEMORY LOG STORE ======================
// Now stores encryptedJobId instead of plain userId
const logs = new Map();

// ====================== ROUTES ======================

// POST /log — Receive encrypted jobId from Roblox
app.post("/log", (req, res) => {
    const { userId } = req.body;   // This is now the ENCRYPTED jobId from Roblox

    if (!userId) {
        return res.status(400).json({ error: "Missing userId (encrypted jobId) in request body." });
    }

    const logId = `log_${Date.now()}`;
    const timestamp = new Date().toISOString();

    // Auto-delete after 60 seconds
    const timer = setTimeout(() => {
        logs.delete(logId);
        console.log(`[AUTO-DELETE] Log ${logId} removed.`);
    }, 60_000);

    logs.set(logId, {
        encryptedJobId: String(userId),   // Store encrypted version
        timestamp,
        timer
    });

    console.log(`[LOG] Received encrypted jobId | logId: ${logId}`);

    return res.status(200).json({
        message: "Logged successfully. Will be deleted in 1 minute.",
        logId: logId,
        timestamp,
    });
});

// GET /logs — Decrypt jobIds before returning (This is what you asked for)
app.get("/logs", (req, res) => {
    const entries = [];

    for (const [logId, data] of logs.entries()) {
        const decryptedJobId = decryptJobId(data.encryptedJobId);

        entries.push({
            logId: logId,
            jobId: decryptedJobId,           // ← Decrypted job ID shown here
            encryptedJobId: data.encryptedJobId,
            timestamp: data.timestamp
        });
    }

    return res.status(200).json({
        count: entries.length,
        logs: entries
    });
});

// DELETE /log/:logId — manually delete a log
app.delete("/log/:logId", (req, res) => {
    const { logId } = req.params;
    const entry = logs.get(logId);

    if (!entry) {
        return res.status(404).json({ error: "Log not found." });
    }

    clearTimeout(entry.timer);
    logs.delete(logId);
    return res.status(200).json({ message: `Log ${logId} deleted.` });
});

// Health check
app.get("/", (req, res) => {
    res.json({ 
        status: "ok", 
        message: "Roblox Logger API is running.",
        note: "Job IDs are decrypted in /logs endpoint"
    });
});

// ====================== START SERVER ======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`══════════════════════════════════════════════`);
    console.log(`🚀 Roblox Logger API running on port ${PORT}`);
    console.log(`🔑 Encryption Key loaded: ${ENCRYPT_KEY === "your_secret_key_here" ? "DEFAULT (CHANGE THIS!)" : "Custom key from ENV"}`);
    console.log(`📡 /logs now returns DECRYPTED jobIds`);
    console.log(`══════════════════════════════════════════════`);
});
