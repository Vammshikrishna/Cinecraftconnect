package com.cinecraftconnect.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;

/**
 * MainActivity is exported (it has to be, for the launcher and for links), so any app on the phone can send it an
 * intent. The incoming-call screen and the "accept" action must only be triggered by the app's own notification.
 * Our own call notification carries a random token that never leaves the app's private storage; an intent from
 * anywhere else does not have it and is never treated as a call.
 */
final class CallIntentGuard {
    static final String EXTRA = "ccCallToken";
    private static final String PREFS = "cc_call_intent_guard";
    private static final String KEY = "token";

    private CallIntentGuard() {}

    static synchronized String token(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String token = prefs.getString(KEY, null);
        if (token == null || token.length() < 32) {
            byte[] bytes = new byte[24];
            new SecureRandom().nextBytes(bytes);
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) sb.append(String.format("%02x", b));
            token = sb.toString();
            prefs.edit().putString(KEY, token).apply();
        }
        return token;
    }

    static boolean isTrusted(Context context, Intent intent) {
        if (context == null || intent == null) return false;
        String given = intent.getStringExtra(EXTRA);
        if (given == null) return false;
        return MessageDigest.isEqual(
                given.getBytes(StandardCharsets.UTF_8),
                token(context).getBytes(StandardCharsets.UTF_8));
    }

    /** Remove the call instructions from an intent that did not come from our own notification. */
    static void stripCallExtras(Intent intent) {
        if (intent == null) return;
        intent.removeExtra("incomingCall");
        intent.removeExtra("callAction");
    }
}
