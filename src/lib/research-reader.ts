import { marked } from 'marked';

/** Split only actual top-level headings; fenced code and nested headings stay intact. */
export function researchSections(text: string) {
  const tokens = marked.lexer(text);
  const depth = Math.min(
    ...tokens.flatMap((token) => (token.type === 'heading' ? [token.depth] : []))
  );
  const sections: { title: string; text: string }[] = [];
  let intro = '';
  for (const token of tokens) {
    if (token.type === 'heading' && token.depth === depth) {
      sections.push({ title: token.text, text: token.raw });
    } else if (sections.length) {
      sections[sections.length - 1].text += token.raw;
    } else {
      intro += token.raw;
    }
  }
  // Keep reference-style links available when rendering individual sections.
  const references = Object.entries(tokens.links)
    .map(
      ([label, link]) =>
        `\n[${label}]: <${link.href}>${link.title ? ` ${JSON.stringify(link.title)}` : ''}`
    )
    .join('');
  return {
    intro: intro + references,
    sections: sections.map((s) => ({ ...s, text: s.text + references }))
  };
}
