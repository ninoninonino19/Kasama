import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { leaveHousehold, renameHousehold, updateDisplayName } from '../src/api/household';
import { Avatar } from '../src/components/ui/Avatar';
import { Badge } from '../src/components/ui/Chip';
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
        message: `Sali ka sa "${household.name}" sa Kasama! Invite code: ${household.invite_code}`,
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
        ? 'Ikaw lang ang admin. Kapag umalis ka, walang matitirang admin sa household.'
        : 'Mawawala sa iyo ang bills, chores at feed ng bahay na ito.',
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

  function confirmSignOut() {
    Alert.alert('Log out?', 'Kailangan mong mag-log in ulit next time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  if (!household) {
    return (
      <View className="flex-1 items-center justify-center bg-sand-50 p-6">
        {status === 'loading' ? (
          <LoadingState />
        ) : (
          <Text className="text-base text-ink-soft">Wala kang household ngayon.</Text>
        )}
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-sand-50" contentContainerClassName="gap-6 p-5 pb-12"
      keyboardDismissMode="on-drag">
      {error ? <InlineError message={error} /> : null}

      {/* Invite code ---------------------------------------------------- */}
      <View>
        <SectionTitle>Invite code</SectionTitle>
        <Card className="items-center gap-3 py-6">
          <Text className="text-4xl font-bold tracking-[8px] text-ink">
            {household.invite_code}
          </Text>
          <Text className="text-center text-sm leading-5 text-ink-muted">
            Ibigay ito sa kasama mo para makasali sila sa household.
          </Text>
          <View className="mt-1 flex-row gap-2">
            <Button
              label={copied ? 'Copied!' : 'Copy'}
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
            hint={isAdmin ? undefined : 'Admins lang ang pwedeng magpalit ng pangalan.'}
          />
          {isAdmin && nameChanged ? (
            <Button label="Save name" size="md" onPress={handleRename} loading={savingName} />
          ) : null}
          <Text className="text-xs text-ink-muted">
            Created {formatShortDate(household.created_at)}
          </Text>
        </Card>
      </View>

      {/* Members -------------------------------------------------------- */}
      <View>
        <SectionTitle>Housemates ({members.length})</SectionTitle>
        <View className="gap-2">
          {members.map((member) => (
            <Card key={member.id}>
              <View className="flex-row items-center gap-3">
                <Avatar
                  name={member.profile.display_name}
                  userId={member.user_id}
                  avatarUrl={member.profile.avatar_url}
                />
                <View className="flex-1">
                  <Text className="text-sm font-bold text-ink">
                    {member.profile.display_name}
                    {member.user_id === userId ? ' (you)' : ''}
                  </Text>
                  <Text className="text-xs text-ink-muted">
                    Joined {formatShortDate(member.joined_at)}
                  </Text>
                </View>
                {member.role === 'admin' ? <Badge label="Admin" tone="success" /> : null}
              </View>
            </Card>
          ))}
        </View>
      </View>

      {/* Your profile --------------------------------------------------- */}
      <View>
        <SectionTitle>Your profile</SectionTitle>
        <Card className="gap-3">
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

      {/* Danger zone ---------------------------------------------------- */}
      <View className="gap-2">
        <SectionTitle>Account</SectionTitle>
        <Pressable
          accessibilityRole="button"
          onPress={confirmLeave}
          className="flex-row items-center gap-3 rounded-2xl border border-sand-200 bg-white p-4 active:bg-sand-100"
        >
          <Ionicons name="exit-outline" size={20} color={colors.coral[600]} />
          <Text className="flex-1 text-sm font-semibold text-ink">Leave household</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.ink.faint} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={confirmSignOut}
          className="flex-row items-center gap-3 rounded-2xl border border-sand-200 bg-white p-4 active:bg-sand-100"
        >
          <Ionicons name="log-out-outline" size={20} color={colors.ink.soft} />
          <Text className="flex-1 text-sm font-semibold text-ink">Log out</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.ink.faint} />
        </Pressable>
      </View>

      <Text className="text-center text-xs text-ink-muted">Kasama v1.0.0</Text>
    </ScrollView>
  );
}
