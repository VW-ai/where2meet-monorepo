import type { Participant } from '@/entities';

export function hidesAddress({
  fuzzyLocation,
  location,
}: Pick<Participant, 'fuzzyLocation' | 'location'>): boolean {
  return fuzzyLocation && location !== null;
}

export function startingLocationError({
  address,
  placeId,
  savedAddress,
  hasHiddenAddress = false,
}: {
  address: string;
  placeId: string;
  savedAddress?: string;
  hasHiddenAddress?: boolean;
}): string | null {
  const typed = address.trim();
  if (!typed) return hasHiddenAddress ? null : 'Address is required';
  if (!placeId && typed !== savedAddress) return 'Pick an address from the suggestions';
  return null;
}
