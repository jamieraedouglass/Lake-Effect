import type { RateLimit } from './_types.ts';

const ALLOWED_HOSTS = (process.env['ALLOWED_ORIGINS'] ?? 'leffect.com,www.leffect.com')
  .split(',')
  .map(host => host.trim().toLowerCase())
  .filter(Boolean);

const buckets = new Map<string, number[]>();

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

export function atLimit(key: string, { max, windowMs }: RateLimit): boolean {
  prune(windowMs);
  const hits = (buckets.get(key) ?? []).filter(at => Date.now() - at < windowMs);
  return hits.length >= max;
}

export function recordHit(key: string, { windowMs }: RateLimit): void {
  const hits = (buckets.get(key) ?? []).filter(at => Date.now() - at < windowMs);
  hits.push(Date.now());
  buckets.set(key, hits);
}
