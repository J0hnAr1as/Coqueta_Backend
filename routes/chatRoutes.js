// routes/chatRoutes.js
const express = require('express');
const { sendMessage, getConversationHistory } = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

// Todas las rutas de chat estarán protegidas
router.post('/send', protect, sendMessage);
router.get('/history', protect, getConversationHistory);

module.exports = router;