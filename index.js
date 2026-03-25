const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const fs = require("fs");

// Configuración de variables de entorno
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const TG_TOKEN = process.env.TELEGRAM_TOKEN;
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function ejecutarAuditoria() {
    try {
        // 1. Intentar leer la base de datos (data.json) si existe
        let contextoDMR4 = "";
        if (fs.existsSync("./data.json")) {
            const data = fs.readFileSync("./data.json", "utf8");
            contextoDMR4 = `\nBase de Datos de Proyectos:\n${data}`;
        }

        // 2. Configurar el modelo de IA
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Eres la IA DMR4. Realiza una auditoría de seguridad del código actual.${contextoDMR4}\nGenera un reporte conciso para Telegram.`;

        // 3. Generar el reporte con la IA
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const textoReporte = response.text();

        // 4. Enviar reporte a Telegram vía Axios
        const urlTG = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
        await axios.post(urlTG, {
            chat_id: TG_CHAT_ID,
            text: `🛡️ **REPORTE IA DMR4** 🛡️\n\n${textoReporte}`,
            parse_mode: "Markdown"
        });

        console.log("✅ Reporte enviado con éxito a Telegram.");

    } catch (error) {
        console.error("❌ Error en el proceso:", error.message);
        
        // Intento de aviso de error a Telegram
        if (TG_TOKEN && TG_CHAT_ID) {
            const urlTG = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
            await axios.post(urlTG, {
                chat_id: TG_CHAT_ID,
                text: `⚠️ **ERROR CRÍTICO IA DMR4**:\n${error.message}`
            }).catch(() => {});
        }
        process.exit(1);
    }
}

ejecutarAuditoria();


