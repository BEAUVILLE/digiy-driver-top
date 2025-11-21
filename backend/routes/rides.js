const express = require('express');
const router = express.Router();
const {
    createRide,
    getAllRides,
    getMyRides,
    getDriverRides,
    getRide,
    acceptRide,
    updateRideStatus,
    cancelRide,
    rateRide,
    getRideStats
} = require('../controllers/rideController');
const { protect, authorize, adminOnly } = require('../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(protect);

// Routes Client
router.post('/', authorize('client'), createRide);
router.get('/my-rides', authorize('client'), getMyRides);

// Routes Chauffeur
router.get('/driver-rides', authorize('driver'), getDriverRides);
router.put('/:id/accept', authorize('driver'), acceptRide);
router.put('/:id/status', authorize('driver'), updateRideStatus);

// Routes communes
router.get('/:id', getRide);
router.put('/:id/cancel', cancelRide);
router.put('/:id/rate', rateRide);

// Routes Admin
router.get('/', adminOnly, getAllRides);
router.get('/stats/overview', adminOnly, getRideStats);

module.exports = router;
