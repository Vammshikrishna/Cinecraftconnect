package com.cinecraftconnect.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.RemoteInput;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class NotificationReplyReceiver extends BroadcastReceiver {
    private static final String TAG = "NotificationReply";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;

        String conversationId = intent.getStringExtra("conversationId");
        String targetUserId = intent.getStringExtra("targetUserId");
        int notificationId = intent.getIntExtra("notificationId", 0);

        if ("REPLY_ACTION".equals(action)) {
            Bundle remoteInput = RemoteInput.getResultsFromIntent(intent);
            if (remoteInput != null) {
                CharSequence replyText = remoteInput.getCharSequence("key_text_reply");
                if (replyText != null) {
                    String senderName = intent.getStringExtra("senderName");
                    String avatarUrl = intent.getStringExtra("avatarUrl");
                    String actionUrl = intent.getStringExtra("actionUrl");
                    sendReplyToSupabase(context, conversationId, targetUserId, replyText.toString(), notificationId, senderName, avatarUrl, actionUrl, intent);
                }
            }
        } else if ("MARK_READ_ACTION".equals(action)) {
            markAsReadInSupabase(context, conversationId, notificationId);
        } else if ("DISMISS_ACTION".equals(action)) {
            // Clear the history cache so if a new message arrives later, it starts fresh!
            context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
                    .edit()
                    .remove("push_history_" + conversationId)
                    .apply();
        }
    }

    private void sendReplyToSupabase(Context context, String conversationId, String targetUserId, String replyText, int notificationId, String senderName, String avatarUrl, String actionUrl, Intent originalIntent) {
        new Thread(() -> {
            try {
                URL url = java.net.URI.create("https://zugtdutimulibaxwnlbs.supabase.co/functions/v1/push-reply").toURL();
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                
                String anonKey = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
                        .getString("supabase_anon_key", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1Z3RkdXRpbXVsaWJheHdubGJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDQ2MjQsImV4cCI6MjA5MjA2NDYyNH0.StwROJi2Jbn0T-hPaisynp3YNDj0-coFET0BJWrsYdM");
                conn.setRequestProperty("Authorization", "Bearer " + anonKey);
                
                conn.setDoOutput(true);

                JSONObject jsonParam = new JSONObject();
                jsonParam.put("action", "reply");
                jsonParam.put("conversationId", conversationId);
                jsonParam.put("senderId", targetUserId);
                jsonParam.put("content", replyText);
                if (actionUrl != null) {
                    jsonParam.put("actionUrl", actionUrl);
                }

                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = jsonParam.toString().getBytes("utf-8");
                    os.write(input, 0, input.length);
                }

                int responseCode = conn.getResponseCode();
                if (responseCode == 200) {
                    appendReplyToNotification(context, conversationId, notificationId, replyText, senderName, avatarUrl, actionUrl, originalIntent);
                } else {
                    updateNotification(context, notificationId, "Failed: " + responseCode);
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to send reply", e);
                updateNotification(context, notificationId, "Error sending reply");
            }
        }).start();
    }

    private void markAsReadInSupabase(Context context, String conversationId, int notificationId) {
        new Thread(() -> {
            try {
                URL url = java.net.URI.create("https://zugtdutimulibaxwnlbs.supabase.co/functions/v1/push-reply").toURL();
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                
                String anonKey = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
                        .getString("supabase_anon_key", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1Z3RkdXRpbXVsaWJheHdubGJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDQ2MjQsImV4cCI6MjA5MjA2NDYyNH0.StwROJi2Jbn0T-hPaisynp3YNDj0-coFET0BJWrsYdM");
                conn.setRequestProperty("Authorization", "Bearer " + anonKey);
                
                conn.setDoOutput(true);

                JSONObject jsonParam = new JSONObject();
                jsonParam.put("action", "read");
                jsonParam.put("conversationId", conversationId);
                // SenderId not strictly needed for read, but we can pass it if we wanted to
                jsonParam.put("senderId", "system");

                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = jsonParam.toString().getBytes("utf-8");
                    os.write(input, 0, input.length);
                }

                int responseCode = conn.getResponseCode();
                if (responseCode == 200) {
                    NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                    manager.cancel(notificationId);
                    
                    // Clear the history cache so it doesn't pile up!
                    context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
                            .edit()
                            .remove("push_history_" + conversationId)
                            .apply();
                } else {
                    updateNotification(context, notificationId, "Failed: " + responseCode);
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to mark as read", e);
                updateNotification(context, notificationId, "Error marking read");
            }
        }).start();
    }

    private void appendReplyToNotification(Context context, String conversationId, int notificationId, String replyText, String senderName, String avatarUrl, String actionUrl, Intent originalIntent) {
        android.content.SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String historyJson = prefs.getString("push_history_" + conversationId, "[]");

        org.json.JSONArray historyArray;
        try {
            historyArray = new org.json.JSONArray(historyJson);
            org.json.JSONObject newMsg = new org.json.JSONObject();
            newMsg.put("text", replyText);
            newMsg.put("isMe", true);
            historyArray.put(newMsg);
        } catch (org.json.JSONException e) {
            historyArray = new org.json.JSONArray();
            try {
                org.json.JSONObject newMsg = new org.json.JSONObject();
                newMsg.put("text", replyText);
                newMsg.put("isMe", true);
                historyArray.put(newMsg);
            } catch (org.json.JSONException ignored) {}
        }
        prefs.edit().putString("push_history_" + conversationId, historyArray.toString()).apply();

        androidx.core.app.Person.Builder personBuilder = new androidx.core.app.Person.Builder().setName(senderName);
        if (avatarUrl != null && !avatarUrl.isEmpty()) {
            try {
                java.net.URL url = java.net.URI.create(avatarUrl).toURL();
                java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection();
                connection.setDoInput(true);
                connection.connect();
                java.io.InputStream input = connection.getInputStream();
                android.graphics.Bitmap myBitmap = android.graphics.BitmapFactory.decodeStream(input);
                if (myBitmap != null) {
                    myBitmap = FCMService.getCircularBitmap(myBitmap);
                    androidx.core.graphics.drawable.IconCompat icon = androidx.core.graphics.drawable.IconCompat.createWithBitmap(myBitmap);
                    personBuilder.setIcon(icon);
                }
            } catch (Exception ignored) {}
        }
        
        androidx.core.app.Person sender = personBuilder.build();
        androidx.core.app.Person me = new androidx.core.app.Person.Builder().setName("Me").build();

        NotificationCompat.MessagingStyle messagingStyle = new NotificationCompat.MessagingStyle(me);
        if (actionUrl != null && actionUrl.contains("/discussion-rooms/")) {
            messagingStyle.setConversationTitle(senderName);
            messagingStyle.setGroupConversation(true);
        } else {
            messagingStyle.setGroupConversation(false);
        }

        for (int i = 0; i < historyArray.length(); i++) {
            try {
                org.json.JSONObject msg = historyArray.getJSONObject(i);
                boolean isMe = msg.optBoolean("isMe", false);
                messagingStyle.addMessage(msg.getString("text"), System.currentTimeMillis(), isMe ? me : sender);
            } catch (org.json.JSONException e) {
                try {
                    messagingStyle.addMessage(historyArray.getString(i), System.currentTimeMillis(), sender);
                } catch (org.json.JSONException ignored) {}
            }
        }

        android.app.PendingIntent replyPendingIntent = android.app.PendingIntent.getBroadcast(context, notificationId + 2, originalIntent, android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_MUTABLE);
        RemoteInput remoteInput = new RemoteInput.Builder("key_text_reply").setLabel("Reply...").build();
        NotificationCompat.Action replyAction = new NotificationCompat.Action.Builder(0, "Reply", replyPendingIntent).addRemoteInput(remoteInput).build();

        Intent readIntent = new Intent(context, NotificationReplyReceiver.class);
        readIntent.setAction("MARK_READ_ACTION");
        readIntent.putExtra("conversationId", conversationId);
        readIntent.putExtra("notificationId", notificationId);
        android.app.PendingIntent readPendingIntent = android.app.PendingIntent.getBroadcast(context, notificationId + 1, readIntent, android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Action readAction = new NotificationCompat.Action.Builder(0, "Mark as Read", readPendingIntent).build();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, "default")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setStyle(messagingStyle)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .addAction(replyAction)
                .addAction(readAction)
                .setGroup("CINECRAFT_MESSAGES")
                .setAutoCancel(true);

        String currentUsername = prefs.getString("username", "");
        if (!currentUsername.isEmpty()) {
            builder.setSubText(currentUsername);
        }

        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        notificationManager.notify(notificationId, builder.build());
    }

    private void updateNotification(Context context, int notificationId, String text) {
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, "default")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentText(text)
                .setAutoCancel(true)
                .setTimeoutAfter(2000); // Disappear after 2 seconds
        
        notificationManager.notify(notificationId, builder.build());
    }
}
