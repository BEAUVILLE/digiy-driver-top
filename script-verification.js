// ========================================
// SCRIPT DE VÉRIFICATION - DIGIY DRIVER
// ========================================
// Copie ce code dans la console (F12) pour vérifier que tout fonctionne

console.log("🔍 DÉBUT DE LA VÉRIFICATION DIGIY DRIVER\n");

// 1. Vérifier Firebase
console.log("1️⃣ Vérification Firebase...");
try {
  if (typeof db !== 'undefined') {
    console.log("✅ Firebase database initialisé");
  } else {
    console.error("❌ Firebase database NON initialisé");
  }
} catch (e) {
  console.error("❌ Erreur Firebase:", e.message);
}

// 2. Vérifier les fonctions principales
console.log("\n2️⃣ Vérification des fonctions...");

const fonctionsRequises = [
  'updateRidesList',
  'displayRides',
  'updateRideStatus',
  'markAsPaid',
  'acceptRide',
  'rejectRide'
];

fonctionsRequises.forEach(fonction => {
  if (typeof window[fonction] === 'function') {
    console.log(`✅ ${fonction} existe`);
  } else {
    console.error(`❌ ${fonction} manquante`);
  }
});

// 3. Vérifier currentDriverId
console.log("\n3️⃣ Vérification du chauffeur...");
try {
  if (typeof currentDriverId !== 'undefined' && currentDriverId) {
    console.log(`✅ Driver ID: ${currentDriverId}`);
  } else {
    console.error("❌ currentDriverId non défini");
  }
} catch (e) {
  console.error("❌ Erreur driver ID:", e.message);
}

// 4. Vérifier les éléments DOM
console.log("\n4️⃣ Vérification des éléments DOM...");

const elementsRequis = [
  'ridesList',
  'currentRidesCount',
  'totalEarnings'
];

elementsRequis.forEach(id => {
  const element = document.getElementById(id);
  if (element) {
    console.log(`✅ Élément #${id} trouvé`);
  } else {
    console.error(`❌ Élément #${id} manquant`);
  }
});

// 5. Vérifier Bootstrap
console.log("\n5️⃣ Vérification Bootstrap...");
if (typeof bootstrap !== 'undefined') {
  console.log("✅ Bootstrap chargé");
} else {
  console.error("❌ Bootstrap NON chargé");
}

// 6. Tester la récupération des courses
console.log("\n6️⃣ Test de récupération des courses...");
try {
  if (typeof updateRidesList === 'function') {
    console.log("⏳ Appel de updateRidesList()...");
    updateRidesList();
    setTimeout(() => {
      const ridesList = document.getElementById('ridesList');
      if (ridesList && ridesList.children.length > 0) {
        console.log(`✅ ${ridesList.children.length} course(s) affichée(s)`);
        
        // Vérifier si les boutons sont présents
        const buttons = ridesList.querySelectorAll('button');
        if (buttons.length > 0) {
          console.log(`✅ ${buttons.length} bouton(s) trouvé(s)`);
        } else {
          console.error("❌ Aucun bouton trouvé dans les cartes");
        }
      } else {
        console.log("ℹ️ Aucune course disponible ou élément vide");
      }
    }, 2000);
  }
} catch (e) {
  console.error("❌ Erreur lors du test:", e.message);
}

// 7. Résumé
setTimeout(() => {
  console.log("\n" + "=".repeat(50));
  console.log("📊 RÉSUMÉ DE LA VÉRIFICATION");
  console.log("=".repeat(50));
  console.log("\nSi tu vois des ❌, il y a un problème à corriger.");
  console.log("Si tout est ✅, les boutons devraient s'afficher !\n");
  console.log("💡 TIPS:");
  console.log("- Si Firebase n'est pas initialisé : vérifie la config");
  console.log("- Si les fonctions manquent : applique le patch");
  console.log("- Si les boutons ne s'affichent pas : vérifie le HTML");
  console.log("- Si aucune course : crée une course test dans Firebase\n");
}, 3000);

// ========================================
// FONCTIONS DE TEST RAPIDE
// ========================================

// Créer une course test
window.creerCourseTest = function() {
  if (typeof db === 'undefined' || !currentDriverId) {
    console.error("❌ Firebase ou driver ID non disponible");
    return;
  }
  
  const testRide = {
    clientName: "Test Client",
    clientPhone: "+221 77 123 45 67",
    pickup: "Saly, Mbour",
    destination: "Dakar Centre",
    price: 10000,
    status: "pending",
    requestTime: new Date().toISOString(),
    isPaid: false
  };
  
  const newRideRef = push(ref(db, `rides/${currentDriverId}`));
  set(newRideRef, testRide)
    .then(() => {
      console.log("✅ Course test créée !");
    })
    .catch((error) => {
      console.error("❌ Erreur:", error);
    });
};

// Afficher toutes les courses
window.afficherCourses = function() {
  if (typeof db === 'undefined' || !currentDriverId) {
    console.error("❌ Firebase ou driver ID non disponible");
    return;
  }
  
  const ridesRef = ref(db, `rides/${currentDriverId}`);
  get(ridesRef).then((snapshot) => {
    if (snapshot.exists()) {
      console.log("📦 Courses trouvées:");
      snapshot.forEach((child) => {
        console.log(`\n🚗 Course ${child.key}:`);
        console.log(child.val());
      });
    } else {
      console.log("ℹ️ Aucune course dans Firebase");
    }
  });
};

// Nettoyer toutes les courses
window.nettoyerCourses = function() {
  if (!confirm("⚠️ Supprimer TOUTES les courses ?")) return;
  
  if (typeof db === 'undefined' || !currentDriverId) {
    console.error("❌ Firebase ou driver ID non disponible");
    return;
  }
  
  const ridesRef = ref(db, `rides/${currentDriverId}`);
  set(ridesRef, null)
    .then(() => {
      console.log("✅ Toutes les courses supprimées");
    })
    .catch((error) => {
      console.error("❌ Erreur:", error);
    });
};

console.log("\n💡 COMMANDES DISPONIBLES DANS LA CONSOLE:");
console.log("- creerCourseTest()  : Créer une course de test");
console.log("- afficherCourses()  : Voir toutes les courses");
console.log("- nettoyerCourses()  : Supprimer toutes les courses");
console.log("\n");
