import Image from 'next/image';
import Link from 'next/link';
import { LICENSES } from '@/features/blog/lib/photos';
import { CreditLine } from '@/features/blog/ui/photo-figure';
import type { HomeCity } from '@/features/landing/lib/home-cities';

const TILE_SIZES = '(min-width: 1024px) 190px, (min-width: 640px) 220px, 62vw';

export function CityTiles({ cities }: { cities: HomeCity[] }) {
  if (cities.length === 0) return null;
  return (
    <section aria-labelledby="home-cities" className="mt-10 lg:mt-12" data-leave="0">
      {/* Darker than card text, because the backdrop's color glows can pass behind it. */}
      <h2 id="home-cities" className="text-[15px] font-semibold text-[#3a3f46]">
        Guides by city
      </h2>
      <ul className="-mx-4 mt-1 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-6 pt-2 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0 lg:pb-0">
        {cities.map((city) => (
          <li key={city.href} className="w-[62%] shrink-0 snap-start sm:w-[38%] lg:w-auto">
            <CityTile city={city} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CityTile({ city }: { city: HomeCity }) {
  return (
    <article className="group relative aspect-[4/5] overflow-hidden rounded-[24px] bg-[#eef1f4] shadow-[0_4px_24px_rgba(23,37,45,0.1)] transition-[box-shadow,translate] duration-200 focus-within:-translate-y-1.5 focus-within:shadow-[0_14px_36px_rgba(23,37,45,0.22)] hover:-translate-y-1.5 hover:shadow-[0_14px_36px_rgba(23,37,45,0.22)] has-[h3_a:focus-visible]:outline has-[h3_a:focus-visible]:outline-2 has-[h3_a:focus-visible]:outline-offset-2 has-[h3_a:focus-visible]:outline-[#b73540] motion-reduce:transition-none motion-reduce:focus-within:translate-y-0 motion-reduce:hover:translate-y-0">
      <Image
        src={city.photo.src}
        alt={city.photo.alt}
        width={city.photo.width}
        height={city.photo.height}
        sizes={TILE_SIZES}
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-4 pb-4 pt-12 text-white">
        <h3 className="text-lg font-bold leading-snug tracking-[-0.3px]">
          <Link href={city.href} className="after:absolute after:inset-0 focus:outline-none">
            {city.name}
          </Link>
        </h3>
        {/* A device that cannot hover shows the details all the time. */}
        <div className="grid grid-rows-[1fr] transition-[grid-template-rows,opacity] duration-200 group-focus-within:grid-rows-[1fr] group-focus-within:opacity-100 group-hover:grid-rows-[1fr] group-hover:opacity-100 motion-reduce:transition-none [@media(hover:hover)]:grid-rows-[0fr] [@media(hover:hover)]:opacity-0">
          <div className="overflow-hidden">
            <p className="mt-1 text-[13px] leading-snug text-white/90">
              {city.topOccasions.join(' · ')}
            </p>
            {LICENSES[city.photo.credit.license].attribution && (
              <p className="relative mt-1.5 text-[11px] leading-snug text-white/75">
                <CreditLine credit={{ ...city.photo.credit, cropped: true }} />
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
