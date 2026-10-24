import React, { useState } from 'react';
import { logger } from '../../utils/logger';

import { ChartBarIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { PremiumSelect } from '../ui';
import { showSuccess, showError } from '../../utils/toast';

const RunawayCalculatorTab = () => {
  const [runawayForm, setRunawayForm] = useState({
    budgetAlertSetup: '',
    usageLast90Days: '',
    requestedAmount: '',
    remainingBalance: '',
    currency: 'USD'
  });
  const [runawayResults, setRunawayResults] = useState(null);

  const handleRunawayInputChange = (field, value) => {
    const updatedForm = {
      ...runawayForm,
      [field]: value
    };
    setRunawayForm(updatedForm);

    if (field === 'usageLast90Days' || field === 'budgetAlertSetup' || field === 'requestedAmount' || field === 'remainingBalance') {
      calculateRunaway(updatedForm);
    }
  };

  const calculateRunaway = (form = runawayForm) => {
    const {
      usageLast90Days,
      budgetAlertSetup,
      requestedAmount,
      remainingBalance,
      currency
    } = form;

    const rawBudgetAlert = parseFloat(budgetAlertSetup);
    const budgetAlert = !Number.isNaN(rawBudgetAlert) && rawBudgetAlert > 0 ? rawBudgetAlert : 0;
    const requested = parseFloat(requestedAmount) || 0;
    const remaining = parseFloat(remainingBalance) || 0;

    const usageInput = parseFloat(usageLast90Days);
    const usageBasis = (!Number.isNaN(usageInput) && usageInput > 0)
      ? usageInput
      : requested;

    if (usageBasis === 0 || Number.isNaN(usageBasis)) {
      setRunawayResults(null);
      return;
    }

    const averageDailyUsage = usageBasis / 90;
    const averageUsage = averageDailyUsage * 0.25;

    const runaway1 = 0.50 * requested;
    const runaway2 = 0.75 * requested;

    const hasBudgetAlert = budgetAlert > 0;
    const budgetExceedsAverage = hasBudgetAlert && budgetAlert > averageUsage;

    let condition = 'BAS_Null';
    let eligibleFor = '50%';
    let amountEligible = runaway1;

    if (hasBudgetAlert) {
      if (budgetExceedsAverage) {
        condition = 'runaway1';
        eligibleFor = '50%';
        amountEligible = runaway1;
      } else {
        condition = 'runaway2';
        eligibleFor = '75%';
        amountEligible = runaway2;
      }
    }

    const eligibleAmountForRefund = Math.max(0, amountEligible - remaining);

    setRunawayResults({
      averageUsage,
      budgetAlertSetup: budgetAlert,
      eligibleFor,
      amountEligible,
      remainingBalance: remaining,
      eligibleAmountForRefund,
      condition,
      runaway1,
      runaway2,
      currency
    });
  };

  const getCurrencySymbol = (currency) => {
    const symbols = {
      'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥', 'CAD': 'C$',
      'AUD': 'A$', 'CHF': 'CHF', 'CNY': '¥', 'SEK': 'kr', 'NOK': 'kr',
      'DKK': 'kr', 'PLN': 'zł', 'CZK': 'Kč', 'HUF': 'Ft', 'RUB': '₽',
      'BRL': 'R$', 'MXN': '$', 'ARS': '$', 'CLP': '$', 'COP': '$',
      'PEN': 'S/', 'UYU': '$U', 'INR': '₹', 'PKR': '₨', 'BDT': '৳',
      'LKR': '₨', 'NPR': '₨', 'KRW': '₩', 'THB': '฿', 'VND': '₫',
      'IDR': 'Rp', 'MYR': 'RM', 'SGD': 'S$', 'PHP': '₱', 'TWD': 'NT$',
      'HKD': 'HK$', 'NZD': 'NZ$', 'ZAR': 'R', 'EGP': 'E£', 'MAD': 'د.م.',
      'TND': 'د.ت', 'DZD': 'د.ج', 'NGN': '₦', 'GHS': 'GH₵', 'KES': 'KSh',
      'UGX': 'USh', 'TZS': 'TSh', 'ETB': 'Br', 'TRY': '₺', 'ILS': '₪',
      'AED': 'د.إ', 'SAR': 'ر.س', 'QAR': 'ر.ق', 'KWD': 'د.ك', 'BHD': 'ب.د',
      'OMR': 'ر.ع.', 'JOD': 'د.ا', 'LBP': 'ل.ل', 'UAH': '₴', 'BYN': 'Br',
      'KZT': '₸', 'UZS': 'лв', 'KGS': 'лв', 'TJS': 'SM', 'TMT': 'T',
      'AFN': '؋', 'IRR': '﷼', 'IQD': 'ع.د', 'SYP': 'ل.س', 'YER': '﷼'
    };
    return symbols[currency] || '$';
  };

  const copyResultsToClipboard = async () => {
    if (!runawayResults) return;

    const currencySymbol = getCurrencySymbol(runawayResults.currency);
    const budgetAlertText = runawayResults.budgetAlertSetup === 0 ? 'Not Set' : `${currencySymbol}${runawayResults.budgetAlertSetup.toFixed(2)}`;

    const resultsText = `Runaway Calculation Results:
Average Usage: ${currencySymbol}${runawayResults.averageUsage.toFixed(2)}
Budget and Alert Setup: ${budgetAlertText}
Eligible for: ${runawayResults.eligibleFor}
Eligible Amount for Credit: ${currencySymbol}${runawayResults.amountEligible.toFixed(2)}
Remaining/Outstanding Balance: ${currencySymbol}${runawayResults.remainingBalance.toFixed(2)}
Eligible Amount for Refund: ${currencySymbol}${runawayResults.eligibleAmountForRefund.toFixed(2)}`;

    try {
      await navigator.clipboard.writeText(resultsText);
      showSuccess('Runaway calculation copied successfully');
    } catch (err) {
      logger.error('Failed to copy to clipboard:', err);
      showError('Failed to copy to clipboard. Please try again.');
    }
  };

  return (
    <div className="relative group min-h-full">
      {/* Runaway Calculations Section */}
      <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-[2.5rem] blur-xl opacity-20 group-hover:opacity-30 transition duration-1000"></div>
                      <div className="relative bg-white/50 dark:bg-[#111111] p-8 rounded-[2.5rem] border border-gray-200/50 dark:border-white/5 shadow-2xl backdrop-blur-sm h-full flex flex-col">
                        <div className="flex items-center gap-3 mb-8">
                          <div className="p-2 bg-indigo-500/10 rounded-xl">
                            <ChartBarIcon className="w-5 h-5 text-indigo-500" />
                          </div>
                          <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.25em]">Runaway Calculation</h3>
                        </div>
                        
                        <div className="space-y-8 flex-grow">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="w-full">
                              <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-3 ml-1">Calculation Currency</label>
                                <PremiumSelect
                                  value={runawayForm.currency}
                                  onChange={(val) => handleRunawayInputChange('currency', val)}
                                  options={[
                                    { value: "USD", label: "USD ($)" },
                                    { value: "EUR", label: "EUR (€)" },
                                    { value: "GBP", label: "GBP (£)" },
                                    { value: "JPY", label: "JPY (¥)" },
                                    { value: "CAD", label: "CAD (C$)" },
                                    { value: "AUD", label: "AUD (A$)" },
                                    { value: "CHF", label: "CHF (CHF)" },
                                    { value: "CNY", label: "CNY (¥)" },
                                    { value: "SEK", label: "SEK (kr)" },
                                    { value: "NOK", label: "NOK (kr)" },
                                    { value: "DKK", label: "DKK (kr)" },
                                    { value: "PLN", label: "PLN (zł)" },
                                    { value: "CZK", label: "CZK (Kč)" },
                                    { value: "HUF", label: "HUF (Ft)" },
                                    { value: "RUB", label: "RUB (₽)" },
                                    { value: "BRL", label: "BRL (R$)" },
                                    { value: "MXN", label: "MXN ($)" },
                                    { value: "ARS", label: "ARS ($)" },
                                    { value: "CLP", label: "CLP ($)" },
                                    { value: "COP", label: "COP ($)" },
                                    { value: "PEN", label: "PEN (S/)" },
                                    { value: "UYU", label: "UYU ($U)" },
                                    { value: "INR", label: "INR (₹)" },
                                    { value: "PKR", label: "PKR (₨)" },
                                    { value: "BDT", label: "BDT (৳)" },
                                    { value: "LKR", label: "LKR (₨)" },
                                    { value: "NPR", label: "NPR (₨)" },
                                    { value: "KRW", label: "KRW (₩)" },
                                    { value: "THB", label: "THB (฿)" },
                                    { value: "VND", label: "VND (₫)" },
                                    { value: "IDR", label: "IDR (Rp)" },
                                    { value: "MYR", label: "MYR (RM)" },
                                    { value: "SGD", label: "SGD (S$)" },
                                    { value: "PHP", label: "PHP (₱)" },
                                    { value: "TWD", label: "TWD (NT$)" },
                                    { value: "HKD", label: "HKD (HK$)" },
                                    { value: "NZD", label: "NZD (NZ$)" },
                                    { value: "ZAR", label: "ZAR (R)" },
                                    { value: "EGP", label: "EGP (E£)" },
                                    { value: "MAD", label: "MAD (د.م.)" },
                                    { value: "TND", label: "TND (د.ت)" },
                                    { value: "DZD", label: "DZD (د.ج)" },
                                    { value: "NGN", label: "NGN (₦)" },
                                    { value: "GHS", label: "GHS (GH₵)" },
                                    { value: "KES", label: "KES (KSh)" },
                                    { value: "UGX", label: "UGX (USh)" },
                                    { value: "TZS", label: "TZS (TSh)" },
                                    { value: "ETB", label: "ETB (Br)" },
                                    { value: "TRY", label: "TRY (₺)" },
                                    { value: "ILS", label: "ILS (₪)" },
                                    { value: "AED", label: "AED (د.إ)" },
                                    { value: "SAR", label: "SAR (ر.س)" },
                                    { value: "QAR", label: "QAR (ر.ق)" },
                                    { value: "KWD", label: "KWD (د.ك)" },
                                    { value: "BHD", label: "BHD (ب.د)" },
                                    { value: "OMR", label: "OMR (ر.ع.)" },
                                    { value: "JOD", label: "JOD (د.ا)" },
                                    { value: "LBP", label: "LBP (ل.ل)" },
                                    { value: "UAH", label: "UAH (₴)" },
                                    { value: "BYN", label: "BYN (Br)" },
                                    { value: "KZT", label: "KZT (₸)" },
                                    { value: "UZS", label: "UZS (лв)" },
                                    { value: "KGS", label: "KGS (лв)" },
                                    { value: "TJS", label: "TJS (SM)" },
                                    { value: "TMT", label: "TMT (T)" },
                                    { value: "AFN", label: "AFN (؋)" },
                                    { value: "IRR", label: "IRR (﷼)" },
                                    { value: "IQD", label: "IQD (ع.د)" },
                                    { value: "SYP", label: "SYP (ل.س)" },
                                    { value: "YER", label: "YER (﷼)" }
                                  ]}
                                  size="md"
                                />
                              </div>

                            <div>
                              <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-3 ml-1">Impacted Amount</label>
                              <input
                                type="number"
                                value={runawayForm.requestedAmount}
                                onChange={(e) => handleRunawayInputChange('requestedAmount', e.target.value)}
                                className="w-full px-5 py-4 bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-gray-900 dark:text-white placeholder-gray-400/60"
                                placeholder="0.00"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-3 ml-1">Usage for the Last 90 Days</label>
                            <input
                              type="number"
                              value={runawayForm.usageLast90Days}
                              onChange={(e) => handleRunawayInputChange('usageLast90Days', e.target.value)}
                              className="w-full px-5 py-4 bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-gray-900 dark:text-white placeholder-gray-400/60"
                              placeholder="0.00"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-3 ml-1">Budget Alert</label>
                            <input
                              type="number"
                              value={runawayForm.budgetAlertSetup}
                              onChange={(e) => handleRunawayInputChange('budgetAlertSetup', e.target.value)}
                              className="w-full px-5 py-4 bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-gray-900 dark:text-white placeholder-gray-400/60"
                              placeholder="0.00"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-3 ml-1">Outstanding Balance</label>
                            <input
                              type="number"
                              value={runawayForm.remainingBalance}
                              onChange={(e) => handleRunawayInputChange('remainingBalance', e.target.value)}
                              className="w-full px-5 py-4 bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-gray-900 dark:text-white placeholder-gray-400/60"
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        {/* Results */}
                        {runawayResults && (
                          <div className="mt-10 bg-indigo-500/5 dark:bg-white/[0.02] rounded-3xl p-8 border border-indigo-500/10 dark:border-white/5 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                            
                            <div className="flex justify-between items-center mb-6 relative z-10">
                              <h4 className="text-sm font-black text-gray-900 dark:text-indigo-400 uppercase tracking-[0.2em]">Validated Amount</h4>
                              <button
                                onClick={copyResultsToClipboard}
                                className="flex items-center px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 shadow-lg shadow-indigo-500/20 active:scale-95"
                              >
                                <ClipboardDocumentIcon className="w-4 h-4 mr-2" />
                                Extract Data
                              </button>
                            </div>
                              <div className="flex justify-between items-center py-4 border-b border-indigo-500/10 dark:border-white/5">
                                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Average Usage Pulse</span>
                                <span className="text-sm font-black text-gray-900 dark:text-white font-mono">{getCurrencySymbol(runawayResults.currency)}{runawayResults.averageUsage.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between items-center py-4 border-b border-indigo-500/10 dark:border-white/5">
                                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Budget and Alert Status</span>
                                <span className="text-sm font-black text-gray-900 dark:text-white font-mono">
                                  {runawayResults.budgetAlertSetup === 0 ? 'NOT CONFIGURED' : `${getCurrencySymbol(runawayResults.currency)}${runawayResults.budgetAlertSetup.toFixed(2)}`}
                                </span>
                              </div>
                              <div className="flex justify-between items-center py-4">
                                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Eligibility</span>
                                <span className="text-sm font-black text-indigo-500 uppercase tracking-tighter">{runawayResults.eligibleFor}</span>
                              </div>
                              
                              <div className="my-6 p-6 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-2xl shadow-xl shadow-indigo-500/20">
                                <div className="flex justify-between items-center border-b border-white/20 pb-4 mb-4">
                                  <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">Authorized Refund Credit</span>
                                  <span className="text-2xl font-black text-white font-mono">{getCurrencySymbol(runawayResults.currency)}{runawayResults.amountEligible.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">Net Liability Remaining</span>
                                  <span className="text-lg font-bold text-white/90 font-mono">{getCurrencySymbol(runawayResults.currency)}{runawayResults.remainingBalance.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
  );
};

export default RunawayCalculatorTab;
