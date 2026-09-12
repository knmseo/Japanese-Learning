# Font originals — not served

The `.otf`/`.ttf` originals of Cafe24 Moyamoya live here rather than in
`public/fonts/`. Anything under `public/` is copied verbatim into `dist/` and
uploaded on every deploy, and these two are ~1.1MB of formats no browser needs
when a `.woff2` is available.

They are kept because they are the source files — convert from here if you ever
need another format. The web build only ever loads what is in `public/fonts/`.
