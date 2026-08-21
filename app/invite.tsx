import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { InviteCode } from '../src/components/InviteCode';
import { Button } from '../src/components/ui/Button';
import { NoteCard } from '../src/components/ui/NoteCard';
import { Screen } from '../src/components/ui/Screen';
import { InlineError } from '../src/components/ui/States';
import { colors } from '../src/lib/theme';
import { useSession } from '../src/providers/SessionProvider';
import { useSessionStore } from '../src/store/useSessionStore';

/**
 * The moment straight after a household is created: here is your code, send it
 * now.
 *
 * It used to go creation → dashboard, with the code reachable only through
 * Settings → Household, behind the housemates row on Home. That put the one
 * thing the app cannot work without three taps into a screen nobody had a
 * reason to open yet — and a household of one is a dead app. This is a stop on
 * the way in rather than a screen you have to go looking for.
 *
 * It lives at the root rather than under `onboarding/`, because that layout
 * redirects to the dashboard the moment a household exists — which is exactly
 * when this screen needs to be on top.
 */
export default function InviteScreen() {
  const router = useRouter();
  const { code, name } = useLocalSearchParams<{ code?: string; name?: string }>();
  const { refreshHousehold } = useSession();
  const household = useSessionStore((state) => state.household);

  const [error, setError] = useState<string | null>(null);
  // Sharing doesn't leave this screen — the sheet comes back. Noting that it
  // happened is what lets the way out stop being a footnote.
  const [shared, setShared] = useState(false);

  // The create screen navigates here with the code in hand and lets this
  // screen pick the household up, so the store filling in can't race the
  // onboarding layout into redirecting past this.
  useEffect(() => {
    void refreshHousehold();
  }, [refreshHousehold]);

  const inviteCode = code ?? household?.invite_code;
  const householdName = name ?? household?.name;

  // Reached without a household and without params — nothing to invite anyone
  // to. Index sorts out where they actually belong.
  if (!inviteCode || !householdName) return <Redirect href="/" />;

  return (
    <Screen>
      <ScrollView contentContainerClassName="grow justify-center gap-6 px-6 py-10">
        <View className="gap-2">
          <Text className="font-hand-bold text-4xl leading-[44px] text-ink">
            {householdName} is yours.
          </Text>
          <Text className="font-ui text-base leading-6 text-ink-soft">
            Kasama splits bills and rotates chores between people — so it does nothing at all
            until your housemates are in here with you. Send them this code.
          </Text>
        </View>

        <NoteCard tape={colors.mustard} tapeAlign="center" className="gap-3 px-5 pb-5 pt-7">
          <Text className="text-center font-ui-bold text-[11px] uppercase tracking-[1.4px] text-ink-muted">
            Invite code
          </Text>
          <InviteCode
            code={inviteCode}
            householdName={householdName}
            caption="They enter it on their own phone under “Join with invite code”."
            size="lg"
            onError={setError}
            onShared={() => setShared(true)}
          />
        </NoteCard>

        {error ? <InlineError message={error} /> : null}

        <View className="gap-3">
          {/* Before they've sent anything this is the quiet way past; once
              they have, continuing is the obvious next thing and the button
              says so. */}
          <Button
            label={shared ? 'Go to my household' : "I'll invite them later"}
            variant={shared ? 'primary' : 'ghost'}
            icon={shared ? 'arrow-forward' : undefined}
            onPress={() => router.replace('/(tabs)/home')}
          />
          <View className="flex-row items-start gap-2 px-1">
            <Ionicons name="information-circle-outline" size={16} color={colors.ink.muted} />
            <Text className="flex-1 font-ui text-xs leading-5 text-ink-muted">
              The code doesn't expire, and it's always in Settings → Household if you need it
              again.
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
