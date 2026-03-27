const axios = require("axios");
const fs = require("fs");

async function ejecutarAuditoria() {
    const apiKey = process.env.GEMINI_API_KEY;
    const telegramToken = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    let dataContext = "Sin datos previos de proyectos.";
    if (fs.existsSync("./data.json")) {
        try { dataContext = fs.readFileSync("./data.json", "utf8"); } catch (e) {}
    }

    // Lista de modelos según tu captura del "Patio de juegos"
    const modelosDMR4 = ["gemini-3-flash", "gemini-3-pro"];
    let reporteGenerado = null;

    console.log("🚀 Iniciando Auditoría con Generación 3...");

    for (const modelo de modelosDMR4) {
        try {
            console.log(`Trying with: ${modelo}...`);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
            
            const payload = {
                contents: [{
                    parts: [{ text: `Actúa como IA DMR4. Analiza estos datos de Dentalmovilr4 y detecta riesgos: ${dataContext}. Sé breve.` }]
                }]
            };

            const response = await axios.post(url, payload);
            reporteGenerado = response.data.candidates[0].content.parts[0].text;
            
            if (reporteGenerado) {
                console.log(`✅ ¡Dominada con ${modelo}!`);
                break; 
            }
        } catch (error) {
            console.log(`❌ ${modelo} no respondió.`);
        }
    }

    if (reporteGenerado) {
        await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            chat_id: chatId,
            text: `🛡️ **DMR4 ONLINE: AUDITORÍA G3** 🛡️\n\n${reporteGenerado}`,
            parse_mode: "Markdown"
        });
    } else {
        await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            chat_id: chatId,
            text: `⚠️ **DMR4: FALLO TOTAL DE MODELOS G3**\nRevisa si la API Key tiene permisos para Gemini 3 en el panel.`
        });
        process.exit(1);
    }
}

ejecutarAuditoria();


