import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    CalendarIcon,
    XMarkIcon,
    ClockIcon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * DateTimePicker Component
 * 
 * A high-end, premium replacement for native datetime inputs.
 * Features glassmorphism, subtle animations, and an intuitive selector.
 */
const DateTimePicker = ({
    value,
    onChange,
    label,
    min,
    required = false,
    className = '',
    helperText
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
    const [selectedDate, setSelectedDate] = useState(value ? new Date(value) : null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0, direction: 'down' });
    const containerRef = useRef(null);
    const dropdownRef = useRef(null);

    // Smart positioning logic
    useLayoutEffect(() => {
        if (isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const dropdownHeight = 360; 
            const spaceBelow = windowHeight - rect.bottom;
            const spaceAbove = rect.top;

            let direction = 'down';
            let top = rect.bottom + 8;

            if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
                direction = 'up';
                top = rect.top - dropdownHeight - 8;
            }

            setDropdownPos({
                top,
                left: rect.left,
                width: Math.max(rect.width, 420),
                direction
            });
        }
    }, [isOpen]);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target) &&
                dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const daysOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const handlePrevMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    };

    const handleDateSelect = (day) => {
        const newDate = selectedDate ? new Date(selectedDate) : new Date();
        newDate.setFullYear(viewDate.getFullYear());
        newDate.setMonth(viewDate.getMonth());
        newDate.setDate(day);
        setSelectedDate(newDate);
        updateValue(newDate);
    };

    const handleTimeChange = (type, val) => {
        const newDate = selectedDate ? new Date(selectedDate) : new Date();
        if (type === 'hour') {
            const isPM = newDate.getHours() >= 12;
            let hour = parseInt(val);
            if (isPM && hour < 12) hour += 12;
            if (!isPM && hour === 12) hour = 0;
            newDate.setHours(hour);
        } else if (type === 'minute') {
            newDate.setMinutes(parseInt(val));
        } else if (type === 'ampm') {
            let hour = newDate.getHours();
            if (val === 'PM' && hour < 12) hour += 12;
            if (val === 'AM' && hour >= 12) hour -= 12;
            newDate.setHours(hour);
        }
        setSelectedDate(newDate);
        updateValue(newDate);
    };

    const updateValue = (date) => {
        onChange(date.toISOString().slice(0, 16));
    };

    const renderCalendar = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const days = [];

        const lastMonthDays = getDaysInMonth(year, month - 1);
        for (let i = firstDay - 1; i >= 0; i--) {
            days.push({ day: lastMonthDays - i, current: false });
        }

        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ day: i, current: true });
        }

        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push({ day: i, current: false });
        }

        return (
            <div className="p-5 w-[300px]">
                <div className="flex items-center justify-between mb-6">
                    <h4 className="font-bold text-gray-900 dark:text-white text-base tracking-tight">
                        {months[month]} <span className="text-gray-400 font-medium ml-1">{year}</span>
                    </h4>
                    <div className="flex gap-2">
                        <button type="button" onClick={handlePrevMonth} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-all active:scale-95 border border-transparent hover:border-gray-200 dark:hover:border-white/10">
                            <ChevronLeftIcon className="h-4 w-4 text-gray-500" />
                        </button>
                        <button type="button" onClick={handleNextMonth} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-all active:scale-95 border border-transparent hover:border-gray-200 dark:hover:border-white/10">
                            <ChevronRightIcon className="h-4 w-4 text-gray-500" />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-3">
                    {daysOfWeek.map(d => (
                        <div key={d} className="h-8 flex items-center justify-center text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                            {d}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-1 text-sm">
                    {days.map((d, i) => {
                        const isSelected = selectedDate &&
                            d.current &&
                            selectedDate.getDate() === d.day &&
                            selectedDate.getMonth() === month &&
                            selectedDate.getFullYear() === year;

                        const isToday = !isSelected &&
                            d.current &&
                            new Date().getDate() === d.day &&
                            new Date().getMonth() === month &&
                            new Date().getFullYear() === year;

                        return (
                            <button
                                key={i}
                                type="button"
                                disabled={!d.current}
                                onClick={() => handleDateSelect(d.day)}
                                className={clsx(
                                    'h-9 flex items-center justify-center rounded-xl text-xs transition-all relative font-medium active:scale-90',
                                    !d.current && 'text-gray-300 dark:text-gray-700 cursor-default opacity-40',
                                    d.current && !isSelected && 'hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-700 dark:text-gray-300',
                                    isSelected && 'bg-primary-600 text-white font-bold shadow-lg shadow-primary-500/25 z-10 scale-105',
                                    isToday && 'text-primary-600 dark:text-primary-400'
                                )}
                            >
                                {d.day}
                                {isToday && !isSelected && (
                                    <span className="absolute bottom-1.5 w-1 h-1 bg-primary-600 dark:bg-primary-400 rounded-full"></span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/5 flex gap-4 items-center">
                    <button
                        type="button"
                        onClick={() => {
                            const now = new Date();
                            setSelectedDate(now);
                            setViewDate(now);
                            updateValue(now);
                        }}
                        className="text-[10px] font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors uppercase tracking-widest bg-primary-50 dark:bg-primary-900/20 px-3 py-1.5 rounded-lg"
                    >
                        Today
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedDate(null);
                            onChange('');
                        }}
                        className="text-[10px] font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors uppercase tracking-widest px-3 py-1.5 border border-gray-100 dark:border-white/10 rounded-lg"
                    >
                        Clear
                    </button>
                </div>
            </div>
        );
    };

    const renderTimeColumn = () => {
        const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
        const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

        const currentHour = selectedDate ? (selectedDate.getHours() % 12 || 12) : 12;
        const currentMinute = selectedDate ? selectedDate.getMinutes() : 0;
        const currentAMPM = selectedDate ? (selectedDate.getHours() >= 12 ? 'PM' : 'AM') : 'AM';

        return (
            <div className="flex border-l border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-white/5">
                {/* Hours */}
                <div className="flex flex-col overflow-y-auto max-h-[360px] w-[54px] scrollbar-hide py-4 custom-scrollbar">
                    {hours.map(h => {
                        const active = parseInt(h) === currentHour;
                        return (
                            <button
                                key={h}
                                type="button"
                                onClick={() => handleTimeChange('hour', h)}
                                className={clsx(
                                    'py-3 text-[13px] font-bold transition-all shrink-0 active:scale-90',
                                    active ? 'text-primary-600 dark:text-primary-400 scale-110' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                )}
                            >
                                {h}
                            </button>
                        );
                    })}
                </div>
                {/* Minutes */}
                <div className="flex flex-col border-l border-gray-100 dark:border-white/10 overflow-y-auto max-h-[360px] w-[54px] scrollbar-hide py-4 custom-scrollbar">
                    {minutes.map(m => {
                        const active = Math.abs(parseInt(m) - currentMinute) < 2.5; 
                        return (
                            <button
                                key={m}
                                type="button"
                                onClick={() => handleTimeChange('minute', m)}
                                className={clsx(
                                    'py-3 text-[13px] font-bold transition-all shrink-0 active:scale-90',
                                    active ? 'text-primary-600 dark:text-primary-400 scale-110' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                )}
                            >
                                {m}
                            </button>
                        );
                    })}
                </div>
                {/* AM/PM */}
                <div className="flex flex-col border-l border-gray-100 dark:border-white/10 w-[54px] py-4 gap-2">
                    {['AM', 'PM'].map(p => {
                        const active = p === currentAMPM;
                        return (
                            <button
                                key={p}
                                type="button"
                                onClick={() => handleTimeChange('ampm', p)}
                                className={clsx(
                                    'py-4 text-[11px] font-black transition-all shrink-0 active:scale-90 tracking-tighter',
                                    active ? 'text-primary-600 dark:text-primary-400 scale-110' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                )}
                            >
                                {p}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className={clsx('relative w-full', className)} ref={containerRef}>
            {label && (
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 ml-0.5 tracking-tight">
                    {label} {required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
            )}
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className={clsx(
                        'w-full flex items-center justify-between px-4 py-3 border rounded-2xl shadow-sm text-left transition-all duration-300',
                        'focus:outline-none focus:ring-4 focus:ring-primary-500/10',
                        isOpen 
                            ? 'border-primary-500 bg-white dark:bg-[#0a0a0a] ring-2 ring-primary-500/10' 
                            : 'border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5 hover:border-gray-300 dark:hover:border-white/20'
                    )}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={clsx(
                            'p-2 rounded-xl transition-colors shrink-0',
                            isOpen ? 'bg-primary-50 dark:bg-primary-900/30' : 'bg-gray-100/50 dark:bg-white/5'
                        )}>
                            <CalendarIcon className={clsx('h-4 w-4', isOpen ? 'text-primary-500' : 'text-gray-500')} />
                        </div>
                        <span className={clsx('text-sm font-medium truncate tracking-tight', !selectedDate ? 'text-gray-400' : 'text-gray-900 dark:text-white')}>
                            {selectedDate ? selectedDate.toLocaleString([], {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            }) : 'Select date and time...'}
                        </span>
                    </div>
                </button>

                {createPortal(
                    <AnimatePresence>
                        {isOpen && (
                            <motion.div
                                ref={dropdownRef}
                                initial={{ opacity: 0, y: dropdownPos.direction === 'down' ? -10 : 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                style={{
                                    position: 'fixed',
                                    top: dropdownPos.top || 0,
                                    left: dropdownPos.left || 0,
                                    width: dropdownPos.width || 420,
                                    zIndex: 9999
                                }}
                                className={clsx(
                                    "bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex overflow-hidden",
                                    dropdownPos.direction === 'down' ? 'origin-top' : 'origin-bottom'
                                )}
                            >
                                <div className="flex-1">
                                    {renderCalendar()}
                                </div>
                                {renderTimeColumn()}
                            </motion.div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}
            </div>

            {helperText && (
                <div className="mt-2 flex gap-1.5 items-start text-[11px] text-gray-500 dark:text-gray-400 ml-1 leading-relaxed">
                    <ClockIcon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-400" />
                    <span>{helperText}</span>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.1); }
      `}} />
        </div>
    );
};

export default DateTimePicker;
