/**
 * Checks that inquiries can actually reach Rob.
 *
 * The contact form sends through Resend, which signs as send.leffect.com. That
 * subdomain's records are being added by the company that manages the domain,
 * and the same zone carries Rob's real mailbox, so this checks two things at
 * once: that the new records arrived intact, and that the old ones did not move
 * while someone was in there.
 *
 * Run it once the records are said to be in: `npm run check:mail`.
 */

import { promises as dns } from 'node:dns';

const SENDING_DOMAIN = 'send.leffect.com';
const APEX = 'leffect.com';
const SITE = 'https://www.leffect.com';

// Rob's mail, as it stood before any of this began. Nothing here should change.
const EXPECTED_APEX_MX = ['barracuda.mcservices.com', 'barracuda2.mcservices.com'];

interface Result {
  label: string;
  ok: boolean;
  detail: string;
  critical: boolean;
}

const results: Result[] = [];

function record(label: string, ok: boolean, detail: string, critical = false): void {
  results.push({ label, ok, detail, critical });
}

async function txt(name: string): Promise<string[]> {
  try {
    // Long values arrive split into 255 character chunks and have to be rejoined.
    return (await dns.resolveTxt(name)).map(chunks => chunks.join(''));
  } catch {
    return [];
  }
}

async function checkDkim(): Promise<void> {
  const name = `resend._domainkey.${SENDING_DOMAIN}`;
  const found = await txt(name);
  if (found.length === 0) {
    record('DKIM key published', false, `${name} does not resolve`, true);
    return;
  }
  if (found.length > 1) {
    record('DKIM key published', false, `${name} has ${found.length} records, expected one`, true);
    return;
  }

  const value = found[0] ?? '';
  const key = value.match(/p=([A-Za-z0-9+/=]*)/)?.[1] ?? '';

  // The key travelled here by email, and mail clients wrap long lines. A space
  // inside the base64 is the failure this is really looking for: the record
  // resolves, Resend may even verify, and then every message fails DKIM and
  // lands in a spam folder because the apex publishes DMARC p=quarantine.
  if (!key) {
    record('DKIM key published', false, `${name} has no p= value`, true);
    return;
  }
  const afterP = value.slice(value.indexOf('p=') + 2);
  if (/\s/.test(afterP.trim()) || afterP.trim().length !== key.length) {
    record('DKIM key intact', false, 'the p= value contains whitespace, so it was mangled in transit', true);
    return;
  }

  let bytes = 0;
  try {
    bytes = Buffer.from(key, 'base64').length;
  } catch {
    bytes = 0;
  }
  // A 1024 bit RSA key in SubjectPublicKeyInfo form is about 162 bytes.
  if (bytes < 100) {
    record('DKIM key intact', false, `p= decodes to only ${bytes} bytes, so it is truncated`, true);
    return;
  }
  record('DKIM key intact', true, `${bytes} byte key, no whitespace`);
}

async function checkCname(host: string, expected: string): Promise<void> {
  try {
    const found = await dns.resolveCname(host);
    const got = (found[0] ?? '').replace(/\.$/, '').toLowerCase();
    record(`${host}`, got === expected, got === expected ? `-> ${got}` : `-> ${got}, expected ${expected}`, true);
  } catch {
    record(`${host}`, false, 'does not resolve', true);
  }
}

async function checkSendingMx(): Promise<void> {
  try {
    const found = await dns.resolveMx(SENDING_DOMAIN);
    const hosts = found.map(m => m.exchange.replace(/\.$/, '').toLowerCase());
    const ok = hosts.some(h => h.startsWith('inbound-smtp.'));
    record(`${SENDING_DOMAIN} MX`, ok, hosts.join(', ') || 'none');
  } catch {
    // Only needed to receive mail, so its absence does not stop the form.
    record(`${SENDING_DOMAIN} MX`, false, 'not published (sending still works without it)');
  }
}

async function checkApexUntouched(): Promise<void> {
  try {
    const found = await dns.resolveMx(APEX);
    const hosts = found.map(m => m.exchange.replace(/\.$/, '').toLowerCase()).sort();
    const same =
      hosts.length === EXPECTED_APEX_MX.length &&
      hosts.every((h, i) => h === EXPECTED_APEX_MX[i]);
    record(
      "Rob's mailbox untouched",
      same,
      same ? hosts.join(', ') : `apex MX is now ${hosts.join(', ')}, expected ${EXPECTED_APEX_MX.join(', ')}`,
      true,
    );
  } catch {
    record("Rob's mailbox untouched", false, `${APEX} has no MX at all, which would stop his mail`, true);
  }
}

async function checkApexSpf(): Promise<void> {
  const spf = (await txt(APEX)).filter(v => v.toLowerCase().startsWith('v=spf1'));
  if (spf.length === 1) {
    record('one SPF record on the apex', true, 'exactly one, as required');
  } else if (spf.length === 0) {
    record('one SPF record on the apex', false, 'the SPF record has gone', true);
  } else {
    // Two SPF records is a permanent error, and with DMARC on quarantine that
    // sends Rob's own outgoing mail to spam. Worth catching loudly.
    record('one SPF record on the apex', false, `${spf.length} SPF records, which fails SPF outright`, true);
  }
}

async function checkDmarc(): Promise<void> {
  const found = await txt(`_dmarc.${APEX}`);
  record('DMARC still published', found.length > 0, found[0] ?? 'missing');
}

async function checkKey(): Promise<void> {
  try {
    const res = await fetch(`${SITE}/api/contact`, { signal: AbortSignal.timeout(15_000) });
    const body = (await res.json()) as { keyConfigured?: boolean; from?: string; to?: string };
    record('Resend key set in Vercel', Boolean(body.keyConfigured), body.keyConfigured ? 'set' : 'not set', true);
    record('inquiries addressed to', true, `${body.to} from ${body.from}`);
  } catch (error) {
    record('Resend key set in Vercel', false, `could not reach the endpoint: ${String(error)}`);
  }
}

await Promise.all([
  checkDkim(),
  checkCname(`rsend.${SENDING_DOMAIN}`, 'rsend.forge.rmta.net'),
  checkCname(`send.${SENDING_DOMAIN}`, 'send.forge.rmta.net'),
  checkSendingMx(),
  checkApexUntouched(),
  checkApexSpf(),
  checkDmarc(),
  checkKey(),
]);

console.log('');
for (const r of results) {
  console.log(`  ${r.ok ? 'ok  ' : r.critical ? 'FAIL' : 'wait'}  ${r.label.padEnd(30)} ${r.detail}`);
}

const blocking = results.filter(r => !r.ok && r.critical);
console.log('');
if (blocking.length === 0) {
  console.log('  Everything the form needs is in place. Send one through the form to be sure.');
} else {
  console.log(`  ${blocking.length} thing(s) still to fix before an inquiry reaches Rob.`);
}
console.log('');
process.exit(blocking.length > 0 ? 1 : 0);
