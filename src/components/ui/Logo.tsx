import { Text, View } from 'react-native';

/**
 * The app's branding moment: mark plus wordmark, sized for the top of the auth
 * screens. Deliberately small — the brief asks for a light touch here, not a
 * hero image competing with the form.
 */
export function Logo() {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-14 w-14 items-center justify-center rounded-3xl bg-moss">
        <Text className="font-ui-black text-2xl text-paper">K</Text>
      </View>
      <View>
        <Text className="font-ui-black text-xl tracking-tight text-ink">Kasama</Text>
        <Text className="font-ui text-xs text-ink-muted">One house, one app</Text>
      </View>
    </View>
  );
}
