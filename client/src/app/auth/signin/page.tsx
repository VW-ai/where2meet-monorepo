'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/features/auth/model/auth-store';
import {
  GoogleSignInButton,
  isGoogleSignInEnabled,
} from '@/features/auth/ui/google-sign-in-button';
import { AuthCard, OrDivider, accountStyles as s } from '@/features/auth/ui/account-shell';
import { nextPathFrom } from '@/features/auth/lib/next-path';

export default function SignInPage() {
  const router = useRouter();
  const { login, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    clearError();

    try {
      await login(email, password);
      router.push(nextPathFrom(window.location.search));
    } catch {
      // The store holds the error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to see every meeting you've planned or joined."
      footer={
        <>
          New to Where2Meet?{' '}
          <Link
            href="/auth/signup"
            className={s.link}
            // Keeps ?next= so either page returns to where they started
            onClick={(e) => {
              e.preventDefault();
              router.push(`/auth/signup${window.location.search}`);
            }}
          >
            Create an account
          </Link>
        </>
      }
    >
      {isGoogleSignInEnabled() && (
        <div className="mb-5 space-y-5">
          <GoogleSignInButton
            text="signin_with"
            onSignedIn={() => router.push(nextPathFrom(window.location.search))}
          />
          <OrDivider />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className={s.label}>
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={s.input}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className={s.label}>
              Password
            </label>
            <Link href="/auth/forgot-password" className={`text-xs ${s.link}`}>
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={s.input}
            required
            autoComplete="current-password"
          />
        </div>

        {error && <div className={s.error}>{error}</div>}

        <button type="submit" disabled={isLoading} className={`w-full ${s.primaryButton}`}>
          {isLoading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthCard>
  );
}
