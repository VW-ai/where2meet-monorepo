'use client';

import { useState } from 'react';
import { AddressAutocomplete } from '@/shared/ui/address-autocomplete';
import { reverseGeocodePoint } from '@/shared/lib/map-provider';
import type { MapProvider } from '@/shared/types/map';

const LOCATE_ERRORS: Record<number, string> = {
  1: 'Location access is blocked. Allow it in your browser settings, or type an address.',
  2: 'Your location is unavailable right now. Type an address instead.',
  3: 'Finding your location took too long. Try again or type an address.',
};

interface LocationFieldProps {
  id: string;
  value: string;
  /** placeId is empty while the user is typing and set once a place is picked or located */
  onChange: (address: string, placeId: string) => void;
  onError: (message: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** The meeting's map provider; AMap for meetings in mainland China */
  provider?: MapProvider;
}

/**
 * Address search with a "use my current location" button.
 * Shared by the create-meeting form, the join/add participant form and the
 * "Where are you coming from?" prompt so they all behave the same way.
 */
export function LocationField({
  id,
  value,
  onChange,
  onError,
  invalid = false,
  disabled = false,
  placeholder = 'Search an address or place…',
  className,
  provider = 'google',
}: LocationFieldProps) {
  const [isLocating, setIsLocating] = useState(false);

  const handleLocate = async () => {
    if (!navigator.geolocation) {
      onError('Your browser can’t share its location. Type an address instead.');
      return;
    }

    setIsLocating(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });
      const { latitude, longitude } = position.coords;
      const result = await reverseGeocodePoint(provider, { lat: latitude, lng: longitude });
      onChange(result.address, result.placeId);
    } catch (error) {
      console.error('Error getting location:', error);
      onError(
        error instanceof GeolocationPositionError
          ? LOCATE_ERRORS[error.code]
          : 'We couldn’t find your current location. Type an address instead.'
      );
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <AddressAutocomplete
      id={id}
      value={value}
      onChange={(address) => onChange(address, '')}
      onSelect={(prediction) => onChange(prediction.full_address, prediction.place_id)}
      onLocate={handleLocate}
      isLocating={isLocating}
      placeholder={placeholder}
      disabled={disabled}
      invalid={invalid}
      className={className}
      provider={provider}
    />
  );
}
