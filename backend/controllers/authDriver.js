// ========================================
// DIGIY DRIVER - Contrôleur Auth Chauffeur
// ========================================

const Driver = require('../models/Driver');
const config = require('../config/config');
const { asyncHandler, ErrorResponse } = require('../middleware/error');

// @desc    Inscription chauffeur
// @route   POST /api/v1/auth/driver/register
// @access  Public
exports.register = asyncHandler(async (req, res, next) => {
    const {
        firstName,
        lastName,
        email,
        phone,
        password,
        dateOfBirth,
        vehicle
    } = req.body;
    
    // Vérifier si le chauffeur existe déjà
    const existingDriver = await Driver.findOne({
        $or: [{ email }, { phone }]
    });
    
    if (existingDriver) {
        return next(new ErrorResponse('Un compte avec cet email ou téléphone existe déjà', 400));
    }
    
    // Créer le chauffeur
    const driver = await Driver.create({
        firstName,
        lastName,
        email,
        phone,
        password,
        dateOfBirth,
        vehicle,
        status: 'pending' // En attente de validation
    });
    
    res.status(201).json({
        success: true,
        message: 'Inscription réussie. Votre compte est en attente de validation.',
        data: {
            id: driver._id,
            name: driver.fullName,
            email: driver.email,
            status: driver.status
        }
    });
});

// @desc    Connexion chauffeur
// @route   POST /api/v1/auth/driver/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
    const { phone, password } = req.body;
    
    // Valider les champs
    if (!phone || !password) {
        return next(new ErrorResponse('Veuillez fournir un téléphone et un mot de passe', 400));
    }
    
    // Chercher le chauffeur
    const driver = await Driver.findOne({ phone }).select('+password');
    
    if (!driver) {
        return next(new ErrorResponse('Identifiants invalides', 401));
    }
    
    // Vérifier le statut
    if (driver.status === 'pending') {
        return next(new ErrorResponse('Votre compte est en attente de validation', 403));
    }
    
    if (driver.status === 'suspended') {
        return next(new ErrorResponse('Votre compte est suspendu', 403));
    }
    
    if (driver.status === 'inactive') {
        return next(new ErrorResponse('Votre compte est désactivé', 403));
    }
    
    // Vérifier le mot de passe
    const isMatch = await driver.matchPassword(password);
    
    if (!isMatch) {
        return next(new ErrorResponse('Identifiants invalides', 401));
    }
    
    // Mettre à jour la dernière connexion
    driver.lastLogin = new Date();
    await driver.save({ validateBeforeSave: false });
    
    // Envoyer le token
    sendTokenResponse(driver, 200, res);
});

// @desc    Obtenir le chauffeur connecté
// @route   GET /api/v1/auth/driver/me
// @access  Private (Driver)
exports.getMe = asyncHandler(async (req, res, next) => {
    const driver = await Driver.findById(req.user.id);
    
    res.status(200).json({
        success: true,
        data: driver
    });
});

// @desc    Mettre à jour le profil
// @route   PUT /api/v1/auth/driver/profile
// @access  Private (Driver)
exports.updateProfile = asyncHandler(async (req, res, next) => {
    const fieldsToUpdate = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        address: req.body.address,
        preferences: req.body.preferences
    };
    
    // Supprimer les champs undefined
    Object.keys(fieldsToUpdate).forEach(key => 
        fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
    );
    
    const driver = await Driver.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
        new: true,
        runValidators: true
    });
    
    res.status(200).json({
        success: true,
        data: driver
    });
});

// @desc    Passer en ligne / hors ligne
// @route   PUT /api/v1/auth/driver/toggle-online
// @access  Private (Driver)
exports.toggleOnline = asyncHandler(async (req, res, next) => {
    const driver = await Driver.findById(req.user.id);
    
    driver.isOnline = !driver.isOnline;
    driver.lastActivity = new Date();
    
    if (!driver.isOnline) {
        driver.isBusy = false;
    }
    
    await driver.save({ validateBeforeSave: false });
    
    // Émettre l'événement Socket.IO
    const io = req.app.get('io');
    if (io) {
        io.emit('driver:status', {
            driverId: driver._id,
            isOnline: driver.isOnline,
            location: driver.location
        });
    }
    
    res.status(200).json({
        success: true,
        data: {
            isOnline: driver.isOnline,
            isBusy: driver.isBusy
        }
    });
});

// @desc    Mettre à jour la position
// @route   PUT /api/v1/auth/driver/location
// @access  Private (Driver)
exports.updateLocation = asyncHandler(async (req, res, next) => {
    const { longitude, latitude } = req.body;
    
    if (!longitude || !latitude) {
        return next(new ErrorResponse('Coordonnées requises', 400));
    }
    
    await req.user.updateLocation(longitude, latitude);
    
    // Émettre l'événement Socket.IO
    const io = req.app.get('io');
    if (io) {
        io.emit('driver:location', {
            driverId: req.user._id,
            location: {
                coordinates: [longitude, latitude]
            }
        });
    }
    
    res.status(200).json({
        success: true,
        message: 'Position mise à jour'
    });
});

// @desc    Obtenir les statistiques du chauffeur
// @route   GET /api/v1/auth/driver/stats
// @access  Private (Driver)
exports.getStats = asyncHandler(async (req, res, next) => {
    const driver = await Driver.findById(req.user.id).select('stats wallet');
    
    res.status(200).json({
        success: true,
        data: {
            stats: driver.stats,
            wallet: driver.wallet
        }
    });
});

// Helper: Envoyer le token dans la réponse
const sendTokenResponse = (driver, statusCode, res) => {
    const token = driver.getSignedJwtToken();
    
    const options = {
        expires: new Date(Date.now() + config.jwt.cookieExpire * 24 * 60 * 60 * 1000),
        httpOnly: true
    };
    
    if (config.env === 'production') {
        options.secure = true;
    }
    
    res
        .status(statusCode)
        .cookie('token', token, options)
        .json({
            success: true,
            token,
            driver: {
                id: driver._id,
                name: driver.fullName,
                phone: driver.phone,
                vehicle: driver.vehicle,
                stats: driver.stats,
                isOnline: driver.isOnline
            }
        });
};
