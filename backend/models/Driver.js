const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const DriverSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Le nom est requis'],
        trim: true,
        maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères']
    },
    email: {
        type: String,
        required: [true, 'L\'email est requis'],
        unique: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email invalide']
    },
    phone: {
        type: String,
        required: [true, 'Le numéro de téléphone est requis'],
        match: [/^(\+221|00221)?[0-9]{9}$/, 'Numéro sénégalais invalide']
    },
    password: {
        type: String,
        required: [true, 'Le mot de passe est requis'],
        minlength: [6, 'Le mot de passe doit faire au moins 6 caractères'],
        select: false
    },
    
    // Informations véhicule
    vehicle: {
        type: {
            type: String,
            enum: ['eco', 'confort', 'premium', 'moto'],
            default: 'eco'
        },
        brand: {
            type: String,
            required: [true, 'La marque du véhicule est requise']
        },
        model: {
            type: String,
            required: [true, 'Le modèle du véhicule est requis']
        },
        year: {
            type: Number,
            required: [true, 'L\'année du véhicule est requise']
        },
        color: {
            type: String,
            required: [true, 'La couleur du véhicule est requise']
        },
        plateNumber: {
            type: String,
            required: [true, 'La plaque d\'immatriculation est requise'],
            unique: true,
            uppercase: true
        }
    },
    
    // Documents
    documents: {
        license: {
            number: String,
            expiryDate: Date,
            verified: { type: Boolean, default: false }
        },
        insurance: {
            number: String,
            expiryDate: Date,
            verified: { type: Boolean, default: false }
        },
        registration: {
            number: String,
            verified: { type: Boolean, default: false }
        }
    },
    
    // Statut et localisation
    status: {
        type: String,
        enum: ['offline', 'online', 'busy'],
        default: 'offline'
    },
    currentLocation: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            default: [-17.4467, 14.6928] // Dakar par défaut
        }
    },
    lastLocationUpdate: {
        type: Date,
        default: null
    },
    
    // Stats et évaluations
    rating: {
        type: Number,
        default: 5,
        min: 1,
        max: 5
    },
    totalRatings: {
        type: Number,
        default: 0
    },
    totalRides: {
        type: Number,
        default: 0
    },
    totalEarnings: {
        type: Number,
        default: 0
    },
    
    // Statut compte
    isVerified: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isBanned: {
        type: Boolean,
        default: false
    },
    banReason: String,
    
    // Ride en cours
    currentRide: {
        type: mongoose.Schema.ObjectId,
        ref: 'Ride',
        default: null
    },
    
    lastLogin: Date,
    resetPasswordToken: String,
    resetPasswordExpire: Date
}, {
    timestamps: true
});

// Index géospatial pour recherche de chauffeurs proches
DriverSchema.index({ currentLocation: '2dsphere' });

// Hasher le mot de passe avant sauvegarde
DriverSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        next();
    }
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
});

// Vérifier le mot de passe
DriverSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Générer JWT Token
DriverSchema.methods.getSignedJwtToken = function() {
    return jwt.sign(
        { id: this._id, role: 'driver' },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
    );
};

// Mettre à jour la position
DriverSchema.methods.updateLocation = async function(longitude, latitude) {
    this.currentLocation.coordinates = [longitude, latitude];
    this.lastLocationUpdate = new Date();
    await this.save({ validateBeforeSave: false });
};

// Trouver les chauffeurs à proximité
DriverSchema.statics.findNearbyDrivers = async function(longitude, latitude, maxDistance = 5000, vehicleType = null) {
    const query = {
        status: 'online',
        isActive: true,
        isVerified: true,
        isBanned: false,
        currentLocation: {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: [longitude, latitude]
                },
                $maxDistance: maxDistance // en mètres
            }
        }
    };
    
    if (vehicleType) {
        query['vehicle.type'] = vehicleType;
    }
    
    return this.find(query).select('-password');
};

module.exports = mongoose.model('Driver', DriverSchema);
