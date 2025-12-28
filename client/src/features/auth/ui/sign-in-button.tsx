'use client';

import { useRouter } from 'next/navigation';

export function SignInButton() {
  const router = useRouter();

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => router.push('/auth/signin')}
        className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
      >
        Sign In
      </button>
      <button
        onClick={() => router.push('/auth/signup')}
        className="px-4 py-2 text-sm font-medium bg-coral-500 text-white rounded-full hover:bg-coral-600 transition-colors"
      >
        Sign Up
      </button>
    </div>
  );
}
