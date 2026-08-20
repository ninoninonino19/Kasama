#!/usr/bin/env node
/**
 * Empties the `avatars` bucket, through the Storage API.
 *
 * This is the other half of supabase/reset_data.sql. Storage objects are rows
 * pointing at files, so Supabase blocks `delete from storage.objects` — the
 * row would go and the file would be stranded. The Storage API removes both,
 * which is what the error message asks for.
 *
 * Avatars are stored as `<user id>/<timestamp>.jpg`, so the bucket is one
 * folder per user. `list` does not recurse, hence the two passes.
 *
 *   DESTRUCTIVE. Every profile photo in the project is deleted. There is no
 *   undo. Point it at a development project.
 *
 * Usage — the service role key, not the anon key, since this deletes other
 * people's files (dashboard: Project Settings -> API):
 *
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJhbGci... \
 *   node supabase/reset_avatars.mjs
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n' +
      'The anon key will not do — removing another user\'s avatar is blocked by\n' +
      'the storage policy, which scopes writes to your own folder.'
  );
  process.exit(1);
}

const BUCKET = 'avatars';
const PAGE = 100;

const storage = createClient(url, key, { auth: { persistSession: false } }).storage.from(BUCKET);

/** One page at a time — `list` caps out, and a busy project can exceed it. */
async function listAll(prefix) {
  const items = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await storage.list(prefix, { limit: PAGE, offset });
    if (error) throw error;
    if (!data || data.length === 0) return items;
    items.push(...data);
    if (data.length < PAGE) return items;
  }
}

const folders = await listAll('');
if (folders.length === 0) {
  console.log('Nothing to do — the avatars bucket is already empty.');
  process.exit(0);
}

let removed = 0;

for (const folder of folders) {
  const files = await listAll(folder.name);
  // A folder entry with no children is a placeholder row, not a real file.
  const paths = files.filter((file) => file.id !== null).map((file) => `${folder.name}/${file.name}`);
  if (paths.length === 0) continue;

  const { error } = await storage.remove(paths);
  if (error) {
    console.error(`Failed to remove ${paths.length} file(s) under ${folder.name}:`, error.message);
    process.exitCode = 1;
    continue;
  }
  removed += paths.length;
}

const left = await listAll('');
console.log(`Removed ${removed} avatar file(s).`);
console.log(
  left.length === 0
    ? 'The avatars bucket is empty.'
    : `${left.length} folder entr${left.length === 1 ? 'y' : 'ies'} still listed — re-run if that is unexpected.`
);
