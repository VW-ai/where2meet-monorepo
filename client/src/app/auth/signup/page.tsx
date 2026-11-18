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
import { CatLoader } from '@/components/cat/cat-loader';

export default function SignUpPage() {
  const router = useRouter();
  const { register, error, clearError } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationError('');

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      await register({ email, password, name });
      router.push(nextPathFrom(window.location.search));
    } catch {
      // The store holds the error
    } finally {
      setIsLoading(false);
    }
  };

  const displayError = validationError || error;

  return (
    <AuthCard
      title="Create your account"
      subtitle="Keep every meeting in one place, on any device."
      footer={
        <>
          Already have an account?{' '}
          <Link
            href="/auth/signin"
            className={s.link}
            // Keeps ?next= so either page returns to where they started
            onClick={(e) => {
              e.preventDefault();
              router.push(`/auth/signin${window.location.search}`);
            }}
          >
            Sign in
          </Link>
        </>
      }
    >
      {isGoogleSignInEnabled() && (
        <div className="mb-5 space-y-5">
          <GoogleSignInButton
            text="signup_with"
            onSignedIn={() => router.push(nextPathFrom(window.location.search))}
          />
          <OrDivider />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
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
            required
            autoComplete="name"
          />
        </div>

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
          <label htmlFor="password" className={s.label}>
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={s.input}
            placeholder="At least 8 characters"
            required
            autoComplete="new-password"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className={s.label}>
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={s.input}
            required
            autoComplete="new-password"
          />
        </div>

        {displayError && <div className={s.error}>{displayError}</div>}

        <button type="submit" disabled={isLoading} className={`w-full ${s.primaryButton}`}>
          {isLoading && <CatLoader size={18} onColor />}
          {isLoading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthCard>
  );
}
