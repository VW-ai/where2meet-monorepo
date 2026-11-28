import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { NYC_PATH } from '@/features/nyc-map/model/themes';
import { ThemeIcon } from '@/features/nyc-map/ui/icons';

/** The home page's one link to the NYC theme maps. */
export function NycEntry() {
  return (
    <Link
      href={NYC_PATH}
      data-leave="0"
      className="group mt-10 flex items-center gap-4 rounded-[24px] bg-white p-4 shadow-[0_4px_24px_rgba(23,37,45,0.1)] transition-[box-shadow,translate] duration-200 hover:-translate-y-1 hover:shadow-[0_14px_36px_rgba(23,37,45,0.18)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b73540] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-5 lg:mt-12"
    >
      <span aria-hidden="true" className="flex shrink-0 -space-x-2">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-[#9fd3cf] ring-2 ring-white">
          <ThemeIcon name="duck" fill="#f5b82e" detail="#e8741f" className="h-7 w-7" />
        </span>
        <span className="grid h-11 w-11 place-items-center rounded-full bg-[#2b3647] ring-2 ring-white">
          <ThemeIcon name="umbrella" fill="#d4563d" detail="#ffffff" className="h-7 w-7" />
        </span>
        <span className="grid h-11 w-11 place-items-center rounded-full bg-[#e9eefb] ring-2 ring-white">
          <ThemeIcon name="cup" fill="#2a4fb8" detail="#ffffff" className="h-7 w-7" />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-[#21252b]">NYC maps by theme</span>
        <span className="block text-[13px] leading-snug text-[#666b73]">
          Duck ponds, indoor days and study spots
        </span>
      </span>
      <ArrowRight
        size={18}
        aria-hidden="true"
        className="shrink-0 text-[#bc3942] transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
