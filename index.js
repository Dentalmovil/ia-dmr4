const axios = require("axios");
const fs = require("fs");

// ==========================
// 🔐 CONFIG
// ==========================
const apiKey = process.env.GEMINI_API_KEY;
const telegramToken = process.env.TELEGRAM_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const githubToken = process.env.GITHUB_TOKEN;
const githubUser = process.env.GITHUB_USER;

// ==========================
// 🧼 SANITIZAR
// ==========================
function sanitizar(data) {
    if (!data) return "";
    return data
        .replace(/(api_key|token|secret)[^,\n]*/gi, "[REDACTED]")
        .replace(/https?:\/\/[^\s]+/g, "[URL]");
}

// ==========================
// 🔍 RIESGOS LOCALES
// ==========================
function detectarRiesgosLocales(data) {
    const riesgos = [];
    if (!data) return riesgos;

    if (data.includes("process.env")) riesgos.push("Uso de variables sensibles");
    if (data.includes("axios.post")) riesgos.push("Salida de datos externa");
    if (data.includes(".env")) riesgos.push("Archivo sensible referenciado");
    if (data.includes("token") || data.includes("api_key")) riesgos.push("Credencial posible");

    return riesgos;
}

// ==========================
// 📝 TELEGRAM SAFE
// ==========================
function escaparMarkdown(text) {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

// ==========================
// 📂 FILE LOAD
// ==========================
function cargarArchivo(ruta, fallback) {
    try {
        if (fs.existsSync(ruta)) {
            return fs.readFileSync(ruta, "utf8");
        }
    } catch {}
    return fallback;
}

// ==========================
// ⏳ SLEEP
// ==========================
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ==========================
// 💾 PENDIENTES
// ==========================
function guardarPendiente(prompt) {
    const file = "./pendientes_dmr4.json";
    let data = [];

    if (fs.existsSync(file)) {
        try {
            data = JSON.parse(fs.readFileSync(file));
        } catch {}
    }

    data.push({ fecha: new Date().toISOString(), prompt });

    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ==========================
// 🌐 GITHUB REPOS
// ==========================
async function obtenerReposGithub() {
    const res = await axios.get("https://api.github.com/user/repos", {
        headers: { Authorization: `Bearer ${githubToken}` }
    });

    return res.data.map(r => r.name);
}

// ==========================
// 📂 ARCHIVOS REPO
// ==========================
async function obtenerArchivosRepo(repo) {
    try {
        const res = await axios.get(
            `https://api.github.com/repos/${githubUser}/${repo}/contents`,
            { headers: { Authorization: `Bearer ${githubToken}` } }
        );
        return res.data;
    } catch {
        return [];
    }
}

// ==========================
// 🔍 ESCANEO REPO
// ==========================
async function escanearRepo(repo) {
    const archivos = await obtenerArchivosRepo(repo);
    const riesgos = [];

    for (let file of archivos) {
        const name = file.name.toLowerCase();

        if (name.includes(".env")) riesgos.push(".env expuesto");
        if (name.includes("config")) riesgos.push("config sensible");
        if (name.includes("key") || name.includes("token")) riesgos.push("posible credencial");
    }

    return { repo, riesgos };
}

// ==========================
// 🤖 IA RESILIENTE
// ==========================
async function consultarIA(modelos, prompt) {
    for (let intento = 1; intento <= 3; intento++) {

        for (let modelo of modelos) {

            try {
                console.log(`🧠 ${modelo} intento ${intento}`);

                const url = `https://generativelanguage.googleapis.com/v1beta/${modelo}:generateContent?key=${apiKey}`;

                const res = await axios.post(url, {
                    contents: [{ parts: [{ text: prompt }] }]
                });

                const txt = res?.data?.candidates?.[0]?.content?.parts?.[0]?.text;

                if (txt) return { txt, modelo };

            } catch (e) {
                const msg = e.response?.data?.error?.message || "";

                if (msg.includes("high demand") || msg.includes("overloaded")) continue;
                if (msg.includes("API key")) throw e;
            }
        }

        await sleep(4000 * intento);
    }

    return null;
}

// ==========================
// 🚀 MAIN
// ==========================
async function ejecutarAuditoria() {
    console.log("🚀 DMR4 activo");

    const dataContext = cargarArchivo("./data.json", "");
    const historial = cargarArchivo("./historial_dmr4.json", "");

    const riesgosLocales = detectarRiesgosLocales(dataContext);

    try {
        // MODELOS
        const list = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const modelos = list.data.models
            .filter(m => m.supportedGenerationMethods.includes("generateContent"))
            .map(m => m.name);

        const modelosOK = modelos.filter(m =>
            ["gemini-3", "gemini-2.5", "gemini-2"].some(p => m.includes(p))
        );

        // GITHUB SCAN
        const repos = await obtenerReposGithub();
        let resultados = [];

        for (let r of repos) {
            resultados.push(await escanearRepo(r));
        }

        const resumen = resultados
            .map(r => `${r.repo}: ${r.riesgos.join(", ") || "OK"}`)
            .join("\n");

        // PROMPT
        const prompt = `
IA DMR4 - SOC

REPOS:
${resumen}

DATOS:
${sanitizar(dataContext)}

HISTORIAL:
${sanitizar(historial)}

RIESGOS LOCALES:
${JSON.stringify(riesgosLocales)}

Evalúa:
- repos críticos
- riesgos nuevos
- veredicto global
`;

        // IA
        const resIA = await consultarIA(modelosOK, prompt);

        let reporte = "";
        let modelo = "none";

        if (resIA) {
            reporte = resIA.txt;
            modelo = resIA.modelo;
        } else {
            reporte = "⚠️ IA no disponible";
            guardarPendiente(prompt);
        }

        // MEMORIA
        fs.writeFileSync("./historial_dmr4.json", JSON.stringify({
            fecha: new Date().toISOString(),
            modelo,
            reporte
        }, null, 2));

        // TELEGRAM
        const msg = escaparMarkdown(
`🛡️ DMR4 SOC

Modelo: ${modelo.split("/").pop()}

${reporte}`
        );

        await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            chat_id: chatId,
            text: msg,
            parse_mode: "MarkdownV2"
        });

        console.log("✅ OK");

    } catch (err) {
        console.error("❌", err.message);

        try {
            await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                chat_id: chatId,
                text: "⚠️ DMR4 crítico"
            });
        } catch {}
    }
}

ejecutarAuditoria();
