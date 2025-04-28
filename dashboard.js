// Initialize Firebase components
const auth = firebase.auth();
const db = firebase.firestore();

// Vault encryption key
let vaultKey = null;

// Inactivity timeout (10 minutes)
let inactivityTimer = null;

// DOM Elements
const logoutBtn = document.getElementById('logoutBtn');
const vaultModal = document.getElementById('vaultModal');
const masterPasswordInput = document.getElementById('masterPasswordInput');
const confirmMasterPasswordInput = document.getElementById('confirmMasterPasswordInput');
const unlockBtn = document.getElementById('unlockBtn');
const createMasterBtn = document.getElementById('createMasterBtn');
const addPasswordForm = document.getElementById('addPasswordForm');
const passwordsList = document.getElementById('passwordsList');
const messageDiv = document.getElementById('message');
const showStoredPasswordsBtn = document.getElementById('showStoredPasswordsBtn');
const storedPasswordsModal = document.getElementById('storedPasswordsModal');
const websitesList = document.getElementById('websitesList');
const passwordDetails = document.getElementById('passwordDetails');
const selectedWebsite = document.getElementById('selectedWebsite');
const decryptedPassword = document.getElementById('decryptedPassword');
const copyDecryptedBtn = document.getElementById('copyDecryptedBtn');
const closeStoredPasswordsBtn = document.getElementById('closeStoredPasswordsBtn');
let currentUser = null;

// At the top, import or include VaultSessionManager.js
// <script src="VaultSessionManager.js"></script> in HTML, or import if using modules

// On page load, try to restore session
VaultSession.tryRestore();

// Helper to get user's vaultSalt
async function getVaultSalt(userId) {
    const snapshot = await firebase.database().ref('users/' + userId + '/vaultSalt').once('value');
    return snapshot.val();
}

// Encrypt password using PBKDF2-derived key and user's vaultSalt
async function encryptPassword(plain) {
    const vaultKey = await VaultSession.get();
    const userId = auth.currentUser.uid;
    const salt = await getVaultSalt(userId);
    const key = CryptoJS.PBKDF2(vaultKey, CryptoJS.enc.Hex.parse(salt), { keySize: 256/32, iterations: 100000 });
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(plain, key, { iv });
    return salt + ':' + iv.toString() + ':' + encrypted.toString();
}

// Decrypt password using PBKDF2-derived key and salt from entry
async function decryptPassword(encString) {
    const vaultKey = await VaultSession.get();
    if (!vaultKey) return '';
    const [salt, ivHex, cipherText] = encString.split(':');
    const key = CryptoJS.PBKDF2(vaultKey, CryptoJS.enc.Hex.parse(salt), { keySize: 256/32, iterations: 100000 });
    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const decrypted = CryptoJS.AES.decrypt(cipherText, key, { iv });
    return decrypted.toString(CryptoJS.enc.Utf8);
}

// Show message function
function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.style.display = 'block';
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 3000);
}

// Add new password
addPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const vaultKey = await VaultSession.get();
    if (!vaultKey) {
        alert('Please unlock your vault before adding a password.');
        vaultModal.style.display = 'flex';
        return;
    }
    const website = document.getElementById('website').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    console.log('Add Password Clicked:', { website, username, password });
    try {
        const userId = auth.currentUser ? auth.currentUser.uid : null;
        console.log('Current userId:', userId);
        if (!userId) {
            console.error('No authenticated user found!');
            showMessage('No authenticated user found!', 'error');
            return;
        }
        const encryptedPassword = await encryptPassword(password);
        console.log('Encrypted Password:', encryptedPassword);

        const passwordData = {
            website,
            username,
            password: encryptedPassword,
            createdAt: Date.now()
        };
        console.log('Attempting to add to RTDB at path:', 'users/' + userId + '/passwords');
        console.log('Password data to write:', passwordData);
        await firebase.database().ref('users/' + userId + '/passwords').push(passwordData)
            .then(() => {
                console.log('Password added to RTDB!');
            })
            .catch((err) => {
                console.error('Error from RTDB push:', err);
                showMessage('Failed to add password (RTDB error)', 'error');
                return;
            });

        addPasswordForm.reset();
        showMessage('Password added successfully!', 'success');
        loadPasswords();
    } catch (error) {
        console.error('Error adding password (detailed):', error);
        showMessage('Failed to add password', 'error');
    }
});

// Load passwords
async function loadPasswords() {
    if (!auth.currentUser) return;

    try {
        const userId = auth.currentUser.uid;
        const snapshot = await firebase.database().ref('users/' + userId + '/passwords').orderByChild('createdAt').once('value');
        passwordsList.innerHTML = '';
        const passwords = snapshot.val() || {};
        // Reverse order (latest first)
        const passwordEntries = Object.entries(passwords).sort((a, b) => b[1].createdAt - a[1].createdAt);
        passwordEntries.forEach(([key, data]) => {
            const passwordItem = document.createElement('div');
            passwordItem.className = 'password-item';
            const decrypted = decryptPassword(data.password);
            passwordItem.innerHTML = `
                <div class="password-details">
                    <h3>${data.website}</h3>
                    <p>${data.username}</p>
                </div>
                <div class="password-actions">
                    <button class="copy-btn" onclick="copyPassword('${key}')">Copy Password</button>
                    <button class="delete-btn" onclick="deletePassword('${key}')">Delete</button>
                </div>
            `;
            passwordsList.appendChild(passwordItem);
        });
    } catch (error) {
        console.error('Error loading passwords:', error);
        showMessage('Failed to load passwords', 'error');
    }
}

// Copy password
async function copyPassword(key) {
    try {
        const userId = auth.currentUser.uid;
        const snapshot = await firebase.database().ref('users/' + userId + '/passwords/' + key).once('value');
        const data = snapshot.val();
        if (!data) throw new Error('Password not found');
        const password = await decryptPassword(data.password);
        await navigator.clipboard.writeText(password);
        showMessage('Password copied to clipboard!', 'success');
    } catch (error) {
        console.error('Error copying password:', error);
        showMessage('Failed to copy password', 'error');
    }
}

// Delete password
async function deletePassword(key) {
    if (!confirm('Are you sure you want to delete this password?')) return;

    try {
        const userId = auth.currentUser.uid;
        await firebase.database().ref('users/' + userId + '/passwords/' + key).remove();
        showMessage('Password deleted successfully!', 'success');
        loadPasswords();
    } catch (error) {
        console.error('Error deleting password:', error);
        showMessage('Failed to delete password', 'error');
    }
}

// Logout
logoutBtn.addEventListener('click', () => {
    auth.signOut()
        .then(() => {
            VaultSession.clear();
            window.location.href = 'index.html';
        })
        .catch(error => {
            console.error('Error signing out:', error);
            showMessage('Failed to sign out', 'error');
        });
});

// Show unlock or create modal based on vault existence
auth.onAuthStateChanged(async user => {
    if (user) {
        currentUser = user;
        // Use VaultSession.get() to check for vault key
        const vaultKey = await VaultSession.get();
        if (vaultKey) {
            vaultModal.style.display = 'none';
            loadPasswords();
        } else {
            vaultModal.style.display = 'flex';
        }
        // Check master password metadata in Realtime Database
        const snapshot = await firebase.database().ref('users/' + user.uid).once('value');
        const data = snapshot.val() || {};
        if (data.vaultSalt && data.vaultHash) {
            // Unlock mode
            document.getElementById('vaultModalHeader').innerText = 'Unlock Your Vault';
            masterPasswordInput.placeholder = 'Master Password';
            confirmMasterPasswordInput.style.display = 'none';
            unlockBtn.style.display = 'inline-block';
            createMasterBtn.style.display = 'none';
        } else {
            // Create mode
            document.getElementById('vaultModalHeader').innerText = 'Create Master Password';
            masterPasswordInput.placeholder = 'New Master Password';
            confirmMasterPasswordInput.style.display = 'block';
            createMasterBtn.style.display = 'inline-block';
            unlockBtn.style.display = 'none';
        }
    } else {
        window.location.href = 'index.html';
    }
});

// Create master password
createMasterBtn.addEventListener('click', async () => {
    const pass = masterPasswordInput.value.trim();
    const confirmPass = confirmMasterPasswordInput.value.trim();
    if (!pass || !confirmPass) { alert('Both fields are required'); return; }
    if (pass !== confirmPass) { alert('Passwords do not match'); return; }
    // Derive vault hash using PBKDF2
    const salt = CryptoJS.lib.WordArray.random(16).toString();
    const keyHash = CryptoJS.PBKDF2(pass, CryptoJS.enc.Hex.parse(salt), { keySize: 256/32, iterations: 100000 }).toString();
    // Store salt and hash in Realtime Database
    await firebase.database().ref('users/' + currentUser.uid + '/vaultSalt').set(salt);
    await firebase.database().ref('users/' + currentUser.uid + '/vaultHash').set(keyHash);
    await VaultSession.set(pass);
    vaultModal.style.display = 'none';
    loadPasswords();
    VaultSession.resetInactivityTimer();
});

// Handle vault unlocking
unlockBtn.addEventListener('click', async () => {
    const pass = masterPasswordInput.value.trim();
    if (!pass) { alert('Enter the master password'); return; }
    // Fetch stored salt and hash
    const snapshot = await firebase.database().ref('users/' + currentUser.uid + '/vaultSalt').once('value');
    const salt = await snapshot.val();
    const keyHash = CryptoJS.PBKDF2(pass, CryptoJS.enc.Hex.parse(salt), { keySize: 256/32, iterations: 100000 }).toString();
    const storedHash = await firebase.database().ref('users/' + currentUser.uid + '/vaultHash').once('value');
    const storedKeyHash = await storedHash.val();
    if (keyHash === storedKeyHash) {
        await VaultSession.set(pass);
        vaultModal.style.display = 'none';
        loadPasswords();
        VaultSession.resetInactivityTimer();
    } else {
        alert('Incorrect master password');
    }
});

// Modal logout button handler
const logoutModalBtn = document.getElementById('logoutModalBtn');
logoutModalBtn.addEventListener('click', () => {
    auth.signOut().then(() => {
        VaultSession.clear();
        window.location.href = 'index.html';
    });
});

// Show stored passwords modal
showStoredPasswordsBtn.addEventListener('click', () => {
    window.location.href = 'stored-passwords.html';
});

copyDecryptedBtn.addEventListener('click', () => {
    if (decryptedPassword.value) {
        navigator.clipboard.writeText(decryptedPassword.value);
        showMessage('Password copied to clipboard!', 'success');
    }
});

closeStoredPasswordsBtn.addEventListener('click', () => {
    storedPasswordsModal.style.display = 'none';
    passwordDetails.style.display = 'none';
});

// On user activity, reset inactivity timer
['click', 'mousemove', 'keydown', 'scroll'].forEach(evt => {
    window.addEventListener(evt, VaultSession.resetInactivityTimer);
});

// Reset Vault Password Modal logic
const resetVaultBtn = document.getElementById('resetVaultBtn');
const resetVaultModal = document.getElementById('resetVaultModal');
const resetVaultConfirmBtn = document.getElementById('resetVaultConfirmBtn');
const resetVaultCancelBtn = document.getElementById('resetVaultCancelBtn');

resetVaultBtn.addEventListener('click', () => {
    resetVaultModal.style.display = 'block';
});
resetVaultCancelBtn.addEventListener('click', () => {
    resetVaultModal.style.display = 'none';
    document.getElementById('currentVaultPassword').value = '';
    document.getElementById('newVaultPassword').value = '';
    document.getElementById('confirmNewVaultPassword').value = '';
});

resetVaultConfirmBtn.addEventListener('click', async () => {
    const currentPass = document.getElementById('currentVaultPassword').value;
    const newPass = document.getElementById('newVaultPassword').value;
    const confirmPass = document.getElementById('confirmNewVaultPassword').value;
    if (!currentPass || !newPass || !confirmPass) {
        alert('Please fill all fields.');
        return;
    }
    if (newPass !== confirmPass) {
        alert('New passwords do not match.');
        return;
    }
    try {
        // 1. Validate current password
        const userId = firebase.auth().currentUser.uid;
        // Fetch current salt and hash from correct path
        const saltSnap = await firebase.database().ref('users/' + userId + '/vaultSalt').once('value');
        const hashSnap = await firebase.database().ref('users/' + userId + '/vaultHash').once('value');
        const currentSalt = saltSnap.val();
        const currentHash = hashSnap.val();
        if (!currentSalt || !currentHash) {
            alert('Vault not found.');
            return;
        }
        // Derive hash from currentPass
        const derivedHash = CryptoJS.PBKDF2(currentPass, CryptoJS.enc.Hex.parse(currentSalt), { keySize: 256/32, iterations: 100000 }).toString();
        if (derivedHash !== currentHash) {
            alert('Current password is incorrect.');
            return;
        }
        // 2. Generate new salt and hash for new password
        const newSalt = CryptoJS.lib.WordArray.random(16).toString();
        const newHash = CryptoJS.PBKDF2(newPass, CryptoJS.enc.Hex.parse(newSalt), { keySize: 256/32, iterations: 100000 }).toString();
        // 3. Re-encrypt all passwords
        const passwordsRef = firebase.database().ref('users/' + userId + '/passwords');
        const passwordsSnap = await passwordsRef.once('value');
        const passwords = passwordsSnap.val() || {};
        const oldKey = CryptoJS.PBKDF2(currentPass, CryptoJS.enc.Hex.parse(currentSalt), { keySize: 256/32, iterations: 100000 });
        const newKey = CryptoJS.PBKDF2(newPass, CryptoJS.enc.Hex.parse(newSalt), { keySize: 256/32, iterations: 100000 });
        const updates = {};
        for (const key in passwords) {
            const entry = passwords[key];
            // Decrypt with old key
            let decrypted = '';
            try {
                const parts = entry.password.split(':');
                if (parts.length === 3) {
                    // salt:iv:cipherText
                    const [salt, iv, cipherText] = parts;
                    const derivedKey = CryptoJS.PBKDF2(currentPass, CryptoJS.enc.Hex.parse(salt), { keySize: 256/32, iterations: 100000 });
                    const decryptedBytes = CryptoJS.AES.decrypt(cipherText, derivedKey, { iv: CryptoJS.enc.Hex.parse(iv) });
                    decrypted = decryptedBytes.toString(CryptoJS.enc.Utf8);
                } else {
                    // fallback for old format
                    const decryptedBytes = CryptoJS.AES.decrypt(entry.password, oldKey);
                    decrypted = decryptedBytes.toString(CryptoJS.enc.Utf8);
                }
            } catch (e) {
                console.error('Failed to decrypt password for', key, e);
                continue;
            }
            // Encrypt with new key and new salt
            const newIv = CryptoJS.lib.WordArray.random(16).toString();
            const encrypted = CryptoJS.AES.encrypt(decrypted, newKey, { iv: CryptoJS.enc.Hex.parse(newIv) }).toString();
            updates[key + '/password'] = `${newSalt}:${newIv}:${encrypted}`;
        }
        // 4. Update vault salt and hash at correct path
        await firebase.database().ref('users/' + userId + '/vaultSalt').set(newSalt);
        await firebase.database().ref('users/' + userId + '/vaultHash').set(newHash);
        // 5. Update all passwords
        await passwordsRef.update(updates);
        // 6. Update session
        await VaultSession.set(newPass);
        alert('Vault password reset successfully!');
        resetVaultModal.style.display = 'none';
        document.getElementById('currentVaultPassword').value = '';
        document.getElementById('newVaultPassword').value = '';
        document.getElementById('confirmNewVaultPassword').value = '';
    } catch (err) {
        console.error('Error resetting vault password:', err);
        alert('Failed to reset vault password. See console for details.');
    }
});

// ================= PASSWORD GENERATOR LOGIC =================

const CHAR_SETS = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  ambiguous: '0OoIl1lI|`~"' + "'\\/,;:.{}[]()<>"
};

function buildCharset({ useLower, useUpper, useNumbers, useSymbols, charsetMode }) {
  let chars = '';
  if (useLower) chars += CHAR_SETS.lowercase;
  if (useUpper) chars += CHAR_SETS.uppercase;
  if (useNumbers) chars += CHAR_SETS.numbers;
  if (useSymbols) chars += CHAR_SETS.symbols;

  // Remove ambiguous chars for easyRead/easySay
  if (charsetMode === 'easyRead') {
    chars = chars.split('').filter(c => !CHAR_SETS.ambiguous.includes(c)).join('');
  }
  // Remove symbols and ambiguous chars for easySay
  if (charsetMode === 'easySay') {
    chars = chars.split('').filter(c => !CHAR_SETS.ambiguous.includes(c) && !CHAR_SETS.symbols.includes(c)).join('');
  }

  if (!chars.length) {
    throw new Error('At least one character type must be selected.');
  }
  return chars;
}

function generateSecurePassword(length, charset) {
  const array = new Uint32Array(length);
  window.crypto.getRandomValues(array);
  return Array.from(array, x => charset[x % charset.length]).join('');
}

function generatePassword(settings) {
  const charset = buildCharset(settings);
  return generateSecurePassword(settings.length, charset);
}

function copyToClipboard(text) {
  const copyMsg = document.getElementById('generatorCopyMessage');
  if (copyMsg) {
    copyMsg.style.opacity = 0;
    copyMsg.style.display = 'inline-block';
    copyMsg.textContent = '';
  }
  navigator.clipboard.writeText(text)
    .then(() => {
      if (copyMsg) {
        copyMsg.textContent = 'Copied!';
        copyMsg.style.color = '#2193b0';
        copyMsg.style.transition = 'opacity 0.3s';
        copyMsg.style.opacity = 1;
        setTimeout(() => {
          copyMsg.style.opacity = 0;
          setTimeout(() => copyMsg.style.display = 'none', 300);
        }, 1200);
      }
    })
    .catch(() => {
      if (copyMsg) {
        copyMsg.textContent = 'Failed to copy.';
        copyMsg.style.color = '#ff4444';
        copyMsg.style.transition = 'opacity 0.3s';
        copyMsg.style.opacity = 1;
        setTimeout(() => {
          copyMsg.style.opacity = 0;
          setTimeout(() => copyMsg.style.display = 'none', 300);
        }, 1200);
      }
    });
}

// Sync slider and number input
const lengthInput = document.getElementById('length');
const lengthSlider = document.getElementById('lengthSlider');
if (lengthInput && lengthSlider) {
  lengthInput.addEventListener('input', e => {
    lengthSlider.value = lengthInput.value;
  });
  lengthSlider.addEventListener('input', e => {
    lengthInput.value = lengthSlider.value;
  });
}

window.handleGenerate = function() {
  const settings = {
    length: parseInt(document.getElementById('length').value),
    useLower: document.getElementById('lower').checked,
    useUpper: document.getElementById('upper').checked,
    useNumbers: document.getElementById('numbers').checked,
    useSymbols: document.getElementById('symbols').checked,
    charsetMode: document.getElementById('easySay').checked ? 'easySay' : (document.getElementById('easyRead').checked ? 'easyRead' : 'allChars')
  };

  try {
    const pwd = generatePassword(settings);
    document.getElementById('output').value = pwd;
  } catch (err) {
    alert(err.message);
  }
}

window.handleCopy = function() {
  const pwd = document.getElementById('output').value;
  if (pwd) copyToClipboard(pwd);
}