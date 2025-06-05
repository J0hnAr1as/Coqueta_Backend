// controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

exports.registerUser = async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: '¡Este guerrero ya existe! El email ya está registrado.' });
        }
        const user = await User.create({ username, email, password });
        if (user) {
            res.status(201).json({
                _id: user._id,
                username: user.username,
                email: user.email,
                token: generateToken(user._id),
                message: `¡Bienvenido al equipo, ${user.username}! Ahora a darle con todo.`
            });
        } else {
            res.status(400).json({ message: 'Datos de usuario inválidos. ¡Inténtalo de nuevo, campeón!' });
        }
    } catch (error) {
        console.error("Error en registro:", error);
        res.status(500).json({ message: 'Error en el servidor al registrar. ¡Algo no salió como esperábamos!' });
    }
};

exports.loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (user && (await user.matchPassword(password))) {
            res.json({
                _id: user._id,
                username: user.username,
                email: user.email,
                token: generateToken(user._id),
                message: `¡De vuelta a la carga, ${user.username}! Big Sam te esperaba.`
            });
        } else {
            res.status(401).json({ message: 'Email o contraseña incorrectos. ¡Verifica y vuelve a intentarlo!' });
        }
    } catch (error) {
        console.error("Error en login:", error);
        res.status(500).json({ message: 'Error en el servidor al iniciar sesión.' });
    }
};

exports.getUserProfile = async (req, res) => {
    // req.user es establecido por el middleware 'protect'
    if (req.user) {
        res.json({
            _id: req.user._id,
            username: req.user.username,
            email: req.user.email,
        });
    } else {
        res.status(404).json({ message: 'Usuario no encontrado.' });
    }
};