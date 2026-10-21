import { expect, it } from 'vitest';
import { researchSections } from '../src/lib/research-reader';
import { renderMarkdown } from '../src/lib/domain';

it('splits sources without losing content or treating fenced headings as sections', () => {
  const text = 'Intro\n\n# One\n## Summary\nhello\n\n```md\n# Fake\n```\n\n# Two\nworld';
  const result = researchSections(text);
  expect(result.sections.map((s) => s.title)).toEqual(['One', 'Two']);
  expect(result.intro + result.sections.map((s) => s.text).join('')).toBe(text);
  expect(researchSections('Plain text').intro).toBe('Plain text');
});

it('renders AI code-wrapped links, but preserves actual code and sanitizes HTML', () => {
  const text = '`[source](https://example.com)` and `https://example.org`';
  const html = renderMarkdown(text, true);
  expect(html).toContain('href="https://example.com"');
  expect(html).toContain('href="https://example.org"');
  expect(renderMarkdown(text)).not.toContain('<a ');
  expect(renderMarkdown('```md\n`[source](https://example.com)`\n```', true)).not.toContain('<a ');
  expect(renderMarkdown('[bad](javascript:alert(1))<script>alert(1)</script>', true)).not.toContain(
    'href='
  );
  expect(renderMarkdown('<script>alert(1)</script>', true)).not.toContain('<script');
});

it('retains reference links for separately rendered sources', () => {
  const result = researchSections(
    '# One\n[original][ref]\n# Two\nother\n\n[ref]: https://example.com'
  );
  expect(renderMarkdown(result.sections[0].text, true)).toContain('href="https://example.com"');
});
