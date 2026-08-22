import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import type { ReactNode } from 'react';

import type { TapeColor } from '../lib/database.types';
import { haptics } from '../lib/haptics';
import { colors, TAPE_HEX, TAPE_TOKENS } from '../lib/theme';
import { ReceiptField } from './Receipt';
import type { ReceiptState } from './Receipt';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { FormScreen, SectionTitle } from './ui/Screen';
import { InlineError } from './ui/States';
import { Tape } from './ui/Tape';

export const MAX_NOTE_LENGTH = 500;

/**
 * Writing a note, shared by the compose and edit screens.
 *
 * It lives on its own screen rather than in a bar above the tab bar: an inline
 * composer has to fight the keyboard for space with the tab bar in between,
 * whereas here the keyboard simply has the screen and there is room to write
 * more than one line.
 */
export function NoteComposer({
  title: screenTitle,
  authorName,
  authorId,
  authorAvatarUrl,
  subtitle,
  initialContent = '',
  initialTape = 'mustard',
  initialReceipt = { status: 'none' },
  submitLabel,
  onSubmit,
  footer,
}: {
  /** The header's title. The composer owns its header — see `FormHeader`. */
  title: string;
  authorName: string;
  authorId: string;
  authorAvatarUrl?: string | null;
  subtitle: string;
  initialContent?: string;
  initialTape?: TapeColor;
  /** The receipt already on the note, when this is the edit screen. */
  initialReceipt?: ReceiptState;
  submitLabel: string;
  onSubmit: (content: string, tape: TapeColor, receipt: ReceiptState) => Promise<void>;
  footer?: ReactNode;
}) {
  const [content, setContent] = useState(initialContent);
  // Opens on the colour the note already shows, rather than making the first
  // choice mandatory.
  const [tape, setTape] = useState<TapeColor>(initialTape);
  const [receipt, setReceipt] = useState<ReceiptState>(initialReceipt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = MAX_NOTE_LENGTH - content.length;
  const canSubmit = content.trim().length > 0 && !busy;

  async function handleSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(content, tape, receipt);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <FormScreen title={screenTitle}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
      <View className="flex-1 gap-4 p-5">
        <View className="flex-row items-center gap-3">
          <Avatar name={authorName} userId={authorId} avatarUrl={authorAvatarUrl} size={36} />
          <View className="flex-1">
            <Text className="font-ui-bold text-sm text-ink">{authorName}</Text>
            <Text className="font-ui text-xs text-ink-muted">
              {receipt.status === 'none' ? subtitle : 'with a receipt attached'}
            </Text>
          </View>
          {/* Riding in the byline rather than in a section of its own, which is
              a layout decision the keyboard makes for us: this screen doesn't
              scroll, and the note sheet below is the flex-1 that pays for
              every fixed row above it. A whole row for the receipt costs the
              sheet most of its height on a small phone with the keyboard up. */}
          <ReceiptField value={receipt} onChange={setReceipt} onError={setError} compact />
        </View>

        {/* The sheet itself, drawn the way it will look on the board — same
            paper, same tape, same handwriting. */}
        <View className="flex-1 rounded-xl border border-line bg-paper p-4 pt-5">
          <Tape color={TAPE_HEX[tape]} />
          <TextInput
            className="flex-1 font-hand text-2xl leading-8 text-ink"
            placeholder="What's happening at home? e.g. Electricity is due Friday — send me your share when you can."
            placeholderTextColor={colors.ink.faint}
            value={content}
            onChangeText={(value) => setContent(value.slice(0, MAX_NOTE_LENGTH))}
            multiline
            autoFocus
            textAlignVertical="top"
            maxLength={MAX_NOTE_LENGTH}
          />
        </View>

        <View>
          <SectionTitle>Tape</SectionTitle>
          <View className="flex-row items-center gap-3">
            {TAPE_TOKENS.map((token) => {
              const selected = token === tape;
              return (
                <Pressable
                  key={token}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${token} tape`}
                  onPress={() => {
                    haptics.select();
                    setTape(token);
                  }}
                  // 44pt target around a deliberately small swatch.
                  className="h-11 w-11 items-center justify-center"
                >
                  <View
                    className={`h-7 w-9 rounded-[3px] ${selected ? 'border-2 border-ink' : ''}`}
                    style={{
                      backgroundColor: TAPE_HEX[token],
                      transform: [{ rotate: '-4deg' }],
                    }}
                  />
                </Pressable>
              );
            })}
            <Text
              className={`flex-1 text-right font-mono text-xs ${
                remaining < 50 ? 'text-deep-brick' : 'text-ink-muted'
              }`}
            >
              {remaining} left
            </Text>
          </View>
        </View>

        {error ? <InlineError message={error} /> : null}

        <Button
          label={submitLabel}
          icon="send"
          onPress={handleSubmit}
          loading={busy}
          disabled={!canSubmit}
        />

        {footer}
      </View>
      </KeyboardAvoidingView>
    </FormScreen>
  );
}
