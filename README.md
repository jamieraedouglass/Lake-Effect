# Lake Effect Architects

Static marketing site for Lake Effect Architects (Lake Bluff, IL). Plain HTML
served as files, with two serverless endpoints behind it and a build step that
generates the parts that would otherwise drift.

Project pages name the town, never the street address. `npm test` fails if one
reaches the markup.

The palette is light: cream page, off-white and pale-grey panels, charcoal
text, and a slate accent for eyebrows, links and small labels. Every colour is
a token in `css/base.css` and `npm test` fails on raw hex anywhere else, so a
repaint means editing one block. Colour on the page comes from the photography,
not from the chrome.

## Ask

A round launcher sits bottom-right on every page and opens a small chat panel.
The visitor asks a question, gets a short answer, and gets links to the parts of
the site that cover it. The conversation is kept, so follow-ups work.

It works in two modes and always degrades to the second.

**1. With the function deployed.** `api/ask.ts` sends the conversation (last 8
turns) to Claude along with the whole site as context, and gets back an answer
plus links.

**2. With no backend at all.** The panel falls back to keyword search over
`assets/site-index.json`, entirely in the browser. Each message is answered
independently, so follow-ups do not resolve, but it renders in the same thread.

When the assistant cannot be reached the panel says so in a line under the
thread, with the HTTP status, and the browser console carries the same detail.
If you see "Answering from site search" on the live site the function is not
being reached, and that line names the reason. Keyword search is the safety
net, not the product; its answers are noticeably worse and always will be.

The whole site is about 9,000 tokens, so the *entire* site goes into the system
prompt. There is no vector database and no retrieval step to maintain.

`assets/site-index.json` is generated, never hand-edit it:

    npm run build:index

`npm test` fails if it is stale, so rebuild it whenever page copy changes.
`api/_site-index.ts` is generated alongside it by the same command: the
function imports the module, the browser fetches the JSON.

### Turning the Claude answers on

The API key never goes in the page or the repo, it would be public and
drainable. It lives in the host's environment variables and only the function
reads it.

On Vercel, which is what this is set up for:

1. Import the repo. `vercel.json` is already here; `api/ask.ts` and
   `api/contact.ts` are picked up automatically as `POST /api/ask` and
   `POST /api/contact`.
2. Set `LE_ANTHROPIC_API_KEY` and `LE_RESEND_API_KEY` in Project Settings →
   Environment Variables, ticked for **Production** and **Preview** if you want
   them live on preview deployments too. Redeploy after adding them, existing
   builds do not pick up new variables.
3. Nothing else. The dependencies live in the root `package.json`, which is the
   only one Vercel installs from, and the root is `"type": "module"` so the
   `api/` files load as ESM.

`.env.example` lists every variable the site reads.

Files in `api/` whose names begin with an underscore are private modules.
Vercel publishes every other file in that directory as a function, so a helper
without a default export becomes an endpoint that fails when called. `npm test`
checks for that.

`vercel.json` sets `buildCommand` to `npm run typecheck && node test/check.ts`,
not `npm run build`. The build regenerates images with `sips`, which only
exists on macOS, so running it on Vercel's Linux builder would fail. Generated
files are committed; the deploy just re-runs the checks. `npm run build` is a
local step, run it after adding photos or changing page copy, then commit what
it produces.

The endpoints also accept the unprefixed `ANTHROPIC_API_KEY` and
`RESEND_API_KEY`, so a local `.env.local` can use either name.

`zod` must be v4. The SDK's `betaZodOutputFormat` calls `z.toJSONSchema()`,
which only exists in zod 4; on zod 3 the request throws at the point the output
format is built, and the panel falls back to search. The SDK's peer range
allows v3, so npm will not warn you.

Locally, `npm start` is a plain static file server and does not run functions at
all, so the panel falls back to keyword search. That is expected, and it is also
the honest preview of what a visitor sees before the key is set. To exercise the
real path locally, use `vercel dev` with the key in `.env.local` (gitignored;
copy `.env.example`).

Until the key is set the function returns 503 and the panel falls back silently.
Nothing breaks in the meantime.

### Checking a deployment

Open `/api/ask` in a browser. A GET returns what is actually running:

    {"ok":true,"keyConfigured":true,"keyName":"LE_ANTHROPIC_API_KEY",
     "zod":"4.x","structuredOutputs":true,"sections":76,
     "hourlyCeilingUsd":2,"spentThisHour":0.0413,"commit":"e5f4ed1"}

- `commit` is the build Vercel is serving. If it is behind, it has not
  redeployed.
- `zod` must be `4.x` and `structuredOutputs` must be true.
- `keyConfigured` false means the variable is missing or the build predates it.
- `spentThisHour` at the ceiling means the endpoint is refusing on cost.
- A 500 on this GET means the function crashes before it runs at all, check the
  Vercel function logs.

`/api/contact` answers the same way.

### Cost

At roughly 13,000 tokens of site in a cached prompt and 500 tokens back, a
question costs about **$0.046** on Opus 5. So a **$5 monthly cap is about 108
questions, four a day**. Worth knowing before setting it: if the site gets any
real traffic that runs out.

The same question on cheaper models, same prompt and same answer length:

    Opus 5      $0.046     108 questions for $5
    Sonnet 5    $0.014     363 questions for $5
    Haiku 4.5   $0.005   1,089 questions for $5

The model is set in `api/ask.ts`. Opus is there for the deadpan; the retrieval
half of the job is well within the cheaper two.

Output tokens are most of the cost, so `max_tokens` is 500: a short answer with
a couple of links needs nowhere near more. Beyond that, `api/_budget.ts`
refuses before spending once an instance has spent `LE_ASK_HOURLY_USD`
(default 0.5, about eleven questions) in a rolling hour, billed from the usage
the API reports rather than an estimate.

That ceiling is a backstop. The window lives in memory and Vercel runs as many
instances as it likes and recycles them, so the real figure is the ceiling
times a number nobody controls. **The limit that holds everywhere is the
monthly cap in the Anthropic Console**, under Billing, Usage limits. When it is
reached the API returns errors and the panel falls back to keyword search,
which is the degradation it was built for: the site keeps working.

### Where an inquiry goes

The contact endpoint writes to two places and treats them independently:

- **Email**, through Resend, to the address at the top of `api/contact.ts`.
- **A spreadsheet**, if `LE_SHEET_WEBHOOK_URL` is set: a Google Apps Script web
  app that appends a row. `docs/inquiries-sheet.gs` is the script and carries
  its own setup steps.

The visitor is told it worked if either succeeded, because by then the inquiry
exists somewhere. Only losing both is a failure. An unset webhook does not
count as a success, or an email failure with no sheet configured would report
a delivery that never happened.

The web app URL is a secret: "Anyone with the link" is how Apps Script exposes
it, so it lives in the Vercel environment and never in the repo or the page.

### Visitors

`build-chrome` puts Vercel's analytics tag on every page. It is served from
this domain, so the Content-Security-Policy needs no third party host, it sets
no cookie, and there is no consent banner to show. Switch it on under Analytics
in the Vercel dashboard; the tag does nothing until you do.

It counts pages, referrers and countries. It cannot identify anyone, which is
what `privacy.html` now says.

### Abuse

`api/_guard.ts` rejects requests whose Origin or Referer is not this site, and
rate-limits per IP: 6 questions a minute for Ask, 4 inquiries per 10 minutes
for the form. Both are in-memory, so the window is per serverless instance
rather than global, enough to stop a casual script, not a determined attacker.
Set `ALLOWED_ORIGINS` if the site is served from another domain. If this ever
needs to be strict, move the counter to Vercel KV.

The contact form carries a honeypot field named `company`, hidden with
`aria-hidden` and `tabindex="-1"`. Anything that fills it is dropped.

### Voice

Out-of-scope questions are answered in Rob's register: deadpan, understated,
the absurd request taken completely literally and treated with mock-
professional seriousness. The prompt gives the technique rather than the
references, and explicitly forbids quoting anything, borrowed lines read as
borrowed. It never acknowledges that a joke was made, which is the whole trick.

Two guards sit around it. A fair question an architect might get, which the
site simply does not cover, is answered straight, because someone asking about
their house deserves a straight reply. And the humour is dropped entirely when
a question touches illness, bereavement, money trouble, legal disputes or
building safety.

The four suggested questions in the panel stay practical on purpose. The humour
is for people who go off-script; advertising it would undercut the first
impression a real client gets.

The same restraint applies to the site copy. The 404 page and two of the
contact answers carry a dry line each. Nothing goes near the fee structure, the
budget ranges, or the paragraph about construction surprises, because someone
reading those is deciding whether to hand over a large amount of money.

### What it will and will not say

The system prompt in `api/ask.ts` holds the guardrails: answer only from the
site, never state a number that is not in the content, never construct a link.
Returned links are also filtered against the real index server-side, so a
hallucinated href cannot reach the page. Out-of-scope questions get a dry
one-liner and a pointer to the contact page.

## TypeScript

Everything is TypeScript. Nothing is transpiled at deploy time.

- `src/*.ts` are the page scripts. They are classic browser scripts sharing one
  global scope, not modules, and `npm run build:js` compiles them to `js/`,
  **which is committed**. Vercel serves them as static files and never builds
  them. If you edit `src/`, run the build and commit what comes out.
- `api/*.ts` are compiled by Vercel itself, so there is nothing to commit.
- `scripts/` and `test/` run straight from source: Node strips the types.
  `erasableSyntaxOnly` is on so they stay runnable that way, no enums, no
  parameter properties.

Two configs, because the bar differs:

    tsconfig.json        src + api, including noUncheckedIndexedAccess
    tsconfig.tools.json  scripts + test, that one rule relaxed

The relaxed rule is deliberate. Build scripts index regex match groups
constantly, where the strict rule adds noise without catching anything a
crashing build would not. Shipped code keeps it.

## Images

Every photograph ships twice: the JPEG that has always been there, and an AVIF
beside it. `build-srcset` wraps each one in a `<picture>` whose AVIF `<source>`
comes first, so a browser that reads AVIF takes it and one that does not takes
the JPEG and behaves exactly as it did before.

    npm run build:avif

`sharp` writes them, and it is a devDependency: Vercel never runs the build, it
only runs the checks, and the generated files are committed. If sharp is
missing the step logs and skips rather than failing.

**Do not use `sips` for this.** It can write AVIF and the result opens in
Safari and Chrome, but roughly half the files it produced were rejected by
libavif, which is what Firefox uses. That matters more than it sounds: a
`<picture>` chooses a source by MIME type, never by whether the file decodes,
so a bad AVIF is a broken image with no fallback at all. `sharp` produced 14
of 14 valid.

Photographs are written at quality 70 and drawings at 58. At one setting a
kitchen measures around 36 dB against the original and a floor plan around 45,
because line work on white has far less to lose. Two settings, not a
compromise wrong for both.

`npm test` walks the box structure of every AVIF rather than checking it
exists, because a truncated file exists perfectly well.

`picture { display: contents }` keeps the wrapper out of the layout, so every
CSS rule written for the `img` inside still applies.

The hero on each project page is preloaded with `imagesrcset` matching what
`<picture>` will choose, so the largest paint starts before the parser reaches
the markup.

## Checks

    npm test

A dependency-free Node script (`test/check.ts`) that walks the built pages and
fails on: broken internal links, a link that resolves at the root but breaks one
directory down, a `#fragment` that lands on no id, missing images or
stylesheets, a script whose stylesheet is not loaded, a class used in markup
with no matching rule, a CSS rule matching no markup, images without alt text,
unbalanced tags, a page missing its doctype / lang / viewport / favicon / single
h1, a title over 32 characters, nav or footer drifting out of sync, a project
card whose `data-category` matches no filter button, a project no listing page
links to, raw hex outside `css/base.css`, a stale Ask index, an `api/` file that
would be published without a handler, more than one host across the canonicals
and sitemap and robots and structured data, a URL the old site published with
nowhere to land, and any street address appearing in content or filenames.

It does not open a browser, so it cannot catch layout problems. For those, load
each page in an iframe at 320, 390 and 1440px and compare
`documentElement.scrollWidth` with `clientWidth`; anything over zero is
horizontal overflow.

## Running it

Anything that serves the folder over HTTP will do:

    npm start        # python3 -m http.server 8000
    npm run build    # compile src/, resize images, sync chrome, rebuild index
    npm run typecheck
    npm test         # typecheck, then the checks above

Then open http://localhost:8000. Serve it rather than opening `index.html` off
the filesystem: every path in the markup is absolute, so the filesystem gives
you an unstyled page.

## Layout

    index.html                    home
    residential.html              houses, with a category filter
    commercial.html               clubs, clubhouses and retail
    philosophy.html               the three guiding principles
    about.html                    studio, process, location
    contact.html                  inquiry form + FAQ
    privacy.html  terms.html      what the site collects, terms of use
    404.html                      not-found page

    projects/                     one page per project, named for the house
    brand/                        logo, favicons, touch icon
    assets/<project-slug>/        photos and plans, plus their 800px variants
    css/                          base, layout, and one per page or component
    src/                          page scripts in TypeScript
    js/                           compiled output, committed
    api/                          endpoints, plus _private modules
    scripts/                      the build steps
    test/check.ts                 the checks behind `npm test`

    robots.txt  sitemap.xml       generated; sitemap by npm run build:sitemap

Asset folders are named for the project page they belong to, so
`projects/ravine-residence.html` draws on `assets/ravine-residence/`.

Pages live at two depths, so **every path in the markup is root-relative**:
`/css/base.css`, `/assets/…`, `/api/ask`. A relative path works at the root and
breaks inside `projects/`, silently, which is exactly the sort of thing that
looks fine until someone opens a project page. It has happened once already, to
the whole nav.

`scripts/pages.ts` is the single place that knows where pages are. Every build
step and the test suite read from it, so adding another directory of pages is
one edit.

The nav and footer are **in the HTML of every page**, not injected by
JavaScript, so crawlers and no-JS visitors see the whole link graph. They are
generated from one source in `scripts/build-chrome.ts`: edit them there and run
`npm run build:chrome`. `npm test` fails if any page's copy has drifted. The
same file owns the stylesheet links, the share tags and the structured data, so
none of those can be right on one page and stale on another.

`initPage()` is only behaviour: the mobile menu toggle and the Ask panel.

Page titles also live in `scripts/build-chrome.ts`. They are deliberately short so
browser tabs stay readable: "Residential", not "Residential · Lake Effect
Architects". The trade-off is that `<title>` is also the headline Google shows
in search results, so those results carry the page name without the practice
name. If that matters more than tab legibility, add a suffix in the `TITLES`
map and re-run `npm run build:chrome`. `npm test` fails any title over 32
characters.

`brand/logo.svg` is a 680x230 wordmark and is unreadable at 16px, so the
favicon is a separate square mark in `brand/favicon.svg`.

The two PNGs are rendered from it and must be regenerated whenever it changes:

    brand/favicon-32.png       32x32, transparency kept
    brand/apple-touch-icon.png 180x180, drawn on a solid background

The Apple icon is deliberately opaque. `brand/favicon.svg` has rounded corners,
so its own corners are transparent, and iOS renders transparency as black
behind the mask it applies. Render it over the mark's background colour rather than letting
the corners through.

## Security

`vercel.json` sets a Content-Security-Policy, `X-Content-Type-Options`,
`Referrer-Policy`, `X-Frame-Options` and `Permissions-Policy` on every
response, and a year of immutable caching on `assets/` and `brand/`.

The CSP allows Google Fonts and nothing else off-origin. If you add a third
party script, an embedded map or a font from somewhere new, it will be blocked
until the policy names it. Test a policy change by serving the header locally
and listening for `securitypolicyviolation`, rather than by reading it.

## Going live

`SITE_URL` in `scripts/build-chrome.ts` must match where the site is actually
served. It feeds every canonical tag, the sitemap and the structured data, and a
canonical pointing at a domain that does not host these pages tells search
engines to ignore the real ones. `npm test` fails if those four ever name
different hosts.

It is currently the Vercel URL, because `leffect.com` still serves the old
Squarespace site.

**At cutover:**

1. Set `SITE_URL` to `https://leffect.com` in `scripts/build-chrome.ts`.
2. `npm run build`.
3. Change the `Sitemap:` line in `robots.txt` to match.
4. Commit and deploy.

`SITE_URL=https://example.com npm run build` works for a one-off.

The old Squarespace site has eighteen paths in its sitemap. The moment the
domain points here, every one stops being served by Squarespace, and fifteen of
them have no equivalent path on this site. Those are permanent redirects in
`vercel.json`, mapped to the project each became where one exists and to the
listing page where none does. `npm test` reads that list, so renaming a project
page cannot quietly orphan a URL Google already knows about.

Three projects on the old site still have no page here: Catskills Mtns,
Mayflower and Clubhouse Renderings. They redirect to the listings. Forest Cove
had a page built for it, so /forest-cove now points at the project itself.

## Still outstanding

Needing someone outside this repository:

- **`LE_RESEND_API_KEY` is not set**, so `api/contact.ts` returns 503 and every
  inquiry is lost. Verify the sending domain in Resend and check the `FROM`
  address at the top of that file matches a verified sender. Nothing else on
  this list matters as much.
- **The domain**. See "Going live" above.
- **Vercel Analytics** is tagged on every page but does nothing until it is
  switched on under Analytics in the dashboard. Its onboarding shows React
  instructions; ignore them, this site has no framework and the tag is already
  in place.
- **`LE_SHEET_WEBHOOK_URL`** is unset, so inquiries go only to email. Deploy
  `docs/inquiries-sheet.gs` and paste the web app URL in.
- **A monthly cap in the Anthropic Console**, under Billing, Usage limits. At
  about $0.046 a question, $5 is roughly 108 questions.

Thin or unfinished content:

- **The Havenwood Residence** has two photographs where the others have five to
  twelve. Its elevation and both floor plans carry the page.
- **The Links Residence** has no floor plans, and its site plan exists only as
  a 450px scan, which is why `.plan-image.native` exists.
- **No testimonials anywhere.** With the licence, the bio and ten projects in
  place, one attributed line from a past client is the largest remaining gain
  for a visitor deciding whether to write in.

Judgement calls someone else should make:

- **`privacy.html` and `terms.html`** are written in plain language and
  describe what the site actually does. Neither has been reviewed by a lawyer.
- **Body copy is 11 to 12px** at every width. It is a deliberate editorial
  choice, not an oversight, but it is small on a phone.
- **"Rideway Builders"** in Rob's bio is spelled as his resume spells it and
  has not been verified, unlike Booth/Hansen which was corrected.
