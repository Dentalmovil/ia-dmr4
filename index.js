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

    console.log("🚀 Probando con Gemini 1.5 Pro (El modelo más potente)...");

    try {
        // 2. CAMBIAMOS AL MODELO 1.5 PRO
        // Este modelo es el que aparece en tu captura de AI Studio como "Nuestras mejores opciones"
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: [{
                parts: [{ text: `Actúa como IA DMR4. Analiza estos datos de Dentalmovilr4 y detecta riesgos: ${dataContext}. Sé breve.` }]
            }]
        };

        const response = await axios.post(url, payload);
        const report = response.data.candidates[0].content.parts[0].text;

        // 3. ENVIAR REPORTE A TELEGRAM
        await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            chat_id: chatId,
            text: `🛡️ **DMR4 ONLINE: AUDITORÍA 1.5 PRO** 🛡️\n\n${report}`,
            parse_mode: "Markdown"
        });

        console.log("✅ ¡POR FIN! Reporte enviado con 1.5 Pro.");

    } catch (error) {
        console.error("❌ Falló de nuevo:");
        const errorMsg = error.response?.data?.error?.message || error.message;
        console.log(errorMsg);

        await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            chat_id: chatId,
            text: `⚠️ **DMR4 SIGUE OFFLINE**\nMotivo: ${errorMsg}\n\n_Probando alternativa..._`
        }).catch(() => {});
        
        process.exit(1);
    }
}

ejecutarAuditoria();


