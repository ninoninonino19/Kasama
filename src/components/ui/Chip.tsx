import { Pressable, Text, View } from 'react-native';

import { haptics } from '../../lib/haptics';

type ChipProps = {
  label: string;
  /** Small trailing count, e.g. the number of bills behind a filter. */
  count?: number;
  selected?: boolean;
  onPress?: () => void;
};

export function Chip({ label, count, selected = false, onPress }: ChipProps) {
  const content = (
    <View className="flex-row items-center gap-1.5">
      <Text
        className={`font-ui-semibold text-sm ${selected ? 'text-paper' : 'text-ink-soft'}`}
      >
        {label}
      </Text>
      {typeof count === 'number' ? (
        // A count on the filter itself saves a tap to find out a tab is empty.
        <View
          className={`min-w-[20px] items-center rounded-full px-1.5 py-0.5 ${
            selected ? 'bg-paper/25' : 'bg-page'
          }`}
        >
          <Text
            className={`font-ui-bold text-[11px] ${selected ? 'text-paper' : 'text-ink-muted'}`}
          >
            {count}
          </Text>
        </View>
      ) : null}
    </View>
  );

  // min-h-11 keeps every chip at the 44pt minimum touch target.
  const className = `min-h-11 items-center justify-center rounded-full border px-4 py-2 ${
    selected ? 'border-moss bg-moss' : 'border-line bg-paper'
  }`;

  if (!onPress) return <View className={className}>{content}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={typeof count === 'number' ? `${label}, ${count}` : label}
      onPress={() => {
        haptics.select();
        onPress();
      }}
      className={`${className} active:opacity-80`}
    >
      {content}
    </Pressable>
  );
}
