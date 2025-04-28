// Encryption utility functions
const ENCRYPTION_KEY = "your-encryption-key-here"; // Replace with your actual key
const ENCRYPTION_SALT = "your-salt-here"; // Replace with your actual salt

function encrypt(text) {
    return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
}

function decrypt(ciphertext) {
    const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
}

// Make functions available globally
window.encryptionUtils = {
    encrypt,
    decrypt
}; 