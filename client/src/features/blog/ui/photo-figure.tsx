import Image from 'next/image';
import { LICENSES, showsCrop, type Photo, type PhotoCredit } from '@/features/blog/lib/photos';

const creditLink = 'underline decoration-current/40 underline-offset-2 hover:decoration-current';

export const CONTENT_WIDTH_SIZES = '(min-width: 896px) 864px, calc(100vw - 32px)';

export function photoLoading(aboveFold: boolean) {
  return aboveFold
    ? ({ loading: 'eager', fetchPriority: 'high' } as const)
    : ({ loading: 'lazy' } as const);
}

export function PhotoFigure({
  photo,
  sizes,
  aboveFold = false,
  className = '',
  imageClassName = '',
}: {
  photo: Photo;
  sizes: string;
  aboveFold?: boolean;
  className?: string;
  imageClassName?: string;
}) {
  return (
    <figure className={className}>
      <Image
        src={photo.src}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        sizes={sizes}
        {...photoLoading(aboveFold)}
        className={`h-auto w-full bg-[#eef1f4] ${imageClassName}`}
      />
      <figcaption className="mt-2 px-1 text-xs leading-relaxed text-[#666b73]">
        {photo.caption && `${photo.caption.replace(/\.$/, '')}. `}
        <CreditLine credit={photo.credit} />
      </figcaption>
    </figure>
  );
}

export function CreditLine({ credit }: { credit: PhotoCredit }) {
  const { author, license, pageUrl } = credit;
  const licenseUrl = LICENSES[license].url;
  return (
    <>
      {`Photo by ${author} (`}
      {licenseUrl ? (
        <a href={licenseUrl} className={creditLink}>
          {license}
        </a>
      ) : (
        license
      )}
      {showsCrop(credit) ? ', cropped) via ' : ') via '}
      <a href={pageUrl} className={`whitespace-nowrap ${creditLink}`}>
        Wikimedia Commons
      </a>
    </>
  );
}
