import type { TapeColor } from '../lib/database.types';
import { supabase } from '../lib/supabase';
import type { AnnouncementWithAuthor } from '../types';

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
  return (data ?? []) as unknown as AnnouncementWithAuthor[];
}

export async function postAnnouncement(
  householdId: string,
  userId: string,
  content: string,
  tapeColor: TapeColor
): Promise<AnnouncementWithAuthor> {
  const { data, error } = await supabase
    .from('announcements')
    .insert({
      household_id: householdId,
      user_id: userId,
      content: content.trim(),
      tape_color: tapeColor,
    })
    .select('*, profile:profiles(*)')
    .single();

  if (error) throw error;
  return data as unknown as AnnouncementWithAuthor;
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
 */
export async function updateAnnouncement(
  id: string,
  content: string,
  tapeColor: TapeColor
): Promise<void> {
  const { error } = await supabase
    .from('announcements')
    .update({ content: content.trim(), tape_color: tapeColor })
    .eq('id', id);

  if (error) throw error;
}

export async function fetchAnnouncement(id: string): Promise<AnnouncementWithAuthor | null> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*, profile:profiles(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as unknown as AnnouncementWithAuthor | null;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw error;
}
