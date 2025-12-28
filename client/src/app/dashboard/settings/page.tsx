'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { AddressAutocomplete } from '@/shared/ui/address-autocomplete';
import { reverseGeocode } from '@/shared/lib/google-maps/geocoding';
import { OAuthButton } from '@/features/auth/ui/oauth-button';
import { OAUTH_PROVIDERS } from '@/features/auth/lib/oauth-providers';
import { userClient } from '@/features/user/api';
import catLogo from '@/components/cat/image.png';

interface Identity {
  id: string;
  provider: 'email' | 'google' | 'github';
  providerId: string;
  createdAt: string;
}

export default function SettingsPage() {
  const { user, updateProfile, logout } = useAuthStore();
  const [name, setName] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [defaultFuzzyLocation, setDefaultFuzzyLocation] = useState(false);
  const [_isLocating, setIsLocating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [isLoadingIdentities, setIsLoadingIdentities] = useState(true);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAddressInput(user.defaultAddress || '');
      setPlaceId(user.defaultPlaceId || null);
      setDefaultFuzzyLocation(user.defaultFuzzyLocation);
    }
  }, [user]);

  useEffect(() => {
    const fetchIdentities = async () => {
      try {
        const data = await userClient.getIdentities();
        setIdentities(data.identities);
      } catch (error) {
        console.error('Error fetching identities:', error);
      } finally {
        setIsLoadingIdentities(false);
      }
    };

    if (user) {
      fetchIdentities();
    }
  }, [user]);

  const handleUnlinkProvider = async (provider: string) => {
    if (
      !confirm(`Are you sure you want to disconnect ${provider}? You can reconnect it anytime.`)
    ) {
      return;
    }

    setUnlinkingProvider(provider);

    try {
      await userClient.unlinkIdentity(provider);

      // Refresh identities
      const data = await userClient.getIdentities();
      setIdentities(data.identities);

      setSaveMessage(
        `${provider.charAt(0).toUpperCase() + provider.slice(1)} disconnected successfully!`
      );
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error unlinking provider:', error);
      setSaveMessage('Failed to disconnect provider. Please try again.');
    } finally {
      setUnlinkingProvider(null);
    }
  };

  const handleAddressChange = (value: string) => {
    setAddressInput(value);
    setPlaceId(null); // Clear placeId when manually typing
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
      setIsLocating(true);

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
      setSaveMessage('Failed to get your location. Please enter your address manually.');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setIsLocating(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage('');

    // Validate: If address is set, placeId must also be set
    if (addressInput && !placeId) {
      setSaveMessage('Please select an address from the autocomplete dropdown');
      setIsSaving(false);
      return;
    }

    try {
      await updateProfile({
        name: name || undefined,
        defaultAddress: addressInput || undefined,
        defaultPlaceId: placeId || undefined,
        defaultFuzzyLocation,
      });
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      setSaveMessage('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-coral-50 via-mint-50 to-lavender-50">
      <header className="bg-white/90 backdrop-blur-sm shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-3">
              <Image
                src={catLogo}
                alt="Where2Meet"
                width={40}
                height={40}
                className="w-10 h-10"
                priority
              />
              <span className="font-semibold text-lg text-gray-900">Where2Meet</span>
            </Link>

            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Settings</h1>
            <p className="text-gray-600">Manage your account preferences</p>
          </div>

          <div className="bg-white rounded-3xl shadow-sm p-8">
            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                    <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
                  </div>

                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                      Name
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-coral-500 focus:border-transparent outline-none transition-all"
                      placeholder="Your name"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Default Preferences</h2>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="defaultAddress"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Default Address
                    </label>
                    <AddressAutocomplete
                      value={addressInput}
                      onChange={handleAddressChange}
                      onSelect={handleAddressSelect}
                      onLocate={handleLocate}
                      placeholder="Enter your default address"
                      className="w-full"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      This address will be used by default when joining new events.
                      {placeId
                        ? ' ✓ Address verified'
                        : addressInput
                          ? ' Type and select from dropdown to verify.'
                          : ''}
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <input
                      id="defaultFuzzyLocation"
                      type="checkbox"
                      checked={defaultFuzzyLocation}
                      onChange={(e) => setDefaultFuzzyLocation(e.target.checked)}
                      className="mt-1 w-4 h-4 text-coral-500 border-gray-300 rounded focus:ring-coral-500"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor="defaultFuzzyLocation"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Use fuzzy location by default
                      </label>
                      <p className="text-xs text-gray-500 mt-1">
                        Hide your exact location from other participants (shows approximate area)
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Connected Accounts</h2>

                {isLoadingIdentities ? (
                  <div className="text-center py-4 text-gray-500">Loading...</div>
                ) : (
                  <div className="space-y-3">
                    {/* Email (always present) */}
                    {identities.find((i) => i.provider === 'email') && (
                      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <svg
                              className="w-5 h-5 text-gray-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                              />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Email</p>
                            <p className="text-sm text-gray-500">{user?.email}</p>
                          </div>
                        </div>
                        <span className="text-sm text-gray-500 px-3 py-1 bg-gray-100 rounded-full">
                          Primary
                        </span>
                      </div>
                    )}

                    {/* Google */}
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center">
                          {OAUTH_PROVIDERS.google.icon}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Google</p>
                          {identities.find((i) => i.provider === 'google') ? (
                            <p className="text-sm text-gray-500">Connected</p>
                          ) : (
                            <p className="text-sm text-gray-500">Not connected</p>
                          )}
                        </div>
                      </div>
                      {identities.find((i) => i.provider === 'google') ? (
                        <button
                          onClick={() => handleUnlinkProvider('google')}
                          disabled={unlinkingProvider === 'google' || identities.length <= 1}
                          className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1 border border-red-200 rounded-full hover:bg-red-50 transition-colors"
                        >
                          {unlinkingProvider === 'google' ? 'Disconnecting...' : 'Disconnect'}
                        </button>
                      ) : (
                        <OAuthButton
                          provider="google"
                          mode="link"
                          className="!w-auto !px-4 !py-2 !text-sm"
                        />
                      )}
                    </div>

                    {/* GitHub */}
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center">
                          {OAUTH_PROVIDERS.github.icon}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">GitHub</p>
                          {identities.find((i) => i.provider === 'github') ? (
                            <p className="text-sm text-gray-500">Connected</p>
                          ) : (
                            <p className="text-sm text-gray-500">Not connected</p>
                          )}
                        </div>
                      </div>
                      {identities.find((i) => i.provider === 'github') ? (
                        <button
                          onClick={() => handleUnlinkProvider('github')}
                          disabled={unlinkingProvider === 'github' || identities.length <= 1}
                          className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1 border border-red-200 rounded-full hover:bg-red-50 transition-colors"
                        >
                          {unlinkingProvider === 'github' ? 'Disconnecting...' : 'Disconnect'}
                        </button>
                      ) : (
                        <OAuthButton
                          provider="github"
                          mode="link"
                          className="!w-auto !px-4 !py-2 !text-sm"
                        />
                      )}
                    </div>

                    {identities.length <= 1 && (
                      <p className="text-xs text-gray-500 mt-2">
                        You must have at least one authentication method connected.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {saveMessage && (
                <div
                  className={`p-3 rounded-lg text-sm ${saveMessage.includes('successfully') ? 'bg-mint-50 text-mint-700' : 'bg-red-50 text-red-700'}`}
                >
                  {saveMessage}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-3 bg-coral-500 text-white rounded-full font-medium hover:bg-coral-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <Link
                  href="/dashboard"
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-full font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
