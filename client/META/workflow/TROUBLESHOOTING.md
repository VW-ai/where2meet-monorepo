# Troubleshooting Guide

This document contains solutions to common issues encountered during Where2Meet development.

## Table of Contents
1. [Build Errors](#build-errors)
2. [Development Server Issues](#development-server-issues)
3. [Google Maps API Issues](#google-maps-api-issues)
4. [TypeScript Errors](#typescript-errors)
5. [Testing Issues](#testing-issues)
6. [Deployment Issues](#deployment-issues)
7. [Performance Issues](#performance-issues)

---

## Build Errors

### Error: "Module not found: Can't resolve '@/...'"

**Problem**: Path alias not configured correctly.

**Solution**:
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}

// vitest.config.ts (if testing)
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Error: "Type error: Cannot find module '@vis.gl/react-google-maps'"

**Problem**: Missing Google Maps React library or types.

**Solution**:
```bash
npm install @vis.gl/react-google-maps
# Types are included in the package
```

### Error: "Build failed with exit code 1" (Next.js)

**Problem**: TypeScript errors or linting errors blocking build.

**Solution**:
```bash
# Check TypeScript errors
npm run type-check

# Check ESLint errors
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix

# If you need to bypass checks temporarily (NOT recommended):
# next.config.js
module.exports = {
  typescript: {
    ignoreBuildErrors: true, // TEMPORARY ONLY
  },
  eslint: {
    ignoreDuringBuilds: true, // TEMPORARY ONLY
  },
};
```

### Error: "ENOSPC: System limit for number of file watchers reached"

**Problem**: Too many files being watched (Linux).

**Solution**:
```bash
# Increase watcher limit
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

---

## Development Server Issues

### Issue: "Port 3000 is already in use"

**Problem**: Another process is using port 3000.

**Solution**:
```bash
# Find process using port 3000
lsof -ti:3000

# Kill the process
kill -9 $(lsof -ti:3000)

# Or use a different port
PORT=3001 npm run dev
```

### Issue: Hot reload not working

**Problem**: File changes not triggering page refresh.

**Solution**:

1. **Check file system permissions**:
   ```bash
   # Ensure files are not read-only
   chmod -R u+w src/
   ```

2. **Clear Next.js cache**:
   ```bash
   rm -rf .next
   npm run dev
   ```

3. **Check if WSL2 (Windows)**:
   - Move project to WSL2 filesystem (not /mnt/c/)
   - Or disable fast refresh temporarily

4. **Restart dev server**:
   ```bash
   # Kill all node processes
   killall node
   npm run dev
   ```

### Issue: "Hydration failed" error

**Problem**: Server-rendered HTML doesn't match client-rendered HTML.

**Common Causes**:
1. Using `window` or `document` during SSR
2. Different content on server vs client
3. Browser extensions modifying DOM

**Solution**:
```tsx
// ✅ Good: Check if in browser
if (typeof window !== 'undefined') {
  // Browser-only code
}

// ✅ Good: Use useEffect for client-only code
useEffect(() => {
  // This only runs on client
  const data = localStorage.getItem('key');
}, []);

// ✅ Good: Disable SSR for component
import dynamic from 'next/dynamic';

const MapContainer = dynamic(
  () => import('@/components/map/MapContainer'),
  { ssr: false }
);

// ❌ Bad: Using browser API directly
const data = localStorage.getItem('key'); // Will fail on server
```

---

## Google Maps API Issues

### Error: "Google Maps JavaScript API error: RefererNotAllowedMapError"

**Problem**: API key restrictions blocking your domain.

**Solution**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services → Credentials
3. Click your API key
4. Under "Website restrictions":
   - Add `localhost:3000` for development
   - Add your production domain (e.g., `yourdomain.com/*`)
5. Save changes (may take a few minutes to propagate)

### Error: "InvalidKeyMapError"

**Problem**: API key is invalid or not set.

**Solution**:
```bash
# Check .env.local file exists
ls -la .env.local

# Verify key is set
cat .env.local | grep GOOGLE_MAPS

# Should show:
# NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here

# If missing, create/update .env.local
echo "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_actual_key" > .env.local

# Restart dev server
npm run dev
```

### Error: "This page can't load Google Maps correctly"

**Problem**: Missing API key or billing not enabled.

**Solution**:
1. **Enable Billing**: Google Maps requires a billing account
2. **Enable Required APIs**:
   - Maps JavaScript API
   - Places API
   - Geocoding API
3. **Set API key** in `.env.local`
4. **Check quota limits** in Google Cloud Console

### Issue: Maps not rendering on mobile

**Problem**: Container doesn't have explicit height.

**Solution**:
```tsx
// ✅ Good: Explicit height
<div className="h-screen">
  <MapContainer />
</div>

// ✅ Good: Using flexbox
<div className="flex flex-col h-screen">
  <div className="flex-1">
    <MapContainer />
  </div>
</div>

// ❌ Bad: No height
<div>
  <MapContainer /> {/* Won't render */}
</div>
```

### Issue: Map markers not appearing

**Problem**: Markers created before map is loaded.

**Solution**:
```tsx
// ✅ Good: Wait for map to load
import { useMap } from '@vis.gl/react-google-maps';

function Markers() {
  const map = useMap();

  useEffect(() => {
    if (!map) return; // Wait for map

    // Create markers
    const marker = new google.maps.Marker({
      position: { lat: 40, lng: -73 },
      map,
    });

    return () => marker.setMap(null);
  }, [map]);

  return null;
}
```

---

## TypeScript Errors

### Error: "Property 'X' does not exist on type 'Y'"

**Problem**: Missing type definition or incorrect type.

**Solution**:
```typescript
// ✅ Good: Define proper interface
interface Participant {
  id: string;
  name?: string;
  lat: number;
  lng: number;
  address: string;
}

// Use the interface
const participant: Participant = {
  id: '1',
  lat: 40,
  lng: -73,
  address: 'NYC',
};

// ❌ Bad: Using any
const participant: any = { ... }; // Defeats purpose of TypeScript
```

### Error: "Type 'null' is not assignable to type 'X'"

**Problem**: Strict null checks enabled (good!).

**Solution**:
```typescript
// ✅ Good: Make it nullable
interface State {
  centroid: { lat: number; lng: number } | null;
}

// ✅ Good: Check before using
if (centroid !== null) {
  console.log(centroid.lat);
}

// ✅ Good: Optional chaining
console.log(centroid?.lat);

// ✅ Good: Nullish coalescing
const lat = centroid?.lat ?? 0;
```

### Error: "Argument of type 'X' is not assignable to parameter of type 'never'"

**Problem**: TypeScript inferred `never` type (usually from empty array).

**Solution**:
```typescript
// ❌ Bad: TypeScript infers never[]
const items = [];
items.push({ id: 1 }); // Error!

// ✅ Good: Explicit type
const items: Item[] = [];
items.push({ id: 1 }); // Works!

// ✅ Good: Type inference from initial value
const items = [{ id: 1 }];
items.push({ id: 2 }); // Works!
```

### Error: "'X' is declared but its value is never read"

**Problem**: Unused variable or import.

**Solution**:
```typescript
// ✅ Good: Remove unused
// import { unused } from 'lib'; // Delete this

// ✅ Good: Prefix with underscore if intentional
const _debug = process.env.DEBUG;

// ✅ Good: Use as type-only import
import type { Participant } from '@/types';
```

---

## Testing Issues

### Error: "ReferenceError: google is not defined"

**Problem**: Google Maps not mocked in tests.

**Solution**:
```typescript
// vitest.setup.ts
global.google = {
  maps: {
    Map: vi.fn(),
    Marker: vi.fn(),
    LatLng: vi.fn((lat, lng) => ({ lat, lng })),
    LatLngBounds: vi.fn(),
  },
} as any;
```

### Error: "Cannot find module '@testing-library/jest-dom'"

**Problem**: Missing test dependencies.

**Solution**:
```bash
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

### Issue: Tests pass individually but fail when run together

**Problem**: State not being reset between tests.

**Solution**:
```typescript
// Use beforeEach
beforeEach(() => {
  // Reset store
  useMeetingStore.getState().reset();

  // Clear mocks
  vi.clearAllMocks();
});

// Or use afterEach
afterEach(() => {
  cleanup(); // From @testing-library/react
});
```

### Issue: "Warning: An update to X inside a test was not wrapped in act(...)"

**Problem**: State updates not wrapped in `act`.

**Solution**:
```typescript
import { act } from '@testing-library/react';

// ✅ Good: Wrap in act
act(() => {
  useMeetingStore.getState().addParticipant(location);
});

// ✅ Good: Use React Testing Library's fireEvent (auto-wrapped)
fireEvent.click(button);

// ✅ Good: Use userEvent (auto-wrapped)
await user.click(button);
```

---

## Deployment Issues

### Error: "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is undefined" (Vercel)

**Problem**: Environment variable not set in deployment.

**Solution**:
1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` with your API key
3. Select "Production", "Preview", and "Development"
4. Redeploy

### Issue: App works locally but not in production

**Common Causes**:

1. **Missing environment variables**:
   - Check all `NEXT_PUBLIC_*` vars are set in Vercel/Netlify

2. **Different API key restrictions**:
   - Add production domain to Google Cloud Console API restrictions

3. **Build-time vs Runtime errors**:
   ```bash
   # Test production build locally
   npm run build
   npm run start
   ```

4. **Server vs Client code**:
   - Check for browser-only code running on server
   - Use `dynamic` imports with `{ ssr: false }` for client-only components

### Error: "Application error: a client-side exception has occurred"

**Problem**: Runtime error in production.

**Solution**:
1. **Check browser console** for actual error
2. **Enable error reporting**:
   ```typescript
   // app/error.tsx
   'use client';

   export default function Error({
     error,
     reset,
   }: {
     error: Error;
     reset: () => void;
   }) {
     console.error(error);

     return (
       <div>
         <h2>Something went wrong!</h2>
         <button onClick={reset}>Try again</button>
       </div>
     );
   }
   ```

3. **Add Sentry or similar** for production error tracking

---

## Performance Issues

### Issue: Map rendering is slow

**Problem**: Too many markers or inefficient re-renders.

**Solutions**:

1. **Use marker clustering**:
   ```tsx
   import { MarkerClusterer } from '@googlemaps/markerclusterer';

   useEffect(() => {
     if (!map) return;

     const clusterer = new MarkerClusterer({ map, markers });

     return () => clusterer.clearMarkers();
   }, [map, markers]);
   ```

2. **Optimize markers**:
   ```tsx
   // ✅ Good: Memoize markers
   const markerPositions = useMemo(
     () => participants.map(p => ({ lat: p.lat, lng: p.lng })),
     [participants]
   );

   // ❌ Bad: Creating new array on every render
   const markerPositions = participants.map(p => ({ lat: p.lat, lng: p.lng }));
   ```

3. **Virtualize long lists**:
   ```tsx
   import { useVirtualizer } from '@tanstack/react-virtual';

   // For long venue lists
   ```

### Issue: Slow API requests

**Problem**: Not caching or debouncing requests.

**Solutions**:

1. **Use React Query caching**:
   ```typescript
   useQuery({
     queryKey: ['places', location, radius, type],
     queryFn: fetchPlaces,
     staleTime: 5 * 60 * 1000, // 5 minutes
     cacheTime: 10 * 60 * 1000, // 10 minutes
   });
   ```

2. **Debounce user input**:
   ```typescript
   const debouncedSearch = useMemo(
     () => debounce((value: string) => {
       fetch(`/api/autocomplete?input=${value}`);
     }, 300),
     []
   );
   ```

### Issue: Large bundle size

**Problem**: Importing entire libraries.

**Solutions**:

1. **Use tree-shakeable imports**:
   ```typescript
   // ✅ Good: Import only what you need
   import { MapPin, Search } from 'lucide-react';

   // ❌ Bad: Imports entire library
   import * as Icons from 'lucide-react';
   ```

2. **Analyze bundle**:
   ```bash
   npm install -D @next/bundle-analyzer

   # next.config.js
   const withBundleAnalyzer = require('@next/bundle-analyzer')({
     enabled: process.env.ANALYZE === 'true',
   });

   module.exports = withBundleAnalyzer({
     // ... config
   });

   # Run analysis
   ANALYZE=true npm run build
   ```

3. **Code split**:
   ```tsx
   import dynamic from 'next/dynamic';

   const HeavyComponent = dynamic(
     () => import('@/components/HeavyComponent'),
     { loading: () => <Spinner /> }
   );
   ```

---

## Common Gotchas

### Gotcha: `window is not defined`

**Cause**: Accessing browser APIs during SSR.

**Fix**:
```typescript
// ✅ Good
if (typeof window !== 'undefined') {
  localStorage.setItem('key', 'value');
}

// ✅ Good
useEffect(() => {
  // Runs only on client
  localStorage.setItem('key', 'value');
}, []);

// ❌ Bad
const data = localStorage.getItem('key'); // Crashes during SSR
```

### Gotcha: Zustand state not persisting

**Cause**: Not using `persist` middleware or incorrect configuration.

**Fix**:
```typescript
import { persist } from 'zustand/middleware';

export const useMeetingStore = create<MeetingState>()(
  persist(
    (set) => ({ /* state */ }),
    {
      name: 'meeting-storage',
      partialize: (state) => ({
        participants: state.participants,
        // Only persist what you need
      }),
    }
  )
);
```

### Gotcha: API routes returning 404

**Cause**: Incorrect file structure in `app/api/`.

**Fix**:
```
app/
  api/
    places/
      route.ts         # /api/places
      search/
        route.ts       # /api/places/search
    geocode/
      route.ts         # /api/geocode
```

### Gotcha: Map not centering on markers

**Cause**: Not using `fitBounds`.

**Fix**:
```typescript
useEffect(() => {
  if (!map || participants.length === 0) return;

  const bounds = new google.maps.LatLngBounds();
  participants.forEach(p => {
    bounds.extend({ lat: p.lat, lng: p.lng });
  });

  map.fitBounds(bounds);
}, [map, participants]);
```

---

## Getting Help

If you're still stuck:

1. **Check Documentation**:
   - `CLIENT_ARCHITECTURE.md` for architecture questions
   - `COMPONENT_GUIDE.md` for component usage
   - `API_SPEC.md` for API details

2. **Search Issues**: GitHub issues may have your answer

3. **Ask for Help**:
   - Create detailed issue with:
     - What you're trying to do
     - What you've tried
     - Error messages (full stack trace)
     - Minimal reproduction

4. **Debug Tips**:
   ```typescript
   // Add debug logging
   console.log('[DEBUG] State:', useMeetingStore.getState());

   // Check network requests
   // Open DevTools → Network tab

   // Check React Query cache
   import { useQueryClient } from '@tanstack/react-query';
   const queryClient = useQueryClient();
   console.log(queryClient.getQueryCache());
   ```

---

## Quick Diagnostics

Run these commands to diagnose issues:

```bash
# Check Node version (should be 18+)
node --version

# Check npm version
npm --version

# Clear all caches
rm -rf node_modules .next
npm install

# Check for outdated packages
npm outdated

# Verify environment variables
cat .env.local

# Check port availability
lsof -ti:3000

# Run all checks
npm run type-check && npm run lint && npm run test && npm run build
```
