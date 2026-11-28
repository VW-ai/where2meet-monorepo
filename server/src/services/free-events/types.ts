/**
 * Shared types for the free NYC event ingest.
 * @module services/free-events/types
 */

/** What a free event offers. The /nyc maps give each kind its own theme. */
export const FREE_EVENT_KINDS = ["free-food", "hackathon", "free-talk"] as const;
export type FreeEventKind = (typeof FREE_EVENT_KINDS)[number];

/** One event as an adapter maps it, before it is stored. */
export interface FreeEventRow {
  sourceId: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  venueName: string | null;
  placeId: string | null;
  lat: number | null;
  lng: number | null;
  kind: FreeEventKind;
  url: string;
  /** The listing says the event is cancelled. Stored rows for it are hidden. */
  cancelled: boolean;
}

/** What an adapter returns: the rows it mapped and how many listings it left out. */
export interface SourceFetchResult {
  rows: FreeEventRow[];
  skipped: number;
}

/** One outside listing. `fetchRows` throws when the listing cannot be read. */
export interface FreeEventSource {
  name: string;
  fetchRows(): Promise<SourceFetchResult>;
}
