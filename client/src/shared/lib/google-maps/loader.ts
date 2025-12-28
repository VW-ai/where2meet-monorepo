/**
 * Google Maps Loader Utility
 *
 * Handles loading the Google Maps JavaScript API using the new functional API
 */

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

if (!GOOGLE_MAPS_API_KEY) {
  console.warn(
    '[Google Maps] API key not configured. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local'
  );
}

// Track if Google Maps has been loaded
let isLoaded = false;
let loadingPromise: Promise<void> | null = null;

/**
 * Load Google Maps API script dynamically
 */
async function loadGoogleMapsScript(): Promise<void> {
  if (isLoaded) {
    return;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = new Promise((resolve, reject) => {
    // Check if script already exists
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      isLoaded = true;
      resolve();
      return;
    }

    // Create and inject script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry&v=weekly`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      isLoaded = true;
      resolve();
    };

    script.onerror = () => {
      loadingPromise = null;
      reject(new Error('Failed to load Google Maps script'));
    };

    document.head.appendChild(script);
  });

  return loadingPromise;
}

/**
 * Load Google Maps API (singleton pattern)
 */
export async function loadGoogleMaps(): Promise<typeof google.maps> {
  if (isGoogleMapsLoaded()) {
    return google.maps;
  }

  try {
    await loadGoogleMapsScript();

    if (!isGoogleMapsLoaded()) {
      throw new Error('Google Maps loaded but not available');
    }

    return google.maps;
  } catch (error) {
    console.error('[Google Maps] Failed to load:', error);
    throw new Error('Failed to load Google Maps API');
  }
}

/**
 * Check if Google Maps is loaded
 */
export function isGoogleMapsLoaded(): boolean {
  return typeof google !== 'undefined' && typeof google.maps !== 'undefined';
}
