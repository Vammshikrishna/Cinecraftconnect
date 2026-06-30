package com.cinecraftconnect.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.app.RemoteInput;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Map;

public class FCMService extends FirebaseMessagingService {

    private static final String CHANNEL_ID = "default";
    private static final String PREF_NAME = "CapacitorStorage";

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        
        // Forward to Capacitor PushNotificationsPlugin so JS listeners work
        com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin.sendRemoteMessage(remoteMessage);

        Map<String, String> data = remoteMessage.getData();
        if (data.isEmpty())
            return;

        String conversationId = data.get("conversationId");
        String senderName = data.get("title");
        String messageBody = data.get("body");
        String actionUrl = data.get("actionUrl");
        String targetUserId = data.get("targetUserId");
        String avatarUrl = data.get("avatarUrl");
        String type = data.get("type"); // "conversation" or "social" etc.
        String title = data.get("title");

        if (conversationId == null) {
            conversationId = "general";
        }
        if (senderName == null)
            senderName = "CineCraft Connect";
        if (messageBody == null)
            messageBody = "New message";
        if (actionUrl == null)
            actionUrl = "/messages/" + conversationId;
        if (targetUserId == null)
            targetUserId = "system";

        // --- E2EE Decryption ---
        String isEncrypted = data.get("isEncrypted");
        if ("true".equals(isEncrypted)) {
            try {
                String encryptedContent = data.get("encryptedContent");
                String encryptedSymKey = data.get("encryptedSymmetricKey");
                Context context = getApplicationContext();

                if (encryptedContent != null && !encryptedContent.isEmpty()) {
                    if (encryptedSymKey != null && !encryptedSymKey.isEmpty()) {
                        // GROUP MESSAGE: RSA-decrypt the symmetric key, then AES-GCM decrypt
                        String privateKeyBase64 = E2EEKeyStore.getPrivateKey(context, targetUserId);
                        if (privateKeyBase64 != null) {
                            String symKeyBase64 = E2EECryptoHelper.rsaDecrypt(privateKeyBase64, encryptedSymKey);
                            String decrypted = E2EECryptoHelper.decryptGroupMessage(encryptedContent, symKeyBase64);
                            messageBody = decrypted;
                            Log.d("FCMService", "E2EE: Successfully decrypted group message");
                        } else {
                            messageBody = "Decryption error: Private key is null (Group)";
                            // Try cached group key as fallback
                            String cachedGroupKey = E2EEKeyStore.getGroupKey(context, conversationId);
                            if (cachedGroupKey != null) {
                                String decrypted = E2EECryptoHelper.decryptGroupMessage(encryptedContent, cachedGroupKey);
                                messageBody = decrypted;
                                Log.d("FCMService", "E2EE: Decrypted group message using cached key");
                            }
                        }
                    } else {
                        // DIRECT MESSAGE: RSA-decrypt directly
                        String privateKeyBase64 = E2EEKeyStore.getPrivateKey(context, targetUserId);
                        if (privateKeyBase64 != null) {
                            String decrypted = E2EECryptoHelper.decryptDirectMessage(
                                    encryptedContent, privateKeyBase64, false);
                            messageBody = decrypted;
                            Log.d("FCMService", "E2EE: Successfully decrypted direct message");
                        } else {
                            messageBody = "Decryption error: Private key is null (DM)";
                        }
                    }
                }
            } catch (Exception e) {
                // Decryption failed — log and show the error in the notification for debugging
                Log.w("FCMService", "E2EE decryption failed, using server fallback body", e);
                messageBody = "Decryption error: " + e.toString();
            }
        }

        boolean wasEncrypted = "true".equals(isEncrypted);

        SharedPreferences capacitorPrefs = getApplicationContext().getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String activeConversationId = capacitorPrefs.getString("active_conversation_id", "");
        
        if (isAppInForeground(getApplicationContext()) && conversationId.equals(activeConversationId)) {
            Log.d("FCMService", "App is in foreground and user is looking at this conversation, skipping banner.");
            return;
        }

        if (type != null && !type.equals("conversation") && !type.equals("chat")) {
            showBasicNotification(conversationId, title != null ? title : senderName, messageBody, actionUrl, remoteMessage.getMessageId());
        } else {
            showInboxStyleNotification(conversationId, senderName, messageBody, actionUrl, targetUserId, avatarUrl, remoteMessage.getMessageId(), wasEncrypted);
        }
    }

    private void showBasicNotification(String notificationIdStr, String title, String body, String actionUrl, String messageId) {
        Context context = getApplicationContext();
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Updates", NotificationManager.IMPORTANCE_DEFAULT);
            notificationManager.createNotificationChannel(channel);
        }

        int notificationId = notificationIdStr != null ? notificationIdStr.hashCode() : (int) System.currentTimeMillis();

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (actionUrl != null) {
            intent.putExtra("actionUrl", actionUrl);
        }
        if (messageId != null) {
            intent.putExtra("google.message_id", messageId);
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(this, notificationId, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_icon_default)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true);

        notificationManager.notify(notificationId, builder.build());
    }

    private void showInboxStyleNotification(String conversationId, String senderName, String newBody, String actionUrl,
            String targetUserId, String avatarUrl, String messageId, boolean isEncryptedConversation) {
        Context context = getApplicationContext();

        // Security Check: Ensure this notification is for the currently logged in user!
        SharedPreferences capacitorPrefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String currentUserId = capacitorPrefs.getString("user_id", "");
        if (!currentUserId.isEmpty() && !currentUserId.equals(targetUserId)) {
            Log.w("FCMService", "Ignoring notification intended for user " + targetUserId + " because current user is " + currentUserId);
            return;
        }

        NotificationManager notificationManager = (NotificationManager) context
                .getSystemService(Context.NOTIFICATION_SERVICE);

        // Create Channel for Android 8+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Messages",
                    NotificationManager.IMPORTANCE_HIGH);
            notificationManager.createNotificationChannel(channel);
        }

        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        String historyJson = prefs.getString("push_history_" + conversationId, "[]");

        JSONArray historyArray;
        try {
            historyArray = new JSONArray(historyJson);
            JSONObject newMsg = new JSONObject();
            newMsg.put("text", newBody);
            newMsg.put("isMe", false);
            historyArray.put(newMsg);
        } catch (JSONException e) {
            historyArray = new JSONArray();
            try {
                JSONObject newMsg = new JSONObject();
                newMsg.put("text", newBody);
                newMsg.put("isMe", false);
                historyArray.put(newMsg);
            } catch (JSONException ignored) {}
        }

        // Save back to prefs
        prefs.edit().putString("push_history_" + conversationId, historyArray.toString()).apply();

        int notificationId = conversationId.hashCode();

        // Build Intent to open app
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (actionUrl != null) {
            intent.putExtra("actionUrl", actionUrl);
        }
        if (messageId != null) {
            intent.putExtra("google.message_id", messageId);
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(this, notificationId, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // -- MARK AS READ ACTION --
        Intent readIntent = new Intent(this, NotificationReplyReceiver.class);
        readIntent.setAction("MARK_READ_ACTION");
        readIntent.putExtra("conversationId", conversationId);
        readIntent.putExtra("notificationId", notificationId);
        PendingIntent readPendingIntent = PendingIntent.getBroadcast(this, notificationId + 1, readIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Action readAction = new NotificationCompat.Action.Builder(0, "Mark as Read",
                readPendingIntent).build();

        // -- REPLY ACTION --
        Intent replyIntent = new Intent(this, NotificationReplyReceiver.class);
        replyIntent.setAction("REPLY_ACTION");
        replyIntent.putExtra("conversationId", conversationId);
        replyIntent.putExtra("targetUserId", targetUserId);
        replyIntent.putExtra("notificationId", notificationId);
        replyIntent.putExtra("senderName", senderName);
        replyIntent.putExtra("avatarUrl", avatarUrl);
        replyIntent.putExtra("actionUrl", actionUrl);
        replyIntent.putExtra("isEncrypted", isEncryptedConversation);
        PendingIntent replyPendingIntent = PendingIntent.getBroadcast(this, notificationId + 2, replyIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);

        RemoteInput remoteInput = new RemoteInput.Builder("key_text_reply")
                .setLabel("Reply...")
                .build();

        NotificationCompat.Action replyAction = new NotificationCompat.Action.Builder(0, "Reply", replyPendingIntent)
                .addRemoteInput(remoteInput)
                .build();

        // Create Messaging Style
        Person.Builder personBuilder = new Person.Builder().setName(senderName);
        if (avatarUrl != null && !avatarUrl.isEmpty()) {
            try {
                java.net.URL url = java.net.URI.create(avatarUrl).toURL();
                java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection();
                connection.setDoInput(true);
                connection.connect();
                java.io.InputStream input = connection.getInputStream();
                android.graphics.Bitmap myBitmap = android.graphics.BitmapFactory.decodeStream(input);
                if (myBitmap != null) {
                    myBitmap = getCircularBitmap(myBitmap);
                    androidx.core.graphics.drawable.IconCompat icon = androidx.core.graphics.drawable.IconCompat
                            .createWithBitmap(myBitmap);
                    personBuilder.setIcon(icon);
                }
            } catch (Exception e) {
                // Ignore failure and use default text avatar
            }
        }
        Person sender = personBuilder.build();
        Person me = new Person.Builder().setName("Me").build();
        
        NotificationCompat.MessagingStyle messagingStyle = new NotificationCompat.MessagingStyle(me);
        
        // Only set conversation title if it's a group chat (actionUrl starts with /discussion-rooms/)
        if (actionUrl != null && actionUrl.contains("/discussion-rooms/")) {
            messagingStyle.setConversationTitle(senderName);
            messagingStyle.setGroupConversation(true);
        } else {
            messagingStyle.setGroupConversation(false);
        }

        for (int i = 0; i < historyArray.length(); i++) {
            try {
                JSONObject msg = historyArray.getJSONObject(i);
                boolean isMe = msg.optBoolean("isMe", false);
                messagingStyle.addMessage(msg.getString("text"), System.currentTimeMillis(), isMe ? me : sender);
            } catch (JSONException e) {
                try {
                    // Fallback for old string-based history
                    messagingStyle.addMessage(historyArray.getString(i), System.currentTimeMillis(), sender);
                } catch (JSONException ignored) {}
            }
        }

        // -- DISMISS ACTION --
        Intent dismissIntent = new Intent(this, NotificationReplyReceiver.class);
        dismissIntent.setAction("DISMISS_ACTION");
        dismissIntent.putExtra("conversationId", conversationId);
        PendingIntent dismissPendingIntent = PendingIntent.getBroadcast(this, notificationId + 3, dismissIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_icon_default)
                .setStyle(messagingStyle)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setContentIntent(pendingIntent)
                .setDeleteIntent(dismissPendingIntent)
                .addAction(replyAction)
                .addAction(readAction)
                .setGroup("CINECRAFT_MESSAGES")
                .setAutoCancel(true);

        String currentUsername = prefs.getString("username", "");
        if (!currentUsername.isEmpty()) {
            builder.setSubText(currentUsername);
        }

        // Build and publish the Summary Notification to properly group them
        NotificationCompat.Builder summaryBuilder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("CineCraft Connect")
                .setSmallIcon(R.drawable.ic_stat_icon_default)
                .setGroup("CINECRAFT_MESSAGES")
                .setGroupSummary(true)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true);
                
        if (!currentUsername.isEmpty()) {
            summaryBuilder.setSubText(currentUsername);
        }

        notificationManager.notify(0, summaryBuilder.build());
        notificationManager.notify(notificationId, builder.build());
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        // Forward token to Capacitor Push Notifications plugin
        com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin.onNewToken(token);
    }

    public static android.graphics.Bitmap getCircularBitmap(android.graphics.Bitmap bitmap) {
        if (bitmap == null) return null;
        int size = Math.min(bitmap.getWidth(), bitmap.getHeight());
        android.graphics.Bitmap output = android.graphics.Bitmap.createBitmap(size, size, android.graphics.Bitmap.Config.ARGB_8888);
        android.graphics.Canvas canvas = new android.graphics.Canvas(output);
        final int color = 0xff424242;
        final android.graphics.Paint paint = new android.graphics.Paint();
        final android.graphics.Rect rect = new android.graphics.Rect(0, 0, size, size);
        final android.graphics.RectF rectF = new android.graphics.RectF(rect);
        paint.setAntiAlias(true);
        canvas.drawARGB(0, 0, 0, 0);
        paint.setColor(color);
        canvas.drawOval(rectF, paint);
        paint.setXfermode(new android.graphics.PorterDuffXfermode(android.graphics.PorterDuff.Mode.SRC_IN));
        int xOffset = (bitmap.getWidth() - size) / 2;
        int yOffset = (bitmap.getHeight() - size) / 2;
        android.graphics.Rect srcRect = new android.graphics.Rect(xOffset, yOffset, xOffset + size, yOffset + size);
        canvas.drawBitmap(bitmap, srcRect, rect, paint);
        return output;
    }

    private boolean isAppInForeground(Context context) {
        android.app.ActivityManager activityManager = (android.app.ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        if (activityManager == null) return false;
        java.util.List<android.app.ActivityManager.RunningAppProcessInfo> appProcesses = activityManager.getRunningAppProcesses();
        if (appProcesses == null) return false;
        final String packageName = context.getPackageName();
        for (android.app.ActivityManager.RunningAppProcessInfo appProcess : appProcesses) {
            if (appProcess.importance == android.app.ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND && appProcess.processName.equals(packageName)) {
                return true;
            }
        }
        return false;
    }
}
