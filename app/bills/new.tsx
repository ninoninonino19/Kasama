import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { createBill } from '../../src/api/bills';
import { Avatar } from '../../src/components/ui/Avatar';
import { Button } from '../../src/components/ui/Button';
import { Chip } from '../../src/components/ui/Chip';
import { InlineError } from '../../src/components/ui/States';
import { SectionTitle } from '../../src/components/ui/Screen';
import { TextField } from '../../src/components/ui/TextField';
import { messageFrom } from '../../src/hooks/useAsyncData';
import { BILL_CATEGORIES, BILL_RECURRENCES, BILL_SUGGESTIONS } from '../../src/lib/categories';
import type { BillCategory, BillRecurrence } from '../../src/lib/database.types';
import { formatPeso, formatShortDate, splitEvenly, toDateString } from '../../src/lib/format';
import { haptics } from '../../src/lib/haptics';
import { colors } from '../../src/lib/theme';
import { useHousehold, useMembers, useSessionStore } from '../../src/store/useSessionStore';

export default function NewBillScreen() {
  const router = useRouter();
  const household = useHousehold();
  const members = useMembers();
  const userId = useSessionStore((state) => state.userId);

  const [title, setTitle] = useState('');
  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState<BillCategory>('utilities');
  const [recurrence, setRecurrence] = useState<BillRecurrence>('monthly');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  // `null` means "nobody has touched this yet", so the default stays in sync
  // with the member list even if it loads after this screen mounts.
  const [chosenParticipants, setChosenParticipants] = useState<string[] | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const amount = Number.parseFloat(amountText.replace(/,/g, '')) || 0;

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
    title.trim().length > 0 && amount > 0 && participants.length > 0 && splitsBalance && !submitting;

  function toggleParticipant(memberId: string) {
    setChosenParticipants((current) => {
      const base = current ?? members.map((member) => member.user_id);
      return base.includes(memberId)
        ? base.filter((id) => id !== memberId)
        : [...base, memberId];
    });
  }

  async function handleSubmit() {
    if (!canSubmit || !household || !userId) return;
    setSubmitting(true);
    setError(null);

    try {
      await createBill({
        householdId: household.id,
        createdBy: userId,
        title,
        amount: Math.round(amount * 100) / 100,
        category,
        dueDate: dueDate ? toDateString(dueDate) : null,
        recurrence,
        splits: participants.map((participantId) => ({
          userId: participantId,
          amount: shares.get(participantId) ?? 0,
        })),
      });
      router.back();
    } catch (caught) {
      setError(messageFrom(caught));
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-sand-50"
    >
      <ScrollView
        contentContainerClassName="gap-6 p-5 pb-10"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View className="gap-4">
          <TextField
            label="What's this for?"
            autoFocus
            placeholder="e.g. Kuryente ng Agosto"
            value={title}
            onChangeText={setTitle}
            maxLength={80}
          />

          <View className="flex-row flex-wrap gap-2">
            {BILL_SUGGESTIONS.map((suggestion) => (
              <Pressable
                key={suggestion.title}
                accessibilityRole="button"
                onPress={() => {
                  setTitle(suggestion.title);
                  setCategory(suggestion.category);
                }}
                className="rounded-full border border-sand-300 bg-white px-3 py-1.5 active:bg-sand-100"
              >
                <Text className="text-xs font-semibold text-ink-soft">{suggestion.title}</Text>
              </Pressable>
            ))}
          </View>

          <TextField
            label="Total amount"
            placeholder="0.00"
            currency
            value={amountText}
            onChangeText={(value) => setAmountText(value.replace(/[^0-9.]/g, ''))}
          />
        </View>

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
                  className={`min-h-[96px] w-[31%] items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 ${
                    selected ? 'border-brand-500 bg-brand-50' : 'border-sand-200 bg-white'
                  }`}
                >
                  <View
                    className="h-11 w-11 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: meta.background }}
                  >
                    <Ionicons name={meta.icon} size={20} color={meta.tint} />
                  </View>
                  <Text className="text-center text-xs font-bold text-ink" numberOfLines={1}>
                    {meta.label}
                  </Text>
                  <Text className="text-center text-[10px] text-ink-muted" numberOfLines={1}>
                    {meta.subtitle}
                  </Text>
                  {selected ? (
                    <View className="absolute right-1.5 top-1.5">
                      <Ionicons name="checkmark-circle" size={16} color={colors.brand[600]} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View>
          <SectionTitle>Due date</SectionTitle>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowPicker(true)}
            className="flex-row items-center justify-between rounded-2xl border border-sand-300 bg-white px-4 py-4"
          >
            <Text className={dueDate ? 'text-base text-ink' : 'text-base text-ink-muted'}>
              {dueDate ? formatShortDate(dueDate) : 'Walang due date'}
            </Text>
            <View className="flex-row items-center gap-3">
              {dueDate ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear due date"
                  hitSlop={8}
                  onPress={() => setDueDate(null)}
                >
                  <Ionicons name="close-circle" size={18} color={colors.sand[500]} />
                </Pressable>
              ) : null}
              <Ionicons name="calendar-outline" size={20} color={colors.ink.muted} />
            </View>
          </Pressable>

          {showPicker ? (
            <DateTimePicker
              value={dueDate ?? new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(event, selected) => {
                if (Platform.OS !== 'ios') setShowPicker(false);
                if (event.type === 'set' && selected) setDueDate(selected);
              }}
            />
          ) : null}

          {Platform.OS === 'ios' && showPicker ? (
            <Button
              label="Done"
              variant="secondary"
              size="md"
              className="mt-2"
              onPress={() => setShowPicker(false)}
            />
          ) : null}
        </View>

        <View>
          <SectionTitle>Repeats</SectionTitle>
          <View className="flex-row gap-2">
            {BILL_RECURRENCES.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={recurrence === option.value}
                onPress={() => setRecurrence(option.value)}
              />
            ))}
          </View>
        </View>

        <View>
          <View className="mb-2 flex-row items-center justify-between">
            <SectionTitle className="mb-0">Split with</SectionTitle>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setCustomMode((current) => !current);
                if (!customMode) {
                  // Seed the custom fields with the even split so the totals start balanced.
                  const seeded: Record<string, string> = {};
                  participants.forEach((participantId, index) => {
                    seeded[participantId] = (evenShares[index] ?? 0).toFixed(2);
                  });
                  setCustomAmounts(seeded);
                }
              }}
            >
              <Text className="text-xs font-bold uppercase tracking-wider text-brand-600">
                {customMode ? 'Split evenly' : 'Custom amounts'}
              </Text>
            </Pressable>
          </View>

          <View className="gap-2">
            {members.map((member) => {
              const selected = participants.includes(member.user_id);
              const share = shares.get(member.user_id) ?? 0;
              const isSelf = member.user_id === userId;

              return (
                <View
                  key={member.user_id}
                  className={`rounded-2xl border p-3 ${
                    selected ? 'border-brand-200 bg-white' : 'border-sand-200 bg-sand-100/60'
                  }`}
                >
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    onPress={() => toggleParticipant(member.user_id)}
                    className="flex-row items-center gap-3"
                  >
                    <Avatar
                      name={member.profile.display_name}
                      userId={member.user_id}
                      avatarUrl={member.profile.avatar_url}
                      size={36}
                    />
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-ink">
                        {member.profile.display_name}
                        {isSelf ? ' (you)' : ''}
                      </Text>
                      {selected && !customMode ? (
                        <Text className="text-xs text-ink-muted">{formatPeso(share)} each</Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name={selected ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={selected ? colors.brand[600] : colors.ink.muted}
                    />
                  </Pressable>

                  {selected && customMode ? (
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

          <View className="mt-3 flex-row items-center justify-between rounded-2xl bg-white px-4 py-3">
            <Text className="text-sm text-ink-soft">Split total</Text>
            <Text
              className={`text-sm font-bold ${splitsBalance ? 'text-brand-600' : 'text-coral-600'}`}
            >
              {formatPeso(shareTotal)} / {formatPeso(amount)}
            </Text>
          </View>

          {!splitsBalance && amount > 0 ? (
            <Text className="mt-2 text-xs text-coral-600">
              Dapat pantay ang kabuuan ng splits sa total amount.
            </Text>
          ) : null}
        </View>

        {error ? <InlineError message={error} /> : null}

        <Button
          label="Save bill"
          onPress={handleSubmit}
          loading={submitting}
          disabled={!canSubmit}
        />
        <Text className="text-center text-xs leading-5 text-ink-muted">
          Ikaw ang nag-log, so your share starts as already paid. Ang iba, marked as owing you.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
