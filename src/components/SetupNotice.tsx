import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../lib/theme';

import { Screen } from './ui/Screen';

/**
 * Shown when EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY are missing, which otherwise
 * fails as a wall of confusing network errors.
 */
export function SetupNotice() {
  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-4 p-6">
        <View className="h-14 w-14 items-center justify-center rounded-2xl bg-brand-100">
          <Ionicons name="construct-outline" size={26} color={colors.brand[600]} />
        </View>
        <Text className="text-2xl font-bold text-ink">Almost there</Text>
        <Text className="text-base leading-6 text-ink-soft">
          Kasama needs a Supabase project before it can sign anyone in. Create a `.env` file in the
          project root (copy `.env.example`) and fill in:
        </Text>
        <View className="rounded-2xl bg-sand-900 p-4">
          <Text className="font-mono text-xs leading-5 text-sand-100">
            EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co{'\n'}
            EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci…
          </Text>
        </View>
        <Text className="text-base leading-6 text-ink-soft">
          Then run the migration in `supabase/migrations` against your project and restart the dev
          server with `npx expo start --clear`.
        </Text>
      </ScrollView>
    </Screen>
  );
}
