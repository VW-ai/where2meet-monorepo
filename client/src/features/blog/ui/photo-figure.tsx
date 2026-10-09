import Image from 'next/image';
import { LICENSES, showsCrop, type Photo } from '@/features/blog/lib/photos';

const creditLink = 'underline decoration-current/40 underline-offset-2 hover:decoration-current';

export function PhotoFigure({
  photo,
  sizes,
  preload = false,
  className = '',
  imageClassName = '',
}: {
  photo: Photo;
  sizes: string;
  preload?: boolean;
  className?: string;
  imageClassName?: string;
}) {
  const { author, license, pageUrl } = photo.credit;
  const licenseUrl = LICENSES[license].url;
  return (
    <figure className={className}>
      <Image
        src={photo.src}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        sizes={sizes}
        preload={preload}
        loading={preload ? 'eager' : 'lazy'}
        className={`h-auto w-full bg-[#eef1f4] ${imageClassName}`}
      />
      <figcaption className="mt-2 px-1 text-xs leading-relaxed text-[#666b73]">
        {photo.caption && `${photo.caption.replace(/\.$/, '')}. `}
        {`Photo by ${author} (`}
        {licenseUrl ? (
          <a href={licenseUrl} className={creditLink}>
            {license}
          </a>
        ) : (
          license
        )}
        {showsCrop(photo.credit) ? ', cropped) via ' : ') via '}
        <a href={pageUrl} className={`whitespace-nowrap ${creditLink}`}>
          Wikimedia Commons
        </a>
      </figcaption>
    </figure>
  );
}
