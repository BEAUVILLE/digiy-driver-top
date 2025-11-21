const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const Driver = require('../models/Driver');
const User = require('../models/User');

let io;

const initSocket = (server) => {
    io = socketIO(server, {
        cors: {
            origin: process.env.SOCKET_CORS_ORIGIN || '*',
            methods: ['GET', 'POST'],
            credentials: true
        }
    });
    
    // Middleware d'authentification Socket
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.query.token;
            
            if (!token) {
                return next(new Error('Authentification requise'));
            }
            
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Trouver l'utilisateur
            if (decoded.role === 'driver') {
                socket.user = await Driver.findById(decoded.id);
                socket.userType = 'driver';
            } else {
                socket.user = await User.findById(decoded.id);
                socket.userType = decoded.role;
            }
            
            if (!socket.user) {
                return next(new Error('Utilisateur non trouvé'));
            }
            
            next();
        } catch (error) {
            next(new Error('Token invalide'));
        }
    });
    
    io.on('connection', (socket) => {
        console.log(`✅ Socket connecté: ${socket.user.name} (${socket.userType})`);
        
        // Rejoindre une room personnelle
        if (socket.userType === 'driver') {
            socket.join(`driver_${socket.user._id}`);
            
            // Mettre le chauffeur en ligne
            Driver.findByIdAndUpdate(socket.user._id, { 
                status: 'online',
                lastLocationUpdate: new Date()
            }).exec();
            
        } else if (socket.userType === 'client') {
            socket.join(`client_${socket.user._id}`);
            
        } else if (socket.userType === 'admin') {
            socket.join('admin_room');
        }
        
        // ===== ÉVÉNEMENTS CHAUFFEUR =====
        
        // Mise à jour de la position
        socket.on('update_location', async (data) => {
            if (socket.userType !== 'driver') return;
            
            const { lng, lat } = data;
            
            await socket.user.updateLocation(lng, lat);
            
            // Notifier les admins
            io.to('admin_room').emit('driver_location_updated', {
                driverId: socket.user._id,
                name: socket.user.name,
                location: [lng, lat],
                status: socket.user.status
            });
            
            // Si en course, notifier le client
            if (socket.user.currentRide) {
                const Ride = require('../models/Ride');
                const ride = await Ride.findById(socket.user.currentRide);
                if (ride) {
                    io.to(`client_${ride.client}`).emit('driver_location_updated', {
                        location: [lng, lat]
                    });
                }
            }
        });
        
        // Changement de statut (en ligne / hors ligne)
        socket.on('toggle_status', async (data) => {
            if (socket.userType !== 'driver') return;
            
            const { status } = data; // 'online' ou 'offline'
            
            if (socket.user.currentRide && status === 'offline') {
                socket.emit('error', { message: 'Impossible de passer hors ligne pendant une course' });
                return;
            }
            
            socket.user.status = status;
            await socket.user.save({ validateBeforeSave: false });
            
            io.to('admin_room').emit('driver_status_changed', {
                driverId: socket.user._id,
                status: status
            });
            
            socket.emit('status_updated', { status });
        });
        
        // Accepter une course
        socket.on('accept_ride', async (data) => {
            if (socket.userType !== 'driver') return;
            
            const { rideId } = data;
            const Ride = require('../models/Ride');
            
            const ride = await Ride.findById(rideId);
            
            if (!ride || ride.status !== 'pending') {
                socket.emit('error', { message: 'Course non disponible' });
                return;
            }
            
            // Mettre à jour la course
            ride.driver = socket.user._id;
            await ride.updateStatus('accepted');
            
            // Mettre à jour le chauffeur
            socket.user.status = 'busy';
            socket.user.currentRide = ride._id;
            await socket.user.save({ validateBeforeSave: false });
            
            // Notifier le client
            io.to(`client_${ride.client}`).emit('ride_accepted', {
                ride,
                driver: {
                    id: socket.user._id,
                    name: socket.user.name,
                    phone: socket.user.phone,
                    vehicle: socket.user.vehicle,
                    rating: socket.user.rating,
                    location: socket.user.currentLocation.coordinates
                }
            });
            
            // Confirmer au chauffeur
            socket.emit('ride_accepted_confirmed', { ride });
            
            // Notifier les admins
            io.to('admin_room').emit('ride_status_changed', {
                rideId: ride._id,
                status: 'accepted',
                driverId: socket.user._id
            });
        });
        
        // Refuser une course
        socket.on('reject_ride', async (data) => {
            if (socket.userType !== 'driver') return;
            // Simplement ignorer - la course reste disponible pour d'autres chauffeurs
            socket.emit('ride_rejected', { rideId: data.rideId });
        });
        
        // ===== ÉVÉNEMENTS CLIENT =====
        
        // Demander une course
        socket.on('request_ride', async (data) => {
            if (socket.userType !== 'client') return;
            
            const Ride = require('../models/Ride');
            
            const {
                pickupAddress, pickupLng, pickupLat,
                dropoffAddress, dropoffLng, dropoffLat,
                vehicleType, estimatedDistance, estimatedDuration
            } = data;
            
            const estimatedPrice = Ride.calculatePrice(estimatedDistance, vehicleType);
            
            const ride = await Ride.create({
                client: socket.user._id,
                pickup: {
                    address: pickupAddress,
                    location: { type: 'Point', coordinates: [pickupLng, pickupLat] }
                },
                dropoff: {
                    address: dropoffAddress,
                    location: { type: 'Point', coordinates: [dropoffLng, dropoffLat] }
                },
                vehicleType,
                estimatedDistance,
                estimatedDuration,
                estimatedPrice
            });
            
            // Trouver les chauffeurs proches
            const nearbyDrivers = await Driver.findNearbyDrivers(
                pickupLng, pickupLat, 5000, vehicleType
            );
            
            // Notifier les chauffeurs
            nearbyDrivers.forEach(driver => {
                io.to(`driver_${driver._id}`).emit('new_ride_request', {
                    ride,
                    pickup: { address: pickupAddress, location: [pickupLng, pickupLat] },
                    dropoff: { address: dropoffAddress, location: [dropoffLng, dropoffLat] },
                    estimatedPrice,
                    estimatedDistance,
                    estimatedDuration
                });
            });
            
            // Confirmer au client
            socket.emit('ride_requested', {
                ride,
                nearbyDrivers: nearbyDrivers.length
            });
        });
        
        // Annuler une course
        socket.on('cancel_ride', async (data) => {
            const { rideId, reason } = data;
            const Ride = require('../models/Ride');
            
            const ride = await Ride.findById(rideId);
            if (!ride) return;
            
            const cancelledBy = socket.userType;
            await ride.updateStatus('cancelled', { cancelledBy, reason });
            
            // Libérer le chauffeur
            if (ride.driver) {
                await Driver.findByIdAndUpdate(ride.driver, {
                    status: 'online',
                    currentRide: null
                });
                
                io.to(`driver_${ride.driver}`).emit('ride_cancelled', {
                    rideId, cancelledBy, reason
                });
            }
            
            io.to(`client_${ride.client}`).emit('ride_cancelled', {
                rideId, cancelledBy, reason
            });
        });
        
        // ===== DÉCONNEXION =====
        
        socket.on('disconnect', async () => {
            console.log(`❌ Socket déconnecté: ${socket.user.name}`);
            
            // Si c'est un chauffeur sans course en cours, le passer hors ligne
            if (socket.userType === 'driver' && !socket.user.currentRide) {
                await Driver.findByIdAndUpdate(socket.user._id, { status: 'offline' });
                
                io.to('admin_room').emit('driver_status_changed', {
                    driverId: socket.user._id,
                    status: 'offline'
                });
            }
        });
    });
    
    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.IO non initialisé');
    }
    return io;
};

module.exports = { initSocket, getIO };
