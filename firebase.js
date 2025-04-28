// firebase.js
// Firebase configuration and initialization
const firebaseConfig = {
    apiKey: "AIzaSyA5KrGZoiNh_W8kpvDxyCf4M6Too-ExVXw",
    authDomain: "passnest-2fc90.firebaseapp.com",
    databaseURL: "https://passnest-2fc90-default-rtdb.firebaseio.com",
    projectId: "passnest-2fc90",
    storageBucket: "passnest-2fc90.firebasestorage.app",
    messagingSenderId: "1013071452807",
    appId: "1:1013071452807:web:2fda40c1f701b2e616b622",
    measurementId: "G-QS95XW4BYX"
};

// Initialize Firebase only if not already initialized
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Auth provider for Google
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

// Backend functions for authentication
window.passNestBackend = {
    loginUser: async (email, password) => {
        try {
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    registerUser: async (email, password) => {
        try {
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    signInWithGoogle: async () => {
        try {
            const result = await firebase.auth().signInWithPopup(googleProvider);
            return { success: true, user: result.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};

// Handle redirect result
firebase.auth().getRedirectResult().then((result) => {
    if (result.user) {
        window.location.href = 'dashboard.html';
    }
}).catch((error) => {
    console.error('Redirect error:', error);
});