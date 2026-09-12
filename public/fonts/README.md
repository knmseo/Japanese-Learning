# Self-hosted fonts

Two faces the Figma file specifies have no CDN, so they are served from here.
`src/styles/classical.css` declares them; `vite.config.ts` precaches
`woff`/`woff2` so they survive going offline.

| File | Face | Used by |
| --- | --- | --- |
| `PyeongChang-Regular.woff` | PyeongChang Regular | the Korean gloss under each Japanese chunk (18px) |
| `Cafe24Moyamoya-Face-v1.0.woff2` (+ `.woff`) | Cafe24 Moyamoya | the stat numerals (35px) |

PyeongChang was supplied as `woff` only. Converting it to `woff2` would cut
roughly 40% off the ~425KB each file currently costs — worth doing if the two
faces ever feel slow on a phone connection.

Note that Cafe24 Moyamoya draws **zero as a solid filled oval with a slash**.
That is the typeface, not a rendering bug, but it means a stat sitting at 0
reads as a dark blob rather than a digit.

The `.otf`/`.ttf` originals, and `PyeongChang-Bold.woff`, are in `fonts-src/`
at the repo root, deliberately outside `public/` so they are not copied into
the deploy. The Bold cut is there rather than here because nothing in the
design uses a bold Korean face, and precaching it cost 432KB for nothing —
move it back and re-add its `@font-face` rule if that changes.

The third substitution is handled in CSS, not here: the mockup's Japanese face,
Hiragino Maru Gothic ProN, is an Apple system font with no web licence, so
**Zen Maru Gothic** is served from Google Fonts in its place. See DESIGN.md.
