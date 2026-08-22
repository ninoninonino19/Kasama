import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import {
  deleteAnnouncement,
  postAnnouncement,
  setAnnouncementPinned,
} from '../../src/api/announcements';
import { notifyHousehold } from '../../src/api/notify';
import { uploadReceipt } from '../../src/api/receipts';
import { MAX_NOTE_LENGTH } from '../../src/components/NoteComposer';
import { ReceiptField, ReceiptImage } from '../../src/components/Receipt';
import type { ReceiptState } from '../../src/components/Receipt';
import { Avatar } from '../../src/components/ui/Avatar';
import { useConfirm, useDialog } from '../../src/components/ui/Dialog';
import { NoteCard } from '../../src/components/ui/NoteCard';
import { Screen, ScreenHeader } from '../../src/components/ui/Screen';
import { ListSkeleton } from '../../src/components/ui/Skeleton';
import { EmptyState, ErrorState, InlineError } from '../../src/components/ui/States';
import { messageFrom } from '../../src/hooks/useAsyncData';
import { useAnnouncements } from '../../src/hooks/useHouseholdData';
import { useRefreshOnFocus } from '../../src/hooks/useRefreshOnFocus';
import { formatTimeAgo } from '../../src/lib/format';
import { haptics } from '../../src/lib/haptics';
import { pressSmall } from '../../src/lib/motion';
import { colors, TAPE_HEX, TAPE_TOKENS, tapeColorFor } from '../../src/lib/theme';
import type { TapeColor } from '../../src/lib/database.types';
import { useBoardSeen } from '../../src/store/useBoardSeen';
import { useCurrentUserId, useHousehold, useProfile, useSessionStore } from '../../src/store/useSessionStore';
import type { AnnouncementWithAuthor } from '../../src/types';

/** How many notes to pull at a time. */
const PAGE_SIZE = 30;

export default function AnnouncementsScreen() {
  const router = useRouter();
  const confirm = useConfirm();
  const dialog = useDialog();
  const household = useHousehold();
  const profile = useProfile();
  const userId = useCurrentUserId();
  const role = useSessionStore((state) => state.role);
  // The board grows a page at a time rather than fetching a household's whole
  // history on open. Growing the limit refetches, which is a little wasteful
  // but keeps pinned-first ordering correct without a cursor that would have
  // to understand it.
  const [limit, setLimit] = useState(PAGE_SIZE);
  const state = useAnnouncements(limit);
  const { data, loading, refreshing, error, refresh } = state;

  const [actionError, setActionError] = useState<string | null>(null);
  const composer = useRef<ComposerHandle>(null);

  // A note posted on another device — or edited on the full-screen editor —
  // should be here when the tab comes back into view.
  useRefreshOnFocus(refresh);

  // Marked on the way in *and* on the way out: a note that lands while you are
  // reading the board has been seen, and stamping only on focus would leave
  // the tab's dot lit for something already on screen.
  const markBoardSeen = useBoardSeen((state) => state.markSeen);
  const householdId = household?.id ?? null;
  useFocusEffect(
    useCallback(() => {
      if (!householdId) return;
      markBoardSeen(householdId);
      return () => markBoardSeen(householdId);
    }, [householdId, markBoardSeen])
  );

  const { setData } = state;

  /**
   * Posts straight from the bar at the bottom of the feed.
   *
   * The new note is spliced into the list rather than waiting for a refetch:
   * the board is paginated and pinned-first, so a full reload after every post
   * costs a round trip and a scroll jump to show something we already have.
   */
  const postNote = useCallback(
    async (content: string, tape: TapeColor, receipt: ReceiptState) => {
      if (!household || !userId) return;

      // The file goes up first, so the row can be written with somewhere to
      // point. `postAnnouncement` cleans it back up if that write fails.
      const imagePath =
        receipt.status === 'picked'
          ? await uploadReceipt(household.id, userId, receipt.receipt)
          : null;

      const note = await postAnnouncement(household.id, userId, content, tape, imagePath);
      haptics.success();

      // Newest-first, but *below* the pinned block — the feed is ordered
      // pinned-first, and dropping a fresh note above a pinned one would show
      // an ordering the next refetch immediately undoes.
      setData((current) => {
        const list = current ?? [];
        const firstUnpinned = list.findIndex((entry) => !entry.pinned);
        const at = firstUnpinned === -1 ? list.length : firstUnpinned;
        return [...list.slice(0, at), note, ...list.slice(at)];
      });

      notifyHousehold({
        householdId: household.id,
        category: 'board',
        title: `${profile?.display_name.split(' ')[0] ?? 'A housemate'} ${
          imagePath ? 'pinned a receipt' : 'pinned a note'
        }`,
        // A board post is short enough that the notification can just be
        // the note.
        body: content.trim().slice(0, 140),
        data: { screen: 'announcements' },
      });
    },
    [household, profile?.display_name, setData, userId]
  );

  const announcements = data ?? [];
  // A full page back means there is probably another one.
  const mayHaveMore = announcements.length >= limit;

  const loadMore = useCallback(() => {
    if (!mayHaveMore || loading || refreshing) return;
    setLimit((current) => current + PAGE_SIZE);
  }, [loading, mayHaveMore, refreshing]);

  /**
   * The note's own menu. Pinning is open to the whole household — on a real
   * fridge anyone can move a note to the top — while taking one down stays
   * with its author and the admins.
   */
  function openNoteMenu(item: AnnouncementWithAuthor, canDelete: boolean) {
    haptics.tap();
    const name = item.profile?.display_name ?? 'Housemate';
    const isMine = item.user_id === userId;

    void dialog({
      title: name,
      actions: [
        // Only the author. An admin can take a note down but not put different
        // words under someone else's name.
        ...(isMine
          ? [
              {
                label: 'Edit',
                onPress: () =>
                  router.push({ pathname: '/announcements/edit', params: { id: item.id } }),
              },
            ]
          : []),
        {
          label: item.pinned ? 'Unpin from the top' : 'Pin to the top',
          onPress: async () => {
            try {
              await setAnnouncementPinned(item.id, !item.pinned);
              await refresh({ silent: true });
            } catch (caught) {
              haptics.error();
              setActionError(messageFrom(caught));
            }
          },
        },
        ...(canDelete
          ? [
              {
                label: 'Take it down',
                style: 'destructive' as const,
                onPress: () => confirmDelete(item.id, item.image_path),
              },
            ]
          : []),
        { label: 'Cancel', style: 'cancel' as const },
      ],
    });
  }

  function confirmDelete(id: string, imagePath: string | null) {
    void confirm({
      title: 'Take this note down?',
      message: imagePath
        ? 'Nobody else will be able to see it, and its receipt goes with it.'
        : 'Nobody else will be able to see it.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await deleteAnnouncement(id, imagePath);
          await refresh({ silent: true });
        } catch (caught) {
          haptics.error();
          setActionError(messageFrom(caught));
        }
      },
    });
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScreenHeader title="Board" subtitle={household?.name ?? undefined} />

        {actionError ? (
          <View className="px-5 pb-2">
            <InlineError message={actionError} />
          </View>
        ) : null}

        {loading ? (
          <ListSkeleton rows={3} />
        ) : error && announcements.length === 0 ? (
          <View className="px-5">
            <ErrorState message={error} onRetry={() => void refresh()} />
          </View>
        ) : (
          <FlatList
            data={announcements}
            keyExtractor={(item) => item.id}
            contentContainerClassName="gap-4 px-5 pb-4 pt-2"
            keyboardDismissMode="on-drag"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void refresh()}
                tintColor={colors.moss.DEFAULT}
              />
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              mayHaveMore ? (
                <View className="items-center py-4">
                  <ActivityIndicator color={colors.moss.DEFAULT} />
                </View>
              ) : announcements.length > 0 ? (
                <Text className="py-4 text-center font-ui text-xs text-ink-muted">
                  That's every note on the board.
                </Text>
              ) : null
            }
            renderItem={({ item, index }) => {
              const name = item.profile?.display_name ?? 'Housemate';
              const canDelete = item.user_id === userId || role === 'admin';

              return (
                <NoteCard
                  // The author's chosen tape, falling back to a colour hashed
                  // from the id for notes written before the column existed.
                  tape={tapeColorFor(item.id, item.tape_color)}
                  rotate={index % 2 === 0 ? -0.5 : 0.5}
                  className={`pt-5 ${item.pinned ? 'border-moss-light' : ''}`}
                >
                  <View className="flex-row items-center gap-3">
                    <Avatar
                      name={name}
                      userId={item.user_id}
                      avatarUrl={item.profile?.avatar_url}
                      size={36}
                    />
                    <View className="flex-1">
                      <Text className="font-ui-bold text-sm text-ink" numberOfLines={1}>
                        {name}
                        {item.user_id === userId ? ' (you)' : ''}
                      </Text>
                      <View className="flex-row items-center gap-1.5">
                        <Text className="font-mono text-[11px] text-ink-muted">
                          {formatTimeAgo(item.created_at)}
                        </Text>
                        {/* A pinned note is out of date order, so it says why
                            rather than just appearing to be the newest. */}
                        {item.pinned ? (
                          <View className="flex-row items-center gap-0.5">
                            <Ionicons name="pin" size={11} color={colors.deep.mustard} />
                            <Text className="font-ui-bold text-[11px] uppercase tracking-wider text-deep-mustard">
                              Pinned
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Options for the note from ${name}`}
                      hitSlop={12}
                      onPress={() => openNoteMenu(item, canDelete)}
                      // 44pt tap area around a visually small control.
                      className={`h-11 w-11 items-center justify-center rounded-full ${pressSmall} active:bg-page`}
                    >
                      <Ionicons name="ellipsis-horizontal" size={18} color={colors.ink.muted} />
                    </Pressable>
                  </View>
                  {/* The whole point of the board: a note in someone's hand. */}
                  <Text className="mt-2 font-hand text-2xl leading-8 text-ink">{item.content}</Text>
                  {item.imageUrl ? (
                    <ReceiptImage url={item.imageUrl} author={name} />
                  ) : null}
                </NoteCard>
              );
            }}
            ListEmptyComponent={
              <EmptyState
                icon="reader-outline"
                title="Quiet in here"
                message="Pin the first note — payment reminders, visitors, or whose turn it is to chase the internet."
                actionLabel="Write one"
                onAction={() => composer.current?.focus()}
              />
            }
          />
        )}

        <Composer
          ref={composer}
          name={profile?.display_name ?? 'You'}
          userId={userId ?? 'me'}
          avatarUrl={profile?.avatar_url}
          onSubmit={postNote}
          onError={setActionError}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

export type ComposerHandle = { focus: () => void };

/**
 * The composer, pinned under the feed where a chat app puts it.
 *
 * It is the text field, not a button that opens one: a note is usually a line
 * and a half, and making people cross a screen boundary to write "bin day
 * moved to Thursday" is most of the reason a board goes quiet. Typing expands
 * the bar in place and reveals the tape swatches, so the fuller options are
 * there without being in the way of the common case.
 *
 * The camera sits beside the send button rather than inside the expanded row,
 * because attaching a receipt is a reason to open the composer at all — you
 * arrive holding the photo, and the words come after. It also means a receipt
 * can go up with nothing more than "kuryente for August", which is exactly the
 * post the house is meant to argue with.
 *
 * The full-screen `NoteComposer` still backs editing, where you are reworking
 * an existing note rather than dashing one off.
 */
const Composer = forwardRef<ComposerHandle, {
  name: string;
  userId: string;
  avatarUrl?: string | null;
  onSubmit: (content: string, tape: TapeColor, receipt: ReceiptState) => Promise<void>;
  onError: (message: string) => void;
}>(function Composer({ name, userId, avatarUrl, onSubmit, onError }, ref) {
  const input = useRef<TextInput>(null);
  const [content, setContent] = useState('');
  const [tape, setTape] = useState<TapeColor>('mustard');
  const [receipt, setReceipt] = useState<ReceiptState>({ status: 'none' });
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);

  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }), []);

  const trimmed = content.trim();
  const hasReceipt = receipt.status !== 'none';
  const canSend = trimmed.length > 0 && !busy;
  // Collapsed while empty and unfocused, so the feed keeps the screen. A
  // receipt waiting to go up counts as content — it has to stay visible, and
  // the tape row is how you take it back off.
  const expanded = focused || content.length > 0 || hasReceipt;
  const remaining = MAX_NOTE_LENGTH - content.length;

  async function send() {
    if (!canSend) return;
    setBusy(true);
    try {
      await onSubmit(trimmed, tape, receipt);
      setContent('');
      setTape('mustard');
      setReceipt({ status: 'none' });
      Keyboard.dismiss();
    } catch (caught) {
      haptics.error();
      onError(messageFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="border-t border-line bg-paper px-4 pb-3 pt-3">
      <View
        className={`flex-row gap-3 border border-line bg-page ${
          expanded ? 'items-end rounded-2xl p-2' : 'min-h-[48px] items-center rounded-full p-2'
        }`}
      >
        <Avatar name={name} userId={userId} avatarUrl={avatarUrl} size={32} ring={false} />

        <TextInput
          ref={input}
          className="flex-1 py-1 font-hand text-xl leading-7 text-ink"
          placeholder="What's happening at home?"
          placeholderTextColor={colors.ink.muted}
          value={content}
          onChangeText={(value) => setContent(value.slice(0, MAX_NOTE_LENGTH))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          multiline
          maxLength={MAX_NOTE_LENGTH}
          // Room to see a few lines before it starts scrolling internally.
          style={{ maxHeight: 120 }}
          textAlignVertical="top"
        />

        {/* Only while it is empty — once something is attached the thumbnail
            below is the control, and two ways to change one photo sitting
            next to each other is one too many. */}
        {hasReceipt ? null : (
          <ReceiptField value={receipt} onChange={setReceipt} onError={onError} compact />
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Post this note"
          accessibilityState={{ disabled: !canSend, busy }}
          disabled={!canSend}
          onPress={() => {
            haptics.tap();
            void send();
          }}
          className={`h-9 w-9 items-center justify-center rounded-full ${pressSmall} ${
            canSend ? 'bg-moss active:bg-bezel' : 'bg-line'
          }`}
        >
          <Ionicons
            name="arrow-up"
            size={18}
            color={canSend ? colors.paper : colors.ink.faint}
          />
        </Pressable>
      </View>

      {hasReceipt ? (
        <View className="mt-2 flex-row items-center gap-3 rounded-2xl border border-line bg-page p-2">
          <ReceiptField value={receipt} onChange={setReceipt} onError={onError} compact />
          <Text className="flex-1 font-ui text-xs text-ink-muted">
            Receipt attached. Say what it's for, then post it — housemates can check the total
            before anyone turns it into a bill.
          </Text>
        </View>
      ) : null}

      {/* Tape and the character count only earn their space once someone is
          actually writing. */}
      {expanded ? (
        <View className="mt-2 flex-row items-center gap-2 px-1">
          {TAPE_TOKENS.map((token) => {
            const selected = token === tape;
            return (
              <Pressable
                key={token}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${token} tape`}
                onPress={() => {
                  haptics.select();
                  setTape(token);
                }}
                hitSlop={8}
                className="h-8 w-8 items-center justify-center"
              >
                <View
                  className={`h-5 w-7 rounded-[3px] ${selected ? 'border-2 border-ink' : ''}`}
                  style={{
                    backgroundColor: TAPE_HEX[token],
                    transform: [{ rotate: '-4deg' }],
                  }}
                />
              </Pressable>
            );
          })}
          <Text
            className={`flex-1 text-right font-mono text-[11px] ${
              remaining < 50 ? 'text-deep-brick' : 'text-ink-muted'
            }`}
          >
            {remaining} left
          </Text>
        </View>
      ) : null}
    </View>
  );
});
