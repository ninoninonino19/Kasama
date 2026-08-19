import { View } from 'react-native';

type Tone = 'moss' | 'mustard' | 'brick';

const FILL: Record<Tone, string> = {
  moss: 'bg-moss',
  mustard: 'bg-mustard',
  brick: 'bg-brick',
};

/**
 * Slim "how far along is this" bar. It always sits next to the same count in
 * words ("2 of 3 paid") — on its own a bar is decoration, not information.
 */
export function ProgressBar({
  ratio,
  tone = 'moss',
  height = 6,
}: {
  ratio: number;
  tone?: Tone;
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="overflow-hidden rounded-full bg-page"
      style={{ height }}
    >
      <View className={`h-full rounded-full ${FILL[tone]}`} style={{ width: `${clamped * 100}%` }} />
    </View>
  );
}
