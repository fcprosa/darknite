import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY_PREFIX = "reminder_notification_ids";

function getStorageKey(userId) {
  return `${STORAGE_KEY_PREFIX}_${userId}`;
}

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
 * Cancel all existing reminder notifications for a user.
 * Read stored IDs -> cancel each -> clear storage.
 * @param {string} userId - User ID for per-user storage key
 */
export async function cancelExistingReminders(userId) {
  if (!userId) {
    console.warn("[NotificationScheduler] cancelExistingReminders called without userId");
    return;
  }
  try {
    const key = getStorageKey(userId);
    const storedIdsJson = await AsyncStorage.getItem(key);
    if (storedIdsJson) {
      const notificationIds = JSON.parse(storedIdsJson);
      for (const id of notificationIds) {
        try {
          await Notifications.cancelScheduledNotificationAsync(id);
        } catch (e) {
          console.warn(`[NotificationScheduler] Could not cancel notification ${id}:`, e);
        }
      }
      await AsyncStorage.removeItem(key);
    }
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
 * Schedule weekly reminder notifications.
 * Dedup: cancel existing reminders for this user first, then schedule new, then persist IDs.
 * Uses only weekly triggers: { weekday, hour, minute, repeats: true }.
 * @param {Object} options - Options object
 * @param {string} options.preferredScene - 'bars', 'clubs', or 'both'
 * @param {string[]} options.goingOutDays - Array of day codes (mon, tue, etc.)
 * @param {string} options.userId - User ID for per-user storage
 * @returns {Promise<string[]>} Array of scheduled notification IDs
 */
export async function scheduleWeeklyReminders({ preferredScene, goingOutDays, userId }) {
  if (!goingOutDays || goingOutDays.length === 0) {
    console.warn("[NotificationScheduler] No days provided, skipping scheduling");
    return [];
  }

  if (!preferredScene) {
    console.warn("[NotificationScheduler] No preferred scene provided, skipping scheduling");
    return [];
  }

  if (!userId) {
    console.warn("[NotificationScheduler] No userId provided, skipping scheduling");
    return [];
  }

  // 1. Cancel previously scheduled reminder IDs (read -> cancel each -> clear)
  await cancelExistingReminders(userId);

  const notificationIds = [];
  const { hour, minute } = getNotificationTime(preferredScene);
  const message = getNotificationMessage(preferredScene);

  try {
    for (const dayCode of goingOutDays) {
      const weekday = mapDayCodeToWeekday(dayCode);

      // 2. Schedule with WEEKLY trigger only: { weekday, hour, minute, repeats: true }
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

    // 3. Persist new IDs
    await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(notificationIds));

    return notificationIds;
  } catch (error) {
    console.error("[NotificationScheduler] Error scheduling reminders:", error);
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

/**
 * Dev-only: reset all scheduled notifications for testing.
 * Calls cancelAllScheduledNotificationsAsync and optionally clears
 * stored reminder IDs for the given user.
 * @param {string} [userId] - If provided, clears AsyncStorage key for this user
 */
export async function resetRemindersForTesting(userId) {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (userId) {
      await AsyncStorage.removeItem(getStorageKey(userId));
    }
    console.log("[NotificationScheduler] resetRemindersForTesting done");
  } catch (error) {
    console.error("[NotificationScheduler] resetRemindersForTesting error:", error);
  }
}
