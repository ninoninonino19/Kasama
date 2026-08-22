import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

/**
 * Pulsing placeholder blocks. On a phone these read as "content is coming"
 * far better than a lone spinner, and they keep the layout from jumping once
 * the real rows land.
 *
 * The pulse is `animate-pulse` rather than a hand-rolled loop: NativeWind
 * compiles its keyframes to a Reanimated shared value, so it runs on the UI
 * thread and keeps pulsing while the JS thread is busy doing the very fetch
 * these blocks are standing in for — which is the one moment it has to.
 *
 * With reduced motion on, the blocks hold a steady dimmed state instead. They
 * still say "not content yet"; they just stop breathing.
 */
export function Skeleton({
  width,
  height = 12,
  rounded = 8,
  className = '',
}: {
  width?: number | `${number}%`;
  height?: number;
  rounded?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <View
      className={`bg-page ${reduced ? 'opacity-70' : 'animate-pulse'} ${className}`}
      style={{ width, height, borderRadius: rounded }}
    />
  );
}

/** Matches the shape of a BillRow / chore card so nothing shifts on load. */
export function ListSkeleton({
  rows = 3,
  /** Off when the caller already pads its own content, as the dashboard does. */
  padded = true,
}: {
  rows?: number;
  padded?: boolean;
}) {
  return (
    <View
      className={`gap-3 ${padded ? 'px-5' : ''}`}
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      {Array.from({ length: rows }).map((_, index) => (
        <View key={index} className="rounded-xl border border-line bg-paper p-4">
          <View className="flex-row items-center gap-3">
            <Skeleton width={44} height={44} rounded={16} />
            <View className="flex-1 gap-2">
              <Skeleton width="60%" height={14} />
              <Skeleton width="40%" height={10} />
            </View>
            <View className="items-end gap-2">
              <Skeleton width={70} height={14} />
              <Skeleton width={54} height={18} rounded={999} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * The dashboard's shape, in the order the screen actually draws it: quick
 * actions, the month's balance, today's chore, the latest note.
 */
export function DashboardSkeleton() {
  return (
    <View className="gap-6">
      {/* Quick actions, so the row doesn't pop in above the balance. */}
      <View className="flex-row gap-3">
        <Skeleton width="47%" height={52} rounded={16} />
        <Skeleton width="47%" height={52} rounded={16} />
      </View>
      {/* The balance card: headline, progress bar, then the next bill due
          under its own rule — one card where there used to be two. */}
      <View className="gap-3 rounded-xl border border-line bg-paper p-5">
        <View className="items-center gap-3">
          <Skeleton width="40%" height={10} />
          <Skeleton width="50%" height={28} />
          <Skeleton width="60%" height={10} />
        </View>
        <Skeleton width="100%" height={6} rounded={999} />
        <View className="mt-1 flex-row items-center gap-3 border-t border-line pt-3">
          <Skeleton width={40} height={40} rounded={16} />
          <View className="flex-1 gap-2">
            <Skeleton width="60%" height={14} />
            <Skeleton width="40%" height={10} />
          </View>
          <View className="items-end gap-2">
            <Skeleton width={64} height={14} />
            <Skeleton width={54} height={18} rounded={999} />
          </View>
        </View>
      </View>
      {/* Today's chore. */}
      <ListSkeleton rows={1} padded={false} />
      {/* The latest note — taller, because it carries three lines of Caveat. */}
      <View className="gap-3 rounded-xl border border-line bg-paper p-4">
        <View className="flex-row items-center gap-2">
          <Skeleton width={24} height={24} rounded={12} />
          <Skeleton width="35%" height={10} />
        </View>
        <Skeleton width="90%" height={16} />
        <Skeleton width="70%" height={16} />
      </View>
    </View>
  );
}
