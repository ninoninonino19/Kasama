import * as ImagePicker from 'expo-image-picker';

import { decodeBase64 } from '../lib/base64';
import { supabase } from '../lib/supabase';

const BUCKET = 'avatars';

/** Mirrors the bucket's own limit, so an oversized pick fails here, not after the upload. */
const MAX_BYTES = 2 * 1024 * 1024;

export class AvatarError extends Error {}

/**
 * Lets someone choose a photo and puts it behind their `profiles.avatar_url`.
 *
 * Returns the new public URL, or `null` if the picker was dismissed — a
 * cancelled pick isn't a failure and shouldn't surface as one.
 *
 * The picker crops to a square before upload: every Avatar in the app is a
 * circle, so a portrait photo would be centre-cropped by the renderer anyway,
 * and doing it here means the person choosing decides which part survives.
 */
export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new AvatarError(
      'Kasama needs access to your photos to pick one. You can turn it on in Settings.'
    );
  }

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
    base64: true,
  });

  if (picked.canceled) return null;

  const asset = picked.assets[0];
  if (!asset?.base64) throw new AvatarError("That image couldn't be read. Try another one.");

  const bytes = decodeBase64(asset.base64);
  if (bytes.byteLength > MAX_BYTES) {
    throw new AvatarError('That image is too large — the limit is 2MB.');
  }

  // The first path segment is what the storage policy checks against
  // auth.uid(), so this layout is load-bearing, not cosmetic. The timestamp
  // gives each upload a fresh URL, which is what defeats image caches that
  // would otherwise keep showing the old face.
  const path = `${userId}/${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });

  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', userId);

  if (profileError) throw profileError;

  await removeOlderAvatars(userId, path);
  return publicUrl;
}

/** Clears `avatar_url` and removes every file the user has in the bucket. */
export async function removeAvatar(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', userId);

  if (error) throw error;
  await removeOlderAvatars(userId, null);
}

/**
 * Deletes everything in the user's folder except the file just uploaded.
 *
 * Best-effort on purpose: the profile already points at the new avatar by the
 * time this runs, so a failure here leaves an orphaned file rather than a
 * broken picture, and that is not worth failing the upload over.
 */
async function removeOlderAvatars(userId: string, keep: string | null): Promise<void> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).list(userId);
    if (error || !data) return;

    const stale = data
      .map((file) => `${userId}/${file.name}`)
      .filter((path) => path !== keep);

    if (stale.length > 0) await supabase.storage.from(BUCKET).remove(stale);
  } catch {
    // An orphaned file costs a few kilobytes; a thrown error costs the upload.
  }
}
