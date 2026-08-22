import { Pressable, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { haptics } from '../../lib/haptics';
import { colors } from '../../lib/theme';

type Props = {
  children: ReactNode;
  /** Applies safe-area padding on top too. Turn off inside a stack with a header. */
  topInset?: boolean;
  className?: string;
};

export function Screen({ children, topInset = true, className = '' }: Props) {
  return (
    <SafeAreaView
      edges={topInset ? ['top', 'left', 'right'] : ['left', 'right']}
      className={`flex-1 bg-canvas ${className}`}
    >
      {children}
    </SafeAreaView>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View className="flex-row items-end justify-between px-5 pb-3 pt-2">
      <View className="flex-1 pr-3">
        <Text className="font-ui-black text-2xl text-ink">{title}</Text>
        {subtitle ? (
          <Text className="mt-0.5 font-ui text-sm text-ink-muted">{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/**
 * The header every pushed and presented screen wears — the app's own, not
 * react-navigation's.
 *
 * The native header could not be made to sit below the status bar. It is a
 * platform Toolbar that pads itself in `CustomToolbar.onApplyWindowInsets`,
 * and under `edgeToEdgeEnabled` that never produced a status bar inset here,
 * so the title drew on top of the clock — and on a phone with a centred
 * cutout, under the camera. Two goes at settling it from the JS side, pushing
 * the form screens instead of presenting them and then declaring
 * `statusBarTranslucent`, both left it exactly where it was.
 *
 * `SafeAreaView` doesn't depend on that inset dispatch reaching it at all: it
 * re-reads `rootWindowInsets` off the root view on every pre-draw
 * (`SafeAreaView.kt` implements `OnPreDrawListener`). It is also what every
 * tab screen has always used, which is why none of them ever showed this. See
 * `FormScreen` for the provider that gets the measurement pointed at the right
 * place.
 *
 * Being ours also means these screens finally match the tabs: one type scale,
 * one back affordance, one set of tokens.
 */
export function FormHeader({
  title,
  subtitle,
  right,
  onBack,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  /** Defaults to going back, which is what all of these want. */
  onBack?: () => void;
}) {
  const router = useRouter();

  return (
    <View className="flex-row items-center gap-2 px-3 pb-2 pt-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={8}
        onPress={() => {
          haptics.tap();
          if (onBack) {
            onBack();
            return;
          }
          // A screen opened from a notification can be the first one on the
          // stack, and `back()` from there goes nowhere.
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)/home');
        }}
        className="h-11 w-11 items-center justify-center rounded-full active:bg-page"
      >
        <Ionicons name="arrow-back" size={22} color={colors.ink.DEFAULT} />
      </Pressable>

      <View className="flex-1">
        <Text className="font-ui-black text-xl text-ink" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="font-ui text-xs text-ink-muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right}
    </View>
  );
}

/**
 * `Screen` with a `FormHeader` already on it — what every screen in the root
 * stack wants, so none of them has to remember the safe area.
 *
 * The nested `SafeAreaProvider` is what makes this right on both platforms.
 * A `SafeAreaView` insets by the *nearest provider's* safe area, not by its
 * own position on screen — `findNearestProvider` on iOS, `findProvider` on
 * Android — and the app's only provider is at the root. A screen pushed
 * full-screen wants exactly that. A screen presented as a sheet on iOS does
 * not: the sheet already starts below the status bar, so the root's inset
 * would open a status bar's worth of empty space above the title.
 *
 * Giving each of these screens its own provider means the inset is measured
 * where the screen actually is, so neither case has to be guessed at from the
 * platform or the presentation. Two goes at guessing are what this header cost
 * already.
 */
export function FormScreen({
  title,
  subtitle,
  right,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <SafeAreaProvider>
      <Screen>
        <FormHeader title={title} subtitle={subtitle} right={right} onBack={onBack} />
        {children}
      </Screen>
    </SafeAreaProvider>
  );
}

export function SectionTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <Text
      className={`mb-2 font-ui-bold text-[11px] uppercase tracking-[1.2px] text-ink-muted ${className}`}
    >
      {children}
    </Text>
  );
}
