import React from 'react';

/**
 * InAppNotificationListener has been deprecated in favor of native FCM push notifications.
 * Mobile APK exclusively uses Firebase Cloud Messaging (FCM) system notifications.
 */
export const InAppNotificationListener = ({ navigationRef }: { navigationRef?: any }) => {
  return null;
};

export default InAppNotificationListener;
