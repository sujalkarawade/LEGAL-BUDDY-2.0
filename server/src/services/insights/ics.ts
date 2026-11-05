/** Minimal RFC 5545 (iCalendar) writer for all-day obligation events. No external dependency. */

export interface CalendarEvent {
  uid: string;
  date: string; // YYYY-MM-DD
  summary: string;
  description?: string;
}

export function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Folds lines longer than 75 octets as required by RFC 5545 §3.1. */
export function foldLine(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  for (const ch of line) {
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (Buffer.byteLength(current + ch, 'utf8') > limit) { parts.push(current); current = ''; }
    current += ch;
  }
  if (current) parts.push(current);
  return parts.join('\r\n ');
}

const compact = (date: string) => date.replace(/-/g, '');

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function buildIcs(calendarName: string, events: CalendarEvent[], now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Legal Buddy 2.0//Obligation Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
  ];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}@legalbuddy.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(e.date)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(e.date))}`,
      `SUMMARY:${escapeIcsText(e.summary)}`,
      ...(e.description ? [`DESCRIPTION:${escapeIcsText(e.description)}`] : []),
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(e.summary)}`,
      'TRIGGER:-P1D',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** Parses an explicit calendar date from obligation text ("15 March 2027", "March 15, 2027", "2027-03-15", "15/03/2027"). */
export function parseExplicitDate(text: string | null | undefined): string | null {
  if (!text) return null;
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const pad = (n: number) => String(n).padStart(2, '0');
  const valid = (y: number, m: number, d: number) => {
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
  };
  if (iso) return valid(+iso[1], +iso[2], +iso[3]);
  const mdy = text.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})\b/i);
  if (mdy) return valid(+mdy[3], MONTHS.indexOf(mdy[1].toLowerCase()) + 1, +mdy[2]);
  const dmy = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december),?\s+(\d{4})\b/i);
  if (dmy) return valid(+dmy[3], MONTHS.indexOf(dmy[2].toLowerCase()) + 1, +dmy[1]);
  const slash = text.match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/); // Indian DD/MM/YYYY
  if (slash) return valid(+slash[3], +slash[2], +slash[1]);
  return null;
}
