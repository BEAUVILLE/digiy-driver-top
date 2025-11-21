require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Driver = require('../models/Driver');

// Connexion à la base de données
mongoose.connect(process.env.MONGODB_URI);

// Données Admin
const adminData = {
    name: process.env.ADMIN_NAME || 'DIGIY Admin',
    email: process.env.ADMIN_EMAIL || 'admin@digiylyfe.com',
    phone: '+221770000000',
    password: process.env.ADMIN_PASSWORD || 'DigiyAdmin2024!',
    role: 'admin',
    isActive: true
};

// Chauffeurs de démonstration
const driversData = [
    {
        name: 'Mamadou Diallo',
        email: 'mamadou@digiydriver.sn',
        phone: '+221771234567',
        password: 'driver123',
        vehicle: {
            type: 'confort',
            brand: 'Toyota',
            model: 'Corolla',
            year: 2020,
            color: 'Blanc',
            plateNumber: 'DK-1234-AB'
        },
        currentLocation: {
            type: 'Point',
            coordinates: [-17.4500, 14.6950]
        },
        status: 'online',
        isVerified: true,
        rating: 4.8,
        totalRides: 234,
        totalEarnings: 1250000
    },
    {
        name: 'Ibrahima Sow',
        email: 'ibrahima@digiydriver.sn',
        phone: '+221772345678',
        password: 'driver123',
        vehicle: {
            type: 'eco',
            brand: 'Peugeot',
            model: '308',
            year: 2019,
            color: 'Gris',
            plateNumber: 'DK-5678-CD'
        },
        currentLocation: {
            type: 'Point',
            coordinates: [-17.4400, 14.6850]
        },
        status: 'busy',
        isVerified: true,
        rating: 4.6,
        totalRides: 189,
        totalEarnings: 980000
    },
    {
        name: 'Ousmane Ndiaye',
        email: 'ousmane@digiydriver.sn',
        phone: '+221773456789',
        password: 'driver123',
        vehicle: {
            type: 'premium',
            brand: 'Mercedes',
            model: 'Classe C',
            year: 2021,
            color: 'Noir',
            plateNumber: 'DK-9012-EF'
        },
        currentLocation: {
            type: 'Point',
            coordinates: [-17.4600, 14.7000]
        },
        status: 'online',
        isVerified: true,
        rating: 4.9,
        totalRides: 312,
        totalEarnings: 2150000
    },
    {
        name: 'Cheikh Fall',
        email: 'cheikh@digiydriver.sn',
        phone: '+221774567890',
        password: 'driver123',
        vehicle: {
            type: 'eco',
            brand: 'Honda',
            model: 'Civic',
            year: 2018,
            color: 'Bleu',
            plateNumber: 'DK-3456-GH'
        },
        currentLocation: {
            type: 'Point',
            coordinates: [-17.4550, 14.6800]
        },
        status: 'online',
        isVerified: true,
        rating: 4.7,
        totalRides: 156,
        totalEarnings: 720000
    },
    {
        name: 'Amadou Ba',
        email: 'amadou@digiydriver.sn',
        phone: '+221775678901',
        password: 'driver123',
        vehicle: {
            type: 'moto',
            brand: 'Honda',
            model: 'CBR',
            year: 2022,
            color: 'Rouge',
            plateNumber: 'DK-7890-IJ'
        },
        currentLocation: {
            type: 'Point',
            coordinates: [-17.4350, 14.6900]
        },
        status: 'busy',
        isVerified: true,
        rating: 4.5,
        totalRides: 421,
        totalEarnings: 890000
    },
    {
        name: 'Moussa Diop',
        email: 'moussa@digiydriver.sn',
        phone: '+221776789012',
        password: 'driver123',
        vehicle: {
            type: 'confort',
            brand: 'Kia',
            model: 'Rio',
            year: 2020,
            color: 'Argent',
            plateNumber: 'DK-2345-KL'
        },
        currentLocation: {
            type: 'Point',
            coordinates: [-17.4650, 14.6750]
        },
        status: 'offline',
        isVerified: false,
        rating: 4.4,
        totalRides: 45,
        totalEarnings: 180000
    }
];

// Clients de démonstration
const clientsData = [
    {
        name: 'Aminata Fall',
        email: 'aminata@example.com',
        phone: '+221781234567',
        password: 'client123',
        role: 'client',
        rating: 4.9,
        totalRides: 23
    },
    {
        name: 'Fatou Diop',
        email: 'fatou@example.com',
        phone: '+221782345678',
        password: 'client123',
        role: 'client',
        rating: 4.7,
        totalRides: 15
    },
    {
        name: 'Awa Ndiaye',
        email: 'awa@example.com',
        phone: '+221783456789',
        password: 'client123',
        role: 'client',
        rating: 4.8,
        totalRides: 31
    }
];

const seedDatabase = async () => {
    try {
        console.log('🌱 Initialisation de la base de données DIGIY DRIVER...\n');
        
        // Supprimer les données existantes
        await User.deleteMany({});
        await Driver.deleteMany({});
        console.log('✓ Anciennes données supprimées');
        
        // Créer l'admin
        const admin = await User.create(adminData);
        console.log(`✓ Admin créé: ${admin.email}`);
        
        // Créer les clients
        const clients = await User.insertMany(clientsData);
        console.log(`✓ ${clients.length} clients créés`);
        
        // Créer les chauffeurs
        for (const driverData of driversData) {
            const driver = new Driver(driverData);
            await driver.save();
        }
        console.log(`✓ ${driversData.length} chauffeurs créés`);
        
        console.log('\n========================================');
        console.log('✅ Base de données initialisée avec succès!');
        console.log('========================================\n');
        
        console.log('📧 IDENTIFIANTS ADMIN:');
        console.log(`   Email: ${adminData.email}`);
        console.log(`   Mot de passe: ${adminData.password}`);
        console.log('\n📧 IDENTIFIANTS CHAUFFEUR TEST:');
        console.log(`   Email: mamadou@digiydriver.sn`);
        console.log(`   Mot de passe: driver123`);
        console.log('\n📧 IDENTIFIANTS CLIENT TEST:');
        console.log(`   Email: aminata@example.com`);
        console.log(`   Mot de passe: client123`);
        console.log('\n');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation:', error);
        process.exit(1);
    }
};

seedDatabase();
