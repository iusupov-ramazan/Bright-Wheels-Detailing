/**
 * Bright Wheels Detailing — booking backend.
 *
 * WHERE THIS GOES: script.google.com, not your website.
 * Step-by-step instructions are in SETUP.md, Part 2.
 *
 * What it does with every booking the site sends:
 *   1. writes a row into the "Bookings" tab of this spreadsheet
 *   2. puts a tentative event on your Google Calendar
 *   3. emails (or texts) you so you know within seconds
 *
 * It also answers the site's availability check, so a day that already has
 * DAILY_CAPACITY bookings shows as "Full" and nobody can book into it.
 */

/* ── Settings — these four lines are the only ones you need to touch ─────── */

/** Where new-booking alerts go. Your email, or a carrier SMS gateway
 *  (AT&T 5551234567@txt.att.net · Verizon @vtext.com · T-Mobile @tmomail.net).
 *  Leave empty to switch alerts off. */
var NOTIFY = '';

/** Calendar to put jobs on. 'primary' is the calendar of whichever Google
 *  account owns this script. Set to '' to switch calendar events off. */
var CALENDAR_ID = 'primary';

/** How many cars the two of you can realistically do in one day. */
var DAILY_CAPACITY = 3;

/** When the working day starts. Events are stacked from here. */
var DAY_START_HOUR = 9;

/* ── Below here you shouldn't need to change anything ───────────────────── */

var SHEET_NAME = 'Bookings';

var HEADERS = [
  'Submitted', 'Date', 'Day', 'Package', 'Pet hair', 'Total',
  'Name', 'Phone', 'Address', 'Car', 'Status', 'Request ID', 'Calendar event'
];

/** Minutes on site, so the calendar block is the right length. */
var DURATION = {
  'Wheel Refresh': 60,
  'Wheels + Wash': 120,
  'Full Reset': 210
};

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);

  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#10182B')
      .setFontColor('#FFC531');
    sh.setFrozenRows(1);
    sh.setColumnWidth(9, 260);   // Address
  }
  return sh;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Bookings per date that still count against capacity. */
function counts_() {
  var sh = sheet_();
  var last = sh.getLastRow();
  var out = {};
  if (last < 2) return out;

  var rows = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  var tz = Session.getScriptTimeZone();

  for (var i = 0; i < rows.length; i++) {
    var status = String(rows[i][10] || '').toLowerCase();
    if (status === 'cancelled' || status === 'canceled') continue;

    var d = rows[i][1];
    if (!d) continue;
    var key = (d instanceof Date)
      ? Utilities.formatDate(d, tz, 'yyyy-MM-dd')
      : String(d).slice(0, 10);

    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

/* ── The site asks this on page load, to grey out full days ─────────────── */

function doGet(e) {
  if (e && e.parameter && e.parameter.availability) {
    try {
      return json_({ ok: true, capacity: DAILY_CAPACITY, counts: counts_() });
    } catch (err) {
      return json_({ ok: false, error: String(err) });
    }
  }
  return ContentService.createTextOutput('Bright Wheels booking endpoint is live.');
}

/* ── The site posts here when someone books ─────────────────────────────── */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
  } catch (err) {
    return json_({ ok: false, error: 'busy' });
  }

  try {
    var data = JSON.parse(e.postData.contents);
    var sh = sheet_();

    // A retry after a flaky connection reuses its request id, so the same
    // booking can never land twice.
    var reqId = String(data.requestId || '');
    if (reqId && sh.getLastRow() > 1) {
      var ids = sh.getRange(2, 12, sh.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === reqId) {
          return json_({ ok: true, duplicate: true });
        }
      }
    }

    var pkg     = String(data.package || '');
    var petHair = String(data.petHair || 'no');
    var iso     = String(data.date || '');           // yyyy-mm-dd
    var total   = data.total || '';

    var eventId = '';
    if (CALENDAR_ID && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      eventId = addToCalendar_(iso, pkg, petHair, data, counts_()[iso] || 0);
    }

    sh.appendRow([
      new Date(),
      iso ? new Date(iso + 'T12:00:00') : '',
      String(data.dayLabel || ''),
      pkg,
      petHair,
      total,
      String(data.name || ''),
      String(data.phone || ''),
      String(data.address || ''),
      String(data.car || ''),
      'New',
      reqId,
      eventId
    ]);

    notify_(data);

    return json_({ ok: true });

  } catch (err) {
    // Never lose a booking to a bug in here — mail it to yourself raw.
    try {
      if (NOTIFY) {
        MailApp.sendEmail(NOTIFY, 'Bright Wheels — booking FAILED to save',
          String(err) + '\n\n' + (e && e.postData ? e.postData.contents : '(no body)'));
      }
    } catch (ignored) {}
    return json_({ ok: false, error: String(err) });

  } finally {
    lock.releaseLock();
  }
}

/** Tentative block on the calendar, stacked after anything already booked. */
function addToCalendar_(iso, pkg, petHair, data, alreadyBooked) {
  try {
    var cal = (CALENDAR_ID === 'primary')
      ? CalendarApp.getDefaultCalendar()
      : CalendarApp.getCalendarById(CALENDAR_ID);
    if (!cal) return '';

    var minutes = (DURATION[pkg] || 90) + (petHair === 'yes' ? 45 : 0);

    var parts = iso.split('-');
    var start = new Date(+parts[0], +parts[1] - 1, +parts[2], DAY_START_HOUR, 0, 0);
    // Stack each job after the last, roughly, so the day reads in order.
    start.setMinutes(start.getMinutes() + alreadyBooked * 150);
    var end = new Date(start.getTime() + minutes * 60000);

    var ev = cal.createEvent(
      pkg + ' — ' + (data.name || 'Booking') + ' ($' + (data.total || '') + ')',
      start, end,
      {
        location: String(data.address || ''),
        description: [
          'UNCONFIRMED — call or text to confirm the time.',
          '',
          'Name:    ' + (data.name || ''),
          'Phone:   ' + (data.phone || ''),
          'Address: ' + (data.address || ''),
          'Car:     ' + (data.car || ''),
          'Package: ' + pkg,
          'Pet hair: ' + petHair,
          'Total:   $' + (data.total || '')
        ].join('\n')
      }
    );
    // Yellow, so unconfirmed jobs stand out from everything else.
    ev.setColor(CalendarApp.EventColor.YELLOW);
    return ev.getId();

  } catch (err) {
    return 'calendar error: ' + err;
  }
}

function notify_(data) {
  if (!NOTIFY) return;
  try {
    MailApp.sendEmail(
      NOTIFY,
      'New booking: ' + (data.package || '') + ' — $' + (data.total || ''),
      [
        (data.name || '') + ' · ' + (data.phone || ''),
        (data.dayLabel || data.date || ''),
        data.address || '',
        data.car || '',
        'Pet hair: ' + (data.petHair || 'no')
      ].join('\n')
    );
  } catch (err) { /* an alert failing must never lose the booking */ }
}

/* ── Run this once from the editor to check everything is wired up ──────── */

function selfTest() {
  var iso = Utilities.formatDate(
    new Date(Date.now() + 86400000), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  doPost({ postData: { contents: JSON.stringify({
    requestId: 'selftest-' + Date.now(),
    date: iso,
    dayLabel: 'TEST',
    package: 'Wheel Refresh',
    petHair: 'no',
    total: 69,
    name: 'Self test',
    phone: '555-0100',
    address: '1 Test Street',
    car: 'Toyota Camry'
  }) } });

  Logger.log('Wrote a test row. Check the Bookings tab, your calendar and your inbox, then delete it.');
}
