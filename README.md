# 🚗 DIGIY DRIVER

**VTC Sénégal - 0% Commission**

![DIGIY DRIVER](https://img.shields.io/badge/DIGIY-DRIVER-gold?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat-square)
![MongoDB](https://img.shields.io/badge/MongoDB-6+-green?style=flat-square)
![License](https://img.shields.io/badge/License-Proprietary-red?style=flat-square)

---

## 📖 Description

**DIGIY DRIVER** est une application VTC (Véhicule de Tourisme avec Chauffeur) révolutionnaire pour le Sénégal, faisant partie de l'écosystème **DIGIYLYFE**.

### 🎯 Notre Différence : 0% Commission !

Contrairement aux plateformes traditionnelles comme Uber ou Bolt qui prélèvent 20-25% sur chaque course, DIGIY DRIVER fonctionne sur un modèle d'abonnement mensuel, permettant aux chauffeurs de conserver **100% de leurs gains**.

---

## 🏗️ Architecture

```
digiy-driver/
├── backend/           # API Node.js + Express + MongoDB
│   ├── config/        # Configuration (DB, JWT, etc.)
│   ├── controllers/   # Logique métier
│   ├── middleware/    # Auth, error handling
│   ├── models/        # Schémas Mongoose
│   ├── routes/        # Routes API
│   ├── sockets/       # Socket.IO (temps réel)
│   └── utils/         # Utilitaires
│
└── frontend/          # Application web (HTML/CSS/JS)
    └── index.html     # Interface utilisateur
```

---

## ⚡ Fonctionnalités

### 👤 Client
- Réservation de course en temps réel
- Choix du type de véhicule (Éco, Confort, Premium, Moto)
- Suivi GPS du chauffeur
- Historique des courses
- Système de notation

### 🚗 Chauffeur
- Dashboard dédié
- Gestion du statut (en ligne/hors ligne)
- Réception des demandes de course
- Navigation GPS intégrée
- Statistiques de gains

### 👨‍💼 Admin
- Dashboard de supervision
- Carte en temps réel des chauffeurs
- Gestion des courses
- Statistiques et rapports
- Vérification des chauffeurs

---

## 🚀 Installation

### Prérequis

- Node.js 18+
- MongoDB 6+ (local ou Atlas)
- npm ou yarn

### 1. Cloner le repo

```bash
git clone https://github.com/votre-username/digiy-driver.git
cd digiy-driver
```

### 2. Configuration Backend

```bash
cd backend
npm install

# Copier et configurer les variables d'environnement
cp .env.example .env
```

Éditer `.env` avec vos valeurs :

```env
# MongoDB
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/digiy-driver

# JWT (générer avec: openssl rand -hex 64)
JWT_SECRET=votre_cle_secrete_tres_longue

# Admin
ADMIN_EMAIL=votre-email@digiylyfe.com
ADMIN_PASSWORD=VotreMotDePasseSecurise!

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

### 3. Lancer le serveur

```bash
# Mode développement
npm run dev

# Mode production
npm start
```

### 4. Initialiser la base de données (optionnel)

```bash
npm run seed
```

---

## 🌐 Déploiement

### Backend (Render)

1. Créer un nouveau Web Service sur [Render](https://render.com)
2. Connecter votre repo GitHub
3. Configurer les variables d'environnement
4. Déployer !

### Frontend (Netlify/Vercel)

1. Modifier `API_BASE_URL` dans `frontend/index.html`
2. Déployer sur Netlify ou Vercel

---

## 📚 API Endpoints

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/register` | Inscription client |
| POST | `/api/auth/login` | Connexion |
| POST | `/api/auth/admin/login` | Connexion admin |
| GET | `/api/drivers/nearby` | Chauffeurs à proximité |
| POST | `/api/rides` | Créer une course |
| PUT | `/api/rides/:id/accept` | Accepter une course |

Documentation complète : `GET /api/docs`

---

## 🔒 Sécurité

- ✅ Authentification JWT
- ✅ Rate limiting
- ✅ Helmet (headers sécurisés)
- ✅ CORS configuré
- ✅ Variables sensibles dans `.env`
- ✅ Hashage bcrypt des mots de passe

---

## 🤝 Contribution

Ce projet est propriétaire. Pour toute contribution, contactez l'équipe DIGIYLYFE.

---

## 📞 Contact

- **Site web** : [digiylyfe.com](https://digiylyfe.com)
- **Email** : contact@digiylyfe.com

---

## ⚖️ Licence

© 2024 DIGIYLYFE. Tous droits réservés.

---

<p align="center">
  <strong>🌍 Connecter l'Afrique au monde, pierre par pierre 🧱</strong>
</p>
