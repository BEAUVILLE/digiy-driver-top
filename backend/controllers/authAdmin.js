// ========================================
// DIGIY DRIVER - Contrôleur Auth Admin
// ========================================

const User = require('../models/User');
const config = require('../config/config');
const { asyncHandler, ErrorResponse } = require('../middleware/error');

// @desc    Connexion admin
// @route   POST /api/v1/auth/admin/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
    const { email, password } = req.body;
    
    // Valider les champs
    if (!email || !password) {
        return next(new ErrorResponse('Veuillez fournir un email et un mot de passe', 400));
    }
    
    // Chercher l'utilisateur
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
        return next(new ErrorResponse('Identifiants invalides', 401));
    }
    
    // Vérifier si le compte est actif
    if (!user.isActive) {
        return next(new ErrorResponse('Compte désactivé', 403));
    }
    
    // Vérifier le mot de passe
    const isMatch = await user.matchPassword(password);
    
    if (!isMatch) {
        return next(new ErrorResponse('Identifiants invalides', 401));
    }
    
    // Mettre à jour la dernière connexion
    await user.updateLastLogin();
    
    // Envoyer le token
    sendTokenResponse(user, 200, res);
});

// @desc    Obtenir l'utilisateur connecté
// @route   GET /api/v1/auth/admin/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user.id);
    
    res.status(200).json({
        success: true,
        data: user
    });
});

// @desc    Déconnexion
// @route   POST /api/v1/auth/admin/logout
// @access  Private
exports.logout = asyncHandler(async (req, res, next) => {
    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    });
    
    res.status(200).json({
        success: true,
        message: 'Déconnexion réussie'
    });
});

// @desc    Mettre à jour le mot de passe
// @route   PUT /api/v1/auth/admin/updatepassword
// @access  Private
exports.updatePassword = asyncHandler(async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user.id).select('+password');
    
    // Vérifier l'ancien mot de passe
    const isMatch = await user.matchPassword(currentPassword);
    
    if (!isMatch) {
        return next(new ErrorResponse('Mot de passe actuel incorrect', 401));
    }
    
    // Mettre à jour
    user.password = newPassword;
    await user.save();
    
    sendTokenResponse(user, 200, res);
});

// @desc    Mettre à jour le profil
// @route   PUT /api/v1/auth/admin/updateprofile
// @access  Private
exports.updateProfile = asyncHandler(async (req, res, next) => {
    const fieldsToUpdate = {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone
    };
    
    // Supprimer les champs undefined
    Object.keys(fieldsToUpdate).forEach(key => 
        fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
    );
    
    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
        new: true,
        runValidators: true
    });
    
    res.status(200).json({
        success: true,
        data: user
    });
});

// @desc    Créer un nouvel admin (superadmin only)
// @route   POST /api/v1/auth/admin/create
// @access  Private (superadmin)
exports.createAdmin = asyncHandler(async (req, res, next) => {
    const { name, email, password, role, phone } = req.body;
    
    // Vérifier si l'utilisateur connecté est superadmin
    if (req.user.role !== 'superadmin') {
        return next(new ErrorResponse('Seul un superadmin peut créer des administrateurs', 403));
    }
    
    const user = await User.create({
        name,
        email,
        password,
        role: role || 'admin',
        phone
    });
    
    res.status(201).json({
        success: true,
        data: user
    });
});

// @desc    Lister tous les admins
// @route   GET /api/v1/auth/admin/list
// @access  Private (superadmin)
exports.listAdmins = asyncHandler(async (req, res, next) => {
    const admins = await User.find().sort({ createdAt: -1 });
    
    res.status(200).json({
        success: true,
        count: admins.length,
        data: admins
    });
});

// Helper: Envoyer le token dans la réponse
const sendTokenResponse = (user, statusCode, res) => {
    const token = user.getSignedJwtToken();
    
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
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
};
