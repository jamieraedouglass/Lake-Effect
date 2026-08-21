const ALLOWED_HOSTS = (process.env.ALLOWED_ORIGINS ?? 'leffect.com,www.leffect.com')
  .split(',')
  .map(h => h.trim().toLowerCase())
  .filter(Boolean);

const buckets = new Map();

function hostOf(value) {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

export function sameSite(request) {
  const origin = request.headers.get('origin');
  const host = origin ? hostOf(origin) : hostOf(request.headers.get('referer') ?? '');

  if (!host) return false;
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) return true;
  if (host.endsWith('.vercel.app')) return true;
  return ALLOWED_HOSTS.some(allowed => host === allowed);
}

export function clientKey(request) {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  return forwarded.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
}

export function overLimit(key, { max, windowMs }) {
  const now = Date.now();

  for (const [k, hits] of buckets) {
    const live = hits.filter(t => now - t < windowMs);
    if (live.length) buckets.set(k, live);
    else buckets.delete(k);
  }

  const hits = (buckets.get(key) ?? []).filter(t => now - t < windowMs);
  if (hits.length >= max) return true;

  hits.push(now);
  buckets.set(key, hits);
  return false;
}
