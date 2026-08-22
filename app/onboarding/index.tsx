import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Screen } from '../../src/components/ui/Screen';
import { press } from '../../src/lib/motion';
import { colors } from '../../src/lib/theme';
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
          <Text className="font-ui-black text-3xl text-ink">
            Hello{profile?.display_name ? `, ${profile.display_name.split(' ')[0]}` : ''}
          </Text>
          <Text className="font-ui text-base leading-6 text-ink-soft">
            Kasama is built around a household. Start a new one, or join an existing household
            with its invite code.
          </Text>
        </View>

        <View className="gap-4">
          <OptionCard
            icon="home-outline"
            title="Create a household"
            subtitle="You set it up, and get an invite code to share."
            onPress={() => router.push('/onboarding/create')}
            tone="moss"
          />
          <OptionCard
            icon="key-outline"
            title="Join with invite code"
            subtitle="Got a code from a housemate? Enter it here."
            onPress={() => router.push('/onboarding/join')}
            tone="slate"
          />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => void signOut()}
          className="items-center py-2"
        >
          {/* Nothing is lost here: there is no household behind this name
              yet, so starting over is just picking a different one. */}
          <Text className="font-ui-semibold text-sm text-ink-muted">Use a different name</Text>
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
  tone: 'moss' | 'slate';
}) {
  const bg = tone === 'moss' ? 'bg-wash-sage' : 'bg-wash-slate';
  const color = tone === 'moss' ? colors.moss.DEFAULT : colors.slate;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`flex-row items-center gap-4 rounded-3xl border border-line bg-paper p-5 ${press} active:bg-page`}
    >
      <View className={`h-12 w-12 items-center justify-center rounded-2xl ${bg}`}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View className="flex-1">
        <Text className="font-ui-bold text-base text-ink">{title}</Text>
        <Text className="mt-0.5 font-ui text-sm leading-5 text-ink-muted">{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.ink.faint} />
    </Pressable>
  );
}
