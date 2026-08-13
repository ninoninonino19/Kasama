import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '../src/providers/SessionProvider';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#FCFAF7' },
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
