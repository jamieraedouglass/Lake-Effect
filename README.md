# Lake Effect Architects

Static marketing site for Lake Effect Architects (Lake Bluff, IL). Plain HTML,
one shared stylesheet, no build step.

Project pages name the town, never the street address.

The palette is light: cream page, off-white and pale-grey panels, charcoal
text, and a slate accent for eyebrows, links and small labels. Every colour is
a token in `css/base.css` and `npm test` fails on raw hex anywhere else, so a
repaint means editing one block. Colour on the page comes from the photography,
not from the chrome.

## Ask

A round launcher sits bottom-right on every page and opens a small chat panel.
The visitor asks a question, gets a short answer, and gets links to the parts of
the site that cover it. The conversation is kept, so follow-ups work.

It works in two modes and always degrades to the second:

1. **With the function deployed** — `api/ask.js` sends the conversation (last 8
   turns) to Claude along with the whole site as context, and gets back an
   answer plus links.
When the assistant cannot be reached the panel says so, in a line under the
thread, with the HTTP status. The browser console carries the same detail. If
you see "Answering from site search" on the live site, the function is not
being reached — that line names the reason. Keyword search is the safety net,
not the product; its answers are noticeably worse and always will be.

2. **With no backend at all** — the panel falls back to keyword search over
   `assets/site-index.json`, entirely in the browser. Each message is answered
   independently, so follow-ups do not resolve, but it renders in the same
   thread and it is what runs on plain static hosting today.

The site is about 5,300 tokens end to end, so the *entire* site goes into the
system prompt. There is no vector database and no retrieval step to maintain.
With prompt caching a question costs well under a cent.

`assets/site-index.json` is generated — never hand-edit it:

    npm run build:index

`npm test` fails if it is stale, so rebuild it whenever page copy changes.

### Turning the Claude answers on

The API key never goes in the page or the repo — it would be public and
drainable. It lives in the host's environment variables and only the function
reads it.

On Vercel, which is what this is set up for:

1. Import the repo. `vercel.json` is already here; `api/ask.js` and
   `api/contact.js` are picked up automatically as `POST /api/ask` and
   `POST /api/contact`.
2. Set `ANTHROPIC_API_KEY` and `RESEND_API_KEY` in Project Settings →
   Environment Variables, ticked
   for **Production** and **Preview** if you want it live on preview
   deployments too. Redeploy after adding it — existing builds do not pick up
   new variables.
3. Nothing else. The dependencies live in the root `package.json`, which is
   the only one Vercel installs from, and the root is `"type": "module"` so the
   `api/` files load as ESM.

`vercel.json` sets `buildCommand` to `npm run verify`, not `npm run build`.
The build regenerates images with `sips`, which only exists on macOS, so
running it on Vercel's Linux builder would fail. Generated files are committed;
the deploy just re-runs the checks. `npm run build` is a local step — run it
after adding photos or changing page copy, then commit what it produces.

Locally, `npm start` is a plain static file server and does not run functions
at all, so the panel falls back to keyword search. That is expected, and it is
also the honest preview of what a visitor sees before the key is set. To
exercise the real path locally, use `vercel dev` with the key in `.env.local`
(gitignored; copy `.env.example`).

Until the key is set the function returns 503 and the panel falls back
silently. Nothing breaks in the meantime.

`api/site-index.js` is generated alongside `assets/site-index.json` by
`npm run build:index` — the function imports the module, the browser fetches
the JSON. Neither is hand-edited.

### Abuse

`api/guard.js` rejects requests whose Origin or Referer is not this site, and
rate-limits per IP: 12 questions a minute for Ask, 4 inquiries per 10 minutes
for the form. Both are in-memory, so the window is per serverless instance
rather than global — enough to stop a casual script, not a determined attacker.
Set `ALLOWED_ORIGINS` if the site is served from another domain. If this ever
needs to be strict, move the counter to Vercel KV.

### What it will and will not say

The system prompt in `api/ask.js` holds the guardrails: answer only from the
site, never state a number that is not in the content, never construct a link.
Returned links are also filtered against the real index server-side, so a
hallucinated href cannot reach the page. Out-of-scope questions get a dry
one-liner and a pointer to the contact page.

## Checks

    npm test

A dependency-free Node script (`test/check.mjs`) that walks the built pages and
fails on: broken internal links, missing images or stylesheets, a class used in
markup with no matching rule, a CSS rule matching no markup, images without alt
text, unbalanced tags, a page missing its doctype / lang / viewport / favicon /
single h1, a title over 32 characters, nav or footer drifting out of sync, a
project card whose `data-category` matches no filter button, raw hex outside
`css/base.css` (except `.swatch-*`, which carry real material colours), a stale
Ask index, and any street address appearing in content or filenames.

It does not open a browser, so it cannot catch layout problems. For those,
load each page in an iframe at 430, 768 and 1024px and compare
`documentElement.scrollWidth` with `clientWidth`; anything over zero is
horizontal overflow.

## Running it

Anything that serves the folder over HTTP will do:

    npm start        # python3 -m http.server 8000
    npm run build    # sync chrome, rebuild the Ask index and the sitemap
    npm test         # 13 checks

Then open http://localhost:8000. Opening `index.html` off the filesystem mostly
works too, but the nav and footer are injected by JavaScript, so use a server if
anything looks wrong.

## Layout

    index.html                    home
    philosophy.html               the three guiding principles
    residential.html              houses, with a category filter
    commercial.html               clubs, civic, retail
    furniture.html                furniture and millwork
    about.html                    studio, process, location
    contact.html                  inquiry form + FAQ
    privacy.html                  what the site collects
    terms.html                    terms of use
    project-lake-bluff-mcm.html      individual project page
    project-pebble-beach.html        individual project page
    project-lake-bluff-historic.html individual project page
    components.js                 nav + footer, injected into every page
    404.html                      not-found page
    favicon.svg                   square "le" mark for tabs
    favicon-32.png                fallback, rendered from favicon.svg
    apple-touch-icon.png          180px, rendered from favicon.svg
    logo.svg                      the full wordmark, used in the nav
    robots.txt, sitemap.xml       generated; sitemap by npm run build:sitemap
    ask.js                        the Ask panel and its no-backend fallback
    api/ask.js                    serverless function behind the Ask panel
    api/contact.js                inquiry form, delivered by Resend
    api/guard.js                  origin check and rate limiting for both
    scripts/build-chrome.mjs      syncs nav, footer, titles and head links
    scripts/build-images.mjs      writes the 800px variant of every photo
    scripts/build-srcset.mjs      puts srcset and sizes on every <img>
    scripts/build-index.mjs       rebuilds assets/site-index.json
    test/check.mjs                the checks behind `npm test`
    css/base.css                  tokens, reset, page hero, buttons
    css/layout.css                nav (incl. the mobile menu) and footer
    css/project.css               shared layout for every project page
    css/<page>.css                one file per page, its own media queries
    assets/<project-slug>/        photos and plans for one project

The nav and footer are **in the HTML of every page**, not injected by
JavaScript, so crawlers and no-JS visitors see the whole link graph. They are
generated from one source in `scripts/build-chrome.mjs` — edit them there and
run `npm run build:chrome`. `npm test` fails if any page's copy has drifted.

`initPage()` is only behaviour now: the mobile menu toggle and the Ask panel.

Page titles also live in `build-chrome.mjs`. They are deliberately short so
browser tabs stay readable — "Residential", not "Residential — Lake Effect
Architects". The trade-off is that `<title>` is also the headline Google shows
in search results, so those results carry the page name without the practice
name. If that matters more than tab legibility, add a suffix in the `TITLES`
map and re-run `npm run build:chrome`. `npm test` fails any title over 32
characters.

`logo.svg` is a 680x230 wordmark and is unreadable at 16px, so the favicon is
a separate square mark in `favicon.svg`.

The two PNGs are rendered from it and must be regenerated whenever it changes:

    favicon-32.png       32x32, transparency kept
    apple-touch-icon.png 180x180, drawn on a solid background

The Apple icon is deliberately opaque. `favicon.svg` has rounded corners, so
its own corners are transparent, and iOS renders transparency as black behind
the mask it applies. Render it over the mark's background colour rather than
letting the corners through.

Changing the domain means changing `SITE_URL` in `scripts/build-chrome.mjs`
and re-running `npm run build`, which updates every canonical tag and the
sitemap. `robots.txt` names the sitemap and needs the same edit by hand.

## Before this goes live

- Project names, locations and photography are placeholders. Every grid that
  holds them is marked with a `TODO` comment.
- The contact form posts to `api/contact`, which sends through Resend. Set
  `RESEND_API_KEY` in the Vercel environment and verify the sending domain in
  Resend, then check the `FROM` address at the top of `api/contact.js` matches
  a verified sender. Until the key is set the endpoint returns 503 and the form
  tells the visitor to email or call instead.
- Both `privacy.html` and `terms.html` are written in plain language and
  describe what the site actually does. Neither has been reviewed by a lawyer.
- The residential page had a client testimonial that we couldn't attribute to a
  real client, so it's been pulled. The markup note is still in the file.
- There is no mobile layout yet. Every grid is fixed-column, so the site is
  desktop-only as it stands.
