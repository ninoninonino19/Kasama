import * as ImagePicker from 'expo-image-picker';

import { decodeBase64 } from '../lib/base64';
import { supabase } from '../lib/supabase';

const BUCKET = 'receipts';

/** Mirrors the bucket's own limit, so an oversized pick fails here, not after the upload. */
const MAX_BYTES = 6 * 1024 * 1024;

/**
 * How long a receipt's link stays good for.
 *
 * The bucket is private, so every image on the board is viewed through a URL
 * signed at fetch time. An hour is comfortably longer than anyone spends
 * reading a board and short enough that a link pasted somewhere it shouldn't
 * be stops working — which is the reason for a private bucket in the first
 * place. The board re-signs on every load, so nobody ever waits for one to
 * expire.
 */
export const RECEIPT_URL_TTL_SECONDS = 60 * 60;

export class ReceiptError extends Error {}

export type PickedReceipt = {
  /** Local file URI, for the preview before it is sent anywhere. */
  uri: string;
  bytes: Uint8Array;
  contentType: string;
};

/**
 * Lets someone choose a photo of a receipt, without uploading it yet.
 *
 * Picking and uploading are separate on purpose. A note is written, re-read
 * and often abandoned, and uploading on pick would leave the bucket full of
 * receipts for notes nobody posted — with no row anywhere pointing at them to
 * clean up by. The bytes ride in memory until the note is actually saved.
 *
 * No crop step, unlike the avatar picker: the useful part of a statement of
 * account is the small print at the bottom, and an editor that opens on a
 * square is an invitation to cut it off.
 */
export async function pickReceipt(): Promise<PickedReceipt | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new ReceiptError(
      'Kasama needs access to your photos to pin a receipt. You can turn it on in Settings.'
    );
  }

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    // Higher than the avatar picker's 0.7. A receipt is read, not looked at,
    // and JPEG artefacts land hardest on exactly the thing being read.
    quality: 0.85,
    base64: true,
  });

  if (picked.canceled) return null;

  const asset = picked.assets[0];
  if (!asset?.base64) throw new ReceiptError("That image couldn't be read. Try another one.");

  const bytes = decodeBase64(asset.base64);
  if (bytes.byteLength > MAX_BYTES) {
    throw new ReceiptError('That photo is too large — the limit is 6MB.');
  }

  return { uri: asset.uri, bytes, contentType: asset.mimeType ?? 'image/jpeg' };
}

/**
 * Takes the camera roll photo picked above, and lets someone shoot one instead.
 *
 * Same contract, different door: most receipts are photographed on the spot,
 * and making people leave the app, take a picture and come back is most of the
 * reason a feature like this goes unused.
 */
export async function captureReceipt(): Promise<PickedReceipt | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new ReceiptError(
      'Kasama needs access to your camera to take a photo of a receipt. You can turn it on in Settings.'
    );
  }

  const shot = await ImagePicker.launchCameraAsync({ quality: 0.85, base64: true });
  if (shot.canceled) return null;

  const asset = shot.assets[0];
  if (!asset?.base64) throw new ReceiptError("That photo couldn't be read. Try again.");

  const bytes = decodeBase64(asset.base64);
  if (bytes.byteLength > MAX_BYTES) {
    throw new ReceiptError('That photo is too large — the limit is 6MB.');
  }

  return { uri: asset.uri, bytes, contentType: asset.mimeType ?? 'image/jpeg' };
}

/**
 * Puts a picked receipt in the bucket and hands back its storage path.
 *
 * The `<household>/<user>/…` layout is load-bearing rather than tidy: the
 * storage policies read both segments straight out of the object name — the
 * first decides which house may see it, the second which person may replace or
 * remove it. See the board_receipts migration.
 */
export async function uploadReceipt(
  householdId: string,
  userId: string,
  receipt: PickedReceipt
): Promise<string> {
  const extension = receipt.contentType === 'image/png' ? 'png' : 'jpg';
  const path = `${householdId}/${userId}/${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, receipt.bytes, { contentType: receipt.contentType, upsert: false });

  if (error) throw error;
  return path;
}

/**
 * Signs a batch of receipt paths for display.
 *
 * One call for the whole page rather than one per note: a board of thirty
 * notes would otherwise open thirty requests before it could draw. A path that
 * fails to sign comes back missing rather than throwing — a receipt whose file
 * has gone should cost that note its picture, not the whole board.
 */
export async function signReceipts(paths: string[]): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  const unique = [...new Set(paths)];
  if (unique.length === 0) return signed;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(unique, RECEIPT_URL_TTL_SECONDS);

  if (error) return signed;

  for (const row of data ?? []) {
    if (row.signedUrl && row.path) signed.set(row.path, row.signedUrl);
  }

  return signed;
}

/**
 * Removes a receipt's file. Best-effort by design — see `removeOlderAvatars`
 * for the same reasoning: by the time this runs the note is already gone or
 * already points somewhere else, so a failure here leaves a few unreferenced
 * kilobytes rather than a broken screen.
 */
export async function deleteReceipt(path: string): Promise<void> {
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    // An orphaned file costs a few kilobytes; a thrown error costs the edit.
  }
}
