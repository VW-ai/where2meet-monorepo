import Image from 'next/image';
import Link from 'next/link';
import type { ComponentProps } from 'react';
import catLogo from '@/components/cat/logo.svg';

export function SiteHeader(props: ComponentProps<'header'>) {
  return (
    <header {...props}>
      <Link
        href="/"
        aria-label="Where2Meet"
        className="inline-flex items-center rounded-full bg-white p-1.5 shadow-[0_3px_16px_rgba(23,37,45,0.15)]"
      >
        <Image
          src={catLogo}
          alt="Where2Meet"
          width={36}
          height={36}
          className="h-9 w-9"
          loading="eager"
        />
      </Link>
    </header>
  );
}
