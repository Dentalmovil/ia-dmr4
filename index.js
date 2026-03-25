const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const fs = require("fs");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const TG_TOKEN = process.env.TELEGRAM_TOKEN;
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function ejecutar() {
    try {
        // 1. Leer base de datos si existe
        let context = "";
        if (fs.existsSync("./data.json")) {
            context = fs.readFileSync("./data.json", "utf8");
        }

        // 2. Usar el nombre de modelo más estable
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        
        const prompt = `Eres la IA DMR4. Contexto: ${context}. Realiza una auditoría breve.`;
        const result = await model.generateContent(prompt);
        const report = result.response.text();

        // 3. Enviar a Telegram
        await axios.post(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            chat_id: TG_CHAT_ID,
            text: `🛡️ **REPORTE DMR4** 🛡️\n\n${report}`,
            parse_mode: "Markdown"
        });

        console.log("✅ Éxito");
    } catch (err) {
        console.error("Error:", err.message);
        // Aviso rápido de error
        await axios.post(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            chat_id: TG_CHAT_ID,
            text: `⚠️ **DMR4 Offline**: ${err.message}`
        }).catch(() => {});
        process.exit(1);
    }
}
ejecutar();



