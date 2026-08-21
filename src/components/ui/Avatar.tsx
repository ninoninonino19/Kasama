import { Image, Text, View } from 'react-native';

import { avatarColors, initials } from '../../lib/format';
import { colors, fonts } from '../../lib/theme';

type Props = {
  name: string;
  userId: string;
  avatarUrl?: string | null;
  size?: number;
  /**
   * The white ring that lifts a face off the paper and lets an avatar row
   * overlap without the circles bleeding into each other. Off inside an
   * already-white surface, where the ring is invisible anyway.
   */
  ring?: boolean;
};

export function Avatar({ name, userId, avatarUrl, size = 40, ring = true }: Props) {
  const palette = avatarColors(userId);
  const border = ring ? { borderWidth: 2, borderColor: colors.paper } : null;

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        accessibilityIgnoresInvertColors
        style={{ width: size, height: size, borderRadius: size / 2, ...border }}
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
        backgroundColor: palette.bg,
        ...border,
      }}
    >
      <Text
        // The circle is sized by its caller and can't grow with the text, so
        // scaled-up initials would simply spill out of it. The name they stand
        // for is always spelled out next to the face anyway.
        allowFontScaling={false}
        style={{ color: palette.fg, fontSize: size * 0.36, fontFamily: fonts.bodyBold }}
      >
        {initials(name)}
      </Text>
    </View>
  );
}
