'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const PROVIDER_CONFIG = {
  google: {
    name: 'Google',
    logo: '🔵',
    color: 'bg-blue-500',
    textColor: 'text-blue-600',
  },
  github: {
    name: 'GitHub',
    logo: '⚫',
    color: 'bg-gray-900',
    textColor: 'text-gray-900',
  },
};

export default function OAuthMockPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const provider = searchParams.get('provider') as 'google' | 'github' | null;
  const state = searchParams.get('state');

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!provider || !state) {
      router.push('/auth/signin');
    }
  }, [provider, state, router]);

  if (!provider || !state) {
    return null;
  }

  const config = PROVIDER_CONFIG[provider];

  const handleAllow = async () => {
    if (!email || !name) {
      return;
    }

    setIsLoading(true);

    try {
      // Generate mock authorization code containing user info
      const mockProfile = {
        providerId: `mock_${provider}_${Date.now()}`,
        email,
        name,
        emailVerified: true,
      };

      const code = btoa(JSON.stringify(mockProfile));

      // Redirect to callback with code and state
      const callbackUrl = `/api/auth/${provider}/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
      router.push(callbackUrl);
    } catch (error) {
      console.error('Error in OAuth mock:', error);
      setIsLoading(false);
    }
  };

  const handleDeny = () => {
    router.push('/auth/signin?error=oauth_denied');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">{config.logo}</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{config.name} Account Access</h1>
          <p className="text-gray-600">Where2Meet wants to access your {config.name} account</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-gray-700 mb-2">This will allow Where2Meet to:</p>
          <ul className="space-y-1 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>Read your email address</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>Read your basic profile information</span>
            </li>
          </ul>
        </div>

        <div className="border-t border-gray-200 pt-6 mb-6">
          <p className="text-sm font-medium text-gray-700 mb-4">
            For testing, enter your mock {config.name} info:
          </p>

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-coral-500 focus:border-transparent outline-none"
                placeholder="user@example.com"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-coral-500 focus:border-transparent outline-none"
                placeholder="John Doe"
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleAllow}
            disabled={!email || !name || isLoading}
            className={`flex-1 px-6 py-3 ${config.color} text-white rounded-full font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity`}
          >
            {isLoading ? 'Processing...' : 'Allow'}
          </button>
          <button
            onClick={handleDeny}
            disabled={isLoading}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-full font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Deny
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center mt-6">
          This is a mock OAuth page for development. In production, this would be {config.name}'s
          actual consent screen.
        </p>
      </div>
    </div>
  );
}
