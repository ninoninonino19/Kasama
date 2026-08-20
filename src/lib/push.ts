import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';

import { supabase } from './supabase';

/**
 * Push registration.
 *
 * A note on Expo Go: since SDK 53 it no longer delivers remote push
 * notifications on either platform. Everything here is written for a
 * development or production build, and deliberately no-ops in Expo Go rather
 * than asking for a permission it can't use and then never buzzing — which
 * would look exactly like a bug in this code.
 */
export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Push is meaningless on web here — no service worker, no VAPID keys. */
export const pushSupported = !isExpoGo && Platform.OS !== 'web';

/**
 * Android needs a channel per kind of notification, or everything arrives
 * silently and with no way for the user to mute one sort without muting all.
 * The ids match the `category` the Edge Function sends.
 */
export async function configureChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const channels: { id: string; name: string }[] = [
    { id: 'bills', name: 'Bills' },
    { id: 'chores', name: 'Chores' },
    { id: 'board', name: 'Board notes' },
  ];

  await Promise.all(
    channels.map((channel) =>
      Notifications.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        importance: Notifications.AndroidImportance.DEFAULT,
      })
    )
  );
}

/**
 * Whether this device has already been offered notifications on first launch.
 *
 * Per device rather than per account: the OS permission is the phone's, so
 * someone signing in on a housemate's phone shouldn't be asked again about a
 * permission that was already decided there.
 */
const OFFERED_KEY = 'kasama.push.offered';

export async function hasBeenOfferedPush(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(OFFERED_KEY)) === 'true';
  } catch {
    // A storage read that fails shouldn't turn into a prompt on every launch;
    // treat it as already asked.
    return true;
  }
}

export async function markPushOffered(): Promise<void> {
  try {
    await AsyncStorage.setItem(OFFERED_KEY, 'true');
  } catch {
    // Worst case they get asked once more next launch.
  }
}

export type PushRegistration =
  | { status: 'registered' }
  | { status: 'denied' }
  | { status: 'unsupported'; reason: string };

/**
 * Asks for permission if it hasn't been asked yet, then stores this device's
 * token against the signed-in user.
 *
 * Only ever called from a screen where the user has just asked for
 * notifications. Prompting on first launch spends the one permission dialogue
 * the OS gives you before anyone knows what the app is for.
 */
export async function registerForPush(): Promise<PushRegistration> {
  if (isExpoGo) {
    return {
      status: 'unsupported',
      reason:
        'Expo Go stopped delivering push notifications in SDK 53 — a development build is needed.',
    };
  }
  if (Platform.OS === 'web') {
    return { status: 'unsupported', reason: 'Push notifications are not set up for web.' };
  }

  const existing = await Notifications.getPermissionsAsync();
  const granted =
    existing.granted ||
    (existing.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);

  if (!granted) return { status: 'denied' };

  await configureChannels();

  // projectId comes from app.json's EAS config; without it Expo can't mint a
  // token for a standalone build.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  const { data: token } = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );

  const { error } = await supabase.rpc('register_device_token', {
    device_token: token,
    device_platform: Platform.OS === 'ios' ? 'ios' : 'android',
  });
  if (error) throw error;

  return { status: 'registered' };
}

/**
 * Drops this device's token. Called on sign-out, so the next person to log in
 * on a shared phone doesn't receive the last person's notifications.
 *
 * Best-effort: failing to unregister must never block signing out.
 */
export async function unregisterFromPush(): Promise<void> {
  if (!pushSupported) return;

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    await supabase.from('device_tokens').delete().eq('token', token);
  } catch {
    // No token, no permission, or no network — nothing worth reporting here.
  }
}
