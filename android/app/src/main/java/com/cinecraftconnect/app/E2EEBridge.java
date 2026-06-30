package com.cinecraftconnect.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor plugin that bridges the WebView E2EE key management
 * to the native Android secure store (E2EEKeyStore).
 *
 * This allows FCMService.java to decrypt messages even when
 * the WebView is not loaded (app closed/killed).
 *
 * Methods:
 * - storePrivateKey({ userId, privateKey }) — sync RSA private key
 * - storeGroupKey({ targetId, symmetricKey }) — sync AES group key
 * - clearKeys() — clear all stored keys (on logout)
 */
@CapacitorPlugin(name = "E2EEBridge")
public class E2EEBridge extends Plugin {

    private static final String TAG = "E2EEBridge";

    /**
     * Stores the user's RSA private key in the Android Keystore-backed secure store.
     * Called from useE2EEInit.ts after key generation or import.
     *
     * @param call { userId: string, privateKey: string (base64 PKCS8) }
     */
    @PluginMethod
    public void storePrivateKey(PluginCall call) {
        String userId = call.getString("userId");
        String privateKey = call.getString("privateKey");

        if (userId == null || privateKey == null) {
            call.reject("userId and privateKey are required");
            return;
        }

        try {
            E2EEKeyStore.storePrivateKey(getContext(), userId, privateKey);
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to store private key: " + e.getMessage());
        }
    }

    /**
     * Stores a decrypted group symmetric key in the secure store.
     * Called from useGroupKey.ts after successfully decrypting the group key.
     *
     * @param call { targetId: string (room/space ID), symmetricKey: string (base64 raw AES) }
     */
    @PluginMethod
    public void storeGroupKey(PluginCall call) {
        String targetId = call.getString("targetId");
        String symmetricKey = call.getString("symmetricKey");

        if (targetId == null || symmetricKey == null) {
            call.reject("targetId and symmetricKey are required");
            return;
        }

        try {
            E2EEKeyStore.storeGroupKey(getContext(), targetId, symmetricKey);
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to store group key: " + e.getMessage());
        }
    }

    /**
     * Clears all stored E2EE keys from the secure store.
     * Should be called on user logout.
     */
    @PluginMethod
    public void clearKeys(PluginCall call) {
        try {
            E2EEKeyStore.clearAllKeys(getContext());
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to clear keys: " + e.getMessage());
        }
    }
}
