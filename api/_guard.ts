import type { RateLimit } from './_types.ts';

const ALLOWED_HOSTS = (process.env['ALLOWED_ORIGINS'] ?? 'leffect.com,www.leffect.com')
  .split(',')
  .map(host => host.trim().toLowerCase())
  .filter(Boolean);

const buckets = new Map<string, number[]>();

// Keep timestamps for as long as the longest window any caller uses.
const LONGEST_WINDOW_MS = 86_400_000;

function hostOf(value: string): string | null {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

export function sameSite(request: Request): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = hostOf(origin ?? '') ?? hostOf(referer ?? '');

  if (!host) return true;

  const self = hostOf(request.url);
  if (self && host === self) return true;
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) return true;
  if (host.endsWith('.vercel.app')) return true;
  return ALLOWED_HOSTS.includes(host);
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  return forwarded.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

function prune(windowMs: number): void {
  const now = Date.now();
  for (const [key, hits] of buckets) {
    const live = hits.filter(at => now - at < windowMs);
    if (live.length) buckets.set(key, live);
    else buckets.delete(key);
  }
}

/** True if any of the given windows is full. */
export function atAnyLimit(key: string, limits: RateLimit[]): boolean {
  return limits.some(limit => atLimit(key, limit));
}

/**
 * Record one hit. Every window reads the same bucket and counts the slice it
 * cares about, so this pushes a single timestamp however many windows there
 * are. Pushing per window would count each submission twice.
 */
export function recordHits(key: string, _limits: RateLimit[]): void {
  const hits = (buckets.get(key) ?? []).filter(at => Date.now() - at < LONGEST_WINDOW_MS);
  hits.push(Date.now());
  buckets.set(key, hits);
}

export function atLimit(key: string, { max, windowMs }: RateLimit): boolean {
  prune(LONGEST_WINDOW_MS);
  const hits = (buckets.get(key) ?? []).filter(at => Date.now() - at < windowMs);
  return hits.length >= max;
}

export function recordHit(key: string, { windowMs }: RateLimit): void {
  // One bucket per visitor holds every timestamp; each window counts the slice
  // it cares about. Recording once per window would double count.
  const hits = (buckets.get(key) ?? []).filter(at => Date.now() - at < LONGEST_WINDOW_MS);
  hits.push(Date.now());
  buckets.set(key, hits);
  void windowMs;
}
