# Putting this on your phone

The app is an installable PWA. Once it's on an HTTPS URL you can add it to your
home screen and it runs fullscreen, offline, like an app.

## Why it has to be hosted (not just your LAN IP)

You've been opening it at `http://172.30.1.10:5173`. Two things break there:

- **`crypto.randomUUID` and `crypto.subtle` don't exist.** They're restricted to
  *secure contexts* — HTTPS, or `localhost` exactly. A LAN IP is neither. The app
  has fallbacks for both (`src/lib/id.ts`, `src/lib/hash.ts`), but they exist
  only because of this.
- **Service workers won't register**, so there's no offline support and no real
  "install".

`localhost` is a secure context; `172.30.1.10` is not. That's the whole reason
hosting matters.

## Deploying

```bash
npm run build      # outputs dist/ (~1.1 MB)
```

Then either:

**Netlify / Vercel (recommended).** Push the repo to GitHub and connect it.
Build command `npm run build`, publish directory `dist`. Both give HTTPS and a
URL automatically, and redeploy on every push. Free tier is plenty.

**Anything static.** `dist/` is plain files — any static host works, as long as
it serves HTTPS and rewrites unknown paths to `index.html` (single-page app).

### One required setting

Add an SPA fallback so a reload on any path serves `index.html`:

- **Netlify** — create `public/_redirects` containing `/*  /index.html  200`
- **Vercel** — add `vercel.json` with a rewrite of `/(.*)` → `/index.html`

Without it the service worker handles navigation once installed, but a hard
reload before install 404s.

## Installing on the phone

- **iOS (Safari only):** open the URL → Share → *Add to Home Screen*. Chrome on
  iOS cannot install PWAs; it has to be Safari.
- **Android (Chrome):** open the URL → menu → *Install app* / *Add to Home
  screen*.

It then launches fullscreen with no browser chrome, its own icon, and its own
task-switcher entry.

## What works offline

Precached on install (~1 MB, 24 files): the app shell, all deck JSON, icons,
manifest. Google Fonts are cached on first load.

Already handled by the app itself:

- Deck JSON is mirrored into IndexedDB (`deckCache`), so sessions cold-start
  with no network (§9).
- TTS audio is cached by sentence hash — tap **Prepare for offline** on the
  Study screen before a commute to pre-download the session's audio.
- Review logs, FSRS state and concept mastery are all local; there's no sync
  step and nothing to lose when offline.

So after one online visit, the whole app works on the Underground.

## The API key

`VITE_OPENAI_API_KEY` is **compiled into the bundle**. Anyone who can open the
site can read it out of the JS. For a public URL, don't ship it:

1. Leave the env var unset at build time.
2. Enter the key in the app instead — it's stored in IndexedDB (`settings`),
   never in the bundle.

**Do not** reach for site-wide password protection as the alternative. It looks
like it solves the key problem, but it breaks the thing this whole file exists
for — see below.

## Site access control breaks the PWA

Netlify's site protection (and Vercel's equivalent) gates *every* request behind
a login redirect, including `/sw.js`, which then comes back as `401
text/html` instead of JavaScript. Service worker registration requires a 2xx
response with a JS MIME type, so it fails outright:

- no service worker → **no offline, and no install prompt**
- on iOS, a home-screen PWA doesn't share Safari's cookie jar, so the installed
  app hits the login gate again with no good way through it
- offline navigation would resolve to a login redirect rather than the app

So the two goals are mutually exclusive: you can have a gated site, or an
installable offline app, not both. For this app the resolution is the one above
— leave `VITE_OPENAI_API_KEY` unset at build time, keep the site open, and enter
the key in the app, where it lives in IndexedDB on your phone only.

A gated site is still useful while you're testing in a desktop browser; just
turn the protection off before expecting install or offline to work.

## Updating

`registerType: 'autoUpdate'` — the service worker fetches a new version in the
background and swaps it in on the next launch. No update prompt, no versioning
UI. Redeploy and the phone picks it up.

## What is deliberately not shipped

`npm run build` does **not** copy the kuromoji dictionary (~17 MB) into `dist/`.
The deployed app never loads it: decks ship pre-segmented (§16) and the study
screen only reads cached segmentation. It lives in `.kuromoji-dict/` (outside
`public/`) and is served by the dev server only, for the deck-authoring path.
This is why `dist/` is 1.1 MB rather than 18 MB.

`npm run dev` still copies it, so nothing changes locally.

## Icons

Generated, not hand-drawn:

```bash
npm run icons     # writes public/icons/
```

`scripts/make-icons.mjs` encodes the PNGs directly (no image dependency), so the
set can be regenerated at any size. Edit the palette or shapes there.
