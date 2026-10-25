import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { ExclamationTriangleIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { maskSPII } from '../../utils/spiiDetector';

/**
 * Read-only view of a tracked case's notes (`comments`).
 *
 * SPII guideline: notes must not contain SPII. Anything the detector flags is
 * masked by default and called out so the owner can edit it out; the owner can
 * reveal it temporarily to find it. Callers only ever pass the signed-in
 * user's own cases, so this never widens who can read a note.
 */
const CaseNotes = ({ notes, className }) => {
    const [revealed, setRevealed] = useState(false);
    const text = typeof notes === 'string' ? notes.trim() : '';
    const { text: masked, detections } = useMemo(() => maskSPII(text), [text]);

    if (!text) {
        return (
            <div className={clsx('rounded-xl p-3 border border-dashed border-gray-200 dark:border-white/10', className)}>
                <p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Important Notes</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 italic">No notes for this case. Use edit to add one.</p>
            </div>
        );
    }

    const hasSpii = detections.length > 0;

    return (
        <div className={clsx('rounded-xl p-3 border bg-indigo-500/[0.03] dark:bg-indigo-500/[0.05] border-indigo-500/10', className)}>
            <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Important Notes</p>
                {hasSpii && (
                    <button
                        type="button"
                        onClick={() => setRevealed((r) => !r)}
                        className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        title={revealed ? 'Mask sensitive text' : 'Reveal sensitive text'}
                    >
                        {revealed ? <EyeSlashIcon className="w-3.5 h-3.5" /> : <EyeIcon className="w-3.5 h-3.5" />}
                        {revealed ? 'Mask' : 'Reveal'}
                    </button>
                )}
            </div>
            {hasSpii && (
                <p className="flex items-start gap-1.5 mb-2 text-[10px] font-bold text-red-500">
                    <ExclamationTriangleIcon className="w-3.5 h-3.5 shrink-0 mt-px" />
                    Possible SPII ({[...new Set(detections.map((d) => d.type.toLowerCase()))].join(', ')}) — notes must not contain SPII. Edit the case to remove it.
                </p>
            )}
            <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
                {revealed ? text : masked}
            </p>
        </div>
    );
};

export default CaseNotes;
