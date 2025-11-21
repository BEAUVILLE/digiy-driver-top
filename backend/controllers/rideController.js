const Ride = require('../models/Ride');
const Driver = require('../models/Driver');
const User = require('../models/User');

// @desc    Créer une nouvelle demande de course
// @route   POST /api/rides
// @access  Private (Client)
exports.createRide = async (req, res, next) => {
    try {
        const {
            pickupAddress, pickupLat, pickupLng, pickupDetails,
            dropoffAddress, dropoffLat, dropoffLng, dropoffDetails,
            vehicleType, estimatedDistance, estimatedDuration
        } = req.body;
        
        // Calculer le prix estimé
        const estimatedPrice = Ride.calculatePrice(estimatedDistance, vehicleType);
        
        // Créer la course
        const ride = await Ride.create({
            client: req.user._id,
            pickup: {
                address: pickupAddress,
                location: {
                    type: 'Point',
                    coordinates: [pickupLng, pickupLat]
                },
                details: pickupDetails
            },
            dropoff: {
                address: dropoffAddress,
                location: {
                    type: 'Point',
                    coordinates: [dropoffLng, dropoffLat]
                },
                details: dropoffDetails
            },
            vehicleType,
            estimatedDistance,
            estimatedDuration,
            estimatedPrice
        });
        
        // Trouver les chauffeurs à proximité
        const nearbyDrivers = await Driver.findNearbyDrivers(
            pickupLng, 
            pickupLat, 
            5000, // 5km
            vehicleType
        );
        
        res.status(201).json({
            success: true,
            data: ride,
            nearbyDrivers: nearbyDrivers.length,
            message: `${nearbyDrivers.length} chauffeur(s) disponible(s) à proximité`
        });
        
        // Émettre l'événement Socket.IO aux chauffeurs proches
        if (req.io) {
            nearbyDrivers.forEach(driver => {
                req.io.to(`driver_${driver._id}`).emit('new_ride_request', {
                    ride: ride,
                    distance: estimatedDistance,
                    price: estimatedPrice
                });
            });
        }
        
    } catch (error) {
        next(error);
    }
};

// @desc    Obtenir toutes les courses (Admin)
// @route   GET /api/rides
// @access  Private (Admin)
exports.getAllRides = async (req, res, next) => {
    try {
        const { status, page = 1, limit = 20, sort = '-createdAt' } = req.query;
        
        const query = {};
        if (status) query.status = status;
        
        const rides = await Ride.find(query)
            .populate('client', 'name phone')
            .populate('driver', 'name phone vehicle')
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
        
        const total = await Ride.countDocuments(query);
        
        res.status(200).json({
            success: true,
            count: rides.length,
            total,
            pages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            data: rides
        });
        
    } catch (error) {
        next(error);
    }
};

// @desc    Obtenir les courses du client connecté
// @route   GET /api/rides/my-rides
// @access  Private (Client)
exports.getMyRides = async (req, res, next) => {
    try {
        const rides = await Ride.find({ client: req.user._id })
            .populate('driver', 'name phone vehicle rating')
            .sort('-createdAt');
        
        res.status(200).json({
            success: true,
            count: rides.length,
            data: rides
        });
        
    } catch (error) {
        next(error);
    }
};

// @desc    Obtenir les courses du chauffeur connecté
// @route   GET /api/rides/driver-rides
// @access  Private (Driver)
exports.getDriverRides = async (req, res, next) => {
    try {
        const { status } = req.query;
        
        const query = { driver: req.user._id };
        if (status) query.status = status;
        
        const rides = await Ride.find(query)
            .populate('client', 'name phone rating')
            .sort('-createdAt');
        
        res.status(200).json({
            success: true,
            count: rides.length,
            data: rides
        });
        
    } catch (error) {
        next(error);
    }
};

// @desc    Obtenir une course par ID
// @route   GET /api/rides/:id
// @access  Private
exports.getRide = async (req, res, next) => {
    try {
        const ride = await Ride.findById(req.params.id)
            .populate('client', 'name phone rating')
            .populate('driver', 'name phone vehicle rating currentLocation');
        
        if (!ride) {
            return res.status(404).json({
                success: false,
                error: 'Course non trouvée'
            });
        }
        
        res.status(200).json({
            success: true,
            data: ride
        });
        
    } catch (error) {
        next(error);
    }
};

// @desc    Accepter une course (Chauffeur)
// @route   PUT /api/rides/:id/accept
// @access  Private (Driver)
exports.acceptRide = async (req, res, next) => {
    try {
        const ride = await Ride.findById(req.params.id);
        
        if (!ride) {
            return res.status(404).json({
                success: false,
                error: 'Course non trouvée'
            });
        }
        
        if (ride.status !== 'pending') {
            return res.status(400).json({
                success: false,
                error: 'Cette course n\'est plus disponible'
            });
        }
        
        // Vérifier si le chauffeur n'a pas déjà une course en cours
        if (req.user.currentRide) {
            return res.status(400).json({
                success: false,
                error: 'Vous avez déjà une course en cours'
            });
        }
        
        // Mettre à jour la course
        ride.driver = req.user._id;
        await ride.updateStatus('accepted');
        
        // Mettre à jour le chauffeur
        req.user.status = 'busy';
        req.user.currentRide = ride._id;
        await req.user.save({ validateBeforeSave: false });
        
        // Notifier le client via Socket.IO
        if (req.io) {
            req.io.to(`client_${ride.client}`).emit('ride_accepted', {
                ride: ride,
                driver: {
                    id: req.user._id,
                    name: req.user.name,
                    phone: req.user.phone,
                    vehicle: req.user.vehicle,
                    rating: req.user.rating,
                    location: req.user.currentLocation
                }
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Course acceptée',
            data: ride
        });
        
    } catch (error) {
        next(error);
    }
};

// @desc    Mettre à jour le statut d'une course
// @route   PUT /api/rides/:id/status
// @access  Private (Driver)
exports.updateRideStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const ride = await Ride.findById(req.params.id);
        
        if (!ride) {
            return res.status(404).json({
                success: false,
                error: 'Course non trouvée'
            });
        }
        
        // Vérifier que c'est bien le chauffeur de cette course
        if (ride.driver.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                error: 'Vous n\'êtes pas autorisé à modifier cette course'
            });
        }
        
        // Valider les transitions de statut
        const validTransitions = {
            'accepted': ['arrived', 'cancelled'],
            'arrived': ['in_progress', 'cancelled'],
            'in_progress': ['completed', 'cancelled']
        };
        
        if (!validTransitions[ride.status] || !validTransitions[ride.status].includes(status)) {
            return res.status(400).json({
                success: false,
                error: `Transition de ${ride.status} vers ${status} non autorisée`
            });
        }
        
        await ride.updateStatus(status, req.body);
        
        // Si course terminée
        if (status === 'completed') {
            // Mettre à jour les stats du chauffeur
            req.user.totalRides += 1;
            req.user.totalEarnings += ride.finalPrice || ride.estimatedPrice;
            req.user.status = 'online';
            req.user.currentRide = null;
            await req.user.save({ validateBeforeSave: false });
            
            // Mettre à jour les stats du client
            await User.findByIdAndUpdate(ride.client, {
                $inc: { totalRides: 1 }
            });
        }
        
        // Notifier via Socket.IO
        if (req.io) {
            req.io.to(`client_${ride.client}`).emit('ride_status_updated', {
                rideId: ride._id,
                status: status,
                ride: ride
            });
        }
        
        res.status(200).json({
            success: true,
            message: `Statut mis à jour: ${status}`,
            data: ride
        });
        
    } catch (error) {
        next(error);
    }
};

// @desc    Annuler une course
// @route   PUT /api/rides/:id/cancel
// @access  Private
exports.cancelRide = async (req, res, next) => {
    try {
        const { reason } = req.body;
        const ride = await Ride.findById(req.params.id);
        
        if (!ride) {
            return res.status(404).json({
                success: false,
                error: 'Course non trouvée'
            });
        }
        
        // Vérifier que l'utilisateur est autorisé à annuler
        const isClient = ride.client.toString() === req.user._id.toString();
        const isDriver = ride.driver && ride.driver.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';
        
        if (!isClient && !isDriver && !isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Vous n\'êtes pas autorisé à annuler cette course'
            });
        }
        
        // Vérifier si la course peut être annulée
        if (['completed', 'cancelled'].includes(ride.status)) {
            return res.status(400).json({
                success: false,
                error: 'Cette course ne peut pas être annulée'
            });
        }
        
        // Déterminer qui annule
        let cancelledBy = 'client';
        if (isDriver) cancelledBy = 'driver';
        if (isAdmin) cancelledBy = 'system';
        
        await ride.updateStatus('cancelled', { cancelledBy, reason });
        
        // Libérer le chauffeur si assigné
        if (ride.driver) {
            await Driver.findByIdAndUpdate(ride.driver, {
                status: 'online',
                currentRide: null
            });
        }
        
        // Notifier via Socket.IO
        if (req.io) {
            if (ride.driver) {
                req.io.to(`driver_${ride.driver}`).emit('ride_cancelled', {
                    rideId: ride._id,
                    cancelledBy,
                    reason
                });
            }
            req.io.to(`client_${ride.client}`).emit('ride_cancelled', {
                rideId: ride._id,
                cancelledBy,
                reason
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Course annulée',
            data: ride
        });
        
    } catch (error) {
        next(error);
    }
};

// @desc    Noter une course
// @route   PUT /api/rides/:id/rate
// @access  Private
exports.rateRide = async (req, res, next) => {
    try {
        const { score, comment } = req.body;
        const ride = await Ride.findById(req.params.id);
        
        if (!ride) {
            return res.status(404).json({
                success: false,
                error: 'Course non trouvée'
            });
        }
        
        if (ride.status !== 'completed') {
            return res.status(400).json({
                success: false,
                error: 'Vous ne pouvez noter que les courses terminées'
            });
        }
        
        const isClient = ride.client.toString() === req.user._id.toString();
        const isDriver = ride.driver && ride.driver.toString() === req.user._id.toString();
        
        if (isClient) {
            // Client note le chauffeur
            ride.ratings.driverRating = {
                score,
                comment,
                ratedAt: new Date()
            };
            
            // Mettre à jour la note moyenne du chauffeur
            const driver = await Driver.findById(ride.driver);
            const newRating = ((driver.rating * driver.totalRatings) + score) / (driver.totalRatings + 1);
            driver.rating = Math.round(newRating * 10) / 10;
            driver.totalRatings += 1;
            await driver.save({ validateBeforeSave: false });
            
        } else if (isDriver) {
            // Chauffeur note le client
            ride.ratings.clientRating = {
                score,
                comment,
                ratedAt: new Date()
            };
            
            // Mettre à jour la note moyenne du client
            const client = await User.findById(ride.client);
            const totalRatings = client.totalRides || 1;
            const newRating = ((client.rating * (totalRatings - 1)) + score) / totalRatings;
            client.rating = Math.round(newRating * 10) / 10;
            await client.save({ validateBeforeSave: false });
            
        } else {
            return res.status(403).json({
                success: false,
                error: 'Vous n\'êtes pas autorisé à noter cette course'
            });
        }
        
        await ride.save();
        
        res.status(200).json({
            success: true,
            message: 'Note enregistrée',
            data: ride
        });
        
    } catch (error) {
        next(error);
    }
};

// @desc    Obtenir les statistiques des courses (Admin)
// @route   GET /api/rides/stats
// @access  Private (Admin)
exports.getRideStats = async (req, res, next) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const stats = await Ride.aggregate([
            {
                $facet: {
                    // Stats globales
                    total: [{ $count: 'count' }],
                    
                    // Par statut
                    byStatus: [
                        { $group: { _id: '$status', count: { $sum: 1 } } }
                    ],
                    
                    // Aujourd'hui
                    today: [
                        { $match: { createdAt: { $gte: today } } },
                        {
                            $group: {
                                _id: null,
                                count: { $sum: 1 },
                                revenue: {
                                    $sum: {
                                        $cond: [
                                            { $eq: ['$status', 'completed'] },
                                            { $ifNull: ['$finalPrice', '$estimatedPrice'] },
                                            0
                                        ]
                                    }
                                }
                            }
                        }
                    ],
                    
                    // Cette semaine
                    thisWeek: [
                        {
                            $match: {
                                createdAt: {
                                    $gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
                                }
                            }
                        },
                        {
                            $group: {
                                _id: { $dayOfWeek: '$createdAt' },
                                count: { $sum: 1 },
                                revenue: {
                                    $sum: {
                                        $cond: [
                                            { $eq: ['$status', 'completed'] },
                                            { $ifNull: ['$finalPrice', '$estimatedPrice'] },
                                            0
                                        ]
                                    }
                                }
                            }
                        },
                        { $sort: { _id: 1 } }
                    ],
                    
                    // Revenus totaux
                    totalRevenue: [
                        { $match: { status: 'completed' } },
                        {
                            $group: {
                                _id: null,
                                total: { $sum: { $ifNull: ['$finalPrice', '$estimatedPrice'] } }
                            }
                        }
                    ]
                }
            }
        ]);
        
        res.status(200).json({
            success: true,
            data: {
                total: stats[0].total[0]?.count || 0,
                byStatus: stats[0].byStatus,
                today: stats[0].today[0] || { count: 0, revenue: 0 },
                thisWeek: stats[0].thisWeek,
                totalRevenue: stats[0].totalRevenue[0]?.total || 0
            }
        });
        
    } catch (error) {
        next(error);
    }
};
