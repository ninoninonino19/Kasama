import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { BILL_CATEGORIES, BILL_RECURRENCES, categoryMeta } from '../lib/categories';
import type { BillCategory, BillRecurrence } from '../lib/database.types';
import { formatPeso, nextWeekday, splitEvenly, weekdayIndex } from '../lib/format';
import { haptics } from '../lib/haptics';
import { colors, textCap } from '../lib/theme';
import { useMembers, useSessionStore } from '../store/useSessionStore';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { DateField } from './ui/Calendar';
import { NoteCard } from './ui/NoteCard';
import { SectionTitle } from './ui/Screen';
import { InlineError } from './ui/States';
import { TextField } from './ui/TextField';
import { WeekdayPicker } from './ui/WeekdayPicker';

export type BillFormResult = {
  title: string;
  amount: number;
  category: BillCategory;
  dueDate: Date | null;
  recurrence: BillRecurrence;
  splits: { userId: string; amount: number }[];
};

export type BillFormInitial = {
  title: string;
  amount: number;
  category: BillCategory;
  dueDate: Date | null;
  recurrence: BillRecurrence;
  participants: string[];
  /** Per-person amounts, when they aren't an even split. */
  customAmounts?: Record<string, number>;
};

/**
 * The add / edit bill form.
 *
 * `splitsLocked` is the interesting part: once a housemate has actually paid
 * their share, the amount and the split stop being editable. Changing them
 * would rewrite what someone has already handed over money for, and there is
 * no honest way to reconcile that silently. The rest of the bill — its name,
 * category, due date, whether it repeats — stays editable, which covers the
 * typo that sent anyone here in the first place.
 */
export function BillForm({
  mode,
  initial,
  splitsLocked = false,
  submitLabel,
  onSubmit,
  footer,
}: {
  mode: 'create' | 'edit';
  initial?: BillFormInitial;
  splitsLocked?: boolean;
  submitLabel: string;
  onSubmit: (result: BillFormResult) => Promise<void>;
  footer?: ReactNode;
}) {
  const members = useMembers();
  const userId = useSessionStore((state) => state.userId);

  const [titleText, setTitleText] = useState(initial?.title ?? '');
  const [amountText, setAmountText] = useState(
    initial ? initial.amount.toFixed(2) : ''
  );
  const [category, setCategory] = useState<BillCategory>(initial?.category ?? 'utilities');
  const [recurrence, setRecurrence] = useState<BillRecurrence>(initial?.recurrence ?? 'monthly');
  const [dueDate, setDueDate] = useState<Date | null>(initial?.dueDate ?? null);
  /**
   * Whether this bill carries a name of its own rather than taking the
   * category's.
   *
   * Picking a category is enough for most bills, so the name field only
   * appears for "Other". The exception is a bill that already has a
   * hand-written title — editing its due date must not quietly rename
   * "August electricity" to "Utilities".
   */
  const [hasOwnTitle, setHasOwnTitle] = useState(
    Boolean(initial && initial.title.trim() !== categoryMeta(initial.category).label)
  );
  // `null` means "nobody has touched this yet", so the default stays in sync
  // with the member list even if it loads after this screen mounts.
  const [chosenParticipants, setChosenParticipants] = useState<string[] | null>(
    initial?.participants ?? null
  );
  const [customMode, setCustomMode] = useState(Boolean(initial?.customAmounts));
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(() => {
    if (!initial?.customAmounts) return {};
    return Object.fromEntries(
      Object.entries(initial.customAmounts).map(([id, value]) => [id, value.toFixed(2)])
    );
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const amount = Number.parseFloat(amountText.replace(/,/g, '')) || 0;

  // "Other" says nothing about what the bill is, so it always asks.
  const needsOwnTitle = category === 'other' || hasOwnTitle;
  const title = needsOwnTitle ? titleText.trim() : categoryMeta(category).label;

  const participants = useMemo(
    () => chosenParticipants ?? members.map((member) => member.user_id),
    [chosenParticipants, members]
  );

  const evenShares = useMemo(
    () => splitEvenly(amount, participants.length),
    [amount, participants.length]
  );

  const shares = useMemo(() => {
    const map = new Map<string, number>();
    participants.forEach((participantId, index) => {
      const value = customMode
        ? Number.parseFloat((customAmounts[participantId] ?? '').replace(/,/g, '')) || 0
        : (evenShares[index] ?? 0);
      map.set(participantId, value);
    });
    return map;
  }, [participants, customMode, customAmounts, evenShares]);

  const shareTotal = useMemo(
    () => Array.from(shares.values()).reduce((total, value) => total + value, 0),
    [shares]
  );

  const splitsBalance = Math.abs(shareTotal - amount) < 0.01;
  const canSubmit =
    title.length > 0 &&
    amount > 0 &&
    (splitsLocked || (participants.length > 0 && splitsBalance)) &&
    !submitting;

  function toggleParticipant(memberId: string) {
    setChosenParticipants((current) => {
      const base = current ?? members.map((member) => member.user_id);
      return base.includes(memberId)
        ? base.filter((id) => id !== memberId)
        : [...base, memberId];
    });
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        title,
        amount: Math.round(amount * 100) / 100,
        category,
        dueDate,
        recurrence,
        splits: participants.map((participantId) => ({
          userId: participantId,
          amount: shares.get(participantId) ?? 0,
        })),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-canvas"
    >
      <ScrollView
        contentContainerClassName="gap-6 p-5 pb-10"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View>
          <SectionTitle>Category</SectionTitle>
          {/* A grid rather than five stacked rows: the whole set is visible at
              once, so picking a category is a glance instead of a scroll. */}
          <View className="flex-row flex-wrap gap-2">
            {BILL_CATEGORIES.map((meta) => {
              const selected = category === meta.value;
              return (
                <Pressable
                  key={meta.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${meta.label}, ${meta.subtitle}`}
                  onPress={() => {
                    haptics.select();
                    setCategory(meta.value);
                  }}
                  className={`min-h-[96px] w-[31%] items-center justify-center gap-1.5 rounded-xl border px-2 py-3 ${
                    selected ? 'border-moss bg-wash-sage' : 'border-line bg-paper'
                  }`}
                >
                  <View
                    className="h-11 w-11 items-center justify-center rounded-xl"
                    style={{ backgroundColor: meta.background }}
                  >
                    <Ionicons name={meta.icon} size={20} color={meta.tint} />
                  </View>
                  {/* Three cells to a row at a fixed share of the width, so
                      the text grows only as far as the cell can take it. The
                      accessible label on the cell already carries both lines
                      in full. */}
                  <Text
                    className="text-center font-ui-bold text-xs text-ink"
                    numberOfLines={1}
                    maxFontSizeMultiplier={textCap.control}
                  >
                    {meta.label}
                  </Text>
                  <Text
                    className="text-center font-ui text-[11px] text-ink-muted"
                    numberOfLines={1}
                    maxFontSizeMultiplier={textCap.control}
                  >
                    {meta.subtitle}
                  </Text>
                  {selected ? (
                    <View className="absolute right-1.5 top-1.5">
                      <Ionicons name="checkmark-circle" size={16} color={colors.moss.DEFAULT} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Naming ------------------------------------------------------- */}
        {/* Most bills are their category — an electricity bill logged under
            Utilities needs no further explanation. "Other" is the case the
            category can't answer, so that is where the field appears. */}
        {needsOwnTitle ? (
          <View>
            <TextField
              label="What's this for?"
              autoFocus={mode === 'create' && category === 'other'}
              placeholder="e.g. Gas refill"
              value={titleText}
              onChangeText={setTitleText}
              maxLength={80}
            />
            {/* Renaming is reversible: without this, clearing the field on a
                non-Other bill leaves the save button disabled with no way
                back to the category's own name. */}
            {category === 'other' ? null : (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  haptics.tap();
                  setHasOwnTitle(false);
                }}
                className="mt-1.5 self-start py-1"
              >
                <Text className="font-ui-bold text-[11px] uppercase tracking-wider text-moss">
                  Use “{categoryMeta(category).label}” instead
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`This bill will be called ${title}. Tap to give it its own name.`}
            onPress={() => {
              haptics.tap();
              setTitleText(title);
              setHasOwnTitle(true);
            }}
            className="min-h-[52px] flex-row items-center gap-2 rounded-xl border border-dashed border-line bg-paper/70 px-4 py-3 active:bg-page"
          >
            <Text className="flex-1 font-ui text-sm text-ink-muted" numberOfLines={1}>
              Called <Text className="font-ui-bold text-ink">{title}</Text>
            </Text>
            <Ionicons name="create-outline" size={16} color={colors.ink.muted} />
            <Text className="font-ui-bold text-[11px] uppercase tracking-wider text-moss">
              Rename
            </Text>
          </Pressable>
        )}

        <View className="gap-4">
          {splitsLocked ? (
            <View>
              <Text className="mb-2 font-ui-semibold text-sm text-ink-soft">Total amount</Text>
              <View className="flex-row items-center justify-between rounded-xl border border-line bg-page px-4 py-4">
                <Text className="font-mono-bold text-lg text-ink">{formatPeso(amount)}</Text>
                <Ionicons name="lock-closed" size={16} color={colors.ink.muted} />
              </View>
            </View>
          ) : (
            <TextField
              label="Total amount"
              placeholder="0.00"
              currency
              value={amountText}
              onChangeText={(value) => setAmountText(value.replace(/[^0-9.]/g, ''))}
            />
          )}
        </View>

        <DateField
          label="Due date"
          value={dueDate}
          onChange={setDueDate}
          onClear={() => setDueDate(null)}
        />

        <View>
          <SectionTitle>Repeats</SectionTitle>
          <View className="flex-row gap-2">
            {BILL_RECURRENCES.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={recurrence === option.value}
                onPress={() => {
                  setRecurrence(option.value);
                  // Weekly needs a day to repeat on, and the due date is what
                  // carries it. Seed one so the picker below has something to
                  // show rather than opening on an arbitrary weekday.
                  if (option.value === 'weekly' && !dueDate) setDueDate(new Date());
                }}
              />
            ))}
          </View>

          {recurrence === 'weekly' ? (
            <View className="mt-3">
              <WeekdayPicker
                value={weekdayIndex(dueDate ?? new Date())}
                onChange={(index) => setDueDate(nextWeekday(index, dueDate ?? new Date()))}
              />
            </View>
          ) : null}

          {recurrence !== 'none' ? (
            <Text className="mt-2 font-ui text-xs leading-5 text-ink-muted">
              Once this bill is settled, next {recurrence === 'weekly' ? 'week' : 'month'}'s
              copy is created automatically with the same amount, ready for you to adjust.
            </Text>
          ) : null}
        </View>

        <View>
          <View className="mb-2 flex-row items-center justify-between">
            <SectionTitle className="mb-0">Split with</SectionTitle>
            {splitsLocked ? null : (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setCustomMode((current) => !current);
                  if (!customMode) {
                    // Seed the custom fields with the even split so the totals
                    // start balanced.
                    const seeded: Record<string, string> = {};
                    participants.forEach((participantId, index) => {
                      seeded[participantId] = (evenShares[index] ?? 0).toFixed(2);
                    });
                    setCustomAmounts(seeded);
                  }
                }}
              >
                <Text className="font-ui-bold text-[11px] uppercase tracking-wider text-moss">
                  {customMode ? 'Split evenly' : 'Custom amounts'}
                </Text>
              </Pressable>
            )}
          </View>

          {splitsLocked ? (
            <NoteCard tape={colors.mustard} className="mb-3 pt-5">
              <Text className="font-ui text-xs leading-5 text-ink-muted">
                Someone has already paid towards this bill, so the amount and the split are
                locked — what other people have paid can't be changed underneath them. The
                title, category, due date and repeat schedule are all still editable.
              </Text>
            </NoteCard>
          ) : null}

          <View className="gap-2">
            {members.map((member) => {
              const selected = participants.includes(member.user_id);
              const share = shares.get(member.user_id) ?? 0;
              const isSelf = member.user_id === userId;

              const row = (
                <View className="flex-row items-center gap-3">
                  <Avatar
                    name={member.profile.display_name}
                    userId={member.user_id}
                    avatarUrl={member.profile.avatar_url}
                    size={36}
                  />
                  <View className="flex-1">
                    <Text className="font-ui-bold text-sm text-ink">
                      {member.profile.display_name}
                      {isSelf ? ' (you)' : ''}
                    </Text>
                    {selected ? (
                      <Text className="font-mono text-[11px] text-ink-muted">
                        {formatPeso(share)}
                        {customMode || splitsLocked ? '' : ' each'}
                      </Text>
                    ) : null}
                  </View>
                  {splitsLocked ? null : (
                    <Ionicons
                      name={selected ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={selected ? colors.moss.DEFAULT : colors.ink.muted}
                    />
                  )}
                </View>
              );

              return (
                <View
                  key={member.user_id}
                  className={`rounded-xl border p-3 ${
                    selected ? 'border-line bg-paper' : 'border-line bg-page/60'
                  }`}
                >
                  {splitsLocked ? (
                    row
                  ) : (
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      onPress={() => toggleParticipant(member.user_id)}
                    >
                      {row}
                    </Pressable>
                  )}

                  {selected && customMode && !splitsLocked ? (
                    <TextField
                      containerClassName="mt-3"
                      currency
                      placeholder="0.00"
                      value={customAmounts[member.user_id] ?? ''}
                      onChangeText={(value) =>
                        setCustomAmounts((current) => ({
                          ...current,
                          [member.user_id]: value.replace(/[^0-9.]/g, ''),
                        }))
                      }
                    />
                  ) : null}
                </View>
              );
            })}
          </View>

          {splitsLocked ? null : (
            <>
              <View className="mt-3 flex-row items-center justify-between rounded-xl bg-paper px-4 py-3">
                <Text className="font-ui text-sm text-ink-soft">Split total</Text>
                <Text
                  className={`font-mono-bold text-sm ${
                    splitsBalance ? 'text-deep-sage' : 'text-deep-brick'
                  }`}
                >
                  {formatPeso(shareTotal)} / {formatPeso(amount)}
                </Text>
              </View>

              {!splitsBalance && amount > 0 ? (
                <Text className="mt-2 font-ui text-xs text-deep-brick">
                  The splits have to add up to the total amount.
                </Text>
              ) : null}
            </>
          )}
        </View>

        {error ? <InlineError message={error} /> : null}

        <Button
          label={submitLabel}
          onPress={handleSubmit}
          loading={submitting}
          disabled={!canSubmit}
        />

        {mode === 'create' ? (
          <Text className="text-center font-ui text-xs leading-5 text-ink-muted">
            You logged this, so your own share starts as paid. Everyone else is marked as owing you.
          </Text>
        ) : null}

        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
