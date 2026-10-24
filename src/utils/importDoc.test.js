import { describe, it, expect } from 'vitest';
import { sanitizeImportedHtml, sanitizeRichHtml, plainTextToHtml, ACCEPTED_IMPORT_TYPES } from './importDoc';

describe('sanitizeImportedHtml', () => {
  it('maps Google-Docs bold spans to <strong>', () => {
    const out = sanitizeImportedHtml('<p><span style="font-weight:700">Hi</span></p>');
    expect(out).toContain('<strong>Hi</strong>');
  });

  it('respects font-weight:normal on a <b> wrapper (Google Docs quirk)', () => {
    // Google Docs wraps content in <b style="font-weight:normal"> — must NOT bold.
    const out = sanitizeImportedHtml('<b style="font-weight:normal"><span>plain</span></b>');
    expect(out).not.toContain('<strong>');
    expect(out).toContain('plain');
  });

  it('maps italic and underline styles to <em>/<u>', () => {
    const out = sanitizeImportedHtml('<span style="font-style:italic">a</span><span style="text-decoration:underline">b</span>');
    expect(out).toContain('<em>a</em>');
    expect(out).toContain('<u>b</u>');
  });

  it('keeps headings, lists and links', () => {
    const out = sanitizeImportedHtml('<h1>Title</h1><ul><li>one</li><li>two</li></ul><a href="https://x.com">link</a>');
    expect(out).toContain('<h1>Title</h1>');
    expect(out).toContain('<ul><li>one</li><li>two</li></ul>');
    expect(out).toContain('<a href="https://x.com">link</a>');
  });

  it('strips scripts, styles and stray attributes', () => {
    const out = sanitizeImportedHtml('<p class="c" id="i" style="color:red">hi</p><script>alert(1)</script><style>x{}</style>');
    expect(out).toBe('<p>hi</p>');
    expect(out).not.toContain('script');
    expect(out).not.toContain('class');
  });

  it('drops javascript: links but keeps mailto:', () => {
    const out = sanitizeImportedHtml('<a href="javascript:evil()">x</a><a href="mailto:a@b.com">m</a>');
    expect(out).not.toContain('javascript:');
    expect(out).toContain('mailto:a@b.com');
  });

  it('converts DIV blocks to paragraphs and drops empty ones', () => {
    const out = sanitizeImportedHtml('<div>real</div><div></div>');
    expect(out).toBe('<p>real</p>');
  });
});

describe('sanitizeRichHtml (format-preserving paste)', () => {
  it('preserves color and background styles', () => {
    const out = sanitizeRichHtml('<p style="color:#ff0000;background-color:#ffff00">hi</p>');
    expect(out).toContain('color: #ff0000');
    expect(out).toContain('background-color: #ffff00');
  });

  it('preserves text alignment and font size', () => {
    const out = sanitizeRichHtml('<p style="text-align:center;font-size:18px">c</p>');
    expect(out).toContain('text-align: center');
    expect(out).toContain('font-size: 18px');
  });

  it('keeps tables with their cells and spans', () => {
    const out = sanitizeRichHtml('<table><tr><th>H</th></tr><tr><td colspan="2">c</td></tr></table>');
    expect(out).toContain('<table>');
    expect(out).toContain('<th>H</th>');
    expect(out).toContain('colspan="2"');
  });

  it('keeps https and data images but drops others', () => {
    const ok = sanitizeRichHtml('<img src="https://x.com/a.png" alt="a"><img src="data:image/png;base64,AAAA">');
    expect(ok).toContain('src="https://x.com/a.png"');
    expect(ok).toContain('data:image/png;base64,AAAA');
    const bad = sanitizeRichHtml('<img src="javascript:alert(1)">');
    expect(bad).not.toContain('javascript:');
    expect(bad).not.toContain('<img');
  });

  it('strips scripts, event handlers, class/id and disallowed styles', () => {
    const out = sanitizeRichHtml('<p class="c" id="i" onclick="x()" style="color:red;position:fixed">t</p><script>bad()</script>');
    expect(out).not.toContain('script');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('class');
    expect(out).not.toContain('position');   // disallowed style prop dropped
    expect(out).toContain('color: red');      // allowed style kept
  });

  it('drops url()/expression style values', () => {
    const out = sanitizeRichHtml('<p style="background:url(evil.png);color:blue">t</p>');
    expect(out).not.toContain('url(');
    expect(out).toContain('color: blue');
  });
});

describe('plainTextToHtml', () => {
  it('splits blank lines into paragraphs and single newlines into <br>', () => {
    expect(plainTextToHtml('a\nb\n\nc')).toBe('<p>a<br>b</p><p>c</p>');
  });
  it('escapes HTML special characters', () => {
    expect(plainTextToHtml('<b> & </b>')).toBe('<p>&lt;b&gt; &amp; &lt;/b&gt;</p>');
  });
  it('returns empty string for blank input', () => {
    expect(plainTextToHtml('   ')).toBe('');
  });
});

describe('ACCEPTED_IMPORT_TYPES', () => {
  it('advertises docx, html and txt', () => {
    expect(ACCEPTED_IMPORT_TYPES).toContain('.docx');
    expect(ACCEPTED_IMPORT_TYPES).toContain('.html');
    expect(ACCEPTED_IMPORT_TYPES).toContain('.txt');
  });
});
