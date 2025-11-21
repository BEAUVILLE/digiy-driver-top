# 🚗 DIGIY DRIVER - Backend API

Backend Node.js/Express pour l'application VTC DIGIY DRIVER - Sénégal 0% Commission

## ✨ Fonctionnalités

- 🔐 **Authentification JWT sécurisée** (Admin, Client, Chauffeur)
- 📍 **Géolocalisation temps réel** avec Socket.IO
- 🚖 **Gestion des courses** complète (demande, acceptation, suivi, notation)
- 👨‍✈️ **Gestion des chauffeurs** (inscription, vérification, bannissement)
- 📊 **Dashboard Admin** avec statistiques
- 💳 **Calcul automatique des prix** selon distance et type de véhicule
- 🔒 **Sécurité** : Helmet, Rate Limiting, CORS, validation des données

## 🛠️ Stack Technique

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Base de données**: MongoDB (Atlas ou local)
- **Temps réel**: Socket.IO
- **Auth**: JWT + bcrypt
- **Sécurité**: Helmet, express-rate-limit

## 📦 Installation

### 1. Cloner le projet

```bash
git clone https://github.com/digiylyfe/digiy-driver-backend.git
cd digiy-driver-backend
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configuration

Copier le fichier `.env.example` vers `.env` :

```bash
cp .env.example .env
```

Modifier les variables dans `.env` :

```env
NODE_ENV=development
PORT=5000

# MongoDB - Créer un cluster gratuit sur https://mongodb.com/atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/digiy-driver

# JWT Secret - Générer avec: openssl rand -hex 64
JWT_SECRET=votre_cle_secrete_ici
JWT_EXPIRE=7d

# Admin par défaut
ADMIN_EMAIL=admin@digiylyfe.com
ADMIN_PASSWORD=VotreMotDePasseSecurise!
ADMIN_NAME=DIGIY Admin

# Frontend URL (pour CORS)
FRONTEND_URL=http://localhost:3000
```

### 4. Initialiser la base de données

```bash
npm run seed
```

Cela créera :
- Un compte Admin
- 6 chauffeurs de démonstration
- 3 clients de démonstration

### 5. Lancer le serveur

```bash
# Mode développement (avec auto-reload)
npm run dev

# Mode production
npm start
```

Le serveur démarre sur `http://localhost:5000`

## 🚀 Déploiement sur Render

### 1. Créer un compte sur [render.com](https://render.com)

### 2. Créer un nouveau "Web Service"

- **Repository**: Connecter votre repo GitHub
- **Branch**: main
- **Build Command**: `npm install`
- **Start Command**: `npm start`

### 3. Ajouter les variables d'environnement

Dans l'onglet "Environment", ajouter toutes les variables du `.env`

### 4. Déployer!

Render détectera automatiquement Node.js et déploiera votre API.

## 📚 Documentation API

### Endpoints principaux

| Méthode | Route | Description | Accès |
|---------|-------|-------------|-------|
| POST | `/api/auth/login` | Connexion | Public |
| POST | `/api/auth/admin/login` | Connexion admin | Public |
| POST | `/api/auth/driver/login` | Connexion chauffeur | Public |
| GET | `/api/auth/me` | Profil connecté | Authentifié |
| GET | `/api/drivers/online` | Chauffeurs en ligne | Admin |
| GET | `/api/drivers/nearby` | Chauffeurs proches | Client |
| POST | `/api/rides` | Créer une course | Client |
| PUT | `/api/rides/:id/accept` | Accepter course | Chauffeur |
| GET | `/api/rides/stats/overview` | Statistiques | Admin |

Documentation complète: `GET /api/docs`

### Authentification

Inclure le token JWT dans le header :

```
Authorization: Bearer <votre_token>
```

### Exemple de requête

```javascript
// Connexion Admin
const response = await fetch('http://localhost:5000/api/auth/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        email: 'admin@digiylyfe.com',
        password: 'VotreMotDePasse!'
    })
});

const { token, data } = await response.json();
console.log('Connecté:', data.name);
```

## 🔌 Socket.IO Events

### Client → Serveur

```javascript
// Demander une course
socket.emit('request_ride', {
    pickupAddress: 'Médina, Dakar',
    pickupLng: -17.4467,
    pickupLat: 14.6928,
    dropoffAddress: 'Almadies, Dakar',
    dropoffLng: -17.5067,
    dropoffLat: 14.7428,
    vehicleType: 'eco',
    estimatedDistance: 5200,
    estimatedDuration: 900
});

// Chauffeur: Mettre à jour position
socket.emit('update_location', { lng: -17.4500, lat: 14.6950 });

// Chauffeur: Accepter course
socket.emit('accept_ride', { rideId: '...' });
```

### Serveur → Client

```javascript
// Client: Course acceptée
socket.on('ride_accepted', (data) => {
    console.log('Chauffeur:', data.driver.name);
    console.log('Véhicule:', data.driver.vehicle);
});

// Client: Position du chauffeur
socket.on('driver_location_updated', (data) => {
    updateMapMarker(data.location);
});

// Chauffeur: Nouvelle demande de course
socket.on('new_ride_request', (data) => {
    showRideRequest(data);
});
```

## 🔐 Identifiants de test

Après `npm run seed` :

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@digiylyfe.com | DigiyAdmin2024! |
| Chauffeur | mamadou@digiydriver.sn | driver123 |
| Client | aminata@example.com | client123 |

## 📁 Structure du projet

```
digiy-driver-backend/
├── config/
│   ├── database.js      # Connexion MongoDB
│   └── socket.js        # Configuration Socket.IO
├── controllers/
│   ├── authController.js
│   ├── driverController.js
│   └── rideController.js
├── middleware/
│   ├── auth.js          # Vérification JWT
│   └── error.js         # Gestion des erreurs
├── models/
│   ├── User.js          # Client/Admin
│   ├── Driver.js        # Chauffeur
│   └── Ride.js          # Course
├── routes/
│   ├── auth.js
│   ├── drivers.js
│   └── rides.js
├── utils/
│   └── seeder.js        # Données initiales
├── .env.example
├── package.json
├── server.js            # Point d'entrée
└── README.md
```

## 💰 Tarification DIGIY DRIVER

| Type | Base | Par km | Minimum |
|------|------|--------|---------|
| Éco | 500 F | 250 F/km | 1 000 F |
| Confort | 700 F | 350 F/km | 1 500 F |
| Premium | 1 000 F | 500 F/km | 2 000 F |
| Moto | 300 F | 150 F/km | 500 F |

**0% Commission** - Les chauffeurs gardent 100% de leurs gains!

## 🤝 Support

- 📧 Email: contact@digiylyfe.com
- 🌐 Site: https://digiylyfe.com
- 📱 WhatsApp: +221 XX XXX XX XX

---

**DIGIY DRIVER** - Connecter l'Afrique aux opportunités 🌍

*Fait avec ❤️ par DIGIYLYFE*
