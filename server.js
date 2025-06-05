// server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');

dotenv.config(); // Carga variables de .env
connectDB();    // Conecta a MongoDB

const app = express();

// Middlewares
app.use(cors()); // Permite solicitudes CORS
app.use(express.json()); // Para parsear JSON del body

// Rutas
app.get('/', (req, res) => {
    res.send('API de Big Sam funcionando... ¡A levantar hierro!');
});
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Servidor backend de Big Sam corriendo en el puerto ${PORT}, ¡listo para la acción!`));