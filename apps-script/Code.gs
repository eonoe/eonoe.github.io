/**
 * Coding Agents 101 — signup capture.
 *
 * Deployed as a Google Apps Script Web App and called from the static pages in this
 * repo. Appends signups to a Google Sheet and sends a confirmation email.
 *
 * SETUP (see apps-script/README.md for the full walkthrough):
 *   1. Set SHEET_ID below to the id in your Sheet's URL.
 *   2. Deploy → New deployment → Web app · Execute as "Me" · Access "Anyone".
 *   3. Paste the /exec URL into SIGNUP_ENDPOINT on the three HTML pages.
 *
 * After editing this file you must re-deploy a NEW VERSION, otherwise the old code
 * keeps serving.
 */

var SHEET_ID = 'PASTE_YOUR_SHEET_ID_HERE';
var SHEET_NAME = 'signups';
var SEND_CONFIRMATION = true;

var HEADERS = ['timestamp', 'email', 'source', 'lang', 'page', 'referrer', 'utm', 'user_agent', 'confirmed'];
var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

/** Sanity check: open the /exec URL in a browser and you should see {"ok":true,"ping":true}. */
function doGet() {
  return json({ ok: true, ping: true });
}

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: 'bad_payload' });
  }

  // Honeypot: real people never fill this. Report success so bots don't retry.
  if (String(data.company || '').trim() !== '') {
    return json({ ok: true, duplicate: false });
  }

  var email = String(data.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return json({ ok: false, error: 'invalid_email' });
  }

  var lang = data.lang === 'es' ? 'es' : 'en';
  var source = clip(data.source, 40) || 'unknown';

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json({ ok: false, error: 'busy' });
  }

  try {
    var sheet = getSheet();
    if (isKnownSignup(sheet, email, source)) {
      return json({ ok: true, duplicate: true });
    }

    var confirmed = '';
    if (SEND_CONFIRMATION) {
      confirmed = sendConfirmation(email, lang, source);
    }

    sheet.appendRow([
      new Date(),
      email,
      source,
      lang,
      clip(data.page, 200),
      clip(data.referrer, 300),
      clip(data.utm, 300),
      clip(data.ua, 300),
      confirmed
    ]);

    return json({ ok: true, duplicate: false });
  } catch (err) {
    console.error('signup failed: ' + err);
    return json({ ok: false, error: 'server_error' });
  } finally {
    lock.releaseLock();
  }
}

/** Returns the signups sheet, creating it with headers on first run. */
function getSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Deduped on (email, source) rather than email alone, so someone who joined the
 * workshop can still add themselves to the Tech Lead 2.0 waitlist.
 */
function isKnownSignup(sheet, email, source) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  var existing = sheet.getRange(2, 2, lastRow - 1, 2).getValues();
  for (var i = 0; i < existing.length; i++) {
    if (String(existing[i][0]).trim().toLowerCase() === email &&
        String(existing[i][1]).trim() === source) {
      return true;
    }
  }
  return false;
}

/**
 * Sends the confirmation email. Never throws — a mail failure must not cost us the row.
 * Returns the value for the `confirmed` column: 'yes', 'quota', or 'failed'.
 */
function sendConfirmation(email, lang, source) {
  try {
    if (MailApp.getRemainingDailyQuota() < 1) {
      console.warn('mail quota exhausted, skipping confirmation for ' + email);
      return 'quota';
    }
    var set = source === 'techlead2' ? WAITLIST : CONFIRMATION;
    var msg = set[lang] || set.en;
    MailApp.sendEmail({ to: email, subject: msg.subject, body: msg.body, name: msg.from });
    return 'yes';
  } catch (err) {
    console.error('confirmation email failed for ' + email + ': ' + err);
    return 'failed';
  }
}

var CONFIRMATION = {
  en: {
    from: 'Coding Agents 101',
    subject: "You're in — Coding Agents 101 starts Mon, Aug 17",
    body: [
      "You're signed up for Coding Agents 101. Nothing else to do for now.",
      '',
      'Four live sessions, two hours each, 6:00 PM:',
      '  Mon, Aug 17 — Get an agent doing real work',
      '  Tue, Aug 18 — Context that makes it click',
      '  Wed, Aug 19 — Review like you mean it',
      '  Thu, Aug 20 — Make it stick',
      '',
      'Bring a repo you already work in — you build alongside on your own code.',
      'Every session is recorded, so a missed one is not a problem.',
      '',
      "I'll email the join link before the first session.",
      '',
      'See you Monday.'
    ].join('\n')
  },
  es: {
    from: 'Coding Agents 101',
    subject: 'Ya estás dentro — Coding Agents 101 empieza el lun 17 de agosto',
    body: [
      'Estás apuntado a Coding Agents 101. Por ahora no tienes que hacer nada más.',
      '',
      'Cuatro sesiones en directo, dos horas cada una, a las 18:00:',
      '  Lun 17 ago — Pon un agente a trabajar de verdad',
      '  Mar 18 ago — El contexto que lo cambia todo',
      '  Mié 19 ago — Revisar en serio',
      '  Jue 20 ago — Que se quede contigo',
      '',
      'Trae un repo en el que ya trabajes: vas construyendo sobre tu propio código.',
      'Todas las sesiones se graban, así que si te pierdes una no pasa nada.',
      '',
      'Te enviaré el enlace antes de la primera sesión.',
      '',
      'Nos vemos el lunes.'
    ].join('\n')
  }
};

/** Tech Lead 2.0 isn't open yet — these signups are a waitlist, not an enrolment. */
var WAITLIST = {
  en: {
    from: 'Tech Lead 2.0',
    subject: "You're on the Tech Lead 2.0 list",
    body: [
      "Thanks for your interest in Tech Lead 2.0 — the deep, project-based track.",
      '',
      "It isn't open yet. You're on the list, and you'll hear from me first when dates go out.",
      '',
      'In the meantime, Coding Agents 101 is the free on-ramp and it runs live Aug 17–20:',
      'https://eonoe.github.io/ai-tech-lead/d/dayevent.html',
      '',
      'It covers the same foundations, and it stands on its own whether you go deeper or not.'
    ].join('\n')
  },
  es: {
    from: 'Tech Lead 2.0',
    subject: 'Estás en la lista de Tech Lead 2.0',
    body: [
      'Gracias por tu interés en Tech Lead 2.0, el programa completo basado en proyecto.',
      '',
      'Todavía no está abierto. Estás en la lista y serás de los primeros en saber las fechas.',
      '',
      'Mientras tanto, Coding Agents 101 es la puerta de entrada gratuita, en directo del 17 al 20 de agosto:',
      'https://eonoe.github.io/ai-tech-lead/d/dayevent_es.html',
      '',
      'Cubre las mismas bases y merece la pena por sí solo, sigas o no después.'
    ].join('\n')
  }
};

function clip(value, max) {
  return String(value == null ? '' : value).slice(0, max);
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
