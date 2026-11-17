// assets/js/auth.js

// Firebase Configuration (Replace with your actual Firebase project credentials)
const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
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