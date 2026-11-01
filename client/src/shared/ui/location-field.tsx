'use client';

import { useState } from 'react';
import { AddressAutocomplete } from '@/shared/ui/address-autocomplete';
import { reverseGeocodePoint } from '@/shared/lib/map-provider';
import type { MapProvider } from '@/shared/types/map';
import { defineMessages, useMessages } from '@/shared/lib/i18n';

const messages = defineMessages({
  en: {
    placeholder: 'Search an address or place…',
    noGeolocation: 'Your browser can’t share its location. Type an address instead.',
    locateFailed: 'We couldn’t find your current location. Type an address instead.',
    locateErrors: {
      1: 'Location access is blocked. Allow it in your browser settings, or type an address.',
      2: 'Your location is unavailable right now. Type an address instead.',
      3: 'Finding your location took too long. Try again or type an address.',
    } as Record<number, string>,
  },
  zh: {
    placeholder: '搜索地址或地点…',
    noGeolocation: '你的浏览器无法获取位置，请直接输入地址。',
    locateFailed: '没能找到你的当前位置，请直接输入地址。',
    locateErrors: {
      1: '位置权限被关闭了。请在浏览器设置里允许，或直接输入地址。',
      2: '暂时获取不到你的位置，请直接输入地址。',
      3: '获取位置超时了。请重试，或直接输入地址。',
    },
  },
});

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
  placeholder,
  className,
  provider = 'google',
}: LocationFieldProps) {
  const t = useMessages(messages);
  const [isLocating, setIsLocating] = useState(false);

  const handleLocate = async () => {
    if (!navigator.geolocation) {
      onError(t.noGeolocation);
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
        error instanceof GeolocationPositionError ? t.locateErrors[error.code] : t.locateFailed
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
      placeholder={placeholder ?? t.placeholder}
      disabled={disabled}
      invalid={invalid}
      className={className}
      provider={provider}
    />
  );
}
