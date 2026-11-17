'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useAuthStore } from '@/features/auth/model/auth-store';

type GoogleButtonText = 'signin_with' | 'signup_with' | 'continue_with';

interface CredentialResponse {
  credential: string;
}

interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    ux_mode: 'popup';
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type: 'standard';
      theme: 'outline';
      size: 'large';
      shape: 'pill';
      text: GoogleButtonText;
      logo_alignment: 'center';
      width: number;
    }
  ): void;
}

declare global {
  interface Window {
    // Google Maps also sets window.google, without accounts
    google?: { accounts?: { id: GoogleAccountsId } };
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const GIS_MAX_WIDTH = 400;

export function isGoogleSignInEnabled(): boolean {
  return GOOGLE_CLIENT_ID !== '';
}

interface GoogleSignInButtonProps {
  text: GoogleButtonText;
  onSignedIn: () => void;
}

export function GoogleSignInButton({ text, onSignedIn }: GoogleSignInButtonProps) {
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle);
  const containerRef = useRef<HTMLDivElement>(null);
  const onSignedInRef = useRef(onSignedIn);
  const [isScriptReady, setIsScriptReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    onSignedInRef.current = onSignedIn;
  }, [onSignedIn]);

  useEffect(() => {
    const container = containerRef.current;
    const gsi = window.google?.accounts?.id;
    if (!isScriptReady || !container || !gsi) return;

    gsi.initialize({
      client_id: GOOGLE_CLIENT_ID,
      ux_mode: 'popup',
      callback: async ({ credential }) => {
        setIsSigningIn(true);
        try {
          await signInWithGoogle(credential);
          onSignedInRef.current();
        } catch {
          // The store keeps the message in `error`, which the page shows.
        } finally {
          setIsSigningIn(false);
        }
      },
    });
    gsi.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text,
      logo_alignment: 'center',
      width: Math.min(container.offsetWidth, GIS_MAX_WIDTH),
    });
  }, [isScriptReady, signInWithGoogle, text]);

  if (!isGoogleSignInEnabled()) return null;

  return (
    <>
      <Script
        id="google-gsi-client"
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setIsScriptReady(true)}
      />
      <div ref={containerRef} className={`flex justify-center ${isSigningIn ? 'hidden' : ''}`} />
      {isSigningIn && (
        <p className="py-2.5 text-center text-sm text-gray-600" role="status">
          Signing in…
        </p>
      )}
    </>
  );
}
