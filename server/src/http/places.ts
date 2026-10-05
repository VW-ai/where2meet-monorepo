import type { MeetingDirections } from "../modules/meetings/index.js";

export function photoWire<T extends { id: string; hasPhoto: boolean }>(
  place: T,
  origin: () => string
) {
  const { hasPhoto, ...value } = place;
  return {
    ...value,
    photoUrl: hasPhoto ? `${origin()}/api/venues/${encodeURIComponent(place.id)}/photo` : null,
  };
}

function distanceText(meters: number): string {
  const miles = meters / 1609.344;
  return miles < 0.1
    ? `${String(Math.round(meters / 0.3048))} ft`
    : `${String(Math.round(miles * 10) / 10)} mi`;
}

function durationText(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return minutes <= 1 ? "1 min" : `${String(minutes)} mins`;
  const hour = hours === 1 ? "1 hour" : `${String(hours)} hours`;
  return minutes === 0 ? hour : `${hour} ${String(minutes)} ${minutes === 1 ? "min" : "mins"}`;
}

export function directionsWire(result: MeetingDirections) {
  const found = result.outcomes.flatMap((outcome) =>
    outcome.kind === "found"
      ? [
          {
            participantId: outcome.participantId,
            distance: { value: outcome.meters, text: distanceText(outcome.meters) },
            duration: { value: outcome.seconds, text: durationText(outcome.seconds) },
            polyline: outcome.polyline,
          },
        ]
      : []
  );
  const unlocated = result.outcomes.flatMap((outcome) =>
    outcome.kind === "no-location"
      ? [
          {
            participantId: outcome.participantId,
            distance: null,
            duration: null,
            polyline: null,
          },
        ]
      : []
  );
  return {
    venueId: result.venueId,
    travelMode: result.mode,
    routes: [...found, ...unlocated],
    outcomes: result.outcomes.map((outcome) => ({
      participantId: outcome.participantId,
      status: outcome.kind,
    })),
  };
}
