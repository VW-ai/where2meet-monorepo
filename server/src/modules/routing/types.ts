export interface Point {
  lat: number;
  lng: number;
}
export type TravelMode = "driving" | "walking" | "transit" | "bicycling";
export type RouteOutcome =
  | { kind: "found"; meters: number; seconds: number; polyline: string }
  | { kind: "no-route" }
  | { kind: "unavailable" };
export type OriginOutcome = RouteOutcome & { originId: string };
export interface Routing {
  toDestination(input: {
    origins: readonly { originId: string; point: Point }[];
    destination: Point;
    mode: TravelMode;
  }): Promise<OriginOutcome[]>;
}
