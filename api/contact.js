import { sameSite, clientKey, overLimit } from './guard.js';

const TO = 'rob@leffect.com';
const FROM = 'Lake Effect Site <inquiries@leffect.com>';
const LIMITS = { first_name: 80, last_name: 80, email: 160, phone: 40,
  project_type: 80, location: 120, budget: 60, message: 4000 };

const escapeHtml = v => String(v).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  if (!sameSite(request)) return json({ error: 'forbidden' }, 403);
  if (overLimit(clientKey(request), { max: 4, windowMs: 600_000 })) return json({ error: 'busy' }, 429);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400);
  }

  if (typeof body.company === 'string' && body.company.trim()) {
    return json({ ok: true });
  }

  const field = name => {
    const v = body[name];
    return typeof v === 'string' ? v.trim().slice(0, LIMITS[name]) : '';
  };

  const first = field('first_name');
  const last = field('last_name');
  const email = field('email');

  if (!first || !last) return json({ error: 'Name is required.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'A valid email is required.' }, 400);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return json({ error: 'not_configured' }, 503);

  const rows = [
    ['Name', `${first} ${last}`],
    ['Email', email],
    ['Phone', field('phone')],
    ['Project type', field('project_type')],
    ['Location', field('location')],
    ['Budget', field('budget')],
  ].filter(([, v]) => v);

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
    console.error(error);
    return json({ error: 'failed' }, 502);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
