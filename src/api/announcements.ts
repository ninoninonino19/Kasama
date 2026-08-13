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
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as unknown as AnnouncementWithAuthor[];
}

export async function postAnnouncement(
  householdId: string,
  userId: string,
  content: string
): Promise<AnnouncementWithAuthor> {
  const { data, error } = await supabase
    .from('announcements')
    .insert({ household_id: householdId, user_id: userId, content: content.trim() })
    .select('*, profile:profiles(*)')
    .single();

  if (error) throw error;
  return data as unknown as AnnouncementWithAuthor;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw error;
}
