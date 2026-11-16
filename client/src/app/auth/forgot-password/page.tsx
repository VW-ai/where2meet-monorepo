'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authClient } from '@/features/auth/api';
import { AuthCard, accountStyles as s } from '@/features/auth/ui/account-shell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await authClient.requestPasswordReset(email);
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  const backToSignIn = (
    <Link href="/auth/signin" className={s.link}>
      Back to sign in
    </Link>
  );

  if (isSuccess) {
    return (
      <AuthCard title="Check your email" footer={backToSignIn}>
        <p className="text-[15px] text-[#21252b]">
          We sent a reset link to <strong>{email}</strong>.
        </p>
        <p className="mt-2 text-sm text-[#666b73]">
          It expires in 1 hour. If it isn&apos;t in your inbox, check spam.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="We'll email you a link to choose a new one."
      footer={backToSignIn}
    >
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

        {error && <div className={s.error}>{error}</div>}

        <button type="submit" disabled={isLoading} className={`w-full ${s.primaryButton}`}>
          {isLoading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
    </AuthCard>
  );
}
