// stored-passwords.js
// Assumes firebase, CryptoJS loaded
const auth = firebase.auth();
const db = firebase.firestore();

const websitesList = document.getElementById('websitesList');
const passwordDetails = document.getElementById('passwordDetails');
const selectedWebsite = document.getElementById('selectedWebsite');
const decryptedPassword = document.getElementById('decryptedPassword');
const copyDecryptedBtn = document.getElementById('copyDecryptedBtn');
const websiteLink = document.getElementById('websiteLink');
const logoutBtn = document.getElementById('logoutBtn');

// At the top, import or include VaultSessionManager.js
// <script src="VaultSessionManager.js"></script> in HTML, or import if using modules

// On page load, try to restore session
VaultSession.tryRestore();

// Use VaultSession.get() for decryption with PBKDF2 and salt
async function decryptPassword(encString) {
    const vaultKey = await VaultSession.get();
    if (!vaultKey) return '';
    const [salt, ivHex, cipherText] = encString.split(':');
    const key = CryptoJS.PBKDF2(vaultKey, CryptoJS.enc.Hex.parse(salt), { keySize: 256/32, iterations: 100000 });
    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const decrypted = CryptoJS.AES.decrypt(cipherText, key, { iv });
    return decrypted.toString(CryptoJS.enc.Utf8);
}

auth.onAuthStateChanged(async user => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    // Fetch all passwords for user from RTDB
    websitesList.innerHTML = '<em>Loading...</em>';
    const userId = user.uid;
    const snapshot = await firebase.database().ref('users/' + userId + '/passwords').orderByChild('createdAt').once('value');
    const passwords = snapshot.val() || {};
    const sites = Object.entries(passwords).map(([id, data]) => ({ id, website: data.website, username: data.username, password: data.password }));
    if (sites.length === 0) {
        websitesList.innerHTML = '<p>No passwords stored yet.</p>';
        return;
    }
    websitesList.innerHTML = '';
    for (const site of sites) {
        const card = document.createElement('div');
        card.className = 'website-card';
        card.innerHTML = `
            <div class="website-title">${site.website}</div>
            <div>
                <a href="${/^https?:\/\//.test(site.website) ? site.website : 'https://' + site.website}" target="_blank" class="website-link">Visit</a>
                <button class="show-btn">Show Password</button>
            </div>
            <div class="password-row" style="display:none;">
                <input type="text" class="website-password" readonly value="" />
                <button class="copy-btn">Copy Password</button>
                <span class="copy-message">Copied!</span>
            </div>
        `;
        const showBtn = card.querySelector('.show-btn');
        const passRow = card.querySelector('.password-row');
        const passInput = card.querySelector('.website-password');
        const copyBtn = card.querySelector('.copy-btn');
        const copyMsg = card.querySelector('.copy-message');
        let shown = false;
        showBtn.addEventListener('click', async () => {
            if (!shown) {
                showBtn.textContent = 'Hide Password';
                passRow.style.display = 'flex';
                passInput.value = 'Decrypting...';
                const decrypted = await decryptPassword(site.password);
                passInput.value = decrypted;
                shown = true;
            } else {
                showBtn.textContent = 'Show Password';
                passRow.style.display = 'none';
                shown = false;
            }
        });
        copyBtn.addEventListener('click', () => {
            if (passInput.value) {
                navigator.clipboard.writeText(passInput.value);
                copyMsg.textContent = 'Copied!';
                copyMsg.classList.add('visible');
                setTimeout(() => copyMsg.classList.remove('visible'), 1200);
            }
        });
        websitesList.appendChild(card);
    }
});

copyDecryptedBtn.addEventListener('click', () => {
    if (decryptedPassword.value) {
        navigator.clipboard.writeText(decryptedPassword.value);
        const copyMsg = document.getElementById('copyMessage');
        if (copyMsg) {
            copyMsg.style.display = 'inline';
            setTimeout(() => copyMsg.style.display = 'none', 1200);
        }
    }
});

logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    });
}); 