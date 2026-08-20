import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, Switch, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import type { PushPreferences } from '../src/api/household';
import {
  leaveHousehold,
  removeMember,
  renameHousehold,
  setMemberRole,
  updateDisplayName,
  updatePushPreferences,
} from '../src/api/household';
import { AvatarError, pickAndUploadAvatar, removeAvatar } from '../src/api/avatars';
import { pushSupported, registerForPush } from '../src/lib/push';
import { Avatar } from '../src/components/ui/Avatar';
import { Pill } from '../src/components/ui/Pill';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { SectionTitle } from '../src/components/ui/Screen';
import { InlineError, LoadingState } from '../src/components/ui/States';
import { TextField } from '../src/components/ui/TextField';
import { messageFrom } from '../src/hooks/useAsyncData';
import { haptics } from '../src/lib/haptics';
import { formatShortDate } from '../src/lib/format';
import { colors } from '../src/lib/theme';
import { useSession } from '../src/providers/SessionProvider';
import type { MemberWithProfile } from '../src/types';
import { useSessionStore } from '../src/store/useSessionStore';

export default function SettingsScreen() {
  const router = useRouter();
  const { refreshHousehold, signOut } = useSession();

  const household = useSessionStore((state) => state.household);
  const members = useSessionStore((state) => state.members);
  const profile = useSessionStore((state) => state.profile);
  const role = useSessionStore((state) => state.role);
  const userId = useSessionStore((state) => state.userId);
  const status = useSessionStore((state) => state.status);

  const [name, setName] = useState(household?.name ?? '');
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The household/profile may still be loading when this screen mounts (cold
  // start, deep link), so seed the inputs once the real values land.
  useEffect(() => {
    setName(household?.name ?? '');
  }, [household?.name]);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? '');
  }, [profile?.display_name]);

  const isAdmin = role === 'admin';
  const nameChanged = name.trim().length >= 2 && name.trim() !== household?.name;
  const displayNameChanged =
    displayName.trim().length >= 2 && displayName.trim() !== profile?.display_name;

  async function handleRename() {
    if (!household || !nameChanged) return;
    setSavingName(true);
    setError(null);
    try {
      await renameHousehold(household.id, name);
      await refreshHousehold();
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setSavingName(false);
    }
  }

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

  async function copyCode() {
    if (!household) return;
    await Clipboard.setStringAsync(household.invite_code);
    haptics.success();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareCode() {
    if (!household) return;
    try {
      await Share.share({
        message: `Join "${household.name}" on Kasama. Invite code: ${household.invite_code}`,
      });
    } catch (caught) {
      setError(messageFrom(caught));
    }
  }

  function confirmLeave() {
    if (!household || !userId) return;

    const lastAdmin =
      isAdmin && members.filter((member) => member.role === 'admin').length === 1 && members.length > 1;

    Alert.alert(
      'Leave this household?',
      lastAdmin
        ? "You're the only admin. If you leave, the household is left without one."
        : "You'll lose access to this household's bills, chores and board.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveHousehold(household.id, userId);
              await refreshHousehold();
              router.replace('/onboarding');
            } catch (caught) {
              setError(messageFrom(caught));
            }
          },
        },
      ]
    );
  }

  /**
   * Admin actions on a housemate. Sheet rather than inline buttons: these are
   * rare and consequential, and a delete button sitting permanently next to
   * someone's face on a shared-house screen invites exactly the mis-tap you
   * don't want.
   */
  function manageMember(member: MemberWithProfile) {
    if (!household || !isAdmin || member.user_id === userId) return;
    haptics.tap();

    const name = member.profile.display_name;
    const isTheirAdmin = member.role === 'admin';
    const adminCount = members.filter((entry) => entry.role === 'admin').length;
    // Never leave the household with nobody who can manage it.
    const wouldStrandHousehold = isTheirAdmin && adminCount === 1;

    Alert.alert(name, wouldStrandHousehold
      ? 'They are the only admin. Make someone else an admin before removing or demoting them.'
      : 'What would you like to do?', [
      { text: 'Cancel', style: 'cancel' },
      ...(wouldStrandHousehold
        ? []
        : [
            {
              text: isTheirAdmin ? 'Make them a member' : 'Make them an admin',
              onPress: async () => {
                try {
                  await setMemberRole(household.id, member.user_id, isTheirAdmin ? 'member' : 'admin');
                  await refreshHousehold();
                } catch (caught) {
                  haptics.error();
                  setError(messageFrom(caught));
                }
              },
            },
            {
              text: 'Remove from household',
              style: 'destructive' as const,
              onPress: () => confirmRemove(member),
            },
          ]),
    ]);
  }

  function confirmRemove(member: MemberWithProfile) {
    if (!household) return;
    const name = member.profile.display_name;

    Alert.alert(
      `Remove ${name}?`,
      'Their bills and splits stay put — removing someone does not erase what they owe or are owed. They just lose access to the household.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMember(household.id, member.user_id);
              await refreshHousehold();
            } catch (caught) {
              haptics.error();
              setError(messageFrom(caught));
            }
          },
        },
      ]
    );
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
    Alert.alert('Log out?', "You'll need to log in again next time.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  if (!household) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas p-6">
        {status === 'loading' ? (
          <LoadingState />
        ) : (
          <Text className="font-ui text-base text-ink-soft">You are not in a household right now.</Text>
        )}
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-canvas" contentContainerClassName="gap-6 p-5 pb-12"
      keyboardDismissMode="on-drag">
      {error ? <InlineError message={error} /> : null}

      {/* Invite code ---------------------------------------------------- */}
      <View>
        <SectionTitle>Invite code</SectionTitle>
        <Card className="items-center gap-3 py-6">
          <Text className="font-mono-bold text-4xl tracking-[8px] text-ink">
            {household.invite_code}
          </Text>
          <Text className="text-center font-ui text-sm leading-5 text-ink-muted">
            Share this with your housemates so they can join the household.
          </Text>
          <View className="mt-1 flex-row gap-2">
            <Button
              label={copied ? 'Copied' : 'Copy'}
              variant="secondary"
              size="md"
              icon={copied ? 'checkmark' : 'copy-outline'}
              onPress={copyCode}
            />
            <Button label="Share" size="md" icon="share-outline" onPress={shareCode} />
          </View>
        </Card>
      </View>

      {/* Household ------------------------------------------------------ */}
      <View>
        <SectionTitle>Household</SectionTitle>
        <Card className="gap-3">
          <TextField
            label="Name"
            value={name}
            onChangeText={setName}
            editable={isAdmin}
            maxLength={60}
            hint={isAdmin ? undefined : 'Only admins can change the household name.'}
          />
          {isAdmin && nameChanged ? (
            <Button label="Save name" size="md" onPress={handleRename} loading={savingName} />
          ) : null}
          <Text className="font-ui text-xs text-ink-muted">
            Created {formatShortDate(household.created_at)}
          </Text>
        </Card>
      </View>

      {/* Members -------------------------------------------------------- */}
      <View>
        <SectionTitle>Housemates ({members.length})</SectionTitle>
        {isAdmin && members.length > 1 ? (
          <Text className="mb-2 -mt-1 font-ui text-xs text-ink-muted">
            Tap a housemate to make them an admin or remove them.
          </Text>
        ) : null}
        <View className="gap-2">
          {members.map((member) => {
            const manageable = isAdmin && member.user_id !== userId;

            return (
              <Card
                key={member.id}
                onPress={manageable ? () => manageMember(member) : undefined}
              >
                <View className="flex-row items-center gap-3">
                  <Avatar
                    name={member.profile.display_name}
                    userId={member.user_id}
                    avatarUrl={member.profile.avatar_url}
                  />
                  <View className="flex-1">
                    <Text className="font-ui-bold text-sm text-ink">
                      {member.profile.display_name}
                      {member.user_id === userId ? ' (you)' : ''}
                    </Text>
                    <Text className="font-ui text-xs text-ink-muted">
                      Joined {formatShortDate(member.joined_at)}
                    </Text>
                  </View>
                  {member.role === 'admin' ? <Pill label="Admin" tone="ok" /> : null}
                  {manageable ? (
                    <Ionicons name="ellipsis-horizontal" size={18} color={colors.ink.muted} />
                  ) : null}
                </View>
              </Card>
            );
          })}
        </View>
      </View>

      {/* Your profile --------------------------------------------------- */}
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

      {/* Danger zone ---------------------------------------------------- */}
      <View className="gap-2">
        <SectionTitle>Account</SectionTitle>
        <Pressable
          accessibilityRole="button"
          onPress={confirmLeave}
          className="flex-row items-center gap-3 rounded-2xl border border-line bg-paper p-4 active:bg-page"
        >
          <Ionicons name="exit-outline" size={20} color={colors.deep.brick} />
          <Text className="flex-1 font-ui-semibold text-sm text-ink">Leave household</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.ink.faint} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={confirmSignOut}
          className="flex-row items-center gap-3 rounded-2xl border border-line bg-paper p-4 active:bg-page"
        >
          <Ionicons name="log-out-outline" size={20} color={colors.ink.soft} />
          <Text className="flex-1 font-ui-semibold text-sm text-ink">Log out</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.ink.faint} />
        </Pressable>
      </View>

      <Text className="text-center font-ui text-xs text-ink-muted">Kasama v1.0.0</Text>
    </ScrollView>
  );
}
