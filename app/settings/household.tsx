import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';

import { isSettledAmount, openBillCount, summariseBalance } from '../../src/api/bills';
import {
  cancelLeaveRequest,
  removeMember,
  renameHousehold,
  requestLeave,
  setMemberRole,
  voteOnLeaveRequest,
} from '../../src/api/household';
import { notifyHousehold } from '../../src/api/notify';
import { InviteCode } from '../../src/components/InviteCode';
import { leaveTally, LeaveVoteCard, MyLeaveRequestCard } from '../../src/components/LeaveRequest';
import { Avatar } from '../../src/components/ui/Avatar';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { useConfirm, useDialog } from '../../src/components/ui/Dialog';
import { Pill } from '../../src/components/ui/Pill';
import { FormScreen, SectionTitle } from '../../src/components/ui/Screen';
import { InlineError, LoadingState } from '../../src/components/ui/States';
import { TextField } from '../../src/components/ui/TextField';
import { messageFrom } from '../../src/hooks/useAsyncData';
import { useBills, useMyLeaveRequest, useOpenLeaveRequests } from '../../src/hooks/useHouseholdData';
import { formatPeso, formatShortDate } from '../../src/lib/format';
import { haptics } from '../../src/lib/haptics';
import { press } from '../../src/lib/motion';
import { colors } from '../../src/lib/theme';
import { useSession } from '../../src/providers/SessionProvider';
import { useProfile, useSessionStore } from '../../src/store/useSessionStore';
import type { LeaveRequestWithVotes, MemberWithProfile } from '../../src/types';

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
  const profile = useProfile();
  const profileFirstName = profile?.display_name.split(' ')[0] ?? 'A housemate';

  const [name, setName] = useState(household?.name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Leaving asks the house rather than just happening, so the button opens a
  // caution panel; the panel's own button is what sends the request.
  const [leaveArmed, setLeaveArmed] = useState(false);
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [votingOn, setVotingOn] = useState<string | null>(null);

  const bills = useBills();
  const openRequests = useOpenLeaveRequests();
  const myRequest = useMyLeaveRequest();

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
  const alone = members.length <= 1;

  const allBills = bills.data ?? [];
  // Everyone else's open requests. Yours is shown by `MyLeaveRequestCard`,
  // which reads differently — a tally you're waiting on rather than a decision
  // you're being asked for — and you can't vote on it anyway.
  const toAnswer = (openRequests.data ?? []).filter((request) => request.user_id !== userId);
  const mine = myRequest.data;
  const awaitingHouse = mine?.status === 'pending';
  // A pending request or a declined one both put a card on screen that already
  // carries its own way forward — the tally with a withdraw button, or the
  // reason with "ask again". The collapsed row underneath would be a second
  // door to the same panel.
  const showingMyRequest = awaitingHouse || mine?.status === 'declined';

  // What the person reading this owes, for the panel that opens before they
  // ask. Shown to them first because it is the thing their housemates are
  // about to be shown, and finding that out from a decline is worse.
  const myBalance = userId
    ? summariseBalance(allBills, userId)
    : { owed: 0, owing: 0, net: 0 };
  const iOweSomething = !isSettledAmount(myBalance.owed);

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
   * The armed panel below is the only confirmation — it already says what
   * leaving costs, so this runs straight from its button rather than opening
   * a second dialogue that repeats the same warning.
   *
   * What it sends is a request, not a departure — unless there is nobody left
   * to ask, in which case `request_household_leave` completes it on the spot
   * and this navigates straight out. Waiting for a vote that can never be cast
   * would lock the last person in the house into it.
   */
  async function handleLeave() {
    if (!household || !userId) return;
    haptics.tap();
    setLeaveBusy(true);
    try {
      const request = await requestLeave(household.id, leaveReason);
      setLeaveArmed(false);
      setLeaveReason('');

      if (request.status === 'completed') {
        await refreshHousehold();
        router.replace('/onboarding');
        return;
      }

      haptics.success();
      await myRequest.refresh({ silent: true });
      await openRequests.refresh({ silent: true });

      notifyHousehold({
        householdId: household.id,
        // The board's own category. A leave request is a household notice
        // rather than a bill or a chore, and giving it a fourth category
        // would mean a new preference column, a new switch in settings and
        // a change to the notify function — for one message a housemate
        // sends at most once.
        category: 'board',
        title: `${profileFirstName} wants to leave the household`,
        body: 'Open Kasama to accept or decline — check what is still outstanding first.',
        data: { screen: 'household' },
        only: members
          .filter((member) => member.user_id !== userId)
          .map((member) => member.user_id),
      });
    } catch (caught) {
      haptics.error();
      setError(messageFrom(caught));
    } finally {
      setLeaveBusy(false);
    }
  }

  /** Withdraws my own open request. Plans change. */
  function withdrawLeave() {
    if (!mine) return;
    haptics.tap();
    void (async () => {
      setLeaveBusy(true);
      try {
        await cancelLeaveRequest(mine.id);
        await Promise.all([
          myRequest.refresh({ silent: true }),
          openRequests.refresh({ silent: true }),
        ]);
      } catch (caught) {
        haptics.error();
        setError(messageFrom(caught));
      } finally {
        setLeaveBusy(false);
      }
    })();
  }

  /**
   * Accepting somebody's departure, with the money said out loud first.
   *
   * The vote card already shows what they owe and are owed, but a housemate
   * scrolling a settings screen taps "Accept" the way they tap anything else,
   * and an accept is the one answer that cannot be taken back — the last one
   * removes them from the household then and there. So the amount is repeated
   * in a dialogue that has to be read, and the dialogue says whether this
   * particular answer is the one that completes it.
   *
   * It asks rather than refuses. A house forgives debts, settles in cash the
   * app never sees, and blocking the accept outright would strand somebody who
   * has physically moved out — the same reasoning `vote_on_leave_request`
   * gives for not enforcing it in the database. The house decides; this makes
   * sure it decides knowingly.
   */
  function confirmAccept(request: LeaveRequestWithVotes) {
    if (!userId) return;
    haptics.tap();

    const name = request.profile?.display_name.split(' ')[0] ?? 'This housemate';
    const balance = summariseBalance(allBills, request.user_id);
    const openBills = openBillCount(allBills, request.user_id);
    const owes = !isSettledAmount(balance.owed);
    const isOwed = !isSettledAmount(balance.owing);

    // Whether mine is the answer that finishes it, so "they leave now" and
    // "they leave once the others answer" are never confused for each other.
    const { waiting } = leaveTally(request, members);
    const lastToAnswer = waiting.length === 1 && waiting[0].user_id === userId;

    const money =
      owes && isOwed
        ? `${name} still owes ${formatPeso(balance.owed)} and is owed ${formatPeso(balance.owing)}, across ${openBills} unsettled ${openBills === 1 ? 'bill' : 'bills'}.`
        : owes
          ? `${name} still owes ${formatPeso(balance.owed)} across ${openBills} unsettled ${openBills === 1 ? 'bill' : 'bills'}.`
          : isOwed
            ? `The house still owes ${name} ${formatPeso(balance.owing)}.`
            : `Nothing is outstanding between ${name} and the house.`;

    void confirm({
      title: owes ? `Let ${name} go with ${formatPeso(balance.owed)} unsettled?` : `Accept ${name}'s request?`,
      message: `${money} ${
        lastToAnswer
          ? 'Yours is the last answer needed, so accepting removes them from the household now.'
          : 'They leave once every housemate has accepted.'
      } Leaving settles nothing — what they owe stays on record either way.`,
      confirmLabel: 'Accept',
      cancelLabel: owes ? 'Not yet' : 'Cancel',
      destructive: owes,
      onConfirm: () => answerLeave(request.id, 'accept', null),
    });
  }

  /**
   * Answering someone else's request.
   *
   * An accept that turns out to be the last one removes them then and there,
   * so the member list has to be re-read as well as the requests — otherwise
   * the housemate who cast it keeps seeing a household with one more person in
   * it than it has.
   */
  function answerLeave(requestId: string, decision: 'accept' | 'decline', note: string | null) {
    if (!household) return;
    haptics.tap();

    void (async () => {
      setVotingOn(requestId);
      setError(null);
      try {
        const resolved = await voteOnLeaveRequest(requestId, decision, note);
        haptics.success();

        await Promise.all([
          openRequests.refresh({ silent: true }),
          myRequest.refresh({ silent: true }),
          refreshHousehold(),
        ]);

        // Only the person it concerns hears about it. The rest of the house
        // sees the tally move next time they open this screen, which is
        // enough — a decline is between two people.
        notifyHousehold({
          householdId: household.id,
          category: 'board',
          title:
            resolved.status === 'completed'
              ? 'You have left the household'
              : decision === 'accept'
                ? `${profileFirstName} accepted your request to leave`
                : `${profileFirstName} isn't ready for you to go`,
          body:
            resolved.status === 'completed'
              ? 'Everyone accepted. Your share of past bills stays on record.'
              : decision === 'accept'
                ? 'Waiting on the rest of the house now.'
                : (note ?? 'Open Kasama to see why.'),
          data: { screen: 'household' },
          only: [resolved.user_id],
        });
      } catch (caught) {
        haptics.error();
        setError(messageFrom(caught));
        await openRequests.refresh({ silent: true });
      } finally {
        setVotingOn(null);
      }
    })();
  }

  // No household, and the session has finished loading: either a cold start
  // that hasn't got one, or — now that leaving happens by vote — the moment
  // the last acceptance landed and this screen's subject stopped existing
  // underneath it. Index decides where they belong, the same as `/invite`
  // does; a dead-end message with only a back arrow was the old answer and it
  // led to tabs that redirect anyway.
  if (!household) {
    if (status !== 'loading') return <Redirect href="/" />;

    return (
      <FormScreen title="Household">
        <View className="flex-1 items-center justify-center p-6">
          <LoadingState />
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

      {/* Housemates on their way out ------------------------------------ */}
      {/* Above the Leaving section, and above nothing else: an unanswered
          request is the only thing on this screen that somebody else is
          waiting on, so it goes where the eye lands after the member list it
          is about to change. */}
      {toAnswer.length > 0 && userId ? (
        <View className="gap-2">
          <SectionTitle>
            {toAnswer.length === 1 ? 'A housemate is leaving' : 'Housemates are leaving'}
          </SectionTitle>
          <View className="gap-3">
            {toAnswer.map((request) => (
              <LeaveVoteCard
                key={request.id}
                request={request}
                members={members}
                bills={allBills}
                viewerId={userId}
                busy={votingOn === request.id}
                onAccept={() => confirmAccept(request)}
                onDecline={(note) => answerLeave(request.id, 'decline', note)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* Leaving --------------------------------------------------------- */}
      <View className="gap-2">
        <SectionTitle>Leaving</SectionTitle>
        {/* Three states, and the order they're checked in is the order they
            happen: a request already sent, a panel opened to send one, or the
            row that opens it. Arming reveals what leaving actually costs, in
            place, before any dialogue appears — a confirm sheet on its own is
            something people tap through without reading. */}
        {mine && (mine.status === 'pending' || mine.status === 'declined') ? (
          <MyLeaveRequestCard
            request={mine}
            members={members}
            busy={leaveBusy}
            onWithdraw={withdrawLeave}
            onAskAgain={() => {
              setLeaveArmed(true);
              haptics.tap();
            }}
          />
        ) : null}

        {leaveArmed && !awaitingHouse ? (
          <View className="gap-3 rounded-2xl border border-brick/40 bg-wash-brick p-4">
            <View className="flex-row items-center gap-2">
              <Ionicons name="warning-outline" size={20} color={colors.deep.brick} />
              <Text className="flex-1 font-ui-bold text-sm text-deep-brick">
                Leaving {household.name}
              </Text>
            </View>

            <View className="gap-1.5">
              <CautionLine
                text={
                  alone
                    ? "There's nobody else here, so this happens right away — you'll need a new invite code to come back."
                    : "Every housemate has to accept before you go, and you'll need a new invite code to come back."
                }
              />
              <CautionLine text="What you owe and are owed stays on record — leaving settles nothing." />
              {lastAdmin ? (
                <CautionLine
                  emphasis
                  text="You are the only admin. Nobody will be left who can manage this household."
                />
              ) : null}
            </View>

            {/* Your own number, before your housemates see it.
                They are shown exactly this figure when they answer, and
                finding out what you still owe from somebody's decline is a
                worse way to learn it than reading it here first. */}
            {iOweSomething ? (
              <View className="flex-row items-center gap-2 rounded-xl bg-paper px-3 py-2.5">
                <Ionicons name="wallet-outline" size={16} color={colors.deep.brick} />
                <Text className="flex-1 font-ui text-xs leading-5 text-deep-brick">
                  You still owe {formatPeso(myBalance.owed)}. Your housemates see this when they
                  answer, and can decline until it's settled.
                </Text>
              </View>
            ) : null}

            {!alone ? (
              <TextField
                label="Anything to tell them? (optional)"
                placeholder="e.g. Moving back to Cebu at the end of the month"
                value={leaveReason}
                onChangeText={setLeaveReason}
                maxLength={300}
              />
            ) : null}

            <View className="mt-1 flex-row gap-2">
              <Button
                label="Stay"
                variant="secondary"
                size="md"
                className="flex-1"
                onPress={() => {
                  setLeaveArmed(false);
                  setLeaveReason('');
                }}
              />
              <Button
                label={alone ? 'Leave household' : 'Ask the house'}
                variant="danger"
                size="md"
                className="flex-1"
                icon="exit-outline"
                loading={leaveBusy}
                onPress={handleLeave}
              />
            </View>
          </View>
        ) : showingMyRequest ? null : (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              haptics.tap();
              setLeaveArmed(true);
            }}
            className={`flex-row items-center gap-3 rounded-2xl border border-line bg-paper p-4 ${press} active:bg-page`}
          >
            <Ionicons name="exit-outline" size={20} color={colors.deep.brick} />
            <Text className="flex-1 font-ui-semibold text-sm text-ink">
              {members.length > 1 ? 'Ask to leave the household' : 'Leave household'}
            </Text>
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
        className={`flex-row items-center gap-3 rounded-2xl border border-line bg-paper p-4 ${press} active:bg-page`}
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
