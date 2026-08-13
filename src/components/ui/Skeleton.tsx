import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

/**
 * Pulsing placeholder blocks. On a phone these read as "content is coming"
 * far better than a lone spinner, and they keep the layout from jumping once
 * the real rows land.
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
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <Animated.View
      className={`bg-sand-200 ${className}`}
      style={{ width, height, borderRadius: rounded, opacity: pulse }}
    />
  );
}

/** Matches the shape of a BillRow / chore card so nothing shifts on load. */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View className="gap-3 px-5" accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: rows }).map((_, index) => (
        <View key={index} className="rounded-2xl border border-sand-200 bg-white p-4">
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

/** Balance card + two rows, for the dashboard. */
export function DashboardSkeleton() {
  return (
    <View className="gap-6">
      <View className="gap-3 rounded-3xl bg-brand-600/90 p-5">
        <Skeleton width="35%" height={10} className="bg-white/30" />
        <Skeleton width="55%" height={28} className="bg-white/30" />
        <View className="mt-2 flex-row gap-3">
          <Skeleton width="47%" height={58} rounded={16} className="bg-white/20" />
          <Skeleton width="47%" height={58} rounded={16} className="bg-white/20" />
        </View>
      </View>
      <ListSkeleton rows={2} />
    </View>
  );
}
