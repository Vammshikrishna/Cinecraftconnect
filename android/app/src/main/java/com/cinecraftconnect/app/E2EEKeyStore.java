package com.cinecraftconnect.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.util.Log;

import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Secure storage for E2EE keys using Android Keystore.
 * 
 * Architecture:
 * - A hardware-backed AES-256-GCM master key is stored in Android Keystore
 * - RSA private keys and group symmetric keys are encrypted with this master key
 * - Encrypted blobs are stored in SharedPreferences
 * - Even on rooted devices, the encrypted data is useless without the hardware master key
 */
public class E2EEKeyStore {

    private static final String TAG = "E2EEKeyStore";
    private static final String KEYSTORE_ALIAS = "e2ee_master_key";
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private static final String PREFS_NAME = "E2EESecureStore";
    private static final String PRIVATE_KEY_PREFIX = "e2ee_secure_pk_";
    private static final String GROUP_KEY_PREFIX = "e2ee_secure_gk_";
    private static final int GCM_TAG_LENGTH = 128;
    private static final int GCM_IV_LENGTH = 12;

    /**
     * Gets or creates the hardware-backed master key from Android Keystore.
     */
    private static SecretKey getMasterKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        keyStore.load(null);

        if (keyStore.containsAlias(KEYSTORE_ALIAS)) {
            KeyStore.SecretKeyEntry entry = (KeyStore.SecretKeyEntry) keyStore.getEntry(KEYSTORE_ALIAS, null);
            return entry.getSecretKey();
        }

        // Generate a new master key
        KeyGenerator keyGenerator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE);

        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
                KEYSTORE_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build();

        keyGenerator.init(spec);
        return keyGenerator.generateKey();
    }

    /**
     * Encrypts data with the master key. Returns "iv:ciphertext" in base64.
     */
    private static String encryptWithMasterKey(String plaintext) throws Exception {
        SecretKey masterKey = getMasterKey();
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, masterKey);

        byte[] iv = cipher.getIV();
        byte[] encrypted = cipher.doFinal(plaintext.getBytes("UTF-8"));

        String ivBase64 = Base64.encodeToString(iv, Base64.NO_WRAP);
        String ctBase64 = Base64.encodeToString(encrypted, Base64.NO_WRAP);

        return ivBase64 + ":" + ctBase64;
    }

    /**
     * Decrypts data encrypted with the master key. Input: "iv:ciphertext" in base64.
     */
    private static String decryptWithMasterKey(String encryptedPayload) throws Exception {
        String[] parts = encryptedPayload.split(":");
        if (parts.length != 2) {
            throw new IllegalArgumentException("Invalid encrypted payload format");
        }

        byte[] iv = Base64.decode(parts[0], Base64.DEFAULT);
        byte[] ciphertext = Base64.decode(parts[1], Base64.DEFAULT);

        SecretKey masterKey = getMasterKey();
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        GCMParameterSpec gcmSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
        cipher.init(Cipher.DECRYPT_MODE, masterKey, gcmSpec);

        byte[] decrypted = cipher.doFinal(ciphertext);
        return new String(decrypted, "UTF-8");
    }

    // --- Public API ---

    /**
     * Securely stores a user's RSA private key (base64 PKCS8).
     * The key is encrypted with the Android Keystore master key before storage.
     */
    public static void storePrivateKey(Context context, String userId, String base64PrivateKey) {
        try {
            String encrypted = encryptWithMasterKey(base64PrivateKey);
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString(PRIVATE_KEY_PREFIX + userId, encrypted).apply();
            Log.d(TAG, "Stored encrypted private key for user: " + userId.substring(0, 8) + "...");
        } catch (Exception e) {
            Log.e(TAG, "Failed to store private key", e);
        }
    }

    /**
     * Retrieves and decrypts a user's RSA private key (base64 PKCS8).
     * Returns null if no key is stored or decryption fails.
     */
    public static String getPrivateKey(Context context, String userId) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String encrypted = prefs.getString(PRIVATE_KEY_PREFIX + userId, null);
            if (encrypted == null) return null;

            return decryptWithMasterKey(encrypted);
        } catch (Exception e) {
            Log.e(TAG, "Failed to retrieve private key", e);
            return null;
        }
    }

    /**
     * Stores a decrypted group symmetric key (base64 raw AES key) for a room/space.
     * Encrypted with the Android Keystore master key before storage.
     */
    public static void storeGroupKey(Context context, String targetId, String base64SymmetricKey) {
        try {
            String encrypted = encryptWithMasterKey(base64SymmetricKey);
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString(GROUP_KEY_PREFIX + targetId, encrypted).apply();
            Log.d(TAG, "Stored encrypted group key for target: " + targetId.substring(0, 8) + "...");
        } catch (Exception e) {
            Log.e(TAG, "Failed to store group key", e);
        }
    }

    /**
     * Retrieves and decrypts a group symmetric key (base64 raw AES key).
     * Returns null if no key is stored or decryption fails.
     */
    public static String getGroupKey(Context context, String targetId) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String encrypted = prefs.getString(GROUP_KEY_PREFIX + targetId, null);
            if (encrypted == null) return null;

            return decryptWithMasterKey(encrypted);
        } catch (Exception e) {
            Log.e(TAG, "Failed to retrieve group key", e);
            return null;
        }
    }

    /**
     * Removes all stored keys (used on logout).
     */
    public static void clearAllKeys(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().clear().apply();
            Log.d(TAG, "Cleared all E2EE secure keys");
        } catch (Exception e) {
            Log.e(TAG, "Failed to clear keys", e);
        }
    }
}
