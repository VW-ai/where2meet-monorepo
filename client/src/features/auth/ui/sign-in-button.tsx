'use client';

import { useRouter } from 'next/navigation';
import { UserRound } from 'lucide-react';

export function SignInButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push('/auth/signin')}
      aria-label="Account"
      className="grid h-9 w-9 place-items-center rounded-full text-[#8b9098] transition-colors hover:bg-[#f6f7f8] hover:text-[#21252b]"
    >
      <UserRound size={18} />
    </button>
  );
}
