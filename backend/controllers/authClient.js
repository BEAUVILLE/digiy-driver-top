// ========================================
// DIGIY DRIVER - Contrôleur Auth Client
// ========================================

const Client = require('../models/Client');
const config = require('../config/config');
const { asyncHandler, ErrorResponse } = require('../middleware/error');

// @desc    Inscription client
// @route   POST /api/v1/auth/client/register
// @access  Public
exports.register = asyncHandler(async (req, res, next) => {
    const { firstName, lastName, phone, email, password } = req.body;
    
    // Vérifier si le client existe déjà
    const existingClient = await Client.findOne({ phone });
    
    if (existingClient) {
        return next(new ErrorResponse('Un compte avec ce numéro existe déjà', 400));
    }
    
    // Créer le client
    const client = await Client.create({
        firstName,
        lastName,
        phone,
        email,
        password,
        paymentMethods: [{ type: 'cash', isDefault: true }]
    });
    
    // Générer code de vérification
    const verificationCode = client.generateVerificationCode();
    await client.save({ validateBeforeSave: false });
    
    // TODO: Envoyer le SMS de vérification
    console.log(`📱 Code de vérification pour ${phone}: ${verificationCode}`);
    
    res.status(201).json({
        success: true,
        message: 'Inscription réussie. Veuillez vérifier votre numéro.',
        data: {
            id: client._id,
            phone: client.phone,
            referralCode: client.referralCode
        }
    });
});

// @desc    Connexion client (par téléphone)
// @route   POST /api/v1/auth/client/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
    const { phone, password } = req.body;
    
    // Valider les champs
    if (!phone) {
        return next(new ErrorResponse('Veuillez fournir un numéro de téléphone', 400));
    }
    
    // Chercher le client
    const client = await Client.findOne({ phone }).select('+password');
    
    if (!client) {
        return next(new ErrorResponse('Numéro non enregistré', 401));
    }
    
    // Vérifier le statut
    if (client.status === 'suspended') {
        return next(new ErrorResponse('Votre compte est suspendu', 403));
    }
    
    // Si mot de passe fourni, vérifier
    if (password) {
        const isMatch = await client.matchPassword(password);
        if (!isMatch) {
            return next(new ErrorResponse('Mot de passe incorrect', 401));
        }
    } else {
        // Sinon, envoyer un code OTP
        const verificationCode = client.generateVerificationCode();
        await client.save({ validateBeforeSave: false });
        
        // TODO: Envoyer le SMS
        console.log(`📱 Code OTP pour ${phone}: ${verificationCode}`);
        
        return res.status(200).json({
            success: true,
            message: 'Code de vérification envoyé',
            requireOTP: true
        });
    }
    
    // Mettre à jour la dernière connexion
    client.lastLogin = new Date();
    await client.save({ validateBeforeSave: false });
    
    // Envoyer le token
    sendTokenResponse(client, 200, res);
});

// @desc    Vérifier le code OTP
// @route   POST /api/v1/auth/client/verify-otp
// @access  Public
exports.verifyOTP = asyncHandler(async (req, res, next) => {
    const { phone, code } = req.body;
    
    const client = await Client.findOne({
        phone,
        verificationCode: code,
        verificationExpire: { $gt: Date.now() }
    });
    
    if (!client) {
        return next(new ErrorResponse('Code invalide ou expiré', 400));
    }
    
    // Marquer comme vérifié
    client.isVerified = true;
    client.verificationCode = undefined;
    client.verificationExpire = undefined;
    client.lastLogin = new Date();
    await client.save({ validateBeforeSave: false });
    
    // Envoyer le token
    sendTokenResponse(client, 200, res);
});

// @desc    Renvoyer le code OTP
// @route   POST /api/v1/auth/client/resend-otp
// @access  Public
exports.resendOTP = asyncHandler(async (req, res, next) => {
    const { phone } = req.body;
    
    const client = await Client.findOne({ phone });
    
    if (!client) {
        return next(new ErrorResponse('Numéro non enregistré', 404));
    }
    
    const verificationCode = client.generateVerificationCode();
    await client.save({ validateBeforeSave: false });
    
    // TODO: Envoyer le SMS
    console.log(`📱 Nouveau code OTP pour ${phone}: ${verificationCode}`);
    
    res.status(200).json({
        success: true,
        message: 'Nouveau code envoyé'
    });
});

// @desc    Obtenir le client connecté
// @route   GET /api/v1/auth/client/me
// @access  Private (Client)
exports.getMe = asyncHandler(async (req, res, next) => {
    const client = await Client.findById(req.user.id);
    
    res.status(200).json({
        success: true,
        data: client
    });
});

// @desc    Mettre à jour le profil
// @route   PUT /api/v1/auth/client/profile
// @access  Private (Client)
exports.updateProfile = asyncHandler(async (req, res, next) => {
    const fieldsToUpdate = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        preferences: req.body.preferences
    };
    
    // Supprimer les champs undefined
    Object.keys(fieldsToUpdate).forEach(key => 
        fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
    );
    
    const client = await Client.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
        new: true,
        runValidators: true
    });
    
    res.status(200).json({
        success: true,
        data: client
    });
});

// @desc    Ajouter une adresse enregistrée
// @route   POST /api/v1/auth/client/places
// @access  Private (Client)
exports.addSavedPlace = asyncHandler(async (req, res, next) => {
    const { name, icon, address, longitude, latitude } = req.body;
    
    const client = await Client.findById(req.user.id);
    
    client.savedPlaces.push({
        name,
        icon,
        address,
        location: {
            type: 'Point',
            coordinates: [longitude, latitude]
        }
    });
    
    await client.save();
    
    res.status(201).json({
        success: true,
        data: client.savedPlaces
    });
});

// @desc    Supprimer une adresse enregistrée
// @route   DELETE /api/v1/auth/client/places/:placeId
// @access  Private (Client)
exports.removeSavedPlace = asyncHandler(async (req, res, next) => {
    const client = await Client.findById(req.user.id);
    
    client.savedPlaces = client.savedPlaces.filter(
        place => place._id.toString() !== req.params.placeId
    );
    
    await client.save();
    
    res.status(200).json({
        success: true,
        data: client.savedPlaces
    });
});

// @desc    Mettre à jour la position
// @route   PUT /api/v1/auth/client/location
// @access  Private (Client)
exports.updateLocation = asyncHandler(async (req, res, next) => {
    const { longitude, latitude } = req.body;
    
    const client = await Client.findByIdAndUpdate(
        req.user.id,
        {
            currentLocation: {
                type: 'Point',
                coordinates: [longitude, latitude],
                lastUpdated: new Date()
            },
            lastActivity: new Date()
        },
        { new: true }
    );
    
    res.status(200).json({
        success: true,
        message: 'Position mise à jour'
    });
});

// Helper: Envoyer le token dans la réponse
const sendTokenResponse = (client, statusCode, res) => {
    const token = client.getSignedJwtToken();
    
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
            client: {
                id: client._id,
                name: client.fullName,
                phone: client.phone,
                email: client.email,
                savedPlaces: client.savedPlaces,
                referralCode: client.referralCode
            }
        });
};
