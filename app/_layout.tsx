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
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '../src/providers/SessionProvider';
import { colors, fonts } from '../src/lib/theme';

// Hold the native splash until the faces are in memory. Without this the first
// frame paints in the system font and every card reflows a beat later, which on
// a handwriting-led design reads as a rendering bug rather than a font swap.
void SplashScreen.preventAutoHideAsync().catch(() => {
  // The splash was already hidden — nothing to hold.
});

export default function RootLayout() {
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
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.screenBg },
              // Warm the stack chrome to match the canvas — the default header
              // is a cool system grey that reads as a different app.
              headerStyle: { backgroundColor: colors.screenBg },
              headerTintColor: colors.moss.DEFAULT,
              headerTitleStyle: { color: colors.ink.DEFAULT, fontFamily: fonts.bodyBold },
              headerShadowVisible: false,
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="bills/new"
              options={{ presentation: 'modal', headerShown: true, title: 'New bill' }}
            />
            <Stack.Screen name="bills/[id]" options={{ headerShown: true, title: 'Bill' }} />
            <Stack.Screen
              name="chores/new"
              options={{ presentation: 'modal', headerShown: true, title: 'New chore' }}
            />
            <Stack.Screen
              name="announcements/new"
              options={{ presentation: 'modal', headerShown: true, title: 'New note' }}
            />
            <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
          </Stack>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
