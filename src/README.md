# Rebuilding index.html

You do **not** need any of this to run the site. `../index.html` is finished and
self-contained, and its settings block at the top is the only thing you normally
edit. This folder is here so the booking logic can be changed later without
reverse-engineering the bundle again.

`../index.html` is a bundled artifact export: fonts, React and the page markup
are packed into two `<script type="__bundler/...">` blobs near the bottom of the
file. The page markup lives inside one of them as a JSON-escaped string, so you
can't usefully hand-edit it.

- `client.js` — the booking logic (calendar, validation, submit, availability).
- `build.mjs` — unpacks `../index.original.html`, splices `client.js` and the
  markup patches into it, and writes `../index.html`.

To change the booking behaviour:

```bash
cd src
# edit client.js
node build.mjs
```

It rebuilds from `../index.original.html` every time, so it's safe to re-run,
and it self-checks the result. **It writes a fresh settings block**, so copy
your `endpoint` and `phone` back in afterwards.
