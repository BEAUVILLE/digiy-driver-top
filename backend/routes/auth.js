const express = require('express');
const router = express.Router();
const {
    register,
    login,
    adminLogin,
    registerDriver,
    loginDriver,
    logout,
    getMe,
    updatePassword
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Routes publiques - Client/Admin
router.post('/register', register);
router.post('/login', login);
router.post('/admin/login', adminLogin);

// Routes publiques - Chauffeur
router.post('/driver/register', registerDriver);
router.post('/driver/login', loginDriver);

// Routes protégées
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/password', protect, updatePassword);

module.exports = router;
