import { Pressable, Text, View } from 'react-native';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function Chip({ label, selected = false, onPress }: ChipProps) {
  const content = (
    <Text
      className={`text-sm font-semibold ${selected ? 'text-white' : 'text-ink-soft'}`}
    >
      {label}
    </Text>
  );

  const className = `items-center justify-center rounded-full border px-4 py-2 ${
    selected ? 'border-brand-500 bg-brand-500' : 'border-sand-300 bg-white'
  }`;

  if (!onPress) return <View className={className}>{content}</View>;

  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} className={className}>
      {content}
    </Pressable>
  );
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'brand';
}) {
  const tones = {
    neutral: 'bg-sand-100 text-ink-soft',
    success: 'bg-brand-100 text-brand-700',
    warning: 'bg-coral-100 text-coral-700',
    brand: 'bg-brand-500 text-white',
  } as const;

  const [bg, fg] = tones[tone].split(' ');

  return (
    <View className={`rounded-full px-2.5 py-1 ${bg}`}>
      <Text className={`text-xs font-bold ${fg}`}>{label}</Text>
    </View>
  );
}
