import type { Invitation } from './invitation';

const DURATION_MS = 2 * 60 * 60 * 1000;

/** An iCalendar file for the invitation, or null when it has no start time. */
export function calendarFile(invitation: Invitation, now: Date): string | null {
  if (!invitation.when) return null;
  const start = new Date(invitation.when.startsAt);
  const { venue } = invitation;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Where2Meet//Invitation//EN',
    'BEGIN:VEVENT',
    `UID:${invitation.url}`,
    `DTSTAMP:${utc(now)}`,
    `DTSTART:${utc(start)}`,
    `DTEND:${utc(new Date(start.getTime() + DURATION_MS))}`,
    `SUMMARY:${text(invitation.title)}`,
    ...(venue ? [`LOCATION:${text(`${venue.name}, ${venue.address}`)}`] : []),
    `URL:${invitation.url}`,
    `DESCRIPTION:${text(invitation.url)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

function utc(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function text(value: string): string {
  return value.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');
}

/** RFC 5545 caps lines at 75 octets; continuation lines start with a space. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > (out.length ? 74 : 75)) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n ');
}
