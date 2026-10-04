import Image from 'next/image';
import Link from 'next/link';
import catLogo from '@/components/cat/logo.svg';

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#eef1f4] text-[#21252b]">
      <header className="mx-auto max-w-2xl px-4 pt-4 sm:pt-5">
        <Link
          href="/"
          aria-label="Where2Meet"
          className="inline-flex items-center rounded-full bg-white p-1.5 shadow-[0_3px_16px_rgba(23,37,45,0.15)]"
        >
          <Image src={catLogo} alt="Where2Meet" width={36} height={36} className="h-9 w-9" />
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-12 pt-8">{children}</main>
    </div>
  );
}
