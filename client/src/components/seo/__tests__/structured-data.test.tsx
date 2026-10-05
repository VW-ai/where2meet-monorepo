import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StructuredData } from '../structured-data';

describe('StructuredData', () => {
  it('keeps "</script>" in a value from closing the tag, and the JSON still parses back', () => {
    const name = 'Ann Arbor </script><script>alert(1)</script>';
    const html = renderToStaticMarkup(
      <StructuredData data={{ '@context': 'https://schema.org', '@type': 'Place', name }} />
    );

    expect(html).toBe(
      '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Place","name":"Ann Arbor \\u003c/script>\\u003cscript>alert(1)\\u003c/script>"}</script>'
    );
    expect(JSON.parse(html.slice(html.indexOf('>') + 1, -'</script>'.length)).name).toBe(name);
  });
});
