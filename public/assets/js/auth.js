// assets/js/auth.js

// Firebase Configuration (Replace with your actual Firebase project credentials)
// Firebase CDN web app configuration
const firebaseConfig = {
  apiKey: "AIzaSyBxGf8yoPx8DPSzzDElnURXtUabYYk3530",
  authDomain: "iyattral-payroll.firebaseapp.com",
  projectId: "iyattral-payroll",
  storageBucket: "iyattral-payroll.firebasestorage.app",
  messagingSenderId: "1050963524949",
  appId: "1:1050963524949:web:1bc0137099c57fbaffc3dc",
  measurementId: "G-KN3MW7VD4P"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();

// Auth state observer to manage login modal visibility
auth.onAuthStateChanged((user) => {
    const loginModal = document.getElementById('firebaseLoginModal');
    if (user) {
        // User is signed in
        if (loginModal) loginModal.style.display = 'none';
        console.log("🔐 Admin authenticated:", user.email);
    } else {
        // User is signed out
        if (loginModal) loginModal.style.display = 'flex';
    }
});

// Handle Login Form Submission
window.handleFirebaseLogin = function(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorMsg = document.getElementById('loginErrorMsg');
    const submitBtn = document.getElementById('loginSubmitBtn');

    if (errorMsg) errorMsg.style.display = 'none';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Signing in...';
    }

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Success handled automatically by onAuthStateChanged
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Secure Sign In';
            }
        })
        .catch((error) => {
            if (errorMsg) {
                errorMsg.style.display = 'block';
                errorMsg.innerText = `❌ Authentication failed: ${error.message}`;
            }
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Secure Sign In';
            }
        });
};

// Handle Logout
window.handleFirebaseLogout = function() {
    if (confirm("Are you sure you want to log out of the admin session?")) {
        auth.signOut().then(() => {
            window.location.reload();
        }).catch((error) => {
            console.error("Logout error:", error);
        });
    }
};