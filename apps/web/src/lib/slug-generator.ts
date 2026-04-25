/**
 * SEO-friendly slug generator
 * - Uses AI to translate Chinese titles to English slugs
 * - Appends MMDD date suffix for natural uniqueness (no DB queries)
 * - Only checks DB on the rare same-title-same-day collision
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

/**
 * Generate an SEO-friendly English slug from a Chinese (or English) title.
 * Uses GPT-4.1-nano for fast translation (~1s, ~$0.0001).
 */
async function translateToSlug(title: string): Promise<string> {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) return fallbackSlug(title);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: 'gpt-4.1-nano',
        max_tokens: 50,
        messages: [
          { role: 'system', content: 'Convert the given title to a short English URL slug. Output ONLY the slug, lowercase, words separated by hyphens, max 6 words. No quotes, no explanation.' },
          { role: 'user', content: title },
        ],
      }),
    });

    if (!response.ok) return fallbackSlug(title);
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '';

    const slug = raw
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);

    return slug.length >= 3 ? slug : fallbackSlug(title);
  } catch {
    return fallbackSlug(title);
  }
}

/**
 * Fallback: clean the title directly (English words or Chinese chars)
 */
function fallbackSlug(title: string): string {
  const englishWords = title.match(/[a-zA-Z]+/g);
  if (englishWords && englishWords.length >= 2) {
    return englishWords.join('-').toLowerCase().slice(0, 60);
  }
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .slice(0, 40);
}

/**
 * Get MMDD date suffix
 */
function dateSuffix(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${mm}${dd}`;
}

/**
 * Generate a unique, SEO-friendly slug.
 *
 * Format: {english-slug}-{MMDD}
 * Example: new-immigrant-guide-0425
 *
 * Only checks DB on same-title-same-day collision (rare).
 */
export async function generateSeoSlug(
  title: string,
  titleEn: string | null | undefined,
  supabase: SupabaseClient,
  table: 'articles' | 'voice_posts' | 'events' | 'classifieds' | 'deals' | 'businesses',
): Promise<string> {
  let baseSlug: string;

  if (titleEn && titleEn.trim().length >= 3) {
    baseSlug = titleEn
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
  } else {
    baseSlug = await translateToSlug(title);
  }

  const slug = `${baseSlug}-${dateSuffix()}`;

  // Check for same-day collision (rare — only when same title on same day)
  const { data } = await supabase.from(table).select('id').eq('slug', slug).limit(1);
  if (!data || data.length === 0) return slug;

  // Collision: append counter
  for (let i = 2; i <= 10; i++) {
    const candidate = `${slug}-${i}`;
    const { data: check } = await supabase.from(table).select('id').eq('slug', candidate).limit(1);
    if (!check || check.length === 0) return candidate;
  }

  return `${slug}-${Date.now().toString(36).slice(-4)}`;
}
