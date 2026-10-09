import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PostMarkdown } from '../post-markdown';

function render(source: string) {
  return renderToStaticMarkup(<PostMarkdown source={source} />).replace(/ class="[^"]*"/g, '');
}

describe('PostMarkdown', () => {
  it('renders the contract subset', () => {
    expect(
      render(
        [
          '## Before you go',
          '',
          'Take the **L train**, then *walk*. See [the map](https://example.com/map).',
          '',
          '- One',
          '- Two',
          '',
          '1. First',
          '',
          '### Later',
        ].join('\n')
      )
    ).toBe(
      [
        '<h2>Before you go</h2>',
        '<p>Take the <strong>L train</strong>, then <em>walk</em>. See <a href="https://example.com/map">the map</a>.</p>',
        '<ul>\n<li>One</li>\n<li>Two</li>\n</ul>',
        '<ol>\n<li>First</li>\n</ol>',
        '<h3>Later</h3>',
      ].join('\n')
    );
  });

  it('drops raw HTML and off-site links that are not https, keeping their text', () => {
    expect(
      render(
        [
          '<script>alert(1)</script>',
          '',
          'Hi <b onclick="x()">there</b> [click](javascript:alert(1)) [old](http://example.com) [a](//evil.example) [b](/\\evil.example) [home](/blog)',
          '',
          '# Big ![photo](https://example.com/a.jpg)',
        ].join('\n')
      )
    ).toBe(
      '\n<p>Hi there click old a <a href="/%5Cevil.example">b</a> <a href="/blog">home</a></p>\nBig '
    );
  });
});
