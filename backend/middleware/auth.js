const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Driver = require('../models/Driver');

// Protéger les routes - vérifier le token JWT
exports.protect = async (req, res, next) => {
    let token;
    
    // Vérifier le header Authorization
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    // Alternative: cookie
    else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }
    
    // Vérifier si le token existe
    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Accès non autorisé. Veuillez vous connecter.'
        });
    }
    
    try {
        // Décoder le token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Trouver l'utilisateur selon son rôle
        if (decoded.role === 'driver') {
            req.user = await Driver.findById(decoded.id);
            req.userType = 'driver';
        } else {
            req.user = await User.findById(decoded.id);
            req.userType = decoded.role;
        }
        
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }
        
        // Vérifier si le compte est actif
        if (!req.user.isActive) {
            return res.status(401).json({
                success: false,
                error: 'Votre compte a été désactivé'
            });
        }
        
        // Vérifier si le chauffeur est banni
        if (req.userType === 'driver' && req.user.isBanned) {
            return res.status(401).json({
                success: false,
                error: 'Votre compte chauffeur a été suspendu',
                reason: req.user.banReason
            });
        }
        
        next();
    } catch (error) {
        console.error('Erreur auth:', error.message);
        return res.status(401).json({
            success: false,
            error: 'Token invalide ou expiré'
        });
    }
};

// Restreindre l'accès à certains rôles
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.userType) && !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: `Le rôle ${req.userType || req.user.role} n'est pas autorisé à accéder à cette ressource`
            });
        }
        next();
    };
};

// Middleware pour vérifier si c'est un admin
exports.adminOnly = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Accès réservé aux administrateurs'
        });
    }
    next();
};

// Middleware pour vérifier si le chauffeur est vérifié
exports.verifiedDriverOnly = (req, res, next) => {
    if (req.userType !== 'driver') {
        return res.status(403).json({
            success: false,
            error: 'Accès réservé aux chauffeurs'
        });
    }
    
    if (!req.user.isVerified) {
        return res.status(403).json({
            success: false,
            error: 'Votre compte chauffeur n\'est pas encore vérifié'
        });
    }
    
    next();
};
