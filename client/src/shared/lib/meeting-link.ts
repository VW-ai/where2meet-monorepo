/** Matches a short link code: the first 10 characters of a meeting ID's random part. */
export const SHORT_CODE_PATTERN = /^[a-zA-Z0-9]{10}$/;

/** The short link code for a meeting ID like `evt_1702000000000_a8K3mX2pQrS7nBvW`. */
export function shortCodeOf(eventId: string): string {
  return (eventId.split('_')[2] ?? '').slice(0, 10);
}

/** The link people share: `https://www.where2meet.org/m/a8K3mX2pQr`, which redirects to the meeting. */
export function meetingShareUrl(origin: string, eventId: string): string {
  return `${origin}/m/${shortCodeOf(eventId)}`;
}
