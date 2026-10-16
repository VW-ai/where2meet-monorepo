/** The JPEG at `url`, or null when it cannot be fetched in time, so the caller draws the map instead. */
export async function fetchJpeg(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return response.ok ? Buffer.from(await response.arrayBuffer()) : null;
  } catch {
    return null;
  }
}
