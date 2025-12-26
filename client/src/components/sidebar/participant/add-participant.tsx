'use client';

import { useState, FormEvent } from 'react';
import { Dices, UserPlus, X, Eye, EyeOff, Info } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { generateRandomName } from '@/lib/utils/name-generator';
import { AddressAutocomplete } from '@/components/shared/address-autocomplete';
import { Tooltip } from '@/components/shared/tooltip';
import { reverseGeocode } from '@/lib/google-maps/geocoding';
import { useAuthStore } from '@/store/auth-store';
import type { PlacePrediction } from '@/lib/api/mock/places-autocomplete';

interface AddParticipantProps {
  onSubmit: (data: ParticipantFormData) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  mode?: 'add' | 'edit';
  initialData?: ParticipantFormData;
}

export interface ParticipantFormData {
  name: string;
  address: string;
  placeId: string;
  fuzzyLocation: boolean;
}

export function AddParticipant({
  onSubmit,
  onCancel,
  isSubmitting = false,
  mode = 'add',
  initialData,
}: AddParticipantProps) {
  const { user } = useAuthStore();
  const hasDefaultAddress = !!(user?.defaultAddress && user?.defaultPlaceId);

  const [name, setName] = useState(initialData?.name || '');
  const [address, setAddress] = useState(initialData?.address || '');
  const [placeId, setPlaceId] = useState(initialData?.placeId || '');
  const [fuzzyLocation, setFuzzyLocation] = useState(initialData?.fuzzyLocation ?? false);
  const [errors, setErrors] = useState<{ name?: string; address?: string }>({});
  const [isLocating, setIsLocating] = useState(false);

  // Handle dice randomizer click
  const handleRandomizeName = () => {
    const randomName = generateRandomName();
    setName(randomName);
    if (errors.name) {
      setErrors((prev) => ({ ...prev, name: undefined }));
    }
  };

  // Handle address selection from autocomplete
  const handleAddressSelect = (prediction: PlacePrediction) => {
    setAddress(prediction.full_address);
    setPlaceId(prediction.place_id);
    if (errors.address) {
      setErrors((prev) => ({ ...prev, address: undefined }));
    }
  };

  // Handle locate current location
  const handleLocate = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);

    try {
      // Get user's current position
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude } = position.coords;

      // Reverse geocode to get address
      const result = await reverseGeocode({ lat: latitude, lng: longitude });

      // Set address and placeId
      setAddress(result.address);
      setPlaceId(result.placeId);

      // Clear any previous errors
      if (errors.address) {
        setErrors((prev) => ({ ...prev, address: undefined }));
      }
    } catch (error) {
      console.error('Error getting location:', error);
      if (error instanceof GeolocationPositionError) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            alert(
              'Location permission denied. Please enable location access in your browser settings.'
            );
            break;
          case error.POSITION_UNAVAILABLE:
            alert('Location information is unavailable.');
            break;
          case error.TIMEOUT:
            alert('Location request timed out. Please try again.');
            break;
        }
      } else {
        alert('Failed to get your current location. Please try again.');
      }
    } finally {
      setIsLocating(false);
    }
  };

  // Handle use default address
  const handleUseDefaultAddress = () => {
    if (!user?.defaultAddress || !user?.defaultPlaceId) return;

    setAddress(user.defaultAddress);
    setPlaceId(user.defaultPlaceId);

    // Clear any previous errors
    if (errors.address) {
      setErrors((prev) => ({ ...prev, address: undefined }));
    }
  };

  // Validate form
  const validate = (): boolean => {
    const newErrors: { name?: string; address?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!address.trim()) {
      newErrors.address = 'Address is required';
    }

    if (!placeId) {
      newErrors.address = 'Please select an address from the dropdown';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    onSubmit({
      name: name.trim(),
      address: address.trim(),
      placeId,
      fuzzyLocation,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          {mode === 'add' ? 'Add Participant' : 'Edit Participant'}
        </h3>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Cancel"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Name Input with Dice Randomizer */}
      <div className="space-y-1.5">
        <label htmlFor="participant-name" className="block text-sm font-medium text-foreground">
          Name
        </label>
        <div className="relative">
          <input
            id="participant-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) {
                setErrors((prev) => ({ ...prev, name: undefined }));
              }
            }}
            placeholder="Enter name or use the dice"
            disabled={isSubmitting}
            className={cn(
              'w-full px-4 py-2.5 pr-12 text-sm',
              'bg-white/80 backdrop-blur-sm rounded-xl shadow-md',
              'focus:outline-none focus:shadow-lg focus:ring-2 focus:ring-coral-500/20',
              'transition-all duration-200',
              'placeholder:text-muted-foreground',
              errors.name && 'ring-2 ring-red-500',
              isSubmitting && 'opacity-50 cursor-not-allowed'
            )}
          />

          {/* Dice Randomizer Button */}
          <button
            type="button"
            onClick={handleRandomizeName}
            disabled={isSubmitting}
            className={cn(
              'absolute right-2 top-1/2 -translate-y-1/2',
              'p-2 rounded-lg',
              'text-muted-foreground hover:text-coral-500 hover:bg-coral-50',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-coral-500/20',
              isSubmitting && 'opacity-50 cursor-not-allowed'
            )}
            aria-label="Generate random name"
            title="Generate random name"
          >
            <Dices className="w-4 h-4" />
          </button>
        </div>
        {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
      </div>

      {/* Address Autocomplete */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between mb-2">
          <label
            htmlFor="participant-address"
            className="block text-sm font-medium text-foreground"
          >
            Address
          </label>
          {hasDefaultAddress && (
            <button
              type="button"
              onClick={handleUseDefaultAddress}
              disabled={isSubmitting}
              className={cn(
                'text-xs font-medium text-coral-600 hover:text-coral-700',
                'transition-colors duration-200',
                'focus:outline-none focus:underline',
                isSubmitting && 'opacity-50 cursor-not-allowed'
              )}
            >
              Use Default Address
            </button>
          )}
        </div>
        <AddressAutocomplete
          value={address}
          onChange={(value) => {
            setAddress(value);
            // Clear placeId if user types manually
            if (placeId) {
              setPlaceId('');
            }
            if (errors.address) {
              setErrors((prev) => ({ ...prev, address: undefined }));
            }
          }}
          onSelect={handleAddressSelect}
          onLocate={handleLocate}
          isLocating={isLocating}
          placeholder="Search for an address..."
          disabled={isSubmitting}
          className={cn(errors.address && 'border-red-500')}
        />
        {errors.address && <p className="text-xs text-red-500">{errors.address}</p>}
      </div>

      {/* Fuzzy Location Toggle */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label htmlFor="fuzzy-location" className="text-sm font-medium text-foreground">
            Fuzzy Location
          </label>
          <Tooltip
            content="Fuzzy location hides your exact address by showing an approximate area within 0.5-1 mile. Your precise location won't be visible to others."
            position="right"
          >
            <Info className="w-4 h-4 text-muted-foreground cursor-help" />
          </Tooltip>
        </div>

        <button
          type="button"
          onClick={() => setFuzzyLocation(!fuzzyLocation)}
          disabled={isSubmitting}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-3 text-sm',
            'rounded-xl',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-coral-500/20',
            fuzzyLocation
              ? 'shadow-xl ring-2 ring-coral-500/30 bg-coral-50/90 backdrop-blur-sm'
              : 'bg-white/80 backdrop-blur-sm shadow-md hover:shadow-lg',
            isSubmitting && 'opacity-50 cursor-not-allowed'
          )}
          aria-label={fuzzyLocation ? 'Disable fuzzy location' : 'Enable fuzzy location'}
        >
          {fuzzyLocation ? (
            <EyeOff className="w-5 h-5 text-coral-500" />
          ) : (
            <Eye className="w-5 h-5 text-muted-foreground" />
          )}
          <div className="flex-1 text-left">
            <p className={cn('font-medium', fuzzyLocation ? 'text-coral-700' : 'text-foreground')}>
              {fuzzyLocation ? 'Fuzzy location enabled' : 'Show exact location'}
            </p>
            <p className="text-xs text-muted-foreground">
              {fuzzyLocation
                ? 'Your address will be approximated for privacy'
                : 'Others will see your precise location'}
            </p>
          </div>
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            'flex-1 px-4 py-2.5 text-sm font-medium',
            'bg-coral-500 text-white rounded-full',
            'hover:bg-coral-600 active:scale-[0.98]',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-coral-500 focus:ring-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {mode === 'add' ? 'Adding...' : 'Saving...'}
            </span>
          ) : mode === 'add' ? (
            'Add Participant'
          ) : (
            'Save Changes'
          )}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className={cn(
              'px-4 py-2.5 text-sm font-medium',
              'bg-white/80 backdrop-blur-sm text-foreground shadow-md rounded-full',
              'hover:shadow-lg hover:bg-coral-50/90',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-coral-500 focus:ring-offset-2',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
