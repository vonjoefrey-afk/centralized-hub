import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

/**
 * Pagination — reusable, controlled table footer.
 *
 * The parent owns the current page (1-based) and slices its own data; this
 * component only renders the "Showing X–Y of N" summary and the prev/next
 * controls. It renders nothing when everything fits on a single page.
 *
 * @param {number}   page         - current page, 1-based
 * @param {number}   pageSize     - rows per page
 * @param {number}   total        - total row count (unpaginated)
 * @param {Function} onPageChange - (nextPage) => void
 */
const Pagination = ({ page, pageSize, total, onPageChange, className = '' }) => {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const current = Math.min(Math.max(1, page), pageCount);
  const from = (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  const btn =
    'w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 ' +
    'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors ' +
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent';

  return (
    <div className={`flex items-center justify-between gap-4 px-6 py-4 border-t border-gray-200/60 dark:border-white/5 ${className}`}>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        Showing{' '}
        <span className="font-bold text-gray-900 dark:text-gray-200 tabular-nums">{from}–{to}</span>{' '}
        of <span className="font-bold text-gray-900 dark:text-gray-200 tabular-nums">{total}</span>
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(current - 1)}
          disabled={current <= 1}
          aria-label="Previous page"
          className={btn}
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        <span className="text-xs font-bold text-gray-600 dark:text-gray-300 tabular-nums min-w-[70px] text-center">
          Page {current} / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(current + 1)}
          disabled={current >= pageCount}
          aria-label="Next page"
          className={btn}
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
