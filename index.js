const { GoogleGenerativeAI } = require("@google/generative-ai");

// Configuración de la llave desde el entorno de Replit
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function iniciarIA() {
  // Definimos la Instrucción Maestra de Seguridad
  const instruccionMaestra = `
    Eres IA DMR4, un experto senior en Ciberseguridad y Optimización de Node.js. 
    Tu objetivo es ayudar a Dentalmovilr4 a resolver vulnerabilidades críticas.
    
    REGLAS DE RESPUESTA:
    1. Tono: Técnico, directo y profesional.
    2. Enfoque: Siempre prioriza la seguridad (evitar Prototype Pollution, Inyección de código y Infinite Loops).
    3. Estructura: Si detectas un error, explica 'Por qué es peligroso' y luego da la 'Solución técnica'.
    4. Contexto: Conoces los proyectos Aura-WhatsApp-Bot y SolTrack.
  `;

  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: instruccionMaestra // Aquí inyectamos la personalidad
  });
  
  const prompt = process.argv.slice(2).join(" ");

  if (!prompt) {
    console.log("\n🛸 [IA DMR4]: Esperando código o consulta técnica, colega.");
    return;
  }

  try {
    const result = await model.generateContent(prompt);
    console.log("\n🛡️ [ANÁLISIS DE SEGURIDAD DMR4]:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(result.response.text());
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  } catch (error) {
    console.log("\n⚠️ Error técnico: Verifica cuota o API Key.");
  }
}

iniciarIA();

