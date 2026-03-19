import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve('apps/web/.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
  console.log('🔍 Verifying seed data...\n');

  const tables = [
    { name: 'profiles', query: supabase.from('profiles').select('id, username, display_name, profile_type, is_featured, follower_count', { count: 'exact' }) },
    { name: 'articles', query: supabase.from('articles').select('id, slug, content_vertical, title_zh', { count: 'exact' }).eq('editorial_status', 'published') },
    { name: 'businesses', query: supabase.from('businesses').select('id, slug, display_name_zh, avg_rating', { count: 'exact' }).eq('is_active', true) },
    { name: 'forum_threads', query: supabase.from('forum_threads').select('id, slug, title, reply_count', { count: 'exact' }).eq('status', 'published') },
    { name: 'forum_replies', query: supabase.from('forum_replies').select('id, body', { count: 'exact' }) },
    { name: 'events', query: supabase.from('events').select('id, slug, title_zh', { count: 'exact' }).eq('status', 'published') },
    { name: 'voice_posts', query: supabase.from('voice_posts').select('id, slug, title, post_type', { count: 'exact' }).eq('status', 'published') },
    { name: 'reviews', query: supabase.from('reviews').select('id, title, rating', { count: 'exact' }).eq('status', 'approved') },
    { name: 'categories', query: supabase.from('categories').select('id, slug, type', { count: 'exact' }) },
    { name: 'regions', query: supabase.from('regions').select('id, slug, name_zh', { count: 'exact' }) },
  ];

  for (const t of tables) {
    const { data, count, error } = await t.query;
    if (error) { console.log(`❌ ${t.name}: ${error.message}`); continue; }
    console.log(`✅ ${t.name}: ${count} rows`);
    if (data && data.length > 0 && count <= 15) {
      data.forEach(r => {
        const label = r.display_name || r.display_name_zh || r.title_zh || r.title || r.name_zh || r.slug || r.body?.slice(0,30);
        const extra = r.profile_type || r.content_vertical || r.post_type || r.type || '';
        console.log(`   - ${label} ${extra ? `(${extra})` : ''}`);
      });
    }
  }
}

verify().catch(console.error);
