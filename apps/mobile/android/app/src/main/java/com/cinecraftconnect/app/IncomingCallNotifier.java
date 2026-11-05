package com.cinecraftconnect.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Rings for an incoming call when the app is in the background or closed (the push arrives as a high-priority data
 * message, so this runs without the screen being on). It posts a full-screen notification: on a locked phone it
 * opens the app over the lock screen, on an unlocked phone it shows a heads-up card with Accept and Decline.
 */
public class IncomingCallNotifier {
    public static final String CHANNEL_ID = "incoming_calls";
    public static final int NOTIFICATION_ID = 7001;
    public static final String ACTION_DECLINE = "com.cinecraftconnect.app.ACTION_CALL_DECLINE";
    private static final long RING_TIMEOUT_MS = 45000L;

    private static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;

        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Incoming calls", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Rings when someone calls you");
        Uri ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        channel.setSound(ringtone, attrs);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 600, 400, 600, 400, 600});
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.setBypassDnd(false);
        manager.createNotificationChannel(channel);
    }

    private static PendingIntent openApp(Context context, Intent intent, int requestCode) {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(context, requestCode, intent, flags);
    }

    private static Intent callIntent(Context context, String callerId, String callerName, String callerAvatar,
                                     String roomId, String roomName, String roomType, boolean isVideo, String callAction) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("incomingCall", true);
        // proves the intent was made by this app's own notification (see CallIntentGuard)
        intent.putExtra(CallIntentGuard.EXTRA, CallIntentGuard.token(context));
        intent.putExtra("callerId", callerId);
        intent.putExtra("callerName", callerName);
        if (callerAvatar != null) intent.putExtra("callerAvatar", callerAvatar);
        intent.putExtra("roomId", roomId);
        intent.putExtra("roomName", roomName);
        intent.putExtra("roomType", roomType);
        intent.putExtra("isVideo", isVideo);
        if (callAction != null) intent.putExtra("callAction", callAction);
        return intent;
    }

    private static void post(Context context, String callerId, String callerName, String callerAvatar, String roomId,
                             String roomName, String roomType, boolean isVideo, Bitmap avatar) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        PendingIntent fullScreen = openApp(context, callIntent(context, callerId, callerName, callerAvatar, roomId, roomName, roomType, isVideo, null), 1);
        PendingIntent accept = openApp(context, callIntent(context, callerId, callerName, callerAvatar, roomId, roomName, roomType, isVideo, "accept"), 2);

        Intent declineIntent = new Intent(context, IncomingCallActionReceiver.class);
        declineIntent.setAction(ACTION_DECLINE);
        int declineFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) declineFlags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent decline = PendingIntent.getBroadcast(context, 3, declineIntent, declineFlags);

        boolean inGroup = roomType != null && !roomType.equals("direct") && roomName != null && !roomName.isEmpty();
        String kind = isVideo ? "video call" : "call";
        String text = inGroup ? "Incoming " + kind + " · " + roomName : "Incoming " + kind + "…";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(callerName)
                .setContentText(text)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(false)
                .setOnlyAlertOnce(true)
                .setTimeoutAfter(RING_TIMEOUT_MS)
                .setContentIntent(fullScreen)
                .setFullScreenIntent(fullScreen, true)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Decline", decline)
                .addAction(android.R.drawable.ic_menu_call, "Accept", accept);
        if (avatar != null) builder.setLargeIcon(avatar);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            builder.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE));
            builder.setVibrate(new long[]{0, 600, 400, 600, 400, 600});
        }

        Notification notification = builder.build();
        // keep ringing until answered or timed out
        notification.flags |= Notification.FLAG_INSISTENT;
        manager.notify(NOTIFICATION_ID, notification);
    }

    public static void show(final Context context, final String callerId, final String callerName, final String callerAvatar,
                            final String roomId, final String roomName, final String roomType, final boolean isVideo) {
        try {
            ensureChannel(context);
            // ring at once, then replace it with the same notification carrying the picture once it has downloaded
            post(context, callerId, callerName, callerAvatar, roomId, roomName, roomType, isVideo, null);
            if (callerAvatar == null || callerAvatar.isEmpty()) return;
            new Thread(new Runnable() {
                @Override
                public void run() {
                    Bitmap bitmap = null;
                    // The picture address comes from the caller's profile: only trusted hosts, no redirects, size-limited.
                    bitmap = SafeAvatar.fetch(callerAvatar);
                    if (bitmap != null) {
                        post(context, callerId, callerName, callerAvatar, roomId, roomName, roomType, isVideo, bitmap);
                    }
                }
            }).start();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static void cancel(Context context) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.cancel(NOTIFICATION_ID);
    }
}
