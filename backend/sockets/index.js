// ========================================
// DIGIY DRIVER - Socket.IO Handler
// ========================================

const jwt = require('jsonwebtoken');
const config = require('../config/config');
const Driver = require('../models/Driver');
const Client = require('../models/Client');

module.exports = (io) => {
    // Middleware d'authentification Socket.IO
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.query.token;
            
            if (!token) {
                return next(new Error('Authentication error'));
            }
            
            const decoded = jwt.verify(token, config.jwt.secret);
            socket.userId = decoded.id;
            socket.userType = decoded.type || 'admin';
            
            next();
        } catch (error) {
            next(new Error('Authentication error'));
        }
    });
    
    io.on('connection', async (socket) => {
        console.log(`🔌 Nouvelle connexion Socket: ${socket.id} (${socket.userType})`);
        
        // Rejoindre une room personnelle basée sur le type d'utilisateur
        if (socket.userType === 'driver') {
            socket.join(`driver_${socket.userId}`);
            socket.join('drivers'); // Room globale des chauffeurs
            
            // Mettre à jour le statut en ligne
            try {
                await Driver.findByIdAndUpdate(socket.userId, {
                    isOnline: true,
                    lastActivity: new Date()
                });
                
                // Notifier les admins
                io.to('admins').emit('driver:connected', {
                    driverId: socket.userId
                });
            } catch (error) {
                console.error('Erreur mise à jour chauffeur:', error);
            }
        } else if (socket.userType === 'client') {
            socket.join(`client_${socket.userId}`);
            socket.join('clients');
        } else {
            socket.join(`admin_${socket.userId}`);
            socket.join('admins');
        }
        
        // ==========================================
        // ÉVÉNEMENTS CHAUFFEUR
        // ==========================================
        
        // Mise à jour de la position du chauffeur
        socket.on('driver:location', async (data) => {
            try {
                const { longitude, latitude } = data;
                
                await Driver.findByIdAndUpdate(socket.userId, {
                    'location.coordinates': [longitude, latitude],
                    'location.lastUpdated': new Date(),
                    lastActivity: new Date()
                });
                
                // Diffuser aux admins et aux clients concernés
                io.to('admins').emit('driver:location:update', {
                    driverId: socket.userId,
                    location: { coordinates: [longitude, latitude] },
                    timestamp: new Date()
                });
                
                // Si le chauffeur est en course, notifier le client
                const driver = await Driver.findById(socket.userId);
                if (driver && driver.currentRide) {
                    const Ride = require('../models/Ride');
                    const ride = await Ride.findById(driver.currentRide);
                    if (ride) {
                        io.to(`client_${ride.client}`).emit('driver:location:update', {
                            driverId: socket.userId,
                            location: { coordinates: [longitude, latitude] },
                            rideId: ride._id
                        });
                    }
                }
            } catch (error) {
                console.error('Erreur mise à jour position:', error);
            }
        });
        
        // Changement de statut en ligne/hors ligne
        socket.on('driver:status', async (data) => {
            try {
                const { isOnline } = data;
                
                await Driver.findByIdAndUpdate(socket.userId, {
                    isOnline,
                    lastActivity: new Date()
                });
                
                io.to('admins').emit('driver:status:update', {
                    driverId: socket.userId,
                    isOnline
                });
            } catch (error) {
                console.error('Erreur changement statut:', error);
            }
        });
        
        // ==========================================
        // ÉVÉNEMENTS CLIENT
        // ==========================================
        
        // Client demande les chauffeurs à proximité
        socket.on('client:nearby', async (data) => {
            try {
                const { longitude, latitude, vehicleType } = data;
                
                const drivers = await Driver.findNearby(
                    longitude,
                    latitude,
                    5000,
                    vehicleType
                );
                
                socket.emit('nearby:drivers', {
                    count: drivers.length,
                    drivers: drivers.map(d => ({
                        id: d._id,
                        name: `${d.firstName} ${d.lastName.charAt(0)}.`,
                        vehicle: d.vehicle,
                        rating: d.stats.averageRating,
                        location: d.location
                    }))
                });
            } catch (error) {
                console.error('Erreur recherche chauffeurs:', error);
            }
        });
        
        // ==========================================
        // ÉVÉNEMENTS COURSE
        // ==========================================
        
        // Nouvelle demande de course (émis par le serveur aux chauffeurs)
        socket.on('ride:request', async (data) => {
            // Cette logique est gérée côté serveur dans le contrôleur
        });
        
        // Chauffeur accepte une course
        socket.on('ride:accept', async (data) => {
            try {
                const { rideId } = data;
                const Ride = require('../models/Ride');
                
                const ride = await Ride.findById(rideId);
                if (!ride || ride.status !== 'pending') {
                    socket.emit('ride:error', { message: 'Course non disponible' });
                    return;
                }
                
                // Mettre à jour la course
                ride.driver = socket.userId;
                ride.status = 'accepted';
                ride.timestamps.accepted = new Date();
                await ride.save();
                
                // Mettre à jour le chauffeur
                await Driver.findByIdAndUpdate(socket.userId, {
                    isBusy: true,
                    currentRide: ride._id
                });
                
                // Notifier le client
                const driver = await Driver.findById(socket.userId);
                io.to(`client_${ride.client}`).emit('ride:accepted', {
                    rideId: ride._id,
                    driver: {
                        id: driver._id,
                        name: `${driver.firstName} ${driver.lastName}`,
                        phone: driver.phone,
                        vehicle: driver.vehicle,
                        rating: driver.stats.averageRating,
                        location: driver.location
                    }
                });
                
                // Notifier les admins
                io.to('admins').emit('ride:status:update', {
                    rideId: ride._id,
                    status: 'accepted',
                    driverId: socket.userId
                });
                
                socket.emit('ride:accepted:confirm', { rideId: ride._id });
            } catch (error) {
                console.error('Erreur acceptation course:', error);
                socket.emit('ride:error', { message: 'Erreur lors de l\'acceptation' });
            }
        });
        
        // Mise à jour du statut de la course
        socket.on('ride:status:update', async (data) => {
            try {
                const { rideId, status } = data;
                const Ride = require('../models/Ride');
                
                const ride = await Ride.findById(rideId);
                if (!ride) return;
                
                ride.status = status;
                ride.timestamps[status] = new Date();
                await ride.save();
                
                // Notifier le client
                io.to(`client_${ride.client}`).emit('ride:status:update', {
                    rideId,
                    status
                });
                
                // Notifier les admins
                io.to('admins').emit('ride:status:update', {
                    rideId,
                    status,
                    driverId: ride.driver
                });
            } catch (error) {
                console.error('Erreur mise à jour statut course:', error);
            }
        });
        
        // ==========================================
        // CHAT EN TEMPS RÉEL
        // ==========================================
        
        socket.on('chat:message', async (data) => {
            const { rideId, message, to } = data;
            
            // Envoyer le message au destinataire
            if (socket.userType === 'driver') {
                io.to(`client_${to}`).emit('chat:message', {
                    rideId,
                    from: 'driver',
                    fromId: socket.userId,
                    message,
                    timestamp: new Date()
                });
            } else if (socket.userType === 'client') {
                io.to(`driver_${to}`).emit('chat:message', {
                    rideId,
                    from: 'client',
                    fromId: socket.userId,
                    message,
                    timestamp: new Date()
                });
            }
        });
        
        // ==========================================
        // DÉCONNEXION
        // ==========================================
        
        socket.on('disconnect', async () => {
            console.log(`🔌 Déconnexion Socket: ${socket.id}`);
            
            if (socket.userType === 'driver') {
                try {
                    // Ne pas mettre hors ligne immédiatement (l'app peut se reconnecter)
                    // Utiliser un délai ou laisser l'app gérer
                    await Driver.findByIdAndUpdate(socket.userId, {
                        lastActivity: new Date()
                    });
                    
                    io.to('admins').emit('driver:disconnected', {
                        driverId: socket.userId
                    });
                } catch (error) {
                    console.error('Erreur déconnexion chauffeur:', error);
                }
            }
        });
        
        // Ping/Pong pour maintenir la connexion
        socket.on('ping', () => {
            socket.emit('pong');
        });
    });
    
    return io;
};
