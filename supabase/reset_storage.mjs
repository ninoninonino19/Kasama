#!/usr/bin/env node
/**
 * Empties Kasama's storage buckets, through the Storage API.
 *
 * This is the other half of supabase/reset_data.sql. Storage objects are rows
 * pointing at files, so Supabase blocks `delete from storage.objects` — the
 * row would go and the file would be stranded. The Storage API removes both,
 * which is what the error message asks for.
 *
 * Two buckets, laid out differently, which is why the walk below recurses
 * rather than doing the two fixed passes this script had when `avatars` was
 * the only one:
 *
 *   avatars    <user id>/<timestamp>.jpg
 *   receipts   <household id>/<user id>/<timestamp>.jpg
 *
 * `list` does not recurse and does not say outright whether an entry is a
 * folder — a real file has an `id`, a folder placeholder doesn't, and that is
 * the only reliable way to tell them apart.
 *
 *   DESTRUCTIVE. Every profile photo and every board receipt in the project is
 *   deleted. There is no undo. Point it at a development project.
 *
 * Usage — the service role key, not the anon key, since this deletes other
 * people's files (dashboard: Project Settings -> API):
 *
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJhbGci... \
 *   node supabase/reset_storage.mjs
 *
 * Add a bucket name to clear just one:
 *
 *   node supabase/reset_storage.mjs receipts
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n' +
      'The anon key will not do — removing another user\'s file is blocked by the\n' +
      'storage policies, which scope writes to your own folder.'
  );
  process.exit(1);
}

const ALL_BUCKETS = ['avatars', 'receipts'];
const PAGE = 100;

const requested = process.argv.slice(2);
const unknown = requested.filter((name) => !ALL_BUCKETS.includes(name));
if (unknown.length > 0) {
  console.error(`Unknown bucket(s): ${unknown.join(', ')}. Known: ${ALL_BUCKETS.join(', ')}.`);
  process.exit(1);
}

const buckets = requested.length > 0 ? requested : ALL_BUCKETS;
const client = createClient(url, key, { auth: { persistSession: false } });

/** One page at a time — `list` caps out, and a busy project can exceed it. */
async function listPage(storage, prefix) {
  const items = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await storage.list(prefix, { limit: PAGE, offset });
    if (error) throw error;
    if (!data || data.length === 0) return items;
    items.push(...data);
    if (data.length < PAGE) return items;
  }
}

/**
 * Every file at or below `prefix`, as full paths.
 *
 * Depth isn't hardcoded, so this keeps working if a bucket's layout gains a
 * level — which is exactly what happened when receipts arrived and this script
 * was still assuming the avatars' one-folder-per-user shape.
 */
async function listFiles(storage, prefix = '') {
  const entries = await listPage(storage, prefix);
  const files = [];

  for (const entry of entries) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    // An entry with no `id` is a folder placeholder, not a real object.
    if (entry.id === null) files.push(...(await listFiles(storage, path)));
    else files.push(path);
  }

  return files;
}

let failed = false;

for (const bucket of buckets) {
  const storage = client.storage.from(bucket);

  let paths;
  try {
    paths = await listFiles(storage);
  } catch (error) {
    console.error(`${bucket}: could not be listed — ${error.message}`);
    failed = true;
    continue;
  }

  if (paths.length === 0) {
    console.log(`${bucket}: already empty.`);
    continue;
  }

  // `remove` takes a bounded list, so a project with thousands of receipts
  // goes in batches rather than one request that quietly truncates.
  let removed = 0;
  for (let at = 0; at < paths.length; at += PAGE) {
    const batch = paths.slice(at, at + PAGE);
    const { error } = await storage.remove(batch);
    if (error) {
      console.error(`${bucket}: failed to remove ${batch.length} file(s) — ${error.message}`);
      failed = true;
      continue;
    }
    removed += batch.length;
  }

  const left = await listFiles(storage);
  console.log(
    left.length === 0
      ? `${bucket}: removed ${removed} file(s), now empty.`
      : `${bucket}: removed ${removed} file(s), ${left.length} still listed — re-run if that is unexpected.`
  );
}

if (failed) process.exitCode = 1;
