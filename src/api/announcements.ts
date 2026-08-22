import type { TapeColor } from '../lib/database.types';
import { supabase } from '../lib/supabase';
import type { AnnouncementWithAuthor } from '../types';
import { deleteReceipt, signReceipts } from './receipts';

/**
 * The board, pinned notes first.
 *
 * Receipts are signed here rather than at render time. The bucket is private,
 * so `image_path` is not something an `<Image>` can load — it has to become a
 * signed URL first, and doing that per card would mean thirty requests before
 * a board of thirty notes could draw, plus a re-sign on every re-render. One
 * batched call per page, attached to the rows on the way past.
 */
export async function fetchAnnouncements(
  householdId: string,
  limit = 50
): Promise<AnnouncementWithAuthor[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*, profile:profiles(*)')
    .eq('household_id', householdId)
    // Pinned notes lead the board, then newest first — the same order the
    // announcements_board_order_idx index is built for.
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const notes = (data ?? []) as unknown as AnnouncementWithAuthor[];
  return withSignedReceipts(notes);
}

/** Attaches a viewable URL to every note that carries a receipt. */
async function withSignedReceipts(
  notes: AnnouncementWithAuthor[]
): Promise<AnnouncementWithAuthor[]> {
  const paths = notes
    .map((note) => note.image_path)
    .filter((path): path is string => Boolean(path));

  if (paths.length === 0) return notes;

  const signed = await signReceipts(paths);
  return notes.map((note) => ({
    ...note,
    imageUrl: note.image_path ? (signed.get(note.image_path) ?? null) : null,
  }));
}

export async function postAnnouncement(
  householdId: string,
  userId: string,
  content: string,
  tapeColor: TapeColor,
  imagePath: string | null = null
): Promise<AnnouncementWithAuthor> {
  const { data, error } = await supabase
    .from('announcements')
    .insert({
      household_id: householdId,
      user_id: userId,
      content: content.trim(),
      tape_color: tapeColor,
      image_path: imagePath,
    })
    .select('*, profile:profiles(*)')
    .single();

  if (error) {
    // The file went up before the row that points at it, so nothing else will
    // ever find it if the row didn't land.
    if (imagePath) await deleteReceipt(imagePath);
    throw error;
  }

  const note = data as unknown as AnnouncementWithAuthor;
  const [signed] = await withSignedReceipts([note]);
  return signed;
}

/**
 * Pins a note to the top of the board, or takes it back down.
 *
 * Goes through an RPC rather than a direct update because anyone in the
 * household can pin, while only the author can edit — see the migration for
 * why those two can't share one policy.
 */
export async function setAnnouncementPinned(id: string, pinned: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_announcement_pinned', {
    announcement_id: id,
    pinned,
  });
  if (error) throw error;
}

/**
 * Rewrites a note. The `announcements update own` policy limits this to its
 * author — an admin can take someone's note *down*, but not put different
 * words under their name.
 *
 * `previousImagePath` is what the note carried before this edit. Its file is
 * cleaned up only once the row has stopped pointing at it, and only when the
 * edit actually changed it — an edit that leaves the receipt alone passes the
 * same path in both places and nothing is deleted.
 */
export async function updateAnnouncement(
  id: string,
  content: string,
  tapeColor: TapeColor,
  imagePath: string | null = null,
  previousImagePath: string | null = null
): Promise<void> {
  const { error } = await supabase
    .from('announcements')
    .update({ content: content.trim(), tape_color: tapeColor, image_path: imagePath })
    .eq('id', id);

  if (error) {
    // Same trade as posting: a newly uploaded receipt the row never took.
    if (imagePath && imagePath !== previousImagePath) await deleteReceipt(imagePath);
    throw error;
  }

  if (previousImagePath && previousImagePath !== imagePath) {
    await deleteReceipt(previousImagePath);
  }
}

export async function fetchAnnouncement(id: string): Promise<AnnouncementWithAuthor | null> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*, profile:profiles(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const [note] = await withSignedReceipts([data as unknown as AnnouncementWithAuthor]);
  return note;
}

/**
 * Takes a note down, and its receipt with it.
 *
 * The file goes after the row, not before: a delete that failed halfway would
 * otherwise leave a note on the board with a picture that no longer loads,
 * which is worse than a file nobody references.
 */
export async function deleteAnnouncement(
  id: string,
  imagePath: string | null = null
): Promise<void> {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw error;
  if (imagePath) await deleteReceipt(imagePath);
}
