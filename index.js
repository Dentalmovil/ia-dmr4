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

    if (data.includes("process.env")) {
        riesgos.push("Uso de variables sensibles");
    }

    if (data.includes("axios.post")) {
        riesgos.push("Envío de datos a endpoint externo");
    }

    if (data.includes(".env")) {
        riesgos.push("Posible archivo sensible referenciado");
    }

    if (data.includes("token") || data.includes("api_key")) {
        riesgos.push("Posible exposición de credenciales");
    }

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
// 🚀 EJECUCIÓN PRINCIPAL
// ==========================
async function ejecutarAuditoria() {
    console.log("🚀 IA DMR4 iniciando auditoría...");

    const dataContext = cargarArchivo("./data.json", "");
    const historialPasado = cargarArchivo("./historial_dmr4.json", "");

    const riesgosLocales = detectarRiesgosLocales(dataContext);

    try {
        // ==========================
        // 🤖 OBTENER MODELO
        // ==========================
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const listRes = await axios.get(listUrl);

        const modelos = listRes.data.models
            .filter(m => m.supportedGenerationMethods.includes("generateContent"))
            .map(m => m.name);

        const prioridad = ["gemini-3", "gemini-2.5", "gemini-2"];
        const mejorModelo = modelos.find(m =>
            prioridad.some(p => m.includes(p))
        ) || modelos[0];

        // ==========================
        // 🧠 PROMPT INTELIGENTE
        // ==========================
        const prompt = `
Actúa como IA DMR4 (ciberseguridad avanzada).

DATOS ACTUALES:
${sanitizar(dataContext)}

HISTORIAL:
${sanitizar(historialPasado)}

RIESGOS LOCALES DETECTADOS:
${JSON.stringify(riesgosLocales)}

TAREA:
- Detecta riesgos nuevos
- Detecta riesgos resueltos
- Da veredicto claro (ALTO, MEDIO, BAJO)
- Respuesta técnica, breve
`;

        // ==========================
        // 🤖 LLAMADA A IA
        // ==========================
        const url = `https://generativelanguage.googleapis.com/v1beta/${mejorModelo}:generateContent?key=${apiKey}`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }]
        });

        const nuevoReporte =
            response?.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
            "⚠️ No se pudo generar reporte.";

        // ==========================
        // 💾 GUARDAR MEMORIA
        // ==========================
        const memoria = {
            fecha: new Date().toISOString(),
            modelo: mejorModelo,
            riesgosLocales,
            reporte: nuevoReporte
        };

        fs.writeFileSync("./historial_dmr4.json", JSON.stringify(memoria, null, 2));

        // ==========================
        // 📲 ENVIAR A TELEGRAM
        // ==========================
        const mensaje = escaparMarkdown(
            `🛡️ DMR4 AUDITORÍA\n\nModelo: ${mejorModelo.split("/").pop()}\n\n${nuevoReporte}`
        );

        await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            chat_id: chatId,
            text: mensaje,
            parse_mode: "MarkdownV2"
        });

        console.log("✅ Auditoría completada.");

    } catch (error) {
        const errorMsg = error.response?.data?.error?.message || error.message;

        console.error("❌ Error:", errorMsg);

        try {
            await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                chat_id: chatId,
                text: `⚠️ DMR4 ERROR\n${errorMsg}`
            });
        } catch {}

        process.exit(1);
    }
}

// ==========================
// ▶️ INICIO
// ==========================
ejecutarAuditoria();
