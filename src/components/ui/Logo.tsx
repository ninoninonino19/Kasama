import { Text, View } from 'react-native';

import { colors } from '../../lib/theme';

/**
 * The app's mark: a paper note pinned to the board with a strip of washi tape
 * across its top-left corner.
 *
 * Deliberately not a letter in a square. At 48px on a home screen a "K" has to
 * compete with every other app whose icon is its initial, whereas the tape is
 * a device this app already owns — `Tape.tsx` draws it on every card. Drawn in
 * views rather than shipped as an image so it stays crisp at any size and
 * follows the palette if the palette moves.
 *
 * The geometry matches `tools/generate-icons.py`, which renders the same mark
 * out to the launcher and notification icons. Change one, change the other.
 */
export function LogoMark({ size = 56 }: { size?: number }) {
  const noteWidth = size * 0.56;
  const noteHeight = size * 0.6;
  const noteLeft = size * 0.22;
  const noteTop = size * 0.205;

  // The strip crosses the note's top-left corner and overhangs both edges.
  const tapeLength = noteWidth * 0.57;
  const tapeWidth = noteWidth * 0.17;
  const tapeCentre = noteLeft + noteWidth * 0.13;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Kasama"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.225,
        backgroundColor: colors.moss.DEFAULT,
        overflow: 'hidden',
      }}
    >
      {/* The note and its tape lean together, so they share one wrapper. */}
      <View style={{ width: size, height: size, transform: [{ rotate: '-4deg' }] }}>
        <View
          style={{
            position: 'absolute',
            left: noteLeft,
            top: noteTop,
            width: noteWidth,
            height: noteHeight,
            borderRadius: noteWidth * 0.055,
            backgroundColor: colors.paper,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: tapeCentre - tapeLength / 2,
            top: tapeCentre - tapeWidth / 2,
            width: tapeLength,
            height: tapeWidth,
            backgroundColor: colors.mustard,
            // Washi is translucent — the paper shows through underneath it.
            opacity: 0.93,
            transform: [{ rotate: '-45deg' }],
          }}
        />
      </View>
    </View>
  );
}

/**
 * Mark plus wordmark, sized for the top of the auth screens. Deliberately
 * small — the brief asks for a light touch here, not a hero image competing
 * with the form.
 */
export function Logo() {
  return (
    <View className="flex-row items-center gap-3">
      <LogoMark size={56} />
      <View>
        <Text className="font-ui-black text-xl tracking-tight text-ink">Kasama</Text>
        <Text className="font-ui text-xs text-ink-muted">One house, one app</Text>
      </View>
    </View>
  );
}
