/**
 * A spend ceiling for the Ask endpoint.
 *
 * Sized against a $5 monthly budget: at roughly $0.046 a question that is
 * about 108 questions a month, or four a day. Half a dollar an hour is around
 * eleven questions, well above anything a real visitor asks in one sitting and
 * low enough that a script cannot spend the month before anyone notices.
 *
 * This is a backstop, not a guarantee. The window lives in memory, and Vercel
 * runs however many instances it likes and recycles them, so the real ceiling
 * is this figure times some number nobody controls. The only limit that holds
 * everywhere is the monthly cap set in the Anthropic Console; this one exists
 * to stop a single instance running up a bill between now and someone noticing.
 */

const WINDOW_MS = 3_600_000;
const CEILING_USD = Number(process.env['LE_ASK_HOURLY_USD'] ?? 0.5);

// Opus 5, dollars per million tokens.
const PRICE = { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 };

interface Spend {
  at: number;
  usd: number;
}

const spent: Spend[] = [];

export interface Usage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export function costOf(usage: Usage | null | undefined): number {
  if (!usage) return 0;
  const m = (tokens: number | null | undefined, rate: number): number =>
    ((tokens ?? 0) / 1_000_000) * rate;
  return (
    m(usage.input_tokens, PRICE.input) +
    m(usage.output_tokens, PRICE.output) +
    m(usage.cache_read_input_tokens, PRICE.cacheRead) +
    m(usage.cache_creation_input_tokens, PRICE.cacheWrite)
  );
}

function live(): Spend[] {
  const cutoff = Date.now() - WINDOW_MS;
  while (spent.length && (spent[0]?.at ?? 0) < cutoff) spent.shift();
  return spent;
}

export function spentThisHour(): number {
  return live().reduce((total, entry) => total + entry.usd, 0);
}

export function overBudget(): boolean {
  return spentThisHour() >= CEILING_USD;
}

export function record(usd: number): void {
  live();
  spent.push({ at: Date.now(), usd });
}

export const ceiling = CEILING_USD;
