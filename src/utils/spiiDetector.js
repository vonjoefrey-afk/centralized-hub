/**
 * spiiDetector.js
 * Detects sensitive PII/SPII in free text — scoped to what actually matters:
 *   • Card details (card numbers, "visa 1234", CVV)
 *   • Tax information (SSN, EIN, TIN/ITIN/VAT)
 *   • Personal information (email, phone, address, date of birth)
 *
 * Crucially, it does NOT flag reference identifiers — case IDs, bug IDs,
 * consult IDs, tickets, etc. Loose numbers are only flagged when they either
 * carry a sensitive keyword (e.g. "visa"), match a strict sensitive format
 * (e.g. SSN 123-45-6789), or pass a Luhn check (real card numbers). Any match
 * sitting in a reference-ID context is dropped.
 */

// If the text immediately before a candidate match looks like a reference id
// ("Case ID:", "Bug #", "Consult no.", "Ticket -", …), the match is ignored.
const REFERENCE_CONTEXT = /(?:case|bug|consult(?:ation)?|ticket|incident|inc|reference|ref|tracking|order|invoice|inv|conf(?:irmation)?)\s*(?:id|no|num|number|#)?\s*[:#.\-]?\s*$/i;

const isReferenceContext = (text, index) => {
  const before = text.slice(Math.max(0, index - 28), index);
  return REFERENCE_CONTEXT.test(before);
};

// Luhn check — real credit/debit card numbers satisfy it; random reference
// numbers almost never do, so this keeps bare digit strings from false-flagging.
const luhnValid = (raw) => {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
};

/**
 * Detection rules. `capture` (1-based group index) narrows what a validator
 * checks; `validate` optionally gates a match (e.g. Luhn for bare cards).
 */
const RULES = [
  // ── Card details ──
  // Keyword + digits, e.g. "visa 1234", "card no: 4111 1111", "cvv 123".
  {
    type: 'CARD DETAILS',
    regex: /\b(?:visa|mastercard|master\s?card|amex|american\s?express|discover|credit\s?card|debit\s?card|debit|card(?:\s?(?:number|no|num))?|cc|cvv|cvc)\b[\s:#.\-]*(\d[\d\s-]{1,18}\d)\b/gi,
  },
  // Strictly formatted card numbers (grouped by spaces/dashes).
  { type: 'CARD DETAILS', regex: /\b\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{4}\b/g },
  { type: 'CARD DETAILS', regex: /\b\d{4}[ -]\d{6}[ -]\d{5}\b/g },
  // Bare 13–19 digit strings, but only real card numbers (Luhn).
  { type: 'CARD DETAILS', regex: /\b\d{13,19}\b/g, validate: luhnValid },

  // ── Tax information ──
  { type: 'TAX INFORMATION', regex: /\b\d{3}-\d{2}-\d{4}\b/g }, // SSN
  { type: 'TAX INFORMATION', regex: /\b\d{2}-\d{7}\b/g }, // EIN
  {
    type: 'TAX INFORMATION',
    regex: /\b(?:ssn|social\s?security(?:\s?(?:no|number))?|sin|itin|tin|ein|tax\s?id(?:entification)?(?:\s?(?:no|number))?|taxpayer|vat)\b[\s:#.\-]*([A-Z0-9][A-Z0-9-]{4,14})\b/gi,
  },

  // ── Personal information ──
  { type: 'PERSONAL INFORMATION', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi }, // email
  // Formatted phone numbers (require separators so bare IDs don't match).
  { type: 'PERSONAL INFORMATION', regex: /\b(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g },
  // Phone with a keyword, e.g. "mobile: 09171234567".
  { type: 'PERSONAL INFORMATION', regex: /\b(?:phone|mobile|cell|tel|telephone|contact|call)\b[\s:#.\-]*(\+?\d[\d\s.-]{6,14}\d)\b/gi },
  // Street address.
  { type: 'PERSONAL INFORMATION', regex: /\b\d{1,5}\s(?:[A-Z][a-zA-Z]+\s?){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct)\b/gi },
  // Date of birth (keyworded so ordinary dates don't flag).
  { type: 'PERSONAL INFORMATION', regex: /\b(?:dob|date\s?of\s?birth|birth\s?date)\b[\s:#.\-]*\d{1,4}[\/.\-]\d{1,2}[\/.\-]\d{1,4}\b/gi },
];

const redact = (value) => value.replace(/./g, (char, index) => (index < 4 ? char : '*'));

/**
 * Scans text for sensitive information.
 * @param {string} text
 * @returns {Array<{type:string, value:string, redacted:string}>}
 */
export const detectSPII = (text) => {
  if (!text || typeof text !== 'string') return [];

  const detections = [];

  for (const rule of RULES) {
    const regex = new RegExp(rule.regex.source, rule.regex.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      // Guard against zero-length matches looping forever.
      if (match.index === regex.lastIndex) regex.lastIndex++;

      // Never flag reference identifiers (case / bug / consult / ticket …).
      if (isReferenceContext(text, match.index)) continue;

      const captured = rule.capture ? match[rule.capture] : match[1] || match[0];
      if (rule.validate && !rule.validate(captured)) continue;

      const value = match[0].trim();
      if (!value) continue;
      if (!detections.some((d) => d.value === value)) {
        detections.push({ type: rule.type, value, redacted: redact(value) });
      }
    }
  }

  return detections;
};

/**
 * Whether text contains any sensitive information.
 * @param {string} text
 * @returns {boolean}
 */
export const containsSPII = (text) => detectSPII(text).length > 0;
