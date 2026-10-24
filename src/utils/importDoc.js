/**
 * importDoc — turn external rich text (Google Docs exports, pasted HTML, .docx,
 * .html, .txt) into the clean, whitelisted HTML our scratchpad editor stores.
 *
 * Google Docs (and Word) emit huge amounts of inline styling and wrapper spans.
 * We keep only semantic structure — headings, lists, links, and bold/italic/
 * underline/strike — and translate common inline styles into semantic tags so
 * the imported document looks right and stays small.
 */

const BLOCK_MAP = {
  H1: 'h1', H2: 'h2', H3: 'h3', H4: 'h3', H5: 'h3', H6: 'h3',
  P: 'p', DIV: 'p', BLOCKQUOTE: 'blockquote', PRE: 'pre',
  UL: 'ul', OL: 'ol', LI: 'li',
};

const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'HEAD', 'TITLE', 'NOSCRIPT', 'IFRAME', 'OBJECT']);

// Which semantic inline wrappers an element implies (from its tag + inline style).
const inlineWrappers = (el) => {
  const tag = el.tagName;
  const style = (el.getAttribute && el.getAttribute('style')) || '';
  const fw = /font-weight:\s*(\d+|bold|normal)/i.exec(style);

  let bold = tag === 'B' || tag === 'STRONG';
  if (fw) bold = fw[1] === 'bold' || (/^\d+$/.test(fw[1]) && parseInt(fw[1], 10) >= 600);

  let italic = tag === 'I' || tag === 'EM';
  if (/font-style:\s*normal/i.test(style)) italic = false;
  else if (/font-style:\s*italic/i.test(style)) italic = true;

  const underline = tag === 'U' || /text-decoration[^;"]*underline/i.test(style);
  const strike = tag === 'S' || tag === 'STRIKE' || tag === 'DEL' ||
    /text-decoration[^;"]*line-through/i.test(style);

  const w = [];
  if (bold) w.push('strong');
  if (italic) w.push('em');
  if (underline) w.push('u');
  if (strike) w.push('s');
  return w;
};

const convertChildren = (srcParent) => {
  const out = [];
  srcParent.childNodes.forEach((node) => {
    if (node.nodeType === 3) { // text
      if (node.textContent) out.push(document.createTextNode(node.textContent));
      return;
    }
    if (node.nodeType !== 1) return; // skip comments etc.
    const el = node;
    const tag = el.tagName;
    if (DROP_TAGS.has(tag)) return;

    if (tag === 'BR') { out.push(document.createElement('br')); return; }

    const block = BLOCK_MAP[tag];
    if (block) {
      const bel = document.createElement(block);
      convertChildren(el).forEach((c) => bel.appendChild(c));
      if (block === 'p' && !bel.textContent.trim() && !bel.querySelector('br')) return; // drop empty paragraphs
      out.push(bel);
      return;
    }

    if (tag === 'A') {
      const a = document.createElement('a');
      const href = el.getAttribute('href');
      if (href && /^(https?:|mailto:)/i.test(href)) a.setAttribute('href', href);
      convertChildren(el).forEach((c) => a.appendChild(c));
      out.push(a);
      return;
    }

    // Everything else (SPAN, FONT, unknown): apply style-derived wrappers to its
    // children and splice them in.
    let children = convertChildren(el);
    inlineWrappers(el).forEach((w) => {
      const wel = document.createElement(w);
      children.forEach((c) => wel.appendChild(c));
      children = [wel];
    });
    children.forEach((c) => out.push(c));
  });
  return out;
};

/** Whitelist + normalize arbitrary HTML into editor-safe HTML. */
export const sanitizeImportedHtml = (html) => {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  const container = document.createElement('div');
  convertChildren(doc.body).forEach((c) => container.appendChild(c));
  return container.innerHTML.trim();
};

/* ------------------------------------------------------------------------- *
 * Format-preserving sanitizer (used by paste).
 *
 * Unlike the clean importer above, this KEEPS visual formatting — colors,
 * highlight, font size/weight, alignment, tables and images — so pasted
 * content looks like its source. It still strips anything unsafe: scripts,
 * <style>, event handlers, class/id, and non-http(s)/data resources.
 * ------------------------------------------------------------------------- */

const RICH_TAGS = new Set([
  'P', 'DIV', 'SPAN', 'BR', 'HR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'UL', 'OL', 'LI', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL',
  'SUB', 'SUP', 'A', 'BLOCKQUOTE', 'PRE', 'CODE', 'FONT',
  'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'CAPTION', 'IMG',
]);

const ALLOWED_STYLE_PROPS = new Set([
  'color', 'background-color', 'background', 'font-size', 'font-weight',
  'font-style', 'font-family', 'text-decoration', 'text-decoration-line',
  'text-align', 'vertical-align', 'line-height', 'width', 'height',
  'border', 'border-color', 'border-width', 'border-style', 'padding',
]);

const filterStyle = (style) => {
  if (!style) return '';
  return style
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((decl) => {
      const i = decl.indexOf(':');
      if (i < 0) return null;
      const prop = decl.slice(0, i).trim().toLowerCase();
      const val = decl.slice(i + 1).trim();
      if (!ALLOWED_STYLE_PROPS.has(prop)) return null;
      if (/url\(|expression|javascript:/i.test(val)) return null;
      return `${prop}: ${val}`;
    })
    .filter(Boolean)
    .join('; ');
};

const cleanRich = (srcParent) => {
  const out = [];
  srcParent.childNodes.forEach((node) => {
    if (node.nodeType === 3) {
      if (node.textContent) out.push(document.createTextNode(node.textContent));
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node;
    const tag = el.tagName;
    if (DROP_TAGS.has(tag)) return;

    // Unknown tag: keep its (cleaned) children but drop the wrapper.
    if (!RICH_TAGS.has(tag)) {
      cleanRich(el).forEach((c) => out.push(c));
      return;
    }

    const clean = document.createElement(tag.toLowerCase());
    const style = filterStyle(el.getAttribute('style'));
    if (style) clean.setAttribute('style', style);

    if (tag === 'A') {
      const href = el.getAttribute('href');
      if (href && /^(https?:|mailto:)/i.test(href)) clean.setAttribute('href', href);
    } else if (tag === 'IMG') {
      const src = el.getAttribute('src');
      if (src && /^(https?:|data:image\/)/i.test(src)) clean.setAttribute('src', src);
      else return; // drop images we can't safely reference
      ['alt', 'width', 'height'].forEach((a) => {
        if (el.hasAttribute(a)) clean.setAttribute(a, el.getAttribute(a));
      });
    } else if (tag === 'TD' || tag === 'TH') {
      ['colspan', 'rowspan'].forEach((a) => {
        if (el.hasAttribute(a)) clean.setAttribute(a, el.getAttribute(a));
      });
    }

    if (tag !== 'IMG' && tag !== 'BR' && tag !== 'HR') {
      cleanRich(el).forEach((c) => clean.appendChild(c));
    }
    out.push(clean);
  });
  return out;
};

/** Sanitize pasted HTML while preserving visual formatting. */
export const sanitizeRichHtml = (html) => {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  const container = document.createElement('div');
  cleanRich(doc.body).forEach((c) => container.appendChild(c));
  return container.innerHTML.trim();
};

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Plain text -> paragraphs (blank line = new paragraph, single = <br>). */
export const plainTextToHtml = (text) => {
  if (!text || !text.trim()) return '';
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
};

/**
 * Convert an uploaded file into { title, content }.
 * Supports .docx (via mammoth, lazy-loaded), .html/.htm, and .txt/.md.
 */
export const fileToDocument = async (file) => {
  const title = file.name.replace(/\.[^.]+$/, '').trim() || 'Imported document';
  const ext = (file.name.split('.').pop() || '').toLowerCase();

  if (ext === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    const mammoth = await import('mammoth');
    const result = await (mammoth.default || mammoth).convertToHtml({ arrayBuffer });
    return { title, content: sanitizeImportedHtml(result.value) };
  }
  if (ext === 'html' || ext === 'htm') {
    return { title, content: sanitizeImportedHtml(await file.text()) };
  }
  if (ext === 'txt' || ext === 'md' || ext === '') {
    return { title, content: sanitizeImportedHtml(plainTextToHtml(await file.text())) };
  }
  if (ext === 'doc') {
    throw new Error('Legacy .doc files aren’t supported — in Google Docs use File → Download → Microsoft Word (.docx).');
  }
  throw new Error(`Unsupported file type “.${ext}”. Use .docx, .html, or .txt.`);
};

export const ACCEPTED_IMPORT_TYPES = '.docx,.html,.htm,.txt,.md';
