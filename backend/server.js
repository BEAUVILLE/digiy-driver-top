require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');
const { initSocket, getIO } = require('./config/socket');
const { errorHandler } = require('./middleware/error');

// Initialiser Express
const app = express();
const server = http.createServer(app);

// Connexion à la base de données
connectDB();

// Initialiser Socket.IO
const io = initSocket(server);

// ===== MIDDLEWARES DE SÉCURITÉ =====

// Helmet - Headers de sécurité
app.use(helmet());

// CORS
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000, // 15 min
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: {
        success: false,
        error: 'Trop de requêtes, veuillez réessayer plus tard'
    }
});
app.use('/api', limiter);

// Parser JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Ajouter io aux requêtes
app.use((req, res, next) => {
    req.io = io;
    next();
});

// ===== ROUTES =====

// Route de base
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: '🚗 DIGIY DRIVER API v1.0',
        description: 'VTC Sénégal - 0% Commission',
        endpoints: {
            auth: '/api/auth',
            drivers: '/api/drivers',
            rides: '/api/rides'
        },
        documentation: '/api/docs',
        health: '/api/health'
    });
});

// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV
    });
});

// Routes API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/drivers', require('./routes/drivers'));
app.use('/api/rides', require('./routes/rides'));

// Documentation API simple
app.get('/api/docs', (req, res) => {
    res.json({
        success: true,
        name: 'DIGIY DRIVER API',
        version: '1.0.0',
        description: 'API backend pour l\'application VTC DIGIY DRIVER',
        baseUrl: '/api',
        authentication: 'Bearer Token (JWT)',
        endpoints: {
            auth: {
                'POST /auth/register': 'Inscription client',
                'POST /auth/login': 'Connexion client/admin',
                'POST /auth/admin/login': 'Connexion admin uniquement',
                'POST /auth/driver/register': 'Inscription chauffeur',
                'POST /auth/driver/login': 'Connexion chauffeur',
                'POST /auth/logout': 'Déconnexion',
                'GET /auth/me': 'Profil utilisateur connecté',
                'PUT /auth/password': 'Changer mot de passe'
            },
            drivers: {
                'GET /drivers': '[Admin] Liste tous les chauffeurs',
                'GET /drivers/online': '[Admin] Chauffeurs en ligne',
                'GET /drivers/nearby?lng=&lat=': 'Chauffeurs à proximité',
                'GET /drivers/stats': '[Admin] Statistiques chauffeurs',
                'GET /drivers/:id': '[Admin] Détails chauffeur',
                'PUT /drivers/location': '[Chauffeur] Mettre à jour position',
                'PUT /drivers/status': '[Chauffeur] Changer statut en ligne/hors ligne',
                'PUT /drivers/profile': '[Chauffeur] Modifier profil',
                'PUT /drivers/:id/verify': '[Admin] Vérifier un chauffeur',
                'PUT /drivers/:id/ban': '[Admin] Bannir/débannir un chauffeur'
            },
            rides: {
                'POST /rides': '[Client] Créer une demande de course',
                'GET /rides': '[Admin] Liste toutes les courses',
                'GET /rides/my-rides': '[Client] Mes courses',
                'GET /rides/driver-rides': '[Chauffeur] Mes courses',
                'GET /rides/stats/overview': '[Admin] Statistiques courses',
                'GET /rides/:id': 'Détails d\'une course',
                'PUT /rides/:id/accept': '[Chauffeur] Accepter une course',
                'PUT /rides/:id/status': '[Chauffeur] Mettre à jour statut course',
                'PUT /rides/:id/cancel': 'Annuler une course',
                'PUT /rides/:id/rate': 'Noter une course'
            }
        },
        socketEvents: {
            client: {
                emit: ['request_ride', 'cancel_ride'],
                listen: ['ride_accepted', 'ride_cancelled', 'driver_location_updated', 'ride_status_updated']
            },
            driver: {
                emit: ['update_location', 'toggle_status', 'accept_ride', 'reject_ride'],
                listen: ['new_ride_request', 'ride_cancelled', 'status_updated']
            },
            admin: {
                listen: ['driver_location_updated', 'driver_status_changed', 'ride_status_changed']
            }
        }
    });
});

// Route 404
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        error: 'Route non trouvée'
    });
});

// Middleware de gestion des erreurs
app.use(errorHandler);

// ===== DÉMARRAGE DU SERVEUR =====

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log('\n========================================');
    console.log('🚗 DIGIY DRIVER API');
    console.log('========================================');
    console.log(`✅ Serveur démarré sur le port ${PORT}`);
    console.log(`📍 Environnement: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`📚 Documentation: http://localhost:${PORT}/api/docs`);
    console.log(`💓 Health Check: http://localhost:${PORT}/api/health`);
    console.log('========================================\n');
});

// Gestion des erreurs non capturées
process.on('unhandledRejection', (err, promise) => {
    console.error(`❌ Erreur non gérée: ${err.message}`);
    server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
    console.error(`❌ Exception non capturée: ${err.message}`);
    process.exit(1);
});

module.exports = { app, server };
