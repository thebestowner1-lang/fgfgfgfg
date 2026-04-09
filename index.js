const express = require('express');
const app = express();
app.use(express.json());

const ENCRYPT_KEY = "Syntax_AJ";

// Decrypt function (same as Roblox)
function fromHex(hex) {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
}

function decryptJobId(hex) {
    const x = fromHex(hex);
    let out = '';
    for (let i = 0; i < x.length; i++) {
        const c = x.charCodeAt(i);
        const k = ENCRYPT_KEY.charCodeAt(i % ENCRYPT_KEY.length);
        out += String.fromCharCode(c ^ k);
    }
    return out;
}

let servers = []; // public list

app.post('/notify', (req, res) => {
    const { brainrot, income, encryptedJobId, placeId, time } = req.body;
    if (!brainrot || !encryptedJobId) return res.sendStatus(400);

    const jobId = decryptJobId(encryptedJobId);

    servers.unshift({
        brainrot: brainrot,
        income: income,
        jobId: jobId,
        placeId: placeId,
        time: new Date(time * 1000)
    });

    if (servers.length > 50) servers.pop(); // keep only last 50

    console.log(`📥 New server added: ${brainrot} | ${income}`);
    res.sendStatus(200);
});

// Public page (everyone can see)
app.get('/', (req, res) => {
    let html = `
    <html>
    <head>
        <title>Syntax Live Servers</title>
        <style>
            body { font-family: Arial; background: #0f0f0f; color: #fff; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #333; padding: 12px; text-align: left; }
            th { background: #1f1f1f; }
            .copy { cursor: pointer; color: #00ff00; }
        </style>
    </head>
    <body>
        <h1>🌹 Syntax Live Brainrot Servers</h1>
        <table>
            <tr><th>Brainrot</th><th>Income</th><th>JobId</th><th>Time</th></tr>`;
    
    servers.forEach(s => {
        html += `<tr>
            <td>${s.brainrot}</td>
            <td>${s.income}</td>
            <td><span class="copy" onclick="navigator.clipboard.writeText('${s.jobId}')">${s.jobId}</span></td>
            <td>${s.time.toLocaleTimeString()}</td>
        </tr>`;
    });

    if (servers.length === 0) html += `<tr><td colspan="4">No servers yet...</td></tr>`;

    html += `</table></body></html>`;
    res.send(html);
});

app.listen(process.env.PORT || 3000, () => {
    console.log('✅ Syntax API running');
});