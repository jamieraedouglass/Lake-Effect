import { sameSite, clientKey, atLimit, recordHit } from './guard.ts';
import { handleRequest } from './_adapter.ts';

const TO = 'rob@leffect.com';
const FROM = 'Lake Effect Site <inquiries@leffect.com>';
type FieldName = 'first_name' | 'last_name' | 'email' | 'phone'
  | 'project_type' | 'location' | 'budget' | 'message';

const LIMITS: Record<FieldName, number> = {
  first_name: 80, last_name: 80, email: 160, phone: 40,
  project_type: 80, location: 120, budget: 60, message: 4000,
};

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

const escapeHtml = (value: string): string =>
  String(value).replace(/[&<>"']/g, character => HTML_ESCAPES[character] ?? character);

async function contact(request: Request): Promise<Response> {
  if (request.method === 'GET') {
    return json({
      ok: true,
      keyConfigured: Boolean(process.env['LE_RESEND_API_KEY'] ?? process.env['RESEND_API_KEY']),
      keyName: process.env['LE_RESEND_API_KEY'] ? 'LE_RESEND_API_KEY'
        : process.env['RESEND_API_KEY'] ? 'RESEND_API_KEY' : null,
      from: FROM,
      to: TO,
      commit: process.env['VERCEL_GIT_COMMIT_SHA']?.slice(0, 7) ?? null,
    });
  }

  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  if (!sameSite(request)) return json({ error: 'forbidden' }, 403);
  const LIMIT = { max: 4, windowMs: 600_000 };
  const visitor = clientKey(request);
  if (atLimit(visitor, LIMIT)) return json({ error: 'busy' }, 429);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400);
  }

  if (typeof body.company === 'string' && body.company.trim()) {
    return json({ ok: true });
  }

  const field = (name: FieldName): string => {
    const value = body[name];
    return typeof value === 'string' ? value.trim().slice(0, LIMITS[name]) : '';
  };

  const first = field('first_name');
  const last = field('last_name');
  const email = field('email');

  if (!first || !last) return json({ error: 'Name is required.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'A valid email is required.' }, 400);

  const apiKey = process.env['LE_RESEND_API_KEY'] ?? process.env['RESEND_API_KEY'];
  if (!apiKey) return json({ error: 'not_configured' }, 503);

  recordHit(visitor, LIMIT);

  const rows: Array<[string, string]> = [
    ['Name', `${first} ${last}`],
    ['Email', email],
    ['Phone', field('phone')],
    ['Project type', field('project_type')],
    ['Location', field('location')],
    ['Budget', field('budget')],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  const message = field('message');

  const text = [
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    message || '(no message)',
  ].join('\n');

  const html = [
    '<table style="font:14px/1.6 -apple-system,Segoe UI,sans-serif;border-collapse:collapse">',
    ...rows.map(([k, v]) =>
      `<tr><td style="padding:4px 16px 4px 0;color:#666">${escapeHtml(k)}</td>` +
      `<td style="padding:4px 0"><strong>${escapeHtml(v)}</strong></td></tr>`),
    '</table>',
    `<p style="font:14px/1.7 -apple-system,Segoe UI,sans-serif;white-space:pre-wrap">${escapeHtml(message || '(no message)')}</p>`,
  ].join('');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: email,
        subject: `New project inquiry — ${first} ${last}`,
        text,
        html,
      }),
    });

    if (!res.ok) {
      console.error('resend', res.status, await res.text());
      return json({ error: 'failed' }, 502);
    }
    return json({ ok: true });
  } catch (error) {
    console.error('contact:', error);
    return json({ error: 'failed' }, 502);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export default handleRequest(contact);
