const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const fs = require("fs");

// 1. Configuración de Identidad y Seguridad
// Usamos process.env para que GitHub Actions pase las llaves de forma segura
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// IMPORTANTE: Usamos 'gemini-1.5-flash'. Es el más rápido y estable.
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function ejecutarAuditoria() {
    try {
        console.log("🚀 Iniciando auditoría DMR4...");

        // 2. Cargar base de datos de repositorios (data.json)
        const dataPath = "./data.json";
        let contextData = "No se encontró base de datos local.";
        
        if (fs.existsSync(dataPath)) {
            contextData = fs.readFileSync(dataPath, "utf8");
        }

        // 3. Crear el Prompt para la IA
        const prompt = `Actúa como la IA DMR4. Analiza estos repositorios de Dentalmovil: ${contextData}. 
        Busca riesgos de seguridad, exposición de coordenadas o llaves API. 
        Genera un reporte técnico muy breve.`;

        // 4. Llamada a la API (Sin reintentos para ahorrar créditos)
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const reportText = response.text();

        // 5. Envío a Telegram
        if (process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID) {
            const TG_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`;
            
            await axios.post(TG_URL, {
                chat_id: process.env.TELEGRAM_CHAT_ID,
                text: `🛡️ **SISTEMA DMR4: AUDITORÍA COMPLETADA** 🛡️\n\n${reportText}`,
                parse_mode: "Markdown"
            });
            console.log("✅ Reporte enviado a Telegram correctamente.");
        }

    } catch (error) {
        // Manejo inteligente de errores para no quemar intentos
        console.error("❌ Error detectado:", error.message);
        
        // Si es un error de cuota (429), detenemos todo
        if (error.message.includes("429")) {
            console.log("⚠️ Alerta: Te has quedado sin créditos en esta API Key.");
        }

        // Notificamos el error a Telegram si es posible
        try {
            await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
                chat_id: process.env.TELEGRAM_CHAT_ID,
                text: `⚠️ **ERROR DMR4**: ${error.message}`
            });
        } catch (tgError) {
            console.error("No se pudo notificar el error a Telegram.");
        }

        process.exit(1); // Finaliza con error para que GitHub marque la X roja
    }
}

ejecutarAuditoria();


