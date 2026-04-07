export function decodeRouteSlug(rawSlug: string): string {
  try {
    return decodeURIComponent(rawSlug);
  } catch {
    return rawSlug;
  }
}

