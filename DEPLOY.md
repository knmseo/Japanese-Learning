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

**Vercel (what this repo is set up for).** Push to GitHub and import the repo
at vercel.com/new. `vercel.json` already pins the build command (`npm run
build`) and output directory (`dist`), and routes `/api/tts` to the edge
function in `api/tts.ts` — no dashboard configuration needed beyond the env
vars below. Every push to `main` redeploys; every PR gets its own preview URL.
Free tier is plenty for this.

**Anything static.** `dist/` is plain files — any static host works, as long as
it serves HTTPS and rewrites unknown paths to `index.html` (single-page app).

### One required setting

The SPA fallback — so a reload on any path serves `index.html` instead of
404ing — is already in `vercel.json`: a rewrite of everything except `/api/*`
to `/index.html`. The `/api/*` exclusion matters: without it, a rewrite would
intercept the TTS proxy's own requests before Vercel's function router ever
sees them.

Without the fallback, the service worker handles navigation once installed,
but a hard reload before install 404s.

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

Vercel's Deployment Protection (password or SSO) gates *every* request behind
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

## Sharing with friends (the shared voice)

Friends can use the app with no key at all — it falls back to the device's
built-in Japanese voice. If you want them to get OpenAI's voice instead,
`api/tts.ts` proxies TTS using **your** key, held server-side.

**Setup** — in Vercel → Project → Settings → Environment Variables:

| Variable | Value | Notes |
|---|---|---|
| `OPENAI_API_KEY` | your key | **No `VITE_` prefix.** That prefix is what puts it in the public bundle. |
| `ACCESS_TOKENS` | `alice-7fq2,bob-p4xd,carol-9mz1` | Comma-separated, one per person. Make them long and unguessable. |

Set both for the **Production** environment at minimum (add Preview too if you
want invite links to work on preview deploys). Then redeploy — unlike Netlify,
Vercel does **not** apply an env var change to the live deployment until you
trigger a new one (Deployments → ⋯ → Redeploy).

**Inviting someone** — send them their own link:

```
https://your-project.vercel.app/?k=alice-7fq2
```

Opening it once stores the token and strips it from the URL. No code to
type, no login. They add it to their home screen and it just works.

**Revoking someone** — delete their token from `ACCESS_TOKENS` and redeploy.
Their app keeps working; it falls back to the built-in voice.

**Cost control.** The token allowlist is the main guard, plus a pinned model
and a 200-character input cap, and the browser caches every clip so a
sentence is fetched once ever. There is deliberately **no per-user rate
limit** — that needs persistent storage the function doesn't have. The real
backstop is a hard monthly spend limit on your OpenAI account; set one. If a
token leaks, remove it and redeploy.

**Your own device** doesn't use the proxy: a key saved in Settings wins, so
you spend against your account directly and keep working if the proxy is
down.

## Updating

`registerType: 'autoUpdate'` — the service worker fetches a new version in the
background and swaps it in on the next launch. No update prompt, no versioning
UI. Redeploy and the phone picks it up.

## Migrating from Netlify

This repo used to deploy to Netlify (`netlify/functions/tts.mts`,
`netlify.toml`); both are gone, replaced by `api/tts.ts` and `vercel.json`. The
only behavior difference: env var changes need an explicit redeploy on Vercel
(Netlify picked them up on the next build regardless). If a Netlify site for
this project is still live, its `?k=` invite links point at a different origin
than the new Vercel one — reissue invites once you've cut over.

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
