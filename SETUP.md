# Bright Wheels Detailing — putting the site online

Everything you need is in this `export/` folder. Total time: about 30 minutes,
and it costs nothing.

---

## What's in here

| File | What it is |
|---|---|
| `index.html` | The whole website in one file. No build step, no dependencies. |
| `apps-script.gs` | The code that catches bookings and writes them into a Google Sheet and your Calendar. |
| `index.original.html` | The version before the Google wiring. Backup only — ignore it. |
| `logo.svg` | The logo, scalable — give this to the print shop and the sign maker. |
| `logo-lockup-dark.png` / `-light.png` | Full logo, 2800px wide, for social headers and flyers. |
| `logo-mark-dark.png` / `-light.png` | Just the wheel, square, 1600px. |
| `logo-social-avatar.png` | Square profile picture for Instagram / Google Business. |
| `business-card-front.png` / `-back.png` | 3.5×2in at 300dpi — print-ready as-is. |
| `src/` | The booking logic in editable form, plus the script that rebuilds `index.html`. You only need this if you want to change how booking works. |

---

## Do Part 2 first

Part 1 puts the site online. Part 2 makes bookings actually reach you.
**Do Part 2 first**, then publish. A live site that silently drops bookings is
worse than no site.

---

## Part 2 — Bookings into Google Sheets + Calendar

### 1. Create the sheet

New Google Sheet. Name it **Bright Wheels Bookings**. You don't need to rename
any tabs — the script creates a `Bookings` tab itself the first time it runs.

### 2. Open the script editor

In that sheet: **Extensions → Apps Script**.

### 3. Paste the code

Delete whatever's in `Code.gs`. Paste the entire contents of `apps-script.gs`.

At the top there are four settings. The only one you must change is `NOTIFY`:

```js
var NOTIFY = '';            // ← your email goes here
var CALENDAR_ID = 'primary';
var DAILY_CAPACITY = 3;
var DAY_START_HOUR = 9;
```

To get a **text message** instead of an email, use your carrier's SMS gateway:

- AT&T — `4846899625@txt.att.net`
- Verizon — `4846899625@vtext.com`
- T-Mobile — `4846899625@tmomail.net`

`DAILY_CAPACITY` is how many cars you can do in a day. Once a day hits it, the
website shows that day as **Full** and nobody can book into it.

Save (the disk icon).

### 4. Check it works before you deploy

In the toolbar, pick the **`selfTest`** function and click **Run**. Google will
ask you to authorize — click through **Advanced → Go to (unsafe)** → **Allow**.
That warning is normal for your own scripts.

You should get, within a few seconds:

- a row in the **Bookings** tab
- a yellow event on tomorrow's calendar
- an email or text

Delete the test row and the test event once you've seen them.

### 5. Deploy it

**Deploy → New deployment**. Click the gear next to "Select type" and choose
**Web app**. Then:

- **Execute as:** Me
- **Who has access:** **Anyone** ← this matters. Not "Anyone with Google account".

Click **Deploy**, and copy the **Web app URL** — it ends in `/exec`.

### 6. Paste it into the site

Open `index.html` in any text editor. The settings are in a clearly marked block
at the very top — about 25 lines in, before anything else:

```js
window.BW_CONFIG = {
  endpoint: "",          // ← paste the /exec URL here
  phone: "",             // ← your business number
  dailyCapacity: 3,
  leadDays: 1,
  closedDays: [0]
};
```

Fill in `endpoint` and `phone`:

```js
  endpoint: "https://script.google.com/macros/s/AKfy.../exec",
  phone: "(484) 689-9625",
```

Save. That is the only part of `index.html` you ever need to edit.

> **Every time you redeploy the Apps Script, use Deploy → Manage deployments →
> edit the existing one → New version.** If you create a *new* deployment you
> get a *new* URL and the site keeps posting to the old one.

---

## Part 1 — GitHub and the domain

### Already done

The repo is `github.com/iusupov-ramazan/Bright-Wheels-Detailing`, the site is
pushed, and Pages is serving `main` / `(root)`. To publish a change later:

```bash
cd export
git add -A && git commit -m "what changed" && git push
```

Pages redeploys within a minute or two.

### 4. Your domain — bright-wheels.net

The domain is already registered at Squarespace and already set as the custom
domain in GitHub Pages. The only thing left is DNS, and it's all in the
Squarespace panel: **Settings → Domains → bright-wheels.net → DNS Settings**.

**Step 1 — delete the "Squarespace Defaults" preset.** Use the bin icon on the
whole preset block. That removes the four A records, the `www` CNAME pointing
at `ext-sq.squarespace.com`, and the HTTPS record in one go. All three point at
Squarespace's servers and all three have to go — the HTTPS record especially,
because it pins Squarespace's IP addresses and will keep sending some browsers
to the wrong place even after you fix the A records.

**Step 2 — add these under "Custom records":**

| Type | Name | Data |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | iusupov-ramazan.github.io |

Leave the **Email Security** preset alone. Those three TXT records say "no mail
is ever sent from this domain", which is correct and worth keeping.

**Step 3 — wait, then tick the box.** DNS takes anywhere from ten minutes to a
few hours. On the GitHub Pages settings page, press **Check again** until the
red "improperly configured" banner clears. Once it does, **Enforce HTTPS**
becomes available — tick it. GitHub issues the certificate free.

Until DNS propagates the site is live at the GitHub address:

```
https://iusupov-ramazan.github.io/Bright-Wheels-Detailing/
```

## Before you publish — 60-second checklist

- [ ] `endpoint` filled in at the top of `index.html`
- [ ] `phone` filled in at the top of `index.html`
- [ ] `NOTIFY` in the Apps Script set to your real email or SMS gateway
- [ ] `selfTest` ran clean — row, calendar event, and alert all arrived
- [ ] You submitted one real booking on the live site and saw it land
- [ ] Prices on the site match what you'll actually charge

**If you skip the endpoint**, the form doesn't pretend to work — it tells the
customer to text you at the number in `phone`. So fill in `phone` even if you
put off the Google setup.

---

## How the booking form behaves

**The calendar rolls forward on its own.** It shows the next six working days
starting tomorrow, skips Sundays, and never goes stale. Change any of that in
`BW_CONFIG`: `leadDays: 0` to allow same-day, `closedDays: [0, 1]` to close
Sundays and Mondays too.

**Full days are real.** On load the site asks your Apps Script how many
bookings each day already has and greys out anything at `DAILY_CAPACITY`. If
that check fails, every day shows as open — it'd rather take a booking you have
to move than turn a customer away.

**A booking never silently disappears.** The button says "Sending…", then either
"Request sent ✓" with a confirmation line, or an honest failure that points the
customer at your phone number. Every request carries an id, so if a customer
hits the button twice, or retries after a failure, you still only get one row.

**The form checks itself.** Name, mobile number (10+ digits) and address are
required before it will send. Car is optional.

---

## Notes worth knowing

**Your job board is the Status column.** The script writes "New" into column K.
Change it to "Confirmed" / "Done" / "Cancelled" as you work. Anything marked
`Cancelled` frees its slot back up on the website automatically. Use
**Format → Conditional formatting** to colour them.

**Calendar events are yellow and say UNCONFIRMED.** They're stacked from
`DAY_START_HOUR` in booking order — a guess at the timing, not a promise. Drag
them to the real time when you confirm by text.

**Free tier limits.** Apps Script allows 100 emails/day and plenty of requests.
You will not come close.

**Before you print the cards:** replace the QR placeholder on the back with a
real QR code pointing at your live URL. qr-code-generator.com, free, use the
midnight colour `#10182B`.

**Photos.** The site ships with no photographs — the hero and the founders
section use designed graphic panels instead, so it looks finished on day one.
Swap in real photos as soon as you have them; they will outperform the
graphics every time. What to shoot:

1. **One hero wheel shot.** A single wheel, half cleaned, half still filthy,
   shot straight on in daylight. This one photo sells the whole business.
2. **The two of you** next to the Camry with your gear out.

**First things to claim, in this order:**
1. Google Business Profile — free, and it's how people in your neighbourhood
   actually find a mobile detailer. Do this before the website.
2. Instagram `@bright_wheels_detailing` — before/after wheel shots are the whole
   marketing strategy for your first 50 customers.
3. Nextdoor business page — genuinely effective for driveway services.
