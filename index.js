const axios = require("axios");
const fs = require("fs");

// ==========================
// 🔐 CONFIGURACIÓN SEGURA
// ==========================
const apiKey = process.env.GEMINI_API_KEY;
const telegramToken = process.env.TELEGRAM_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

// ==========================
// 🧼 SANITIZADOR DE DATOS
// ==========================
function sanitizar(data) {
    if (!data) return "";
    return data
        .replace(/(api_key|token|secret)[^,\n]*/gi, "[REDACTED]")
        .replace(/https?:\/\/[^\s]+/g, "[URL]");
}

// ==========================
// 🔍 DETECTOR LOCAL DE RIESGOS
// ==========================
function detectarRiesgosLocales(data) {
    const riesgos = [];

    if (!data) return riesgos;

    if (data.includes("process.env")) riesgos.push("Uso de variables sensibles");
    if (data.includes("axios.post")) riesgos.push("Envío de datos a endpoint externo");
    if (data.includes(".env")) riesgos.push("Posible archivo sensible");
    if (data.includes("token") || data.includes("api_key")) riesgos.push("Posible credencial expuesta");

    return riesgos;
}

// ==========================
// 📝 ESCAPAR MARKDOWN TELEGRAM
// ==========================
function escaparMarkdown(text) {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

// ==========================
// 📂 CARGA DE ARCHIVOS
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
// ⏳ ESPERA
// ==========================
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ==========================
// 💾 GUARDAR PENDIENTES
// ==========================
function guardarPendiente(prompt) {
    const file = "./pendientes_dmr4.json";
    let data = [];

    if (fs.existsSync(file)) {
        try {
            data = JSON.parse(fs.readFileSync(file, "utf8"));
        } catch {}
    }

    data.push({
        fecha: new Date().toISOString(),
        prompt
    });

    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ==========================
// 🤖 CONSULTA RESILIENTE
// ==========================
async function consultarIAResiliente(modelos, prompt) {
    const MAX_INTENTOS = 3;

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {

        for (let modelo of modelos) {

            try {
                console.log(`🧠 Intento ${intento} con ${modelo}`);

                const url = `https://generativelanguage.googleapis.com/v1beta/${modelo}:generateContent?key=${apiKey}`;

                const res = await axios.post(url, {
                    contents: [{ parts: [{ text: prompt }] }]
                });

                const texto = res?.data?.candidates?.[0]?.content?.parts?.[0]?.text;

                if (texto) return { texto, modelo };

            } catch (err) {
                const msg = err.response?.data?.error?.message || "";

                console.log(`⚠️ ${modelo}: ${msg}`);

                if (msg.includes("high demand")) continue;
                if (msg.includes("overloaded")) continue;

                // errores críticos
                if (msg.includes("API key") || msg.includes("permission")) {
                    throw err;
                }
            }
        }

        const delay = intento * 4000;
        console.log(`⏳ Esperando ${delay}ms...`);
        await sleep(delay);
    }

    return null;
}

// ==========================
// 🚀 EJECUCIÓN PRINCIPAL
// ==========================
async function ejecutarAuditoria() {
    console.log("🚀 IA DMR4 iniciando...");

    const dataContext = cargarArchivo("./data.json", "");
    const historialPasado = cargarArchivo("./historial_dmr4.json", "");

    const riesgosLocales = detectarRiesgosLocales(dataContext);

    try {
        // ==========================
        // 🔎 MODELOS DISPONIBLES
        // ==========================
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const listRes = await axios.get(listUrl);

        const modelos = listRes.data.models
            .filter(m => m.supportedGenerationMethods.includes("generateContent"))
            .map(m => m.name);

        const prioridad = ["gemini-3", "gemini-2.5", "gemini-2"];

        const modelosDisponibles = modelos.filter(m =>
            prioridad.some(p => m.includes(p))
        );

        // ==========================
        // 🧠 PROMPT
        // ==========================
        const prompt = `
IA DMR4 - Auditoría de seguridad

DATOS:
${sanitizar(dataContext)}

HISTORIAL:
${sanitizar(historialPasado)}

RIESGOS LOCALES:
${JSON.stringify(riesgosLocales)}

Analiza:
- riesgos nuevos
- riesgos resueltos
- veredicto: ALTO, MEDIO, BAJO
`;

        // ==========================
        // 🤖 CONSULTA RESILIENTE
        // ==========================
        const resultado = await consultarIAResiliente(modelosDisponibles, prompt);

        let nuevoReporte = "";
        let modeloUsado = "ninguno";

        if (resultado) {
            nuevoReporte = resultado.texto;
            modeloUsado = resultado.modelo;
        } else {
            nuevoReporte = "⚠️ IA no disponible. Auditoría guardada.";
            guardarPendiente(prompt);
        }

        // ==========================
        // 💾 MEMORIA
        // ==========================
        const memoria = {
            fecha: new Date().toISOString(),
            modelo: modeloUsado,
            riesgosLocales,
            reporte: nuevoReporte
        };

        fs.writeFileSync("./historial_dmr4.json", JSON.stringify(memoria, null, 2));

        // ==========================
        // 📲 TELEGRAM LIMPIO
        // ==========================
        const mensaje = escaparMarkdown(
`🛡️ DMR4 ACTIVO

Modelo: ${modeloUsado.split("/").pop()}

${nuevoReporte}`
        );

        await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            chat_id: chatId,
            text: mensaje,
            parse_mode: "MarkdownV2"
        });

        console.log("✅ Auditoría completada");

    } catch (error) {
        console.error("❌ Error crítico:", error.message);

        try {
            await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                chat_id: chatId,
                text: "⚠️ DMR4 ERROR CRÍTICO (revisar logs)"
            });
        } catch {}
    }
}

// ==========================
// ▶️ START
// ==========================
ejecutarAuditoria();
