const axios = require("axios");
const fs = require("fs");

async function ejecutarAuditoria() {
    const apiKey = process.env.GEMINI_API_KEY;
    const telegramToken = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    // 1. Cargar datos de proyectos y memoria anterior
    let dataContext = "Sin datos actuales de proyectos.";
    let historialPasado = "No hay registros de auditorías anteriores.";
    
    if (fs.existsSync("./data.json")) {
        dataContext = fs.readFileSync("./data.json", "utf8");
    }
    
    if (fs.existsSync("./historial_dmr4.json")) {
        historialPasado = fs.readFileSync("./historial_dmr4.json", "utf8");
    }

    console.log("🚀 Iniciando Auditoría con Memoria...");

    try {
        // 2. Obtener el mejor modelo disponible automáticamente
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const listRes = await axios.get(listUrl);
        const modelos = listRes.data.models
            .filter(m => m.supportedGenerationMethods.includes("generateContent"))
            .map(m => m.name);
        
        const mejorModelo = modelos.find(m => m.includes("gemini-3")) || modelos[0];

        // 3. Crear el mensaje para la IA incluyendo la memoria
        const prompt = `Actúa como IA DMR4 de Dentalmovilr4. 
        DATOS ACTUALES DE PROYECTOS: ${dataContext}
        REPORTE DE LA AUDITORÍA ANTERIOR: ${historialPasado}
        
        TAREA: Analiza los riesgos actuales. Compara con el reporte anterior: 
        - ¿Hay riesgos nuevos? 
        - ¿Se solucionó algo de lo anterior? 
        - Da un veredicto rápido. Sé técnico y breve.`;

        const url = `https://generativelanguage.googleapis.com/v1beta/${mejorModelo}:generateContent?key=${apiKey}`;
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }]
        });

        const nuevoReporte = response.data.candidates[0].content.parts[0].text;

        // 4. Guardar el nuevo reporte en la memoria local (el YAML se encarga de subirlo a GitHub)
        fs.writeFileSync("./historial_dmr4.json", nuevoReporte);

        // 5. Enviar reporte a Telegram
        await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            chat_id: chatId,
            text: `🛡️ **DMR4: AUDITORÍA CON MEMORIA** 🛡️\n\n**Modelo:** ${mejorModelo.split('/').pop()}\n\n${nuevoReporte}`,
            parse_mode: "Markdown"
        });

        console.log("✅ Proceso completado con éxito.");

    } catch (error) {
        const errorMsg = error.response?.data?.error?.message || error.message;
        console.error("Error:", errorMsg);
        
        await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            chat_id: chatId,
            text: `⚠️ **DMR4 FALLO DE MEMORIA**\nError: ${errorMsg}`
        }).catch(() => {});
        
        process.exit(1);
    }
}

ejecutarAuditoria();

