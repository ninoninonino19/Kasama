import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Screen } from '../../src/components/ui/Screen';
import { useSession } from '../../src/providers/SessionProvider';
import { useProfile } from '../../src/store/useSessionStore';

export default function OnboardingScreen() {
  const router = useRouter();
  const profile = useProfile();
  const { signOut } = useSession();

  return (
    <Screen>
      <ScrollView contentContainerClassName="grow justify-center gap-8 px-6 py-10">
        <View className="gap-2">
          <Text className="text-3xl font-bold text-ink">
            Kumusta{profile?.display_name ? `, ${profile.display_name.split(' ')[0]}` : ''}!
          </Text>
          <Text className="text-base leading-6 text-ink-soft">
            Ang Kasama ay para sa buong bahay. Gumawa ng bagong household, o sumali sa isang
            existing gamit ang invite code.
          </Text>
        </View>

        <View className="gap-4">
          <OptionCard
            icon="home-outline"
            title="Create a household"
            subtitle="Ikaw ang mag-set up — you'll get an invite code to share."
            onPress={() => router.push('/onboarding/create')}
            tone="brand"
          />
          <OptionCard
            icon="key-outline"
            title="Join with invite code"
            subtitle="May code na galing sa kasama mo? Enter it here."
            onPress={() => router.push('/onboarding/join')}
            tone="coral"
          />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => void signOut()}
          className="items-center py-2"
        >
          <Text className="text-sm font-semibold text-ink-muted">Log out</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function OptionCard({
  icon,
  title,
  subtitle,
  onPress,
  tone,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  onPress: () => void;
  tone: 'brand' | 'coral';
}) {
  const bg = tone === 'brand' ? 'bg-brand-100' : 'bg-coral-100';
  const color = tone === 'brand' ? '#218578' : '#D64827';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-4 rounded-3xl border border-sand-200 bg-white p-5 active:bg-sand-50"
    >
      <View className={`h-12 w-12 items-center justify-center rounded-2xl ${bg}`}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-bold text-ink">{title}</Text>
        <Text className="mt-0.5 text-sm leading-5 text-ink-muted">{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#C9BDAD" />
    </Pressable>
  );
}
