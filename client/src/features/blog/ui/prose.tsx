import type { ComponentPropsWithoutRef } from 'react';
import Link from 'next/link';

const linkClass =
  'font-medium text-[#bc3942] underline decoration-[#bc3942]/30 underline-offset-2 hover:decoration-[#bc3942]';

/** Text keeps a readable line length; figures and place cards between it span the full card. */
const measure = 'mx-auto max-w-[38rem]';

export const prose = {
  h2: (props: ComponentPropsWithoutRef<'h2'>) => (
    <h2
      className={`${measure} mt-10 text-xl font-bold leading-snug tracking-[-0.4px] text-[#21252b] first:mt-0 sm:text-[22px]`}
      {...props}
    />
  ),
  h3: (props: ComponentPropsWithoutRef<'h3'>) => (
    <h3
      className={`${measure} mt-8 text-lg font-semibold leading-snug text-[#21252b] first:mt-0`}
      {...props}
    />
  ),
  p: (props: ComponentPropsWithoutRef<'p'>) => (
    <p className={`${measure} mt-4 first:mt-0`} {...props} />
  ),
  ul: (props: ComponentPropsWithoutRef<'ul'>) => (
    <ul className={`${measure} mt-4 list-disc space-y-2 pl-5 marker:text-[#bc3942]`} {...props} />
  ),
  ol: (props: ComponentPropsWithoutRef<'ol'>) => (
    <ol
      className={`${measure} mt-4 list-decimal space-y-2 pl-5 marker:font-semibold marker:text-[#bc3942]`}
      {...props}
    />
  ),
  li: (props: ComponentPropsWithoutRef<'li'>) => <li className="pl-1" {...props} />,
  a: ({ href, ...props }: ComponentPropsWithoutRef<'a'>) =>
    href?.startsWith('/') ? (
      <Link href={href} className={linkClass} {...props} />
    ) : (
      <a href={href} className={linkClass} {...props} />
    ),
  strong: (props: ComponentPropsWithoutRef<'strong'>) => (
    <strong className="font-semibold text-[#21252b]" {...props} />
  ),
};
