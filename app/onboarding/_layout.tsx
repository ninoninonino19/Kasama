import { Redirect, Stack } from 'expo-router';

import { useSessionStore } from '../../src/store/useSessionStore';

export default function OnboardingLayout() {
  const status = useSessionStore((state) => state.status);
  const session = useSessionStore((state) => state.session);
  const household = useSessionStore((state) => state.household);

  if (status === 'ready' && !session) return <Redirect href="/welcome" />;
  // Once they're in a household there is nothing left to onboard.
  if (status === 'ready' && household) return <Redirect href="/(tabs)/home" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
