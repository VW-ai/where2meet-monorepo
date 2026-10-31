/**
 * AMap (Gaode) JS API 2.0 Loader
 *
 * Loads the map for meetings in mainland China, where Google Maps is blocked.
 * Coordinates on this map are GCJ-02; convert with src/shared/lib/geo/coords.ts.
 */

const AMAP_JS_KEY = process.env.NEXT_PUBLIC_AMAP_JS_KEY || '';

/** Plugins the meeting map uses, loaded with the API in one request */
const PLUGINS = ['AMap.CircleEditor', 'AMap.Scale', 'AMap.ToolBar'];

let loadingPromise: Promise<typeof AMap> | null = null;

/** Whether an AMap Web (JS API) key is configured */
export function hasAmapKey(): boolean {
  return !!AMAP_JS_KEY;
}

/**
 * Load the AMap JS API (singleton)
 */
export function loadAmap(): Promise<typeof AMap> {
  if (window.AMap) {
    return Promise.resolve(window.AMap);
  }
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = new Promise((resolve, reject) => {
    // AMap keys need a security code. It stays on our server: AMap sends its
    // service requests to serviceHost, and /amap-service adds the code.
    window._AMapSecurityConfig = { serviceHost: `${window.location.origin}/amap-service` };

    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(AMAP_JS_KEY)}&plugin=${PLUGINS.join(',')}`;
    script.async = true;

    script.onload = () => {
      if (window.AMap) {
        resolve(window.AMap);
      } else {
        loadingPromise = null;
        reject(new Error('Amap loaded but not available'));
      }
    };

    script.onerror = () => {
      loadingPromise = null;
      script.remove();
      reject(new Error('Failed to load Amap'));
    };

    document.head.appendChild(script);
  });

  return loadingPromise;
}
