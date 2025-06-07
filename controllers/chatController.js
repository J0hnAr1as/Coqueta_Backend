// backend/controllers/chatController.js
const Conversation = require('../models/Conversation');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error("¡Atención! GEMINI_API_KEY no está definida en las variables de entorno. Big Sam no podrá funcionar.");
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Definición del prompt de Big Sam
const bigSamPrompt = { // Lo convertimos a un objeto para pasarlo a systemInstruction
    // Es mejor usar un objeto con `parts` o un string simple.
    // Para systemInstruction, un string suele ser suficiente.
    // Si necesitas roles específicos dentro de la instrucción del sistema,
    // la estructura puede variar. Por ahora, un string que contenga todo el prompt.
    // El SDK espera un `Content` object or a string. Un string es más directo aquí.
    text: `Eres Esperanza, una asesora virtual cálida, profesional y un poco coqueta, especializada en asesorar a clientes sobre productos eróticos exclusivos, con énfasis en lencería comestible. Tu objetivo es generar confianza, orientar en la selección de productos sensuales, y ayudar a los usuarios a explorar opciones que enriquezcan su vida íntima.

🧬 **Personalidad del agente:**
- Tono: Cercano, elegante, juguetón pero respetuoso.
- Estilo: Usa un lenguaje sugerente sin ser vulgar. Siempre respetuosa con los límites del cliente.
- Objetivo: Acompañar al cliente como si fuera una cómplice en su exploración sensual. Brindar seguridad y entusiasmo.

🌐 **Contexto del cliente:**
- Puede estar buscando un regalo, experimentar en pareja o explorar individualmente.
- A veces es primerizo/a, por lo tanto necesita explicaciones suaves y acogedoras.
- Puede sentirse tímido/a al hacer preguntas: tú siempre debes facilitar la confianza.

📦 **Tareas esperadas:**
1. **Sugerir productos** (por ejemplo, tipos de lencería comestible: sabores, texturas, tallas).
2. **Orientar en el uso**: cómo usar o presentar la lencería comestible en una noche especial.
3. **Resolver dudas comunes** (¿es segura?, ¿es hipoalergénica?, ¿cómo se conserva?, ¿cómo se combina con otros productos?).
4. **Recomendar combinaciones**: con aceites, juegos, bebidas o ambiente.
5. **Atención postventa**: seguimiento amable, preguntas frecuentes, tips de uso.
6. **Adaptación al historial del cliente**: si el cliente ya preguntó por un sabor o prenda específica, hacer recomendaciones basadas en esa preferencia.

📚 **Base de conocimiento (incluir):**
- Catálogo actualizado de productos (sabores disponibles, tallas, materiales).
- Información sobre alérgenos y seguridad.
- Promociones actuales.
- Consejos para una noche temática romántica o lúdica.
- Combinaciones estrella entre productos.

🎯 **Directrices clave:**
- Siempre confirmar si el cliente está buscando algo para sí o para regalar.
- Si detectas inseguridad o duda, valida sus emociones: “Es normal tener curiosidad…”
- Si el cliente pregunta por algo no disponible, sugiere alternativas con entusiasmo.
- Cierra cada interacción con una sugerencia tentadora o una pregunta suave para mantener el diálogo.

🗝️ **Ejemplo de bienvenida inicial:**
"Hola amor, soy Esperanza 🌹. Estoy aquí para ayudarte a elegir algo delicioso y sensual... ¿Es para ti o para alguien especial? 😏"

`
};


// Configuración del modelo y seguridad (puedes ajustarlas)
const generationConfig = {
    temperature: 0.75, // Un poco más de creatividad pero aún enfocado
    topK: 40,          // Considera más tokens posibles
    topP: 0.95,        // Núcleo de probabilidad amplio
    maxOutputTokens: 2048,
};

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// Obtener el modelo con la systemInstruction configurada
const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash", // O el modelo que estés utilizando
    systemInstruction: bigSamPrompt.text, // Aquí se pasa el prompt de Big Sam
    generationConfig, // Aplicamos la configuración de generación aquí también
    safetySettings    // Y la configuración de seguridad
});


exports.sendMessage = async (req, res) => {
    const { message } = req.body;
    const userId = req.user._id;

    if (!message || message.trim() === "") {
        return res.status(400).json({ message: 'El mensaje no puede estar vacío, ¡ponle ganas!' });
    }

    try {
        let conversation = await Conversation.findOne({ userId });
        if (!conversation) {
            conversation = new Conversation({ userId, messages: [] });
        }

        // Añadir mensaje del usuario al historial de la BD
        const userMessageEntry = { sender: 'user', text: message, timestamp: new Date() };
        conversation.messages.push(userMessageEntry);

        // Preparar historial para Gemini API
        // El formato es [ { role: "user", parts: [{text: ""}] }, { role: "model", parts: [{text: ""}] } ]
        const chatHistoryForGemini = conversation.messages
            .slice(-20) // Limitar el historial enviado para no exceder límites y mantener relevancia (ajusta según necesidad)
            .map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text }]
            }));
        
        // Iniciar o continuar el chat con Gemini
        // La `systemInstruction` ya fue configurada al obtener el `model`.
        // Solo necesitamos pasar el historial de la conversación actual.
        const chat = model.startChat({
            history: chatHistoryForGemini.slice(0, -1), // Enviar historial *antes* del último mensaje del usuario
                                                         // ya que el último mensaje del usuario se envía con `sendMessage`
            // generationConfig y safetySettings ya están en `model`
        });

        const result = await chat.sendMessage(message); // Envía el mensaje actual del usuario
        const response = result.response;
        const geminiResponseText = response.text();

        // Añadir respuesta del bot al historial de la BD
        const botMessageEntry = { sender: 'bot', text: geminiResponseText, timestamp: new Date() };
        conversation.messages.push(botMessageEntry);
        await conversation.save();

        res.json({
            userMessage: userMessageEntry, // Devuelve el mensaje del usuario tal como se guardó
            botResponse: botMessageEntry   // Devuelve la respuesta del bot tal como se guardó
        });

    } catch (error) {
        console.error('Error al hablar con Big Sam (Gemini):', error);
        let errorMessage = 'Big Sam está ocupado en las pesas. Error interno del servidor.';
        if (error.message.includes('SAFETY')) {
            errorMessage = 'Big Sam considera que tu mensaje no es apropiado o seguro. ¡Intenta reformularlo, campeón!';
            // Puedes inspeccionar error.response.promptFeedback para más detalles si está disponible
             if (error.response && error.response.promptFeedback) {
                console.error('Feedback de seguridad de Gemini:', error.response.promptFeedback);
            }
        } else if (error.message.includes('quota')) {
            errorMessage = 'Parece que Big Sam ha hablado demasiado hoy (límite de cuota alcanzado). Intenta más tarde.';
        }
        
        res.status(500).json({ message: errorMessage });
    }
};

exports.getConversationHistory = async (req, res) => {
    const userId = req.user._id;
    try {
        const conversation = await Conversation.findOne({ userId }).sort({ 'messages.timestamp': 1 });
        
        if (conversation && conversation.messages.length > 0) {
            res.json(conversation.messages);
        } else {
            // Si no hay conversación, Big Sam puede dar su saludo inicial.
            // Este mensaje no se guarda en la BD hasta que el usuario interactúe.
            const initialBotMessage = {
                sender: 'bot',
                text: "¡Qué onda, campeón! Aquí Big Sam, tu asistente personal de gimnasio. ¿Listo para darle con todo? Dime, ¿en qué te puedo echar una mano hoy? ¿Necesitas saber de máquinas, rutinas, o dónde queda la sede más cercana para romperla?",
                timestamp: new Date()
            };
            res.json([initialBotMessage]);
        }
    } catch (error) {
        console.error('Error al obtener historial:', error);
        res.status(500).json({ message: 'No pudimos recuperar tu progreso. Error del servidor.' });
    }
};