// Classe personnalisée pour les erreurs
class ErrorResponse extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
    }
}

// Middleware de gestion des erreurs
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;
    
    // Log pour le développement
    if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error:', err);
    }
    
    // Erreur Mongoose: ID invalide
    if (err.name === 'CastError') {
        const message = 'Ressource non trouvée';
        error = new ErrorResponse(message, 404);
    }
    
    // Erreur Mongoose: Champ dupliqué
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        const message = `Ce ${field} existe déjà`;
        error = new ErrorResponse(message, 400);
    }
    
    // Erreur Mongoose: Validation
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(val => val.message);
        const message = messages.join('. ');
        error = new ErrorResponse(message, 400);
    }
    
    // Erreur JWT: Token invalide
    if (err.name === 'JsonWebTokenError') {
        const message = 'Token invalide';
        error = new ErrorResponse(message, 401);
    }
    
    // Erreur JWT: Token expiré
    if (err.name === 'TokenExpiredError') {
        const message = 'Votre session a expiré. Veuillez vous reconnecter.';
        error = new ErrorResponse(message, 401);
    }
    
    res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Erreur serveur'
    });
};

module.exports = { ErrorResponse, errorHandler };
