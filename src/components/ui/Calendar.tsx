import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  addMonths,
  daysInMonth,
  formatMonthYear,
  formatShortDate,
  isSameDay,
  startOfMonth,
  WEEKDAY_INITIALS,
  weekdayIndex,
} from '../../lib/format';
import { haptics } from '../../lib/haptics';
import { colors } from '../../lib/theme';

import { SectionTitle } from './Screen';

/**
 * A month grid, drawn in the app's own tokens.
 *
 * This replaces `@react-native-community/datetimepicker`, which showed three
 * different things depending on where it ran: a wheel on iOS, a system dialog
 * on Android, and nothing at all on web. Picking a due date is a core action in
 * both forms, so it is worth owning — and a grid answers the question people
 * actually have ("which Saturday is that?") in a way a spinner never does.
 *
 * Monday-first, matching `startOfWeek` and the chores week strip.
 */
export function Calendar({
  value,
  onChange,
  /** Days before this are shown for context but can't be picked. */
  minDate = null,
}: {
  value: Date | null;
  onChange: (date: Date) => void;
  minDate?: Date | null;
}) {
  const today = useMemo(() => new Date(), []);
  // Opens on the selected month, or this one for a date not yet chosen.
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(value ?? today));

  const floor = useMemo(
    () => (minDate ? new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()) : null),
    [minDate]
  );

  const cells = useMemo(() => {
    const first = startOfMonth(visibleMonth);
    // Blank cells so the 1st lands under its own weekday column.
    const lead = Array.from({ length: weekdayIndex(first) }, () => null);
    const days = Array.from(
      { length: daysInMonth(visibleMonth) },
      (_, index) => new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index + 1)
    );
    return [...lead, ...days];
  }, [visibleMonth]);

  const step = (months: number) => {
    haptics.select();
    setVisibleMonth((current) => startOfMonth(addMonths(current, months)));
  };

  return (
    <View className="mt-2 rounded-xl border border-line bg-paper p-3">
      <View className="mb-2 flex-row items-center justify-between">
        <MonthButton
          icon="chevron-back"
          label="Previous month"
          onPress={() => step(-1)}
        />
        <Text className="font-ui-bold text-sm text-ink">{formatMonthYear(visibleMonth)}</Text>
        <MonthButton icon="chevron-forward" label="Next month" onPress={() => step(1)} />
      </View>

      <View className="flex-row">
        {WEEKDAY_INITIALS.map((initial, index) => (
          <View key={`${initial}-${index}`} className="flex-1 items-center pb-1">
            <Text className="font-ui-bold text-[10px] uppercase text-ink-muted">{initial}</Text>
          </View>
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {cells.map((day, index) => {
          if (!day) {
            // eslint-disable-next-line react/no-array-index-key -- blanks have no identity
            return <View key={`blank-${index}`} className="h-11 w-[14.28%]" />;
          }

          const selected = Boolean(value && isSameDay(day, value));
          const isToday = isSameDay(day, today);
          const disabled = Boolean(floor && day < floor);

          return (
            <View key={day.toISOString()} className="h-11 w-[14.28%] p-0.5">
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected, disabled }}
                accessibilityLabel={formatShortDate(day)}
                disabled={disabled}
                onPress={() => {
                  haptics.select();
                  onChange(day);
                }}
                className={`flex-1 items-center justify-center rounded-lg border ${
                  selected
                    ? 'border-moss bg-moss'
                    : isToday
                      ? 'border-moss-light bg-paper'
                      : 'border-transparent bg-paper active:bg-page'
                }`}
              >
                <Text
                  className={`font-mono text-sm ${
                    selected
                      ? 'text-paper'
                      : disabled
                        ? 'text-ink-faint'
                        : isToday
                          ? 'text-moss'
                          : 'text-ink'
                  }`}
                >
                  {day.getDate()}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function MonthButton({
  icon,
  label,
  onPress,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      className="h-11 w-11 items-center justify-center rounded-lg active:bg-page"
    >
      <Ionicons name={icon} size={18} color={colors.ink.soft} />
    </Pressable>
  );
}

/**
 * A labelled due-date row that expands into {@link Calendar} in place.
 *
 * Expanding inline rather than opening a modal keeps the rest of the form —
 * the amount, who's splitting it — visible while you choose, which is usually
 * what decides the date in the first place.
 */
export function DateField({
  label,
  value,
  onChange,
  onClear,
  minDate = null,
  emptyLabel = 'No due date',
}: {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  /** Omit to make the date required — the clear affordance disappears with it. */
  onClear?: () => void;
  minDate?: Date | null;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <SectionTitle>{label}</SectionTitle>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label}: ${value ? formatShortDate(value) : emptyLabel}`}
        accessibilityHint="Opens a calendar"
        onPress={() => {
          haptics.tap();
          setOpen((current) => !current);
        }}
        className="min-h-[56px] flex-row items-center justify-between rounded-xl border border-line bg-paper px-4 py-4 active:bg-page"
      >
        <Text
          className={
            value ? 'font-mono-bold text-base text-ink' : 'font-ui text-base text-ink-muted'
          }
        >
          {value ? formatShortDate(value) : emptyLabel}
        </Text>
        <View className="flex-row items-center gap-3">
          {value && onClear ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear due date"
              hitSlop={8}
              onPress={onClear}
            >
              <Ionicons name="close-circle" size={18} color={colors.ink.faint} />
            </Pressable>
          ) : null}
          <Ionicons
            name={open ? 'chevron-up' : 'calendar-outline'}
            size={20}
            color={colors.ink.muted}
          />
        </View>
      </Pressable>

      {open ? (
        <Calendar
          value={value}
          minDate={minDate}
          onChange={(date) => {
            onChange(date);
            // Collapse on pick: the answer is now shown in the row above, and
            // a calendar left open just pushes the save button off screen.
            setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}
