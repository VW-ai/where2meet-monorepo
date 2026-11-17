import Link from 'next/link';
import type { ComponentProps } from 'react';

const LINKS = [
  { href: '/blog', label: 'Blog' },
  { href: '/faq', label: 'FAQ' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy', label: 'Privacy' },
];

export function SiteFooter(props: ComponentProps<'footer'>) {
  return (
    <footer {...props}>
      {/* Darker than the gray on white cards, because the home backdrop's color glows pass behind it. */}
      <nav className="mb-2 flex justify-center gap-5 text-sm">
        {LINKS.map(({ href, label }) => (
          <Link key={href} href={href} className="font-medium text-[#555a62] hover:text-[#bd3843]">
            {label}
          </Link>
        ))}
      </nav>
      <p className="text-center text-xs text-[#555a62]">© {new Date().getFullYear()} Where2Meet</p>
    </footer>
  );
}
