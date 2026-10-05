package com.cinecraftconnect.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import androidx.core.app.RemoteInput;
import java.util.UUID;

public class NotificationActionReceiver extends BroadcastReceiver {
    public static final String ACTION_REPLY = "com.cinecraftconnect.app.ACTION_REPLY";
    public static final String ACTION_MARK_AS_READ = "com.cinecraftconnect.app.ACTION_MARK_AS_READ";
    public static final String ACTION_DISMISSED = "com.cinecraftconnect.app.ACTION_DISMISSED";
    public static final String KEY_TEXT_REPLY = "key_text_reply";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;

        String action = intent.getAction();
        String conversationKey = intent.getStringExtra("conversationKey");
        int notifId = intent.getIntExtra("notifId", 0);
        String screen = intent.getStringExtra("screen");
        String partnerId = intent.getStringExtra("partnerId");
        String partnerName = intent.getStringExtra("partnerName");
        String channelId = intent.getStringExtra("channelId");
        String title = intent.getStringExtra("title");
        String avatarUrl = intent.getStringExtra("avatarUrl");
        String myAvatarUrl = intent.getStringExtra("myAvatarUrl");
        String actionId = UUID.randomUUID().toString();

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        if (ACTION_MARK_AS_READ.equals(action)) {
            // 1. Cancel notification immediately
            if (manager != null && notifId != 0) {
                manager.cancel(notifId);
            }

            // 2. Clear stored message history for this chat
            if (conversationKey != null) {
                NotificationBridgeModule.clearConversationMessages(context, conversationKey);
            }

            // 3. Dispatch mark_as_read action to React Native / Supabase
            NotificationBridgeModule.dispatchAction(
                context,
                "mark_as_read",
                screen,
                partnerId,
                null,
                conversationKey,
                actionId
            );
        } else if (ACTION_REPLY.equals(action)) {
            Bundle remoteInput = RemoteInput.getResultsFromIntent(intent);
            if (remoteInput != null) {
                CharSequence replyText = remoteInput.getCharSequence(KEY_TEXT_REPLY);
                if (replyText != null && replyText.length() > 0) {
                    String text = replyText.toString().trim();

                    // 1. Update notification in-place with user's reply so Android stops spinner and displays sent message
                    NotificationBridgeModule.handleInlineReply(
                        context,
                        conversationKey,
                        notifId,
                        screen,
                        partnerId,
                        partnerName,
                        channelId,
                        title,
                        text,
                        avatarUrl,
                        myAvatarUrl
                    );

                    // 2. Dispatch reply action to React Native / background service to write to database
                    NotificationBridgeModule.dispatchAction(
                        context,
                        "reply",
                        screen,
                        partnerId,
                        text,
                        conversationKey,
                        actionId
                    );
                }
            }
        } else if (ACTION_DISMISSED.equals(action)) {
            // When user explicitly swipes away the notification, clear cached message stack for that chat
            if (conversationKey != null) {
                NotificationBridgeModule.clearConversationMessages(context, conversationKey);
            }
        }
    }
}
