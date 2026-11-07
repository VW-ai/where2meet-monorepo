export interface PathPoint {
  lat: number;
  lng: number;
}

function segmentLength(a: PathPoint, b: PathPoint): number {
  const shrink = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.hypot(b.lat - a.lat, (b.lng - a.lng) * shrink);
}

/** The first `fraction` of the path by length, ending on an interpolated point at the head. */
export function pathUpTo(path: readonly PathPoint[], fraction: number): PathPoint[] {
  if (path.length < 2 || fraction >= 1) return [...path];
  if (fraction <= 0) return [path[0]];

  const lengths = path.slice(1).map((point, i) => segmentLength(path[i], point));
  const target = lengths.reduce((sum, length) => sum + length, 0) * fraction;

  let walked = 0;
  for (let i = 0; i < lengths.length; i++) {
    if (walked + lengths[i] >= target) {
      const along = lengths[i] === 0 ? 0 : (target - walked) / lengths[i];
      const [a, b] = [path[i], path[i + 1]];
      return [
        ...path.slice(0, i + 1),
        { lat: a.lat + (b.lat - a.lat) * along, lng: a.lng + (b.lng - a.lng) * along },
      ];
    }
    walked += lengths[i];
  }
  return [...path];
}
