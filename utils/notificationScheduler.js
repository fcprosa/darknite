import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "darknite_reminder_ids";

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Request notification permission
 * @returns {Promise<boolean>} True if permission granted
 */
export async function requestNotificationPermission() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === "granted";
  } catch (error) {
    console.error("[NotificationScheduler] Error requesting permission:", error);
    return false;
  }
}

/**
 * Cancel all existing reminder notifications
 */
export async function cancelExistingReminders() {
  try {
    // Get stored notification IDs
    const storedIdsJson = await AsyncStorage.getItem(STORAGE_KEY);
    if (storedIdsJson) {
      const notificationIds = JSON.parse(storedIdsJson);
      
      // Cancel each notification
      for (const id of notificationIds) {
        try {
          await Notifications.cancelScheduledNotificationAsync(id);
        } catch (e) {
          console.warn(`[NotificationScheduler] Could not cancel notification ${id}:`, e);
        }
      }
      
      // Clear stored IDs
      await AsyncStorage.removeItem(STORAGE_KEY);
    }

    // Also cancel all notifications as a safety measure
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error("[NotificationScheduler] Error canceling reminders:", error);
  }
}

/**
 * Map day code to Expo weekday (1=Sunday, 2=Monday, ..., 7=Saturday)
 * @param {string} dayCode - Day code (mon, tue, wed, thu, fri, sat, sun)
 * @returns {number} Expo weekday number
 */
function mapDayCodeToWeekday(dayCode) {
  const mapping = {
    sun: 1,
    mon: 2,
    tue: 3,
    wed: 4,
    thu: 5,
    fri: 6,
    sat: 7,
  };
  return mapping[dayCode] || 2; // Default to Monday
}

/**
 * Get notification time based on preferred scene
 * @param {string} preferredScene - 'bars', 'clubs', or 'both'
 * @returns {{hour: number, minute: number}} Time object
 */
function getNotificationTime(preferredScene) {
  switch (preferredScene) {
    case "bars":
      return { hour: 19, minute: 0 }; // 7:00 PM
    case "clubs":
      return { hour: 22, minute: 30 }; // 10:30 PM
    case "both":
    default:
      return { hour: 20, minute: 30 }; // 8:30 PM
  }
}

/**
 * Get notification message based on preferred scene
 * @param {string} preferredScene - 'bars', 'clubs', or 'both'
 * @returns {string} Notification message
 */
function getNotificationMessage(preferredScene) {
  switch (preferredScene) {
    case "bars":
      return "Where you starting? Drop a vibe.";
    case "clubs":
      return "Tonight's the night. Drop the vibe 🕺";
    case "both":
    default:
      return "What's the move tonight? Drop a vibe.";
  }
}

/**
 * Schedule weekly reminder notifications
 * @param {Object} options - Options object
 * @param {string} options.preferredScene - 'bars', 'clubs', or 'both'
 * @param {string[]} options.goingOutDays - Array of day codes (mon, tue, etc.)
 * @returns {Promise<string[]>} Array of scheduled notification IDs
 */
export async function scheduleWeeklyReminders({ preferredScene, goingOutDays }) {
  if (!goingOutDays || goingOutDays.length === 0) {
    console.warn("[NotificationScheduler] No days provided, skipping scheduling");
    return [];
  }

  if (!preferredScene) {
    console.warn("[NotificationScheduler] No preferred scene provided, skipping scheduling");
    return [];
  }

  const notificationIds = [];
  const { hour, minute } = getNotificationTime(preferredScene);
  const message = getNotificationMessage(preferredScene);

  try {
    for (const dayCode of goingOutDays) {
      const weekday = mapDayCodeToWeekday(dayCode);

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "DarkNite",
          body: message,
          sound: true,
        },
        trigger: {
          weekday,
          hour,
          minute,
          repeats: true,
        },
      });

      notificationIds.push(notificationId);
      console.log(`[NotificationScheduler] Scheduled reminder for ${dayCode} at ${hour}:${minute.toString().padStart(2, "0")}`);
    }

    // Store notification IDs for later cancellation
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notificationIds));

    return notificationIds;
  } catch (error) {
    console.error("[NotificationScheduler] Error scheduling reminders:", error);
    // Try to clean up any partially scheduled notifications
    for (const id of notificationIds) {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    throw error;
  }
}
