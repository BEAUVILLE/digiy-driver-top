const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        
        console.log(`✅ MongoDB connecté: ${conn.connection.host}`);
        
        // Gestion des erreurs après connexion
        mongoose.connection.on('error', (err) => {
            console.error(`❌ Erreur MongoDB: ${err.message}`);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB déconnecté');
        });
        
    } catch (error) {
        console.error(`❌ Erreur de connexion MongoDB: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
