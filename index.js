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

    console.log("🚀 Buscando modelos disponibles en tu cuenta...");

    try {
        // 1. LE PREGUNTAMOS A GOOGLE QUÉ MODELOS TIENES
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const listRes = await axios.get(listUrl);
        
        // Filtramos para buscar Gemini 3 o 1.5 que soporten generar contenido
        const modelosDisponibles = listRes.data.models
            .filter(m => m.supportedGenerationMethods.includes("generateContent"))
            .map(m => m.name);

        console.log("Modelos encontrados:", modelosDisponibles);

        if (modelosDisponibles.length === 0) throw new Error("No tienes modelos activos.");

        // Elegimos el mejor disponible (preferiblemente Gemini 3 o 1.5)
        const mejorModelo = modelosDisponibles.find(m => m.includes("gemini-3")) || modelosDisponibles[0];
        
        console.log(`🎯 Usando el mejor modelo encontrado: ${mejorModelo}`);

        // 2. LANZAMOS LA AUDITORÍA
        const url = `https://generativelanguage.googleapis.com/v1beta/${mejorModelo}:generateContent?key=${apiKey}`;
        const payload = {
            contents: [{ parts: [{ text: `Actúa como IA DMR4. Analiza estos datos de Dentalmovilr4 y detecta riesgos: ${dataContext}. Sé breve.` }] }]
        };

        const response = await axios.post(url, payload);
        const report = response.data.candidates[0].content.parts[0].text;

        // 3. ENVIAR A TELEGRAM
        await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            chat_id: chatId,
            text: `🛡️ **DMR4 ONLINE: REPORTE FINAL** 🛡️\n\n**IA:** ${mejorModelo.split('/').pop()}\n\n${report}`,
            parse_mode: "Markdown"
        });

        console.log("✅ ¡AUDITORÍA COMPLETADA!");

    } catch (error) {
        const errorMsg = error.response?.data?.error?.message || error.message;
        console.log("Fallo crítico:", errorMsg);

        await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            chat_id: chatId,
            text: `⚠️ **DMR4: ERROR DE CONEXIÓN**\nDetalle: ${errorMsg}`
        }).catch(() => {});
        
        process.exit(1);
    }
}

ejecutarAuditoria();

