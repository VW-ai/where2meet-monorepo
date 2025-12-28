'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { authClient } from '@/features/auth/api';
import catLogo from '@/components/cat/image.png';

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
    setIsLoading(true);
    setError('');
    setValidationError('');

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setValidationError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    // Validate password length
    if (newPassword.length < 8) {
      setValidationError('Password must be at least 8 characters');
      setIsLoading(false);
      return;
    }

    if (!token) {
      setError('Invalid reset token');
      setIsLoading(false);
      return;
    }

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
      <div className="min-h-screen bg-gradient-to-br from-coral-50 via-mint-50 to-lavender-50">
        <header className="container mx-auto px-4 py-6">
          <Link href="/" className="flex items-center gap-3 w-fit">
            <Image
              src={catLogo}
              alt="Where2Meet Cat Logo"
              width={48}
              height={48}
              className="w-10 h-10 sm:w-12 sm:h-12"
              priority
            />
          </Link>
        </header>

        <main className="container mx-auto px-4 py-12 md:py-20">
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 text-center">
              <div className="w-16 h-16 bg-mint-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-mint-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold mb-2">Password Reset Successful</h1>
              <p className="text-gray-600 mb-6">
                Your password has been reset. You can now sign in with your new password.
              </p>
              <p className="text-sm text-gray-500">Redirecting to sign in...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-coral-50 via-mint-50 to-lavender-50">
      <header className="container mx-auto px-4 py-6">
        <Link href="/" className="flex items-center gap-3 w-fit">
          <Image
            src={catLogo}
            alt="Where2Meet Cat Logo"
            width={48}
            height={48}
            className="w-10 h-10 sm:w-12 sm:h-12"
            priority
          />
        </Link>
      </header>

      <main className="container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12">
            <h1 className="text-3xl font-bold text-center mb-2">Reset Password</h1>
            <p className="text-center text-gray-600 mb-8">Enter your new password below</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-coral-500 focus:border-transparent outline-none transition-all"
                  placeholder="At least 8 characters"
                  required
                  autoComplete="new-password"
                  disabled={!token}
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-coral-500 focus:border-transparent outline-none transition-all"
                  placeholder="Re-enter your password"
                  required
                  autoComplete="new-password"
                  disabled={!token}
                />
              </div>

              {displayError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                  {displayError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !token}
                className="w-full px-6 py-3 bg-coral-500 text-white rounded-full font-medium hover:bg-coral-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Resetting password...' : 'Reset Password'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link
                href="/auth/signin"
                className="text-sm text-coral-500 hover:text-coral-600 transition-colors"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-coral-50 via-mint-50 to-lavender-50 flex items-center justify-center">
          <div className="text-gray-600">Loading...</div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
