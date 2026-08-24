import { useEffect, useRef, useState } from 'react';
import { Share, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { messageFrom } from '../hooks/useAsyncData';
import { haptics } from '../lib/haptics';
import { textCap } from '../lib/theme';
import { Button } from './ui/Button';

/**
 * The six characters that are the whole access model, plus the two ways of
 * getting them to a housemate.
 *
 * Shared by the post-creation invite screen and household settings so the code
 * looks and behaves the same in both — and so the share sheet's web fallback
 * only has to be right once.
 */
export function InviteCode({
  code,
  householdName,
  caption,
  size = 'md',
  onError,
  onShared,
}: {
  code: string;
  householdName: string;
  /**
   * The line explaining what to do with the code. Passed in rather than left
   * to the caller to render underneath, so it can't end up orphaned below the
   * buttons — it belongs between the code and the two ways of sending it.
   */
  caption?: string;
  /** `lg` is for the invite screen, where the code is the whole point. */
  size?: 'md' | 'lg';
  onError?: (message: string) => void;
  onShared?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The "Copied" label is on a timer, and the screen it sits on can be left
  // before it fires — settings is one tap from the back arrow.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  function flagCopied() {
    haptics.success();
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  async function copy() {
    try {
      await Clipboard.setStringAsync(code);
      flagCopied();
      onShared?.();
    } catch (caught) {
      onError?.(messageFrom(caught));
    }
  }

  async function share() {
    const message = `Join "${householdName}" on Kasama — one house, one app. Invite code: ${code}`;

    try {
      await Share.share({ message });
      onShared?.();
    } catch {
      // The share sheet is native-only: on a browser without the Web Share
      // API, `Share.share` rejects outright. Copying gets the code into the
      // user's hands anyway, which is the whole point of the button — better
      // than reporting that their browser is the problem.
      try {
        await Clipboard.setStringAsync(message);
        flagCopied();
        onShared?.();
      } catch (caught) {
        onError?.(messageFrom(caught));
      }
    }
  }

  return (
    <View className="items-center gap-3">
      <Text
        accessibilityLabel={`Invite code ${code.split('').join(' ')}`}
        className={`font-mono-bold text-ink ${size === 'lg' ? 'text-5xl' : 'text-4xl'}`}
        // Tracking this wide needs the trailing space trimmed or the string
        // sits visibly left of centre.
        style={{ letterSpacing: size === 'lg' ? 10 : 8, marginRight: size === 'lg' ? -10 : -8 }}
        // A six-character code has nowhere to wrap to, so it stops growing
        // well before it would overflow its card.
        maxFontSizeMultiplier={textCap.control}
      >
        {code}
      </Text>
      {caption ? (
        <Text className="text-center font-ui text-sm leading-5 text-ink-muted">{caption}</Text>
      ) : null}
      <View className="flex-row gap-2">
        <Button
          label={copied ? 'Copied' : 'Copy'}
          variant="secondary"
          size="md"
          icon={copied ? 'checkmark' : 'copy-outline'}
          onPress={copy}
        />
        <Button label="Share" size="md" icon="share-outline" onPress={share} />
      </View>
    </View>
  );
}
