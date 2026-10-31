/**
 * Distance and duration formatting utilities.
 * Imperial units by default (miles, feet, minutes, hours); metric for AMap events in China.
 * @module lib/directions/format
 */

const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;
const FEET_THRESHOLD_MILES = 0.1; // Show feet if less than 0.1 miles

/**
 * Formats distance in imperial units (miles/feet).
 * @param meters - Distance in meters
 * @returns Formatted string ("3.2 mi" or "262 ft")
 * @example
 * formatDistanceImperial(80)   // "262 ft"
 * formatDistanceImperial(5149) // "3.2 mi"
 */
export function formatDistanceImperial(meters: number): string {
  const miles = meters / METERS_PER_MILE;

  if (miles < FEET_THRESHOLD_MILES) {
    const feet = Math.round(meters / METERS_PER_FOOT);
    return `${String(feet)} ft`;
  }

  // Round to 1 decimal place
  const roundedMiles = Math.round(miles * 10) / 10;
  return `${String(roundedMiles)} mi`;
}

/**
 * Formats distance in metric units (kilometers/meters).
 * @param meters - Distance in meters
 * @returns Formatted string ("3.2 km" or "850 m")
 * @example
 * formatDistanceMetric(850)  // "850 m"
 * formatDistanceMetric(5149) // "5.1 km"
 */
export function formatDistanceMetric(meters: number): string {
  if (meters < 1000) {
    return `${String(Math.round(meters))} m`;
  }
  const roundedKm = Math.round(meters / 100) / 10;
  return `${String(roundedKm)} km`;
}

/**
 * Formats duration in human-readable format.
 * @param seconds - Duration in seconds
 * @returns Formatted string ("12 mins", "1 hour", "1 hour 30 mins")
 * @example
 * formatDuration(90)   // "2 mins"
 * formatDuration(3600) // "1 hour"
 * formatDuration(5400) // "1 hour 30 mins"
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours === 0) {
    if (minutes <= 1) {
      return "1 min";
    }
    return `${String(minutes)} mins`;
  }

  const hourText = hours === 1 ? "1 hour" : `${String(hours)} hours`;

  if (minutes === 0) {
    return hourText;
  }

  const minText = minutes === 1 ? "1 min" : `${String(minutes)} mins`;
  return `${hourText} ${minText}`;
}
