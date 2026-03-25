const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const fs = require("fs");

if (!process.env.GEMINI_API_KEY) {
    throw new Error("Falta GEMINI_API_KEY");
}

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

        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash-latest"
        });

        const prompt = `
Eres la IA DMR4 especializada en auditoría de seguridad.

Analiza:
${contextoDMR4}

Genera:
- Riesgos
- Nivel de criticidad
- Recomendaciones
- Resumen ejecutivo
`;

        const result = await model.generateContent(prompt);
        const textoReporte = result.response.text();

        const urlTG = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;

        const mensaje = `🛡️ REPORTE IA DMR4 🛡️\n\n${textoReporte}`;
        const partes = mensaje.match(/[\s\S]{1,4000}/g);

        for (const parte of partes) {
            await axios.post(urlTG, {
                chat_id: TG_CHAT_ID,
                text: parte
            }, { timeout: 10000 });
        }

        console.log("✅ Reporte enviado con éxito.");

    } catch (error) {
        console.error("❌ Error completo:", error);

        if (TG_TOKEN && TG_CHAT_ID) {
            const urlTG = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
            await axios.post(urlTG, {
                chat_id: TG_CHAT_ID,
                text: `⚠️ ERROR IA DMR4:\n${error.message}`
            }).catch(() => {});
        }

        process.exit(1);
    }
}

ejecutarAuditoria();


