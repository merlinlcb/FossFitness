// Local-only notifications. No push service, no tokens, no network.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { buildSchedule } from './schedule';

let lastSignature = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function setupNotifications(waterPresetLabel = 'Log a glass') {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      description: 'Water, meal, weigh-in and activity reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200],
    });
    await Notifications.setNotificationChannelAsync('fasting', {
      name: 'Fasting',
      description: 'Eating window and fasting milestone alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
    });
  }
  await Notifications.setNotificationCategoryAsync('water', [
    { identifier: 'log-water', buttonTitle: waterPresetLabel, options: { opensAppToForeground: true } },
  ]);
  await Notifications.setNotificationCategoryAsync('fast', [
    { identifier: 'start-fast', buttonTitle: 'Start fast', options: { opensAppToForeground: true } },
  ]);
}

export async function getPermissionStatus() {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export async function requestPermission() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status;
}

// Replace all scheduled reminders with a fresh plan computed from current state.
// Calls are serialized so overlapping reschedules can't interleave cancel/schedule.
let queue = Promise.resolve();
export function rescheduleAll(state) {
  queue = queue.then(() => doReschedule(state));
  return queue;
}

async function doReschedule(state) {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return { scheduled: 0, permission: status };

    const plan = buildSchedule(state);
    const signature = JSON.stringify(plan.map((p) => [p.date.getTime(), p.title, p.body]));
    if (signature === lastSignature) return { scheduled: plan.length, permission: status, unchanged: true };

    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const p of plan) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: p.title,
          body: p.body,
          data: { kind: p.kind },
          categoryIdentifier: p.category,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: p.date,
          channelId: p.kind === 'fasting' ? 'fasting' : 'reminders',
        },
      });
    }
    lastSignature = signature;
    return { scheduled: plan.length, permission: status };
  } catch (e) {
    console.warn('Failed to schedule reminders', e);
    return { scheduled: 0, error: String(e) };
  }
}

export async function cancelAll() {
  lastSignature = null;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function sendTestNotification() {
  await Notifications.scheduleNotificationAsync({
    content: { title: '✅ Reminders are working', body: 'This is a test reminder from FossFitness.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: 'reminders' },
  });
}

export function addResponseListener(handler) {
  const sub = Notifications.addNotificationResponseReceivedListener(handler);
  return () => sub.remove();
}

export async function getLastResponse() {
  return Notifications.getLastNotificationResponseAsync();
}
