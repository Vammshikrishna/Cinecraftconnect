package com.cinecraftconnect.app;

import android.content.Intent;
import android.os.Bundle;
import androidx.annotation.Nullable;
import com.facebook.react.HeadlessJsTaskService;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.jstasks.HeadlessJsTaskConfig;

public class NotificationActionHeadlessService extends HeadlessJsTaskService {
    @Override
    protected @Nullable HeadlessJsTaskConfig getTaskConfig(Intent intent) {
        Bundle extras = intent.getExtras();
        if (extras != null) {
            return new HeadlessJsTaskConfig(
                "NotificationActionTask",
                Arguments.fromBundle(extras),
                15000, // 15 seconds timeout
                true   // allowed in foreground
            );
        }
        return null;
    }
}
