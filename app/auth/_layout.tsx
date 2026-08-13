import { Redirect, Stack } from 'expo-router';

import { useSessionStore } from '../../src/store/useSessionStore';

export default function AuthLayout() {
  const status = useSessionStore((state) => state.status);
  const session = useSessionStore((state) => state.session);
  const household = useSessionStore((state) => state.household);

  if (status === 'ready' && session) {
    return <Redirect href={household ? '/(tabs)/home' : '/onboarding'} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
