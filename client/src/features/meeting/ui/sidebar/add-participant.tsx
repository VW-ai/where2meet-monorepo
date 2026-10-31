'use client';

import { useState, FormEvent } from 'react';
import { Dices, UserPlus, X, CheckCircle2 } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { generateRandomName } from '@/features/meeting/lib/name-generator';
import { LocationField } from '@/shared/ui/location-field';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';

interface AddParticipantProps {
  onSubmit: (data: ParticipantFormData) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  mode?: 'add' | 'edit';
  initialData?: ParticipantFormData;
  /** Label for the secondary button (e.g. "Done" once people have been added in a row) */
  cancelLabel?: string;
  /** Confirmation for the previous submission, shown above the fields */
  notice?: string | null;
}

export interface ParticipantFormData {
  name: string;
  address: string;
  placeId: string;
}

export function AddParticipant({
  onSubmit,
  onCancel,
  isSubmitting = false,
  mode = 'add',
  initialData,
  cancelLabel = 'Cancel',
  notice,
}: AddParticipantProps) {
  const { user } = useAuthStore();
  const mapProvider = useMeetingStore((state) => state.currentEvent?.mapProvider);
  const hasDefaultAddress = !!(user?.defaultAddress && user?.defaultPlaceId);

  const [name, setName] = useState(initialData?.name || '');
  const [address, setAddress] = useState(initialData?.address || '');
  const [placeId, setPlaceId] = useState(initialData?.placeId || '');
  const [errors, setErrors] = useState<{ name?: string; address?: string }>({});

  // An address that was already saved has been geocoded, so editing only the name
  // must not force the user to re-pick it from the dropdown.
  const savedAddress = mode === 'edit' ? initialData?.address?.trim() : undefined;
  const addressIsSaved = !!savedAddress && address.trim() === savedAddress;

  const clearError = (field: 'name' | 'address') => {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Handle dice randomizer click
  const handleRandomizeName = () => {
    setName(generateRandomName());
    clearError('name');
  };

  // Typing clears a previously picked place; picking or locating sets it
  const handleLocationChange = (nextAddress: string, nextPlaceId: string) => {
    setAddress(nextAddress);
    setPlaceId(nextPlaceId);
    clearError('address');
  };

  // Handle use default address
  const handleUseDefaultAddress = () => {
    if (!user?.defaultAddress || !user?.defaultPlaceId) return;

    setAddress(user.defaultAddress);
    setPlaceId(user.defaultPlaceId);
    clearError('address');
  };

  // Validate form
  const validate = (): boolean => {
    const newErrors: { name?: string; address?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!address.trim()) {
      newErrors.address = 'Address is required';
    } else if (!placeId && !addressIsSaved) {
      newErrors.address = 'Pick an address from the suggestions';
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
            aria-label="Close"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {notice && (
        <p
          role="status"
          className="flex items-center gap-1.5 text-xs font-medium text-mint-700 animate-in fade-in duration-200"
        >
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {notice}
        </p>
      )}

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
              clearError('name');
            }}
            placeholder="Enter name or use the dice"
            disabled={isSubmitting}
            autoFocus
            autoComplete="off"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'participant-name-error' : undefined}
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
        {errors.name && (
          <p id="participant-name-error" className="text-xs text-red-500">
            {errors.name}
          </p>
        )}
      </div>

      {/* Address Autocomplete */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="participant-address"
            className="block text-sm font-medium text-foreground"
          >
            Starting location
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
        <LocationField
          id="participant-address"
          value={address}
          provider={mapProvider}
          onChange={handleLocationChange}
          onError={(message) => setErrors((prev) => ({ ...prev, address: message }))}
          disabled={isSubmitting}
          invalid={!!errors.address}
          className={cn(errors.address && 'ring-2 ring-red-500')}
        />
        {errors.address ? (
          <p className="text-xs text-red-500">{errors.address}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Pick a suggestion, or tap the target icon to use where you are now.
          </p>
        )}
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
            {cancelLabel}
          </button>
        )}
      </div>
    </form>
  );
}
