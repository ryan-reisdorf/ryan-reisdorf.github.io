/* Tiny Markdown renderer for lab writeups. Builds DOM nodes directly (no
   innerHTML), so raw HTML in a writeup shows up as text and can't run.
   Supports: headings, paragraphs, bold, italic, inline code, fenced code,
   links, images, lists, blockquotes, horizontal rules. */
window.renderMarkdown = (() => {
  'use strict';

  // Only http(s), mailto and relative URLs; relative ones resolve against the writeup's folder.
  function safeUrl(url, base) {
    const u = String(url).trim();
    if (/^(https?:|mailto:)/i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith('//')) return null;
    try { return new URL(u, base).href; } catch (e) { return null; }
  }

  const INLINE = /(`+)([^`]+?)\1|!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+?)\*\*|__([^_]+?)__|\*([^*\s][^*]*?)\*|\b_([^_\s][^_]*?)_\b|<(https?:\/\/[^>\s]+)>/;

  function inline(text, parent, base) {
    let rest = text;
    while (rest) {
      const m = INLINE.exec(rest);
      if (!m) { parent.append(rest); break; }
      if (m.index) parent.append(rest.slice(0, m.index));
      rest = rest.slice(m.index + m[0].length);
      if (m[2] !== undefined) { const el = document.createElement('code'); el.textContent = m[2]; parent.append(el); }
      else if (m[4] !== undefined) {
        const src = safeUrl(m[4], base);
        if (src) { const img = document.createElement('img'); img.src = src; img.alt = m[3]; img.loading = 'lazy'; parent.append(img); }
        else parent.append(m[0]);
      } else if (m[6] !== undefined) {
        const href = safeUrl(m[6], base);
        if (href) { const a = document.createElement('a'); a.href = href; a.rel = 'noopener'; inline(m[5], a, base); parent.append(a); }
        else parent.append(m[5]);
      } else if (m[7] !== undefined || m[8] !== undefined) { const el = document.createElement('strong'); inline(m[7] ?? m[8], el, base); parent.append(el); }
      else if (m[9] !== undefined || m[10] !== undefined) { const el = document.createElement('em'); inline(m[9] ?? m[10], el, base); parent.append(el); }
      else if (m[11] !== undefined) { const a = document.createElement('a'); a.href = m[11]; a.rel = 'noopener'; a.textContent = m[11]; parent.append(a); }
    }
  }

  return function renderMarkdown(source, baseUrl) {
    const base = baseUrl || location.href;
    const out = document.createDocumentFragment();
    const lines = String(source).replace(/\r\n?/g, '\n').split('\n');
    let i = 0;
    const el = (tag, text) => { const e = document.createElement(tag); if (text !== undefined) inline(text, e, base); return e; };

    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }

      const fence = /^\s*(```|~~~)\s*([\w+-]*)\s*$/.exec(line);
      if (fence) {
        const code = [];
        for (i++; i < lines.length && !lines[i].trim().startsWith(fence[1]); i++) code.push(lines[i]);
        i++;
        const pre = document.createElement('pre'), c = document.createElement('code');
        c.textContent = code.join('\n'); if (fence[2]) c.dataset.lang = fence[2];
        pre.append(c); out.append(pre); continue;
      }
      const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
      if (heading) { out.append(el('h' + Math.min(6, heading[1].length + 2), heading[2])); i++; continue; }   // "#" becomes h3: the panel owns h2
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.append(document.createElement('hr')); i++; continue; }
      if (/^\s*>/.test(line)) {
        const quote = [];
        for (; i < lines.length && /^\s*>/.test(lines[i]); i++) quote.push(lines[i].replace(/^\s*>\s?/, ''));
        const q = document.createElement('blockquote'); q.append(renderMarkdown(quote.join('\n'), base)); out.append(q); continue;
      }
      const item = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
      if (item) {
        const ordered = /\d/.test(item[2]), list = document.createElement(ordered ? 'ol' : 'ul');
        const marker = ordered ? /^\s*\d+[.)]\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/;
        while (i < lines.length) {
          const m = marker.exec(lines[i]);
          if (!m) break;
          let text = m[1];
          for (i++; i < lines.length && /^\s{2,}\S/.test(lines[i]) && !marker.test(lines[i]); i++) text += ' ' + lines[i].trim();
          list.append(el('li', text));
        }
        out.append(list); continue;
      }
      const para = [];
      for (; i < lines.length && lines[i].trim() && !/^\s*(```|~~~|#{1,6}\s|>|[-*+]\s|\d+[.)]\s)/.test(lines[i]); i++) para.push(lines[i].trim());
      if (!para.length) { para.push(lines[i].trim()); i++; }
      out.append(el('p', para.join(' ')));
    }
    return out;
  };
})();
