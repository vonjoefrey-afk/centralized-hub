import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';

import { CalculatorIcon, ClipboardDocumentIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';
import { showSuccess, showError } from '../../utils/toast';

const CalculatorTab = ({ activeTab }) => {
  // Calculator state
  const [calculatorDisplay, setCalculatorDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState(null);
  const [operation, setOperation] = useState(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [copiedDisplay, setCopiedDisplay] = useState(false);

  // Calculator functions
  const inputNumber = (num) => {
    if (waitingForOperand) {
      setCalculatorDisplay(String(num));
      setWaitingForOperand(false);
    } else {
      setCalculatorDisplay(calculatorDisplay === '0' ? String(num) : calculatorDisplay + num);
    }
  };

  const inputDecimal = () => {
    if (waitingForOperand) {
      setCalculatorDisplay('0.');
      setWaitingForOperand(false);
    } else if (calculatorDisplay.indexOf('.') === -1) {
      setCalculatorDisplay(calculatorDisplay + '.');
    }
  };

  const clear = () => {
    setCalculatorDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  };

  const performOperation = (nextOperation) => {
    const inputValue = parseFloat(calculatorDisplay);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operation && !waitingForOperand) {
      const currentValue = previousValue || 0;
      const newValue = calculate(currentValue, inputValue, operation);

      setCalculatorDisplay(String(newValue));
      setPreviousValue(newValue);
    }

    setWaitingForOperand(true);
    setOperation(nextOperation);
  };

  const calculate = (firstValue, secondValue, operation) => {
    switch (operation) {
      case '+':
        return firstValue + secondValue;
      case '-':
        return firstValue - secondValue;
      case '×':
        return firstValue * secondValue;
      case '÷':
        return firstValue / secondValue;
      default:
        return secondValue;
    }
  };

  const handleEquals = () => {
    const inputValue = parseFloat(calculatorDisplay);

    if (previousValue !== null && operation) {
      const newValue = calculate(previousValue, inputValue, operation);
      setCalculatorDisplay(String(newValue));
      setPreviousValue(null);
      setOperation(null);
      setWaitingForOperand(true);
    }
  };

  const toggleSign = () => {
    if (calculatorDisplay !== '0') {
      setCalculatorDisplay(calculatorDisplay.charAt(0) === '-' ? calculatorDisplay.slice(1) : '-' + calculatorDisplay);
    }
  };

  const inputPercentage = () => {
    setCalculatorDisplay(String(parseFloat(calculatorDisplay) / 100));
  };

  const inputBackspace = () => {
    if (calculatorDisplay.length > 1) {
      setCalculatorDisplay(calculatorDisplay.slice(0, -1));
    } else {
      setCalculatorDisplay('0');
    }
  };

  // Copy calculator display to clipboard
  const copyCalculatorDisplay = async () => {
    try {
      await navigator.clipboard.writeText(calculatorDisplay);
      setCopiedDisplay(true);
      showSuccess('Copied to clipboard!');
      setTimeout(() => setCopiedDisplay(false), 2000);
    } catch (err) {
      showError('Failed to copy value');
      logger.error('Failed to copy:', err);
    }
  };

  // Paste value into calculator
  const pasteToCalculator = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const cleanedText = text.trim().replace(/[^0-9.\-+eE]/g, '');
      if (cleanedText && !isNaN(cleanedText) && isFinite(cleanedText)) {
        const numValue = parseFloat(cleanedText);
        if (!isNaN(numValue)) {
          setCalculatorDisplay(String(numValue));
          setWaitingForOperand(false);
          showSuccess('Pasted value');
        } else {
          showError('Invalid number format');
        }
      } else {
        showError('Invalid number format');
      }
    } catch (err) {
      showError('Failed to paste value');
      logger.error('Failed to paste:', err);
    }
  };

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (activeTab !== 'gcp-billing') return;

      const target = event.target;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
        return;
      }

      const { key } = event;

      if (/[0-9+\-*/.=]/.test(key) || key === 'Enter' || key === 'Backspace' || key === 'Delete' || key === 'Escape') {
        event.preventDefault();
      }

      if (/[0-9]/.test(key)) {
        inputNumber(parseInt(key));
      }
      else if (key === '.') {
        inputDecimal();
      }
      else if (key === '+') {
        performOperation('+');
      }
      else if (key === '-') {
        performOperation('-');
      }
      else if (key === '*') {
        performOperation('×');
      }
      else if (key === '/') {
        performOperation('÷');
      }
      else if (key === '=' || key === 'Enter') {
        handleEquals();
      }
      else if (key === 'Backspace' || key === 'Delete') {
        inputBackspace();
      }
      else if (key === 'Escape') {
        clear();
      }
      else if ((event.ctrlKey || event.metaKey) && key === 'c') {
        event.preventDefault();
        copyCalculatorDisplay();
      }
      else if ((event.ctrlKey || event.metaKey) && key === 'v') {
        event.preventDefault();
        pasteToCalculator();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [calculatorDisplay, previousValue, operation, waitingForOperand, activeTab]);

  return (
    <div className="relative group">
      <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-[2.5rem] blur-xl opacity-20 group-hover:opacity-30 transition duration-1000"></div>
      <div className="relative bg-white/50 dark:bg-[#111111] p-8 rounded-[2.5rem] border border-gray-200/50 dark:border-white/5 shadow-2xl backdrop-blur-sm h-full">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl">
              <CalculatorIcon className="w-5 h-5 text-indigo-500" />
            </div>
            <h3 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.25em]">Calculator</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={pasteToCalculator}
              className="p-2.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-xl transition-all duration-300"
              title="Paste value"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </button>
            <button
              onClick={copyCalculatorDisplay}
              className={`p-2.5 rounded-xl transition-all duration-300 ${copiedDisplay
                ? 'text-emerald-500 bg-emerald-500/10'
                : 'text-gray-400 hover:text-indigo-500 hover:bg-indigo-500/10'
                }`}
              title="Copy value"
            >
              {copiedDisplay ? (
                <ClipboardDocumentCheckIcon className="w-5 h-5" />
              ) : (
                <ClipboardDocumentIcon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
        <div className="max-w-md mx-auto">
          {/* Display - Selectable for copying */}
          <div
            className="bg-gray-50/50 dark:bg-black/40 border-2 border-gray-100 dark:border-white/5 text-right p-6 rounded-3xl text-4xl font-mono min-h-[100px] flex items-center justify-end mb-8 shadow-inner select-all cursor-text focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-300 text-gray-900 dark:text-white"
            onClick={(e) => {
              if (window.getSelection) {
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(e.target);
                selection.removeAllRanges();
                selection.addRange(range);
              }
            }}
            role="textbox"
            aria-label="Calculator display"
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                copyCalculatorDisplay();
              }
              if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault();
                pasteToCalculator();
              }
            }}
          >
            {calculatorDisplay}
          </div>

          {/* Calculator Buttons */}
          <div className="grid grid-cols-4 gap-4">
            {/* Row 1 - Control buttons */}
            <button
              onClick={inputBackspace}
              className="bg-gray-50/50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-2xl h-16 flex items-center justify-center text-sm font-black border border-gray-200 dark:border-white/5 shadow-sm transition-all duration-300 active:scale-95"
              title="Backspace"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
              </svg>
            </button>
            <button
              onClick={clear}
              className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-2xl h-16 flex items-center justify-center text-sm font-black border border-rose-500/20 shadow-sm transition-all duration-300 active:scale-95"
              title="All Clear"
            >
              AC
            </button>
            <button
              onClick={inputPercentage}
              className="bg-gray-50/50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-2xl h-16 flex items-center justify-center text-sm font-black border border-gray-200 dark:border-white/5 shadow-sm transition-all duration-300 active:scale-95"
              title="Percentage"
            >
              %
            </button>
            <button
              onClick={() => performOperation('÷')}
              className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl h-16 flex items-center justify-center text-xl font-black shadow-lg shadow-indigo-500/20 transition-all duration-300 active:scale-95"
              title="Divide"
            >
              ÷
            </button>

            {/* Row 2 */}
            <button onClick={() => inputNumber(7)} className="bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-gray-900 dark:text-white rounded-2xl h-16 flex items-center justify-center text-lg font-black border border-gray-100 dark:border-white/5 shadow-sm transition-all duration-300 active:scale-95">7</button>
            <button onClick={() => inputNumber(8)} className="bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-gray-900 dark:text-white rounded-2xl h-16 flex items-center justify-center text-lg font-black border border-gray-100 dark:border-white/5 shadow-sm transition-all duration-300 active:scale-95">8</button>
            <button onClick={() => inputNumber(9)} className="bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-gray-900 dark:text-white rounded-2xl h-16 flex items-center justify-center text-lg font-black border border-gray-100 dark:border-white/5 shadow-sm transition-all duration-300 active:scale-95">9</button>
            <button onClick={() => performOperation('×')} className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl h-16 flex items-center justify-center text-xl font-black shadow-lg shadow-indigo-500/20 transition-all duration-300 active:scale-95" title="Multiply">×</button>

            {/* Row 3 */}
            <button onClick={() => inputNumber(4)} className="bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-gray-900 dark:text-white rounded-2xl h-16 flex items-center justify-center text-lg font-black border border-gray-100 dark:border-white/5 shadow-sm transition-all duration-300 active:scale-95">4</button>
            <button onClick={() => inputNumber(5)} className="bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-gray-900 dark:text-white rounded-2xl h-16 flex items-center justify-center text-lg font-black border border-gray-100 dark:border-white/5 shadow-sm transition-all duration-300 active:scale-95">5</button>
            <button onClick={() => inputNumber(6)} className="bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-gray-900 dark:text-white rounded-2xl h-16 flex items-center justify-center text-lg font-black border border-gray-100 dark:border-white/5 shadow-sm transition-all duration-300 active:scale-95">6</button>
            <button onClick={() => performOperation('-')} className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl h-16 flex items-center justify-center text-xl font-black shadow-lg shadow-indigo-500/20 transition-all duration-300 active:scale-95" title="Subtract">-</button>

            {/* Row 4 */}
            <button onClick={() => inputNumber(1)} className="bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-gray-900 dark:text-white rounded-2xl h-16 flex items-center justify-center text-lg font-black border border-gray-100 dark:border-white/5 shadow-sm transition-all duration-300 active:scale-95">1</button>
            <button onClick={() => inputNumber(2)} className="bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-gray-900 dark:text-white rounded-2xl h-16 flex items-center justify-center text-lg font-black border border-gray-100 dark:border-white/5 shadow-sm transition-all duration-300 active:scale-95">2</button>
            <button onClick={() => inputNumber(3)} className="bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-gray-900 dark:text-white rounded-2xl h-16 flex items-center justify-center text-lg font-black border border-gray-100 dark:border-white/5 shadow-sm transition-all duration-300 active:scale-95">3</button>
            <button onClick={() => performOperation('+')} className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl h-16 flex items-center justify-center text-xl font-black shadow-lg shadow-indigo-500/20 transition-all duration-300 active:scale-95" title="Add">+</button>

            {/* Row 5 */}
            <button onClick={toggleSign} className="bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-gray-900 dark:text-white rounded-2xl h-16 flex items-center justify-center text-lg font-black border border-gray-100 dark:border-white/5 shadow-sm transition-all duration-300 active:scale-95" title="Toggle sign">±</button>
            <button onClick={() => inputNumber(0)} className="bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-gray-900 dark:text-white rounded-2xl h-16 flex items-center justify-center text-lg font-black border border-gray-100 dark:border-white/5 shadow-sm transition-all duration-300 active:scale-95">0</button>
            <button onClick={inputDecimal} className="bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-gray-900 dark:text-white rounded-2xl h-16 flex items-center justify-center text-lg font-black border border-gray-100 dark:border-white/5 shadow-sm transition-all duration-300 active:scale-95" title="Decimal point">.</button>
            <button onClick={handleEquals} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl h-16 flex items-center justify-center text-xl font-black shadow-lg shadow-emerald-500/20 transition-all duration-300 active:scale-95" title="Equals">=</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalculatorTab;
