const axios = require("axios");
const fs = require("fs");

async function ejecutarAuditoria() {
    const apiKey = process.env.GEMINI_API_KEY;
    const telegramToken = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    // 1. Cargar datos locales (si existen)
    let dataContext = "Sin datos previos de proyectos.";
    if (fs.existsSync("./data.json")) {
        try {
            dataContext = fs.readFileSync("./data.json", "utf8");
        } catch (e) {
            console.log("No se pudo leer data.json");
        }
    }

    console.log("🚀 Iniciando Auditoría Directa DMR4 (v1)...");

    try {
        // 2. CONEXIÓN DIRECTA A GEMINI 1.5 FLASH (Ruta Estable v1)
        // Se cambió v1beta por v1 para eliminar el error 404
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: [{
                parts: [{ text: `Actúa como IA DMR4 de Dentalmovilr4. Analiza estos datos y detecta riesgos: ${dataContext}. Responde de forma técnica y breve.` }]
            }]
        };

        const response = await axios.post(url, payload);
        
        // Extraer la respuesta de la IA
        const report = response.data.candidates[0].content.parts[0].text;

        // 3. ENVIAR REPORTE EXITOSO A TELEGRAM
        await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            chat_id: chatId,
            text: `🛡️ **DMR4 ONLINE: REPORTE DE AUDITORÍA** 🛡️\n\n${report}`,
            parse_mode: "Markdown"
        });

        console.log("✅ ¡ÉXITO! Reporte enviado a Telegram.");

    } catch (error) {
        console.error("❌ Error detectado:");
        
        // Mostrar el error real en la consola de GitHub
        const detailedError = error.response ? JSON.stringify(error.response.data) : error.message;
        console.log(detailedError);

        // ENVIAR AVISO DE FALLO A TELEGRAM
        const errorMsg = error.response?.data?.error?.message || error.message;
        await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            chat_id: chatId,
            text: `⚠️ **DMR4 CRITICAL FAIL**\nMotivo: ${errorMsg}\n\n_Revisa la API Key o la cuota en Google Cloud._`,
            parse_mode: "Markdown"
        }).catch(() => {});
        
        process.exit(1);
    }
}

ejecutarAuditoria();
