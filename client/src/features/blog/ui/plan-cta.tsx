import Link from 'next/link';
import { SITE_CONFIG } from '@/lib/seo/metadata';

/** The call to action after an article: the pitch and a button to the planner. */
export function PlanCta({ heading }: { heading: string }) {
  return (
    <aside className="mt-6 rounded-[28px] border-2 border-[#c83f49]/25 bg-[#fff0ef] p-5 sm:p-6">
      <h2 className="text-lg font-bold tracking-[-0.3px]">{heading}</h2>
      <p className="mt-1 text-sm leading-relaxed text-[#666b73]">{SITE_CONFIG.pitch}</p>
      <Link
        href="/"
        className="mt-4 inline-flex min-h-12 items-center justify-center rounded-[14px] bg-[#c83f49] px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[#b73540] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b73540]"
      >
        Start planning
      </Link>
    </aside>
  );
}
