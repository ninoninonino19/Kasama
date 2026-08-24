import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import type { PushPreferences } from '../../src/api/household';
import { updateDisplayName, updatePushPreferences } from '../../src/api/household';
import { AvatarError, pickAndUploadAvatar, removeAvatar } from '../../src/api/avatars';
import { isSettledAmount, summariseBalance } from '../../src/api/bills';
import { Avatar } from '../../src/components/ui/Avatar';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { FormScreen, SectionTitle } from '../../src/components/ui/Screen';
import { InlineError } from '../../src/components/ui/States';
import { TextField } from '../../src/components/ui/TextField';
import { messageFrom } from '../../src/hooks/useAsyncData';
import { useBills } from '../../src/hooks/useHouseholdData';
import { formatPeso } from '../../src/lib/format';
import { haptics } from '../../src/lib/haptics';
import { pushSupported, registerForPush } from '../../src/lib/push';
import { press } from '../../src/lib/motion';
import { colors } from '../../src/lib/theme';
import { useSession } from '../../src/providers/SessionProvider';
import { useSessionStore } from '../../src/store/useSessionStore';

/**
 * Everything that is yours rather than the house's: your name and face, which
 * notifications you want, and the way out of the app.
 *
 * Deliberately usable without a household. Nothing here depends on being in
 * one, and someone who has just left theirs still needs to reach their own
 * profile and the log-out button.
 */
export default function AccountSettingsScreen() {
  const router = useRouter();
  const { refreshHousehold, signOut } = useSession();

  const household = useSessionStore((state) => state.household);
  const profile = useSessionStore((state) => state.profile);
  const userId = useSessionStore((state) => state.userId);

  // Your own number, before you sign out — the same figure household
  // settings shows before a leave request goes out, so what you owe is never
  // a surprise you find out about after the fact.
  const bills = useBills();
  const myBalance = userId
    ? summariseBalance(bills.data ?? [], userId)
    : { owed: 0, owing: 0, net: 0 };
  const iOweSomething = !isSettledAmount(myBalance.owed);

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  // Signing out is unrecoverable without a password, so the button only opens
  // a caution panel; the panel's own button is what asks to confirm.
  const [signOutArmed, setSignOutArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The profile may still be loading when this screen mounts (cold start,
  // deep link), so seed the input once the real value lands.
  useEffect(() => {
    setDisplayName(profile?.display_name ?? '');
  }, [profile?.display_name]);

  const displayNameChanged =
    displayName.trim().length >= 2 && displayName.trim() !== profile?.display_name;

  async function handleSaveProfile() {
    if (!userId || !displayNameChanged) return;
    setSavingProfile(true);
    setError(null);
    try {
      await updateDisplayName(userId, displayName);
      await refreshHousehold();
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePhoto() {
    if (!userId) return;
    haptics.tap();
    setPhotoBusy(true);
    setError(null);
    try {
      const url = await pickAndUploadAvatar(userId);
      // `null` means the picker was dismissed, which is not a failure.
      if (url) {
        haptics.success();
        await refreshHousehold();
      }
    } catch (caught) {
      haptics.error();
      setError(caught instanceof AvatarError ? caught.message : messageFrom(caught));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function clearPhoto() {
    if (!userId) return;
    setPhotoBusy(true);
    setError(null);
    try {
      await removeAvatar(userId);
      await refreshHousehold();
    } catch (caught) {
      haptics.error();
      setError(messageFrom(caught));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function togglePush(key: keyof PushPreferences, value: boolean) {
    if (!userId || !profile) return;
    haptics.select();
    setError(null);

    // Turning anything on is pointless until this device has a token, so the
    // first "on" is also where permission gets asked for.
    if (value && pushSupported) {
      try {
        const result = await registerForPush();
        if (result.status === 'denied') {
          setError('Notifications are turned off for Kasama in your phone settings.');
          return;
        }
        if (result.status === 'unsupported') {
          setError(result.reason);
          return;
        }
      } catch (caught) {
        setError(messageFrom(caught));
        return;
      }
    }

    try {
      await updatePushPreferences(userId, { [key]: value });
      await refreshHousehold();
    } catch (caught) {
      haptics.error();
      setError(messageFrom(caught));
    }
  }

  /**
   * Settings is a root stack screen with no auth guard of its own, so clearing
   * the session used to leave the user sitting right here looking at an empty
   * profile — which reads as "Log out did nothing". Send them back through the
   * entry point, which decides where a signed-out person belongs.
   *
   * The armed panel below is the only confirmation — it already states what
   * signing out costs, so a second "are you sure" dialog on top of it would
   * only repeat itself.
   */
  async function handleSignOut() {
    setSigningOut(true);
    setError(null);
    try {
      await signOut();
      router.replace('/');
    } catch (caught) {
      haptics.error();
      setError(messageFrom(caught));
      setSigningOut(false);
    }
  }

  return (
    <FormScreen title="Your account">
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-6 p-5 pb-12"
      keyboardDismissMode="on-drag"
    >
      {error ? <InlineError message={error} /> : null}

      {/* Profile --------------------------------------------------------- */}
      <View>
        <SectionTitle>Your profile</SectionTitle>
        <Card className="gap-3">
          <View className="flex-row items-center gap-4">
            <Avatar
              name={profile?.display_name ?? 'You'}
              userId={userId ?? 'me'}
              avatarUrl={profile?.avatar_url}
              size={64}
            />
            <View className="flex-1 gap-2">
              <Button
                label={profile?.avatar_url ? 'Change photo' : 'Add a photo'}
                variant="secondary"
                size="md"
                icon="camera-outline"
                loading={photoBusy}
                onPress={changePhoto}
              />
              {profile?.avatar_url ? (
                <Button
                  label="Remove photo"
                  variant="ghost"
                  size="md"
                  onPress={clearPhoto}
                  disabled={photoBusy}
                />
              ) : (
                <Text className="font-ui text-xs leading-4 text-ink-muted">
                  Without one, your initials are shown instead.
                </Text>
              )}
            </View>
          </View>

          <TextField label="Display name" value={displayName} onChangeText={setDisplayName} />
          {displayNameChanged ? (
            <Button
              label="Save profile"
              size="md"
              onPress={handleSaveProfile}
              loading={savingProfile}
            />
          ) : null}
        </Card>
      </View>

      {/* Notifications --------------------------------------------------- */}
      <View>
        <SectionTitle>Notifications</SectionTitle>
        <Card className="gap-1">
          {(
            [
              { key: 'push_bills', label: 'Bills', hint: 'A new bill you have a share in.' },
              { key: 'push_chores', label: 'Chores', hint: "When it's your turn in the rota." },
              { key: 'push_board', label: 'Board notes', hint: 'Every new note on the board.' },
            ] as { key: keyof PushPreferences; label: string; hint: string }[]
          ).map((row) => (
            <View key={row.key} className="min-h-[56px] flex-row items-center gap-3 py-1">
              <View className="flex-1">
                <Text className="font-ui-semibold text-sm text-ink">{row.label}</Text>
                <Text className="mt-0.5 font-ui text-xs text-ink-muted">{row.hint}</Text>
              </View>
              <Switch
                value={Boolean(profile?.[row.key])}
                onValueChange={(next) => void togglePush(row.key, next)}
                disabled={!pushSupported}
                trackColor={{ true: colors.moss.light, false: colors.line }}
                thumbColor={colors.paper}
              />
            </View>
          ))}
          {!pushSupported ? (
            <Text className="mt-1 font-ui text-xs leading-5 text-ink-muted">
              Expo Go stopped delivering push notifications in SDK 53. A development build is
              needed for these to work — see the README.
            </Text>
          ) : null}
        </Card>
      </View>

      {/* Session --------------------------------------------------------- */}
      <View className="gap-2">
        <SectionTitle>Session</SectionTitle>
        {/* Kasama has no password, so signing out is not the reversible
            convenience it is in most apps — it throws this identity away, and
            with it the membership: there is nobody left for a leave request to
            resolve to, so moving out happens here rather than being asked
            about. Arming first, and saying plainly what it costs, keeps it off
            the list of things you can do by mis-tapping on the way past. */}
        {signOutArmed ? (
          <View className="gap-3 rounded-2xl border border-brick/40 bg-wash-brick p-4">
            <View className="flex-row items-center gap-2">
              <Ionicons name="warning-outline" size={20} color={colors.deep.brick} />
              <Text className="flex-1 font-ui-bold text-sm text-deep-brick">
                This cannot be undone
              </Text>
            </View>

            <View className="gap-1.5">
              <CautionLine
                text={`There's no password, so this ends "${profile?.display_name ?? 'your name'}" for good — rejoining needs a new invite code and a new person in the list.`}
              />
              {household ? (
                <CautionLine text="What you still owe splits equally among your housemates, and your open chores go to them too." />
              ) : null}
            </View>

            {/* Same callout household settings shows before a leave request —
                the exact figure, not just the fact that it splits. */}
            {household && iOweSomething ? (
              <View className="flex-row items-center gap-2 rounded-xl bg-paper px-3 py-2.5">
                <Ionicons name="wallet-outline" size={16} color={colors.deep.brick} />
                <Text className="flex-1 font-ui text-xs leading-5 text-deep-brick">
                  You still owe {formatPeso(myBalance.owed)}. It splits equally among your
                  housemates the moment you sign out.
                </Text>
              </View>
            ) : null}

            <View className="mt-1 flex-row gap-2">
              <Button
                label="Stay"
                variant="secondary"
                size="md"
                className="flex-1"
                onPress={() => setSignOutArmed(false)}
              />
              <Button
                label="Sign out for good"
                variant="danger"
                size="md"
                className="flex-1"
                icon="log-out-outline"
                loading={signingOut}
                onPress={handleSignOut}
              />
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              haptics.tap();
              setSignOutArmed(true);
            }}
            className={`flex-row items-center gap-3 rounded-2xl border border-line bg-paper p-4 ${press} active:bg-page`}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.deep.brick} />
            <Text className="flex-1 font-ui-semibold text-sm text-ink">
              {household ? 'Sign out and leave the household' : 'Sign out of this device'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.ink.faint} />
          </Pressable>
        )}
      </View>

      {/* The two settings screens are only reachable from Home, so each one
          carries the door to the other. */}
      {household ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptics.tap();
            router.push('/settings/household');
          }}
          className={`flex-row items-center gap-3 rounded-2xl border border-line bg-paper p-4 ${press} active:bg-page`}
        >
          <Ionicons name="home-outline" size={20} color={colors.ink.soft} />
          <View className="flex-1">
            <Text className="font-ui-semibold text-sm text-ink">Household settings</Text>
            <Text className="mt-0.5 font-ui text-xs text-ink-muted" numberOfLines={1}>
              {household.name}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.ink.faint} />
        </Pressable>
      ) : null}

      <Text className="text-center font-ui text-xs text-ink-muted">Kasama v1.0.0</Text>
    </ScrollView>
    </FormScreen>
  );
}

function CautionLine({ text }: { text: string }) {
  return (
    <View className="flex-row gap-2">
      <Text className="font-ui text-xs leading-5 text-deep-brick">•</Text>
      <Text className="flex-1 font-ui text-xs leading-5 text-deep-brick">{text}</Text>
    </View>
  );
}
