import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../lib/theme';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string | null;
  /** Renders a peso prefix and forces the numeric keypad. */
  currency?: boolean;
  containerClassName?: string;
};

export function TextField({
  label,
  hint,
  error,
  currency = false,
  containerClassName = '',
  secureTextEntry,
  ...inputProps
}: Props) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const isPassword = Boolean(secureTextEntry);

  return (
    <View className={containerClassName}>
      {label ? (
        <Text className="mb-2 font-ui-semibold text-sm text-ink-soft">{label}</Text>
      ) : null}

      <View
        className={`flex-row items-center rounded-xl border bg-paper px-4 ${
          error ? 'border-brick' : focused ? 'border-moss-light' : 'border-line'
        }`}
      >
        {/* Money is a ledger entry — the prefix and the field share one face. */}
        {currency ? <Text className="mr-1 font-mono text-lg text-ink-soft">₱</Text> : null}
        <TextInput
          className={`h-14 flex-1 text-base text-ink ${currency ? 'font-mono-bold' : 'font-ui'}`}
          placeholderTextColor={colors.ink.muted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType={currency ? 'decimal-pad' : inputProps.keyboardType}
          secureTextEntry={isPassword && !revealed}
          {...inputProps}
        />
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            hitSlop={8}
            onPress={() => setRevealed((current) => !current)}
          >
            <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.ink.muted} />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text className="mt-1.5 font-ui text-sm text-deep-brick">{error}</Text>
      ) : hint ? (
        <Text className="mt-1.5 font-ui text-sm text-ink-muted">{hint}</Text>
      ) : null}
    </View>
  );
}
