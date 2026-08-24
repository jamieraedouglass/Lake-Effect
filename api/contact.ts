import { sameSite, clientKey, atAnyLimit, recordHits } from './_guard.ts';
import { handleRequest } from './_adapter.ts';

// Where inquiries land, and who they appear to come from. Both are settable
// without a deploy, because changing where a firm's post goes should not need
// one.
//
// The default From is on send.leffect.com because that is what Resend verifies.
// Verifying a subdomain keeps Resend's records clear of the MX and SPF carrying
// Rob's real mail on the apex, and Resend refuses to send from a domain it has
// not verified. DKIM signs as send.leffect.com and the From matches it, so
// DMARC aligns and the mail reaches an inbox rather than a spam folder.
//
// Before the DNS is in place, Resend still lets an account send from
// onboarding@resend.dev, but only to the address the account was opened with.
// Setting both variables to that pair gets the form working with no DNS at all.
const TO = process.env['LE_INQUIRY_TO'] ?? 'rob@leffect.com';
const FROM = process.env['LE_INQUIRY_FROM'] ?? 'Lake Effect Site <inquiries@send.leffect.com>';
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
  // A burst limit and a slow-drip limit: four in ten minutes stops a script,
  // twelve in a day stops someone patient.
  const LIMITS_BY_IP = [
    { max: 4, windowMs: 600_000 },
    { max: 12, windowMs: 86_400_000 },
  ];
  const visitor = clientKey(request);
  if (atAnyLimit(visitor, LIMITS_BY_IP)) return json({ error: 'busy' }, 429);

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
    if (typeof value !== 'string') return '';
    // Strip control characters: these values reach a subject line and an
    // email body, and a newline in the middle survives trim().
    return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, LIMITS[name]);
  };

  const first = field('first_name');
  const last = field('last_name');
  const email = field('email');

  if (!first || !last) return json({ error: 'Name is required.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'A valid email is required.' }, 400);
  // The browser enforces these too, but a scripted POST does not use a browser.
  const projectType = field('project_type');
  const location = field('location');
  const message = field('message');
  if (!projectType) return json({ error: 'A project type is required.' }, 400);
  if (!location) return json({ error: 'A project location is required.' }, 400);
  if (message.length < 10) return json({ error: 'Tell us a little about the project.' }, 400);

  const apiKey = process.env['LE_RESEND_API_KEY'] ?? process.env['RESEND_API_KEY'];
  if (!apiKey) return json({ error: 'not_configured' }, 503);

  recordHits(visitor, LIMITS_BY_IP);

  const rows: Array<[string, string]> = [
    ['Name', `${first} ${last}`],
    ['Email', email],
    ['Phone', field('phone')],
    ['Project type', projectType],
    ['Location', location],
    ['Budget', field('budget')],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));


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

  const sendEmail = async (): Promise<void> => {
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
        subject: `New project inquiry from ${first} ${last}`,
        text,
        html,
      }),
    });
    if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
  };

  const sheetHook = process.env['LE_SHEET_WEBHOOK_URL'];

  const appendToSheet = async (): Promise<void> => {
    if (!sheetHook) return;
    const hook = sheetHook;
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        receivedAt: new Date().toISOString(),
        first,
        last,
        email,
        phone: field('phone'),
        projectType,
        location,
        budget: field('budget'),
        message,
      }),
    });
    if (!res.ok) throw new Error(`sheet ${res.status}`);
  };

  // Both are attempted. The visitor is told it worked if either did, because by
  // then the inquiry exists somewhere. Only losing both is a failure: a
  // spreadsheet being down must never cost Rob a message.
  const [mail, sheet] = await Promise.allSettled([sendEmail(), appendToSheet()]);
  if (mail.status === 'rejected') console.error('contact: email failed:', mail.reason);
  if (sheet.status === 'rejected') console.error('contact: sheet failed:', sheet.reason);

  // An unconfigured sheet resolves without writing anything, so it only counts
  // as a place the inquiry landed when there is actually a sheet to land in.
  const saved =
    mail.status === 'fulfilled' || (Boolean(sheetHook) && sheet.status === 'fulfilled');
  if (!saved) return json({ error: 'failed' }, 502);
  return json({ ok: true });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export default handleRequest(contact);
