import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { sections } from './_site-index.ts';
import { sameSite, clientKey, atLimit, recordHit } from './_guard.ts';
import { handleRequest } from './_adapter.ts';
import { overBudget, record, costOf, spentThisHour, ceiling } from './_budget.ts';

const ZOD_VERSION = typeof z.toJSONSchema === 'function' ? '4.x' : '3.x';

const MAX_QUESTION_CHARS = 400;
const MAX_TURNS = 8;

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

const AnswerSchema = z.object({
  answer: z
    .string()
    .describe('Two or three sentences, in the voice of the studio. Plain text, no markdown.'),
  links: z
    .array(
      z.object({
        label: z.string().describe('What the visitor will see, e.g. "How a project runs"'),
        href: z.string().describe('An exact href from the site content, e.g. "about.html#process"'),
      })
    )
    .max(3)
    .describe('The sections that answer the question. Empty if the site does not cover it.'),
  covered: z
    .boolean()
    .describe('False when the site content does not answer the question.'),
});

const CORPUS = sections
  .map(s => [
    `## ${s.pageTitle} · ${s.heading || s.eyebrow || s.anchor}`,
    `href: ${s.href}`,
    s.text,
  ].join('\n'))
  .join('\n\n');

const SYSTEM = `You answer visitor questions about Lake Effect Architects, a small architecture practice in Lake Bluff, Illinois, run by Rob. Your job is to answer briefly and then point the visitor to the part of the site that covers it in full.

Rules:
- Answer only from the site content below. It is the complete site.
- Never invent or estimate fees, timelines, availability, staff, awards, or project details. If a number is not in the content, do not state a number.
- Every href you return must appear verbatim in the content below. Never construct one.
- Two or three sentences. No markdown, no bullet points, no greeting.
- This is a conversation: read the earlier turns and resolve follow-ups like "what about that one" against them.
- Write as the studio: "we", not "they" or "Lake Effect".
- When you describe the kind of work the practice does, go by what the project
  pages show, not by the tone of the philosophy page. Each project page states
  its scope on its first line, so count those. Pick examples from across the
  range rather than the oldest ones: leading with a 1902 house and a 1954 house
  makes a practice that mostly builds new houses sound like a restoration firm.

When the question is outside the site (set covered to false):

If it is a fair thing to ask an architect and the site simply does not cover it,
answer plainly and link to contact.html#inquiry. No jokes. Someone asking a real
question about their house deserves a straight reply.

If it is plainly a joke, or asks for something an architecture practice does not
do, answer in kind. Rob's humour is deadpan and English: take the absurd request
completely literally, treat it with mock-professional seriousness, and get back
to business without ever acknowledging that a joke was made. The register is a
building surveyor gravely explaining that he is not licensed to survey a dragon.

The technique, not the references:
- Play it straight. The comedy is in the flat delivery, never in winking at it.
- Understate. "That falls a little outside our usual scope" beats any punchline.
- Be specific and bureaucratic about the absurd part. Planning permission,
  structural loads, the local zoning board, drawing sets, site access.
- Stop after one or two sentences. Explaining the joke kills it.
- Never a Monty Python quotation. Borrowed lines read as borrowed.

Do not use exclamation marks, emoji, "As an AI", "I don't have information
about", or "I'm unable to". Never make the visitor the butt of it, never be
sarcastic at their expense, and never suggest we might take the job on.

Drop the humour completely and answer plainly if the question touches on
anything upsetting: illness, bereavement, money trouble, legal disputes,
building failures or safety.

The tone, for calibration:
- "Can you build me a spaceship?" Answer: "We stop at the top of the roof, I'm afraid.
  Anything above that is somebody else's discipline. If it is a building on
  actual ground you have in mind, do get in touch."
- "Do you do time travel?" Answer: "Only in the sense that we work on a house from
  1902. The village still expects the drawings on paper."


Site content:

${CORPUS}`;

async function ask(request: Request): Promise<Response> {
  if (request.method === 'GET') {
    return json({
      ok: true,
      keyConfigured: Boolean(process.env['LE_ANTHROPIC_API_KEY'] ?? process.env['ANTHROPIC_API_KEY']),
      keyName: process.env['LE_ANTHROPIC_API_KEY'] ? 'LE_ANTHROPIC_API_KEY'
        : process.env['ANTHROPIC_API_KEY'] ? 'ANTHROPIC_API_KEY' : null,
      zod: ZOD_VERSION,
      structuredOutputs: typeof z.toJSONSchema === 'function',
      sections: sections.length,
      hourlyCeilingUsd: ceiling,
      spentThisHour: Number(spentThisHour().toFixed(4)),
      commit: process.env['VERCEL_GIT_COMMIT_SHA']?.slice(0, 7) ?? null,
    });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Use POST.' }, 405);
  }
  if (!sameSite(request)) return json({ error: 'forbidden' }, 403);
  const LIMIT = { max: 6, windowMs: 60_000 };
  const visitor = clientKey(request);
  if (atLimit(visitor, LIMIT)) return json({ error: 'busy' }, 429);

  let messages: unknown;
  try {
    ({ messages } = (await request.json()) as { messages?: unknown });
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400);
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'Send a messages array.' }, 400);
  }
  const incoming = (messages as unknown[]).slice(-MAX_TURNS);
  const turns: Turn[] = [];

  for (const entry of incoming) {
    const message = entry as Partial<Turn> | null;
    if (!message || (message.role !== 'user' && message.role !== 'assistant')) {
      return json({ error: 'Each message needs a role of user or assistant.' }, 400);
    }
    if (typeof message.content !== 'string' || !message.content.trim()) {
      return json({ error: 'Each message needs content.' }, 400);
    }
    turns.push({ role: message.role, content: message.content.trim().slice(0, MAX_QUESTION_CHARS) });
  }

  if (turns.at(-1)?.role !== 'user') {
    return json({ error: 'The last message must be from the visitor.' }, 400);
  }

  // Refuse before spending rather than after.
  if (overBudget()) {
    console.warn(`ask: hourly ceiling of $${ceiling} reached on this instance`);
    return json({ error: 'busy' }, 429);
  }

  const apiKey = process.env['LE_ANTHROPIC_API_KEY'] ?? process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    return json({ error: 'not_configured' }, 503);
  }

  recordHit(visitor, LIMIT);

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.beta.messages.parse({
      model: 'claude-opus-5',
      max_tokens: 500,
      cache_control: { type: 'ephemeral' },
      system: SYSTEM,
      output_format: betaZodOutputFormat(AnswerSchema),
      output_config: { effort: 'low' },
      messages: turns,
    });

    record(costOf(response.usage as Parameters<typeof costOf>[0]));

    if (!response.parsed_output) {
      console.error('ask: no parsed_output', JSON.stringify({
        stop_reason: response.stop_reason,
        text: response.content?.find(b => b.type === 'text')?.text?.slice(0, 300),
      }));
    }

    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      return json({
        answer: 'Sorry, I could not answer that one. The contact page is the best route.',
        links: [{ label: 'Contact', href: 'contact.html' }],
        covered: false,
        unparsed: !response.parsed_output,
      });
    }

    const known = new Set(sections.map(s => s.href));
    known.add('contact.html');
    const result = response.parsed_output;

    return json({
      ...result,
      links: result.links.filter(link => known.has(link.href)),
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return json({ error: 'busy' }, 429);
    }
    if (error instanceof Anthropic.AuthenticationError) {
      console.error('ask: the API key was rejected');
      return json({ error: 'bad_key' }, 502);
    }
    const failure = error instanceof Error ? error : new Error(String(error));
    console.error('ask:', failure.stack ?? failure.message);
    return json({ error: 'failed', detail: failure.message.slice(0, 200) }, 502);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export default handleRequest(ask);
