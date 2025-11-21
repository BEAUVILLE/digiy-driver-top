// ========================================
// DIGIY DRIVER - Contrôleur Rides (Courses)
// ========================================

const Ride = require('../models/Ride');
const Driver = require('../models/Driver');
const Client = require('../models/Client');
const config = require('../config/config');
const { asyncHandler, ErrorResponse } = require('../middleware/error');

// @desc    Créer une nouvelle demande de course
// @route   POST /api/v1/rides
// @access  Private (Client)
exports.createRide = asyncHandler(async (req, res, next) => {
    const {
        pickup,
        dropoff,
        vehicleType,
        paymentMethod,
        stops,
        scheduledFor,
        passengerCount,
        luggage,
        childSeat
    } = req.body;
    
    // Calculer l'estimation (simulation)
    const estimate = calculateEstimate(pickup, dropoff, vehicleType);
    
    // Créer la course
    const ride = await Ride.create({
        client: req.user.id,
        pickup,
        dropoff,
        vehicleType: vehicleType || 'eco',
        stops,
        estimate,
        payment: {
            method: paymentMethod || 'cash'
        },
        isScheduled: !!scheduledFor,
        scheduledFor,
        passengerCount,
        luggage,
        childSeat,
        timestamps: {
            requested: new Date()
        }
    });
    
    // Chercher les chauffeurs à proximité
    const nearbyDrivers = await Driver.findNearby(
        pickup.location.coordinates[0],
        pickup.location.coordinates[1],
        5000, // 5km
        vehicleType
    );
    
    // Émettre l'événement Socket.IO aux chauffeurs à proximité
    const io = req.app.get('io');
    if (io && nearbyDrivers.length > 0) {
        nearbyDrivers.forEach(driver => {
            io.to(`driver_${driver._id}`).emit('ride:new', {
                rideId: ride._id,
                rideCode: ride.rideCode,
                pickup: ride.pickup,
                dropoff: ride.dropoff,
                estimate: ride.estimate,
                vehicleType: ride.vehicleType,
                client: {
                    name: req.user.fullName,
                    rating: req.user.stats.averageRating
                }
            });
        });
    }
    
    res.status(201).json({
        success: true,
        data: ride,
        nearbyDrivers: nearbyDrivers.length
    });
});

// @desc    Obtenir les chauffeurs à proximité
// @route   GET /api/v1/rides/nearby-drivers
// @access  Private (Client)
exports.getNearbyDrivers = asyncHandler(async (req, res, next) => {
    const { longitude, latitude, vehicleType, maxDistance } = req.query;
    
    if (!longitude || !latitude) {
        return next(new ErrorResponse('Coordonnées requises', 400));
    }
    
    const drivers = await Driver.findNearby(
        parseFloat(longitude),
        parseFloat(latitude),
        parseInt(maxDistance) || 5000,
        vehicleType
    );
    
    res.status(200).json({
        success: true,
        count: drivers.length,
        data: drivers
    });
});

// @desc    Estimer le prix d'une course
// @route   POST /api/v1/rides/estimate
// @access  Public
exports.estimateRide = asyncHandler(async (req, res, next) => {
    const { pickup, dropoff, vehicleType } = req.body;
    
    const estimate = calculateEstimate(pickup, dropoff, vehicleType || 'eco');
    
    // Calculer pour tous les types de véhicules
    const allEstimates = {
        eco: calculateEstimate(pickup, dropoff, 'eco'),
        confort: calculateEstimate(pickup, dropoff, 'confort'),
        premium: calculateEstimate(pickup, dropoff, 'premium'),
        moto: calculateEstimate(pickup, dropoff, 'moto')
    };
    
    res.status(200).json({
        success: true,
        data: {
            selected: estimate,
            all: allEstimates
        }
    });
});

// @desc    Chauffeur accepte une course
// @route   PUT /api/v1/rides/:id/accept
// @access  Private (Driver)
exports.acceptRide = asyncHandler(async (req, res, next) => {
    const ride = await Ride.findById(req.params.id);
    
    if (!ride) {
        return next(new ErrorResponse('Course non trouvée', 404));
    }
    
    if (ride.status !== 'pending') {
        return next(new ErrorResponse('Cette course n\'est plus disponible', 400));
    }
    
    // Vérifier si le chauffeur est disponible
    if (req.user.isBusy || !req.user.isOnline) {
        return next(new ErrorResponse('Vous n\'êtes pas disponible', 400));
    }
    
    // Accepter la course
    ride.driver = req.user.id;
    ride.status = 'accepted';
    ride.timestamps.accepted = new Date();
    await ride.save();
    
    // Mettre à jour le statut du chauffeur
    req.user.isBusy = true;
    req.user.currentRide = ride._id;
    await req.user.save({ validateBeforeSave: false });
    
    // Notifier le client via Socket.IO
    const io = req.app.get('io');
    if (io) {
        io.to(`client_${ride.client}`).emit('ride:accepted', {
            rideId: ride._id,
            driver: {
                id: req.user._id,
                name: req.user.fullName,
                phone: req.user.phone,
                photo: req.user.avatar,
                vehicle: req.user.vehicle,
                rating: req.user.stats.averageRating,
                location: req.user.location
            }
        });
    }
    
    res.status(200).json({
        success: true,
        data: ride
    });
});

// @desc    Chauffeur refuse une course
// @route   PUT /api/v1/rides/:id/decline
// @access  Private (Driver)
exports.declineRide = asyncHandler(async (req, res, next) => {
    const ride = await Ride.findById(req.params.id);
    
    if (!ride) {
        return next(new ErrorResponse('Course non trouvée', 404));
    }
    
    // Ajouter aux chauffeurs qui ont refusé
    ride.declinedDrivers.push({
        driver: req.user.id,
        reason: req.body.reason
    });
    
    await ride.save();
    
    // Mettre à jour le taux d'acceptation du chauffeur
    const totalRequests = req.user.stats.totalRides + req.user.stats.cancelledRides + 1;
    req.user.stats.acceptanceRate = Math.round(
        (req.user.stats.totalRides / totalRequests) * 100
    );
    await req.user.save({ validateBeforeSave: false });
    
    res.status(200).json({
        success: true,
        message: 'Course refusée'
    });
});

// @desc    Chauffeur arrivé au point de départ
// @route   PUT /api/v1/rides/:id/arrived
// @access  Private (Driver)
exports.driverArrived = asyncHandler(async (req, res, next) => {
    const ride = await Ride.findById(req.params.id);
    
    if (!ride) {
        return next(new ErrorResponse('Course non trouvée', 404));
    }
    
    if (ride.driver.toString() !== req.user.id.toString()) {
        return next(new ErrorResponse('Non autorisé', 403));
    }
    
    ride.status = 'arrived';
    ride.timestamps.driverArrived = new Date();
    await ride.save();
    
    // Notifier le client
    const io = req.app.get('io');
    if (io) {
        io.to(`client_${ride.client}`).emit('ride:driver_arrived', {
            rideId: ride._id,
            message: 'Votre chauffeur est arrivé!'
        });
    }
    
    res.status(200).json({
        success: true,
        data: ride
    });
});

// @desc    Démarrer la course
// @route   PUT /api/v1/rides/:id/start
// @access  Private (Driver)
exports.startRide = asyncHandler(async (req, res, next) => {
    const ride = await Ride.findById(req.params.id);
    
    if (!ride) {
        return next(new ErrorResponse('Course non trouvée', 404));
    }
    
    if (ride.driver.toString() !== req.user.id.toString()) {
        return next(new ErrorResponse('Non autorisé', 403));
    }
    
    ride.status = 'started';
    ride.timestamps.started = new Date();
    await ride.save();
    
    // Notifier le client
    const io = req.app.get('io');
    if (io) {
        io.to(`client_${ride.client}`).emit('ride:started', {
            rideId: ride._id
        });
    }
    
    res.status(200).json({
        success: true,
        data: ride
    });
});

// @desc    Terminer la course
// @route   PUT /api/v1/rides/:id/complete
// @access  Private (Driver)
exports.completeRide = asyncHandler(async (req, res, next) => {
    const ride = await Ride.findById(req.params.id);
    
    if (!ride) {
        return next(new ErrorResponse('Course non trouvée', 404));
    }
    
    if (ride.driver.toString() !== req.user.id.toString()) {
        return next(new ErrorResponse('Non autorisé', 403));
    }
    
    const { actualDistance, actualDuration } = req.body;
    
    // Mettre à jour les valeurs réelles
    ride.actual.distance = actualDistance || ride.estimate.distance;
    ride.actual.duration = actualDuration || ride.estimate.duration;
    
    // Calculer le tarif final
    ride.calculateFare();
    
    ride.status = 'completed';
    ride.timestamps.completed = new Date();
    ride.payment.status = ride.payment.method === 'cash' ? 'pending' : 'pending';
    
    await ride.save();
    
    // Mettre à jour les stats du chauffeur
    req.user.stats.completedRides += 1;
    req.user.stats.totalRides += 1;
    req.user.stats.totalEarnings += ride.pricing.totalFare;
    req.user.stats.totalDistance += ride.actual.distance / 1000;
    req.user.stats.totalDuration += ride.actual.duration / 60;
    req.user.isBusy = false;
    req.user.currentRide = null;
    req.user.wallet.balance += ride.pricing.totalFare;
    await req.user.save({ validateBeforeSave: false });
    
    // Mettre à jour les stats du client
    const client = await Client.findById(ride.client);
    client.stats.completedRides += 1;
    client.stats.totalRides += 1;
    client.stats.totalSpent += ride.pricing.totalFare;
    await client.addLoyaltyPoints(ride.pricing.totalFare);
    await client.save({ validateBeforeSave: false });
    
    // Notifier le client
    const io = req.app.get('io');
    if (io) {
        io.to(`client_${ride.client}`).emit('ride:completed', {
            rideId: ride._id,
            fare: ride.pricing.totalFare,
            distance: ride.actual.distance,
            duration: ride.actual.duration
        });
    }
    
    res.status(200).json({
        success: true,
        data: ride
    });
});

// @desc    Annuler une course
// @route   PUT /api/v1/rides/:id/cancel
// @access  Private (Client/Driver)
exports.cancelRide = asyncHandler(async (req, res, next) => {
    const ride = await Ride.findById(req.params.id);
    
    if (!ride) {
        return next(new ErrorResponse('Course non trouvée', 404));
    }
    
    // Vérifier les droits
    const isClient = ride.client.toString() === req.user.id.toString();
    const isDriver = ride.driver && ride.driver.toString() === req.user.id.toString();
    
    if (!isClient && !isDriver) {
        return next(new ErrorResponse('Non autorisé', 403));
    }
    
    // Vérifier si la course peut être annulée
    if (['completed', 'cancelled'].includes(ride.status)) {
        return next(new ErrorResponse('Cette course ne peut pas être annulée', 400));
    }
    
    // Calculer les frais d'annulation
    let cancellationFee = 0;
    if (ride.status === 'started') {
        cancellationFee = 500; // 500 FCFA si course démarrée
    } else if (ride.status === 'arrived') {
        cancellationFee = 300; // 300 FCFA si chauffeur arrivé
    }
    
    ride.status = 'cancelled';
    ride.timestamps.cancelled = new Date();
    ride.cancellation = {
        cancelledBy: isClient ? 'client' : 'driver',
        reason: req.body.reason,
        fee: cancellationFee
    };
    
    await ride.save();
    
    // Libérer le chauffeur
    if (ride.driver) {
        const driver = await Driver.findById(ride.driver);
        driver.isBusy = false;
        driver.currentRide = null;
        if (isClient) {
            driver.stats.cancelledRides += 1;
        }
        await driver.save({ validateBeforeSave: false });
    }
    
    // Mettre à jour les stats du client si annulation par le client
    if (isClient) {
        const client = await Client.findById(ride.client);
        client.stats.cancelledRides += 1;
        await client.save({ validateBeforeSave: false });
    }
    
    // Notifier l'autre partie
    const io = req.app.get('io');
    if (io) {
        if (isClient && ride.driver) {
            io.to(`driver_${ride.driver}`).emit('ride:cancelled', {
                rideId: ride._id,
                cancelledBy: 'client',
                reason: req.body.reason
            });
        } else if (isDriver) {
            io.to(`client_${ride.client}`).emit('ride:cancelled', {
                rideId: ride._id,
                cancelledBy: 'driver',
                reason: req.body.reason
            });
        }
    }
    
    res.status(200).json({
        success: true,
        data: ride
    });
});

// @desc    Noter une course
// @route   POST /api/v1/rides/:id/rate
// @access  Private (Client/Driver)
exports.rateRide = asyncHandler(async (req, res, next) => {
    const { score, comment } = req.body;
    const ride = await Ride.findById(req.params.id);
    
    if (!ride) {
        return next(new ErrorResponse('Course non trouvée', 404));
    }
    
    if (ride.status !== 'completed') {
        return next(new ErrorResponse('Seules les courses terminées peuvent être notées', 400));
    }
    
    const isClient = ride.client.toString() === req.user.id.toString();
    const isDriver = ride.driver && ride.driver.toString() === req.user.id.toString();
    
    if (!isClient && !isDriver) {
        return next(new ErrorResponse('Non autorisé', 403));
    }
    
    if (isClient) {
        // Client note le chauffeur
        ride.ratings.driverRating = {
            score,
            comment,
            createdAt: new Date()
        };
        
        // Mettre à jour la note moyenne du chauffeur
        const driver = await Driver.findById(ride.driver);
        await driver.updateRating(score);
    } else {
        // Chauffeur note le client
        ride.ratings.clientRating = {
            score,
            comment,
            createdAt: new Date()
        };
        
        // Mettre à jour la note moyenne du client
        const client = await Client.findById(ride.client);
        const total = client.stats.totalRatings * client.stats.averageRating;
        client.stats.totalRatings += 1;
        client.stats.averageRating = (total + score) / client.stats.totalRatings;
        await client.save({ validateBeforeSave: false });
    }
    
    await ride.save();
    
    res.status(200).json({
        success: true,
        message: 'Note enregistrée'
    });
});

// @desc    Obtenir une course par ID
// @route   GET /api/v1/rides/:id
// @access  Private
exports.getRide = asyncHandler(async (req, res, next) => {
    const ride = await Ride.findById(req.params.id)
        .populate('client', 'firstName lastName phone')
        .populate('driver', 'firstName lastName phone vehicle');
    
    if (!ride) {
        return next(new ErrorResponse('Course non trouvée', 404));
    }
    
    res.status(200).json({
        success: true,
        data: ride
    });
});

// @desc    Obtenir l'historique des courses (Client)
// @route   GET /api/v1/rides/history
// @access  Private (Client)
exports.getClientHistory = asyncHandler(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const rides = await Ride.find({ client: req.user.id })
        .populate('driver', 'firstName lastName phone vehicle stats.averageRating')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    
    const total = await Ride.countDocuments({ client: req.user.id });
    
    res.status(200).json({
        success: true,
        count: rides.length,
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
        data: rides
    });
});

// @desc    Obtenir l'historique des courses (Chauffeur)
// @route   GET /api/v1/rides/driver-history
// @access  Private (Driver)
exports.getDriverHistory = asyncHandler(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const rides = await Ride.find({ driver: req.user.id })
        .populate('client', 'firstName lastName phone stats.averageRating')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    
    const total = await Ride.countDocuments({ driver: req.user.id });
    
    res.status(200).json({
        success: true,
        count: rides.length,
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
        data: rides
    });
});

// @desc    Obtenir les courses actives (Admin)
// @route   GET /api/v1/rides/active
// @access  Private (Admin)
exports.getActiveRides = asyncHandler(async (req, res, next) => {
    const rides = await Ride.getActiveRides();
    
    res.status(200).json({
        success: true,
        count: rides.length,
        data: rides
    });
});

// @desc    Obtenir les statistiques des courses (Admin)
// @route   GET /api/v1/rides/stats
// @access  Private (Admin)
exports.getRideStats = asyncHandler(async (req, res, next) => {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(new Date().setHours(0, 0, 0, 0));
    const end = endDate ? new Date(endDate) : new Date();
    
    const stats = await Ride.getStats(start, end);
    
    // Compter par statut
    const statusCounts = await Ride.aggregate([
        {
            $match: {
                createdAt: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);
    
    res.status(200).json({
        success: true,
        data: {
            summary: stats[0] || {},
            byStatus: statusCounts
        }
    });
});

// Helper: Calculer l'estimation
function calculateEstimate(pickup, dropoff, vehicleType) {
    // Simulation simple - dans la réalité, utiliser une API comme OSRM
    const R = 6371; // Rayon de la Terre en km
    
    const lat1 = pickup.location.coordinates[1] * Math.PI / 180;
    const lat2 = dropoff.location.coordinates[1] * Math.PI / 180;
    const dLat = (dropoff.location.coordinates[1] - pickup.location.coordinates[1]) * Math.PI / 180;
    const dLon = (dropoff.location.coordinates[0] - pickup.location.coordinates[0]) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    const distance = R * c * 1000; // Distance en mètres
    const duration = (distance / 1000) * 3 * 60; // ~20km/h en ville = 3 min/km
    
    // Calcul du tarif
    const pricing = config.pricing;
    const distanceKm = distance / 1000;
    const durationMin = duration / 60;
    
    let fare = pricing.baseFare[vehicleType] +
               (distanceKm * pricing.perKm[vehicleType]) +
               (durationMin * pricing.perMinute[vehicleType]);
    
    fare = Math.max(fare, pricing.minimumFare[vehicleType]);
    fare = Math.round(fare / 100) * 100; // Arrondir aux 100 FCFA
    
    return {
        distance: Math.round(distance),
        duration: Math.round(duration),
        fare
    };
}

module.exports = exports;
