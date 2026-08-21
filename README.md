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

The API key cannot live in the page — it would be public and drainable — so
this part needs a host that runs functions. Netlify, Vercel and Cloudflare
Pages all have a free tier and connect straight to the GitHub repo.

1. Deploy the repo to one of them.
2. `cd api && npm install`, or let the host install from `api/package.json`.
3. Set `ANTHROPIC_API_KEY` in the host's environment variables.
4. Route `POST /api/ask` to `api/ask.js`. It is a standard
   `(Request) => Response` handler, which Netlify and Vercel take as-is;
   Cloudflare Pages wants it renamed to `functions/api/ask.js` and exported as
   `onRequestPost({ request, env })`, reading the key from `env`.

Until step 3 is done the function returns 503 and the panel quietly falls back
to search. Nothing breaks in the meantime.

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
markup with no matching rule, images without alt text, unbalanced tags, a page
missing its doctype / lang / viewport / title / single h1, a project card whose
`data-category` matches no filter button, raw hex outside `css/base.css`, and
any street address appearing in content or filenames.

It does not open a browser, so it cannot catch layout problems. For those,
load each page in an iframe at 430, 768 and 1024px and compare
`documentElement.scrollWidth` with `clientWidth`; anything over zero is
horizontal overflow.

## Running it

Anything that serves the folder over HTTP will do:

    npm start        # python3 -m http.server 8000

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
    project-lake-bluff-mcm.html      individual project page
    project-pebble-beach.html        individual project page
    project-lake-bluff-historic.html individual project page
    components.js                 nav + footer, injected into every page
    ask.js                        the Ask panel and its no-backend fallback
    api/ask.js                    serverless function behind the Ask panel
    scripts/build-index.mjs       rebuilds assets/site-index.json
    test/check.mjs                the checks behind `npm test`
    css/base.css                  tokens, reset, page hero, buttons
    css/layout.css                nav (incl. the mobile menu) and footer
    css/project.css               shared layout for every project page
    css/<page>.css                one file per page, its own media queries
    assets/<project-slug>/        photos and plans for one project

Each page ends with `initPage('<name>')`, which injects the nav and footer and
highlights the matching nav link. Pass nothing on pages that aren't in the nav.

## Before this goes live

- Project names, locations and photography are placeholders. Every grid that
  holds them is marked with a `TODO` comment.
- The contact form posts to Formspree. Create a form, then set `FORMSPREE_ID`
  near the bottom of `contact.html`. Until that's filled in the form refuses to
  submit and tells the visitor to email or call instead.
- The residential page had a client testimonial that we couldn't attribute to a
  real client, so it's been pulled. The markup note is still in the file.
- There is no mobile layout yet. Every grid is fixed-column, so the site is
  desktop-only as it stands.
