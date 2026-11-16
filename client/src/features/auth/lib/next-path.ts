// Where to go after signing in: ?next= when it's a path on this site, else the dashboard.
// Rejects //host and /\host, which browsers treat as another site.
export function nextPathFrom(search: string): string {
  const next = new URLSearchParams(search).get('next');
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return '/dashboard';
  }
  return next;
}
