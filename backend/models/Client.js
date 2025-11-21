// ========================================
// DIGIY DRIVER - Modèle Client
// ========================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

const ClientSchema = new mongoose.Schema({
    // Informations personnelles
    firstName: {
        type: String,
        required: [true, 'Le prénom est requis'],
        trim: true,
        maxlength: [50, 'Le prénom ne peut pas dépasser 50 caractères']
    },
    lastName: {
        type: String,
        required: [true, 'Le nom est requis'],
        trim: true,
        maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères']
    },
    phone: {
        type: String,
        required: [true, 'Le numéro de téléphone est requis'],
        unique: true,
        match: [/^(\+221)?[0-9]{9}$/, 'Numéro de téléphone sénégalais invalide']
    },
    email: {
        type: String,
        lowercase: true,
        sparse: true,
        match: [
            /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
            'Veuillez fournir un email valide'
        ]
    },
    password: {
        type: String,
        minlength: [4, 'Le mot de passe doit contenir au moins 4 caractères'],
        select: false
    },
    pin: {
        type: String,
        select: false // Code PIN à 4 chiffres pour connexion rapide
    },
    avatar: {
        type: String,
        default: 'default-client.png'
    },
    
    // Statut
    status: {
        type: String,
        enum: ['active', 'suspended', 'inactive'],
        default: 'active'
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationCode: String,
    verificationExpire: Date,
    
    // Adresses enregistrées
    savedPlaces: [{
        name: {
            type: String,
            required: true
        },
        icon: {
            type: String,
            enum: ['home', 'work', 'favorite', 'other'],
            default: 'other'
        },
        address: {
            type: String,
            required: true
        },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: [Number] // [longitude, latitude]
        }
    }],
    
    // Position actuelle
    currentLocation: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            default: [-17.4467, 14.6928]
        },
        lastUpdated: Date
    },
    
    // Statistiques
    stats: {
        totalRides: { type: Number, default: 0 },
        completedRides: { type: Number, default: 0 },
        cancelledRides: { type: Number, default: 0 },
        totalSpent: { type: Number, default: 0 },
        averageRating: { type: Number, default: 5.0 },
        totalRatings: { type: Number, default: 0 }
    },
    
    // Méthodes de paiement
    paymentMethods: [{
        type: {
            type: String,
            enum: ['cash', 'wave', 'orange_money', 'free_money', 'card'],
            required: true
        },
        isDefault: {
            type: Boolean,
            default: false
        },
        details: {
            phone: String,
            lastFour: String,
            expiryDate: String
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    
    // Préférences
    preferences: {
        language: { type: String, default: 'fr' },
        currency: { type: String, default: 'XOF' },
        preferredVehicleType: { type: String, default: 'eco' },
        notifications: {
            push: { type: Boolean, default: true },
            sms: { type: Boolean, default: true },
            email: { type: Boolean, default: false },
            promotions: { type: Boolean, default: true }
        }
    },
    
    // Promos et fidélité
    promoCode: String,
    referralCode: {
        type: String,
        unique: true,
        sparse: true
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client'
    },
    loyaltyPoints: {
        type: Number,
        default: 0
    },
    
    // Métadonnées
    fcmToken: String,
    deviceInfo: {
        platform: String,
        version: String,
        deviceId: String
    },
    lastLogin: Date,
    lastActivity: Date
}, {
    timestamps: true
});

// Index géospatial
ClientSchema.index({ currentLocation: '2dsphere' });
ClientSchema.index({ phone: 1 });

// Virtual pour le nom complet
ClientSchema.virtual('fullName').get(function() {
    return `${this.firstName} ${this.lastName}`;
});

// Générer un code de parrainage unique
ClientSchema.pre('save', async function(next) {
    if (this.isNew && !this.referralCode) {
        this.referralCode = 'DG' + this.phone.slice(-4) + Math.random().toString(36).substring(2, 6).toUpperCase();
    }
    
    if (this.isModified('password') && this.password) {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
    }
    
    if (this.isModified('pin') && this.pin) {
        const salt = await bcrypt.genSalt(10);
        this.pin = await bcrypt.hash(this.pin, salt);
    }
    
    next();
});

// Vérifier le mot de passe
ClientSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Vérifier le PIN
ClientSchema.methods.matchPin = async function(enteredPin) {
    return await bcrypt.compare(enteredPin, this.pin);
};

// Générer le token JWT
ClientSchema.methods.getSignedJwtToken = function() {
    return jwt.sign(
        { id: this._id, type: 'client' },
        config.jwt.secret,
        { expiresIn: config.jwt.expire }
    );
};

// Générer un code de vérification SMS
ClientSchema.methods.generateVerificationCode = function() {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    this.verificationCode = code;
    this.verificationExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    return code;
};

// Ajouter des points de fidélité
ClientSchema.methods.addLoyaltyPoints = async function(amount) {
    // 1 point pour chaque 100 FCFA dépensé
    const points = Math.floor(amount / 100);
    this.loyaltyPoints += points;
    await this.save({ validateBeforeSave: false });
    return points;
};

module.exports = mongoose.model('Client', ClientSchema);
