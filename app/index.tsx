import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { SetupNotice } from '../src/components/SetupNotice';
import { LogoMark } from '../src/components/ui/Logo';
import { isSupabaseConfigured } from '../src/lib/supabase';
import { colors } from '../src/lib/theme';
import { useSessionStore } from '../src/store/useSessionStore';

/**
 * Entry point. Sends the user to the right place once the stored session (and,
 * if signed in, their household) has been resolved.
 */
export default function Index() {
  const status = useSessionStore((state) => state.status);
  const session = useSessionStore((state) => state.session);
  const household = useSessionStore((state) => state.household);

  if (!isSupabaseConfigured) return <SetupNotice />;

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-canvas">
        {/* The same mark the splash screen just showed, so the handover from
            the native splash to this screen is one object staying put rather
            than two pictures swapping. */}
        <LogoMark size={64} />
        <ActivityIndicator color={colors.moss.DEFAULT} />
      </View>
    );
  }

  if (!session) return <Redirect href="/welcome" />;
  if (!household) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/home" />;
}
