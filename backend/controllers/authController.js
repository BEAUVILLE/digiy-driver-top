const User = require('../models/User');
const Driver = require('../models/Driver');
const { ErrorResponse } = require('../middleware/error');

// Helper pour envoyer le token dans la réponse
const sendTokenResponse = (user, statusCode, res, userType = 'user') => {
    const token = user.getSignedJwtToken();
    
    const options = {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    };
    
    // Mettre à jour la dernière connexion
    user.lastLogin = new Date();
    user.save({ validateBeforeSave: false });
    
    res.status(statusCode)
        .cookie('token', token, options)
        .json({
            success: true,
            token,
            userType,
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role || userType,
                avatar: user.avatar
            }
        });
};

// ==================== CLIENT/ADMIN AUTH ====================

// @desc    Inscription client
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
    try {
        const { name, email, phone, password } = req.body;
        
        // Vérifier si l'email existe déjà
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'Cet email est déjà utilisé'
            });
        }
        
        // Créer l'utilisateur
        const user = await User.create({
            name,
            email,
            phone,
            password,
            role: 'client'
        });
        
        sendTokenResponse(user, 201, res, 'client');
        
    } catch (error) {
        next(error);
    }
};

// @desc    Connexion client/admin
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        
        // Valider email & password
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Veuillez fournir un email et un mot de passe'
            });
        }
        
        // Trouver l'utilisateur avec le password
        const user = await User.findOne({ email }).select('+password');
        
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Identifiants invalides'
            });
        }
        
        // Vérifier le password
        const isMatch = await user.matchPassword(password);
        
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Identifiants invalides'
            });
        }
        
        // Vérifier si le compte est actif
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                error: 'Votre compte a été désactivé'
            });
        }
        
        sendTokenResponse(user, 200, res, user.role);
        
    } catch (error) {
        next(error);
    }
};

// @desc    Connexion admin uniquement
// @route   POST /api/auth/admin/login
// @access  Public
exports.adminLogin = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Veuillez fournir un email et un mot de passe'
            });
        }
        
        const user = await User.findOne({ email, role: 'admin' }).select('+password');
        
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Accès non autorisé'
            });
        }
        
        const isMatch = await user.matchPassword(password);
        
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Identifiants invalides'
            });
        }
        
        sendTokenResponse(user, 200, res, 'admin');
        
    } catch (error) {
        next(error);
    }
};

// ==================== DRIVER AUTH ====================

// @desc    Inscription chauffeur
// @route   POST /api/auth/driver/register
// @access  Public
exports.registerDriver = async (req, res, next) => {
    try {
        const {
            name, email, phone, password,
            vehicleType, vehicleBrand, vehicleModel,
            vehicleYear, vehicleColor, plateNumber
        } = req.body;
        
        // Vérifier si l'email existe déjà
        const existingDriver = await Driver.findOne({ email });
        if (existingDriver) {
            return res.status(400).json({
                success: false,
                error: 'Cet email est déjà utilisé'
            });
        }
        
        // Vérifier si la plaque existe déjà
        const existingPlate = await Driver.findOne({ 'vehicle.plateNumber': plateNumber });
        if (existingPlate) {
            return res.status(400).json({
                success: false,
                error: 'Cette plaque d\'immatriculation est déjà enregistrée'
            });
        }
        
        // Créer le chauffeur
        const driver = await Driver.create({
            name,
            email,
            phone,
            password,
            vehicle: {
                type: vehicleType || 'eco',
                brand: vehicleBrand,
                model: vehicleModel,
                year: vehicleYear,
                color: vehicleColor,
                plateNumber: plateNumber.toUpperCase()
            }
        });
        
        sendTokenResponse(driver, 201, res, 'driver');
        
    } catch (error) {
        next(error);
    }
};

// @desc    Connexion chauffeur
// @route   POST /api/auth/driver/login
// @access  Public
exports.loginDriver = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Veuillez fournir un email et un mot de passe'
            });
        }
        
        const driver = await Driver.findOne({ email }).select('+password');
        
        if (!driver) {
            return res.status(401).json({
                success: false,
                error: 'Identifiants invalides'
            });
        }
        
        const isMatch = await driver.matchPassword(password);
        
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Identifiants invalides'
            });
        }
        
        if (!driver.isActive) {
            return res.status(401).json({
                success: false,
                error: 'Votre compte a été désactivé'
            });
        }
        
        if (driver.isBanned) {
            return res.status(401).json({
                success: false,
                error: 'Votre compte a été suspendu',
                reason: driver.banReason
            });
        }
        
        sendTokenResponse(driver, 200, res, 'driver');
        
    } catch (error) {
        next(error);
    }
};

// ==================== COMMON ====================

// @desc    Déconnexion
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000), // Expire dans 10s
        httpOnly: true
    });
    
    res.status(200).json({
        success: true,
        message: 'Déconnexion réussie'
    });
};

// @desc    Obtenir l'utilisateur connecté
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
    try {
        res.status(200).json({
            success: true,
            data: req.user,
            userType: req.userType
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Changer le mot de passe
// @route   PUT /api/auth/password
// @access  Private
exports.updatePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        // Trouver l'utilisateur avec le password
        let user;
        if (req.userType === 'driver') {
            user = await Driver.findById(req.user._id).select('+password');
        } else {
            user = await User.findById(req.user._id).select('+password');
        }
        
        // Vérifier le mot de passe actuel
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Mot de passe actuel incorrect'
            });
        }
        
        // Mettre à jour le mot de passe
        user.password = newPassword;
        await user.save();
        
        sendTokenResponse(user, 200, res, req.userType);
        
    } catch (error) {
        next(error);
    }
};
