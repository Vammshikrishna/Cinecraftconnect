package com.cinecraftconnect.app;

import android.app.Activity;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.app.RemoteInput;
import androidx.core.graphics.drawable.IconCompat;

import com.facebook.react.HeadlessJsTaskService;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class NotificationBridgeModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "NotificationBridge";
    private static final String PREFS_MESSAGES = "cinecraft_notification_messages";
    private static final String PREFS_ACTIONS = "cinecraft_notification_pending_actions";
    private static final String KEY_PENDING_ACTIONS = "pending_actions_queue";
    private static final int MAX_MESSAGES_PER_CHAT = 25;

    private static ReactApplicationContext sReactContext = null;
    private static final ExecutorService sExecutor = Executors.newFixedThreadPool(2);
    private static String sMyAvatarUrl = null;

    public static class MessageRecord {
        public String sender;
        public String text;
        public long time;
        public boolean isMe;
        public String avatarUrl;

        public MessageRecord(String sender, String text, long time, boolean isMe, String avatarUrl) {
            this.sender = sender;
            this.text = text;
            this.time = time;
            this.isMe = isMe;
            this.avatarUrl = avatarUrl;
        }
    }

    public NotificationBridgeModule(ReactApplicationContext reactContext) {
        super(reactContext);
        sReactContext = reactContext;
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @Override
    public void invalidate() {
        super.invalidate();
        if (sReactContext == getReactApplicationContext()) {
            sReactContext = null;
        }
    }

    // -------------------------------------------------------------
    // Current User Avatar Storage
    // -------------------------------------------------------------
    public static synchronized void setCurrentUserAvatar(Context context, String avatarUrl) {
        if (avatarUrl == null || avatarUrl.trim().isEmpty()) return;
        sMyAvatarUrl = avatarUrl.trim();
        if (context != null) {
            try {
                SharedPreferences prefs = context.getSharedPreferences(PREFS_MESSAGES, Context.MODE_PRIVATE);
                prefs.edit().putString("current_user_avatar", sMyAvatarUrl).apply();
            } catch (Exception ignored) {}
        }
    }

    public static synchronized String getCurrentUserAvatar(Context context) {
        if (sMyAvatarUrl != null && !sMyAvatarUrl.isEmpty()) return sMyAvatarUrl;
        if (context != null) {
            try {
                SharedPreferences prefs = context.getSharedPreferences(PREFS_MESSAGES, Context.MODE_PRIVATE);
                sMyAvatarUrl = prefs.getString("current_user_avatar", null);
                return sMyAvatarUrl;
            } catch (Exception ignored) {}
        }
        return null;
    }

    // -------------------------------------------------------------
    // Circular Avatar & Bitmap Caching Helpers
    // -------------------------------------------------------------
    public static Bitmap getCircularBitmap(Bitmap bitmap) {
        if (bitmap == null) return null;
        int size = Math.min(bitmap.getWidth(), bitmap.getHeight());
        Bitmap output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(output);
        Paint paint = new Paint();
        paint.setAntiAlias(true);
        paint.setFilterBitmap(true);
        paint.setDither(true);

        int left = (bitmap.getWidth() - size) / 2;
        int top = (bitmap.getHeight() - size) / 2;
        Rect src = new Rect(left, top, left + size, top + size);
        Rect dst = new Rect(0, 0, size, size);

        canvas.drawARGB(0, 0, 0, 0);
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint);
        paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
        canvas.drawBitmap(bitmap, src, dst, paint);
        return output;
    }

    public static Bitmap getCachedAvatarBitmap(Context context, String avatarUrl) {
        if (context == null || avatarUrl == null || avatarUrl.trim().isEmpty()) return null;
        try {
            File cacheDir = new File(context.getCacheDir(), "notif_avatars");
            String filename = "av_" + Math.abs(avatarUrl.hashCode()) + ".png";
            File file = new File(cacheDir, filename);
            if (file.exists() && file.length() > 0) {
                return BitmapFactory.decodeFile(file.getAbsolutePath());
            }
        } catch (Exception ignored) {}
        return null;
    }

    public static Bitmap loadAvatarBitmap(Context context, String avatarUrl) {
        if (context == null || avatarUrl == null || avatarUrl.trim().isEmpty()) return null;
        try {
            File cacheDir = new File(context.getCacheDir(), "notif_avatars");
            if (!cacheDir.exists()) cacheDir.mkdirs();

            String filename = "av_" + Math.abs(avatarUrl.hashCode()) + ".png";
            File file = new File(cacheDir, filename);
            if (file.exists() && file.length() > 0) {
                Bitmap cached = BitmapFactory.decodeFile(file.getAbsolutePath());
                if (cached != null) return cached;
            }

            String currentUrl = avatarUrl.trim();
            HttpURLConnection conn = null;
            int redirects = 0;
            while (redirects < 3) {
                URL url = new URL(currentUrl);
                conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(6000);
                conn.setInstanceFollowRedirects(true);
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Android; Mobile; rv:109.0) Gecko/109.0");
                conn.setDoInput(true);
                conn.connect();

                int code = conn.getResponseCode();
                if (code == HttpURLConnection.HTTP_MOVED_PERM ||
                    code == HttpURLConnection.HTTP_MOVED_TEMP ||
                    code == HttpURLConnection.HTTP_SEE_OTHER ||
                    code == 307 || code == 308) {
                    String newUrl = conn.getHeaderField("Location");
                    if (newUrl != null && !newUrl.isEmpty()) {
                        conn.disconnect();
                        currentUrl = newUrl;
                        redirects++;
                        continue;
                    }
                }
                break;
            }

            if (conn != null) {
                InputStream input = conn.getInputStream();
                Bitmap raw = BitmapFactory.decodeStream(input);
                input.close();
                conn.disconnect();

                if (raw != null) {
                    int targetSize = 192;
                    Bitmap scaled = Bitmap.createScaledBitmap(raw, targetSize, targetSize, true);
                    Bitmap circular = getCircularBitmap(scaled);
                    if (circular != null) {
                        try (FileOutputStream fos = new FileOutputStream(file)) {
                            circular.compress(Bitmap.CompressFormat.PNG, 100, fos);
                        } catch (Exception ignored) {}
                        return circular;
                    }
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    // -------------------------------------------------------------
    // SharedPreferences message history helpers
    // -------------------------------------------------------------
    public static synchronized void addMessage(Context context, String conversationKey, String sender, String text, long time, boolean isMe, String avatarUrl) {
        if (context == null || conversationKey == null || text == null) return;
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_MESSAGES, Context.MODE_PRIVATE);
            String raw = prefs.getString(conversationKey, "[]");
            JSONArray arr = new JSONArray(raw);

            JSONObject msgObj = new JSONObject();
            msgObj.put("sender", sender != null ? sender : "");
            msgObj.put("text", text);
            msgObj.put("time", time);
            msgObj.put("isMe", isMe);
            if (avatarUrl != null) msgObj.put("avatarUrl", avatarUrl);
            arr.put(msgObj);

            // Trim to max allowed
            while (arr.length() > MAX_MESSAGES_PER_CHAT) {
                arr.remove(0);
            }

            prefs.edit().putString(conversationKey, arr.toString()).apply();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static synchronized List<MessageRecord> getMessages(Context context, String conversationKey) {
        List<MessageRecord> list = new ArrayList<>();
        if (context == null || conversationKey == null) return list;
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_MESSAGES, Context.MODE_PRIVATE);
            String raw = prefs.getString(conversationKey, "[]");
            JSONArray arr = new JSONArray(raw);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                list.add(new MessageRecord(
                    obj.optString("sender", ""),
                    obj.optString("text", ""),
                    obj.optLong("time", System.currentTimeMillis()),
                    obj.optBoolean("isMe", false),
                    obj.optString("avatarUrl", null)
                ));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return list;
    }

    public static synchronized void clearConversationMessages(Context context, String conversationKey) {
        if (context == null || conversationKey == null) return;
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_MESSAGES, Context.MODE_PRIVATE);
            prefs.edit().remove(conversationKey).apply();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static synchronized void clearAllConversationMessages(Context context) {
        if (context == null) return;
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_MESSAGES, Context.MODE_PRIVATE);
            prefs.edit().clear().apply();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // -------------------------------------------------------------
    // SharedPreferences pending actions helpers
    // -------------------------------------------------------------
    public static synchronized void savePendingAction(Context context, String action, String screen, String partnerId, String text, String conversationKey, String actionId) {
        if (context == null || action == null) return;
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_ACTIONS, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY_PENDING_ACTIONS, "[]");
            JSONArray arr = new JSONArray(raw);

            JSONObject item = new JSONObject();
            item.put("actionId", actionId != null ? actionId : UUID.randomUUID().toString());
            item.put("action", action);
            if (screen != null) item.put("screen", screen);
            if (partnerId != null) item.put("partnerId", partnerId);
            if (text != null) item.put("text", text);
            if (conversationKey != null) item.put("conversationKey", conversationKey);
            item.put("timestamp", System.currentTimeMillis());

            arr.put(item);
            prefs.edit().putString(KEY_PENDING_ACTIONS, arr.toString()).apply();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // -------------------------------------------------------------
    // Post MessagingStyle notification
    // -------------------------------------------------------------
    public static void postMessagingNotification(
        Context context,
        String conversationKey,
        int notifId,
        String title,
        String body,
        String channelId,
        String screen,
        String partnerId,
        String partnerName,
        String avatarUrl,
        String myAvatarUrl
    ) {
        try {
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return;

            String targetChannel = (channelId != null && !channelId.isEmpty()) ? channelId : "fcm_fallback_notification_channel";

            // Main deep link intent for opening app directly to the conversation
            Intent intent = new Intent(context, MainActivity.class);
            intent.setAction(Intent.ACTION_VIEW);
            intent.addCategory(Intent.CATEGORY_DEFAULT);
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            if (screen != null) intent.putExtra("screen", screen);
            if (partnerId != null) intent.putExtra("partnerId", partnerId);
            if (partnerName != null) intent.putExtra("partnerName", partnerName);

            String deepLinkUrl;
            String encodedId = (partnerId != null) ? Uri.encode(partnerId) : "";
            if ("DiscussionRoomDetail".equals(screen)) {
                deepLinkUrl = "cinecraftconnect://discussions/" + encodedId + "?roomId=" + encodedId;
            } else if ("ProjectSpace".equals(screen)) {
                deepLinkUrl = "cinecraftconnect://projects/" + encodedId + "?projectId=" + encodedId + "&spaceId=" + encodedId;
            } else if ("Conversation".equals(screen)) {
                deepLinkUrl = "cinecraftconnect://messages/" + encodedId + "?partnerId=" + encodedId;
            } else {
                deepLinkUrl = "cinecraftconnect://notifications";
            }
            intent.setData(Uri.parse(deepLinkUrl));

            int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent contentIntent = PendingIntent.getActivity(context, notifId, intent, pendingFlags);

            // DeleteIntent when user swipes away
            Intent deleteIntent = new Intent(context, NotificationActionReceiver.class);
            deleteIntent.setAction(NotificationActionReceiver.ACTION_DISMISSED);
            deleteIntent.putExtra("conversationKey", conversationKey);
            PendingIntent deletePendingIntent = PendingIntent.getBroadcast(
                context,
                notifId * 37 + 3,
                deleteIntent,
                pendingFlags
            );

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, targetChannel)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                    .setDefaults(NotificationCompat.DEFAULT_ALL)
                    .setAutoCancel(true)
                    .setGroup("cinecraft_messages")
                    .setContentIntent(contentIntent)
                    .setDeleteIntent(deletePendingIntent);

            boolean isChat = "Conversation".equals(screen) ||
                             "DiscussionRoomDetail".equals(screen) ||
                             "ProjectSpace".equals(screen) ||
                             (partnerId != null && !partnerId.isEmpty());

            if (isChat) {
                // Resolve and store current user avatar
                String effectiveMyAvatar = (myAvatarUrl != null && !myAvatarUrl.trim().isEmpty()) ? myAvatarUrl : getCurrentUserAvatar(context);
                if (effectiveMyAvatar != null && !effectiveMyAvatar.trim().isEmpty()) {
                    setCurrentUserAvatar(context, effectiveMyAvatar);
                }

                Person.Builder userPersonBuilder = new Person.Builder()
                        .setName("You")
                        .setKey("current_user");

                Bitmap myAvatarBitmap = getCachedAvatarBitmap(context, effectiveMyAvatar);
                if (myAvatarBitmap != null) {
                    userPersonBuilder.setIcon(IconCompat.createWithBitmap(myAvatarBitmap));
                } else if (effectiveMyAvatar != null && !effectiveMyAvatar.trim().isEmpty()) {
                    sExecutor.execute(() -> {
                        Bitmap downloaded = loadAvatarBitmap(context, effectiveMyAvatar);
                        if (downloaded != null) {
                            postMessagingNotification(context, conversationKey, notifId, title, body, channelId, screen, partnerId, partnerName, avatarUrl, effectiveMyAvatar);
                        }
                    });
                }
                Person userPerson = userPersonBuilder.build();

                NotificationCompat.MessagingStyle style = new NotificationCompat.MessagingStyle(userPerson);
                boolean isGroup = "DiscussionRoomDetail".equals(screen) || "ProjectSpace".equals(screen);
                style.setGroupConversation(isGroup);

                String convTitle = (partnerName != null && !partnerName.isEmpty()) ? partnerName : title;
                if (convTitle != null && !convTitle.isEmpty()) {
                    style.setConversationTitle(convTitle);
                }

                // Check for partner/sender cached circular avatar
                Bitmap avatarBitmap = getCachedAvatarBitmap(context, avatarUrl);
                if (avatarBitmap != null) {
                    builder.setLargeIcon(avatarBitmap);
                } else if (avatarUrl != null && !avatarUrl.trim().isEmpty()) {
                    sExecutor.execute(() -> {
                        Bitmap downloaded = loadAvatarBitmap(context, avatarUrl);
                        if (downloaded != null) {
                            postMessagingNotification(context, conversationKey, notifId, title, body, channelId, screen, partnerId, partnerName, avatarUrl, effectiveMyAvatar);
                        }
                    });
                }

                List<MessageRecord> history = getMessages(context, conversationKey);
                if (history != null && !history.isEmpty()) {
                    for (MessageRecord m : history) {
                        if (m.isMe) {
                            Person.Builder meSender = new Person.Builder()
                                    .setName("You")
                                    .setKey("current_user");
                            Bitmap myBmp = null;
                            if (m.avatarUrl != null && !m.avatarUrl.trim().isEmpty()) {
                                myBmp = getCachedAvatarBitmap(context, m.avatarUrl);
                            }
                            if (myBmp == null) {
                                myBmp = myAvatarBitmap;
                            }
                            if (myBmp != null) {
                                meSender.setIcon(IconCompat.createWithBitmap(myBmp));
                            }
                            style.addMessage(m.text, m.time, meSender.build());
                        } else {
                            Person.Builder senderBuilder = new Person.Builder()
                                    .setName(m.sender != null && !m.sender.isEmpty() ? m.sender : (partnerName != null ? partnerName : "Sender"));
                            
                            Bitmap msgAvatar = (m.avatarUrl != null) ? getCachedAvatarBitmap(context, m.avatarUrl) : avatarBitmap;
                            if (msgAvatar != null) {
                                senderBuilder.setIcon(IconCompat.createWithBitmap(msgAvatar));
                            }
                            style.addMessage(m.text, m.time, senderBuilder.build());
                        }
                    }
                } else {
                    Person.Builder senderBuilder = new Person.Builder()
                            .setName(partnerName != null && !partnerName.isEmpty() ? partnerName : title);
                    if (avatarBitmap != null) {
                        senderBuilder.setIcon(IconCompat.createWithBitmap(avatarBitmap));
                    }
                    style.addMessage(body != null ? body : "", System.currentTimeMillis(), senderBuilder.build());
                }

                builder.setStyle(style);
                builder.setContentTitle(convTitle);
                builder.setContentText(body);

                // Direct Reply Action with RemoteInput
                RemoteInput remoteInput = new RemoteInput.Builder(NotificationActionReceiver.KEY_TEXT_REPLY)
                        .setLabel("Reply")
                        .build();

                Intent replyIntent = new Intent(context, NotificationActionReceiver.class);
                replyIntent.setAction(NotificationActionReceiver.ACTION_REPLY);
                replyIntent.putExtra("conversationKey", conversationKey);
                replyIntent.putExtra("notifId", notifId);
                replyIntent.putExtra("screen", screen);
                replyIntent.putExtra("partnerId", partnerId);
                replyIntent.putExtra("partnerName", partnerName);
                replyIntent.putExtra("channelId", targetChannel);
                replyIntent.putExtra("title", title);
                if (avatarUrl != null) replyIntent.putExtra("avatarUrl", avatarUrl);
                if (effectiveMyAvatar != null) replyIntent.putExtra("myAvatarUrl", effectiveMyAvatar);

                int replyFlags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    replyFlags |= PendingIntent.FLAG_MUTABLE;
                }
                PendingIntent replyPendingIntent = PendingIntent.getBroadcast(
                        context,
                        notifId * 37 + 1,
                        replyIntent,
                        replyFlags
                );

                NotificationCompat.Action replyAction = new NotificationCompat.Action.Builder(
                        android.R.drawable.ic_menu_send,
                        "Reply",
                        replyPendingIntent
                )
                .addRemoteInput(remoteInput)
                .setAllowGeneratedReplies(true)
                .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY)
                .setShowsUserInterface(false)
                .build();

                // Mark as read Action
                Intent markIntent = new Intent(context, NotificationActionReceiver.class);
                markIntent.setAction(NotificationActionReceiver.ACTION_MARK_AS_READ);
                markIntent.putExtra("conversationKey", conversationKey);
                markIntent.putExtra("notifId", notifId);
                markIntent.putExtra("screen", screen);
                markIntent.putExtra("partnerId", partnerId);

                int markFlags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    markFlags |= PendingIntent.FLAG_IMMUTABLE;
                }
                PendingIntent markPendingIntent = PendingIntent.getBroadcast(
                        context,
                        notifId * 37 + 2,
                        markIntent,
                        markFlags
                );

                NotificationCompat.Action markAction = new NotificationCompat.Action.Builder(
                        android.R.drawable.checkbox_on_background,
                        "Mark as read",
                        markPendingIntent
                )
                .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_MARK_AS_READ)
                .setShowsUserInterface(false)
                .build();

                builder.addAction(replyAction);
                builder.addAction(markAction);
            } else {
                builder.setContentTitle(title);
                builder.setContentText(body);
                builder.setStyle(new NotificationCompat.BigTextStyle().bigText(body));
            }

            manager.notify(notifId, builder.build());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static void handleInlineReply(
        Context context,
        String conversationKey,
        int notifId,
        String screen,
        String partnerId,
        String partnerName,
        String channelId,
        String title,
        String replyText,
        String avatarUrl,
        String myAvatarUrl
    ) {
        try {
            String effectiveMyAvatar = (myAvatarUrl != null && !myAvatarUrl.trim().isEmpty()) ? myAvatarUrl : getCurrentUserAvatar(context);

            // Append user's reply to history with their own avatar
            addMessage(context, conversationKey, "You", replyText, System.currentTimeMillis(), true, effectiveMyAvatar);

            // Re-post notification so Android inline reply shade updates with user's message and removes loading spinner
            postMessagingNotification(
                context,
                conversationKey,
                notifId,
                title,
                replyText,
                channelId,
                screen,
                partnerId,
                partnerName,
                avatarUrl,
                effectiveMyAvatar
            );
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static void dispatchAction(
        Context context,
        String action,
        String screen,
        String partnerId,
        String text,
        String conversationKey,
        String actionId
    ) {
        if (actionId == null) {
            actionId = UUID.randomUUID().toString();
        }

        // 1. If React context is active and running in foreground/background, emit directly and return
        // This PREVENTS duplicate message sends!
        boolean reactActive = (sReactContext != null && sReactContext.hasActiveReactInstance());
        if (reactActive) {
            try {
                WritableMap map = Arguments.createMap();
                map.putString("actionId", actionId);
                map.putString("action", action);
                if (screen != null) map.putString("screen", screen);
                if (partnerId != null) map.putString("partnerId", partnerId);
                if (text != null) map.putString("text", text);
                if (conversationKey != null) map.putString("conversationKey", conversationKey);

                sReactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("NotificationAction", map);
                return;
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        // 2. React is NOT active (app is in quit state) -> Start React Native HeadlessJsTaskService
        try {
            Intent serviceIntent = new Intent(context, NotificationActionHeadlessService.class);
            Bundle bundle = new Bundle();
            bundle.putString("actionId", actionId);
            bundle.putString("action", action);
            if (screen != null) bundle.putString("screen", screen);
            if (partnerId != null) bundle.putString("partnerId", partnerId);
            if (text != null) bundle.putString("text", text);
            if (conversationKey != null) bundle.putString("conversationKey", conversationKey);
            serviceIntent.putExtras(bundle);

            HeadlessJsTaskService.acquireWakeLockNow(context);
            context.startService(serviceIntent);
        } catch (Exception e) {
            e.printStackTrace();
            // Fallback: save to pending queue if headless service could not start
            savePendingAction(context, action, screen, partnerId, text, conversationKey, actionId);
        }
    }

    // -------------------------------------------------------------
    // React Methods
    // -------------------------------------------------------------
    @ReactMethod
    public void setCurrentUserAvatar(String avatarUrl) {
        try {
            Context context = getReactApplicationContext();
            setCurrentUserAvatar(context, avatarUrl);
            if (avatarUrl != null && !avatarUrl.trim().isEmpty()) {
                sExecutor.execute(() -> {
                    loadAvatarBitmap(context, avatarUrl);
                });
            }
        } catch (Exception ignored) {}
    }

    @ReactMethod
    public void displayNotification(String id, String title, String body, String channelId, String screen, String partnerId, String partnerName, String avatarUrl, String myAvatarUrl) {
        try {
            Context context = getReactApplicationContext();

            // Group by chat: every conversation gets a unique single conversationKey
            String resolvedKey;
            if (screen != null && partnerId != null && !partnerId.isEmpty()) {
                resolvedKey = screen + "_" + partnerId;
            } else if (partnerId != null && !partnerId.isEmpty()) {
                resolvedKey = partnerId;
            } else if (id != null && !id.isEmpty()) {
                resolvedKey = id;
            } else {
                resolvedKey = "general";
            }

            // Append incoming message to conversation message history
            String sender = (partnerName != null && !partnerName.isEmpty()) ? partnerName : title;
            addMessage(context, resolvedKey, sender, body, System.currentTimeMillis(), false, avatarUrl);

            int notifId = resolvedKey.hashCode();
            postMessagingNotification(context, resolvedKey, notifId, title, body, channelId, screen, partnerId, partnerName, avatarUrl, myAvatarUrl);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // Backward-compatible overloads
    @ReactMethod
    public void displayNotification(String id, String title, String body, String channelId, String screen, String partnerId, String partnerName, String avatarUrl) {
        displayNotification(id, title, body, channelId, screen, partnerId, partnerName, avatarUrl, null);
    }

    @ReactMethod
    public void displayNotification(String id, String title, String body, String channelId, String screen, String partnerId, String partnerName) {
        displayNotification(id, title, body, channelId, screen, partnerId, partnerName, null, null);
    }

    @ReactMethod
    public void dismissNotification(String conversationKey) {
        try {
            if (conversationKey == null || conversationKey.isEmpty()) return;
            Context context = getReactApplicationContext();
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.cancel(conversationKey.hashCode());
            }
            clearConversationMessages(context, conversationKey);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @ReactMethod
    public void dismissAllNotifications() {
        try {
            Context context = getReactApplicationContext();
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.cancelAll();
            }
            clearAllConversationMessages(context);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @ReactMethod
    public void getPendingActions(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_ACTIONS, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY_PENDING_ACTIONS, "[]");
            JSONArray arr = new JSONArray(raw);
            WritableArray out = Arguments.createArray();

            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                WritableMap map = Arguments.createMap();
                if (obj.has("actionId")) map.putString("actionId", obj.getString("actionId"));
                if (obj.has("action")) map.putString("action", obj.getString("action"));
                if (obj.has("screen")) map.putString("screen", obj.getString("screen"));
                if (obj.has("partnerId")) map.putString("partnerId", obj.getString("partnerId"));
                if (obj.has("text")) map.putString("text", obj.getString("text"));
                if (obj.has("conversationKey")) map.putString("conversationKey", obj.getString("conversationKey"));
                out.pushMap(map);
            }
            promise.resolve(out);
        } catch (Exception e) {
            promise.reject(e);
        }
    }

    @ReactMethod
    public void clearPendingActions(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_ACTIONS, Context.MODE_PRIVATE);
            prefs.edit().remove(KEY_PENDING_ACTIONS).apply();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject(e);
        }
    }

    @ReactMethod
    public void getInitialNotificationData(Promise promise) {
        try {
            Activity activity = getCurrentActivity();
            if (activity != null && activity.getIntent() != null) {
                Intent intent = activity.getIntent();
                WritableMap map = Arguments.createMap();
                if (intent.hasExtra("screen")) map.putString("screen", intent.getStringExtra("screen"));
                if (intent.hasExtra("partnerId")) map.putString("partnerId", intent.getStringExtra("partnerId"));
                if (intent.hasExtra("partnerName")) map.putString("partnerName", intent.getStringExtra("partnerName"));
                if (intent.getData() != null) map.putString("url", intent.getData().toString());
                promise.resolve(map);
                return;
            }
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject(e);
        }
    }
}
