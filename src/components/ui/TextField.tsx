import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
        <Text className="mb-2 text-sm font-semibold text-ink-soft">{label}</Text>
      ) : null}

      <View
        className={`flex-row items-center rounded-2xl border bg-white px-4 ${
          error
            ? 'border-coral-400'
            : focused
              ? 'border-brand-400'
              : 'border-sand-300'
        }`}
      >
        {currency ? <Text className="mr-1 text-lg text-ink-soft">₱</Text> : null}
        <TextInput
          className="h-14 flex-1 text-base text-ink"
          placeholderTextColor="#A99B89"
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
            <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={20} color="#8A979B" />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text className="mt-1.5 text-sm text-coral-600">{error}</Text>
      ) : hint ? (
        <Text className="mt-1.5 text-sm text-ink-muted">{hint}</Text>
      ) : null}
    </View>
  );
}
