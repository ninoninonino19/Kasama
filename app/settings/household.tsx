import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { leaveHousehold, removeMember, renameHousehold, setMemberRole } from '../../src/api/household';
import { InviteCode } from '../../src/components/InviteCode';
import { Avatar } from '../../src/components/ui/Avatar';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { useConfirm, useDialog } from '../../src/components/ui/Dialog';
import { Pill } from '../../src/components/ui/Pill';
import { FormScreen, SectionTitle } from '../../src/components/ui/Screen';
import { InlineError, LoadingState } from '../../src/components/ui/States';
import { TextField } from '../../src/components/ui/TextField';
import { messageFrom } from '../../src/hooks/useAsyncData';
import { formatShortDate } from '../../src/lib/format';
import { haptics } from '../../src/lib/haptics';
import { colors } from '../../src/lib/theme';
import { useSession } from '../../src/providers/SessionProvider';
import { useSessionStore } from '../../src/store/useSessionStore';
import type { MemberWithProfile } from '../../src/types';

/**
 * Everything that belongs to the house rather than to you: the invite code,
 * the household's name, who is in it, and the way out.
 *
 * Split from account settings because the two answer different questions and
 * have different blast radii — renaming yourself affects one row on a card,
 * while removing a housemate or leaving reshapes the household for everyone.
 * Reached from the housemates row on Home, which is the thing on screen that
 * already means "the house".
 */
export default function HouseholdSettingsScreen() {
  const router = useRouter();
  const confirm = useConfirm();
  const dialog = useDialog();
  const { refreshHousehold } = useSession();

  const household = useSessionStore((state) => state.household);
  const members = useSessionStore((state) => state.members);
  const role = useSessionStore((state) => state.role);
  const userId = useSessionStore((state) => state.userId);
  const status = useSessionStore((state) => state.status);

  const [name, setName] = useState(household?.name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Leaving is irreversible without an invite code, so the button only opens
  // a caution panel; the panel's own button is what asks to confirm.
  const [leaveArmed, setLeaveArmed] = useState(false);

  // The household may still be loading when this screen mounts (cold start,
  // deep link), so seed the input once the real value lands.
  useEffect(() => {
    setName(household?.name ?? '');
  }, [household?.name]);

  const isAdmin = role === 'admin';
  const nameChanged = name.trim().length >= 2 && name.trim() !== household?.name;

  const lastAdmin =
    isAdmin &&
    members.filter((member) => member.role === 'admin').length === 1 &&
    members.length > 1;

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

  /**
   * Admin actions on a housemate. Sheet rather than inline buttons: these are
   * rare and consequential, and a delete button sitting permanently next to
   * someone's face on a shared-house screen invites exactly the mis-tap you
   * don't want.
   */
  function manageMember(member: MemberWithProfile) {
    if (!household || !isAdmin || member.user_id === userId) return;
    haptics.tap();

    const memberName = member.profile.display_name;
    const isTheirAdmin = member.role === 'admin';
    const adminCount = members.filter((entry) => entry.role === 'admin').length;
    // Never leave the household with nobody who can manage it.
    const wouldStrandHousehold = isTheirAdmin && adminCount === 1;

    void dialog({
      title: memberName,
      message: wouldStrandHousehold
        ? 'They are the only admin. Make someone else an admin before removing or demoting them.'
        : 'What would you like to do?',
      actions: [
        ...(wouldStrandHousehold
          ? []
          : [
              {
                label: isTheirAdmin ? 'Make them a member' : 'Make them an admin',
                onPress: async () => {
                  try {
                    await setMemberRole(
                      household.id,
                      member.user_id,
                      isTheirAdmin ? 'member' : 'admin'
                    );
                    await refreshHousehold();
                  } catch (caught) {
                    haptics.error();
                    setError(messageFrom(caught));
                  }
                },
              },
              {
                label: 'Remove from household',
                style: 'destructive' as const,
                onPress: () => confirmRemove(member),
              },
            ]),
        { label: 'Cancel', style: 'cancel' as const },
      ],
    });
  }

  function confirmRemove(member: MemberWithProfile) {
    if (!household) return;
    const memberName = member.profile.display_name;

    void confirm({
      title: `Remove ${memberName}?`,
      message:
        'Their bills and splits stay put — removing someone does not erase what they owe or are owed. They just lose access to the household.',
      confirmLabel: 'Remove',
      onConfirm: async () => {
        try {
          await removeMember(household.id, member.user_id);
          await refreshHousehold();
        } catch (caught) {
          haptics.error();
          setError(messageFrom(caught));
        }
      },
    });
  }

  /**
   * Step two. The caution panel has already said what leaving costs; this is
   * the deliberate second tap, in a dialogue that can't be hit by accident on
   * the way past.
   */
  function confirmLeave() {
    if (!household || !userId) return;
    haptics.tap();

    void confirm({
      title: `Leave ${household.name}?`,
      message: lastAdmin
        ? "You are the only admin. Leaving hands the household to nobody, and you'll need a new invite code to come back."
        : "You'll need an invite code to join again. Your share of past bills stays on record either way.",
      confirmLabel: 'Leave household',
      cancelLabel: 'Stay',
      onConfirm: async () => {
        try {
          await leaveHousehold(household.id, userId);
          setLeaveArmed(false);
          await refreshHousehold();
          router.replace('/onboarding');
        } catch (caught) {
          haptics.error();
          setError(messageFrom(caught));
        }
      },
    });
  }

  if (!household) {
    return (
      <FormScreen title="Household">
        <View className="flex-1 items-center justify-center p-6">
          {status === 'loading' ? (
            <LoadingState />
          ) : (
            <Text className="font-ui text-base text-ink-soft">
              You are not in a household right now.
            </Text>
          )}
        </View>
      </FormScreen>
    );
  }

  return (
    <FormScreen title="Household" subtitle={household.name}>
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-6 p-5 pb-12"
      keyboardDismissMode="on-drag"
    >
      {error ? <InlineError message={error} /> : null}

      {/* Invite code ---------------------------------------------------- */}
      <View>
        <SectionTitle>Invite code</SectionTitle>
        <Card className="items-center gap-3 py-6">
          <InviteCode
            code={household.invite_code}
            householdName={household.name}
            caption="Share this with your housemates so they can join the household."
            onError={setError}
          />
        </Card>
      </View>

      {/* Name ----------------------------------------------------------- */}
      <View>
        <SectionTitle>Name</SectionTitle>
        <Card className="gap-3">
          <TextField
            label="Household name"
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
              <Card key={member.id} onPress={manageable ? () => manageMember(member) : undefined}>
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

      {/* Leaving --------------------------------------------------------- */}
      <View className="gap-2">
        <SectionTitle>Leaving</SectionTitle>
        {/* Step one. Arming reveals what leaving actually costs, in place,
            before any dialogue appears — a confirm sheet on its own is
            something people tap through without reading. */}
        {leaveArmed ? (
          <View className="gap-3 rounded-2xl border border-brick/40 bg-wash-brick p-4">
            <View className="flex-row items-center gap-2">
              <Ionicons name="warning-outline" size={20} color={colors.deep.brick} />
              <Text className="flex-1 font-ui-bold text-sm text-deep-brick">
                Leaving {household.name}
              </Text>
            </View>

            <View className="gap-1.5">
              <CautionLine text="You lose access to its bills, chores and board." />
              <CautionLine text="Getting back in needs a new invite code from a housemate." />
              <CautionLine text="What you owe and are owed stays on record — leaving settles nothing." />
              {lastAdmin ? (
                <CautionLine
                  emphasis
                  text="You are the only admin. Nobody will be left who can manage this household."
                />
              ) : null}
            </View>

            <View className="mt-1 flex-row gap-2">
              <Button
                label="Stay"
                variant="secondary"
                size="md"
                className="flex-1"
                onPress={() => setLeaveArmed(false)}
              />
              <Button
                label="Leave household"
                variant="danger"
                size="md"
                className="flex-1"
                icon="exit-outline"
                onPress={confirmLeave}
              />
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              haptics.tap();
              setLeaveArmed(true);
            }}
            className="flex-row items-center gap-3 rounded-2xl border border-line bg-paper p-4 active:bg-page"
          >
            <Ionicons name="exit-outline" size={20} color={colors.deep.brick} />
            <Text className="flex-1 font-ui-semibold text-sm text-ink">Leave household</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.ink.faint} />
          </Pressable>
        )}
      </View>

      {/* The two settings screens are only reachable from Home, so each one
          carries the door to the other. */}
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          haptics.tap();
          router.push('/settings/account');
        }}
        className="flex-row items-center gap-3 rounded-2xl border border-line bg-paper p-4 active:bg-page"
      >
        <Ionicons name="person-circle-outline" size={20} color={colors.ink.soft} />
        <Text className="flex-1 font-ui-semibold text-sm text-ink">Your account</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.ink.faint} />
      </Pressable>
    </ScrollView>
    </FormScreen>
  );
}

function CautionLine({ text, emphasis = false }: { text: string; emphasis?: boolean }) {
  return (
    <View className="flex-row gap-2">
      <Text className="font-ui text-xs leading-5 text-deep-brick">•</Text>
      <Text
        className={`flex-1 text-xs leading-5 text-deep-brick ${
          emphasis ? 'font-ui-bold' : 'font-ui'
        }`}
      >
        {text}
      </Text>
    </View>
  );
}
