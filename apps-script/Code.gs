/**
 * Coding Agents 101: signup capture.
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
var SHEET_NAME = 'signups';          // the workshop
var TECHLEAD_SHEET_NAME = 'techlead'; // the AI Tech Lead waitlist (source 'techlead2')
var SEND_CONFIRMATION = true;

// The four sessions, for the calendar file and the "add to calendar" links.
// start is UTC: 6:00 PM GMT-4 is 22:00Z. Keep the dates in the email copy below in sync.
var MEET_URL = 'https://meet.google.com/qxk-zffm-ojo';
var SESSION_MINUTES = 120;
// 6:00 PM Santo Domingo is GMT-4 all year. These conversions hold for December (standard time everywhere listed).
var TZ_NOTE = {
  en: '6:00 PM is Santo Domingo time (GMT-4). That is 5:00 PM in New York and Bogota, 4:00 PM in Mexico City and 11:00 PM in Madrid. The calendar events show in your own time zone.',
  es: 'Las 6:00 PM son hora de Santo Domingo (GMT-4). Equivale a las 5:00 PM en Nueva York y Bogotá, las 4:00 PM en Ciudad de México y las 11:00 PM en Madrid. Los eventos del calendario se ven en tu zona horaria.'
};
var SESSIONS = [
  { start: '20261208T220000Z', en: 'Get an agent doing real work', es: 'Pon un agente a trabajar de verdad' },
  { start: '20261210T220000Z', en: 'Context that makes it click', es: 'El contexto que lo cambia todo' },
  { start: '20261215T220000Z', en: 'Review like you mean it', es: 'Revisar en serio' },
  { start: '20261217T220000Z', en: 'Make it stick', es: 'Que se quede contigo' }
];

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
    var sheet = getSheet(source);
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

/**
 * Returns the tab for this signup's source, creating it with headers on first run.
 * Workshop signups and the Tech Lead waitlist live on separate tabs so each list
 * can be read, counted and mailed on its own.
 */
function getSheet(source) {
  var name = source === 'techlead2' ? TECHLEAD_SHEET_NAME : SHEET_NAME;
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Deduped on (email, source) rather than email alone, so someone who joined the
 * workshop can still add themselves to the AI Tech Lead waitlist.
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
 * Sends the confirmation email. Never throws, because a mail failure must not cost us the row.
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
    var mail = { to: email, subject: msg.subject, body: msg.body, name: msg.from };
    if (msg.html) mail.htmlBody = renderHtml(msg.html, lang, set === CONFIRMATION);
    if (set === CONFIRMATION) {
      mail.attachments = [Utilities.newBlob(buildIcs(lang), 'text/calendar', 'coding-agents-101.ics')];
    }
    MailApp.sendEmail(mail);
    return 'yes';
  } catch (err) {
    console.error('confirmation email failed for ' + email + ': ' + err);
    return 'failed';
  }
}

/** yyyymmddThhmmssZ in UTC. */
function icsStamp(d) { return Utilities.formatDate(d, 'UTC', "yyyyMMdd'T'HHmmss'Z'"); }

function sessionEnd(start) {
  var t = Date.UTC(+start.slice(0, 4), +start.slice(4, 6) - 1, +start.slice(6, 8), +start.slice(9, 11), +start.slice(11, 13));
  return icsStamp(new Date(t + SESSION_MINUTES * 60000));
}

// One recurring event: Tuesday and Thursday, one occurrence per session. If the schedule stops being
// Tue/Thu, change this rule (or go back to one event per session).
var RECURRENCE = 'RRULE:FREQ=WEEKLY;BYDAY=TU,TH;COUNT=' + SESSIONS.length;

function sessionDetails(lang) {
  var list = CONFIRMATION[lang].html.sessions.map(function (s) { return s[0] + ': ' + s[1]; }).join('\n');
  return lang === 'es'
    ? 'Link de Meet (el mismo para las cuatro sesiones): ' + MEET_URL + '\n6:00 PM hora de Santo Domingo (GMT-4).\n\n' + list + '\n\nTrae un repo en el que ya trabajes.'
    : 'Meet link (the same for all four sessions): ' + MEET_URL + '\n6:00 PM Santo Domingo time (GMT-4).\n\n' + list + '\n\nBring a repo you already work in.';
}

function icsEscape(t) {
  return String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** Folds a content line at 73 characters, as RFC 5545 asks. */
function icsFold(line) {
  var out = [];
  while (line.length > 73) { out.push(line.slice(0, 73)); line = ' ' + line.slice(73); }
  out.push(line);
  return out.join('\r\n');
}

/** One calendar file with ONE recurring event covering the four sessions, carrying the Meet link. */
function buildIcs(lang) {
  var first = SESSIONS[0].start;
  var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//eonoe.github.io//Coding Agents 101//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:coding-agents-101-' + first + '@eonoe.github.io',
    'DTSTAMP:' + icsStamp(new Date()),
    'DTSTART:' + first,
    'DTEND:' + sessionEnd(first),
    RECURRENCE,
    'SUMMARY:' + icsEscape('Coding Agents 101'),
    'DESCRIPTION:' + icsEscape(sessionDetails(lang)),
    'LOCATION:' + icsEscape(MEET_URL),
    'URL:' + MEET_URL,
    'X-GOOGLE-CONFERENCE:' + MEET_URL,
    'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:Coding Agents 101', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'];
  return lines.map(icsFold).join('\r\n') + '\r\n';
}

/** "Add to Google Calendar" link for the whole series, with the Meet link as the location. */
function gcalUrl(lang) {
  var first = SESSIONS[0].start;
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    '&text=' + encodeURIComponent('Coding Agents 101') +
    '&dates=' + first + '/' + sessionEnd(first) +
    '&recur=' + encodeURIComponent(RECURRENCE) +
    '&details=' + encodeURIComponent(sessionDetails(lang)) +
    '&location=' + encodeURIComponent(MEET_URL);
}

var CONFIRMATION = {
  en: {
    from: 'Coding Agents 101',
    subject: "You're in: Coding Agents 101 starts Tue, Dec 8",
    body: [
      "You're signed up for Coding Agents 101.",
      '',
      'Four live sessions, two hours each, 6:00 PM:',
      '  Tue, Dec 8: Get an agent doing real work',
      '  Thu, Dec 10: Context that makes it click',
      '  Tue, Dec 15: Review like you mean it',
      '  Thu, Dec 17: Make it stick',
      '',
      TZ_NOTE.en,
      '',
      'Bring a repo you already work in. You build alongside on your own code.',
      'Every session is recorded, so a missed one is not a problem.',
      '',
      'Meet link, the same for all four sessions: ' + MEET_URL,
      'A calendar file is attached: one event repeating Tuesday and Thursday, with the Meet link.',
      '',
      "I'll send a short pre-work checklist before the first session.",
      "If you want a head start, this is the 15-minute read I'd do first:",
      'https://eonoe.github.io/guides/intro-coding-agents/',
      '',
      'See you Tuesday.'
    ].join('\n'),
    html: {
      lines: ["You're signed up for Coding Agents 101."],
      when: 'Four live sessions, two hours each, 6:00 PM (GMT-4):',
      sessions: [
        ['Tue, Dec 8', 'Get an agent doing real work'],
        ['Thu, Dec 10', 'Context that makes it click'],
        ['Tue, Dec 15', 'Review like you mean it'],
        ['Thu, Dec 17', 'Make it stick']
      ],
      after: [
        'Bring a repo you already work in: you build alongside on your own code. Every session is recorded, so a missed one is not a problem.',
        'The Meet link is the same for all four sessions: <a href="' + MEET_URL + '" style="color:#3531ff;">meet.google.com/qxk-zffm-ojo</a>.',
        "I'll send a short pre-work checklist before the first session. If you want a head start, this is the 15-minute read I'd do first:"
      ],
      tz: TZ_NOTE.en,
      calTitle: 'Add the four sessions to your calendar',
      calButton: '+ Add to my calendar',
      calNote: 'One event repeating every Tuesday and Thursday, with the Meet link. The attached .ics file does the same in one click.',
      cta: ['Read the guide \u2192', 'https://eonoe.github.io/guides/intro-coding-agents/'],
      bye: 'See you Tuesday.',
      foot: ['four live sessions', 'https://eonoe.github.io/']
    }
  },
  es: {
    from: 'Coding Agents 101',
    subject: 'Ya estás dentro: Coding Agents 101 empieza el mar 8 de diciembre',
    body: [
      'Ya estás dentro de Coding Agents 101.',
      '',
      'Cuatro sesiones en vivo, dos horas cada una, a las 6:00 PM (GMT-4):',
      '  Mar 8 dic: Pon un agente a trabajar de verdad',
      '  Jue 10 dic: El contexto que lo cambia todo',
      '  Mar 15 dic: Revisar en serio',
      '  Jue 17 dic: Que se quede contigo',
      '',
      TZ_NOTE.es,
      '',
      'Trae un repo en el que ya trabajes: construyes sobre tu propio código.',
      'Todas las sesiones se graban, así que si te pierdes una no pasa nada.',
      '',
      'Link de Meet, el mismo para las cuatro sesiones: ' + MEET_URL,
      'Te adjunto un archivo de calendario: un solo evento que se repite martes y jueves, con el link de Meet.',
      '',
      'Antes de la primera sesión te mando una lista corta de qué preparar.',
      'Si quieres adelantar, esta es la lectura de 15 minutos con la que empezaría:',
      'https://eonoe.github.io/guides/intro-coding-agents/es.html',
      '',
      'Nos vemos el martes.'
    ].join('\n'),
    html: {
      lines: ['Ya estás dentro de Coding Agents 101.'],
      when: 'Cuatro sesiones en vivo, dos horas cada una, a las 6:00 PM (GMT-4):',
      sessions: [
        ['Mar 8 dic', 'Pon un agente a trabajar de verdad'],
        ['Jue 10 dic', 'El contexto que lo cambia todo'],
        ['Mar 15 dic', 'Revisar en serio'],
        ['Jue 17 dic', 'Que se quede contigo']
      ],
      after: [
        'Trae un repo en el que ya trabajes: construyes sobre tu propio código. Todas las sesiones se graban, así que si te pierdes una no pasa nada.',
        'El link de Meet es el mismo para las cuatro sesiones: <a href="' + MEET_URL + '" style="color:#3531ff;">meet.google.com/qxk-zffm-ojo</a>.',
        'Antes de la primera sesión te mando una lista corta de qué preparar. Si quieres adelantar, esta es la lectura de 15 minutos con la que empezaría:'
      ],
      tz: TZ_NOTE.es,
      calTitle: 'Agrega las cuatro sesiones a tu calendario',
      calButton: '+ Agregar a mi calendario',
      calNote: 'Un solo evento que se repite cada martes y jueves, con el link de Meet. El archivo .ics adjunto hace lo mismo con un clic.',
      cta: ['Leer la guía \u2192', 'https://eonoe.github.io/guides/intro-coding-agents/es.html'],
      bye: 'Nos vemos el martes.',
      foot: ['cuatro sesiones en vivo', 'https://eonoe.github.io/es.html']
    }
  }
};

/**
 * The HTML version of a confirmation, in the landing page's look: black rule under
 * the logo, yellow "101", the sessions in a blue note, one blue button. Inline styles
 * only, because mail clients ignore everything else. The plain `body` stays as the
 * text alternative.
 */
function renderHtml(h, lang, withCalendar) {
  var font = "Inter,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
  var head = "'Space Grotesk'," + font;
  var mono = "'JetBrains Mono',Menlo,Consolas,monospace";
  function p(t) { return '<p style="margin:0 0 16px;">' + t + '</p>'; }
  var sessions = h.sessions.map(function (s) {
    return '<strong style="color:#0b0b10;">' + s[0] + '</strong> &nbsp;' + s[1];
  }).join('<br>');
  return '<!DOCTYPE html><html><body style="margin:0;padding:0;background-color:#ffffff;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 16px;">' +
    '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;font-family:' + font + ';color:#0b0b10;font-size:16px;line-height:1.6;">' +
    '<tr><td style="padding:0 0 22px;border-bottom:3px solid #0b0b10;font-family:' + head + ';font-weight:700;font-size:18px;letter-spacing:-.02em;">Coding Agents <span style="background-color:#ffd400;padding:0 7px;border-radius:5px;">101</span></td></tr>' +
    '<tr><td style="padding:26px 0 0;">' +
    h.lines.map(p).join('') +
    '<p style="margin:0 0 12px;">' + h.when + '</p>' +
    '<table role="presentation" cellpadding="0" cellspacing="0" style="border-left:5px solid #3531ff;background-color:#edecff;border-radius:0 10px 10px 0;margin:0 0 18px;width:100%;"><tr><td style="padding:14px 18px;font-family:' + mono + ';font-size:14px;line-height:1.7;color:#41444d;">' + sessions + '</td></tr></table>' +
    (h.tz ? '<p style="margin:0 0 18px;color:#41444d;font-size:15px;">' + h.tz + '</p>' : '') +
    (withCalendar ? calendarBlock(h, lang) : '') +
    h.after.map(p).join('') +
    '<p style="margin:0 0 28px;"><a href="' + h.cta[1] + '" style="display:inline-block;background-color:#3531ff;color:#ffffff;text-decoration:none;font-family:' + head + ';font-weight:600;font-size:15px;padding:12px 22px;border:2px solid #3531ff;border-radius:10px;">' + h.cta[0] + '</a></p>' +
    '<p style="margin:0 0 4px;">' + h.bye + '</p><p style="margin:0;">Noe</p>' +
    '</td></tr>' +
    '<tr><td style="padding:26px 0 0;border-top:1px solid #e7e8ec;font-family:' + mono + ';font-size:12px;color:#6b7280;">// coding agents 101 · ' + h.foot[0] + ' · <a href="' + h.foot[1] + '" style="color:#6b7280;">eonoe.github.io</a></td></tr>' +
    '</table></td></tr></table></body></html>';
}

/** The "add to calendar" row: one button for the whole series, plus a note about the attached .ics. */
function calendarBlock(h, lang) {
  var mono = "'JetBrains Mono',Menlo,Consolas,monospace";
  var link = '<a href="' + gcalUrl(lang).replace(/&/g, '&amp;') + '" style="display:inline-block;margin:0 8px 8px 0;padding:8px 14px;border:2px solid #0b0b10;border-radius:8px;color:#0b0b10;text-decoration:none;font-family:' + mono + ';font-size:13px;">' + h.calButton + '</a>';
  return '<p style="margin:0 0 6px;font-weight:600;">' + h.calTitle + '</p>' +
    '<p style="margin:0 0 6px;">' + link + '</p>' +
    '<p style="margin:0 0 16px;color:#41444d;font-size:15px;">' + h.calNote + '</p>';
}

/** AI Tech Lead isn't open yet. These signups are a waitlist, not an enrolment. */
var WAITLIST = {
  en: {
    from: 'AI Tech Lead',
    subject: "You're on the AI Tech Lead list",
    body: [
      "Thanks for your interest in AI Tech Lead, the deep, project-based track.",
      '',
      "It isn't open yet. You're on the list, and you'll hear from me first when dates go out.",
      '',
      'In the meantime, Coding Agents 101 is the free on-ramp and it runs live Dec 8 – 17, Tuesdays and Thursdays:',
      'https://eonoe.github.io/',
      '',
      'It covers the same foundations, and it stands on its own whether you go deeper or not.'
    ].join('\n')
  },
  es: {
    from: 'AI Tech Lead',
    subject: 'Estás en la lista de AI Tech Lead',
    body: [
      'Gracias por tu interés en AI Tech Lead, el programa completo basado en proyecto.',
      '',
      'Todavía no está abierto. Estás en la lista y serás de los primeros en saber las fechas.',
      '',
      'Mientras tanto, Coding Agents 101 es la puerta de entrada gratuita, en directo del 8 al 17 de diciembre, martes y jueves:',
      'https://eonoe.github.io/es.html',
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
