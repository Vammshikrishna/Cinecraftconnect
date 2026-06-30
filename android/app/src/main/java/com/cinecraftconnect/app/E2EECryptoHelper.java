package com.cinecraftconnect.app;

import android.util.Base64;
import android.util.Log;

import org.json.JSONObject;

import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import javax.crypto.spec.OAEPParameterSpec;
import javax.crypto.spec.PSource;
import java.security.spec.MGF1ParameterSpec;

/**
 * Java-native E2EE cryptographic operations that exactly match
 * the WebCrypto implementations in src/lib/e2ee.ts.
 *
 * Algorithms:
 * - RSA-OAEP (2048-bit, SHA-256) for asymmetric decryption
 * - AES-GCM (256-bit, 12-byte IV) for symmetric decryption
 *
 * Payload Formats (must match JS):
 * - Symmetric ciphertext: "ivBase64:ciphertextBase64"
 * - DM payload: {"__e2ee":true, "type":"dm", "for_sender":"...", "for_recipient":"..."}
 * - Group payload: {"__e2ee_group":true, "type":"group", "ciphertext":"ivBase64:ciphertextBase64"}
 */
public class E2EECryptoHelper {

    private static final String TAG = "E2EECrypto";
    private static final int GCM_TAG_LENGTH = 128; // bits
    private static final int GCM_IV_LENGTH = 12;   // bytes

    /**
     * Imports a Base64-encoded PKCS8 RSA private key.
     */
    private static PrivateKey importRSAPrivateKey(String base64PrivateKey) throws Exception {
        byte[] keyBytes = Base64.decode(base64PrivateKey, Base64.DEFAULT);
        PKCS8EncodedKeySpec keySpec = new PKCS8EncodedKeySpec(keyBytes);
        KeyFactory keyFactory = KeyFactory.getInstance("RSA");
        return keyFactory.generatePrivate(keySpec);
    }

    /**
     * RSA-OAEP decrypt with SHA-256.
     * Matches: decryptWithPrivateKey() in e2ee.ts
     *
     * @param base64PrivateKey PKCS8 private key in base64
     * @param base64Ciphertext RSA-encrypted data in base64
     * @return decrypted plaintext string
     */
    public static String rsaDecrypt(String base64PrivateKey, String base64Ciphertext) throws Exception {
        PrivateKey privateKey = importRSAPrivateKey(base64PrivateKey);
        byte[] ciphertext = Base64.decode(base64Ciphertext, Base64.DEFAULT);

        Cipher cipher = Cipher.getInstance("RSA/ECB/OAEPPadding");
        OAEPParameterSpec oaepParams = new OAEPParameterSpec(
                "SHA-256",
                "MGF1",
                MGF1ParameterSpec.SHA256,
                PSource.PSpecified.DEFAULT
        );
        cipher.init(Cipher.DECRYPT_MODE, privateKey, oaepParams);

        byte[] decrypted = cipher.doFinal(ciphertext);
        return new String(decrypted, "UTF-8");
    }

    /**
     * AES-GCM decrypt.
     * Matches: decryptWithSymmetricKey() in e2ee.ts
     *
     * @param base64RawKey 256-bit AES key in base64 (raw format)
     * @param payload      format: "ivBase64:ciphertextBase64"
     * @return decrypted plaintext string
     */
    public static String aesGcmDecrypt(String base64RawKey, String payload) throws Exception {
        String[] parts = payload.split(":");
        if (parts.length != 2) {
            throw new IllegalArgumentException("Invalid AES-GCM payload format. Expected 'iv:ciphertext'");
        }

        byte[] iv = Base64.decode(parts[0], Base64.DEFAULT);
        byte[] ciphertext = Base64.decode(parts[1], Base64.DEFAULT);
        byte[] keyBytes = Base64.decode(base64RawKey, Base64.DEFAULT);

        SecretKeySpec keySpec = new SecretKeySpec(keyBytes, "AES");
        GCMParameterSpec gcmSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, keySpec, gcmSpec);

        byte[] decrypted = cipher.doFinal(ciphertext);
        return new String(decrypted, "UTF-8");
    }

    /**
     * Decrypt a group message.
     * Matches: decryptGroupMessage() in e2ee.ts
     *
     * The encryptedContent is a JSON string:
     * {"__e2ee_group":true, "type":"group", "ciphertext":"ivBase64:ciphertextBase64"}
     *
     * @param encryptedContent JSON payload string
     * @param base64SymmetricKey decrypted AES-256 key in base64
     * @return decrypted message text
     */
    public static String decryptGroupMessage(String encryptedContent, String base64SymmetricKey) throws Exception {
        JSONObject json = new JSONObject(encryptedContent);

        if (!json.optBoolean("__e2ee_group", false)) {
            // Not an E2EE payload, return as-is
            return encryptedContent;
        }

        String ciphertext = json.getString("ciphertext");
        return aesGcmDecrypt(base64SymmetricKey, ciphertext);
    }

    /**
     * Decrypt a direct message.
     * Matches: decryptDirectMessage() in e2ee.ts
     *
     * The encryptedContent is a JSON string:
     * {"__e2ee":true, "type":"dm", "for_sender":"...", "for_recipient":"..."}
     *
     * @param encryptedContent JSON payload string
     * @param base64PrivateKey PKCS8 RSA private key in base64
     * @param isSender true if the current user is the message sender
     * @return decrypted message text
     */
    public static String decryptDirectMessage(String encryptedContent, String base64PrivateKey, boolean isSender) throws Exception {
        JSONObject json = new JSONObject(encryptedContent);

        if (!json.optBoolean("__e2ee", false)) {
            // Not an E2EE payload, return as-is
            return encryptedContent;
        }

        String ciphertext;
        if (isSender) {
            ciphertext = json.getString("for_sender");
        } else {
            // Try recipient first, fall back to sender
            ciphertext = json.optString("for_recipient", null);
            if (ciphertext == null || ciphertext.isEmpty()) {
                ciphertext = json.getString("for_sender");
            }
        }

        return rsaDecrypt(base64PrivateKey, ciphertext);
    }

    /**
     * Checks if a message content string is an E2EE encrypted payload.
     */
    public static boolean isEncryptedContent(String content) {
        if (content == null) return false;
        return content.contains("__e2ee") || content.contains("__e2ee_group");
    }

    // --- Encryption Methods (for native reply from notification shade) ---

    /**
     * AES-GCM encrypt.
     * Matches: encryptWithSymmetricKey() in e2ee.ts
     *
     * @param plaintext     the message text to encrypt
     * @param base64RawKey  256-bit AES key in base64 (raw format)
     * @return encrypted payload in format: "ivBase64:ciphertextBase64"
     */
    public static String aesGcmEncrypt(String plaintext, String base64RawKey) throws Exception {
        byte[] keyBytes = Base64.decode(base64RawKey, Base64.NO_WRAP);
        byte[] iv = new byte[GCM_IV_LENGTH];
        new java.security.SecureRandom().nextBytes(iv);

        SecretKeySpec keySpec = new SecretKeySpec(keyBytes, "AES");
        GCMParameterSpec gcmSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, gcmSpec);

        byte[] encrypted = cipher.doFinal(plaintext.getBytes("UTF-8"));

        String ivBase64 = Base64.encodeToString(iv, Base64.NO_WRAP);
        String ctBase64 = Base64.encodeToString(encrypted, Base64.NO_WRAP);

        return ivBase64 + ":" + ctBase64;
    }

    /**
     * Encrypt a group message.
     * Matches: encryptGroupMessage() in e2ee.ts
     *
     * Returns a JSON string:
     * {"__e2ee_group":true, "type":"group", "ciphertext":"ivBase64:ciphertextBase64"}
     *
     * @param plaintext          the message text to encrypt
     * @param base64SymmetricKey decrypted AES-256 key in base64
     * @return JSON payload string ready to be stored in the DB
     */
    public static String encryptGroupMessage(String plaintext, String base64SymmetricKey) throws Exception {
        String ciphertext = aesGcmEncrypt(plaintext, base64SymmetricKey);

        JSONObject json = new JSONObject();
        json.put("__e2ee_group", true);
        json.put("type", "group");
        json.put("ciphertext", ciphertext);

        return json.toString();
    }
}
