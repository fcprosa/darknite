import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY_PREFIX = "reminder_notification_ids";

function getStorageKey(userId) {
  return `${STORAGE_KEY_PREFIX}_${userId}`;
}

function getSignatureKey(userId) {
  return `reminder_signature_${userId}`;
}

/**
 * Generate a signature from reminder settings to detect if they changed
 */
function generateReminderSignature({ goingOutDays, preferredScene, hour, minute }) {
  const sortedDays = [...goingOutDays].sort().join(',');
  return JSON.stringify({ days: sortedDays, pref: preferredScene, hour, minute });
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
 * Read stored IDs -> cancel each -> clear storage and signature.
 * @param {string} userId - User ID for per-user storage key
 */
export async function cancelExistingReminders(userId) {
  if (!userId) {
    console.warn("[NotificationScheduler] cancelExistingReminders called without userId");
    return;
  }
  try {
    const key = getStorageKey(userId);
    const signatureKey = getSignatureKey(userId);
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
    // Also clear signature so settings are considered "changed" next time
    await AsyncStorage.removeItem(signatureKey);
  } catch (error) {
    console.error("[NotificationScheduler] Error canceling reminders:", error);
  }
}

/**
 * Calculate the exact next Date for a given day code at a specific hour and minute.
 * Uses JS Date day numbers (0=Sunday … 6=Saturday).
 * If today IS the target weekday but the time has already passed, returns next week's occurrence.
 * @param {string} dayCode - Day code (mon, tue, wed, thu, fri, sat, sun)
 * @param {number} hour - 24-hour hour
 * @param {number} minute - Minute
 * @returns {Date} The next future Date at exactly hour:minute for that weekday
 */
function getNextWeekdayDate(dayCode, hour, minute) {
  const dayCodeToJSDay = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const targetDay = dayCodeToJSDay[dayCode] ?? 1; // default to Monday

  const now = new Date();
  const candidate = new Date(now);
  candidate.setHours(hour, minute, 0, 0);

  const currentDay = now.getDay();
  let daysAhead = targetDay - currentDay;

  // Same day but the time has already passed → push to next week's occurrence
  if (daysAhead < 0 || (daysAhead === 0 && candidate.getTime() <= now.getTime())) {
    daysAhead += 7;
  }

  candidate.setDate(now.getDate() + daysAhead);
  return candidate;
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
 * Get notification title based on preferred scene
 * @param {string} preferredScene - 'bars', 'clubs', or 'both'
 * @returns {string} Notification title
 */
function getNotificationTitle(preferredScene) {
  const titles = {
    bars: [
      "Time to hit the bars! 🍻",
      "Your night starts now 🌙",
      "Bar crawl time? 🍸",
    ],
    clubs: [
      "The night is calling 🌃",
      "Ready to dance? 💃",
      "Club time! 🎉",
    ],
    both: [
      "Tonight's the night! ✨",
      "What's the move? 🌙",
      "Your night awaits 🔥",
    ],
  };
  const options = titles[preferredScene] || titles.both;
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Get notification message based on preferred scene
 * @param {string} preferredScene - 'bars', 'clubs', or 'both'
 * @returns {string} Notification message
 */
function getNotificationMessage(preferredScene) {
  const messages = {
    bars: [
      "Check what's popping before you head out",
      "See which spots are buzzing right now",
      "Drop a vibe and help others find the party",
    ],
    clubs: [
      "Check the line situation before you go",
      "See what's hot tonight and skip the dead spots",
      "The dance floor is waiting – check the vibe first",
    ],
    both: [
      "See what's live in your area right now",
      "Check the vibes before you head out",
      "Find out where everyone's at tonight",
    ],
  };
  const options = messages[preferredScene] || messages.both;
  return options[Math.floor(Math.random() * options.length)];
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

  const hour = 21;
  const minute = 30;
  const message = "NYC is waking up. Check the live vibes or drop one if you're already out!";

  // Check if settings changed - if not, skip re-scheduling
  const newSignature = generateReminderSignature({ goingOutDays, preferredScene, hour, minute });
  const signatureKey = getSignatureKey(userId);
  try {
    const existingSignature = await AsyncStorage.getItem(signatureKey);
    if (existingSignature === newSignature) {
      console.log("[NotificationScheduler] Reminder settings unchanged, skipping re-schedule");
      // Return existing IDs if we have them
      const existingIdsJson = await AsyncStorage.getItem(getStorageKey(userId));
      if (existingIdsJson) {
        return JSON.parse(existingIdsJson);
      }
      return [];
    }
  } catch (e) {
    console.warn("[NotificationScheduler] Error checking signature:", e);
    // Continue with scheduling if signature check fails
  }

  // 1. NUCLEAR: Cancel ALL scheduled notifications before scheduling new ones
  // This prevents duplicates from orphaned notifications
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log("[NotificationScheduler] Canceled all scheduled notifications");
  } catch (e) {
    console.warn("[NotificationScheduler] Error canceling all notifications:", e);
  }

  // 2. Cancel previously scheduled reminder IDs for this user (read -> cancel each -> clear)
  await cancelExistingReminders(userId);

  const notificationIds = [];

  try {
    for (const dayCode of goingOutDays) {
      // Compute the exact next Date for this weekday at 21:30, guaranteed to be in the future
      const triggerDate = getNextWeekdayDate(dayCode, hour, minute);

      const title = "What's the move tonight? 👀";
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: message,
          sound: true,
          data: {
            type: "weekly_reminder",
            preferredScene,
            dayCode,
          },
        },
        trigger: {
          date: triggerDate,
        },
      });

      notificationIds.push(notificationId);
      console.log(`[NotificationScheduler] Scheduled reminder for ${dayCode} at ${triggerDate.toISOString()}`);
    }

    // 4. Persist new IDs and signature
    await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(notificationIds));
    await AsyncStorage.setItem(signatureKey, newSignature);

    console.log(`[NotificationScheduler] Scheduled ${notificationIds.length} reminders for user ${userId}`);
    return notificationIds;
  } catch (error) {
    console.error("[NotificationScheduler] Error scheduling reminders:", error);
    // Cleanup on error
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
 * Get vibe reminder title and message
 * @param {string} venueName - Venue name
 * @returns {{title: string, body: string}} Title and body for notification
 */
function getVibeReminderContent(venueName) {
  const options = [
    {
      title: "How's the vibe? 🎉",
      body: `You're at ${venueName} – let others know what's up!`,
    },
    {
      title: "Quick update? ✨",
      body: `Share the vibe at ${venueName} and earn points!`,
    },
    {
      title: "Still at ${venueName}? 🔥",
      body: "Drop a vibe and help others find the party!",
    },
    {
      title: "Vibe check! 📍",
      body: `How's ${venueName} right now? Share with the community.`,
    },
  ];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Schedule a one-time vibe reminder notification 15-20 minutes after check-in
 * @param {Object} options - Options object
 * @param {string} options.venueId - Venue ID
 * @param {string} options.venueName - Venue name
 * @param {string} options.checkInTime - ISO string of check-in time
 * @returns {Promise<string|null>} Notification ID or null if failed
 */
export async function scheduleVibeReminder({ venueId, venueName, checkInTime }) {
  try {
    const checkInDate = new Date(checkInTime);
    // Schedule 15-20 minutes after check-in (randomized to avoid spam)
    const delayMinutes = 15 + Math.floor(Math.random() * 6); // 15-20 minutes
    const triggerTime = new Date(checkInDate.getTime() + delayMinutes * 60 * 1000);

    // Don't schedule if trigger time is in the past
    if (triggerTime <= new Date()) {
      console.log("[NotificationScheduler] Trigger time is in the past, skipping");
      return null;
    }

    const { title, body } = getVibeReminderContent(venueName);
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data: {
          type: 'vibe_reminder',
          venueId,
          venueName
        },
      },
      trigger: {
        date: triggerTime,
      },
    });

    console.log(`[NotificationScheduler] Scheduled vibe reminder for ${venueName} at ${triggerTime.toISOString()}`);
    return notificationId;
  } catch (error) {
    console.error("[NotificationScheduler] Error scheduling vibe reminder:", error);
    return null;
  }
}

/**
 * Dev-only: reset all scheduled notifications for testing.
 * Calls cancelAllScheduledNotificationsAsync and optionally clears
 * stored reminder IDs and signature for the given user.
 * @param {string} [userId] - If provided, clears AsyncStorage keys for this user
 */
export async function resetRemindersForTesting(userId) {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (userId) {
      await AsyncStorage.removeItem(getStorageKey(userId));
      await AsyncStorage.removeItem(getSignatureKey(userId));
    }
    console.log("[NotificationScheduler] resetRemindersForTesting done");
  } catch (error) {
    console.error("[NotificationScheduler] resetRemindersForTesting error:", error);
  }
}
