import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not URL.pathname — the project path has spaces and
// non-ASCII characters, which pathname leaves percent-encoded.
const EXPORT = fileURLToPath(new URL('..', import.meta.url));
const SRC = `${EXPORT}/index.original.html`;
const OUT = `${EXPORT}/index.html`;
const SITE_URL = 'https://bright-wheels.net/';

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

/* ── 3b. markup: static prices in the hero and the pricing note ───────── */
const TEXT_SWAPS = [
  ['and we do them rinseless, at your place, for $69.',
   'and we do them rinseless, at your place, from $79.'],

  ['<div style="font: 900 44px/1 \'Archivo\', sans-serif; color: #FFFFFF; letter-spacing: -0.02em;">$69</div>',
   '<div style="font: 900 44px/1 \'Archivo\', sans-serif; color: #FFFFFF; letter-spacing: -0.02em;">$79</div>'],

  ["Sedan pricing shown. SUVs and trucks add $20. Pet hair removal is +$45 on the Full Reset. Heavy curb rash and refinishing we'll refer out \u2014 we'd rather tell you than guess.",
   "Sedan pricing shown. Mid-size SUVs add $30, large SUVs and trucks $60. Add-ons are priced on the booking form. Paint correction, ceramic coating, heavy curb rash and refinishing we'll refer out \u2014 we'd rather tell you than guess."],
];
for (const [from, to] of TEXT_SWAPS) {
  if (!tpl.includes(from)) throw new Error('text swap target not found: ' + from.slice(0, 60));
  tpl = tpl.replace(from, to);
}

/* ── 3c. markup: vehicle-size and add-on steps, renumbered ─────────────── */
const LABEL = "font: 600 12px/1 'Work Sans'; letter-spacing: 0.18em; text-transform: uppercase; color: #8A93A6;";

const DETAILS_OLD = `        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="${LABEL}">3 · Your details</div>`;
if (!tpl.includes(DETAILS_OLD)) throw new Error('details heading not found');

const NEW_STEPS = `        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="${LABEL}">3 · Vehicle size</div>
          <div style="display: flex; flex-wrap: wrap; gap: 10px;">
            <sc-for list="{{ sizeOptions }}" as="v" hint-placeholder-count="3">
              <button type="button" sc-camel-on-click="{{ v.select }}" style="font: 600 15px/1 'Work Sans'; padding: 14px 20px; min-height: 44px; border-radius: 999px; cursor: pointer; border: 1.5px solid {{ v.border }}; background: {{ v.bg }}; color: {{ v.fg }};">{{ v.label }}</button>
            </sc-for>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="${LABEL}">4 · Add-ons <span style="letter-spacing: 0; text-transform: none; font-weight: 400; color: #A9AFBB;">— optional</span></div>
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <sc-for list="{{ addonOptions }}" as="a" hint-placeholder-count="5">
              <label style="display: flex; align-items: center; gap: 10px; font: 400 15px/1.4 'Work Sans'; color: {{ a.color }}; cursor: {{ a.cursor }}; padding: 7px 0;">
                <input type="checkbox" checked="{{ a.on }}" disabled="{{ a.disabled }}" sc-camel-on-change="{{ a.toggle }}" style="width: 20px; height: 20px; accent-color: #1E6FB8; cursor: {{ a.cursor }}; flex: none;">
                {{ a.label }}
              </label>
            </sc-for>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="${LABEL}">5 · Your details</div>`;
tpl = tpl.replace(DETAILS_OLD, NEW_STEPS);

/* ── 3d. markup: retire the standalone pet-hair checkbox ───────────────── */
const PET_OLD = `          <label style="display: flex; align-items: center; gap: 10px; font: 400 15px/1.4 'Work Sans'; color: {{ petLabelColor }}; cursor: {{ petCursor }}; padding: 6px 0;">
            <input type="checkbox" checked="{{ petHair }}" disabled="{{ petDisabled }}" sc-camel-on-change="{{ togglePet }}" style="width: 20px; height: 20px; accent-color: #1E6FB8; cursor: {{ petCursor }};">
            Add pet hair removal (+$45) — Full Reset only
          </label>
`;
if (!tpl.includes(PET_OLD)) throw new Error('pet hair checkbox not found');
tpl = tpl.replace(PET_OLD, '');

/* ── 3e. markup: show how long the job will take, next to the price ───── */
const SUMMARY_OLD = `          <div style="display: flex; flex-direction: column; gap: 3px;">
            <div style="font: 400 14px/1.3 'Work Sans'; color: #5A6377;">{{ summaryLine }}</div>
            <div style="font: 900 32px/1 'Archivo', sans-serif; letter-spacing: -0.02em;">{{ total }}</div>
          </div>`;
const SUMMARY_NEW = `          <div style="display: flex; flex-direction: column; gap: 5px;">
            <div style="font: 400 14px/1.4 'Work Sans'; color: #5A6377;">{{ summaryLine }}</div>
            <div style="font: 900 32px/1 'Archivo', sans-serif; letter-spacing: -0.02em;">{{ total }}</div>
            <div style="font: 500 13px/1.3 'Work Sans'; color: #8A93A6;">{{ timeLine }}</div>
          </div>`;
if (!tpl.includes(SUMMARY_OLD)) throw new Error('summary block not found');
tpl = tpl.replace(SUMMARY_OLD, SUMMARY_NEW);

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
      endpoint: "https://script.google.com/macros/s/AKfycbzg8DUr0bR6MQhekUVPcRs6fAy3spryulHDTvCBH_0ZwjJseeTtgTpVH3LZkz6qLxkY/exec",

      // Your business number, shown if a booking fails to send.
      phone: "(484) 689-9625",

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
  ['size step',              rt.includes('{{ sizeOptions }}')],
  ['addons step',            rt.includes('{{ addonOptions }}')],
  ['time estimate',          rt.includes('{{ timeLine }}')],
  ['old pet checkbox gone',  !rt.includes('{{ togglePet }}')],
  ['steps renumbered',       rt.includes('5 \u00b7 Your details')],
  ['new hero price',         rt.includes('>$79<')],
  ['no stale $69',           !rt.includes('$69')],
  ['no stale $219',          !rt.includes('$219')],
  ['no stale $279',          !rt.includes('$279')],
  ['no stale $169',          !rt.includes('$169')],
  ['sealant removed',        !rt.includes('Wheel sealant')],
  ['headlights removed',     !rt.includes('Headlight restoration')],
  ['engine bay removed',     !rt.includes('Engine bay')],
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
