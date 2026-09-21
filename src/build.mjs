import fs from 'node:fs';

const EXPORT = new URL('..', import.meta.url).pathname;
const SRC = `${EXPORT}/index.original.html`;
const OUT = `${EXPORT}/index.html`;
const SITE_URL = 'https://iusupov-ramazan.github.io/Bright-Wheels-Detailing/';

// Keep a pristine copy the first time we run.
if (!fs.existsSync(SRC)) fs.copyFileSync(`${EXPORT}/index.html`, SRC);

let html = fs.readFileSync(SRC, 'utf8');

/* ── 1. pull the template out ─────────────────────────────────────────── */
const TPL_RE = /(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/;
const m = html.match(TPL_RE);
if (!m) throw new Error('template script tag not found');
let tpl = JSON.parse(m[2]);
const before = tpl;

/* ── 2. swap the whole x-dc logic block for the new client.js ─────────── */
const LOGIC_RE = /(<script type="text\/x-dc"[^>]*>)([\s\S]*?)(<\/script>)/;
if (!LOGIC_RE.test(tpl)) throw new Error('x-dc logic script not found');
const client = fs.readFileSync(new URL('client.js', import.meta.url), 'utf8');
tpl = tpl.replace(LOGIC_RE, (_, open, __, close) => open + client + '\n' + close);

/* ── 3. markup: rename the click handler, disable while sending ───────── */
const BTN_OLD = `<button type="button" sc-camel-on-click="{{ submit }}" style="font: 700 16px/1 'Work Sans'; background: #FFC531; color: #10182B; border: none; padding: 18px 34px; min-height: 48px; border-radius: 999px; cursor: pointer;" style-hover="background: #FFD866;">{{ submitLabel }}</button>`;
const BTN_NEW = `<button type="button" sc-camel-on-click="{{ onSubmit }}" disabled="{{ submitBusy }}" style="font: 700 16px/1 'Work Sans'; background: #FFC531; color: #10182B; border: none; padding: 18px 34px; min-height: 48px; border-radius: 999px; cursor: pointer;" style-hover="background: #FFD866;">{{ submitLabel }}</button>`;
if (!tpl.includes(BTN_OLD)) throw new Error('submit button markup not found');
tpl = tpl.replace(BTN_OLD, BTN_NEW);

/* ── 4. markup: a status line under the button ────────────────────────── */
const ANCHOR = `${BTN_NEW}
        </div>`;
const STATUS = `${BTN_NEW}
        </div>

        <sc-for list="{{ statusLines }}" as="s" hint-placeholder-count="0">
          <div style="font: 500 14.5px/1.5 'Work Sans'; color: {{ s.color }}; background: {{ s.tint }}; border-left: 3px solid {{ s.color }}; padding: 13px 16px; border-radius: 0 10px 10px 0;">{{ s.text }}</div>
        </sc-for>`;
if (!tpl.includes(ANCHOR)) throw new Error('status anchor not found');
tpl = tpl.replace(ANCHOR, STATUS);

if (tpl === before) throw new Error('template unchanged — nothing applied');

/* ── 5. put the template back, escaping </ the way the bundler does ───── */
const encoded = JSON.stringify(tpl).replace(/<\//g, '<\\u002F');
html = html.replace(TPL_RE, (_, open, __, close) => open + encoded + close);

/* ── 6. the editable config block, in plain sight at the top ──────────── */
const CONFIG = `  <!-- ═══════════════════════════════════════════════════════════════════
       BRIGHT WHEELS — SETTINGS. This is the only part of this file you
       ever need to edit. Everything below is generated; leave it alone.
       ═══════════════════════════════════════════════════════════════════ -->
  <script>
    window.BW_CONFIG = {

      // Paste the /exec URL from your Google Apps Script deployment here.
      // Until you do, the booking form tells people to text you instead.
      // (SETUP.md, Part 2.)
      endpoint: "",

      // Your business number, shown if a booking fails to send.
      phone: "",

      // How many cars you can do in a day. A day that hits this shows "Full".
      dailyCapacity: 3,

      // Soonest bookable day. 1 = tomorrow, 0 = today, 2 = day after.
      leadDays: 1,

      // Days you don't work. 0 = Sunday, 1 = Monday … 6 = Saturday.
      closedDays: [0]
    };
  </script>

`;
if (html.includes('BRIGHT WHEELS — SETTINGS')) throw new Error('config block already present');
const headIdx = html.indexOf('  <script>');
if (headIdx === -1) throw new Error('loader script not found');
html = html.slice(0, headIdx) + CONFIG + html.slice(headIdx);

/* ── 6b. static <head> tags: tab title, Google, and link previews ─────── */
const FAVICON = "data:image/svg+xml," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">' +
  '<rect width="120" height="120" rx="22" fill="#10182B"/>' +
  '<circle cx="60" cy="60" r="44" fill="none" stroke="#FFC531" stroke-width="9"/>' +
  '<g stroke="#FFC531" stroke-width="9" stroke-linecap="round">' +
  '<line x1="60" y1="26" x2="60" y2="94"/><line x1="30" y1="43" x2="90" y2="77"/>' +
  '<line x1="30" y1="77" x2="90" y2="43"/></g>' +
  '<circle cx="60" cy="60" r="13" fill="#FFC531"/>' +
  '<circle cx="60" cy="60" r="5" fill="#10182B"/></svg>'
);

const TITLE = 'Bright Wheels Detailing — mobile wheel &amp; rim detailing';
const DESC  = 'Mobile wheel and rim specialists. We come to you, work rinseless ' +
              '— no hose, no outlet, no mess. Wheels from $69, booked online in a minute.';

const META = `  <!-- ═══════════════════════════════════════════════════════════════════
       HOW THE SITE LOOKS IN GOOGLE AND WHEN YOU TEXT SOMEONE THE LINK.
       Change SITE_URL below once you have your own domain, and put your
       phone number in "telephone". Keep the phone in step with the one in
       BW_CONFIG above.
       ═══════════════════════════════════════════════════════════════════ -->
  <title>${TITLE}</title>
  <meta name="description" content="${DESC}">
  <meta name="theme-color" content="#10182B">
  <link rel="icon" href="${FAVICON}">

  <meta property="og:type" content="website">
  <meta property="og:title" content="${TITLE}">
  <meta property="og:description" content="${DESC}">
  <meta property="og:url" content="${SITE_URL}">
  <meta property="og:image" content="${SITE_URL}logo-lockup-dark.png">
  <meta name="twitter:card" content="summary_large_image">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "AutoWash",
    "name": "Bright Wheels Detailing",
    "description": "Mobile wheel and rim detailing. Rinseless — no hose needed.",
    "url": "${SITE_URL}",
    "telephone": "",
    "priceRange": "$69-$219",
    "areaServed": ["Los Angeles", "San Francisco Bay Area"],
    "openingHours": "Mo-Sa 08:00-18:00",
    "serviceType": "Mobile car detailing"
  }
  </script>

`;

if (!/<title>Bundled Page<\/title>\n/.test(html)) throw new Error('placeholder title not found');
html = html.replace(/  <title>Bundled Page<\/title>\n/, META);

// The bundler swaps in the template's own <html>, so the tab title has to be
// in there too or it goes blank the moment the page finishes loading.
if (tpl.includes('<title>')) throw new Error('template already has a title');
tpl = tpl.replace('<meta charset="utf-8">',
  `<meta charset="utf-8">\n<title>${TITLE}</title>\n<link rel="icon" href="${FAVICON}">`);
const encoded2 = JSON.stringify(tpl).replace(/<\//g, '<\\u002F');
html = html.replace(TPL_RE, (_, open, __, close) => open + encoded2 + close);

fs.writeFileSync(OUT, html);

/* ── 7. verify by decoding the result back out ────────────────────────── */
const check = fs.readFileSync(OUT, 'utf8');
const rt = JSON.parse(check.match(TPL_RE)[2]);
const ok = [
  ['config block present',   check.includes('BRIGHT WHEELS — SETTINGS')],
  ['config before loader',   check.indexOf('BRIGHT WHEELS — SETTINGS') < check.indexOf('DOMContentLoaded')],
  ['round-trips',            rt === tpl],
  ['no raw </script>',       !check.match(TPL_RE)[2].includes('</script>')],
  ['onSubmit bound',         rt.includes('{{ onSubmit }}')],
  ['old submit gone',        !rt.includes('sc-camel-on-click="{{ submit }}"')],
  ['status line present',    rt.includes('{{ statusLines }}')],
  ['reads BW_CONFIG',        rt.includes('window.BW_CONFIG')],
  ['no hardcoded Sept days', !rt.includes('dow: "MON", num: "22"')],
  ['static title',           /<title>Bright Wheels/.test(check)],
  ['no placeholder title',   !check.includes('Bundled Page')],
  ['og tags',                check.includes('og:image')],
  ['structured data',        check.includes('application/ld+json')],
  ['template title',         rt.includes('<title>Bright Wheels')],
];
for (const [label, pass] of ok) console.log((pass ? '  ok   ' : '  FAIL ') + label);
if (ok.some(([, p]) => !p)) process.exit(1);
console.log(`\nindex.html rebuilt — ${(check.length / 1024).toFixed(0)} KB`);
