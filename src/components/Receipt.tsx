import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { captureReceipt, pickReceipt, ReceiptError } from '../api/receipts';
import type { PickedReceipt } from '../api/receipts';
import { messageFrom } from '../hooks/useAsyncData';
import { haptics } from '../lib/haptics';
import { press, pressSmall } from '../lib/motion';
import { colors } from '../lib/theme';
import { useDialog } from './ui/Dialog';

/**
 * What a note's receipt is doing while someone writes or edits it.
 *
 *  - `none` — no receipt, either never had one or it's been taken off.
 *  - `kept` — the one already on the note, untouched by this edit.
 *  - `picked` — a photo chosen on this screen, still only in memory.
 *
 * Three states rather than one nullable path because "unchanged" and "replaced
 * with the same thing" have to be tellable apart: the second uploads a new
 * file and deletes the old one, and the first must not.
 */
export type ReceiptState =
  | { status: 'none' }
  | { status: 'kept'; path: string; url: string | null }
  | { status: 'picked'; receipt: PickedReceipt };

/** The local preview for a state, or null when there is nothing to show. */
function previewUri(state: ReceiptState): string | null {
  if (state.status === 'picked') return state.receipt.uri;
  if (state.status === 'kept') return state.url;
  return null;
}

/**
 * The photo-of-the-receipt control, shared by the board's composer bar and the
 * full-screen note editor.
 *
 * The point of it is validation before money moves: someone photographs the
 * SOA, the house reads the total off the picture, and only then does it become
 * a bill with everyone's share on it. So the affordance is deliberately close
 * to the note text rather than tucked behind a menu — the receipt *is* the
 * post, and the words are the caption.
 */
export function ReceiptField({
  value,
  onChange,
  onError,
  compact = false,
}: {
  value: ReceiptState;
  onChange: (next: ReceiptState) => void;
  onError: (message: string) => void;
  /** The board's inline bar, where the control is one icon rather than a row. */
  compact?: boolean;
}) {
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);
  const uri = previewUri(value);

  async function choose(take: boolean) {
    setBusy(true);
    try {
      const receipt = take ? await captureReceipt() : await pickReceipt();
      // A dismissed picker is not a failure and shouldn't read as one.
      if (!receipt) return;
      haptics.success();
      onChange({ status: 'picked', receipt });
    } catch (caught) {
      haptics.error();
      onError(caught instanceof ReceiptError ? caught.message : messageFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  function openPicker() {
    haptics.tap();
    void dialog({
      title: 'Pin a receipt',
      message: 'Housemates can check the total before it becomes a bill.',
      actions: [
        { label: 'Take a photo', onPress: () => void choose(true) },
        { label: 'Choose from photos', onPress: () => void choose(false) },
        { label: 'Cancel', style: 'cancel' },
      ],
    });
  }

  function remove() {
    haptics.tap();
    onChange({ status: 'none' });
  }

  if (compact && !uri) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Attach a receipt"
        accessibilityState={{ busy }}
        disabled={busy}
        onPress={openPicker}
        className={`h-9 w-9 items-center justify-center rounded-full border border-line bg-paper ${pressSmall} active:bg-page`}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.ink.muted} />
        ) : (
          <Ionicons name="camera-outline" size={18} color={colors.ink.soft} />
        )}
      </Pressable>
    );
  }

  if (!uri) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Attach a receipt"
        accessibilityState={{ busy }}
        disabled={busy}
        onPress={openPicker}
        className={`min-h-[52px] flex-row items-center gap-3 rounded-xl border border-dashed border-line bg-paper/70 px-4 py-3 ${press} active:bg-page`}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.ink.muted} />
        ) : (
          <Ionicons name="receipt-outline" size={18} color={colors.ink.muted} />
        )}
        <Text className="flex-1 font-ui text-sm text-ink-muted">
          Add a photo of the receipt
        </Text>
        <Text className="font-ui-bold text-[11px] uppercase tracking-wider text-moss">Attach</Text>
      </Pressable>
    );
  }

  // Attached. The thumbnail is the control from here on — tapping it swaps the
  // photo, which is what people reach for after squinting at a blurry one.
  return (
    <View className={`flex-row items-center gap-3 ${compact ? '' : 'rounded-xl border border-line bg-paper p-2'}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Replace this receipt"
        disabled={busy}
        onPress={openPicker}
        className={`overflow-hidden rounded-lg border border-line ${pressSmall}`}
      >
        <Image
          source={{ uri }}
          style={{ width: compact ? 40 : 56, height: compact ? 40 : 56 }}
          resizeMode="cover"
        />
      </Pressable>

      {compact ? null : (
        <View className="flex-1">
          <Text className="font-ui-semibold text-sm text-ink">Receipt attached</Text>
          <Text className="font-ui text-xs text-ink-muted">
            {value.status === 'picked'
              ? 'Goes up with the note. Tap it to swap the photo.'
              : 'Already on this note. Tap it to swap the photo.'}
          </Text>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Remove this receipt"
        hitSlop={8}
        onPress={remove}
        className={`h-9 w-9 items-center justify-center rounded-full ${pressSmall} active:bg-page`}
      >
        <Ionicons name="close" size={18} color={colors.ink.muted} />
      </Pressable>
    </View>
  );
}

/**
 * A receipt as it appears on the board.
 *
 * Capped in height rather than shown whole: a photo of an A4 statement is
 * three phone-screens tall, and a board where one note fills the scroll is not
 * a board. Tapping opens it full size, which is where the small print people
 * actually came to check gets read.
 */
export function ReceiptImage({ url, author }: { url: string; author: string }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <View className="mt-3 flex-row items-center gap-2 rounded-xl border border-line bg-page px-3 py-2.5">
        <Ionicons name="image-outline" size={16} color={colors.ink.muted} />
        <Text className="flex-1 font-ui text-xs text-ink-muted">
          This receipt couldn't be loaded. Pull down to refresh the board.
        </Text>
      </View>
    );
  }

  return (
    <>
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={`Receipt from ${author}. Double tap to view it full size.`}
        onPress={() => {
          haptics.tap();
          setOpen(true);
        }}
        className={`mt-3 overflow-hidden rounded-xl border border-line bg-page ${press}`}
      >
        <Image
          source={{ uri: url }}
          style={{ width: '100%', height: 200 }}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
        <View className="absolute bottom-2 right-2 flex-row items-center gap-1 rounded-full bg-bezel/80 px-2.5 py-1">
          <Ionicons name="expand-outline" size={12} color={colors.paper} />
          <Text className="font-ui-bold text-[10px] uppercase tracking-wider text-paper">
            Receipt
          </Text>
        </View>
      </Pressable>

      <ReceiptViewer url={url} author={author} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * The receipt, full size, on black.
 *
 * `contain` rather than `cover`, unlike the card above it: cropping is fine
 * for a thumbnail that only has to say "there's a photo here", and wrong for
 * the one view whose whole job is the row of digits at the bottom.
 */
function ReceiptViewer({
  url,
  author,
  open,
  onClose,
}: {
  url: string;
  author: string;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={open} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-bezel/95">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          className="flex-1 items-center justify-center px-4"
        >
          <Image
            source={{ uri: url }}
            style={{ width: '100%', height: '80%' }}
            resizeMode="contain"
            accessibilityLabel={`Receipt from ${author}`}
          />
        </Pressable>

        <View className="items-center pb-10">
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            className={`min-h-11 justify-center rounded-full bg-paper px-6 ${pressSmall}`}
          >
            <Text className="font-ui-bold text-sm text-ink">Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
