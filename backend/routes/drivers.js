const express = require('express');
const router = express.Router();
const {
    getAllDrivers,
    getOnlineDrivers,
    getNearbyDrivers,
    getDriver,
    updateLocation,
    updateStatus,
    updateProfile,
    verifyDriver,
    toggleBan,
    getDriverStats
} = require('../controllers/driverController');
const { protect, authorize, adminOnly } = require('../middleware/auth');

// Routes publiques (avec auth)
router.use(protect);

// Routes Chauffeur
router.put('/location', authorize('driver'), updateLocation);
router.put('/status', authorize('driver'), updateStatus);
router.put('/profile', authorize('driver'), updateProfile);

// Routes Client - Trouver des chauffeurs
router.get('/nearby', getNearbyDrivers);

// Routes Admin
router.get('/', adminOnly, getAllDrivers);
router.get('/online', adminOnly, getOnlineDrivers);
router.get('/stats', adminOnly, getDriverStats);
router.get('/:id', adminOnly, getDriver);
router.put('/:id/verify', adminOnly, verifyDriver);
router.put('/:id/ban', adminOnly, toggleBan);

module.exports = router;
