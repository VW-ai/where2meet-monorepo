'use client';

import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { AmapMapArea } from './amap-map-area';
import { GoogleMapArea } from './google-map-area';
import { MapLoading } from './map-common';

/**
 * The meeting map, from the provider the event was created with: AMap for
 * meetings in mainland China, where Google Maps is blocked, Google otherwise.
 */
export function MapArea() {
  const hasEvent = useMeetingStore((state) => !!state.currentEvent);
  const mapProvider = useMeetingStore((state) => state.currentEvent?.mapProvider);

  // Wait for the event so a China meeting never starts loading Google
  if (!hasEvent) {
    return (
      <main className="w-full h-full relative">
        <MapLoading />
      </main>
    );
  }

  return mapProvider === 'amap' ? <AmapMapArea /> : <GoogleMapArea />;
}
