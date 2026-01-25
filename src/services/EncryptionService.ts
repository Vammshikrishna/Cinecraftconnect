

export class EncryptionService {
    private static readonly ALGORITHM_NAME = 'ECDH';
    private static readonly NAMED_CURVE = 'P-256';
    private static readonly DB_NAME = 'cinecraft_e2ee';
    private static readonly STORE_NAME = 'keys';
    private static readonly KEY_ID = 'user_private_key';
    private static readonly PUB_KEY_ID = 'user_public_key';

    // --- IndexedDB Helpers ---

    private static async getDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, 2); // Bumpped version
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME);
                }
            };
        });
    }

    public static async storeKeyPair(keyPair: CryptoKeyPair): Promise<void> {
        const db = await this.getDB();
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);
        store.put(keyPair.privateKey, this.KEY_ID);
        store.put(keyPair.publicKey, this.PUB_KEY_ID);
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    // Legacy support
    public static async storePrivateKey(privateKey: CryptoKey): Promise<void> {
        // This is deprecated but kept for compatibility. Ideally we need the pair.
        const db = await this.getDB();
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);
        store.put(privateKey, this.KEY_ID);
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    static async getPrivateKey(): Promise<CryptoKey | null> {
        const db = await this.getDB();
        const tx = db.transaction(this.STORE_NAME, 'readonly');
        const store = tx.objectStore(this.STORE_NAME);
        const request = store.get(this.KEY_ID);
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error || new Error('GetKey failed'));
        });
    }

    static async getPublicKey(): Promise<CryptoKey | null> {
        const db = await this.getDB();
        const tx = db.transaction(this.STORE_NAME, 'readonly');
        const store = tx.objectStore(this.STORE_NAME);
        const request = store.get(this.PUB_KEY_ID);
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error || new Error('GetKey failed'));
        });
    }

    // --- Crypto Helpers ---

    // Generate Key Pair
    static async generateKeyPair(): Promise<CryptoKeyPair> {
        return await window.crypto.subtle.generateKey(
            {
                name: this.ALGORITHM_NAME,
                namedCurve: this.NAMED_CURVE,
            },
            true, // extractable
            ['deriveKey', 'deriveBits']
        );
    }

    // Export Key to Base64
    static async exportKey(key: CryptoKey): Promise<string> {
        const exported = await window.crypto.subtle.exportKey(
            key.type === 'public' ? 'spki' : 'pkcs8',
            key
        );
        return this.arrayBufferToBase64(exported);
    }

    // Import Key from Base64
    static async importKey(base64Key: string, type: 'public' | 'private'): Promise<CryptoKey> {
        const binary = this.base64ToArrayBuffer(base64Key);
        return await window.crypto.subtle.importKey(
            type === 'public' ? 'spki' : 'pkcs8',
            binary,
            {
                name: this.ALGORITHM_NAME,
                namedCurve: this.NAMED_CURVE,
            },
            true, // extractable
            type === 'public' ? [] : ['deriveKey', 'deriveBits']
        );
    }

    // Derive Shared Secret (AES-GCM Key)
    private static async deriveSharedSecret(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
        return await window.crypto.subtle.deriveKey(
            {
                name: this.ALGORITHM_NAME,
                public: publicKey,
            },
            privateKey,
            {
                name: 'AES-GCM',
                length: 256,
            },
            false, // not extractable
            ['encrypt', 'decrypt']
        );
    }

    // Encrypt Message
    static async encryptMessage(content: string, recipientPublicKeyBase64: string): Promise<{ ciphertext: string; iv: string } | null> {
        try {
            const myPrivateKey = await this.getPrivateKey();
            if (!myPrivateKey) {
                console.error('No private key found');
                return null;
            }

            const recipientPublicKey = await this.importKey(recipientPublicKeyBase64, 'public');
            const sharedSecret = await this.deriveSharedSecret(myPrivateKey, recipientPublicKey);

            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const encodedContent = new TextEncoder().encode(content);

            const encryptedContent = await window.crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv,
                },
                sharedSecret,
                encodedContent
            );

            return {
                ciphertext: this.arrayBufferToBase64(encryptedContent),
                iv: this.arrayBufferToBase64(iv.buffer),
            };
        } catch (error) {
            console.error('Encryption failed:', error);
            return null;
        }
    }

    // Decrypt Message
    static async decryptMessage(ciphertextBase64: string, ivBase64: string, senderPublicKeyBase64: string): Promise<string | null> {
        try {
            const myPrivateKey = await this.getPrivateKey();
            if (!myPrivateKey) return null;

            const senderPublicKey = await this.importKey(senderPublicKeyBase64, 'public');
            const sharedSecret = await this.deriveSharedSecret(myPrivateKey, senderPublicKey);

            const ciphertext = this.base64ToArrayBuffer(ciphertextBase64);
            const iv = this.base64ToArrayBuffer(ivBase64);

            const decryptedContent = await window.crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv,
                },
                sharedSecret,
                ciphertext
            );

            return new TextDecoder().decode(decryptedContent);
        } catch (error) {
            // Silent fail is common in E2EE if keys mismatch (e.g. old messages)
            return null;
        }
    }

    // --- Password-Based Encryption for Key Backup ---

    static async deriveKeyFromPassword(password: string, salt: string): Promise<CryptoKey> {
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            "raw",
            enc.encode(password),
            "PBKDF2",
            false,
            ["deriveKey"]
        );

        return window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: this.base64ToArrayBuffer(salt),
                iterations: 100000,
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );
    }

    static async encryptPrivateKeyWithPassword(privateKey: CryptoKey, password: string): Promise<{ encryptedKey: string; salt: string; iv: string }> {
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const saltBase64 = this.arrayBufferToBase64(salt.buffer);

        const wrappingKey = await this.deriveKeyFromPassword(password, saltBase64);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        // Export private key to PKCS8
        const keyData = await window.crypto.subtle.exportKey("pkcs8", privateKey);

        const encryptedData = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            wrappingKey,
            keyData
        );

        return {
            encryptedKey: this.arrayBufferToBase64(encryptedData),
            salt: saltBase64,
            iv: this.arrayBufferToBase64(iv.buffer)
        };
    }

    static async decryptPrivateKeyWithPassword(encryptedKeyBase64: string, password: string, saltBase64: string, ivBase64: string): Promise<CryptoKey> {
        const wrappingKey = await this.deriveKeyFromPassword(password, saltBase64);
        const encryptedData = this.base64ToArrayBuffer(encryptedKeyBase64);
        const iv = this.base64ToArrayBuffer(ivBase64);

        const keyData = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            wrappingKey,
            encryptedData
        );

        return await window.crypto.subtle.importKey(
            "pkcs8",
            keyData,
            { name: this.ALGORITHM_NAME, namedCurve: this.NAMED_CURVE },
            true,
            ["deriveKey", "deriveBits"]
        );
    }


    // --- Utilities ---

    private static arrayBufferToBase64(buffer: ArrayBuffer): string {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    private static base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binary_string = window.atob(base64);
        const len = binary_string.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;
    }

    // --- Phase 2: Group Encryption (Room Keys) ---

    // 1. Generate a random Symmetric Key for the Room (AES-GCM)
    static async generateRoomKey(): Promise<CryptoKey> {
        return window.crypto.subtle.generateKey(
            {
                name: "AES-GCM",
                length: 256
            },
            true,
            ["encrypt", "decrypt"]
        );
    }

    // 2. Encrypt the Room Key for a specific User (using their Public Key)
    // We export the Room Key (raw) -> Encrypt it with Shared Secret derived from (MyPriv + RecipientPub)?
    // OR simpler: Hybrid Encryption. 
    // Actually, "Sender Keys" usually means:
    // A. Alice generates Random Key K.
    // B. Alice fetches Bob's Public Key.
    // C. Alice derives Secret S = ECDH(AlicePriv, BobPub).
    // D. Alice Encrypts K using S.
    // This is consistent with our Direct Message logic.
    static async encryptRoomKeyForUser(roomKey: CryptoKey, recipientPublicKeyBase64: string): Promise<{ encryptedKey: string; iv: string } | null> {
        try {
            // Export the room key to raw bytes
            const rawRoomKey = await window.crypto.subtle.exportKey("raw", roomKey);
            const roomKeyString = this.arrayBufferToBase64(rawRoomKey); // Convert bytes to base64 string to be the "message"

            // Now encrypt this "message" just like a DM
            const result = await this.encryptMessage(roomKeyString, recipientPublicKeyBase64);
            if (!result) return null;
            return { encryptedKey: result.ciphertext, iv: result.iv };
        } catch (e) {
            console.error("Failed to encrypt room key", e);
            return null;
        }
    }

    // 3. Decrypt the Room Key (using the User's Private Key + Sender's Public Key?)
    // WAIT. If I (Alice) create the room, I encrypt the key for Bob.
    // The "Sender" of the key is Alice. Bob needs Alice's Public Key to decrypt.
    // This implies `room_keys` table needs `creator_id` (who encrypted this key?).
    // OR we use a different scheme:
    // "Sealed Box" (Ephemeral Key)? 
    // Standard approach: Alice generates Ephemeral Keypair E. 
    // S = ECDH(EPriv, BobPub). K_encrypted = AES(S, K).
    // Alice publishes (E_Pub, K_encrypted).
    // Bob calculates S = ECDH(BobPriv, E_Pub). Decrypts K.
    // My `encryptMessage` implementation uses MY Identity Key. 
    // So if I use `encryptMessage`, the recipient needs MY Public Key to decrypt.
    // Does `room_keys` store who put the key there? The migration didn't have `sender_id`.
    // I should update the migration to include `sender_id` (who invited/added the key).

    // Let's assume the table has `sender_id` or we bundle the ephemeral key?
    // Current `encryptMessage` does NOT use ephemeral keys, it uses the Identity Key.
    // So the recipient MUST know who sent/created the key entry.
    // I will update the migration in the next step to add `sender_id`.

    static async decryptRoomKey(encryptedRoomKeyBase64: string, ivBase64: string, senderPublicKeyBase64: string): Promise<CryptoKey | null> {
        try {
            const roomKeyBase64 = await this.decryptMessage(encryptedRoomKeyBase64, ivBase64, senderPublicKeyBase64);
            if (!roomKeyBase64) return null;

            return window.crypto.subtle.importKey(
                "raw",
                this.base64ToArrayBuffer(roomKeyBase64),
                "AES-GCM",
                true,
                ["encrypt", "decrypt"]
            );
        } catch (e) {
            console.error("Failed to decrypt room key", e);
            return null;
        }
    }

    // 4. Encrypt/Decrypt Group Messages using Room Key
    static async encryptGroupMessage(content: string, roomKey: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encodedContent = new TextEncoder().encode(content);

        const encryptedContent = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            roomKey,
            encodedContent
        );

        return {
            ciphertext: this.arrayBufferToBase64(encryptedContent),
            iv: this.arrayBufferToBase64(iv.buffer)
        };
    }

    static async decryptGroupMessage(ciphertextBase64: string, ivBase64: string, roomKey: CryptoKey): Promise<string | null> {
        try {
            const ciphertext = this.base64ToArrayBuffer(ciphertextBase64);
            const iv = this.base64ToArrayBuffer(ivBase64);

            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                roomKey,
                ciphertext
            );

            return new TextDecoder().decode(decrypted);
        } catch (e) {
            return null; // Decryption failed
        }
    }

    // --- Phase 3: File Encryption ---

    // Encrypt a file (Blob) with a random key
    static async encryptFile(file: File): Promise<{ encryptedBlob: Blob; key: string; iv: string } | null> {
        try {
            const key = await window.crypto.subtle.generateKey(
                { name: "AES-GCM", length: 256 },
                true,
                ["encrypt", "decrypt"]
            );

            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const fileBuffer = await file.arrayBuffer();

            const encryptedBuffer = await window.crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv },
                key,
                fileBuffer
            );

            const exportedKey = await window.crypto.subtle.exportKey("raw", key);

            return {
                encryptedBlob: new Blob([encryptedBuffer]),
                key: this.arrayBufferToBase64(exportedKey),
                iv: this.arrayBufferToBase64(iv.buffer)
            };
        } catch (e) {
            console.error("File encryption failed", e);
            return null;
        }
    }

    // Decrypt a file (Blob) using provided key and iv
    static async decryptFile(encryptedBlob: Blob, keyBase64: string, ivBase64: string): Promise<Blob | null> {
        try {
            const key = await window.crypto.subtle.importKey(
                "raw",
                this.base64ToArrayBuffer(keyBase64),
                "AES-GCM",
                true,
                ["encrypt", "decrypt"]
            );

            const iv = this.base64ToArrayBuffer(ivBase64);
            const buffer = await encryptedBlob.arrayBuffer();

            const decryptedBuffer = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                key,
                buffer
            );

            return new Blob([decryptedBuffer]);
        } catch (e) {
            console.error("File decryption failed", e);
            return null;
        }
    }
}
