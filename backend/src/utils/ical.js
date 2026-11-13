const { config } = require('../config/env');

/**
 * Minimal RFC 5545 iCalendar generator for a single event.
 * Times are written as floating local times with an explicit TZID so calendar
 * apps display them in the event's time zone.
 */

const escapeText = (value) =>
  String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

// Fold lines longer than 75 octets as required by the spec.
const fold = (line) => {
  const parts = [];
  let rest = line;
  while (rest.length > 74) {
    parts.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  parts.push(rest);
  return parts.join('\r\n');
};

const toLocalStamp = (date, time) => `${String(date).slice(0, 10).replace(/-/g, '')}T${String(time).slice(0, 8).replace(/:/g, '').padEnd(6, '0')}`;

const utcStamp = (d = new Date()) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/**
 * @param {Object} opp - opportunity row (id, title, description, event_date, start_time, end_time, location, address, organization_name)
 * @param {Object} [opts]
 * @param {string} [opts.method] - PUBLISH (default) or CANCEL
 */
const buildEventIcs = (opp, { method = 'PUBLISH' } = {}) => {
  const tz = config.timezone;
  const endDate =
    String(opp.end_time) > String(opp.start_time)
      ? opp.event_date
      : new Date(new Date(`${String(opp.event_date).slice(0, 10)}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
  const location = [opp.location, opp.address].filter(Boolean).join(', ');
  const url = `${config.appUrl}/opportunities/${opp.id}`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${config.appName}//Volunteer Platform//EN`,
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${opp.id}@${config.appName.toLowerCase().replace(/\s+/g, '')}`,
    `DTSTAMP:${utcStamp()}`,
    `DTSTART;TZID=${tz}:${toLocalStamp(opp.event_date, opp.start_time)}`,
    `DTEND;TZID=${tz}:${toLocalStamp(endDate, opp.end_time)}`,
    `SUMMARY:${escapeText(opp.title)}`,
    `DESCRIPTION:${escapeText(`${opp.description || ''}\n\nOrganized by ${opp.organization_name || ''}\n${url}`)}`,
    `LOCATION:${escapeText(location)}`,
    `URL:${url}`,
    `STATUS:${method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(opp.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
};

const icsAttachment = (opp) => ({
  filename: 'event.ics',
  content: buildEventIcs(opp),
  contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
});

module.exports = { buildEventIcs, icsAttachment };
