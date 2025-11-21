// ========================================
// DIGIY DRIVER - Configuration
// ========================================

require('dotenv').config();

module.exports = {
    // Environnement
    env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 5000,
    
    // MongoDB
    mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/digiy_driver',
    
    // JWT
    jwt: {
        secret: process.env.JWT_SECRET || 'digiy_secret_key_change_in_production',
        expire: process.env.JWT_EXPIRE || '30d',
        cookieExpire: parseInt(process.env.JWT_COOKIE_EXPIRE) || 30
    },
    
    // Admin par défaut
    admin: {
        email: process.env.ADMIN_EMAIL || 'admin@digiylyfe.com',
        password: process.env.ADMIN_PASSWORD || 'digiy2024',
        name: process.env.ADMIN_NAME || 'DIGIY Admin'
    },
    
    // Rate Limiting
    rateLimit: {
        windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000,
        max: parseInt(process.env.RATE_LIMIT_MAX) || 100
    },
    
    // CORS
    corsOrigins: process.env.CORS_ORIGINS 
        ? process.env.CORS_ORIGINS.split(',') 
        : ['http://localhost:3000', 'http://localhost:5173'],
    
    // Tarifs par défaut (FCFA)
    pricing: {
        baseFare: {
            eco: 500,
            confort: 800,
            premium: 1200,
            moto: 300
        },
        perKm: {
            eco: 200,
            confort: 300,
            premium: 450,
            moto: 150
        },
        perMinute: {
            eco: 50,
            confort: 75,
            premium: 100,
            moto: 40
        },
        minimumFare: {
            eco: 1000,
            confort: 1500,
            premium: 2500,
            moto: 500
        }
    },
    
    // Zones de service
    serviceAreas: {
        dakar: {
            name: 'Dakar',
            center: { lat: 14.6928, lng: -17.4467 },
            radius: 30 // km
        }
    }
};
