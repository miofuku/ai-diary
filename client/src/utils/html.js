const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (character) => HTML_ESCAPE_MAP[character]);

const applyInlineMarkdown = (line) => {
  let formatted = line;

  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  return formatted;
};

export const renderSafeMarkdown = (markdown = '') => {
  if (!markdown) {
    return { __html: '' };
  }

  const normalized = escapeHtml(markdown).replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const htmlParts = [];
  let listItems = [];

  const flushList = () => {
    if (!listItems.length) {
      return;
    }

    htmlParts.push(`<ul>${listItems.join('')}</ul>`);
    listItems = [];
  };

  lines.forEach((line) => {
    if (!line.trim()) {
      flushList();
      htmlParts.push('<br/>');
      return;
    }

    const listMatch = line.match(/^\s*-\s+(.+)$/);
    if (listMatch) {
      listItems.push(`<li>${applyInlineMarkdown(listMatch[1])}</li>`);
      return;
    }

    flushList();

    const headingMatch = line.match(/^\s*##\s+(.+)$/);
    if (headingMatch) {
      htmlParts.push(`<h2>${applyInlineMarkdown(headingMatch[1])}</h2>`);
      return;
    }

    htmlParts.push(`<p>${applyInlineMarkdown(line)}</p>`);
  });

  flushList();

  return { __html: htmlParts.join('') };
};

export const sanitizeHighlightHtml = (markup = '') =>
  escapeHtml(markup)
    .replace(/&lt;span class=(?:&#39;|&quot;)highlight(?:&#39;|&quot;)&gt;/gi, '<span class="highlight">')
    .replace(/&lt;\/span&gt;/gi, '</span>')
    .replace(/\r\n?/g, '\n')
    .replace(/\n/g, '<br/>');
