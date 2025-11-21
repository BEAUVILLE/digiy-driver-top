const mongoose = require('mongoose');

const RideSchema = new mongoose.Schema({
    // Identifiant lisible
    rideCode: {
        type: String,
        unique: true
    },
    
    // Participants
    client: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    driver: {
        type: mongoose.Schema.ObjectId,
        ref: 'Driver',
        default: null
    },
    
    // Points de trajet
    pickup: {
        address: {
            type: String,
            required: [true, 'L\'adresse de départ est requise']
        },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
                required: true
            }
        },
        details: String // Instructions supplémentaires
    },
    dropoff: {
        address: {
            type: String,
            required: [true, 'L\'adresse d\'arrivée est requise']
        },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: {
                type: [Number],
                required: true
            }
        },
        details: String
    },
    
    // Type de véhicule demandé
    vehicleType: {
        type: String,
        enum: ['eco', 'confort', 'premium', 'moto'],
        default: 'eco'
    },
    
    // Estimations
    estimatedDistance: {
        type: Number, // en mètres
        required: true
    },
    estimatedDuration: {
        type: Number, // en secondes
        required: true
    },
    estimatedPrice: {
        type: Number, // en FCFA
        required: true
    },
    
    // Prix final
    finalPrice: {
        type: Number,
        default: null
    },
    
    // Statut de la course
    status: {
        type: String,
        enum: [
            'pending',      // En attente d'un chauffeur
            'accepted',     // Chauffeur accepté, en route vers client
            'arrived',      // Chauffeur arrivé au point de départ
            'in_progress',  // Course en cours
            'completed',    // Course terminée
            'cancelled'     // Course annulée
        ],
        default: 'pending'
    },
    
    // Raison d'annulation
    cancellation: {
        cancelledBy: {
            type: String,
            enum: ['client', 'driver', 'system']
        },
        reason: String,
        cancelledAt: Date
    },
    
    // Timestamps des étapes
    timestamps: {
        requested: { type: Date, default: Date.now },
        accepted: Date,
        driverArrived: Date,
        started: Date,
        completed: Date,
        cancelled: Date
    },
    
    // Évaluations
    ratings: {
        clientRating: {
            score: { type: Number, min: 1, max: 5 },
            comment: String,
            ratedAt: Date
        },
        driverRating: {
            score: { type: Number, min: 1, max: 5 },
            comment: String,
            ratedAt: Date
        }
    },
    
    // Paiement
    payment: {
        method: {
            type: String,
            enum: ['cash', 'wave', 'orange_money', 'card'],
            default: 'cash'
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed', 'refunded'],
            default: 'pending'
        },
        transactionId: String,
        paidAt: Date
    },
    
    // Trajet réel (pour tracking)
    routePolyline: String, // Encoded polyline du trajet
    actualDistance: Number,
    actualDuration: Number
    
}, {
    timestamps: true
});

// Index géospatiaux
RideSchema.index({ 'pickup.location': '2dsphere' });
RideSchema.index({ 'dropoff.location': '2dsphere' });
RideSchema.index({ status: 1, createdAt: -1 });

// Générer un code de course unique avant sauvegarde
RideSchema.pre('save', async function(next) {
    if (!this.rideCode) {
        const date = new Date();
        const prefix = 'DG';
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const timestamp = date.getTime().toString().slice(-4);
        this.rideCode = `${prefix}-${random}${timestamp}`;
    }
    next();
});

// Méthode pour mettre à jour le statut
RideSchema.methods.updateStatus = async function(newStatus, additionalData = {}) {
    this.status = newStatus;
    
    const now = new Date();
    
    switch(newStatus) {
        case 'accepted':
            this.timestamps.accepted = now;
            break;
        case 'arrived':
            this.timestamps.driverArrived = now;
            break;
        case 'in_progress':
            this.timestamps.started = now;
            break;
        case 'completed':
            this.timestamps.completed = now;
            if (additionalData.finalPrice) {
                this.finalPrice = additionalData.finalPrice;
            }
            break;
        case 'cancelled':
            this.timestamps.cancelled = now;
            this.cancellation = {
                cancelledBy: additionalData.cancelledBy,
                reason: additionalData.reason,
                cancelledAt: now
            };
            break;
    }
    
    await this.save();
    return this;
};

// Calculer le prix selon la distance et le type de véhicule
RideSchema.statics.calculatePrice = function(distanceInMeters, vehicleType) {
    // Tarifs en FCFA par km
    const rates = {
        eco: { base: 500, perKm: 250 },
        confort: { base: 700, perKm: 350 },
        premium: { base: 1000, perKm: 500 },
        moto: { base: 300, perKm: 150 }
    };
    
    const rate = rates[vehicleType] || rates.eco;
    const distanceInKm = distanceInMeters / 1000;
    
    let price = rate.base + (distanceInKm * rate.perKm);
    
    // Arrondir à 100 FCFA près
    price = Math.ceil(price / 100) * 100;
    
    // Prix minimum
    const minimums = { eco: 1000, confort: 1500, premium: 2000, moto: 500 };
    price = Math.max(price, minimums[vehicleType] || 1000);
    
    return price;
};

module.exports = mongoose.model('Ride', RideSchema);
