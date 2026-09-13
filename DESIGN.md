# Design spec — Figma "App Design"

Extracted from the Figma file via Dev Mode MCP, not transcribed by eye.
Source: `WXK4YAvBF2v1Cqg9m6b8Gq`, page `0:1`. Frame node ids are noted per
section so any value here can be re-checked against the file.

Reference frame is **402 × 874** (iPhone 16 Pro logical size). The `#d9d9d9`
66px band at the top of every frame is the iOS status bar placeholder — it is
part of the device chrome, not the app.

## Tokens

### Colour (`Colour Palette` 3:2, plus values read off the screens)

| Role | Value | Where |
| --- | --- | --- |
| Ground | `#f5ede7` | every screen background |
| Surface | `#ffffff` | cards, deck tiles, saved rows, rating buttons |
| Ink / outline | `#020005` | 2px borders on cards, tiles, saved rows; 1.5px on rating pills |
| Shadow (cards/tiles) | `#020005` | deck tiles, sentence card, saved rows |
| Shadow (pills) | `#312f2a` | rating buttons; also the saved-row border when pressed |
| Accent — teal | `#99c2c4` | selected deck tile, selected saved row, toggle knob |
| Press — yellow | `#ffe500` | pressed rating button fill |
| Stat — salmon | `#f69687` | stat tile (Days Studied) |
| Stat — green | `#b2d983` | stat tile (Concepts Seen) |
| Japanese text | `#474747` | sentence text |
| Korean gloss | `#c2c2c2` | per-chunk gloss |
| Muted — counter | `#646464` | "3 / 35" |
| Muted — labels | `#797979` | inactive tab labels, saved-row counts |
| Muted — meta | `#aaaaaa` | "35 sentences" |
| Stat tile border | `#444144` | 2px, and the 4px shadow under each tile |
| Icon stroke | `#82C8CC` | all Iconsax glyphs — a lighter teal than the `#99c2c4` fills |

Stat tiles fill at **60% alpha** over the ground: `rgba(153,194,196,.6)`,
`rgba(246,150,135,.6)`, `rgba(178,217,131,.6)`, `rgba(255,229,0,.6)`.

### Type

| Family | Weights used | Applied to |
| --- | --- | --- |
| Kaisei Tokumin | Bold, Medium, Regular | `STUDY`/`BROWSE` eyebrow (18 Bold), deck names (15 Medium), deck meta (10 Medium), tab labels (12 — Bold active / Regular inactive), Settings headings (18 Bold) |
| Lora | Medium, Regular | section headings `Study Decks`/`Saved` (20 Medium), rating labels (18 Medium), saved-row labels (18 Medium), saved counts (15 Medium), stat captions (12 Medium), `3 / 35` (15 Regular) |
| Hiragino Maru Gothic ProN W4 | — | Japanese sentence, 25px |
| PyeongChang Regular | — | Korean glosses, 18px |
| Cafe24 Moyamoya Regular | — | stat numerals, 35px |

**Three of these are not web fonts** — see "Open questions" below.

### The press affordance (`Resources` 17:63)

The mockup specs rest and pressed side by side against a baseline rule:

- Rest — `bg:#fff`, `border:1.5px #020005`, `radius:24px`, `shadow:0 4px 0 0 #312f2a`, `y:60`
- Pressed — `bg:#ffe500`, `border:1.5px #020005`, `radius:24px`, **no shadow**, `y:64`

y moves down by exactly the shadow depth, so the bottom edge holds still.
That is the mechanic `src/lib/press.ts` already implements — the only change
is the pressed fill becomes **yellow `#ffe500`**, not an accent tint.

## Screens

### StudyTab — no translation (1:31) / with translation (4:279)

- Eyebrow `STUDY` at `24,89`; counter `3 / 35` at `24,~119`
- Deck name centred at `y 189`, Kaisei Tokumin Medium 18
- Card `left 41, top 233, w 321`; **h 176 closed → 235 revealed**
  `bg:#fff`, `border:2px #020005`, `radius:20px`, `shadow:0 8px 0 0 #020005`
- `archive-add` icon 24px at `55,244`; `volume-high` 24px at `325,244`
- Japanese 25px `#474747`; glosses 18px `#c2c2c2` beneath each chunk
- Rating pills 170×48, `radius:24`, `border:1.5px #020005`, `shadow:0 4px 0 0 #312f2a`
  - Easy `25,616` · Needed Text `205,616` · Don't know `116,687`
  - labels Lora Medium 18, black

### BrowseTab — Library (5:547), deck pressed (39:813), saved pressed (39:833)

- Eyebrow `BROWSE` at `24,89`
- Tabs Library/Stats/Settings at `y 138.5`, 12px; active Bold black, inactive Regular `#797979`
- Divider full-width hairline at `y 152`; active-tab underline is a second, shorter rule on the same y
- Section headings `Study Decks` (`32,169`) and `Saved` (`32,522`), Lora Medium 20
- Deck tiles 185×129, `radius:12`, `border:2px #020005`, `shadow:0 4px 0 0 #020005`
  - two staggered scrolling rails; row 1 at `y 209`, row 2 at `y 352`
  - name 15 Kaisei Medium top-left; `35 sentences` 10px `#aaa` bottom-right
  - **selected** — fill `#99c2c4`, no shadow, `y+4`
- Saved rows 335×60 at `34,565` and `34,645`, `radius:20`,
  `border:2px #020005`, `shadow:0 5px 0 0 #020005`
  - label centred Lora Medium 18; count right-aligned 15 `#797979`
  - **selected** — fill `#99c2c4`, border `#312f2a`, no shadow, `y+4`

### BrowseTab — Stats (51:1014)

- Top card `26,180`, 353×214, `radius:10`, **no border**, `shadow:0 2px 5px 1px rgba(0,0,0,.1)`
  — drawn empty in the mockup; this is the heatmap container
- Four stat tiles 146×82, `radius:10`, `border:2px #444144`,
  `shadow:0 4px 0 0 #444144, 0 2px 5px 1px rgba(0,0,0,.1)`
  - `38,437` teal — numeral 41 — caption **Sentences Reviewed**
  - `218,437` salmon — 12 — **Days Studied**
  - `38,591` green — 11 — **Concepts Seen**
  - `218,591` yellow — 14 — **Sessions Done**
- Numerals Cafe24 Moyamoya 35px black, centred in the tile
- Captions Lora Medium 12 black, centred ~17px below the tile

### BrowseTab — Settings (51:1080)

Only two headings are drawn — `OpenAI Voice` (`33,~202`) and
`Activation Token` (`33,249`), both Kaisei Tokumin Bold 18. No fields,
helper text, or states are specified.

### Saved Words overlay (`SavedWords Tab` 59:1702 stack, 59:1824 selected)

Opened by the Saved Words row, which no longer scopes a study session — these
words are for reviewing and hearing, not for rating.

- Scrim over the whole app: `rgba(0,0,0,.4)` with `backdrop-filter: blur(2.5px)`
- Title plate `0,17`, 177×50 — flush to the left edge, so it carries a 2px
  `#020005` border on top/right/bottom only and radius 12 on the right corners;
  shadow `0 4px 4px 4px rgba(0,0,0,.25), 0 4px 0 0 #020005`. Label Kaisei
  Tokumin Medium 20 at x 24
- Stack cards 287×129, radius 12, white, `2px #444144`, shadow
  `0 4px 4px 4px rgba(0,0,0,.25), 0 4px 0 0 #444144`, **rotated 5°**
  - resting left −90, first at y 119, each next **+51** — so only a 51px strip
    of each shows and the word has to sit high inside it (word centre 28px from
    the card top, meaning 81px, visible only on the bottom card)
- **Selected** — straightens to 0°, fills `#99c2c4`, moves to `96,395`, and the
  rest of the stack retreats a further **140px** left (−94.8 → −234.8). Text
  moves down to 44 / 79
- `Okay!` button `181,546`, 116×48 — dismisses the selection back into the
  stack, not the whole overlay

Selecting a word also speaks it through the normal TTS path.

**Deviation:** the frames put the stack on the left, cut off at the left edge,
and the selected state slides it *further* left. The request described the
cards coming in "from the right"; the resting layout follows the frames, and
the entrance animates in from the left to match.

### Screen toggle (Toggle_1 36:638 / Toggle_2 36:659)

- Track 112×56, drawn as a vector outline (not a plain rounded rect)
- Knob 46px circle, `left 5 / right 61` within the track, fill `#99c2c4`
- Active side shows its 24px icon inside the knob; inactive side shows a
  small `10×25` dash placeholder
- Icons: `note-2` = Study, `search-status` = Browse

## Icons

Iconsax (vuesax) **linear** set, 24px — replacing the current Lucide icons:
`archive-add` (save), `volume-high` (audio), `note-2` (study tab),
`search-status` (browse tab). Exported SVGs were pulled from the file;
Figma's asset URLs expire in ~7 days, so they must be committed, not linked.

## Status

All five phases are built: A foundation (tokens, fonts, press, icons),
B Study, C Library, D Stats, E Settings / screen toggle / undrawn states.
Every geometry figure quoted below was verified in the browser by measurement
rather than by eye.

## Decisions

Settled with the user before implementation started, plus two taken during the
build:

- **The stats numerals are `#444144`**, matching the tile outline, and the
  fifth figure (*Concepts Known*) is **not** shown — the mockup draws exactly
  four tiles. `conceptsKnown` is still computed in `studyStats`.
- **The rating pills' outline matches their slab (`#312F2A`).** The frame
  actually draws a `#020005` border over a `#312F2A` slab; the two reading as
  one edge was preferred. Applied to every pill, not just the three rating
  buttons. Cards, tiles and rows are unaffected — their outline and slab were
  already the same `#020005`.
- **The count-up is damped, not eased-out.** It runs on the same
  `cubic-bezier(0.34, 1.56, 0.64, 1)` as `--ease-damped`, whose second control
  point sits above 1, so a figure overshoots and settles: 41 counts past itself
  to 45, then drops back. Verified in the DOM.
- **The light/dark toggle is removed** pending a designed dark theme. The dark
  palette and `getThemeVars()` are untouched and `DarkModeToggle.tsx` is kept
  unreferenced, so restoring it is a one-line change in `App.tsx`.
- **Cafe24 Moyamoya draws zero as a solid filled oval with a slash.** Verified
  at 80px that it is a real designed glyph with its own advance width, not a
  missing-character box. Accepted as-is, so a stat sitting at 0 reads as a dark
  blob.

1. **Japanese text → Zen Maru Gothic** (Google Fonts). Hiragino Maru Gothic
   ProN is an Apple system font with no web licence; Zen Maru Gothic is the
   closest rounded-gothic match and renders the same on every device.
2. **Korean glosses and stat numerals keep PyeongChang and Cafe24 Moyamoya**,
   self-hosted from `public/fonts/` and precached for offline. Both confirmed
   loading and applied.
3. **Dark mode stays.** The mockup is light-only, so the dark palette is
   derived from these tokens rather than designed — flagged as judgement, not
   specification.
4. **Nothing gets deleted.** Features the mockup doesn't draw (offline
   pre-download, session-complete, loading/error/empty states, study-ahead)
   are restyled into the new system rather than removed.

## Still unspecified

- **Fixed 402px geometry.** Every position above is absolute within a
  402×874 frame. The app is fluid, so these translate into proportional
  layout rather than copied coordinates — spacing ratios and component sizes
  are honoured, absolute offsets are not.
- **The heatmap's own contents.** The mockup draws its container only.
- **Every state not drawn** — see decision 4; those are my judgement.
