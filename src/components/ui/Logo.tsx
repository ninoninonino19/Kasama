import { Text, View } from 'react-native';

/**
 * The app's branding moment: mark plus wordmark, sized for the top of the auth
 * screens. Deliberately small — the brief asks for a light touch here, not a
 * hero image competing with the form.
 */
export function Logo({ tone = 'brand' }: { tone?: 'brand' | 'coral' }) {
  return (
    <View className="flex-row items-center gap-3">
      <View
        className={`h-14 w-14 items-center justify-center rounded-3xl ${
          tone === 'brand' ? 'bg-brand-500' : 'bg-coral-400'
        }`}
      >
        <Text className="text-2xl font-bold text-white">K</Text>
      </View>
      <View>
        <Text className="text-xl font-bold tracking-tight text-ink">Kasama</Text>
        <Text className="text-xs text-ink-muted">Isang bahay, isang app</Text>
      </View>
    </View>
  );
}
