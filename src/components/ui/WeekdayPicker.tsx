import { Pressable, Text, View } from 'react-native';

import { WEEKDAY_NAMES, WEEKDAY_SHORT } from '../../lib/format';
import { haptics } from '../../lib/haptics';
import { textCap } from '../../lib/theme';

/**
 * Which day of the week a weekly bill or chore lands on.
 *
 * There is no `weekday` column behind this, and there shouldn't be: both
 * weekly rollovers — `roll_recurring_bill` for bills, `nextDueDate` for chores
 * — advance by exactly seven days, so whichever weekday the due date starts on
 * is the weekday it keeps. Picking a day here just moves the due date, and the
 * schedule follows from it. A separate column would be a second source of
 * truth that the rollover could drift away from.
 *
 * Sunday-first, matching the calendar and the chores week strip.
 */
export function WeekdayPicker({
  value,
  onChange,
}: {
  /** Sunday = 0 … Saturday = 6. */
  value: number;
  onChange: (index: number) => void;
}) {
  return (
    <View>
      <View className="flex-row gap-1.5">
        {WEEKDAY_SHORT.map((label, index) => {
          const selected = index === value;

          return (
            <Pressable
              key={WEEKDAY_NAMES[index]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={WEEKDAY_NAMES[index]}
              onPress={() => {
                haptics.select();
                onChange(index);
              }}
              className={`min-h-[44px] flex-1 items-center justify-center rounded-xl border ${
                selected ? 'border-moss bg-moss' : 'border-line bg-paper active:bg-page'
              }`}
            >
              {/* Seven cells share the row, so the label can't grow much —
                  the accessible name on the cell says the day in full. */}
              <Text
                className={`font-ui-bold text-xs ${selected ? 'text-paper' : 'text-ink-soft'}`}
                numberOfLines={1}
                maxFontSizeMultiplier={textCap.grid}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text className="mt-2 font-ui text-xs leading-5 text-ink-muted">
        Repeats every {WEEKDAY_NAMES[value]}.
      </Text>
    </View>
  );
}
