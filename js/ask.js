"use strict";
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
        <button type="button">Do you work outside the North Shore?</button>
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
const MAX_TURNS = 8;
const LEGAL = new Set(['privacy.html', 'terms.html']);
const MIN_SCORE = 3;
let index = null;
const turns = [];
let busy = false;
async function loadIndex() {
    index ??= (await (await fetch('/assets/site-index.json')).json());
    return index;
}
const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'is', 'are',
    'my', 'we', 'with', 'it', 'me', 'have', 'their', 'they', 'been', 'would', 'could', 'there', 'that',
    'this', 'from', 'was', 'were', 'has', 'had', 'will', 'can', 'any', 'some']);
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
function stem(word) {
    if (word.length > 4 && word.endsWith('ies'))
        return `${word.slice(0, -3)}y`;
    if (word.length > 4 && word.endsWith('ing'))
        return word.slice(0, -3);
    if (word.length > 4 && word.endsWith('ed'))
        return word.slice(0, -2);
    if (word.length > 3 && word.endsWith('es'))
        return word.slice(0, -2);
    if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss'))
        return word.slice(0, -1);
    return word;
}
function words(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}
function tokenize(question) {
    const out = new Set();
    for (const word of words(question)) {
        const synonym = SYNONYMS[word];
        if (synonym)
            for (const part of synonym.split(' '))
                out.add(stem(part));
        if (word.length < 3 || STOP.has(word))
            continue;
        out.add(stem(word));
    }
    return [...out];
}
function searchSections(question, sections) {
    const terms = tokenize(question);
    if (!terms.length)
        return [];
    return sections
        .map(section => {
        const title = section.pageTitle.toLowerCase();
        const label = `${section.heading} ${section.eyebrow}`.toLowerCase();
        const haystack = new Set(words(`${title} ${label} ${section.text}`).map(stem));
        const labelWords = new Set(words(`${title} ${label}`).map(stem));
        let score = 0;
        let matched = 0;
        for (const term of terms) {
            if (!haystack.has(term))
                continue;
            matched++;
            score += labelWords.has(term) ? 6 : 2;
        }
        if (terms.length > 1 && matched < 2)
            score = 0;
        if (LEGAL.has(section.page))
            score -= 8;
        return { section, score };
    })
        .filter(result => result.score >= MIN_SCORE)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(result => result.section);
}
function askEl(id) {
    const found = document.getElementById(id);
    if (!found)
        throw new Error(`ask: #${id} is missing`);
    return found;
}
function scrollDown() {
    const thread = askEl('ask-thread');
    thread.scrollTop = thread.scrollHeight;
}
function addBubble(role, text) {
    askEl('ask-thread').querySelector('.ask-intro')?.remove();
    const bubble = document.createElement('div');
    bubble.className = `ask-msg ask-msg-${role}`;
    bubble.textContent = text;
    askEl('ask-thread').appendChild(bubble);
    scrollDown();
    return bubble;
}
function addLinks(links) {
    if (!links.length)
        return;
    const wrap = document.createElement('div');
    wrap.className = 'ask-links';
    for (const link of links) {
        const anchor = document.createElement('a');
        anchor.href = link.href;
        anchor.textContent = link.label;
        wrap.appendChild(anchor);
    }
    askEl('ask-thread').appendChild(wrap);
    scrollDown();
}
function setMode(text) {
    const mode = askEl('ask-mode');
    mode.textContent = text ?? '';
    mode.hidden = !text;
}
function describe(section) {
    const page = section.pageTitle.replace(/^Project · /, '');
    const label = (section.heading || section.eyebrow || '').trim();
    if (!label || label.toLowerCase() === page.toLowerCase())
        return page;
    return `${page}: ${label}`;
}
function reasonFor(detail, status) {
    const known = {
        not_configured: 'the assistant is not switched on yet',
        bad_key: 'the API key was rejected',
        forbidden: 'this origin is not allowed',
    };
    return known[detail] ?? `the assistant is unreachable (${status})`;
}
async function send(question) {
    if (busy)
        return;
    busy = true;
    addBubble('you', question);
    turns.push({ role: 'user', content: question });
    const pending = addBubble('studio', 'Looking…');
    pending.classList.add('ask-pending');
    try {
        const response = await fetch('/api/ask', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ messages: turns.slice(-MAX_TURNS) }),
        });
        if (response.ok) {
            const data = (await response.json());
            pending.classList.remove('ask-pending');
            pending.textContent = data.answer;
            addLinks(data.links ?? []);
            turns.push({ role: 'assistant', content: data.answer });
            setMode(null);
            return;
        }
        if (response.status === 429) {
            pending.classList.remove('ask-pending');
            pending.textContent = 'A lot of questions at once just now. Try again in a moment.';
            turns.pop();
            return;
        }
        let detail = '';
        try {
            detail = (await response.json()).error ?? '';
        }
        catch {
            detail = '';
        }
        console.warn(`ask: /api/ask returned ${response.status}${detail ? ` (${detail})` : ''} — answering from site search`);
        setMode(`Answering from site search — ${reasonFor(detail, response.status)}.`);
        await fallback(question, pending);
    }
    catch (error) {
        console.warn('ask: could not reach /api/ask — answering from site search', error);
        setMode('Answering from site search — the assistant is unreachable.');
        await fallback(question, pending);
    }
    finally {
        busy = false;
        document.getElementById('ask-input')?.focus();
    }
}
async function fallback(question, pending) {
    pending.classList.remove('ask-pending');
    if (GREETINGS.test(question.trim())) {
        pending.textContent =
            'Hello. Ask me anything about the practice and I will point you to the part of the site that covers it.';
        turns.push({ role: 'assistant', content: pending.textContent });
        return;
    }
    const { sections } = await loadIndex();
    const hits = searchSections(question, sections);
    const first = hits[0];
    if (!first) {
        pending.textContent =
            'I could not find that on the site. Rob answers inquiries himself, so the contact page is the surest route to an answer.';
        addLinks([{ label: 'Contact the studio', href: '/contact.html#inquiry' }]);
    }
    else {
        const pageOf = (section) => section.pageTitle.replace(/^Project · /, '');
        const samePage = hits.every(hit => pageOf(hit) === pageOf(first));
        pending.textContent =
            hits.length === 1
                ? `${describe(first)} is where the site covers that.`
                : samePage
                    ? `${pageOf(first)} covers that, across a few sections.`
                    : `${describe(first)} is the closest match. A couple of other pages touch on it too.`;
        addLinks(hits.map(section => ({ label: describe(section), href: section.href })));
    }
    turns.push({ role: 'assistant', content: pending.textContent ?? '' });
}
function focusables(panel) {
    return [...panel.querySelectorAll('button, input, a[href]')]
        .filter(element => element.offsetParent !== null);
}
function trapFocus(event) {
    if (event.key !== 'Tab')
        return;
    const panel = askEl('ask-panel');
    if (panel.hidden)
        return;
    const items = focusables(panel);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last)
        return;
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    }
    else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}
function togglePanel(open) {
    const panel = askEl('ask-panel');
    const launcher = askEl('ask-launcher');
    panel.hidden = !open;
    launcher.classList.toggle('is-open', open);
    launcher.setAttribute('aria-expanded', String(open));
    if (open) {
        document.addEventListener('keydown', trapFocus);
        askEl('ask-input').focus();
    }
    else {
        document.removeEventListener('keydown', trapFocus);
        launcher.focus();
    }
}
function initAsk() {
    document.body.insertAdjacentHTML('beforeend', ASK_HTML);
    const panel = askEl('ask-panel');
    const launcher = askEl('ask-launcher');
    launcher.addEventListener('click', () => togglePanel(Boolean(panel.hidden)));
    panel.querySelector('.ask-close')?.addEventListener('click', () => togglePanel(false));
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !panel.hidden)
            togglePanel(false);
    });
    for (const opener of document.querySelectorAll('[data-ask-open]')) {
        opener.addEventListener('click', event => {
            event.preventDefault();
            togglePanel(true);
        });
    }
    askEl('ask-form').addEventListener('submit', event => {
        event.preventDefault();
        const input = askEl('ask-input');
        const question = input.value.trim();
        if (question.length < 3 || busy)
            return;
        input.value = '';
        void send(question);
    });
    for (const suggestion of document.querySelectorAll('#ask-suggestions button')) {
        suggestion.addEventListener('click', () => void send(suggestion.textContent ?? ''));
    }
}
