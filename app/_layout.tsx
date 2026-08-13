import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '../src/providers/SessionProvider';
import { colors } from '../src/lib/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.sand[50] },
              // Warm the stack chrome to match the canvas — the default header
              // is a cool system grey that reads as a different app.
              headerStyle: { backgroundColor: colors.sand[50] },
              headerTintColor: colors.brand[600],
              headerTitleStyle: { color: colors.ink.DEFAULT, fontWeight: '700' },
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
              options={{ presentation: 'modal', headerShown: true, title: 'New announcement' }}
            />
            <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
          </Stack>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
