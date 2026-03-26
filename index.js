const axios = require("axios");
const fs = require("fs");

async function ejecutarAuditoria() {
    const apiKey = process.env.GEMINI_API_KEY;
    const telegramToken = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    let dataContext = "Sin datos previos de proyectos.";
    if (fs.existsSync("./data.json")) {
        try {
            dataContext = fs.readFileSync("./data.json", "utf8");
        } catch (e) {
            console.log("No se pudo leer data.json");
        }
    }

    console.log("🚀 Iniciando Auditoría con Gemini 1.0 Pro...");

    try {
        // 2. USAMOS EL MODELO PRO (El viejo confiable)
        // Se cambió gemini-1.5-flash por gemini-1.0-pro
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: [{
                parts: [{ text: `Actúa como IA DMR4. Analiza estos datos de Dentalmovilr4 y detecta riesgos: ${dataContext}. Responde breve.` }]
            }]
        };

        const response = await axios.post(url, payload);
        
        // La estructura de respuesta del Pro es un poco diferente, la extraemos con cuidado:
        const report = response.data.candidates[0].content.parts[0].text;

        // 3. ENVIAR REPORTE A TELEGRAM
        await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            chat_id: chatId,
            text: `🛡️ **DMR4 ONLINE: REPORTE GENERADO** 🛡️\n\n${report}`,
            parse_mode: "Markdown"
        });

        console.log("✅ ¡POR FIN! Victoria. Reporte enviado.");

    } catch (error) {
        console.error("❌ Fallo:");
        const errorMsg = error.response?.data?.error?.message || error.message;
        console.log(errorMsg);

        await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            chat_id: chatId,
            text: `⚠️ **DMR4 FALLO TÉCNICO**\nMotivo: ${errorMsg}`
        }).catch(() => {});
        
        process.exit(1);
    }
}

ejecutarAuditoria();


