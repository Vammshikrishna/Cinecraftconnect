package com.cinecraftconnect.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Handles the Decline button on the ringing notification: stop ringing and remove it. */
public class IncomingCallActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !IncomingCallNotifier.ACTION_DECLINE.equals(intent.getAction())) return;
        IncomingCallNotifier.cancel(context);
    }
}
