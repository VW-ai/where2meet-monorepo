import Markdown, { type Components } from 'react-markdown';
import { layoutBody } from '@/features/blog/lib/body';
import type { CuratedPlace } from '@/features/blog/lib/catalog';
import type { CommonsImage } from '@/features/blog/lib/photos';
import { CuratedPlaces } from './curated-places';
import { PhotoFigure } from './photo-figure';
import { PlanLink } from './plan-cta';
import { prose } from './prose';

/** The article card's inner width: the 864px column less the card's padding, 20px a side or 32px from 640px. */
const BODY_PHOTO_SIZES =
  '(min-width: 896px) 800px, (min-width: 640px) calc(100vw - 96px), calc(100vw - 72px)';

/** The contract's Markdown subset. Anything else keeps its text and loses its markup. */
const ALLOWED_ELEMENTS = ['p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'h2', 'h3'];

/** react-markdown hands each component its syntax `node`, which must not reach the DOM. */
const components: Components = {
  h2: ({ node: _node, ...props }) => <prose.h2 {...props} />,
  h3: ({ node: _node, ...props }) => <prose.h3 {...props} />,
  p: ({ node: _node, ...props }) => <prose.p {...props} />,
  ul: ({ node: _node, ...props }) => <prose.ul {...props} />,
  ol: ({ node: _node, ...props }) => <prose.ol {...props} />,
  li: ({ node: _node, ...props }) => <prose.li {...props} />,
  strong: ({ node: _node, ...props }) => <prose.strong {...props} />,
  a: ({ node: _node, href, children, ...props }) =>
    href ? (
      <prose.a href={href} {...props}>
        {children}
      </prose.a>
    ) : (
      children
    ),
};

/** Keeps https links and site paths; any other link renders as its text. */
function safeUrl(url: string): string | undefined {
  return url.startsWith('https://') || /^\/(?!\/)/.test(url) ? url : undefined;
}

/**
 * Raw HTML is dropped, not escaped, so a stray tag never shows up as text.
 */
export function PostMarkdown({ source }: { source: string }) {
  return (
    <Markdown
      allowedElements={ALLOWED_ELEMENTS}
      unwrapDisallowed
      skipHtml
      urlTransform={safeUrl}
      components={components}
    >
      {source}
    </Markdown>
  );
}

export function MarkdownBody({
  markdown,
  images,
  places,
  placesTitle,
}: {
  markdown: string;
  images: readonly CommonsImage[];
  places: readonly CuratedPlace[];
  placesTitle: string;
}) {
  return layoutBody(markdown, images, places.length > 0).map((block, index) => {
    if (block.kind === 'photo') {
      return (
        <PhotoFigure
          key={index}
          photo={block.image}
          sizes={BODY_PHOTO_SIZES}
          className="my-8"
          imageClassName="rounded-[20px]"
        />
      );
    }
    if (block.kind === 'places') {
      return <CuratedPlaces key={index} title={placesTitle} places={places} />;
    }
    if (block.kind === 'plan') {
      return (
        <PlanLink
          key={index}
          label="Plan this with your group"
          className="mx-auto my-8 max-w-[38rem]"
        />
      );
    }
    return <PostMarkdown key={index} source={block.source} />;
  });
}
