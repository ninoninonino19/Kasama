import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import type { PushPreferences } from '../../src/api/household';
import { updateDisplayName, updatePushPreferences } from '../../src/api/household';
import { AvatarError, pickAndUploadAvatar, removeAvatar } from '../../src/api/avatars';
import { Avatar } from '../../src/components/ui/Avatar';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { useConfirm } from '../../src/components/ui/Dialog';
import { SectionTitle } from '../../src/components/ui/Screen';
import { InlineError } from '../../src/components/ui/States';
import { TextField } from '../../src/components/ui/TextField';
import { messageFrom } from '../../src/hooks/useAsyncData';
import { haptics } from '../../src/lib/haptics';
import { pushSupported, registerForPush } from '../../src/lib/push';
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
  const confirm = useConfirm();
  const { refreshHousehold, signOut } = useSession();

  const household = useSessionStore((state) => state.household);
  const profile = useSessionStore((state) => state.profile);
  const userId = useSessionStore((state) => state.userId);

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

  function confirmSignOut() {
    void confirm({
      title: 'Sign out of this device?',
      message:
        `There is no password to sign back in with, so this ends "${profile?.display_name ?? 'your'}" ` +
        'for good. Rejoining means a new invite code and a new name in the list.',
      confirmLabel: 'Sign out for good',
      onConfirm: handleSignOut,
    });
  }

  /**
   * Settings is a root stack screen with no auth guard of its own, so clearing
   * the session used to leave the user sitting right here looking at an empty
   * profile — which reads as "Log out did nothing". Send them back through the
   * entry point, which decides where a signed-out person belongs.
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
    <ScrollView
      className="flex-1 bg-canvas"
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
            convenience it is in most apps — it throws this identity away.
            Arming first, and saying plainly what it costs, keeps it off the
            list of things you can do by mis-tapping on the way past. */}
        {signOutArmed ? (
          <View className="gap-3 rounded-2xl border border-brick/40 bg-wash-brick p-4">
            <View className="flex-row items-center gap-2">
              <Ionicons name="warning-outline" size={20} color={colors.deep.brick} />
              <Text className="flex-1 font-ui-bold text-sm text-deep-brick">
                This cannot be undone
              </Text>
            </View>

            <View className="gap-1.5">
              <CautionLine text="There is no password, so there is no signing back in as yourself." />
              <CautionLine text="Rejoining needs a new invite code, and you appear as a new person." />
              <CautionLine text="What you owe and are owed stays on record under the old name." />
            </View>

            <View className="mt-1 flex-row gap-2">
              <Button
                label="Stay"
                variant="secondary"
                size="md"
                className="flex-1"
                onPress={() => setSignOutArmed(false)}
              />
              <Button
                label="Sign out"
                variant="danger"
                size="md"
                className="flex-1"
                icon="log-out-outline"
                loading={signingOut}
                onPress={confirmSignOut}
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
            className="flex-row items-center gap-3 rounded-2xl border border-line bg-paper p-4 active:bg-page"
          >
            <Ionicons name="log-out-outline" size={20} color={colors.deep.brick} />
            <Text className="flex-1 font-ui-semibold text-sm text-ink">Sign out of this device</Text>
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
          className="flex-row items-center gap-3 rounded-2xl border border-line bg-paper p-4 active:bg-page"
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
