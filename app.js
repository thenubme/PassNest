// Firebase configuration
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

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Set persistence to LOCAL for persistent login
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch((error) => {
        console.error('Persistence Error:', error);
    });

// Auth Providers
const googleProvider = new firebase.auth.GoogleAuthProvider();

// DOM Elements
const authTabs = document.querySelectorAll('.auth-tab');
const authForms = document.querySelectorAll('.auth-form');
const errorMessage = document.getElementById('error-message');

// Email/Password Elements
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const emailSignInBtn = document.getElementById('emailSignIn');
const emailSignUpBtn = document.getElementById('emailSignUp');
const googleSignInBtn = document.getElementById('googleSignIn');

// Tab Switching
authorTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab;
        
        // Update active tab
        authTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Show corresponding form
        authForms.forEach(form => {
            form.classList.remove('active');
            if (form.id === `${tabId}Auth`) {
                form.classList.add('active');
            }
        });
        
        // Clear error message
        errorMessage.style.display = 'none';
    });
});

// Email/Password Sign In
emailSignInBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            window.location.href = 'dashboard.html';
        })
        .catch((error) => {
            console.error('Email Sign In Error:', error);
            errorMessage.style.display = 'block';
            errorMessage.textContent = error.message;
        });
});

// Email/Password Sign Up
emailSignUpBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    auth.createUserWithEmailAndPassword(email, password)
        .then(() => {
            window.location.href = 'dashboard.html';
        })
        .catch((error) => {
            console.error('Email Sign Up Error:', error);
            errorMessage.style.display = 'block';
            errorMessage.textContent = error.message;
        });
});

// Google Sign In
googleSignInBtn.addEventListener('click', () => {
    auth.signInWithPopup(googleProvider)
        .then(() => {
            window.location.href = 'dashboard.html';
        })
        .catch((error) => {
            console.error('Google Auth Error:', error);
            errorMessage.style.display = 'block';
            errorMessage.textContent = error.message;
        });
});

// Auth state observer
auth.onAuthStateChanged((user) => {
    if (user) {
        if (window.location.pathname.endsWith('index.html')) {
            window.location.href = 'dashboard.html';
        }
    } else {
        if (!window.location.pathname.endsWith('index.html')) {
            window.location.href = 'index.html';
        }
    }
});