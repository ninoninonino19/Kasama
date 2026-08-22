import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { isSettledAmount, openBillCount, settleUp, summariseBalance } from '../api/bills';
import { formatPeso, formatTimeAgo } from '../lib/format';
import { colors } from '../lib/theme';
import type { BillWithSplits, LeaveRequestWithVotes, MemberWithProfile } from '../types';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { TextField } from './ui/TextField';

/**
 * Where a request stands against the people still in the house.
 *
 * Counted here rather than stored on the row, and counted against the *current*
 * member list, so a housemate who joins while a request is open is one more
 * person it waits for — the same rule `vote_on_leave_request` applies before it
 * completes anything, kept in step on purpose.
 */
export function leaveTally(request: LeaveRequestWithVotes, members: MemberWithProfile[]) {
  const others = members.filter((member) => member.user_id !== request.user_id);
  const accepted = others.filter((member) =>
    request.votes.some((vote) => vote.voter_id === member.user_id && vote.decision === 'accept')
  );
  const waiting = others.filter(
    (member) => !request.votes.some((vote) => vote.voter_id === member.user_id)
  );

  return { others, accepted, waiting };
}

/**
 * What the house should know about someone's money before it answers.
 *
 * This card is the reason the whole flow exists. "Ana wants to leave" is not a
 * decision anybody can make; "Ana wants to leave and still owes ₱1,240 across
 * three bills, ₱620 of it to you" is. The numbers come from the bills already
 * loaded for the screen, so nothing extra is fetched to show them.
 */
function Standing({
  bills,
  leaverId,
  viewerId,
  leaverName,
}: {
  bills: BillWithSplits[];
  leaverId: string;
  viewerId: string;
  leaverName: string;
}) {
  const balance = useMemo(() => summariseBalance(bills, leaverId), [bills, leaverId]);
  const openBills = useMemo(() => openBillCount(bills, leaverId), [bills, leaverId]);

  // What sits between the two of them specifically, which is the number the
  // person answering actually weighs.
  const between = useMemo(
    () => settleUp(bills, viewerId).find((entry) => entry.userId === leaverId) ?? null,
    [bills, viewerId, leaverId]
  );

  const clear = isSettledAmount(balance.owed) && isSettledAmount(balance.owing);

  return (
    <View
      className={`gap-2 rounded-xl border p-3 ${
        clear ? 'border-sage bg-wash-sage' : 'border-mustard/50 bg-wash-mustard'
      }`}
    >
      <View className="flex-row items-center gap-2">
        <Ionicons
          name={clear ? 'checkmark-circle' : 'alert-circle'}
          size={16}
          color={clear ? colors.deep.sage : colors.deep.mustard}
        />
        <Text
          className={`flex-1 font-ui-bold text-xs uppercase tracking-wider ${
            clear ? 'text-deep-sage' : 'text-deep-mustard'
          }`}
        >
          {clear ? 'Nothing outstanding' : 'Before you answer'}
        </Text>
      </View>

      {clear ? (
        <Text className="font-ui text-xs leading-5 text-deep-sage">
          Every bill {leaverName} has a hand in is settled, both ways.
        </Text>
      ) : (
        <>
          <Line label={`${leaverName} still owes`} amount={balance.owed} />
          <Line label={`The house still owes ${leaverName}`} amount={balance.owing} />
          {between && !isSettledAmount(between.net) ? (
            <Line
              label={between.net > 0 ? 'Owed to you' : 'You owe them'}
              amount={Math.abs(between.net)}
              emphasis
            />
          ) : null}
          <Text className="mt-0.5 font-ui text-[11px] text-deep-mustard">
            Across {openBills} unsettled {openBills === 1 ? 'bill' : 'bills'}. Leaving settles
            nothing on its own — what they owe stays on record either way.
          </Text>
        </>
      )}
    </View>
  );
}

function Line({
  label,
  amount,
  emphasis = false,
}: {
  label: string;
  amount: number;
  emphasis?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text
        className={`flex-1 text-xs text-deep-mustard ${emphasis ? 'font-ui-bold' : 'font-ui'}`}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text className="font-mono-bold text-xs text-deep-mustard">{formatPeso(amount)}</Text>
    </View>
  );
}

/** Who has said yes so far, and who the request is still waiting on. */
function Tally({
  request,
  members,
}: {
  request: LeaveRequestWithVotes;
  members: MemberWithProfile[];
}) {
  const { others, accepted, waiting } = leaveTally(request, members);

  return (
    <View className="gap-1.5 border-t border-line pt-2.5">
      <Text className="font-ui-semibold text-xs text-ink-soft">
        {accepted.length} of {others.length}{' '}
        {others.length === 1 ? 'housemate has' : 'housemates have'} accepted
      </Text>
      {waiting.length > 0 ? (
        <View className="flex-row items-center gap-1.5">
          <Text className="font-ui text-[11px] text-ink-muted">Waiting on</Text>
          {waiting.slice(0, 4).map((member) => (
            <Avatar
              key={member.user_id}
              name={member.profile.display_name}
              userId={member.user_id}
              avatarUrl={member.profile.avatar_url}
              size={20}
              ring={false}
            />
          ))}
          <Text className="flex-1 font-ui text-[11px] text-ink-muted" numberOfLines={1}>
            {waiting.map((member) => member.profile.display_name.split(' ')[0]).join(', ')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Someone else's request, with the two buttons that answer it.
 *
 * Declining takes a second tap and a reason, deliberately. A decline ends the
 * request outright — the person leaving has to start again — so it should not
 * be something you can do with one thumb on the way past, and "no" without a
 * reason is the version of this feature that housemates end up resenting.
 */
export function LeaveVoteCard({
  request,
  members,
  bills,
  viewerId,
  busy,
  onAccept,
  onDecline,
}: {
  request: LeaveRequestWithVotes;
  members: MemberWithProfile[];
  bills: BillWithSplits[];
  viewerId: string;
  busy: boolean;
  onAccept: () => void;
  onDecline: (note: string) => void;
}) {
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState('');

  const name = request.profile?.display_name ?? 'A housemate';
  const firstName = name.split(' ')[0];
  const myVote = request.votes.find((vote) => vote.voter_id === viewerId);

  return (
    <View className="gap-3 rounded-2xl border border-line bg-paper p-4">
      <View className="flex-row items-center gap-3">
        <Avatar
          name={name}
          userId={request.user_id}
          avatarUrl={request.profile?.avatar_url}
          size={40}
        />
        <View className="flex-1">
          <Text className="font-ui-bold text-sm text-ink">{name} wants to leave</Text>
          <Text className="font-mono text-[11px] text-ink-muted">
            Asked {formatTimeAgo(request.created_at)}
          </Text>
        </View>
      </View>

      {request.reason ? (
        <Text className="font-hand text-xl leading-7 text-ink">“{request.reason}”</Text>
      ) : null}

      <Standing bills={bills} leaverId={request.user_id} viewerId={viewerId} leaverName={firstName} />

      <Tally request={request} members={members} />

      {/* An accept is changeable right up until the request resolves, which is
          what makes "not until you pay me back" a position rather than a veto.
          Saying so here is what stops the first tap feeling final. */}
      {myVote?.decision === 'accept' ? (
        <View className="flex-row items-center gap-2 rounded-xl bg-wash-sage px-3 py-2.5">
          <Ionicons name="checkmark-circle" size={16} color={colors.deep.sage} />
          <Text className="flex-1 font-ui text-xs leading-5 text-deep-sage">
            You've accepted. {firstName} goes once everyone else has too — you can still change
            your mind until then.
          </Text>
        </View>
      ) : null}

      {declining ? (
        <View className="gap-3">
          <TextField
            label="Why not yet?"
            placeholder={`e.g. ${firstName} still owes me for July's water`}
            value={note}
            onChangeText={setNote}
            maxLength={300}
            multiline
            // TextField's input is a fixed 14 rows tall, which is right for the
            // name and amount fields it was built for and wrong for a sentence.
            // The style prop wins over the class, so this is the one place that
            // needs to say so.
            style={{ height: 92, paddingTop: 14, textAlignVertical: 'top' }}
            hint="They'll see this. Declining ends the request — they can ask again once it's sorted."
          />
          <View className="flex-row gap-2">
            <Button
              label="Cancel"
              variant="secondary"
              size="md"
              className="flex-1"
              onPress={() => {
                setDeclining(false);
                setNote('');
              }}
            />
            <Button
              label="Decline"
              variant="danger"
              size="md"
              className="flex-1"
              loading={busy}
              disabled={note.trim().length === 0}
              onPress={() => onDecline(note)}
            />
          </View>
        </View>
      ) : (
        <View className="flex-row gap-2">
          <Button
            label="Not yet"
            variant="secondary"
            size="md"
            className="flex-1"
            icon="close"
            disabled={busy}
            onPress={() => setDeclining(true)}
          />
          <Button
            label={myVote?.decision === 'accept' ? 'Accepted' : 'Let them go'}
            size="md"
            className="flex-1"
            icon="checkmark"
            loading={busy}
            disabled={myVote?.decision === 'accept'}
            onPress={onAccept}
          />
        </View>
      )}
    </View>
  );
}

/**
 * Your own request, from your side.
 *
 * `pending` is the tally you're waiting on. `declined` is the one that matters:
 * it carries whoever said no and what they said, because "the house said no"
 * without the reason leaves you with nothing to act on — and the reason is
 * almost always a number you can go and settle.
 */
export function MyLeaveRequestCard({
  request,
  members,
  busy,
  onWithdraw,
  onAskAgain,
}: {
  request: LeaveRequestWithVotes;
  members: MemberWithProfile[];
  busy: boolean;
  onWithdraw: () => void;
  onAskAgain: () => void;
}) {
  if (request.status === 'pending') {
    return (
      <View className="gap-3 rounded-2xl border border-mustard/50 bg-wash-mustard p-4">
        <View className="flex-row items-center gap-2">
          <Ionicons name="hourglass-outline" size={18} color={colors.deep.mustard} />
          <Text className="flex-1 font-ui-bold text-sm text-deep-mustard">
            Waiting on your housemates
          </Text>
        </View>
        <Text className="font-ui text-xs leading-5 text-deep-mustard">
          You'll leave the household as soon as everyone has accepted. Until then nothing has
          changed — you're still in the bills and the chore rotation.
        </Text>
        <Tally request={request} members={members} />
        <Button
          label="Withdraw my request"
          variant="secondary"
          size="md"
          loading={busy}
          onPress={onWithdraw}
        />
      </View>
    );
  }

  if (request.status === 'declined') {
    const decline = request.votes.find((vote) => vote.decision === 'decline');
    const who = decline?.voter?.display_name ?? 'A housemate';

    return (
      <View className="gap-3 rounded-2xl border border-brick/40 bg-wash-brick p-4">
        <View className="flex-row items-center gap-2">
          <Ionicons name="close-circle-outline" size={18} color={colors.deep.brick} />
          <Text className="flex-1 font-ui-bold text-sm text-deep-brick">
            {who} isn't ready for you to go
          </Text>
        </View>
        {decline?.note ? (
          <Text className="font-hand text-xl leading-7 text-deep-brick">“{decline.note}”</Text>
        ) : (
          <Text className="font-ui text-xs leading-5 text-deep-brick">
            They didn't leave a reason. Worth asking them directly.
          </Text>
        )}
        <Text className="font-ui text-xs leading-5 text-deep-brick">
          Sort it out and ask again — settling what's outstanding is usually the whole of it.
        </Text>
        <Button label="Ask again" variant="secondary" size="md" loading={busy} onPress={onAskAgain} />
      </View>
    );
  }

  // `cancelled` and `completed` are both over, and a completed one means the
  // screen is about to unmount anyway — refreshing the session finds no
  // membership and routes them out.
  return null;
}
