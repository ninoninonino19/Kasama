import '../global.css';

import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  Caveat_600SemiBold,
  Caveat_700Bold,
} from '@expo-google-fonts/caveat';
import {
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
  useReducedMotion,
} from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DialogProvider } from '../src/components/ui/Dialog';
import { SessionProvider } from '../src/providers/SessionProvider';
import { colors } from '../src/lib/theme';

/**
 * Reanimated's strict mode, off — and only strict mode.
 *
 * It warns when a shared value is read or written while React is rendering,
 * which is a real bug when it's your own code doing it. None of ours does:
 * `ProgressBar` reads `fill` inside its `useAnimatedStyle` worklet, and the
 * dialog and the chore rows animate declaratively through `entering`/`exiting`.
 *
 * The source is NativeWind, which compiles every `transition-*` class into a
 * shared value and touches it during render in its interop layer. `press`,
 * `pressSmall` and `pressLarge` are on almost every tappable surface in the
 * app (see `src/lib/motion.ts`), so the warning fires constantly and names a
 * library nobody here can fix. A log that cries wolf on every screen is worse
 * than no log: the next genuine one scrolls past unread.
 *
 * `level` stays at `warn`, so Reanimated still reports everything else it
 * would have. If this ever needs revisiting — a NativeWind release that fixes
 * the interop, or a suspicion that one of ours has started doing it — delete
 * this call and the warnings come straight back.
 *
 * Must run before any animated component mounts, which is why it sits at
 * module scope in the root layout rather than inside it.
 */
configureReanimatedLogger({ level: ReanimatedLogLevel.warn, strict: false });

// Hold the native splash until the faces are in memory. Without this the first
// frame paints in the system font and every card reflows a beat later, which on
// a handwriting-led design reads as a rendering bug rather than a font swap.
void SplashScreen.preventAutoHideAsync().catch(() => {
  // The splash was already hidden — nothing to hold.
});

export default function RootLayout() {
  // The one place a screen transition is overridden. Everywhere else the
  // stack keeps the platform's own push and modal presentation, which is what
  // the rest of the phone does and what the back gesture is calibrated to.
  const reducedMotion = useReducedMotion();

  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Caveat_600SemiBold,
    Caveat_700Bold,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  // A font that fails to decode shouldn't hold the app hostage behind the
  // splash — React Native falls back to the system face on its own.
  const ready = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  const onLayout = useCallback(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) {
    // Matches the splash background, so the handover is invisible.
    return <View style={{ flex: 1, backgroundColor: colors.page }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayout}>
      <SafeAreaProvider>
        <SessionProvider>
          {/* Above the stack so a dialog overlays whichever screen raised it. */}
          <DialogProvider>
            <StatusBar style="dark" />
            <Stack
              // No native header anywhere in the app. Every screen draws its
              // own — `FormHeader` for the pushed and presented ones, and
              // `ScreenHeader` on the tabs, as it always did.
              //
              // The native one could not be made to sit below the status bar.
              // It is a platform Toolbar that pads itself from whatever window
              // it is in, and under `edgeToEdgeEnabled` on a modal that window
              // reported no status bar inset, so the title landed on top of the
              // clock. Pushing the form screens instead of presenting them did
              // not move it; nor did declaring `statusBarTranslucent`.
              // `SafeAreaView` needs to be told none of this — it insets by the
              // part of the view that actually overlaps the bar — and it is
              // what the tab screens have always used, which is why the bug
              // never reached them.
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.screenBg },
                // Reduced motion turns the slide and the modal's rise into a
                // cross-fade: the screen still changes, and it still reads as
                // a change, but nothing travels across the display.
                animation: reducedMotion ? 'fade' : 'default',
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="welcome" />
              <Stack.Screen name="onboarding" />
              {/* Outside `onboarding` on purpose: that layout redirects to the
                  dashboard as soon as a household exists, which is the exact
                  moment this screen has something to say. */}
              <Stack.Screen name="invite" options={{ gestureEnabled: false }} />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="bills/new" options={{ presentation: 'modal' }} />
              <Stack.Screen name="bills/[id]" />
              <Stack.Screen name="bills/edit" options={{ presentation: 'modal' }} />
              <Stack.Screen name="bills/ledger" />
              <Stack.Screen name="chores/new" options={{ presentation: 'modal' }} />
              <Stack.Screen name="chores/edit" options={{ presentation: 'modal' }} />
              <Stack.Screen name="announcements/edit" options={{ presentation: 'modal' }} />
              {/* Two screens rather than one: what belongs to you, and what
                  belongs to the house. Home routes to them separately. */}
              <Stack.Screen name="settings/account" />
              <Stack.Screen name="settings/household" />
            </Stack>
          </DialogProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
