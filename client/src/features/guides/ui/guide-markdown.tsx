import Markdown, { type Components } from 'react-markdown';
import { proseComponents as prose } from '@/mdx-components';

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
 * Renders editor Markdown from the control plane on the server. Raw HTML is dropped,
 * not escaped, so a stray tag never shows up as text.
 */
export function GuideMarkdown({ source }: { source: string }) {
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
