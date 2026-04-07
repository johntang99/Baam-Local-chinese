// Guard against placeholder names accidentally scraped from map widgets.
const INVALID_NAME_PATTERNS = [
  /点击查看地图/i,
  /^查看地图$/i,
  /^地图$/i,
  /click to view map/i,
  /^view map$/i,
  /^map$/i,
  /google\s*map/i,
];

export function isValidBusinessName(name: unknown): name is string {
  if (typeof name !== 'string') return false;
  const normalized = name.trim();
  if (!normalized || normalized.length < 2) return false;
  return !INVALID_NAME_PATTERNS.some((p) => p.test(normalized));
}

export function pickBusinessDisplayName(
  biz: { display_name_zh?: unknown; name_zh?: unknown; display_name?: unknown; name?: unknown } | null | undefined,
  fallback = '商家',
): string {
  if (!biz) return fallback;
  const candidates = [biz.display_name_zh, biz.name_zh, biz.display_name, biz.name];
  for (const candidate of candidates) {
    if (isValidBusinessName(candidate)) return candidate.trim();
  }
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return fallback;
}
