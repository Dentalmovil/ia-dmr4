const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const fs = require("fs");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const TG_TOKEN = process.env.TELEGRAM_TOKEN;
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function ejecutarAuditoria() {
    try {
        let contextoDMR4 = "";
        if (fs.existsSync("./data.json")) {
            const data = fs.readFileSync("./data.json", "utf8");
            contextoDMR4 = `\nBase de Datos Proyectos:\n${data}`;
        }

        // CORRECCIÓN AQUÍ: Usando gemini-1.5-flash-latest
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        
        const prompt = `Eres la IA DMR4. Realiza auditoria de seguridad.${contextoDMR4}\nGenera reporte para Telegram.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const textoReporte = response.text();

        const urlTG = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
        await axios.post(urlTG, {
            chat_id: TG_CHAT_ID,
            text: `🛡️ **REPORTE IA DMR4** 🛡️\n\n${textoReporte}`,
            parse_mode: "Markdown"
        });

        console.log("✅ Reporte enviado con éxito.");

    } catch (error) {
        console.error("❌ Error:", error.message);
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


