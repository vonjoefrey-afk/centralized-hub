import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  ClipboardDocumentIcon, ClipboardDocumentCheckIcon, PlusIcon, XMarkIcon, ExclamationTriangleIcon,
  InformationCircleIcon, ArrowPathIcon, DocumentTextIcon, CalculatorIcon, ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { PremiumSelect } from '../ui';
import { showSuccess, showError } from '../../utils/toast';
import { logger } from '../../utils/logger';
import { detectSPII } from '../../utils/spiiDetector';
import CalculatorTab from './CalculatorTab';
import { CURRENCY_OPTIONS } from '../../constants/currencies';
import {
  POLICIES, JUSTIFICATIONS, ADJUSTMENT_TYPES, ELIGIBILITY_PRESETS, REQUESTER_ROLES, SEGMENTS,
  PRODUCT_CODE_DEFAULT, emptyForm, buildConsult, budgetAlertStatus, anomalyStatus, formatMoney,
  isDriveLink, segmentFor,
} from '../../utils/bmodConsult';


const inputCls = 'w-full px-4 py-2.5 bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-semibold text-gray-900 dark:text-white placeholder-gray-400/70 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all';

const Section = ({ title, children, className }) => (
  <section className={clsx('bg-white/70 dark:bg-[#111111] rounded-3xl border border-gray-200/60 dark:border-white/5 p-5 sm:p-6 space-y-5', className)}>
    {title && <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">{title}</h3>}
    {children}
  </section>
);

const Field = ({ label, hint, required, children, className }) => (
  <div className={className}>
    <div className="flex items-baseline justify-between gap-2 mb-2 ml-1">
      <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em]">
        {label}{required && <span className="text-rose-500"> *</span>}
      </span>
      {hint && <span className="text-[10px] text-gray-400">{hint}</span>}
    </div>
    {children}
  </div>
);

/** Select-one button group (keyboard-accessible radio group). */
const Choice = ({ label, value, options, onChange, required, hint, className }) => (
  <Field label={label} required={required} hint={hint} className={className}>
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const o = typeof opt === 'string' ? { value: opt, label: opt } : opt;
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={clsx(
              'px-3.5 py-2 rounded-xl text-xs font-bold border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
              selected
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'bg-gray-50/60 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-indigo-400/60',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  </Field>
);

const YN = (props) => <Choice options={[{ value: 'Y', label: 'Yes' }, { value: 'N', label: 'No' }]} {...props} />;
const YNA = (props) => <Choice options={[{ value: 'N/A', label: 'N/A' }, { value: 'Y', label: 'Yes' }, { value: 'N', label: 'No' }]} {...props} />;

/** One-or-more link inputs with add/remove; optionally enforces Drive links. */
const LinkList = ({ label, links, onChange, placeholder, requireDrive, required, hint }) => (
  <Field label={label} required={required} hint={hint}>
    <div className="space-y-2">
      {links.map((link, i) => {
        const bad = requireDrive && link.trim() && !isDriveLink(link);
        return (
          <div key={i} className="flex items-center gap-2">
            <input
              type="url"
              value={link}
              onChange={(e) => onChange(links.map((l, j) => (j === i ? e.target.value : l)))}
              placeholder={placeholder}
              aria-label={`${label} ${i + 1}`}
              aria-invalid={bad || undefined}
              className={clsx(inputCls, bad && 'border-rose-400 focus:border-rose-500')}
            />
            {links.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(links.filter((_, j) => j !== i))}
                aria-label={`Remove ${label} ${i + 1}`}
                className="p-2 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => onChange([...links, ''])}
        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
      >
        <PlusIcon className="w-3.5 h-3.5" /> Add link
      </button>
    </div>
  </Field>
);

const MoneyInput = ({ value, onChange, label, currency }) => (
  <div className="relative">
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="0.00"
      aria-label={label}
      className={clsx(inputCls, 'pr-14 font-mono')}
    />
    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400">{currency}</span>
  </div>
);

const CopyButton = ({ text, label, disabled, primary }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showSuccess(`${label} copied`);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error('Failed to copy:', err);
      showError('Failed to copy — select the text and copy it manually.');
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
        primary ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20' : 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/15',
      )}
    >
      {copied ? <ClipboardDocumentCheckIcon className="w-4 h-4" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
      {copied ? 'Copied' : `Copy ${label}`}
    </button>
  );
};

/**
 * GCP Billing Calculation — BMod consult builder. The agent picks the
 * restricted-country flag and policy (Runaway / TPA / Other), fills the
 * amount validation, pre-checks and adjustment details, and gets a
 * copy-ready subject line + consult on the right. Runaway uses the Runaway
 * Spend eligibility matrix; TPA and Other use the agent-chosen percentage.
 * Nothing is stored — the form lives only in this browser tab.
 */
const BmodConsultTab = ({ active = true }) => {
  const [form, setForm] = useState(emptyForm);
  const [calcOpen, setCalcOpen] = useState(false);
  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));
  const setInput = (field) => (e) => set(field)(e.target.value);

  const isRunaway = form.policy === 'Runaway';
  const consult = useMemo(() => buildConsult(form), [form]);
  const budget = budgetAlertStatus(form);
  const anomaly = anomalyStatus(form);
  const manualPercent = !isRunaway || consult.eligibility?.manual;

  // Notes-style SPII guard on the free-text fields (the requester email is expected).
  const spiiHits = useMemo(() => {
    const text = [form.problemStatement, form.resolvedExplanation, form.previousBmodReason].join('\n');
    return [...new Set(detectSPII(text).map((d) => d.type.toLowerCase()))];
  }, [form.problemStatement, form.resolvedExplanation, form.previousBmodReason]);

  const reset = () => {
    if (window.confirm('Clear every field and start a new consult?')) setForm(emptyForm());
  };

  const ready = consult.missing.length === 0;
  const copyAll = `Subject: ${consult.subject}\n\n${consult.text}`;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-6 items-start">
      {/* ── Form ─────────────────────────────────────────────── */}
      <div className="space-y-6 min-w-0">
        <Section title="Request">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <YN label="Customer in a restricted country?" value={form.restrictedCountry} onChange={set('restrictedCountry')} required
              hint="adds #RCAdj if ≤ $5k" />
            <Choice label="Policy" value={form.policy} onChange={set('policy')} options={POLICIES} required
              hint={form.policy === 'Other' ? 'uses the TPA format' : undefined} />
            <Choice label="Adjustment justification" value={form.justification} onChange={set('justification')} options={JUSTIFICATIONS} required />
            <Choice label="Adjustment type" value={form.adjustmentType} onChange={set('adjustmentType')} options={ADJUSTMENT_TYPES} required />
          </div>
          <Field label="Problem statement" required hint="explain it for approvers with no context">
            <textarea
              value={form.problemStatement}
              onChange={setInput('problemStatement')}
              rows={5}
              placeholder="Provide a clear explanation of the situation which led to this request. Do not simply copy and paste the customer's request — assume the approvers have no context and educate them on all of the essential details."
              className={clsx(inputCls, 'resize-y leading-relaxed')}
            />
          </Field>
        </Section>

        {form.policy ? (
          <>
            <Section title={`$ Amount validation — ${form.policy}${form.policy === 'Other' ? ' (TPA format)' : ''}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="Affected dates" required>
                  <div className="flex items-center gap-2">
                    <input type="date" value={form.affectedFrom} onChange={setInput('affectedFrom')} aria-label="Affected from" className={inputCls} />
                    <span className="text-xs text-gray-400">to</span>
                    <input type="date" value={form.affectedTo} onChange={setInput('affectedTo')} min={form.affectedFrom || undefined} aria-label="Affected to" className={inputCls} />
                  </div>
                </Field>
                <Field label="Currency">
                  <PremiumSelect value={form.currency} onChange={set('currency')} options={CURRENCY_OPTIONS} size="md" />
                </Field>
                <Field label="Impacted amount" required>
                  <MoneyInput value={form.impactedAmount} onChange={set('impactedAmount')} label="Impacted amount" currency={form.currency} />
                </Field>
                {isRunaway && (
                  <Field label="Last 90 days usage amount" required>
                    <MoneyInput value={form.usage90Days} onChange={set('usage90Days')} label="Last 90 days usage amount" currency={form.currency} />
                  </Field>
                )}
              </div>

              <Choice
                label="Customer segment"
                value={form.segment}
                onChange={set('segment')}
                options={SEGMENTS.map((s) => ({ value: s.value, label: s.label }))}
                required
              />
              {form.segment === 'other' && (
                <Field label="Describe the segment">
                  <input value={form.segmentOther} onChange={setInput('segmentOther')} placeholder="e.g. Public sector" className={inputCls} />
                </Field>
              )}

              {isRunaway && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-3">
                    <YN label="Budget alerts" value={form.budgetAlert} onChange={set('budgetAlert')} required />
                    {form.budgetAlert === 'Y' && (
                      <Field label="Budget amount" required hint="valid if ≤ 25% of last 90 days usage">
                        <MoneyInput value={form.budgetAmount} onChange={set('budgetAmount')} label="Budget amount" currency={form.currency} />
                        {budget.valid !== null && (
                          <p className={clsx('mt-1.5 ml-1 text-[11px] font-bold', budget.valid ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500')}>
                            {budget.valid ? 'Valid' : 'Y-invalid'} — limit {formatMoney(budget.limit, form.currency)}
                          </p>
                        )}
                      </Field>
                    )}
                  </div>
                  <div className="space-y-3">
                    <YN label="Anomaly detection" value={form.anomalyDetection} onChange={set('anomalyDetection')} required />
                    {form.anomalyDetection === 'Y' && (
                      <Field label="Anomaly threshold (optional)" hint="valid if ≤ 100% of last 90 days usage">
                        <MoneyInput value={form.anomalyThreshold} onChange={set('anomalyThreshold')} label="Anomaly threshold" currency={form.currency} />
                        {anomaly.label === 'Y-invalid' && (
                          <p className="mt-1.5 ml-1 text-[11px] font-bold text-rose-500">Y-invalid — limit {formatMoney(anomaly.limit, form.currency)}</p>
                        )}
                      </Field>
                    )}
                  </div>
                  <YN label="Includes third-party Marketplace SKUs?" value={form.marketplaceSkus} onChange={set('marketplaceSkus')} required hint="ineligible under Runaway" />
                </div>
              )}
              {!isRunaway && (
                <YN label="Anomaly detection" value={form.anomalyDetection} onChange={set('anomalyDetection')} required />
              )}

              {/* Suggested adjustment */}
              {manualPercent ? (
                <div className="space-y-3">
                  <Choice
                    label="Suggested adjustment (eligibility)"
                    value={form.eligibility}
                    onChange={set('eligibility')}
                    options={[...ELIGIBILITY_PRESETS.map((p) => ({ value: String(p), label: `${p}%` })), { value: 'custom', label: 'Custom' }]}
                    required
                  />
                  {form.eligibility === 'custom' && (
                    <Field label="Custom percentage">
                      <div className="relative max-w-[180px]">
                        <input type="number" min="0" max="100" step="0.01" value={form.customEligibility} onChange={setInput('customEligibility')} aria-label="Custom percentage" className={clsx(inputCls, 'pr-8')} />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">%</span>
                      </div>
                    </Field>
                  )}
                </div>
              ) : null}

              <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 p-5 text-white shadow-xl shadow-indigo-500/20">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Suggested adjustment</p>
                    <p className="text-3xl font-black">{consult.percent !== null && consult.percent !== undefined ? `${consult.percent}%` : '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Total adjustment amount</p>
                    <p className="text-3xl font-black font-mono">{consult.total !== null ? formatMoney(consult.total, form.currency) : '—'}</p>
                  </div>
                </div>
                {isRunaway && consult.eligibility?.reason && (
                  <p className="mt-3 text-xs font-semibold text-white/85">{consult.eligibility.reason}</p>
                )}
              </div>

              <LinkList
                label="Screenshot links"
                links={form.screenshotLinks}
                onChange={set('screenshotLinks')}
                placeholder="https://drive.google.com/…"
                requireDrive
                hint="Google Drive links only"
              />
            </Section>

            <Section title="Validation pre-checks">
              <div className="space-y-3">
                <YN label="Has the issue been resolved?" value={form.resolved} onChange={set('resolved')} required />
                {form.resolved === 'N' && (
                  <div role="alert" className="flex items-start gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm font-bold text-rose-600 dark:text-rose-400">
                    <ExclamationTriangleIcon className="w-5 h-5 shrink-0" />
                    Do not proceed with the adjustment — the issue must be resolved first.
                  </div>
                )}
                {form.resolved === 'Y' && (
                  <Field label="Preventive measure taken by the customer" required>
                    <input value={form.resolvedExplanation} onChange={setInput('resolvedExplanation')} placeholder="e.g. Customer disabled billing on the project" className={inputCls} />
                  </Field>
                )}
              </div>

              <div className="space-y-3">
                <YN label="Similar BMod requests made/issued on this account before?" value={form.previousBmod} onChange={set('previousBmod')} required />
                {form.previousBmod === 'Y' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l-2 border-indigo-500/20">
                    <Field label="Reason">
                      <input value={form.previousBmodReason} onChange={setInput('previousBmodReason')} className={inputCls} />
                    </Field>
                    <Field label="Amount">
                      <MoneyInput value={form.previousBmodAmount} onChange={set('previousBmodAmount')} label="Previous BMod amount" currency={form.currency} />
                    </Field>
                    <div className="md:col-span-2">
                      <LinkList label="Past BMod link" links={form.previousBmodLinks} onChange={set('previousBmodLinks')} placeholder="https://…" required />
                    </div>
                    {isRunaway && segmentFor(form.segment)?.tier === 'individual' && (
                      <div className="md:col-span-2">
                        <YN label="Engineering bug confirmed Google failed to send an expected anomaly alert?" value={form.missedAlertBug} onChange={set('missedAlertBug')}
                          hint="allows a 50% repeat-incident exception" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-3">
                  <YNA label="If DDoS: confirmed by TSE, PnE or TSR?" value={form.ddos} onChange={set('ddos')} />
                  {form.ddos === 'Y' && (
                    <Field label="Consult link with the confirmation">
                      <input type="url" value={form.ddosLink} onChange={setInput('ddosLink')} placeholder="https://…" className={inputCls} />
                    </Field>
                  )}
                </div>
                <YNA label="Overpayment refund: customer confirmed not to keep it on the account?" value={form.overpaymentRefund} onChange={set('overpaymentRefund')} />
                <YN label="Is the customer a reseller?" value={form.reseller} onChange={set('reseller')} required />
              </div>
            </Section>

            <Section title="Adjustment details">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="Adjustment amount" hint="same as total adjustment">
                  <div className={clsx(inputCls, 'font-mono bg-gray-100/70 dark:bg-white/[0.03]')}>{consult.total !== null ? formatMoney(consult.total, form.currency) : '—'}</div>
                </Field>
                <div className="space-y-3">
                  <Choice label="Product code (formerly Tax Category)" value={form.productCode} onChange={set('productCode')} options={[PRODUCT_CODE_DEFAULT, 'Other']} required />
                  {form.productCode === 'Other' && (
                    <input value={form.productCodeOther} onChange={setInput('productCodeOther')} placeholder="Enter product code" aria-label="Other product code" className={inputCls} />
                  )}
                </div>
                <Field label="Cloud Billing Account ID" required>
                  <input value={form.billingAccountId} onChange={setInput('billingAccountId')} placeholder="XXXXXX-XXXXXX-XXXXXX" className={clsx(inputCls, 'font-mono uppercase')} />
                </Field>
                <Field label="Invoice ID" hint="invoice-level memo only; blank = N/A">
                  <input value={form.invoiceId} onChange={setInput('invoiceId')} placeholder="N/A" className={inputCls} />
                </Field>
                <Field label="Related bug" hint="technical bug only; blank = N/A">
                  <input value={form.relatedBug} onChange={setInput('relatedBug')} placeholder="b/XXXXXXXXX" className={clsx(inputCls, 'font-mono')} />
                </Field>
                <Field label="Support case" required hint="becomes go/vgo/<case>">
                  <input value={form.supportCase} onChange={setInput('supportCase')} placeholder="Case number" className={clsx(inputCls, 'font-mono')} />
                </Field>
                <Field label="Requester email" required>
                  <input type="email" value={form.requesterEmail} onChange={setInput('requesterEmail')} placeholder="customer@example.com" className={inputCls} />
                </Field>
                <Field label="Requester role" required>
                  <PremiumSelect value={form.requesterRole} onChange={set('requesterRole')} options={REQUESTER_ROLES} placeholder="Select role" size="md" />
                </Field>
              </div>
            </Section>
          </>
        ) : (
          <Section>
            <p className="text-sm text-gray-500 dark:text-gray-400">Choose a policy above to show the matching fields — Runaway uses the Runaway Spend calculation; TPA and Other use the TPA format.</p>
          </Section>
        )}
      </div>

      {/* ── Output ───────────────────────────────────────────── */}
      <div className="space-y-6 min-w-0 xl:sticky xl:top-24">
        <Section>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <DocumentTextIcon className="w-5 h-5 text-indigo-500" />
              <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">BMod consult</h3>
            </div>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-rose-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
            >
              <ArrowPathIcon className="w-3.5 h-3.5" /> Reset
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em]">Subject</span>
              <CopyButton text={consult.subject} label="subject" />
            </div>
            <p className="px-4 py-3 rounded-xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 text-sm font-mono text-gray-900 dark:text-gray-100 break-words">
              {consult.subject}
            </p>
          </div>

          {(consult.warnings.length > 0 || spiiHits.length > 0 || !ready) && (
            <ul className="space-y-2" aria-live="polite">
              {spiiHits.length > 0 && (
                <li className="flex items-start gap-2 text-xs font-bold text-rose-600 dark:text-rose-400">
                  <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />
                  Possible SPII ({spiiHits.join(', ')}) in the free-text fields — remove it before copying.
                </li>
              )}
              {consult.warnings.map((w) => (
                <li key={w.text} className={clsx('flex items-start gap-2 text-xs font-bold',
                  w.level === 'error' ? 'text-rose-600 dark:text-rose-400' : w.level === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400')}>
                  {w.level === 'info' ? <InformationCircleIcon className="w-4 h-4 shrink-0" /> : <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />}
                  {w.text}
                </li>
              ))}
              {!ready && (
                <li className="flex items-start gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  <InformationCircleIcon className="w-4 h-4 shrink-0" />
                  Still needed: {consult.missing.join(', ')}.
                </li>
              )}
            </ul>
          )}

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em]">Consult</span>
              <div className="flex gap-2">
                <CopyButton text={copyAll} label="all" />
                <CopyButton text={consult.text} label="consult" primary />
              </div>
            </div>
            <pre className="max-h-[60vh] overflow-auto px-4 py-3 rounded-xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 text-xs leading-relaxed font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
              {consult.text}
            </pre>
          </div>
        </Section>

        {/* Quick calculator — only listens to the keyboard while open */}
        <div>
          <button
            type="button"
            onClick={() => setCalcOpen((o) => !o)}
            aria-expanded={calcOpen}
            className="w-full flex items-center justify-between px-5 py-3 rounded-2xl bg-white/70 dark:bg-[#111111] border border-gray-200/60 dark:border-white/5 text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <span className="flex items-center gap-2"><CalculatorIcon className="w-4 h-4 text-indigo-500" /> Quick calculator</span>
            <ChevronDownIcon className={clsx('w-4 h-4 transition-transform', calcOpen && 'rotate-180')} />
          </button>
          {calcOpen && (
            <div className="mt-4">
              <CalculatorTab activeTab={active ? 'gcp-billing' : null} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BmodConsultTab;
