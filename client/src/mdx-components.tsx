import type { MDXComponents } from 'mdx/types';
import Link from 'next/link';

const linkClass =
  'font-medium text-[#bc3942] underline decoration-[#bc3942]/30 underline-offset-2 hover:decoration-[#bc3942]';

/** Prose styles shared by blog posts and the local guides' Markdown. */
export const proseComponents = {
  h2: (props) => (
    <h2
      className="mt-10 text-xl font-bold leading-snug tracking-[-0.4px] text-[#21252b] first:mt-0 sm:text-[22px]"
      {...props}
    />
  ),
  h3: (props) => (
    <h3 className="mt-8 text-lg font-semibold leading-snug text-[#21252b] first:mt-0" {...props} />
  ),
  p: (props) => <p className="mt-4 first:mt-0" {...props} />,
  ul: (props) => <ul className="mt-4 list-disc space-y-2 pl-5 marker:text-[#bc3942]" {...props} />,
  ol: (props) => (
    <ol
      className="mt-4 list-decimal space-y-2 pl-5 marker:font-semibold marker:text-[#bc3942]"
      {...props}
    />
  ),
  li: (props) => <li className="pl-1" {...props} />,
  a: ({ href, ...props }) =>
    href?.startsWith('/') ? (
      <Link href={href} className={linkClass} {...props} />
    ) : (
      <a href={href} className={linkClass} {...props} />
    ),
  strong: (props) => <strong className="font-semibold text-[#21252b]" {...props} />,
  img: ({ alt = '', ...props }) => (
    <img alt={alt} loading="lazy" className="mt-6 w-full rounded-[20px]" {...props} />
  ),
  blockquote: (props) => (
    <blockquote className="mt-6 border-l-4 border-[#f2c4c7] pl-4 text-[#666b73]" {...props} />
  ),
} satisfies MDXComponents;

export function useMDXComponents(): MDXComponents {
  return proseComponents;
}
