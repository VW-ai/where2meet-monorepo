import { randomInt } from "node:crypto";

const colors = [
  "coral",
  "teal",
  "gold",
  "orchid",
  "lime",
  "dodgerblue",
  "tomato",
  "mediumseagreen",
  "slateblue",
  "darkorange",
  "hotpink",
  "steelblue",
  "yellowgreen",
  "mediumpurple",
  "indianred",
  "cadetblue",
];

export function participantColor(used: string[]): string {
  return (
    colors.find((color) => !used.includes(color)) ?? colors[used.length % colors.length] ?? "coral"
  );
}

export function approximatePoint(point: { lat: number; lng: number }) {
  const distance = randomInt(804672, 1609345) / 1000;
  const bearing = (randomInt(0, 4294967296) / 4294967296) * 2 * Math.PI;
  const angularDistance = distance / 6371000;
  const latitude = (point.lat * Math.PI) / 180;
  const longitude = (point.lng * Math.PI) / 180;
  const nextLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angularDistance) +
      Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const nextLongitude =
    longitude +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
      Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(nextLatitude)
    );
  return {
    lat: (nextLatitude * 180) / Math.PI,
    lng: (((((nextLongitude * 180) / Math.PI + 180) % 360) + 360) % 360) - 180,
  };
}
