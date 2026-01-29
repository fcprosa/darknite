import * as Notifications from "expo-notifications";
import { scheduleVibeReminder as scheduleVibeReminderImpl } from "../utils/notificationScheduler";

/**
 * Add a listener for notification response (when user taps a notification)
 * @param {Function} handler - Callback function that receives notification data
 * @returns {Function} Unsubscribe function
 */
export function addNotificationResponseListener(handler) {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response?.notification?.request?.content?.data ?? {};
    handler(data);
  });

  return () => {
    subscription.remove();
  };
}

/**
 * Schedule a one-time vibe reminder notification 15-20 minutes after check-in
 * Re-exported from notificationScheduler for convenience
 */
export { scheduleVibeReminderImpl as scheduleVibeReminder };
