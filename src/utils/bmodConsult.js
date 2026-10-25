// BMod consult builder for the GCP Billing Calculation tab: policy selection
// (Runaway / TPA / Other), Runaway Spend eligibility, amount validation and
// the copy-ready consult text + subject line. Pure functions — no React — so
// the policy rules are unit-tested in bmodConsult.test.js.

export const POLICIES = ['TPA', 'Runaway', 'Other'];
export const JUSTIFICATIONS = ['Goodwill', 'Ops Error', 'Bug'];
export const ADJUSTMENT_TYPES = ['Credit', 'Debit', 'Refund'];
export const ELIGIBILITY_PRESETS = [10, 15, 50, 75, 90, 100];
export const PRODUCT_CODE_DEFAULT = '12007';
export const REQUESTER_ROLES = ['Billing Admin', 'Billing User', 'Billing Viewer'];

export const SUBJECT_BASE = 'CLOUD ADJREQUEST - [CREDIT] / [REFUND] Credit/Refund Requests';
export const RESTRICTED_COUNTRY_TAG = '#RCAdj';
// #RCAdj is only appended when the adjustment is at most this amount.
export const RESTRICTED_COUNTRY_MAX = 5000;
// All Runaway Spend good-faith adjustments are capped at this amount.
export const RUNAWAY_CAP = 1000000;
// Budget alert is valid only if its threshold is ≤ 25% of the last-90-days usage.
export const BUDGET_MAX_SHARE = 0.25;
// Anomaly detection is valid only if its threshold is ≤ 100% of the last-90-days usage.
export const ANOMALY_MAX_SHARE = 1;

// tier drives the Runaway matrix: individual | smb (incl. unowned startup) | ineligible | other (manual)
export const SEGMENTS = [
  { value: 'not-in-kerrigan', label: 'Not existing in Kerrigan', output: 'Student / Individual Developer (Not in Kerrigan)', tier: 'individual' },
  { value: 'smb', label: 'SMB', output: 'SMB / Scaled', tier: 'smb' },
  { value: 'startup-unowned', label: 'Startup without ownership', output: 'Startup (Unowned)', tier: 'smb' },
  { value: 'startup-owned', label: 'Startup with ownership', output: 'Startup with sales ownership (Ineligible Segment)', tier: 'ineligible' },
  { value: 'corporate', label: 'Corporate', output: 'Corporate (Ineligible Segment)', tier: 'ineligible' },
  { value: 'enterprise', label: 'Enterprise', output: 'Enterprise (Ineligible Segment)', tier: 'ineligible' },
  { value: 'select', label: 'Select', output: 'Select (Ineligible Segment)', tier: 'ineligible' },
  { value: 'other', label: 'OTHER', output: 'Other', tier: 'other' },
];

export const segmentFor = (value) => SEGMENTS.find((s) => s.value === value) || null;

export const emptyForm = () => ({
  restrictedCountry: '',     // 'Y' | 'N'
  policy: '',                // POLICIES
  justification: '',
  adjustmentType: '',
  problemStatement: '',
  affectedFrom: '',
  affectedTo: '',
  currency: 'USD',
  impactedAmount: '',
  usage90Days: '',           // Runaway only
  eligibility: '',           // TPA/Other (and Runaway when segment is OTHER): '10' | … | 'custom'
  customEligibility: '',
  segment: '',
  segmentOther: '',
  budgetAlert: '',           // Runaway only: 'Y' | 'N'
  budgetAmount: '',
  anomalyDetection: '',      // 'Y' | 'N'
  anomalyThreshold: '',      // Runaway only, optional
  marketplaceSkus: '',       // Runaway only: 'Y' | 'N'
  screenshotLinks: [''],
  resolved: '',              // 'Y' | 'N'
  resolvedExplanation: '',
  previousBmod: '',          // 'Y' | 'N'
  previousBmodReason: '',
  previousBmodAmount: '',
  previousBmodLinks: [''],
  missedAlertBug: '',        // Runaway 2nd-incident exception: 'Y' | 'N'
  ddos: 'N/A',               // 'N/A' | 'Y' | 'N'
  ddosLink: '',
  overpaymentRefund: 'N/A',  // 'N/A' | 'Y' | 'N'
  reseller: '',              // 'Y' | 'N'
  productCode: PRODUCT_CODE_DEFAULT, // '12007' | 'Other'
  productCodeOther: '',
  billingAccountId: '',
  invoiceId: '',
  relatedBug: '',
  requesterEmail: '',
  requesterRole: '',
  supportCase: '',
});

/** Parses "$4,200.50" / "4200.5" → 4200.5; blank or invalid → null. */
export const parseAmount = (value) => {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

const round2 = (n) => Math.round(n * 100) / 100;

export const formatMoney = (amount, currency = 'USD') => {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '';
  const num = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === 'USD' ? `$${num} USD` : `${num} ${currency}`;
};

export const isDriveLink = (url) => /^https:\/\/(drive|docs)\.google\.com\/\S+$/i.test(String(url || '').trim());
export const isBugRef = (ref) => /^b\/\d+$/.test(String(ref || '').trim());
export const isBillingAccountId = (id) => /^[0-9A-Z]{6}-[0-9A-Z]{6}-[0-9A-Z]{6}$/i.test(String(id || '').trim());
export const isEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());

/**
 * Budget alert status for Runaway. Valid only if configured AND the budget is
 * ≤ 25% of the last-90-days usage. Returns { label: 'Y' | 'Y-invalid' | 'N' | '', valid }.
 * valid is null when it can't be judged yet (missing amounts).
 */
export const budgetAlertStatus = ({ budgetAlert, budgetAmount, usage90Days }) => {
  if (budgetAlert === 'N') return { label: 'N', valid: false };
  if (budgetAlert !== 'Y') return { label: '', valid: null };
  const budget = parseAmount(budgetAmount);
  const usage = parseAmount(usage90Days);
  if (budget === null || usage === null || usage <= 0) return { label: 'Y', valid: null };
  const limit = round2(usage * BUDGET_MAX_SHARE);
  return budget <= limit ? { label: 'Y', valid: true, limit } : { label: 'Y-invalid', valid: false, limit };
};

/**
 * Anomaly detection status. Y/N; on Runaway an optional threshold above 100%
 * of the last-90-days usage makes it 'Y-invalid'.
 */
export const anomalyStatus = ({ anomalyDetection, anomalyThreshold, usage90Days }) => {
  if (anomalyDetection === 'N') return { label: 'N', valid: false };
  if (anomalyDetection !== 'Y') return { label: '', valid: null };
  const threshold = parseAmount(anomalyThreshold);
  const usage = parseAmount(usage90Days);
  if (threshold === null || usage === null || usage <= 0) return { label: 'Y', valid: true };
  const limit = round2(usage * ANOMALY_MAX_SHARE);
  return threshold <= limit ? { label: 'Y', valid: true, limit } : { label: 'Y-invalid', valid: false, limit };
};

const manualPercent = (form) => {
  if (form.eligibility === 'custom') return parseAmount(form.customEligibility);
  return parseAmount(form.eligibility);
};

/**
 * Runaway Spend eligibility. Fail-fast checks first (reseller, Marketplace
 * SKUs, previous incident), then the 1st-incident matrix by segment tier and
 * safeguards. Returns { percent, reason, manual } — manual when the segment
 * is OTHER and the agent must pick the percentage.
 */
export const runawayEligibility = (form) => {
  const segment = segmentFor(form.segment);
  const budget = budgetAlertStatus(form);
  const anomaly = anomalyStatus(form);

  if (form.reseller === 'Y') return { percent: 0, reason: 'Ineligible: customer is resold — the reseller/partner handles courtesy credits.' };
  if (form.marketplaceSkus === 'Y') return { percent: 0, reason: 'Ineligible: third-party Marketplace SKUs are not covered by Runaway Spend.' };
  if (form.previousBmod === 'Y') {
    if (segment?.tier === 'individual' && form.missedAlertBug === 'Y') {
      return { percent: 50, reason: 'Repeat incident exception: individual/student customer and an engineering bug confirmed the expected anomaly alert was not sent.' };
    }
    return { percent: 0, reason: 'Ineligible: this is a 2nd or subsequent runaway incident on the billing account.' };
  }
  if (!segment) return { percent: null, reason: 'Select the customer segment.' };
  if (segment.tier === 'ineligible') return { percent: 0, reason: `Ineligible segment: ${segment.label}.` };
  if (segment.tier === 'other') {
    return { percent: manualPercent(form), reason: 'Segment is OTHER — choose the eligibility percentage manually.', manual: true };
  }

  const safeguard = budget.valid === true || anomaly.valid === true;
  const safeguardText = safeguard ? 'a valid budget alert or anomaly detection is configured' : 'no valid budget alert or anomaly detection';
  if (segment.tier === 'individual') {
    return { percent: safeguard ? 100 : 75, reason: `1st incident, Student / Individual, ${safeguardText}.` };
  }
  return { percent: safeguard ? 75 : 50, reason: `1st incident, SMB / Scaled / unowned Startup, ${safeguardText}.` };
};

/** Suggested %, total and cap for the current form. */
export const computeAdjustment = (form) => {
  const impacted = parseAmount(form.impactedAmount);
  const eligibility = form.policy === 'Runaway'
    ? runawayEligibility(form)
    : { percent: manualPercent(form), reason: null };
  const percent = eligibility.percent;
  let total = null;
  let capped = false;
  if (impacted !== null && percent !== null && percent !== undefined) {
    total = round2((impacted * percent) / 100);
    if (form.policy === 'Runaway' && total > RUNAWAY_CAP) {
      total = RUNAWAY_CAP;
      capped = true;
    }
  }
  return { impacted, percent, total, capped, eligibility };
};

/** Subject line; #RCAdj only for restricted-country customers with an adjustment ≤ 5k. */
export const buildSubject = (restrictedCountry, total) => {
  const tag = restrictedCountry === 'Y' && !(total !== null && total > RESTRICTED_COUNTRY_MAX);
  return tag ? `${SUBJECT_BASE} ${RESTRICTED_COUNTRY_TAG}` : SUBJECT_BASE;
};

const yn = (v) => (v === 'Y' ? 'Yes' : v === 'N' ? 'No' : v === 'N/A' ? 'N/A' : '');
const filled = (links) => (links || []).map((l) => l.trim()).filter(Boolean);
const orNA = (v) => (String(v || '').trim() ? String(v).trim() : 'N/A');

const segmentText = (form) => {
  const s = segmentFor(form.segment);
  if (!s) return '';
  if (s.value === 'other') return form.segmentOther.trim() ? `Other — ${form.segmentOther.trim()}` : 'Other';
  return s.output;
};

/**
 * Builds the copy-ready consult. Returns { subject, text, warnings, missing }:
 * warnings flag policy problems (shown in the UI, never copied); missing lists
 * required fields not yet filled.
 */
export const buildConsult = (form) => {
  const isRunaway = form.policy === 'Runaway';
  const { impacted, percent, total, capped, eligibility } = computeAdjustment(form);
  const budget = budgetAlertStatus(form);
  const anomaly = anomalyStatus(form);
  const cur = form.currency || 'USD';
  const warnings = [];
  const missing = [];

  const need = (cond, label) => { if (!cond) missing.push(label); };
  need(form.restrictedCountry, 'Restricted country');
  need(form.policy, 'Policy');
  need(form.justification, 'Adjustment justification');
  need(form.adjustmentType, 'Adjustment type');
  need(form.problemStatement.trim(), 'Problem statement');
  need(form.affectedFrom && form.affectedTo, 'Affected dates');
  need(impacted !== null, 'Impacted amount');
  if (isRunaway) need(parseAmount(form.usage90Days) !== null, 'Last 90 days usage amount');
  need(percent !== null && percent !== undefined, 'Suggested adjustment');
  need(form.segment, 'Customer segment');
  if (isRunaway) need(form.budgetAlert, 'Budget alerts');
  if (isRunaway && form.budgetAlert === 'Y') need(parseAmount(form.budgetAmount) !== null, 'Budget amount');
  need(form.anomalyDetection, 'Anomaly detection');
  if (isRunaway) need(form.marketplaceSkus, 'Marketplace SKUs');
  need(form.resolved, 'Issue resolved');
  if (form.resolved === 'Y') need(form.resolvedExplanation.trim(), 'Preventive measure (issue resolved)');
  need(form.previousBmod, 'Previous BMod requests');
  if (form.previousBmod === 'Y') need(filled(form.previousBmodLinks).length > 0, 'Past BMod link');
  need(form.reseller, 'Reseller');
  need(form.productCode !== 'Other' || form.productCodeOther.trim(), 'Product code');
  need(form.billingAccountId.trim(), 'Cloud Billing Account ID');
  need(form.requesterEmail.trim(), 'Requester email');
  need(form.requesterRole, 'Requester role');
  need(form.supportCase.trim(), 'Support case');

  if (form.resolved === 'N') warnings.push({ level: 'error', text: 'Do not proceed: the issue must be resolved before an adjustment is requested.' });
  if (isRunaway && percent === 0) warnings.push({ level: 'error', text: eligibility.reason });
  if (isRunaway && budget.label === 'Y-invalid') warnings.push({ level: 'warn', text: `Budget alert is invalid: budget exceeds 25% of last 90 days usage (limit ${formatMoney(budget.limit, cur)}).` });
  if (isRunaway && anomaly.label === 'Y-invalid') warnings.push({ level: 'warn', text: `Anomaly detection is invalid: threshold exceeds 100% of last 90 days usage (limit ${formatMoney(anomaly.limit, cur)}).` });
  if (capped) warnings.push({ level: 'warn', text: `Total capped at ${formatMoney(RUNAWAY_CAP, cur)} (Runaway Spend maximum).` });
  if (!isRunaway && form.reseller === 'Y') warnings.push({ level: 'warn', text: 'Customer is a reseller — confirm the partner should not handle this adjustment.' });
  const badLinks = filled(form.screenshotLinks).filter((l) => !isDriveLink(l));
  if (badLinks.length) warnings.push({ level: 'warn', text: `Screenshot links must be Google Drive links: ${badLinks.join(', ')}` });
  if (form.relatedBug.trim() && !isBugRef(form.relatedBug)) warnings.push({ level: 'warn', text: 'Related bug should look like b/123456789.' });
  if (form.billingAccountId.trim() && !isBillingAccountId(form.billingAccountId)) warnings.push({ level: 'warn', text: 'Cloud Billing Account ID should look like XXXXXX-XXXXXX-XXXXXX.' });
  if (form.requesterEmail.trim() && !isEmail(form.requesterEmail)) warnings.push({ level: 'warn', text: 'Requester email does not look valid.' });
  if (cur !== 'USD' && (form.restrictedCountry === 'Y' || isRunaway)) warnings.push({ level: 'info', text: 'The $5k #RCAdj limit and the $1M Runaway cap are USD amounts — check the converted value.' });

  const dates = form.affectedFrom && form.affectedTo ? `${form.affectedFrom} to ${form.affectedTo}` : '';
  const pct = percent !== null && percent !== undefined ? `${percent}%` : '';
  const shots = filled(form.screenshotLinks);

  let previous = yn(form.previousBmod);
  if (form.previousBmod === 'Y') {
    const parts = [form.previousBmodReason.trim() && `Reason: ${form.previousBmodReason.trim()}`,
      parseAmount(form.previousBmodAmount) !== null && `Amount: ${formatMoney(parseAmount(form.previousBmodAmount), cur)}`]
      .filter(Boolean);
    const links = filled(form.previousBmodLinks);
    previous = ['Yes', parts.join(', '), links.length ? `Past BMod: ${links.join(', ')}` : ''].filter(Boolean).join(' — ');
  }

  let ddos = yn(form.ddos);
  if (form.ddos === 'Y' && form.ddosLink.trim()) ddos = `Yes — ${form.ddosLink.trim()}`;

  let resolved = yn(form.resolved);
  if (form.resolvedExplanation.trim()) resolved = `${resolved}, ${form.resolvedExplanation.trim()}`;

  let budgetLine = budget.label;
  if (budget.label === 'Y' && budget.valid) budgetLine = `Y (Valid: ${formatMoney(parseAmount(form.budgetAmount), cur)} budget ≤ 25% of last 90 days usage)`;
  if (budget.label === 'Y-invalid') budgetLine = `Y-invalid (${formatMoney(parseAmount(form.budgetAmount), cur)} budget exceeds 25% of last 90 days usage)`;
  let anomalyLine = anomaly.label;
  if (anomaly.label === 'Y-invalid') anomalyLine = 'Y-invalid (threshold exceeds 100% of last 90 days usage)';

  const productCode = form.productCode === 'Other' ? form.productCodeOther.trim() : form.productCode;
  const requester = [form.requesterEmail.trim(), form.requesterRole].filter(Boolean).join(', ');
  const supportCase = form.supportCase.trim() ? `go/vgo/${form.supportCase.trim().replace(/^go\/vgo\//i, '')}` : '';

  const lines = [
    `Adjustment Justification: ${form.justification}`,
    `Adjustment Type: ${form.adjustmentType}`,
    '',
    'Problem Statement:',
    form.problemStatement.trim(),
    '',
    '[Amount Validation]',
    `Affected dates: ${dates}`,
    `Impacted Amount: ${formatMoney(impacted, cur)}`,
    ...(isRunaway ? [`Last 90 days usage amount: ${formatMoney(parseAmount(form.usage90Days), cur)}`] : []),
    `Suggested Adjustment: ${pct}`,
    `Total Adjustment Amount: ${formatMoney(total, cur)}${capped ? ' (capped at Runaway Spend maximum)' : ''}`,
    `Customer Segment: ${segmentText(form)}`,
    ...(isRunaway ? [`Budget Alerts: ${budgetLine}`] : []),
    `Anomaly Detection: ${anomalyLine}`,
    `Screenshot links: ${shots.join(', ')}`,
    '',
    'Validation Pre Checks:',
    `- Has the issue been resolved? ${resolved}`,
    `- Have any similar bmod requests been made/issued on this account in the past? ${previous}`,
    `- If DDoS attack, has TSE, PnE or TSR confirmed? ${ddos}`,
    `- If this is for a refund for an overpayment, have you confirmed that the customer doesn't want to leave it on the account to cover future usage? ${yn(form.overpaymentRefund)}`,
    `- Is the customer a reseller? ${yn(form.reseller)}`,
    '',
    'Adjustment Details:',
    `Adjustment Amount: ${formatMoney(total, cur)}`,
    `Product Code (formerly Tax Category): ${productCode}`,
    `Cloud Billing Account ID: ${form.billingAccountId.trim()}`,
    `(Invoice level-Memo adjustments only) Invoice ID: ${orNA(form.invoiceId)}`,
    `(Technical Bug adjustments only) Related Bug: ${orNA(form.relatedBug)}`,
    `Requester Name & Role: ${requester}`,
    '',
    `Support Case: ${supportCase}`,
  ];

  return { subject: buildSubject(form.restrictedCountry, total), text: lines.join('\n'), warnings, missing, percent, total, capped, eligibility };
};
