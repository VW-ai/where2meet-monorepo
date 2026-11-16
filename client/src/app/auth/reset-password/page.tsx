'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authClient } from '@/features/auth/api';
import { AccountShell, AuthCard, accountStyles as s } from '@/features/auth/ui/account-shell';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setValidationError('');

    if (newPassword !== confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setValidationError('Password must be at least 8 characters');
      return;
    }
    if (!token) {
      setError('Invalid reset token');
      return;
    }

    setIsLoading(true);
    try {
      await authClient.resetPassword({ token, newPassword });
      setIsSuccess(true);
      setTimeout(() => {
        router.push('/auth/signin');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  const displayError = validationError || error;

  if (isSuccess) {
    return (
      <AuthCard title="Password updated">
        <p className="text-[15px] text-[#666b73]">Taking you to sign in…</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      footer={
        <Link href="/auth/signin" className={s.link}>
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="newPassword" className={s.label}>
            New password
          </label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
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

        <button
          type="submit"
          disabled={isLoading || !token}
          className={`w-full ${s.primaryButton}`}
        >
          {isLoading ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AccountShell>{null}</AccountShell>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
