/**
 * Harvest public emails from business websites (mailto: + JSON-LD schema.org).
 *
 * By default tries **homepage** first, then common **contact** paths:
 * `/contact`, `/contact-us`, `/contact_us`, `/contactus`, `/about`, `/about-us`.
 * Use `--home-only` to fetch only the homepage (faster, lower coverage).
 *
 * Google Places (New) does not expose business email — this is the fastest
 * zero-extra-API path if you already have website_url (~65% of listings).
 *
 * Usage:
 *   npx tsx scripts/harvest-emails-from-websites.ts
 *   npx tsx scripts/harvest-emails-from-websites.ts --apply --limit=200
 *   npx tsx scripts/harvest-emails-from-websites.ts --apply --home-only
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const args = process.argv.slice(2);
const applyChanges = args.includes('--apply');
const homeOnly = args.includes('--home-only');
const limitArg = parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '0') || 0;
const delayMs = parseInt(args.find((a) => a.startsWith('--delay-ms='))?.split('=')[1] || '0') || 300;

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

type AnyRow = Record<string, any>;
const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

async function supaGet(path: string): Promise<AnyRow[]> {
  const out: AnyRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}&limit=1000&offset=${offset}`, { headers: H });
    if (!res.ok) throw new Error(`Supabase GET ${res.status}`);
    const batch = await res.json();
    out.push(...batch);
    if (batch.length < 1000) break;
  }
  return out;
}

async function supaPatch(id: string, email: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/businesses?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(`PATCH ${res.status}: ${(await res.text()).slice(0, 120)}`);
}

function isGarbageLocalPart(local: string): boolean {
  const l = local.toLowerCase();
  return (
    l.startsWith('noreply') ||
    l.startsWith('no-reply') ||
    l.startsWith('donotreply') ||
    l.includes('example.com') ||
    l === 'email' ||
    l === 'your-email'
  );
}

function normalizeMailto(m: string): string | null {
  let s = m.replace(/^mailto:/i, '').split('?')[0].trim();
  try {
    s = decodeURIComponent(s.replace(/\+/g, '%20'));
  } catch { /* keep s */ }
  const at = s.indexOf('@');
  if (at < 1) return null;
  const local = s.slice(0, at);
  if (isGarbageLocalPart(local)) return null;
  const addr = s.toLowerCase();
  return EMAIL_RE.test(addr) ? addr : null;
}

function extractFromLdJson(obj: any): string | null {
  if (!obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    for (const x of obj) {
      const e = extractFromLdJson(x);
      if (e) return e;
    }
    return null;
  }
  const em = obj.email;
  const list = Array.isArray(em) ? em : em ? [em] : [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const addr = item.trim().toLowerCase();
    if (!EMAIL_RE.test(addr)) continue;
    const local = addr.split('@')[0] || '';
    if (isGarbageLocalPart(local)) continue;
    return addr;
  }
  if (obj['@graph']) {
    const e = extractFromLdJson(obj['@graph']);
    if (e) return e;
  }
  return null;
}

function pickEmailFromHtml(html: string): string | null {
  const mailtoRe = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  let m: RegExpExecArray | null;
  while ((m = mailtoRe.exec(html)) !== null) {
    const addr = normalizeMailto(m[0]);
    if (addr) return addr;
  }

  const ldRe =
    /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  while ((m = ldRe.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1].trim());
      const addr = extractFromLdJson(data);
      if (addr) return addr;
    } catch {
      /* invalid JSON-LD */
    }
  }
  return null;
}

function normalizeUrl(raw: string): string | null {
  let u = raw.trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const parsed = new URL(u);
    if (!parsed.hostname || parsed.hostname.length < 3) return null;
    return parsed.origin + '/';
  } catch {
    return null;
  }
}

/** Ordered list of paths to try after homepage (same origin). */
const CONTACT_PATHS = [
  '/contact',
  '/contact-us',
  '/contact_us',
  '/contactus',
  '/about',
  '/about-us',
];

function urlsToFetch(siteRoot: string, homeOnlyFlag: boolean): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (u: string) => {
    if (!seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  };
  const root = siteRoot.endsWith('/') ? siteRoot : `${siteRoot}/`;
  push(root);
  if (homeOnlyFlag) return out;
  let origin: string;
  try {
    origin = new URL(root).origin;
  } catch {
    return out;
  }
  for (const p of CONTACT_PATHS) push(`${origin}${p}`);
  return out;
}

async function fetchPage(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'BaamLocalBot/1.0 (contact enrichment)',
      },
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.length > 800_000 ? text.slice(0, 800_000) : text;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type FindResult = { email: string; from: 'home' | 'contact' };

async function scanSite(
  siteRoot: string,
  homeOnlyFlag: boolean,
): Promise<{ found: FindResult | null; anyLoaded: boolean }> {
  const urls = urlsToFetch(siteRoot, homeOnlyFlag);
  let anyLoaded = false;
  for (let i = 0; i < urls.length; i++) {
    const html = await fetchPage(urls[i]);
    if (html) anyLoaded = true;
    if (html) {
      const email = pickEmailFromHtml(html);
      if (email) {
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        return { found: { email, from: i === 0 ? 'home' : 'contact' }, anyLoaded };
      }
    }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  }
  return { found: null, anyLoaded };
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('📧 Harvest emails from websites (mailto + JSON-LD)');
  console.log(
    `   Pages: ${homeOnly ? 'homepage only (--home-only)' : `homepage + ${CONTACT_PATHS.length} extra paths`}`,
  );
  console.log(`   Mode: ${applyChanges ? '✅ APPLY' : '👀 DRY RUN'}\n`);

  const rows = await supaGet(
    'businesses?is_active=eq.true&website_url=not.is.null&select=id,display_name,website_url,email&order=id',
  );
  const todo = rows.filter((b) => {
    const w = String(b.website_url || '').trim();
    const e = String(b.email || '').trim();
    return w.length > 0 && e.length === 0 && normalizeUrl(w);
  });

  const toProcess = limitArg ? todo.slice(0, limitArg) : todo;
  console.log(`   Have website, no email: ${todo.length}  |  Processing: ${toProcess.length}\n`);

  let found = 0, foundHome = 0, foundContact = 0, noMatch = 0, fetchFail = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const b = toProcess[i];
    const label = (b.display_name || b.id).slice(0, 40);
    process.stdout.write(`  [${i + 1}/${toProcess.length}] ${label.padEnd(42)} `);

    const base = normalizeUrl(b.website_url);
    if (!base) {
      console.log('skip bad URL');
      fetchFail++;
      continue;
    }

    const { found: hit, anyLoaded } = await scanSite(base, homeOnly);

    if (!anyLoaded) {
      fetchFail++;
      console.log('fetch fail (no page loaded)');
      continue;
    }

    if (hit) {
      found++;
      if (hit.from === 'home') foundHome++;
      else foundContact++;
      console.log(`→ ${hit.email} (${hit.from === 'home' ? 'home' : 'contact'})`);
      if (applyChanges) await supaPatch(b.id, hit.email);
    } else {
      noMatch++;
      console.log('— no mailto / schema email');
    }
  }

  console.log('\n' + '═'.repeat(56));
  console.log(`  ✅ Email found: ${found} (homepage: ${foundHome}, contact/about: ${foundContact})`);
  console.log(`  —  No match:   ${noMatch}`);
  console.log(`  ⚠️  Fetch fail: ${fetchFail}`);
  if (!applyChanges) console.log('\n  👀 DRY RUN — add --apply to save');
  console.log('═'.repeat(56));
}

main().catch(console.error);
