import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import catLogo from '@/components/cat/logo.svg';

// The look the rest of the site uses (about, blog, the meeting ticket).
export const accountStyles = {
  card: 'rounded-[28px] bg-white p-5 shadow-[0_4px_24px_rgba(23,37,45,0.1)] sm:p-7',
  label: 'mb-1.5 block text-[13px] font-semibold text-[#21252b]',
  input:
    'min-h-12 w-full rounded-[14px] border border-[#e4e8ed] bg-[#f7f8fa] px-4 text-[15px] text-[#21252b] outline-none transition-colors placeholder:text-[#a3a8b0] focus:border-[#c83f49] focus:bg-white disabled:cursor-not-allowed disabled:text-[#8b9098]',
  hint: 'mt-1.5 text-xs text-[#8b9098]',
  primaryButton:
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-[#c83f49] px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[#b73540] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b73540] disabled:cursor-not-allowed disabled:opacity-50',
  secondaryButton:
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-[#eef1f4] px-5 text-[15px] font-semibold text-[#21252b] transition-colors hover:bg-[#e4e8ed]',
  link: 'font-semibold text-[#bd3843] hover:text-[#b73540]',
  error: 'rounded-[14px] bg-[#fff0ef] px-4 py-3 text-sm text-[#b73540]',
  success: 'rounded-[14px] bg-[#e9f6ec] px-4 py-3 text-sm text-[#2f6b3a]',
};

interface AccountShellProps {
  children: ReactNode;
  // Top-right of the header, e.g. the account menu
  actions?: ReactNode;
  width?: 'narrow' | 'wide';
}

export function AccountShell({ children, actions, width = 'narrow' }: AccountShellProps) {
  const maxWidth = width === 'wide' ? 'max-w-3xl' : 'max-w-md';
  return (
    <div className="min-h-screen bg-[#eef1f4] text-[#21252b]">
      <header className={`mx-auto flex items-center justify-between px-4 pt-4 sm:pt-5 ${maxWidth}`}>
        <Link
          href="/"
          aria-label="Where2Meet home"
          className="inline-flex items-center rounded-full bg-white p-1.5 shadow-[0_3px_16px_rgba(23,37,45,0.15)]"
        >
          <Image
            src={catLogo}
            alt="Where2Meet"
            width={36}
            height={36}
            className="h-9 w-9"
            priority
          />
        </Link>
        {actions}
      </header>
      <main className={`mx-auto px-4 pb-12 pt-8 ${maxWidth}`}>{children}</main>
    </div>
  );
}

interface AuthCardProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  // Below the card, e.g. "Don't have an account? Sign up"
  footer?: ReactNode;
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <AccountShell>
      <div className="sm:pt-6">
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.8px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-[#666b73]">{subtitle}</p>}
        <div className={`mt-6 ${accountStyles.card}`}>{children}</div>
        {footer && <p className="mt-5 text-center text-sm text-[#666b73]">{footer}</p>}
      </div>
    </AccountShell>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[1.5px] text-[#a3a8b0]">
      <span className="h-px flex-1 bg-[#e4e8ed]" />
      or
      <span className="h-px flex-1 bg-[#e4e8ed]" />
    </div>
  );
}
