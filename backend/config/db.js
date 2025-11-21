// ========================================
// DIGIY DRIVER - Connexion MongoDB
// ========================================

const mongoose = require('mongoose');
const config = require('./config');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(config.mongoUri, {
            // Options de connexion modernes
        });

        console.log(`
╔══════════════════════════════════════════════════╗
║     🗄️  MongoDB Connecté avec succès!             ║
║     📍 Host: ${conn.connection.host.padEnd(30)}   ║
║     📚 Database: ${conn.connection.name.padEnd(26)}   ║
╚══════════════════════════════════════════════════╝
        `);

        // Gestion des événements de connexion
        mongoose.connection.on('error', (err) => {
            console.error(`❌ Erreur MongoDB: ${err.message}`);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️  MongoDB déconnecté. Tentative de reconnexion...');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('✅ MongoDB reconnecté!');
        });

        return conn;
    } catch (error) {
        console.error(`❌ Erreur de connexion MongoDB: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
