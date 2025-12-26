'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OAUTH_PROVIDERS, OAuthProvider } from '@/lib/oauth-providers';

interface OAuthButtonProps {
  provider: OAuthProvider;
  mode?: 'signin' | 'signup' | 'link';
  onError?: (error: string) => void;
  className?: string;
}

export function OAuthButton({
  provider,
  mode = 'signin',
  onError,
  className = '',
}: OAuthButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const config = OAUTH_PROVIDERS[provider];

  const getText = () => {
    switch (mode) {
      case 'signup':
        return `Sign up with ${config.displayName}`;
      case 'link':
        return `Connect ${config.displayName}`;
      default:
        return `Continue with ${config.displayName}`;
    }
  };

  const handleClick = async () => {
    setIsLoading(true);

    try {
      // Redirect to OAuth initiation endpoint
      window.location.href = `/api/auth/${provider}`;
    } catch (error) {
      console.error(`Error initiating ${provider} OAuth:`, error);
      if (onError) {
        onError(`Failed to connect with ${config.displayName}`);
      }
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${config.buttonColor} ${className}`}
    >
      {config.icon}
      <span>{isLoading ? 'Connecting...' : getText()}</span>
    </button>
  );
}
