// VaultSessionManager.js
// Secure session manager for vault key with encrypted localStorage fallback

const VaultSession = (() => {
    const VAULT_KEY_STORAGE = 'vaultSession';
    const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes
    let sessionKey = null; // CryptoKey, in-memory only
    let inactivityTimer = null;

    // Generate a random AES-GCM session key
    async function generateSessionKey() {
        return await window.crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    }

    // Export CryptoKey to raw bytes
    async function exportKey(key) {
        return new Uint8Array(await window.crypto.subtle.exportKey('raw', key));
    }

    // Import raw bytes as CryptoKey
    async function importKey(raw) {
        return await window.crypto.subtle.importKey(
            'raw',
            raw,
            { name: 'AES-GCM' },
            false,
            ['encrypt', 'decrypt']
        );
    }

    // Export CryptoKey to base64
    async function exportKeyBase64(key) {
        const raw = new Uint8Array(await window.crypto.subtle.exportKey('raw', key));
        return btoa(String.fromCharCode(...raw));
    }

    // Import base64 as CryptoKey
    async function importKeyBase64(b64) {
        const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        return await importKey(raw);
    }

    // Encrypt vault key
    async function encryptVaultKey(vaultKey, key) {
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(vaultKey);
        const ciphertext = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            encoded
        );
        return {
            ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
            iv: btoa(String.fromCharCode(...iv))
        };
    }

    // Decrypt vault key
    async function decryptVaultKey(ciphertext, iv, key) {
        const ct = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
        const ivArr = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
        const decrypted = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: ivArr },
            key,
            ct
        );
        return new TextDecoder().decode(decrypted);
    }

    // Set vault key (encrypt and store in localStorage, set in sessionStorage)
    async function set(vaultKey) {
        sessionKey = await generateSessionKey();
        // Store sessionKey in sessionStorage as base64
        const sessionKeyB64 = await exportKeyBase64(sessionKey);
        sessionStorage.setItem('vaultSessionKey', sessionKeyB64);
        const encrypted = await encryptVaultKey(vaultKey, sessionKey);
        localStorage.setItem(VAULT_KEY_STORAGE, JSON.stringify({
            iv: encrypted.iv,
            ciphertext: encrypted.ciphertext,
            session: true,
            timestamp: Date.now()
        }));
        sessionStorage.setItem('vaultKey', vaultKey);
        resetInactivityTimer();
    }

    // Get vault key (from sessionStorage if present, else try to decrypt from localStorage)
    async function get() {
        let vaultKey = sessionStorage.getItem('vaultKey');
        if (vaultKey) return vaultKey;
        const session = JSON.parse(localStorage.getItem(VAULT_KEY_STORAGE));
        if (!session) return null;
        const maxSessionAge = INACTIVITY_TIMEOUT;
        if (Date.now() - session.timestamp > maxSessionAge) {
            clear();
            return null;
        }
        // Restore sessionKey from sessionStorage if possible
        if (!sessionKey) {
            const sessionKeyB64 = sessionStorage.getItem('vaultSessionKey');
            if (sessionKeyB64) {
                sessionKey = await importKeyBase64(sessionKeyB64);
            }
        }
        if (!sessionKey) {
            return null; // Can't decrypt without session key
        }
        try {
            vaultKey = await decryptVaultKey(session.ciphertext, session.iv, sessionKey);
            sessionStorage.setItem('vaultKey', vaultKey);
            resetInactivityTimer();
            return vaultKey;
        } catch (e) {
            clear();
            return null;
        }
    }

    // Clear session (logout or timeout)
    function clear() {
        sessionKey = null;
        sessionStorage.removeItem('vaultKey');
        sessionStorage.removeItem('vaultSessionKey');
        localStorage.removeItem(VAULT_KEY_STORAGE);
        if (inactivityTimer) clearTimeout(inactivityTimer);
    }

    // Reset inactivity timer
    function resetInactivityTimer() {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            clear();
            alert('Vault locked due to inactivity');
            window.location.reload();
        }, INACTIVITY_TIMEOUT);
    }

    // On page load, try to restore session if sessionKey is present
    async function tryRestore() {
        // If sessionKey is present (e.g., page refresh), try to restore vaultKey
        await get();
    }

    return {
        set,
        get,
        clear,
        resetInactivityTimer,
        tryRestore,
        setSessionKey: (key) => { sessionKey = key; },
        getSessionKey: () => sessionKey
    };
})();

// Usage:
// await VaultSession.set('myVaultKey');
// let key = await VaultSession.get();
// VaultSession.clear();
// VaultSession.resetInactivityTimer();
// VaultSession.setSessionKey(sessionKey); // for restoring after refresh
// VaultSession.tryRestore(); // on page load 