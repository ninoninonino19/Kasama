import { Image, Text, View } from 'react-native';

import { avatarColors, initials } from '../../lib/format';

type Props = {
  name: string;
  userId: string;
  avatarUrl?: string | null;
  size?: number;
};

export function Avatar({ name, userId, avatarUrl, size = 40 }: Props) {
  const colors = avatarColors(userId);

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        accessibilityIgnoresInvertColors
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <View
      className="items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.bg,
      }}
    >
      <Text style={{ color: colors.fg, fontSize: size * 0.38, fontWeight: '700' }}>
        {initials(name)}
      </Text>
    </View>
  );
}
