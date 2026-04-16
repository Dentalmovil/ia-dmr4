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
    if (data.includes(".env")) riesgos.push("Archivo sensible");
    if (data.includes("token") || data.includes("api_key")) riesgos.push("Credencial posible");

    return riesgos;
}

// ==========================
function escaparMarkdown(text) {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

function cargarArchivo(ruta, fallback) {
    try {
        if (fs.existsSync(ruta)) {
            return fs.readFileSync(ruta, "utf8");
        }
    } catch {}
    return fallback;
}

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
// 🌐 GITHUB
// ==========================
async function obtenerReposGithub() {
    const res = await axios.get("https://api.github.com/user/repos", {
        headers: { Authorization: `Bearer ${githubToken}` }
    });
    return res.data.map(r => r.name);
}

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
// 🔥 ESCANEO PROFUNDO REAL
// ==========================
async function escanearRepo(repo) {
    const archivos = await obtenerArchivosRepo(repo);
    const riesgos = [];

    let contador = 0;

    for (let file of archivos) {
        if (file.type !== "file") continue;
        if (contador > 10) break;
        contador++;

        try {
            const res = await axios.get(file.download_url);
            const contenido = res.data;

            // 🔐 SECRETOS
            if (/api[_-]?key\s*=\s*['"][A-Za-z0-9_\-]{16,}/i.test(contenido))
                riesgos.push("API KEY expuesta");

            if (/token\s*=\s*['"][A-Za-z0-9_\-]{16,}/i.test(contenido))
                riesgos.push("TOKEN expuesto");

            if (/-----BEGIN PRIVATE KEY-----/.test(contenido))
                riesgos.push("CLAVE PRIVADA");

            // ⚠️ RIESGO CÓDIGO
            if (contenido.includes("eval(")) riesgos.push("Uso de eval()");
            if (contenido.includes("exec(")) riesgos.push("Uso de exec()");
            if (contenido.includes("child_process")) riesgos.push("Ejecución sistema");

            // 🌐 EXFILTRACIÓN
            if (contenido.includes("axios.post") && contenido.includes("http"))
                riesgos.push("Posible fuga de datos");

        } catch {}
    }

    return {
        repo,
        riesgos: [...new Set(riesgos)]
    };
}

// ==========================
// 🚨 DETECTAR CRÍTICOS
// ==========================
function detectarCriticos(resultados) {
    return resultados.filter(r =>
        r.riesgos.some(rg =>
            rg.includes("API KEY") ||
            rg.includes("TOKEN") ||
            rg.includes("CLAVE PRIVADA")
        )
    );
}

// ==========================
// 📲 ALERTA CRÍTICA
// ==========================
async function enviarAlertaCritica(reposCriticos) {
    if (!reposCriticos.length) return;

    const msg = escaparMarkdown(
`🚨 DMR4 ALERTA CRÍTICA 🚨

${reposCriticos.map(r => `- ${r.repo}: ${r.riesgos.join(", ")}`).join("\n")}

Acción:
- Rotar claves
- Revisar accesos`
    );

    await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        chat_id: chatId,
        text: msg,
        parse_mode: "MarkdownV2"
    });
}

// ==========================
// 🤖 IA RESILIENTE
// ==========================
async function consultarIA(modelos, prompt) {
    for (let intento = 1; intento <= 3; intento++) {
        for (let modelo of modelos) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/${modelo}:generateContent?key=${apiKey}`;

                const res = await axios.post(url, {
                    contents: [{ parts: [{ text: prompt }] }]
                });

                const txt = res?.data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (txt) return { txt, modelo };

            } catch (e) {
                const msg = e.response?.data?.error?.message || "";
                if (msg.includes("high demand")) continue;
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
    console.log("🚀 DMR4 SOC ACTIVO");

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

        // 🔍 ESCANEO GITHUB
        const repos = await obtenerReposGithub();
        let resultados = [];

        for (let r of repos) {
            resultados.push(await escanearRepo(r));
        }

        // 🚨 ALERTAS CRÍTICAS
        const criticos = detectarCriticos(resultados);
        await enviarAlertaCritica(criticos);

        const resumen = resultados
            .map(r => `${r.repo}: ${r.riesgos.join(", ") || "OK"}`)
            .join("\n");

        // 🧠 PROMPT
        const prompt = `
IA DMR4 - SOC

REPOS:
${resumen}

RIESGOS LOCALES:
${JSON.stringify(riesgosLocales)}

Evalúa nivel global y riesgos críticos
`;

        // IA
        const resIA = await consultarIA(modelosOK, prompt);

        let reporte = resIA?.txt || "⚠️ IA no disponible";
        let modelo = resIA?.modelo || "none";

        if (!resIA) guardarPendiente(prompt);

        // 💾 MEMORIA
        fs.writeFileSync("./historial_dmr4.json", JSON.stringify({
            fecha: new Date().toISOString(),
            modelo,
            reporte
        }, null, 2));

        // 📲 TELEGRAM NORMAL
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

        console.log("✅ COMPLETO");

    } catch (err) {
        console.error("❌", err.message);

        try {
            await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                chat_id: chatId,
                text: "⚠️ DMR4 ERROR CRÍTICO"
            });
        } catch {}
    }
}

ejecutarAuditoria();
