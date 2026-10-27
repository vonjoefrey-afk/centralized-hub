import {
  emptyForm, buildConsult, buildSubject, runawayEligibility, budgetAlertStatus, anomalyStatus,
  computeAdjustment, parseAmount, formatMoney, isDriveLink, SUBJECT_BASE,
} from './bmodConsult';

// The sample case: individual developer, $4,200 runaway, first incident, valid budget alert.
const sample = (over = {}) => ({
  ...emptyForm(),
  restrictedCountry: 'N',
  policy: 'Runaway',
  justification: 'Goodwill',
  adjustmentType: 'Credit',
  problemStatement: 'Customer deployed a Cloud Functions script with an unconstrained recursive loop.',
  affectedFrom: '2026-10-10',
  affectedTo: '2026-10-14',
  impactedAmount: '4,200.00',
  usage90Days: '400',
  segment: 'not-in-kerrigan',
  budgetAlert: 'Y',
  budgetAmount: '100',
  anomalyDetection: 'N',
  marketplaceSkus: 'N',
  screenshotLinks: ['https://drive.google.com/file/d/abc'],
  resolved: 'Y',
  resolvedExplanation: 'the misconfigured Cloud Function was deleted.',
  previousBmod: 'N',
  reseller: 'N',
  billingAccountId: '01A2B3-4C5D6E-7F8G9H',
  requesterEmail: 'owner@example.com',
  requesterRole: 'Billing Admin',
  supportCase: '50123456',
  ...over,
});

describe('parsing & formatting', () => {
  it('parses money strings', () => {
    expect(parseAmount('$4,200.50')).toBe(4200.5);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
  it('formats USD and other currencies', () => {
    expect(formatMoney(4200, 'USD')).toBe('$4,200.00 USD');
    expect(formatMoney(10, 'EUR')).toBe('10.00 EUR');
  });
  it('accepts only Google Drive / Docs links', () => {
    expect(isDriveLink('https://drive.google.com/file/d/x')).toBe(true);
    expect(isDriveLink('https://docs.google.com/document/d/x')).toBe(true);
    expect(isDriveLink('go/snipit/abc')).toBe(false);
    expect(isDriveLink('https://example.com/x')).toBe(false);
  });
});

describe('safeguards', () => {
  it('budget alert is valid at ≤ 25% of last 90 days usage, Y-invalid above', () => {
    expect(budgetAlertStatus({ budgetAlert: 'Y', budgetAmount: '100', usage90Days: '400' })).toMatchObject({ label: 'Y', valid: true });
    expect(budgetAlertStatus({ budgetAlert: 'Y', budgetAmount: '100.01', usage90Days: '400' })).toMatchObject({ label: 'Y-invalid', valid: false });
    expect(budgetAlertStatus({ budgetAlert: 'N' })).toMatchObject({ label: 'N', valid: false });
  });
  it('anomaly detection is Y-invalid only when a threshold over 100% of usage is given', () => {
    expect(anomalyStatus({ anomalyDetection: 'Y', anomalyThreshold: '', usage90Days: '400' })).toMatchObject({ label: 'Y', valid: true });
    expect(anomalyStatus({ anomalyDetection: 'Y', anomalyThreshold: '500', usage90Days: '400' })).toMatchObject({ label: 'Y-invalid', valid: false });
  });
});

describe('Runaway eligibility matrix', () => {
  const pct = (over) => runawayEligibility(sample(over)).percent;
  it('individual: 100% with a safeguard, 75% without', () => {
    expect(pct({})).toBe(100);
    expect(pct({ budgetAlert: 'N' })).toBe(75);
    expect(pct({ budgetAmount: '200' })).toBe(75); // budget invalid, anomaly N
    expect(pct({ budgetAlert: 'N', anomalyDetection: 'Y' })).toBe(100);
  });
  it('SMB / unowned startup: 75% with a safeguard, 50% without', () => {
    expect(pct({ segment: 'smb' })).toBe(75);
    expect(pct({ segment: 'startup-unowned', budgetAlert: 'N' })).toBe(50);
  });
  it('ineligible segments, resellers, Marketplace SKUs and repeat incidents get 0%', () => {
    ['enterprise', 'corporate', 'select', 'startup-owned'].forEach((segment) => expect(pct({ segment })).toBe(0));
    expect(pct({ reseller: 'Y' })).toBe(0);
    expect(pct({ marketplaceSkus: 'Y' })).toBe(0);
    expect(pct({ previousBmod: 'Y' })).toBe(0);
  });
  it('repeat incident exception: 50% for an individual when a bug confirmed the missed alert', () => {
    expect(pct({ previousBmod: 'Y', missedAlertBug: 'Y' })).toBe(50);
    expect(pct({ previousBmod: 'Y', missedAlertBug: 'Y', segment: 'smb' })).toBe(0);
  });
  it('segment OTHER uses the manually chosen percentage', () => {
    const r = runawayEligibility(sample({ segment: 'other', eligibility: '15' }));
    expect(r).toMatchObject({ percent: 15, manual: true });
  });
  it('caps the Runaway total at $1,000,000', () => {
    expect(computeAdjustment(sample({ impactedAmount: '2000000' }))).toMatchObject({ total: 1000000, capped: true });
  });
});

describe('USD-based limits for non-USD currencies', () => {
  it('does not cap ¥2,000,000 (≈ $13,333) — the $1M cap is checked in USD', () => {
    const r = computeAdjustment(sample({ currency: 'JPY', usdRate: '150', impactedAmount: '2000000' }));
    expect(r).toMatchObject({ total: 2000000, capped: false });
    expect(r.totalUsd).toBeCloseTo(13333.33, 2);
  });
  it('caps €1,500,000 only when its USD value exceeds $1M', () => {
    // 1 USD = 1.6 EUR → €1.5M ≈ $937,500: under the cap
    expect(computeAdjustment(sample({ currency: 'EUR', usdRate: '1.6', impactedAmount: '1500000' }))).toMatchObject({ total: 1500000, capped: false });
    // 1 USD = 0.92 EUR → €1.5M ≈ $1.63M: capped at $1M = €920,000
    expect(computeAdjustment(sample({ currency: 'EUR', usdRate: '0.92', impactedAmount: '1500000' }))).toMatchObject({ total: 920000, capped: true });
  });
  it('caps ¥200,000,000 (≈ $1.33M) at the yen equivalent of $1M', () => {
    expect(computeAdjustment(sample({ currency: 'JPY', usdRate: '150', impactedAmount: '200000000' }))).toMatchObject({ total: 150000000, capped: true });
  });
  it('without an exchange rate, does not cap and asks for the rate', () => {
    const form = sample({ currency: 'JPY', usdRate: '', impactedAmount: '200000000' });
    expect(computeAdjustment(form)).toMatchObject({ total: 200000000, capped: false, totalUsd: null });
    const { missing, warnings } = buildConsult(form);
    expect(missing).toContain('Exchange rate (1 USD = ? JPY)');
    expect(warnings.some((w) => w.text.includes('Enter the exchange rate'))).toBe(true);
  });
  it('applies the $5k #RCAdj limit in USD', () => {
    // ¥600,000 at 150 = $4,000 → tag stays
    expect(buildConsult(sample({ restrictedCountry: 'Y', currency: 'JPY', usdRate: '150', impactedAmount: '600000' })).subject).toBe(`${SUBJECT_BASE} #RCAdj`);
    // ¥900,000 at 150 = $6,000 → no tag
    expect(buildConsult(sample({ restrictedCountry: 'Y', currency: 'JPY', usdRate: '150', impactedAmount: '900000' })).subject).toBe(SUBJECT_BASE);
  });
  it('shows the USD equivalent in the consult for non-USD totals', () => {
    const { text } = buildConsult(sample({ currency: 'JPY', usdRate: '150', impactedAmount: '2000000' }));
    expect(text).toContain('Total Adjustment Amount: 2,000,000.00 JPY (≈ $13,333.33 USD at 1 USD = 150 JPY)');
  });
  it('USD needs no rate', () => {
    expect(buildConsult(sample()).missing).toEqual([]);
  });
});

describe('TPA / Other', () => {
  it('uses the chosen eligibility × impacted amount, uncapped', () => {
    const form = sample({ policy: 'TPA', eligibility: '90', impactedAmount: '2000000' });
    expect(computeAdjustment(form)).toMatchObject({ percent: 90, total: 1800000, capped: false });
    expect(computeAdjustment(sample({ policy: 'Other', eligibility: 'custom', customEligibility: '33' })).total).toBe(1386);
  });
  it('omits the Runaway-only lines', () => {
    const { text } = buildConsult(sample({ policy: 'TPA', eligibility: '50' }));
    expect(text).not.toContain('Budget Alerts:');
    expect(text).not.toContain('Last 90 days usage amount:');
    expect(text).toContain('Suggested Adjustment: 50%');
    expect(text).toContain('Total Adjustment Amount: $2,100.00 USD');
  });
});

describe('subject line (#RCAdj)', () => {
  it('appends #RCAdj for restricted countries at or under $5k only', () => {
    expect(buildSubject('Y', 4200)).toBe(`${SUBJECT_BASE} #RCAdj`);
    expect(buildSubject('Y', 5000)).toBe(`${SUBJECT_BASE} #RCAdj`);
    expect(buildSubject('Y', 5000.01)).toBe(SUBJECT_BASE);
    expect(buildSubject('N', 100)).toBe(SUBJECT_BASE);
  });
});

describe('buildConsult', () => {
  it('produces the sample consult with nothing missing', () => {
    const { text, missing, warnings, subject } = buildConsult(sample());
    expect(missing).toEqual([]);
    expect(warnings).toEqual([]);
    expect(subject).toBe(SUBJECT_BASE);
    [
      'Adjustment Justification: Goodwill',
      'Adjustment Type: Credit',
      'Affected dates: 2026-10-10 to 2026-10-14',
      'Impacted Amount: $4,200.00 USD',
      'Suggested Adjustment: 100%',
      'Total Adjustment Amount: $4,200.00 USD',
      'Customer Segment: Student / Individual Developer (Not in Kerrigan)',
      'Budget Alerts: Y (Valid',
      'Anomaly Detection: N',
      '- Has the issue been resolved? Yes, the misconfigured Cloud Function was deleted.',
      '- Have any similar bmod requests been made/issued on this account in the past? No',
      '- If DDoS attack, has TSE, PnE or TSR confirmed? N/A',
      '- Is the customer a reseller? No',
      'Adjustment Amount: $4,200.00 USD',
      'Product Code (formerly Tax Category): 12007',
      'Cloud Billing Account ID: 01A2B3-4C5D6E-7F8G9H',
      '(Invoice level-Memo adjustments only) Invoice ID: N/A',
      '(Technical Bug adjustments only) Related Bug: N/A',
      'Requester Name & Role: owner@example.com, Billing Admin',
      'Support Case: go/vgo/50123456',
    ].forEach((line) => expect(text).toContain(line));
  });

  it('marks an invalid budget alert as Y-invalid and drops to 75%', () => {
    const { text, warnings } = buildConsult(sample({ budgetAmount: '150' }));
    expect(text).toContain('Budget Alerts: Y-invalid');
    expect(text).toContain('Suggested Adjustment: 75%');
    expect(warnings.some((w) => w.text.includes('Budget alert is invalid'))).toBe(true);
  });

  it('warns not to proceed when the issue is unresolved', () => {
    const { warnings } = buildConsult(sample({ resolved: 'N', resolvedExplanation: '' }));
    expect(warnings[0]).toMatchObject({ level: 'error' });
    expect(warnings[0].text).toMatch(/Do not proceed/);
  });

  it('lists previous BMod reason, amount and links', () => {
    const { text } = buildConsult(sample({
      policy: 'TPA', eligibility: '50', previousBmod: 'Y', previousBmodReason: 'Runaway in June',
      previousBmodAmount: '300', previousBmodLinks: ['https://drive.google.com/a', 'https://drive.google.com/b'],
    }));
    expect(text).toContain('past? Yes — Reason: Runaway in June, Amount: $300.00 USD — Past BMod: https://drive.google.com/a, https://drive.google.com/b');
  });

  it('flags non-Drive screenshot links and reports missing required fields', () => {
    const { warnings } = buildConsult(sample({ screenshotLinks: ['go/snipit/x'] }));
    expect(warnings.some((w) => w.text.includes('Google Drive'))).toBe(true);
    expect(buildConsult(emptyForm()).missing).toContain('Policy');
  });

  it('uses the custom product code and keeps a pasted go/vgo/ case link intact', () => {
    const { text } = buildConsult(sample({ productCode: 'Other', productCodeOther: '12345', supportCase: 'go/vgo/777' }));
    expect(text).toContain('Product Code (formerly Tax Category): 12345');
    expect(text).toContain('Support Case: go/vgo/777');
  });
});
