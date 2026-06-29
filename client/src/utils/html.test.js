import { describe, it, expect } from 'vitest';
import { escapeHtml } from './html';

describe('escapeHtml', () => {
  it('escapes HTML-significant characters', () => {
    expect(escapeHtml('<a href="x">&\'')).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&#39;'
    );
  });

  it('returns an empty string for no input', () => {
    expect(escapeHtml()).toBe('');
  });
});
