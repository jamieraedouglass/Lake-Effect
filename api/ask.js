import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { sections } from './site-index.js';
import { sameSite, clientKey, atLimit, recordHit } from './guard.js';
import { handleRequest } from './_adapter.js';

const ZOD_VERSION = typeof z.toJSONSchema === 'function' ? '4.x' : '3.x';

const MAX_QUESTION_CHARS = 400;
const MAX_TURNS = 8;

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

When the question is outside the site (set covered to false):
- If it is a reasonable thing to ask an architect but the site does not cover it, say so plainly and link to contact.html#inquiry.
- If it is plainly a joke, or asks for something an architecture practice does not do, answer with one dry, good-natured line that makes clear it is not our line of work, then point to contact.html#inquiry. Land it in one sentence and stop.
- Humour is never at the visitor's expense, never sarcastic, and never implies we might take the job on. A spaceship is a no, however warmly it is phrased.
- If the subject is upsetting, medical, legal, or otherwise not funny, drop the humour entirely and answer plainly.

Site content:

${CORPUS}`;

async function ask(request) {
  if (request.method === 'GET') {
    return json({
      ok: true,
      keyConfigured: Boolean(process.env.LE_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY),
      keyName: process.env.LE_ANTHROPIC_API_KEY ? 'LE_ANTHROPIC_API_KEY'
        : process.env.ANTHROPIC_API_KEY ? 'ANTHROPIC_API_KEY' : null,
      zod: ZOD_VERSION,
      structuredOutputs: typeof z.toJSONSchema === 'function',
      sections: sections.length,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Use POST.' }, 405);
  }
  if (!sameSite(request)) return json({ error: 'forbidden' }, 403);
  const LIMIT = { max: 12, windowMs: 60_000 };
  const visitor = clientKey(request);
  if (atLimit(visitor, LIMIT)) return json({ error: 'busy' }, 429);

  let messages;
  try {
    ({ messages } = await request.json());
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400);
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'Send a messages array.' }, 400);
  }
  if (messages.length > MAX_TURNS) {
    messages = messages.slice(-MAX_TURNS);
  }

  const turns = [];
  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) {
      return json({ error: 'Each message needs a role of user or assistant.' }, 400);
    }
    if (typeof m.content !== 'string' || !m.content.trim()) {
      return json({ error: 'Each message needs content.' }, 400);
    }
    turns.push({ role: m.role, content: m.content.trim().slice(0, MAX_QUESTION_CHARS) });
  }
  if (turns.at(-1).role !== 'user') {
    return json({ error: 'The last message must be from the visitor.' }, 400);
  }

  const apiKey = process.env.LE_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json({ error: 'not_configured' }, 503);
  }

  recordHit(visitor, LIMIT);

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.beta.messages.parse({
      model: 'claude-opus-5',
      max_tokens: 1024,
      cache_control: { type: 'ephemeral' },
      system: SYSTEM,
      output_config: {
        effort: 'low',
        format: betaZodOutputFormat(AnswerSchema),
      },
      messages: turns,
    });

    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      return json({
        answer: 'Sorry, I could not answer that one. The contact page is the best route.',
        links: [{ label: 'Contact', href: 'contact.html' }],
        covered: false,
      });
    }

    const known = new Set(sections.map(s => s.href));
    known.add('contact.html');
    const result = response.parsed_output;

    return json({
      ...result,
      links: result.links.filter(l => known.has(l.href)),
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return json({ error: 'busy' }, 429);
    }
    if (error instanceof Anthropic.AuthenticationError) {
      console.error('ask: the API key was rejected');
      return json({ error: 'bad_key' }, 502);
    }
    console.error('ask:', error?.stack ?? error);
    return json({ error: 'failed', detail: error?.message?.slice(0, 200) }, 502);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export default handleRequest(ask);
