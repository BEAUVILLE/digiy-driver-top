const Driver = require('../models/Driver');

// @desc    Obtenir tous les chauffeurs (Admin)
// @route   GET /api/drivers
// @access  Private (Admin)
exports.getAllDrivers = async (req, res, next) => {
    try {
        const { status, verified, page = 1, limit = 20 } = req.query;
        
        const query = {};
        if (status) query.status = status;
        if (verified !== undefined) query.isVerified = verified === 'true';
        
        const drivers = await Driver.find(query)
            .select('-password')
            .sort('-createdAt')
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
        
        const total = await Driver.countDocuments(query);
        
        res.status(200).json({
            success: true,
            count: drivers.length,
            total,
            pages: Math.ceil(total / limit),
            data: drivers
        });
        
    } catch (error) {
        next(error);
    }
};

// @desc    Obtenir les chauffeurs en ligne (pour la carte Admin)
// @route   GET /api/drivers/online
// @access  Private (Admin)
exports.getOnlineDrivers = async (req, res, next) => {
    try {
        const drivers = await Driver.find({
            status: { $in: ['online', 'busy'] },
            isActive: true
        }).select('name vehicle status currentLocation rating totalRides');
        
        res.status(200).json({
            success: true,
            count: drivers.length,
            data: drivers
        });
        
    } catch (error) {
        next(error);
    }
};

// @desc    Obtenir les chauffeurs à proximité (Client)
// @route   GET /api/drivers/nearby
// @access  Private
exports.getNearbyDrivers = async (req, res, next) => {
    try {
        const { lng, lat, distance = 5000, vehicleType } = req.query;
        
        if (!lng || !lat) {
            return res.status(400).json({
                success: false,
                error: 'Les coordonnées sont requises (lng, lat)'
            });
        }
        
        const drivers = await Driver.findNearbyDrivers(
            parseFloat(lng),
            parseFloat(lat),
            parseInt(distance),
            vehicleType
        );
        
        res.status(200).json({
            success: true,
            count: drivers.length,
            data: drivers.map(d => ({
                id: d._id,
                name: d.name,
                vehicle: d.vehicle,
                rating: d.rating,
                location: d.currentLocation.coordinates
            }))
        });
        
    } catch (error) {
        next(error);
    }
};

// @desc    Obtenir un chauffeur par ID
// @route   GET /api/drivers/:id
// @access  Private (Admin)
exports.getDriver = async (req, res, next) => {
    try {
        const driver = await Driver.findById(req.params.id).select('-password');
        
        if (!driver) {
            return res.status(404).json({
                success: false,
                error: 'Chauffeur non trouvé'
            });
        }
        
        res.status(200).json({
            success: true,
            data: driver
        });
        
    } catch (error) {
        next(error);
    }
};

// @desc    Mettre à jour la position du chauffeur
// @route   PUT /api/drivers/location
// @access  Private (Driver)
exports.updateLocation = async (req, res, next) => {
    try {
        const { lng, lat } = req.body;
        
        if (lng === undefined || lat === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Les coordonnées sont requises (lng, lat)'
            });
        }
        
        await req.user.updateLocation(lng, lat);
        
        // Émettre la position via Socket.IO
        if (req.io) {
            // Notifier les admins
            req.io.to('admin_room').emit('driver_location_updated', {
                driverId: req.user._id,
                location: [lng, lat],
                status: req.user.status
            });
            
            // Si en course, notifier le client
            if (req.user.currentRide) {
                const Ride = require('../models/Ride');
                const ride = await Ride.findById(req.user.currentRide);
                if (ride) {
                    req.io.to(`client_${ride.client}`).emit('driver_location_updated', {
                        driverId: req.user._id,
                        location: [lng, lat]
                    });
                }
            }
        }
        
        res.status(200).json({
            success: true,
            message: 'Position mise à jour'
        });
        
    } catch (error) {
        next(error);
    }
};

// @desc    Mettre à jour le statut du chauffeur (en ligne/hors ligne)
// @route   PUT /api/drivers/status
// @access  Private (Driver)
exports.updateStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        
        if (!['online', 'offline'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Statut invalide. Utilisez "online" ou "offline"'
            });
        }
        
        // Ne pas permettre de passer hors ligne si en course
        if (status === 'offline' && req.user.currentRide) {
            return res.status(400).json({
                success: false,
                error: 'Vous ne pouvez pas passer hors ligne pendant une course'
            });
        }
        
        req.user.status = status;
        await req.user.save({ validateBeforeSave: false });
        
        // Notifier les admins via Socket.IO
        if (req.io) {
            req.io.to('admin_room').emit('driver_status_changed', {
                driverId: req.user._id,
                status: status
            });
        }
        
        res.status(200).json({
            success: true,
            message: `Statut mis à jour: ${status}`,
            data: { status }
        });
        
    } catch (error) {
        next(error);
    }
};

// @desc    Mettre à jour le profil du chauffeur
// @route   PUT /api/drivers/profile
// @access  Private (Driver)
exports.updateProfile = async (req, res, next) => {
    try {
        const allowedFields = ['name', 'phone', 'avatar'];
        const updates = {};
        
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });
        
        const driver = await Driver.findByIdAndUpdate(
            req.user._id,
            updates,
            { new: true, runValidators: true }
        ).select('-password');
        
        res.status(200).json({
            success: true,
            data: driver
        });
        
    } catch (error) {
        next(error);
    }
};

// @desc    Vérifier un chauffeur (Admin)
// @route   PUT /api/drivers/:id/verify
// @access  Private (Admin)
exports.verifyDriver = async (req, res, next) => {
    try {
        const driver = await Driver.findByIdAndUpdate(
            req.params.id,
            { isVerified: true },
            { new: true }
        ).select('-password');
        
        if (!driver) {
            return res.status(404).json({
                success: false,
                error: 'Chauffeur non trouvé'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Chauffeur vérifié avec succès',
            data: driver
        });
        
    } catch (error) {
        next(error);
    }
};

// @desc    Bannir/Débannir un chauffeur (Admin)
// @route   PUT /api/drivers/:id/ban
// @access  Private (Admin)
exports.toggleBan = async (req, res, next) => {
    try {
        const { ban, reason } = req.body;
        
        const driver = await Driver.findById(req.params.id);
        
        if (!driver) {
            return res.status(404).json({
                success: false,
                error: 'Chauffeur non trouvé'
            });
        }
        
        driver.isBanned = ban;
        driver.banReason = ban ? reason : null;
        
        if (ban) {
            driver.status = 'offline';
            driver.currentRide = null;
        }
        
        await driver.save({ validateBeforeSave: false });
        
        res.status(200).json({
            success: true,
            message: ban ? 'Chauffeur banni' : 'Chauffeur débanni',
            data: driver
        });
        
    } catch (error) {
        next(error);
    }
};

// @desc    Obtenir les statistiques des chauffeurs (Admin)
// @route   GET /api/drivers/stats
// @access  Private (Admin)
exports.getDriverStats = async (req, res, next) => {
    try {
        const stats = await Driver.aggregate([
            {
                $facet: {
                    total: [{ $count: 'count' }],
                    
                    byStatus: [
                        { $group: { _id: '$status', count: { $sum: 1 } } }
                    ],
                    
                    verified: [
                        { $match: { isVerified: true } },
                        { $count: 'count' }
                    ],
                    
                    byVehicleType: [
                        { $group: { _id: '$vehicle.type', count: { $sum: 1 } } }
                    ],
                    
                    topDrivers: [
                        { $match: { isVerified: true, isActive: true } },
                        { $sort: { rating: -1, totalRides: -1 } },
                        { $limit: 10 },
                        { $project: { name: 1, rating: 1, totalRides: 1, totalEarnings: 1, vehicle: 1 } }
                    ]
                }
            }
        ]);
        
        res.status(200).json({
            success: true,
            data: {
                total: stats[0].total[0]?.count || 0,
                verified: stats[0].verified[0]?.count || 0,
                byStatus: stats[0].byStatus,
                byVehicleType: stats[0].byVehicleType,
                topDrivers: stats[0].topDrivers
            }
        });
        
    } catch (error) {
        next(error);
    }
};
