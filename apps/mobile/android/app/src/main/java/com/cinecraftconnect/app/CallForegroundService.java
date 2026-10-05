package com.cinecraftconnect.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

/**
 * Keeps an active call alive while the app is in the background.
 *
 * Since Android 14 (targetSdk 34) the OS stops microphone capture for an app that has no foreground service of type
 * "microphone", so without this the other person stops hearing you the moment you leave the app (e.g. to reply on
 * another app) even though the call UI still looks connected.
 */
public class CallForegroundService extends Service {
    public static final String ACTION_START = "com.cinecraftconnect.app.CALL_SERVICE_START";
    public static final String ACTION_STOP = "com.cinecraftconnect.app.CALL_SERVICE_STOP";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_WITH_MIC = "withMic";

    private static final String CHANNEL_ID = "cinecraft_active_call";
    private static final int NOTIFICATION_ID = 7421;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        String title = intent != null ? intent.getStringExtra(EXTRA_TITLE) : null;
        boolean withMic = intent == null || intent.getBooleanExtra(EXTRA_WITH_MIC, true);
        Notification notification = buildNotification(title != null ? title : "Call in progress");

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Listeners in an audio space only play audio; anyone who can speak also captures the microphone.
                int type = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK;
                if (withMic) type |= ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
                startForeground(NOTIFICATION_ID, notification, type);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            // Foreground start can be refused (e.g. mic permission not granted yet); never crash the call over it.
            stopSelf();
            return START_NOT_STICKY;
        }
        return START_NOT_STICKY;
    }

    private Notification buildNotification(String title) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "Active call", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Shown while a call is running so audio keeps working in the background");
            channel.setShowBadge(false);
            nm.createNotificationChannel(channel);
        }

        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) piFlags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent contentIntent = PendingIntent.getActivity(this, 0, open, piFlags);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText("Tap to return to the call")
                .setOngoing(true)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(contentIntent)
                .build();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
