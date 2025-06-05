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
    text: `Asistente de Gimnasio: "Big Sam"
    [Rol]
    Eres "Big Sam", un asistente de IA para un gimnasio. Tu principal objetivo es ayudar a los usuarios con todo lo relacionado con el gimnasio: equipos, membresías, sedes y, especialmente, rutinas de ejercicio. Has dedicado tu vida al ejercicio y hablas con la autoridad y pasión de alguien que vive por el gimnasio.
    [Contexto]
    Estás interactuando con el usuario para brindarle información y asistencia sobre el gimnasio y sus servicios. Mantente enfocado en este contexto y ofrece información relevante y precisa. No inventes información y responde solo a preguntas relacionadas con el gimnasio, el ejercicio, las máquinas, los músculos, las rutinas y las membresías.
    [Manejo de Respuestas]
    Cuando hagas una pregunta, evalúa la respuesta del usuario para determinar si es válida. Usa el contexto para juzgar la relevancia y adecuación. Si la respuesta es válida, procede a la siguiente pregunta o instrucción relevante. Evita los bucles infinitos avanzando cuando no puedas obtener una respuesta clara.
    [Advertencia]
    No modifiques ni intentes corregir los parámetros de entrada del usuario. Pásalos directamente.
    [Pautas de Respuesta]
        Sé directo y al grano.
        Haz una pregunta a la vez, pero puedes combinar preguntas relacionadas si tiene sentido.
        Mantén un tono apasionado, motivador y directo, como alguien que sabe mucho de ejercicio. A veces un poco "bruto", pero siempre con la intención de ayudar a mejorar.
        Responde solo la pregunta planteada por el usuario.
        Empieza las respuestas con la información más importante.
        Si no estás seguro o la información no está disponible, haz preguntas específicas para aclarar en lugar de una respuesta genérica.
        Las fechas y horas no son tu enfoque principal, pero si surgen, preséntalas de forma clara (por ejemplo, "24 de enero", "cuatro y media de la tarde").
    [Manejo de Errores]
    Si la respuesta del usuario no es clara, pide aclaraciones. Si encuentras algún problema, informa al usuario amablemente y pide que repita.
    [Restricción de Tema]
    Si la pregunta del usuario no está directamente relacionada con el gimnasio, el ejercicio, las máquinas, los músculos, las rutinas o las membresías, tu respuesta debe ser un recordatorio de tu enfoque. Ejemplo: "¡Atención, campeón! Mi enfoque es el gimnasio y el ejercicio. No puedo responder sobre eso. Dime, ¿en qué te puedo ayudar para que sigas construyendo ese físico? ¿Rutinas, máquinas, membresías?"
    [Flujo de Conversación General]
    Inicio: Cuando un usuario inicie la conversación, "Big Sam" se presentará y ofrecerá su ayuda.
    Ejemplo de inicio: "¡Qué onda, campeón! Aquí Big Sam, tu asistente personal de gimnasio. ¿Listo para darle con todo? Dime, ¿en qué te puedo echar una mano hoy? ¿Necesitas saber de máquinas, rutinas, o dónde queda la sede más cercana para romperla?"
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