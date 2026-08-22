import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, { Keyframe, ReduceMotion } from 'react-native-reanimated';

import { haptics } from '../../lib/haptics';
import { duration, easing, press } from '../../lib/motion';

export type DialogActionStyle = 'default' | 'destructive' | 'cancel';

export type DialogAction = {
  label: string;
  style?: DialogActionStyle;
  onPress?: () => void | Promise<void>;
};

export type DialogOptions = {
  title: string;
  message?: string;
  actions: DialogAction[];
};

/**
 * The card materialises; the scrim behind it fades (`animationType="fade"`).
 *
 * From 0.94 rather than from nothing — a dialog that scales up from zero
 * reads as a cartoon, because nothing in the world appears from a point. The
 * pair of them also gives the two layers different jobs: the scrim dims the
 * screen, the card arrives on top of it.
 *
 * Only the entrance is animated. `Modal` unmounts its children the moment
 * `visible` flips, so an exit animation would need the dialog to keep itself
 * open past the user's decision — and a confirmation that lingers after you've
 * answered it is worse than one that leaves with the scrim. Asymmetric on
 * purpose: arriving is explained, leaving is instant.
 */
const CARD_IN = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.94 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: easing.out },
})
  .duration(duration.panel)
  // Reduced motion keeps the fade — which is what says "something opened" —
  // and drops the scale.
  .reduceMotion(ReduceMotion.System);

/**
 * Confirmation dialogs that work everywhere.
 *
 * React Native's `Alert` is not implemented on web — `react-native-web` ships
 * it as `static alert() {}`, a literal no-op. Every confirm in the app went
 * through it, so on web the destructive paths simply did nothing: pressing
 * "Log out" or "Leave household" called into a function that returned
 * immediately and the callback never ran. Nothing failed loudly, because
 * nothing failed at all.
 *
 * This is a `Modal` instead, which `react-native-web` does implement (with a
 * focus trap), so one code path serves iOS, Android and web. Keeping the shape
 * close to `Alert.alert` — title, message, a list of actions — made the
 * migration mechanical, and it means the dialogs are now drawn in the app's
 * own tokens rather than three different system styles.
 */
const DialogContext = createContext<((options: DialogOptions) => Promise<void>) | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<DialogOptions | null>(null);
  // Resolved when the dialog closes, so callers can `await` a confirmation
  // and keep their own control flow in one place.
  const resolver = useRef<(() => void) | null>(null);

  const close = useCallback(() => {
    setOptions(null);
    resolver.current?.();
    resolver.current = null;
  }, []);

  const show = useCallback((next: DialogOptions) => {
    // A second dialog while one is open would strand the first one's promise.
    resolver.current?.();
    setOptions(next);
    return new Promise<void>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const cancelAction = options?.actions.find((action) => action.style === 'cancel');
  const otherActions = options?.actions.filter((action) => action.style !== 'cancel') ?? [];
  // Two buttons sit side by side; three or more stack, where a row would
  // squeeze labels like "Make them an admin" past legibility.
  const inline = otherActions.length === 1 && Boolean(cancelAction);

  const run = (action: DialogAction) => {
    haptics.tap();
    close();
    // After the close, so a handler that navigates isn't racing a dismissal.
    void action.onPress?.();
  };

  return (
    <DialogContext.Provider value={show}>
      {children}

      <Modal
        visible={options !== null}
        transparent
        animationType="fade"
        // Android's back button and the web's Escape key both land here.
        onRequestClose={() => (cancelAction ? run(cancelAction) : close())}
      >
        <View className="flex-1 items-center justify-center bg-bezel/50 px-6">
          {/* Tapping the scrim is a cancel, but only where cancelling is
              actually one of the offered choices. */}
          <Pressable
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="absolute inset-0"
            onPress={() => (cancelAction ? run(cancelAction) : undefined)}
          />

          {options ? (
            <Animated.View
              entering={CARD_IN}
              accessibilityViewIsModal
              className="w-full max-w-[360px] gap-3 rounded-2xl border border-line bg-paper p-5"
            >
              <Text className="font-ui-bold text-base text-ink">{options.title}</Text>
              {options.message ? (
                <Text className="font-ui text-sm leading-5 text-ink-soft">{options.message}</Text>
              ) : null}

              <View className={`mt-1 gap-2 ${inline ? 'flex-row' : ''}`}>
                {inline && cancelAction ? (
                  <DialogButton action={cancelAction} inline onPress={() => run(cancelAction)} />
                ) : null}

                {otherActions.map((action) => (
                  <DialogButton
                    key={action.label}
                    action={action}
                    inline={inline}
                    onPress={() => run(action)}
                  />
                ))}

                {!inline && cancelAction ? (
                  <DialogButton action={cancelAction} onPress={() => run(cancelAction)} />
                ) : null}
              </View>
            </Animated.View>
          ) : null}
        </View>
      </Modal>
    </DialogContext.Provider>
  );
}

function DialogButton({
  action,
  inline = false,
  onPress,
}: {
  action: DialogAction;
  inline?: boolean;
  onPress: () => void;
}) {
  const tone =
    action.style === 'destructive'
      ? 'bg-wash-brick border-brick/40'
      : action.style === 'cancel'
        ? 'bg-paper border-line'
        : 'bg-moss border-moss';

  const label =
    action.style === 'destructive'
      ? 'text-deep-brick'
      : action.style === 'cancel'
        ? 'text-ink'
        : 'text-paper';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      onPress={onPress}
      className={`min-h-[48px] items-center justify-center rounded-xl border px-4 ${tone} ${
        inline ? 'flex-1' : ''
      } ${press} active:opacity-80`}
    >
      <Text className={`text-center font-ui-bold text-sm ${label}`} numberOfLines={2}>
        {action.label}
      </Text>
    </Pressable>
  );
}

/**
 * Shows a dialog. Resolves once it closes — whichever action was taken, and
 * whether or not that action had a handler.
 */
export function useDialog(): (options: DialogOptions) => Promise<void> {
  const show = useContext(DialogContext);
  if (!show) throw new Error('useDialog must be used inside <DialogProvider>');
  return show;
}

/** The common case: one destructive choice, or nothing. */
export function useConfirm() {
  const show = useDialog();

  return useMemo(
    () =>
      (input: {
        title: string;
        message?: string;
        confirmLabel: string;
        cancelLabel?: string;
        destructive?: boolean;
        onConfirm: () => void | Promise<void>;
      }) =>
        show({
          title: input.title,
          message: input.message,
          actions: [
            { label: input.cancelLabel ?? 'Cancel', style: 'cancel' },
            {
              label: input.confirmLabel,
              style: input.destructive === false ? 'default' : 'destructive',
              onPress: input.onConfirm,
            },
          ],
        }),
    [show]
  );
}
