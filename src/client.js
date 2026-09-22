
/* ───────────────────────────────────────────────────────────────────────────
   Bright Wheels Detailing — booking logic.

   You should not need to edit this block. All the settings you actually
   change live in window.BW_CONFIG, near the very top of index.html.
   ─────────────────────────────────────────────────────────────────────────── */

const CFG = (typeof window !== "undefined" && window.BW_CONFIG) || {};
const SHEET_ENDPOINT = (CFG.endpoint || "").trim();
const CONTACT_PHONE  = (CFG.phone || "").trim();
const LEAD_DAYS      = CFG.leadDays == null ? 1 : CFG.leadDays;
const CAPACITY       = CFG.dailyCapacity || 3;
const CLOSED_DAYS    = CFG.closedDays || [0];   // 0 = Sunday

const DOW   = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ── The menu. Prices and on-site minutes live here and nowhere else. ──── */

const PACKAGES = [
  { name: "Wheels", price: 79,  dur: "/ 60 min",  minutes: 60,  tag: "Our specialty",
    items: ["All four wheels, faces and barrels", "Iron & brake-dust decontamination", "Tires scrubbed and dressed", "Wheel wells cleaned out", "Lug nuts and valve stems"] },
  { name: "Wheels + Exterior", price: 139, dur: "/ 2 hrs",   minutes: 120, tag: "Most booked",
    items: ["Everything in Wheels", "Rinseless full exterior wash", "Bug & tar removal", "Spray wax sealant", "Glass in and out", "Door jambs wiped"] },
  { name: "Full Reset",    price: 199, dur: "/ 3\u20134 hrs", minutes: 210, tag: "Best value",
    items: ["Everything in Wheels + Exterior", "Interior vacuum & deep clean", "Seats, mats and carpets shampooed", "Dash, vents and console detailed", "Leather cleaned + conditioned"] }
];

const SIZES = [
  { label: "Sedan / coupe",           extra: 0,  minutes: 0 },
  { label: "Mid-size SUV",            extra: 30, minutes: 20 },
  { label: "Large SUV / truck / van", extra: 60, minutes: 40 }
];

const ADDONS = [
  { id: "glass",   label: "Glass rain repellent", price: 30, minutes: 10 },
  { id: "petHair", label: "Pet hair removal",     price: 45, minutes: 45, fullResetOnly: true }
];

/* The next six open days, starting LEAD_DAYS from today. Rolls forward on
   its own, so the calendar is never stale — nothing here is hardcoded. */
function openDays(count) {
  const out = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + LEAD_DAYS);
  while (out.length < count) {
    if (CLOSED_DAYS.indexOf(d.getDay()) === -1) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function isoDate(d) {
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

function digitsOnly(s) { return (s || "").replace(/\D/g, ""); }

/* Minutes as something a customer can plan around. Rounded to the nearest
   quarter hour, because pretending we know it to the minute is a lie. */
function humanMinutes(total) {
  const r = Math.round(total / 15) * 15;
  const h = Math.floor(r / 60);
  const m = r % 60;
  if (h && m) return h + (h === 1 ? " hr " : " hrs ") + m + " min";
  if (h)      return h + (h === 1 ? " hr" : " hrs");
  return m + " min";
}

function makeRequestId() {
  return "bw-" + Date.now().toString(36) + "-" +
    Math.random().toString(36).slice(2, 8);
}

class Component extends DCLogic {
  state = {
    pkg: 1,
    dayIso: "",
    size: 0,
    addons: {},          // { wheelSeal: true, ... }
    name: "", phone: "", address: "", car: "",
    status: "idle",     // idle | sending | sent | error
    message: "",
    booked: null,       // { "2026-09-22": 2 } once availability loads
    requestId: ""
  };

  /* Ask the Apps Script how many slots are already taken, so a full day
     shows as full. If this fails we fail OPEN — better to take the booking
     and sort it out by text than to turn a customer away over a fetch. */
  componentDidMount() {
    if (!SHEET_ENDPOINT) {
      console.warn(
        "[Bright Wheels] window.BW_CONFIG.endpoint is empty — bookings are " +
        "NOT being saved. See Part 2 of SETUP.md."
      );
      return;
    }
    fetch(SHEET_ENDPOINT + "?availability=1")
      .then(function (r) { return r.json(); })
      .then((d) => {
        if (d && d.counts) this.setState({ booked: d.counts });
      })
      .catch(function () { /* fail open */ });
  }

  missingFields() {
    const gaps = [];
    if (this.state.name.trim().length < 2) gaps.push("your name");
    if (digitsOnly(this.state.phone).length < 10) gaps.push("a mobile number");
    if (this.state.address.trim().length < 5) gaps.push("the address where the car is parked");
    return gaps;
  }

  submit(payload) {
    fetch(SHEET_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json(); })
      .then((d) => {
        if (!d || !d.ok) throw new Error((d && d.error) || "rejected");
        this.setState({
          status: "sent",
          requestId: "",
          message: "Got it. We'll text " + this.state.phone.trim() +
                   " within the hour to confirm."
        });
      })
      .catch(() => {
        /* The row may well have landed anyway — the request id means a retry
           can't double-book, so it is safe to invite one. */
        this.setState({
          status: "error",
          message: CONTACT_PHONE
            ? "That didn't go through. Try once more, or text us at " +
              CONTACT_PHONE + " and we'll lock it in."
            : "That didn't go through — please try once more."
        });
      });
  }

  renderVals() {
    const tiers = PACKAGES.map((t, i) => {
      const hot = i === 1;
      return {
        name: t.name, price: "$" + t.price, dur: t.dur, tag: t.tag, items: t.items,
        bg: hot ? "#10182B" : "#FFFFFF",
        fg: hot ? "#FFFFFF" : "#10182B",
        border: hot ? "#10182B" : "#E4E7EC",
        rule: hot ? "rgba(255,255,255,0.16)" : "#E4E7EC",
        dot: hot ? "#FFC531" : "#1E6FB8",
        tagBg: hot ? "#FFC531" : "#EEF3F9",
        tagFg: hot ? "#10182B" : "#1E6FB8",
        btnBg: hot ? "#FFC531" : "#10182B",
        btnFg: hot ? "#10182B" : "#FFFFFF"
      };
    });

    const names = PACKAGES.map((p) => p.name);

    const pkgOptions = names.map((label, i) => {
      const on = this.state.pkg === i;
      return {
        label: label + " · $" + PACKAGES[i].price,
        select: () => this.setState({ pkg: i, status: "idle", message: "" }),
        bg: on ? "#10182B" : "#FFFFFF",
        fg: on ? "#FFFFFF" : "#10182B",
        border: on ? "#10182B" : "#D9DDE5"
      };
    });

    /* ── The calendar strip ───────────────────────────────────────────── */
    const dates = openDays(6);
    const booked = this.state.booked;

    const dayInfo = dates.map((d) => {
      const iso  = isoDate(d);
      const used = booked ? (booked[iso] || 0) : 0;
      const left = CAPACITY - used;
      return {
        iso: iso,
        date: d,
        full: booked ? left <= 0 : false,
        slots: !booked ? "Open"
             : left <= 0 ? "Full"
             : left === 1 ? "1 slot"
             : left + " slots"
      };
    });

    /* Default to the first open day, and move off a day that filled up. */
    let selected = this.state.dayIso;
    const stillOpen = dayInfo.some((d) => d.iso === selected && !d.full);
    if (!stillOpen) {
      const firstOpen = dayInfo.find((d) => !d.full);
      selected = firstOpen ? firstOpen.iso : "";
    }

    const days = dayInfo.map((d) => {
      const on = d.iso === selected && !d.full;
      return {
        dow: DOW[d.date.getDay()],
        num: String(d.date.getDate()),
        slots: d.slots,
        select: () => {
          if (!d.full) this.setState({ dayIso: d.iso, status: "idle", message: "" });
        },
        bg:     d.full ? "#F2F3F5" : on ? "#1E6FB8" : "#FFFFFF",
        fg:     d.full ? "#A9AFBB" : on ? "#FFFFFF" : "#10182B",
        border: d.full ? "#E4E7EC" : on ? "#1E6FB8" : "#D9DDE5",
        slotColor: d.full ? "#A9AFBB" : on ? "rgba(255,255,255,0.85)" : "#1E7A45"
      };
    });

    const chosen = dayInfo.find((d) => d.iso === selected) || dayInfo[0];
    const chosenLabel = chosen
      ? DOW[chosen.date.getDay()].charAt(0) + DOW[chosen.date.getDay()].slice(1).toLowerCase() +
        " " + chosen.date.getDate() + " " + MONTH[chosen.date.getMonth()]
      : "no day selected";

    /* ── Vehicle size ─────────────────────────────────────────────────── */
    const sizeOptions = SIZES.map((sz, i) => {
      const on = this.state.size === i;
      return {
        label: sz.label + (sz.extra ? " +$" + sz.extra : ""),
        select: () => this.setState({ size: i, status: "idle", message: "" }),
        bg: on ? "#10182B" : "#FFFFFF",
        fg: on ? "#FFFFFF" : "#10182B",
        border: on ? "#10182B" : "#D9DDE5"
      };
    });

    /* ── Add-ons. Pet hair needs the interior work, so Full Reset only. ── */
    const addonAvailable = (a) => !a.fullResetOnly || this.state.pkg === 2;
    const addonOn = (a) => addonAvailable(a) && !!this.state.addons[a.id];

    const addonOptions = ADDONS.map((a) => {
      const usable = addonAvailable(a);
      return {
        label: a.label + " (+$" + a.price + " \u00b7 +" + a.minutes + " min)" +
               (a.fullResetOnly ? " \u2014 Full Reset only" : ""),
        on: addonOn(a),
        disabled: !usable,
        color: usable ? "#5A6377" : "#A9AFBB",
        cursor: usable ? "pointer" : "not-allowed",
        toggle: () => {
          if (!usable) return;
          this.setState((st) => {
            const next = Object.assign({}, st.addons);
            next[a.id] = !next[a.id];
            return { addons: next, status: "idle", message: "" };
          });
        }
      };
    });

    const chosenAddons = ADDONS.filter(addonOn);
    const addonTotal   = chosenAddons.reduce((n, a) => n + a.price, 0);
    const addonMinutes = chosenAddons.reduce((n, a) => n + a.minutes, 0);

    const pkg    = PACKAGES[this.state.pkg];
    const size   = SIZES[this.state.size];
    const amount = pkg.price + size.extra + addonTotal;
    const estMinutes = pkg.minutes + size.minutes + addonMinutes;

    const busy = this.state.status === "sending";

    return {
      heroStats: [
        { v: "60min", l: "All four wheels, done right" },
        { v: "$" + PACKAGES[0].price, l: "Starting price, flat" },
        { v: "0", l: "Hoses needed — we work rinseless" }
      ],
      founders: [
        { initials: "TK", first: "Tilek", last: "Karaev" },
        { initials: "RI", first: "Ramazan", last: "Iusupov" }
      ],
      ticker: ["Wheel & rim specialists", "Rinseless — no hose needed", "Same-day quotes", "Cash, card, Zelle, Venmo"],
      services: [
        { n: "01", title: "Wheel & rim deep clean", body: "Faces, barrels, spokes and lug nuts. pH-neutral iron remover pulls out the baked-in brake dust a car wash never touches.", time: "60 min" },
        { n: "02", title: "Tires & wheel wells", body: "Sidewalls scrubbed back to black, wells degreased, then a satin dressing that doesn't sling onto your paint.", time: "+20 min" },
        { n: "03", title: "Rinseless exterior wash", body: "A full exterior wash using two gallons and a stack of plush towels. No hose, no runoff, safe for apartment garages.", time: "60 – 90 min" },
        { n: "04", title: "Interior deep clean", body: "Vacuum, shampoo, vents and seams. Pet hair pulled out with rubber blades — golden retriever tested.", time: "90 min – 2 hrs" }
      ],
      steps: [
        { k: "STEP 1", title: "Book online", body: "Pick your package and a day. Takes about a minute — no account, no deposit." },
        { k: "STEP 2", title: "We pull up", body: "Two of us and a Camry full of gear. Because we work rinseless, a parking spot is all we need — no hose, no outlet, no mess." },
        { k: "STEP 3", title: "Walk out to clean wheels", body: "We text you when it's done and walk you around it. Pay on the spot, however you like." }
      ],
      tiers,
      pkgOptions,
      days,
      sizeOptions,
      addonOptions,
      summaryLine: [
        pkg.name,
        chosenLabel,
        size.label,
        chosenAddons.length ? "+ " + chosenAddons.map((a) => a.short || a.label.split(" \u2014 ")[0]).join(", ") : ""
      ].filter(Boolean).join(" · "),
      timeLine: "About " + humanMinutes(estMinutes) + " on site",
      total: "$" + amount,
      fields: {
        name: this.state.name, phone: this.state.phone,
        address: this.state.address, car: this.state.car
      },
      setName:    (e) => this.setState({ name: e.target.value, status: "idle", message: "" }),
      setPhone:   (e) => this.setState({ phone: e.target.value, status: "idle", message: "" }),
      setAddress: (e) => this.setState({ address: e.target.value, status: "idle", message: "" }),
      setCar:     (e) => this.setState({ car: e.target.value, status: "idle", message: "" }),

      submitBusy: busy,
      submitLabel: busy ? "Sending…"
                 : this.state.status === "sent" ? "Request sent ✓"
                 : "Request this slot",
      /* One-item list when there's something to say, empty otherwise — the
         template has sc-for but no sc-if, and an empty div would leave a
         26px hole in the card. */
      statusLines: this.state.message
        ? [{
            text: this.state.message,
            color: this.state.status === "sent" ? "#1E7A45"
                 : this.state.status === "error" ? "#B3261E"
                 : "#8A6D00",
            tint: this.state.status === "sent" ? "#EAF7F0"
                 : this.state.status === "error" ? "#FDECEA"
                 : "#FFF6E0"
          }]
        : [],

      onSubmit: () => {
        if (busy) return;                       // no double-submit

        const gaps = this.missingFields();
        if (gaps.length) {
          const list = gaps.length === 1 ? gaps[0]
            : gaps.slice(0, -1).join(", ") + " and " + gaps[gaps.length - 1];
          this.setState({ status: "error", message: "We still need " + list + "." });
          return;
        }
        if (!chosen || chosen.full) {
          this.setState({ status: "error", message: "Pick a day that still has a slot open." });
          return;
        }
        if (!SHEET_ENDPOINT) {
          this.setState({
            status: "error",
            message: CONTACT_PHONE
              ? "Online booking isn't switched on yet — text us at " + CONTACT_PHONE + "."
              : "Online booking isn't switched on yet."
          });
          return;
        }

        /* Keep the same id across retries so a resend can't double-book. */
        const requestId = this.state.requestId || makeRequestId();
        this.setState({ status: "sending", message: "", requestId: requestId });

        this.submit({
          requestId: requestId,
          submittedAt: new Date().toISOString(),
          date: chosen.iso,
          dayLabel: chosenLabel,
          package: pkg.name,
          vehicleSize: size.label,
          addons: chosenAddons.map((a) => a.label.split(" \u2014 ")[0]).join(", "),
          estMinutes: estMinutes,
          total: amount,
          name: this.state.name.trim(),
          phone: this.state.phone.trim(),
          address: this.state.address.trim(),
          car: this.state.car.trim()
        });
      }
    };
  }
}
