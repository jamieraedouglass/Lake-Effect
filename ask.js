const ASK_HTML = `
<button class="ask-launcher" id="ask-launcher" type="button" aria-label="Ask a question" aria-expanded="false">
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 5.5h16v11H9.5L5.5 20v-3.5H4z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M9.4 9.6a2.6 2.6 0 1 1 2.9 2.6v1.2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
  </svg>
</button>

<div class="ask-panel" id="ask-panel" role="dialog" aria-modal="true" aria-labelledby="ask-title" hidden>
  <div class="ask-head">
    <div>
      <div class="ask-eyebrow">Ask</div>
      <div class="ask-title" id="ask-title">About the studio</div>
    </div>
    <button class="ask-close" type="button" aria-label="Close">×</button>
  </div>

  <div class="ask-thread" id="ask-thread" role="log" aria-live="polite" aria-atomic="false">
    <div class="ask-intro">
      <p>Ask anything about the practice and I'll point you to the part of the site that covers it.</p>
      <div class="ask-suggestions" id="ask-suggestions">
        <button type="button">How do your fees work?</button>
        <button type="button">What are the phases of a project?</button>
        <button type="button">Show me a renovation</button>
        <button type="button">Do you design furniture?</button>
      </div>
    </div>
  </div>

  <p class="ask-mode" id="ask-mode" hidden></p>

  <form class="ask-form" id="ask-form">
    <input class="ask-input" id="ask-input" type="text" autocomplete="off" maxlength="400"
           placeholder="Ask a question" aria-label="Ask a question">
    <button class="ask-send" type="submit" aria-label="Send">→</button>
  </form>
</div>`;

const HISTORY_TURNS = 8;
const LEGAL = new Set(['privacy.html', 'terms.html']);

let index = null;
let history = [];
let busy = false;

async function loadIndex() {
  if (!index) index = await (await fetch('assets/site-index.json')).json();
  return index;
}

const STOP = new Set(['the','a','an','and','or','of','to','in','on','for','is','are',
  'my','we','with','it','me','have','their','they','been','would','could','there','that',
  'this','from','was','were','has','had','will','would','can','could','any','some']);

const SYNONYMS = {
  cost: 'fee', costs: 'fee', price: 'fee', pricing: 'fee', charge: 'fee', rate: 'fee',
  located: 'lake bluff', location: 'lake bluff', where: 'lake bluff', based: 'lake bluff',
  start: 'first step', started: 'first step', begin: 'first step', beginning: 'first step',
  timeline: 'long take', duration: 'long take', quick: 'long take',
  house: 'home', houses: 'home', home: 'home', homes: 'home',
  kitchen: 'kitchen', bathroom: 'bath', remodel: 'renovation', remodeling: 'renovation',
  extension: 'addition', addon: 'addition',
  hire: 'first step', consultation: 'first step', quote: 'fee',
};

const GREETINGS = /^(hi|hey|hello|yo|good (morning|afternoon|evening)|howdy)\b[\s!.?]*$/i;

function stem(w) {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('es')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

function tokenize(s) {
  const words = s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const out = new Set();
  for (const w of words) {
    if (SYNONYMS[w]) SYNONYMS[w].split(' ').forEach(t => out.add(stem(t)));
    if (w.length < 3 || STOP.has(w)) continue;
    out.add(stem(w));
  }
  return [...out];
}

function searchSections(question, sections) {
  const terms = tokenize(question);
  if (!terms.length) return [];
  return sections
    .map(s => {
      const title = s.pageTitle.toLowerCase();
      const label = `${s.heading} ${s.eyebrow}`.toLowerCase();
      const words = new Set(`${title} ${label} ${s.text}`.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).map(stem));
      const labelWords = new Set(`${title} ${label}`.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).map(stem));

      let score = 0, matched = 0;
      for (const t of terms) {
        if (!words.has(t)) continue;
        matched++;
        score += labelWords.has(t) ? 6 : 2;
      }
      if (terms.length > 1 && matched < 2) score = 0;
      if (LEGAL.has(s.page)) score -= 8;
      return { s, score };
    })
    .filter(r => r.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(r => r.s);
}

function thread() {
  return document.getElementById('ask-thread');
}

function scrollDown() {
  const t = thread();
  t.scrollTop = t.scrollHeight;
}

function addBubble(role, text) {
  const intro = thread().querySelector('.ask-intro');
  if (intro) intro.remove();
  const el = document.createElement('div');
  el.className = `ask-msg ask-msg-${role}`;
  el.textContent = text;
  thread().appendChild(el);
  scrollDown();
  return el;
}

function addLinks(links) {
  if (!links.length) return;
  const wrap = document.createElement('div');
  wrap.className = 'ask-links';
  for (const l of links) {
    const a = document.createElement('a');
    a.href = l.href;
    a.textContent = l.label;
    wrap.appendChild(a);
  }
  thread().appendChild(wrap);
  scrollDown();
}

function setMode(text) {
  const el = document.getElementById('ask-mode');
  el.textContent = text ?? '';
  el.hidden = !text;
}

async function send(question) {
  if (busy) return;
  busy = true;

  addBubble('you', question);
  history.push({ role: 'user', content: question });

  const pending = addBubble('studio', 'Looking…');
  pending.classList.add('ask-pending');

  try {
    const res = await fetch('api/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-HISTORY_TURNS) }),
    });

    if (res.ok) {
      const data = await res.json();
      pending.classList.remove('ask-pending');
      pending.textContent = data.answer;
      addLinks(data.links ?? []);
      history.push({ role: 'assistant', content: data.answer });
      setMode(null);
      return;
    }
    if (res.status === 429) {
      pending.classList.remove('ask-pending');
      pending.textContent = 'A lot of questions at once just now. Try again in a moment.';
      history.pop();
      return;
    }

    let detail = '';
    try {
      detail = (await res.json()).error ?? '';
    } catch {}
    console.warn(`ask: /api/ask returned ${res.status}${detail ? ` (${detail})` : ''} — answering from site search`);
    setMode(detail === 'not_configured'
      ? 'Answering from site search — the assistant is not switched on yet.'
      : `Answering from site search — the assistant is unreachable (${res.status}).`);
    await fallback(question, pending);
  } catch (err) {
    console.warn('ask: could not reach /api/ask — answering from site search', err);
    setMode('Answering from site search — the assistant is unreachable.');
    await fallback(question, pending);
  } finally {
    busy = false;
    const input = document.getElementById('ask-input');
    if (input) input.focus();
  }
}

async function fallback(question, pending) {
  pending.classList.remove('ask-pending');

  if (GREETINGS.test(question.trim())) {
    pending.textContent = 'Hello. Ask me anything about the practice and I will point you to the part of the site that covers it.';
    history.push({ role: 'assistant', content: pending.textContent });
    return;
  }

  const { sections } = await loadIndex();
  const hits = searchSections(question, sections);

  if (!hits.length) {
    pending.textContent =
      "I could not find that on the site. Rob answers inquiries himself, so the contact page is the surest route to an answer.";
    addLinks([{ label: 'Contact the studio', href: 'contact.html#inquiry' }]);
  } else {
    const pageOf = s => s.pageTitle.replace(/^Project · /, '');
    const samePage = hits.every(h => pageOf(h) === pageOf(hits[0]));
    pending.textContent = hits.length === 1
      ? `${describe(hits[0])} is where the site covers that.`
      : samePage
        ? `${pageOf(hits[0])} covers that, across a few sections.`
        : `${describe(hits[0])} is the closest match. A couple of other pages touch on it too.`;
    addLinks(hits.map(s => ({ label: describe(s), href: s.href })));
  }
  history.push({ role: 'assistant', content: pending.textContent });
}

function describe(section) {
  const page = section.pageTitle.replace(/^Project · /, '');
  const label = (section.heading || section.eyebrow || '').trim();
  if (!label || label.toLowerCase() === page.toLowerCase()) return page;
  return `${page}: ${label}`;
}

function focusables(panel) {
  return [...panel.querySelectorAll('button, input, a[href]')].filter(el => el.offsetParent !== null);
}

function trapFocus(e) {
  if (e.key !== 'Tab') return;
  const panel = document.getElementById('ask-panel');
  if (panel.hidden) return;
  const items = focusables(panel);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function togglePanel(open) {
  const panel = document.getElementById('ask-panel');
  const launcher = document.getElementById('ask-launcher');
  panel.hidden = !open;
  launcher.classList.toggle('is-open', open);
  launcher.setAttribute('aria-expanded', String(open));
  if (open) {
    document.addEventListener('keydown', trapFocus);
    document.getElementById('ask-input').focus();
  } else {
    document.removeEventListener('keydown', trapFocus);
    launcher.focus();
  }
}

function initAsk() {
  document.body.insertAdjacentHTML('beforeend', ASK_HTML);

  const panel = document.getElementById('ask-panel');
  const launcher = document.getElementById('ask-launcher');

  launcher.addEventListener('click', () => togglePanel(panel.hidden));
  panel.querySelector('.ask-close').addEventListener('click', () => togglePanel(false));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !panel.hidden) togglePanel(false);
  });

  document.querySelectorAll('[data-ask-open]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); togglePanel(true); });
  });

  document.getElementById('ask-form').addEventListener('submit', e => {
    e.preventDefault();
    const input = document.getElementById('ask-input');
    const q = input.value.trim();
    if (q.length < 3 || busy) return;
    input.value = '';
    send(q);
  });

  document.querySelectorAll('#ask-suggestions button').forEach(b => {
    b.addEventListener('click', () => send(b.textContent));
  });
}
