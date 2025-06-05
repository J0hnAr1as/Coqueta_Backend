// config/db.js
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Conectado... ¡A darle duro!');
    } catch (err) {
        console.error('Error al conectar con MongoDB:', err.message);
        process.exit(1); // Salir del proceso con error
    }
};

module.exports = connectDB;