import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Thin wrapper so screens can add feedback without repeating the platform
 * check. Every call is fire-and-forget — haptics failing should never surface
 * as an error to the user, and on web they simply do nothing.
 */
function fire(run: () => Promise<void>) {
  if (!supported) return;
  void run().catch(() => {
    // Device has no haptic engine, or the user disabled system haptics.
  });
}

export const haptics = {
  /** Light tap — navigating, opening a sheet, copying. */
  tap: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Selection change — checkboxes, chips, segmented controls. */
  select: () => fire(() => Haptics.selectionAsync()),
  /** Something completed — bill settled, chore done, household created. */
  success: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Something failed — a write was rejected and rolled back. */
  error: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
