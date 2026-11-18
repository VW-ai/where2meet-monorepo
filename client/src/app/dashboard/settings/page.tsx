'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { AddressAutocomplete } from '@/shared/ui/address-autocomplete';
import { reverseGeocode } from '@/shared/lib/google-maps/geocoding';
import { AccountShell, accountStyles as s } from '@/features/auth/ui/account-shell';
import { UserAvatar, UserMenu } from '@/features/auth/ui/user-menu';
import { CatLoader } from '@/components/cat/cat-loader';

type SaveMessage = { kind: 'success' | 'error'; text: string } | null;

export default function SettingsPage() {
  const router = useRouter();
  const { user, updateProfile, logout } = useAuthStore();
  const [name, setName] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<SaveMessage>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAddressInput(user.defaultAddress || '');
      setPlaceId(user.defaultPlaceId || null);
    }
  }, [user]);

  const flash = (next: SaveMessage) => {
    setMessage(next);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAddressChange = (value: string) => {
    setAddressInput(value);
    setPlaceId(null); // A typed address isn't verified until picked from the list
  };

  const handleAddressSelect = (prediction: {
    place_id: string;
    description: string;
    full_address?: string;
  }) => {
    setAddressInput(prediction.full_address || prediction.description);
    setPlaceId(prediction.place_id);
  };

  const handleLocate = async () => {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      const { latitude, longitude } = position.coords;
      const result = await reverseGeocode({ lat: latitude, lng: longitude });
      if (result) {
        setAddressInput(result.address);
        setPlaceId(result.placeId);
      }
    } catch (error) {
      console.error('Geolocation error:', error);
      flash({ kind: 'error', text: "We couldn't find your location. Type your address instead." });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (addressInput && !placeId) {
      setMessage({ kind: 'error', text: 'Pick your address from the suggestions to save it.' });
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({
        name: name || undefined,
        defaultAddress: addressInput || undefined,
        defaultPlaceId: placeId || undefined,
      });
      flash({ kind: 'success', text: 'Saved.' });
    } catch {
      setMessage({ kind: 'error', text: "We couldn't save your changes. Try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <AccountShell actions={<UserMenu />}>
      <Link
        href="/dashboard"
        className="-ml-1 inline-flex items-center gap-0.5 text-sm font-semibold text-[#666b73] hover:text-[#21252b]"
      >
        <ChevronLeft size={16} strokeWidth={2.5} />
        Your meetings
      </Link>
      <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.8px]">Account</h1>

      <form onSubmit={handleSave} className="mt-6 space-y-4">
        <section className={s.card}>
          <div className="flex items-center gap-3">
            <UserAvatar size="lg" />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">{user?.name || 'Your profile'}</p>
              <p className="truncate text-sm text-[#666b73]">{user?.email}</p>
            </div>
          </div>

          <div className="mt-5">
            <label htmlFor="name" className={s.label}>
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={s.input}
              placeholder="What friends call you"
              autoComplete="name"
            />
            <p className={s.hint}>Shown to the group when you join a meeting.</p>
          </div>
        </section>

        <section className={s.card}>
          <label htmlFor="defaultAddress" className={s.label}>
            Usual starting point
          </label>
          <AddressAutocomplete
            value={addressInput}
            onChange={handleAddressChange}
            onSelect={handleAddressSelect}
            onLocate={handleLocate}
            placeholder="Home, work, or a nearby cross street"
            className="w-full"
          />
          <p className={s.hint}>We fill this in when you create or join a meeting.</p>
        </section>

        {message && (
          <div className={message.kind === 'success' ? s.success : s.error}>{message.text}</div>
        )}

        <button type="submit" disabled={isSaving} className={`w-full ${s.primaryButton}`}>
          {isSaving && <CatLoader size={18} onColor />}
          {isSaving ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      <button
        onClick={handleLogout}
        className="mt-8 w-full text-center text-sm font-semibold text-[#666b73] hover:text-[#21252b]"
      >
        Sign out
      </button>
    </AccountShell>
  );
}
