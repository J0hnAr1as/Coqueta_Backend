// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();

const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password'); // Adjunta el usuario al request
            if (!req.user) {
                return res.status(401).json({ message: 'No autorizado, usuario no encontrado.' });
            }
            next();
        } catch (error) {
            console.error('Error de autenticación:', error);
            res.status(401).json({ message: 'No autorizado, token falló.' });
        }
    }
    if (!token) {
        res.status(401).json({ message: 'No autorizado, no hay token.' });
    }
};

module.exports = { protect };