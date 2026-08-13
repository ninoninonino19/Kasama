import { Redirect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { SetupNotice } from '../src/components/SetupNotice';
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
      <View className="flex-1 items-center justify-center gap-4 bg-sand-50">
        <View className="h-16 w-16 items-center justify-center rounded-3xl bg-brand-500">
          <Text className="text-2xl font-bold text-white">K</Text>
        </View>
        <ActivityIndicator color={colors.brand[500]} />
      </View>
    );
  }

  if (!session) return <Redirect href="/auth/sign-in" />;
  if (!household) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/home" />;
}
