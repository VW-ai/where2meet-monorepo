import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { SITE_CONFIG } from '@/lib/seo/metadata';

const focusRing =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b73540]';

/** The call to action after an article: the pitch and a button to the planner. */
export function PlanCta({ heading }: { heading: string }) {
  return (
    <aside className="mt-6 rounded-[28px] border-2 border-[#c83f49]/25 bg-[#fff0ef] p-5 sm:p-6">
      <h2 className="text-lg font-bold tracking-[-0.3px]">{heading}</h2>
      <p className="mt-1 text-sm leading-relaxed text-[#666b73]">{SITE_CONFIG.pitch}</p>
      <Link
        href="/"
        className={`mt-4 inline-flex min-h-12 items-center justify-center rounded-[14px] bg-[#c83f49] px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[#b73540] ${focusRing}`}
      >
        Start planning
      </Link>
    </aside>
  );
}

/** The compact call to action near the top of a page: one link to the planner. */
export function PlanLink({ label, className = '' }: { label: string; className?: string }) {
  return (
    <Link
      href="/"
      className={`group flex items-center gap-3 rounded-[20px] border-2 border-[#c83f49]/25 bg-[#fff0ef] px-4 py-3 ${focusRing} ${className}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-snug text-[#21252b] group-hover:text-[#bc3942]">
          {label}
        </span>
        <span className="mt-0.5 block text-sm leading-snug text-[#666b73]">
          {SITE_CONFIG.pitch}
        </span>
      </span>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#c83f49] text-white transition-colors group-hover:bg-[#b73540]">
        <ChevronRight size={20} aria-hidden="true" />
      </span>
    </Link>
  );
}
