// ========================================
// PATCH COMPLET - BOUTONS D'ACTION CHAUFFEUR
// ========================================
// À ajouter dans digiy-driver-chauffeur.html
// Cherche la fonction updateRidesList() et remplace-la par celle-ci

function updateRidesList() {
  const ridesRef = ref(db, `rides/${currentDriverId}`);
  
  onValue(ridesRef, (snapshot) => {
    const rides = [];
    snapshot.forEach((childSnapshot) => {
      rides.push({
        id: childSnapshot.key,
        ...childSnapshot.val()
      });
    });
    
    // Trier par date (plus récent en premier)
    rides.sort((a, b) => new Date(b.requestTime) - new Date(a.requestTime));
    
    displayRides(rides);
  });
}

function displayRides(rides) {
  const ridesList = document.getElementById('ridesList');
  
  if (!rides || rides.length === 0) {
    ridesList.innerHTML = `
      <div class="alert alert-info text-center">
        <i class="fas fa-info-circle"></i> Aucune course disponible pour le moment
      </div>
    `;
    return;
  }
  
  ridesList.innerHTML = '';
  
  rides.forEach(ride => {
    const rideCard = document.createElement('div');
    rideCard.className = 'ride-card mb-3';
    
    // Déterminer la classe de statut
    let statusClass = 'bg-secondary';
    let statusText = ride.status || 'en attente';
    
    switch(ride.status) {
      case 'pending':
        statusClass = 'bg-warning';
        statusText = 'En attente';
        break;
      case 'accepted':
        statusClass = 'bg-info';
        statusText = 'Acceptée';
        break;
      case 'en_cours':
        statusClass = 'bg-primary';
        statusText = 'En cours';
        break;
      case 'completed':
        statusClass = 'bg-success';
        statusText = 'Terminée';
        break;
      case 'cancelled':
        statusClass = 'bg-danger';
        statusText = 'Annulée';
        break;
    }
    
    // Badge de paiement
    let paymentBadge = '';
    if (ride.status === 'completed') {
      if (ride.isPaid) {
        paymentBadge = '<span class="badge bg-success ms-2">💰 Payé</span>';
      } else {
        paymentBadge = '<span class="badge bg-danger ms-2">⏳ Non payé</span>';
      }
    }
    
    // Générer les boutons d'action selon le statut
    let actionButtons = '';
    
    // Si la course est acceptée ou en cours, afficher le bouton "Terminer"
    if (ride.status === 'accepted' || ride.status === 'en_cours') {
      actionButtons += `
        <button onclick="updateRideStatus('${ride.id}', 'completed')" 
                class="btn btn-success btn-sm w-100 mt-2">
          <i class="fas fa-check-circle"></i> Terminer la course
        </button>
      `;
    }
    
    // Si la course est terminée mais non payée, afficher le bouton "Marquer comme payé"
    if (ride.status === 'completed' && !ride.isPaid) {
      actionButtons += `
        <button onclick="markAsPaid('${ride.id}', ${ride.price || 0})" 
                class="btn btn-warning btn-sm w-100 mt-2">
          <i class="fas fa-money-bill-wave"></i> Marquer comme payé
        </button>
      `;
    }
    
    // Si la course est en attente, afficher les boutons accepter/refuser
    if (ride.status === 'pending') {
      actionButtons += `
        <div class="d-flex gap-2 mt-2">
          <button onclick="acceptRide('${ride.id}')" 
                  class="btn btn-success btn-sm flex-fill">
            <i class="fas fa-check"></i> Accepter
          </button>
          <button onclick="rejectRide('${ride.id}')" 
                  class="btn btn-danger btn-sm flex-fill">
            <i class="fas fa-times"></i> Refuser
          </button>
        </div>
      `;
    }
    
    rideCard.innerHTML = `
      <div class="card shadow-sm">
        <div class="card-header ${statusClass} text-white">
          <div class="d-flex justify-content-between align-items-center">
            <h6 class="mb-0">
              <i class="fas fa-taxi"></i> Course #${ride.id ? ride.id.substring(0, 8) : 'N/A'}
            </h6>
            <span class="badge bg-light text-dark">${statusText}</span>
          </div>
        </div>
        <div class="card-body">
          <div class="mb-2">
            <strong><i class="fas fa-user"></i> Client:</strong> 
            ${ride.clientName || 'Anonyme'}
            ${ride.clientPhone ? `<br><small class="text-muted"><i class="fas fa-phone"></i> ${ride.clientPhone}</small>` : ''}
          </div>
          
          <div class="mb-2">
            <strong><i class="fas fa-map-marker-alt text-success"></i> Départ:</strong>
            <br><small>${ride.pickup || 'Non défini'}</small>
          </div>
          
          <div class="mb-2">
            <strong><i class="fas fa-map-marker-alt text-danger"></i> Arrivée:</strong>
            <br><small>${ride.destination || 'Non défini'}</small>
          </div>
          
          <div class="mb-2">
            <strong><i class="fas fa-coins"></i> Prix:</strong> 
            <span class="text-success fw-bold">${ride.price || 0} FCFA</span>
            ${paymentBadge}
          </div>
          
          <div class="mb-2">
            <strong><i class="fas fa-clock"></i> Demandée le:</strong>
            <br><small class="text-muted">${ride.requestTime ? new Date(ride.requestTime).toLocaleString('fr-FR') : 'N/A'}</small>
          </div>
          
          ${ride.completedTime && ride.status === 'completed' ? `
            <div class="mb-2">
              <strong><i class="fas fa-flag-checkered"></i> Terminée le:</strong>
              <br><small class="text-muted">${new Date(ride.completedTime).toLocaleString('fr-FR')}</small>
            </div>
          ` : ''}
          
          ${ride.notes ? `
            <div class="mb-2">
              <strong><i class="fas fa-comment"></i> Notes:</strong>
              <br><small>${ride.notes}</small>
            </div>
          ` : ''}
          
          <!-- BOUTONS D'ACTION -->
          ${actionButtons}
        </div>
      </div>
    `;
    
    ridesList.appendChild(rideCard);
  });
}

// ========================================
// FONCTIONS D'ACTION (Si elles n'existent pas déjà)
// ========================================

// Fonction pour mettre à jour le statut d'une course
function updateRideStatus(rideId, newStatus) {
  if (!confirm(`Êtes-vous sûr de vouloir changer le statut de cette course ?`)) {
    return;
  }
  
  const rideRef = ref(db, `rides/${currentDriverId}/${rideId}`);
  const updateData = {
    status: newStatus
  };
  
  // Si on termine la course, ajouter l'horodatage
  if (newStatus === 'completed') {
    updateData.completedTime = new Date().toISOString();
  }
  
  update(rideRef, updateData)
    .then(() => {
      showAlert('success', `Statut mis à jour avec succès !`);
    })
    .catch((error) => {
      console.error('Erreur:', error);
      showAlert('error', `Erreur lors de la mise à jour: ${error.message}`);
    });
}

// Fonction pour marquer une course comme payée
function markAsPaid(rideId, amount) {
  if (!confirm(`Confirmer le paiement de ${amount} FCFA ?`)) {
    return;
  }
  
  const rideRef = ref(db, `rides/${currentDriverId}/${rideId}`);
  const paymentData = {
    isPaid: true,
    paidAt: new Date().toISOString(),
    paidAmount: amount
  };
  
  update(rideRef, paymentData)
    .then(() => {
      showAlert('success', `Paiement enregistré ! 💰`);
      
      // Mettre à jour les gains du chauffeur
      const driverRef = ref(db, `drivers/${currentDriverId}/earnings`);
      get(driverRef).then((snapshot) => {
        const currentEarnings = snapshot.val() || 0;
        const newEarnings = currentEarnings + amount;
        
        update(ref(db, `drivers/${currentDriverId}`), {
          earnings: newEarnings,
          lastPaymentTime: new Date().toISOString()
        });
      });
    })
    .catch((error) => {
      console.error('Erreur:', error);
      showAlert('error', `Erreur lors de l'enregistrement du paiement: ${error.message}`);
    });
}

// Fonction pour accepter une course
function acceptRide(rideId) {
  updateRideStatus(rideId, 'accepted');
}

// Fonction pour refuser une course
function rejectRide(rideId) {
  if (confirm('Êtes-vous sûr de vouloir refuser cette course ?')) {
    updateRideStatus(rideId, 'cancelled');
  }
}

// Fonction pour afficher les alertes
function showAlert(type, message) {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type === 'success' ? 'success' : 'danger'} alert-dismissible fade show position-fixed`;
  alertDiv.style.cssText = 'top: 80px; right: 20px; z-index: 9999; min-width: 300px;';
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  document.body.appendChild(alertDiv);
  
  setTimeout(() => {
    alertDiv.remove();
  }, 3000);
}

// ========================================
// STYLES CSS À AJOUTER (si pas déjà présents)
// ========================================
/*
.ride-card {
  transition: transform 0.2s;
}

.ride-card:hover {
  transform: translateY(-2px);
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
}

.card-header {
  padding: 0.75rem 1rem;
}

.badge {
  padding: 0.35em 0.65em;
  font-size: 0.85em;
}
*/
