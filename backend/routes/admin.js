// ========================================
// DIGIY DRIVER - Routes Admin
// ========================================

const express = require('express');
const router = express.Router();

const Driver = require('../models/Driver');
const Client = require('../models/Client');
const Ride = require('../models/Ride');
const { asyncHandler, ErrorResponse } = require('../middleware/error');
const { protect, adminOnly } = require('../middleware/auth');

// Toutes les routes nécessitent une authentification admin
router.use(protect);
router.use(adminOnly);

// ==========================================
// GESTION DES CHAUFFEURS
// ==========================================

// @desc    Lister tous les chauffeurs
// @route   GET /api/v1/admin/drivers
router.get('/drivers', asyncHandler(async (req, res) => {
    const { status, isOnline, vehicleType, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (isOnline !== undefined) query.isOnline = isOnline === 'true';
    if (vehicleType) query['vehicle.type'] = vehicleType;
    
    const skip = (page - 1) * limit;
    
    const drivers = await Driver.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
    
    const total = await Driver.countDocuments(query);
    
    res.status(200).json({
        success: true,
        count: drivers.length,
        total,
        pages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        data: drivers
    });
}));

// @desc    Obtenir un chauffeur
// @route   GET /api/v1/admin/drivers/:id
router.get('/drivers/:id', asyncHandler(async (req, res, next) => {
    const driver = await Driver.findById(req.params.id);
    
    if (!driver) {
        return next(new ErrorResponse('Chauffeur non trouvé', 404));
    }
    
    res.status(200).json({
        success: true,
        data: driver
    });
}));

// @desc    Valider un chauffeur
// @route   PUT /api/v1/admin/drivers/:id/approve
router.put('/drivers/:id/approve', asyncHandler(async (req, res, next) => {
    const driver = await Driver.findById(req.params.id);
    
    if (!driver) {
        return next(new ErrorResponse('Chauffeur non trouvé', 404));
    }
    
    driver.status = 'active';
    await driver.save({ validateBeforeSave: false });
    
    // TODO: Envoyer notification au chauffeur
    
    res.status(200).json({
        success: true,
        message: 'Chauffeur validé',
        data: driver
    });
}));

// @desc    Suspendre un chauffeur
// @route   PUT /api/v1/admin/drivers/:id/suspend
router.put('/drivers/:id/suspend', asyncHandler(async (req, res, next) => {
    const driver = await Driver.findById(req.params.id);
    
    if (!driver) {
        return next(new ErrorResponse('Chauffeur non trouvé', 404));
    }
    
    driver.status = 'suspended';
    driver.isOnline = false;
    await driver.save({ validateBeforeSave: false });
    
    res.status(200).json({
        success: true,
        message: 'Chauffeur suspendu',
        data: driver
    });
}));

// @desc    Mettre à jour un chauffeur
// @route   PUT /api/v1/admin/drivers/:id
router.put('/drivers/:id', asyncHandler(async (req, res, next) => {
    const driver = await Driver.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
    );
    
    if (!driver) {
        return next(new ErrorResponse('Chauffeur non trouvé', 404));
    }
    
    res.status(200).json({
        success: true,
        data: driver
    });
}));

// @desc    Supprimer un chauffeur
// @route   DELETE /api/v1/admin/drivers/:id
router.delete('/drivers/:id', asyncHandler(async (req, res, next) => {
    const driver = await Driver.findById(req.params.id);
    
    if (!driver) {
        return next(new ErrorResponse('Chauffeur non trouvé', 404));
    }
    
    await driver.deleteOne();
    
    res.status(200).json({
        success: true,
        message: 'Chauffeur supprimé'
    });
}));

// ==========================================
// GESTION DES CLIENTS
// ==========================================

// @desc    Lister tous les clients
// @route   GET /api/v1/admin/clients
router.get('/clients', asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    
    const skip = (page - 1) * limit;
    
    const clients = await Client.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
    
    const total = await Client.countDocuments(query);
    
    res.status(200).json({
        success: true,
        count: clients.length,
        total,
        pages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        data: clients
    });
}));

// @desc    Obtenir un client
// @route   GET /api/v1/admin/clients/:id
router.get('/clients/:id', asyncHandler(async (req, res, next) => {
    const client = await Client.findById(req.params.id);
    
    if (!client) {
        return next(new ErrorResponse('Client non trouvé', 404));
    }
    
    res.status(200).json({
        success: true,
        data: client
    });
}));

// @desc    Suspendre un client
// @route   PUT /api/v1/admin/clients/:id/suspend
router.put('/clients/:id/suspend', asyncHandler(async (req, res, next) => {
    const client = await Client.findById(req.params.id);
    
    if (!client) {
        return next(new ErrorResponse('Client non trouvé', 404));
    }
    
    client.status = 'suspended';
    await client.save({ validateBeforeSave: false });
    
    res.status(200).json({
        success: true,
        message: 'Client suspendu',
        data: client
    });
}));

// ==========================================
// DASHBOARD & STATISTIQUES
// ==========================================

// @desc    Obtenir les statistiques du dashboard
// @route   GET /api/v1/admin/dashboard
router.get('/dashboard', asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Stats chauffeurs
    const totalDrivers = await Driver.countDocuments();
    const activeDrivers = await Driver.countDocuments({ status: 'active' });
    const onlineDrivers = await Driver.countDocuments({ isOnline: true });
    const busyDrivers = await Driver.countDocuments({ isBusy: true });
    const pendingDrivers = await Driver.countDocuments({ status: 'pending' });
    
    // Stats clients
    const totalClients = await Client.countDocuments();
    const activeClients = await Client.countDocuments({ status: 'active' });
    
    // Stats courses aujourd'hui
    const todayRides = await Ride.countDocuments({
        createdAt: { $gte: today }
    });
    const completedToday = await Ride.countDocuments({
        status: 'completed',
        'timestamps.completed': { $gte: today }
    });
    const activeRides = await Ride.countDocuments({
        status: { $in: ['pending', 'accepted', 'arrived', 'started'] }
    });
    
    // Revenus aujourd'hui
    const revenueToday = await Ride.aggregate([
        {
            $match: {
                status: 'completed',
                'timestamps.completed': { $gte: today }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$pricing.totalFare' }
            }
        }
    ]);
    
    // Revenus ce mois
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const revenueMonth = await Ride.aggregate([
        {
            $match: {
                status: 'completed',
                'timestamps.completed': { $gte: firstDayOfMonth }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$pricing.totalFare' }
            }
        }
    ]);
    
    res.status(200).json({
        success: true,
        data: {
            drivers: {
                total: totalDrivers,
                active: activeDrivers,
                online: onlineDrivers,
                busy: busyDrivers,
                pending: pendingDrivers
            },
            clients: {
                total: totalClients,
                active: activeClients
            },
            rides: {
                today: todayRides,
                completedToday,
                active: activeRides
            },
            revenue: {
                today: revenueToday[0]?.total || 0,
                month: revenueMonth[0]?.total || 0
            }
        }
    });
}));

// @desc    Obtenir les chauffeurs en temps réel (pour la carte)
// @route   GET /api/v1/admin/drivers/realtime
router.get('/drivers-realtime', asyncHandler(async (req, res) => {
    const drivers = await Driver.find({ status: 'active' })
        .select('firstName lastName phone vehicle location isOnline isBusy stats.averageRating currentRide')
        .lean();
    
    res.status(200).json({
        success: true,
        count: drivers.length,
        data: drivers
    });
}));

module.exports = router;
