const express = require("express");
const app = express();

app.use(express.json());

// In-memory log store: { id -> { userId, timestamp, timer } }
const logs = new Map();

// POST /log — receive a Roblox user
app.post("/log", (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId in request body." });
  }

  const id = `${userId}_${Date.now()}`;
  const timestamp = new Date().toISOString();

  // Auto-delete after 60 seconds
  const timer = setTimeout(() => {
    logs.delete(id);
    console.log(`[AUTO-DELETE] Log for userId ${userId} (id: ${id}) removed.`);
  }, 60_000);

  logs.set(id, { userId: String(userId), timestamp, timer });

  console.log(`[LOG] userId: ${userId} | time: ${timestamp}`);

  return res.status(200).json({
    message: "Logged successfully. Will be deleted in 1 minute.",
    logId: id,
    userId: String(userId),
    timestamp,
  });
});

// GET /logs — view all current logs (for debugging)
app.get("/logs", (req, res) => {
  const entries = [];
  for (const [id, data] of logs.entries()) {
    entries.push({ logId: id, userId: data.userId, timestamp: data.timestamp });
  }
  return res.status(200).json({ count: entries.length, logs: entries });
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
  res.json({ status: "ok", message: "Roblox Logger API is running." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Roblox Logger API running on port ${PORT}`);
});
