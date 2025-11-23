// ========================================
// 🚀 CODE COMPLET - BOUTONS D'ACTIONS CHAUFFEUR
// À copier-coller dans digiy-driver-chauffeur.html
// ========================================

// ============================================
// 1️⃣ FONCTION PRINCIPALE - AFFICHAGE DES COURSES
// ============================================

function updateRidesList(rides) {
  const container = document.getElementById('rides-list');
  
  // Vérifier si des courses existent
  if (!rides || rides.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-car fa-3x text-muted mb-3"></i>
        <p class="text-muted">Aucune course pour le moment</p>
      </div>
    `;
    return;
  }
  
  // Générer le HTML pour chaque course
  container.innerHTML = rides.map(ride => {
    // ============================================
    // GÉNÉRATION DES BOUTONS D'ACTIONS
    // ============================================
    let actionButtons = '';
    
    // Bouton "Terminer la course" (vert)
    if (ride.status === 'accepted' || ride.status === 'en_cours') {
      actionButtons += `
        <button onclick="updateRideStatus('${ride.id}', 'completed')" 
                class="btn btn-success btn-sm btn-block mt-2">
          <i class="fas fa-check-circle"></i> Terminer la course
        </button>
      `;
    }
    
    // Bouton "Marquer comme payé" (jaune/warning)
    if (ride.status === 'completed' && !ride.isPaid) {
      actionButtons += `
        <button onclick="markAsPaid('${ride.id}', ${ride.price})" 
                class="btn btn-warning btn-sm btn-block mt-2">
          <i class="fas fa-money-bill-wave"></i> Marquer comme payé (${ride.price} CFA)
        </button>
      `;
    }
    
    // Badge "Payé" pour les courses payées
    const paidBadge = ride.isPaid ? 
      '<span class="badge badge-success ml-2"><i class="fas fa-check"></i> Payé</span>' : '';
    
    // ============================================
    // GÉNÉRATION DE LA CARTE
    // ============================================
    return `
      <div class="card mb-3 shadow-sm ride-card">
        <div class="card-body">
          <!-- En-tête avec nom et statut -->
          <div class="d-flex justify-content-between align-items-start mb-3">
            <h5 class="mb-0">
              <i class="fas fa-user-circle text-primary"></i> 
              ${ride.clientName || 'Client'}
            </h5>
            <span class="badge badge-${getStatusColor(ride.status)} badge-pill">
              ${getStatusLabel(ride.status)}
            </span>
          </div>
          
          <!-- Détails du trajet -->
          <div class="ride-details mb-3">
            <div class="location-item mb-2">
              <i class="fas fa-map-marker-alt text-success"></i> 
              <strong>Départ:</strong> 
              <span class="text-muted">${ride.pickup || 'Non spécifié'}</span>
            </div>
            
            <div class="location-item mb-2">
              <i class="fas fa-map-marker-alt text-danger"></i> 
              <strong>Arrivée:</strong> 
              <span class="text-muted">${ride.destination || 'Non spécifié'}</span>
            </div>
            
            ${ride.distance ? `
              <div class="location-item mb-2">
                <i class="fas fa-road text-info"></i> 
                <strong>Distance:</strong> 
                <span class="text-muted">${ride.distance} km</span>
              </div>
            ` : ''}
            
            ${ride.duration ? `
              <div class="location-item mb-2">
                <i class="fas fa-clock text-warning"></i> 
                <strong>Durée:</strong> 
                <span class="text-muted">${ride.duration} min</span>
              </div>
            ` : ''}
          </div>
          
          <!-- Section Prix -->
          <div class="price-section p-2 bg-light rounded mb-2">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <small class="text-muted d-block">Prix de la course</small>
                <span class="h5 mb-0 text-primary font-weight-bold">
                  ${ride.price || 0} CFA
                </span>
              </div>
              ${paidBadge}
            </div>
          </div>
          
          <!-- BOUTONS D'ACTIONS -->
          <div class="action-buttons">
            ${actionButtons}
          </div>
          
          <!-- Horodatage -->
          ${ride.createdAt ? `
            <div class="mt-2 pt-2 border-top">
              <small class="text-muted">
                <i class="fas fa-clock"></i> 
                ${formatDate(ride.createdAt)}
              </small>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ============================================
// 2️⃣ FONCTIONS HELPER
// ============================================

// Obtenir la couleur du badge selon le statut
function getStatusColor(status) {
  const colors = {
    'pending': 'warning',
    'accepted': 'info',
    'en_cours': 'primary',
    'completed': 'success',
    'cancelled': 'danger',
    'paid': 'success'
  };
  return colors[status] || 'secondary';
}

// Obtenir le label en français
function getStatusLabel(status) {
  const labels = {
    'pending': '⏳ En attente',
    'accepted': '✓ Acceptée',
    'en_cours': '🚗 En cours',
    'completed': '✓ Terminée',
    'cancelled': '✗ Annulée',
    'paid': '💰 Payée'
  };
  return labels[status] || status;
}

// Formater la date
function formatDate(timestamp) {
  if (!timestamp) return 'Date non disponible';
  
  let date;
  // Si c'est un Timestamp Firebase
  if (timestamp.toDate) {
    date = timestamp.toDate();
  } 
  // Si c'est déjà une Date
  else if (timestamp instanceof Date) {
    date = timestamp;
  }
  // Si c'est un string ou nombre
  else {
    date = new Date(timestamp);
  }
  
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ============================================
// 3️⃣ FONCTIONS D'ACTIONS (déjà présentes lignes 889 et 917)
// ============================================

// Mettre à jour le statut d'une course
function updateRideStatus(rideId, newStatus) {
  if (!rideId) {
    alert('Erreur: ID de course manquant');
    return;
  }
  
  // Confirmation pour terminer une course
  if (newStatus === 'completed') {
    if (!confirm('Confirmer que la course est terminée ?')) {
      return;
    }
  }
  
  const db = firebase.firestore();
  
  // Afficher un loader
  showLoader('Mise à jour en cours...');
  
  db.collection('rides').doc(rideId).update({
    status: newStatus,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    ...(newStatus === 'completed' && { completedAt: firebase.firestore.FieldValue.serverTimestamp() })
  })
  .then(() => {
    console.log('✓ Statut mis à jour:', newStatus);
    hideLoader();
    
    // Afficher un message de succès
    showSuccessMessage('Course terminée avec succès !');
    
    // Recharger la liste des courses
    loadDriverRides();
  })
  .catch(error => {
    console.error('✗ Erreur mise à jour statut:', error);
    hideLoader();
    alert('Erreur lors de la mise à jour: ' + error.message);
  });
}

// Marquer une course comme payée
function markAsPaid(rideId, amount) {
  if (!rideId || !amount) {
    alert('Erreur: Informations manquantes');
    return;
  }
  
  // Confirmation du paiement
  if (!confirm(`Confirmer le paiement de ${amount} CFA ?`)) {
    return;
  }
  
  const db = firebase.firestore();
  const driverId = localStorage.getItem('driverId');
  
  // Afficher un loader
  showLoader('Enregistrement du paiement...');
  
  db.collection('rides').doc(rideId).update({
    isPaid: true,
    paidAt: firebase.firestore.FieldValue.serverTimestamp(),
    paidAmount: amount,
    paymentMethod: 'cash' // Par défaut espèces
  })
  .then(() => {
    console.log('✓ Course marquée comme payée');
    
    // Mettre à jour les gains du chauffeur
    if (driverId) {
      updateDriverEarnings(driverId, amount);
    }
    
    hideLoader();
    showSuccessMessage(`Paiement de ${amount} CFA enregistré !`);
    
    // Recharger la liste
    loadDriverRides();
  })
  .catch(error => {
    console.error('✗ Erreur marquage paiement:', error);
    hideLoader();
    alert('Erreur lors du marquage de paiement: ' + error.message);
  });
}

// Mettre à jour les gains du chauffeur
function updateDriverEarnings(driverId, amount) {
  const db = firebase.firestore();
  
  db.collection('drivers').doc(driverId).update({
    totalEarnings: firebase.firestore.FieldValue.increment(amount),
    lastPaymentDate: firebase.firestore.FieldValue.serverTimestamp()
  })
  .then(() => {
    console.log('✓ Gains mis à jour:', amount);
    // Rafraîchir les statistiques si affichées
    updateDriverStats();
  })
  .catch(error => {
    console.error('✗ Erreur mise à jour gains:', error);
  });
}

// ============================================
// 4️⃣ FONCTIONS UI (MESSAGES ET LOADERS)
// ============================================

function showLoader(message = 'Chargement...') {
  // Créer un loader si pas déjà présent
  let loader = document.getElementById('global-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'global-loader';
    loader.className = 'loader-overlay';
    loader.innerHTML = `
      <div class="loader-content">
        <div class="spinner-border text-primary" role="status">
          <span class="sr-only">Loading...</span>
        </div>
        <p class="mt-2">${message}</p>
      </div>
    `;
    document.body.appendChild(loader);
  }
  loader.style.display = 'flex';
}

function hideLoader() {
  const loader = document.getElementById('global-loader');
  if (loader) {
    loader.style.display = 'none';
  }
}

function showSuccessMessage(message) {
  // Créer un toast de succès
  const toast = document.createElement('div');
  toast.className = 'success-toast';
  toast.innerHTML = `
    <i class="fas fa-check-circle"></i>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);
  
  // Animer et supprimer après 3 secondes
  setTimeout(() => toast.classList.add('show'), 100);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================
// 5️⃣ CSS À AJOUTER (copier dans la section <style>)
// ============================================

/*
.ride-card {
  transition: all 0.3s ease;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.ride-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.15) !important;
}

.location-item {
  padding: 5px 0;
  font-size: 14px;
}

.location-item i {
  width: 20px;
  margin-right: 5px;
}

.price-section {
  border-left: 4px solid #007bff;
}

.badge-pill {
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 600;
}

.btn-block {
  display: block;
  width: 100%;
}

.btn {
  transition: all 0.2s ease;
  font-weight: 500;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}

.btn:active {
  transform: translateY(0);
}

.loader-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.7);
  display: none;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.loader-content {
  background: white;
  padding: 30px;
  border-radius: 10px;
  text-align: center;
}

.success-toast {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #28a745;
  color: white;
  padding: 15px 25px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  display: flex;
  align-items: center;
  gap: 10px;
  opacity: 0;
  transform: translateX(400px);
  transition: all 0.3s ease;
  z-index: 10000;
}

.success-toast.show {
  opacity: 1;
  transform: translateX(0);
}

.success-toast i {
  font-size: 20px;
}
*/

// ============================================
// 📝 NOTES D'UTILISATION
// ============================================

/*
1. Copie toute cette section JavaScript dans ton fichier HTML
2. Assure-toi qu'elle est APRÈS l'initialisation de Firebase
3. Copie le CSS dans la section <style> de ton HTML
4. Vérifie que tu as un élément avec id="rides-list" dans ton HTML
5. Appelle updateRidesList(rides) pour afficher les courses

STRUCTURE HTML NÉCESSAIRE :
<div id="rides-list"></div>

APPEL DE LA FONCTION :
loadDriverRides(); // Charge et affiche les courses

DÉPENDANCES :
- Firebase Firestore
- Font Awesome (pour les icônes)
- Bootstrap (pour les classes btn, badge, etc.)
*/
