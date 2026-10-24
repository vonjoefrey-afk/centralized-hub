import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PlayIcon, PauseIcon, StopIcon, Cog6ToothIcon, ClockIcon } from '@heroicons/react/24/outline';
import { playAlarm, previewSound } from '../../utils/audio';

const FocusTimer = () => {
    const [timeLeft, setTimeLeft] = useState(0); // in seconds
    const [isActive, setIsActive] = useState(false);
    const [isPaused, setIsPaused] = useState(false);

    // Input states
    const [minutes, setMinutes] = useState('');
    const [seconds, setSeconds] = useState('');

    // Settings
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [selectedSound, setSelectedSound] = useState('beep');
    const [showSettings, setShowSettings] = useState(false);

    const timerRef = useRef(null);

    const playAlarmSound = useCallback(() => {
        if (!soundEnabled) return;
        playAlarm(selectedSound);
    }, [soundEnabled, selectedSound]);

    useEffect(() => {
        if (isActive && !isPaused && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(timerRef.current);
                        setIsActive(false);
                        playAlarmSound();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [isActive, isPaused, timeLeft, playAlarmSound]);

    const startTimer = (presetMinutes = null) => {
        let totalSeconds = 0;

        if (presetMinutes) {
            totalSeconds = presetMinutes * 60;
        } else {
            const m = parseInt(minutes) || 0;
            const s = parseInt(seconds) || 0;
            totalSeconds = (m * 60) + s;
        }

        if (totalSeconds <= 0) return;

        setTimeLeft(totalSeconds);
        setIsActive(true);
        setIsPaused(false);
        setMinutes('');
        setSeconds('');
        initAudio();
    };

    const resetTimer = () => {
        setIsActive(false);
        setIsPaused(false);
        setTimeLeft(0);
    };

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const iconBtn = 'w-8 h-8 rounded-full flex items-center justify-center flex-none transition-all active:scale-95';

    return (
        <div className="w-full flex justify-center items-center">
            {/* Compact glassmorphic focus-timer pill */}
            <div className={`relative inline-flex items-center gap-1 rounded-full pl-1.5 pr-1 py-1 backdrop-blur-xl border transition-all duration-300 ${isActive
                ? 'bg-indigo-500/10 dark:bg-indigo-500/[0.14] border-indigo-400/30 dark:border-indigo-400/25 shadow-lg shadow-indigo-500/10'
                : 'bg-white/70 dark:bg-white/[0.06] border-gray-200/70 dark:border-white/10 shadow-lg shadow-black/[0.06] ring-1 ring-white/60 dark:ring-white/5'}`}
            >
                {/* Accent glow underline while running */}
                {isActive && (
                    <div className="absolute -bottom-px left-4 right-4 h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 opacity-70"></div>
                )}

                {/* Accent icon chip */}
                <span className="w-6 h-6 rounded-full gradient-accent flex items-center justify-center flex-none shadow-sm shadow-indigo-500/30">
                    <ClockIcon className="w-3.5 h-3.5 text-white" />
                </span>

                {!isActive ? (
                    <>
                        {/* Time input — glass field, numeric text (no native spinners) */}
                        <div className="flex items-center gap-0.5 rounded-full bg-gray-100/80 dark:bg-white/[0.07] border border-gray-200/70 dark:border-white/10 px-2.5 py-1 font-mono text-sm text-gray-800 dark:text-gray-100 focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-400/40 transition-all">
                            <input
                                type="text"
                                inputMode="numeric"
                                value={minutes}
                                onChange={(e) => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 2))}
                                onKeyDown={(e) => e.key === 'Enter' && startTimer(null)}
                                placeholder="00"
                                maxLength={2}
                                aria-label="Minutes"
                                className="w-6 bg-transparent text-center border-none p-0 focus:outline-none focus:ring-0 tabular-nums placeholder-gray-300 dark:placeholder-gray-600"
                            />
                            <span className="text-gray-400 dark:text-gray-500 font-bold">:</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={seconds}
                                onChange={(e) => setSeconds(e.target.value.replace(/\D/g, '').slice(0, 2))}
                                onKeyDown={(e) => e.key === 'Enter' && startTimer(null)}
                                placeholder="00"
                                maxLength={2}
                                aria-label="Seconds"
                                className="w-6 bg-transparent text-center border-none p-0 focus:outline-none focus:ring-0 tabular-nums placeholder-gray-300 dark:placeholder-gray-600"
                            />
                        </div>

                        {/* Quick presets */}
                        <div className="hidden md:flex items-center gap-0.5">
                            {[3, 5, 10].map((p) => (
                                <button
                                    key={p}
                                    onClick={() => startTimer(p)}
                                    className="px-1.5 py-0.5 text-[11px] font-bold text-gray-500 dark:text-gray-400 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                                >
                                    {p}m
                                </button>
                            ))}
                        </div>

                        {/* Start */}
                        <button
                            onClick={() => startTimer(null)}
                            title="Start timer"
                            aria-label="Start timer"
                            className={`${iconBtn} gradient-accent text-white shadow-sm shadow-indigo-500/30 hover:brightness-110`}
                        >
                            <PlayIcon className="w-4 h-4" />
                        </button>
                    </>
                ) : (
                    <>
                        {/* Countdown */}
                        <span className={`font-mono text-base font-bold tabular-nums tracking-wide px-1.5 ${isPaused ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                            {formatTime(timeLeft)}
                        </span>
                        <button
                            onClick={() => setIsPaused(!isPaused)}
                            title={isPaused ? 'Resume' : 'Pause'}
                            aria-label={isPaused ? 'Resume' : 'Pause'}
                            className={`${iconBtn} ${isPaused
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25'
                                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25'}`}
                        >
                            {isPaused ? <PlayIcon className="w-4 h-4" /> : <PauseIcon className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={resetTimer}
                            title="Stop"
                            aria-label="Stop timer"
                            className={`${iconBtn} bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-500/25`}
                        >
                            <StopIcon className="w-4 h-4" />
                        </button>
                    </>
                )}

                {/* Settings */}
                <div className="relative">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        title="Timer settings"
                        aria-label="Timer settings"
                        className={`w-7 h-7 rounded-full flex items-center justify-center flex-none transition-colors ${showSettings
                            ? 'bg-gray-200/80 dark:bg-white/15 text-gray-800 dark:text-gray-100'
                            : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                    >
                        <Cog6ToothIcon className="w-4 h-4" />
                    </button>

                    {showSettings && (
                        <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-white/80 dark:bg-[#14161f]/85 backdrop-blur-xl shadow-xl shadow-black/10 dark:shadow-black/40 border border-gray-200/70 dark:border-white/10 ring-1 ring-white/50 dark:ring-white/5 z-50 overflow-hidden">
                            <div className="p-3 border-b border-gray-100 dark:border-white/8">
                                <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Alarm sound</h4>
                                <div className="space-y-1">
                                    {['beep', 'chime', 'digital'].map((sound) => (
                                        <button
                                            key={sound}
                                            onClick={() => { setSelectedSound(sound); previewSound(sound); }}
                                            className={`w-full text-left px-2.5 py-1.5 text-sm rounded-lg flex items-center justify-between ${selectedSound === sound
                                                ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-semibold'
                                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/8'}`}
                                        >
                                            <span className="capitalize">{sound}</span>
                                            {selectedSound === sound && <span className="w-2 h-2 rounded-full gradient-accent"></span>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="p-2.5 flex items-center justify-between">
                                <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">Enable sound</span>
                                <button
                                    onClick={() => setSoundEnabled(!soundEnabled)}
                                    aria-label="Toggle sound"
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${soundEnabled ? 'gradient-accent' : 'bg-gray-300 dark:bg-white/15'}`}
                                >
                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${soundEnabled ? 'translate-x-[18px]' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Backdrop for settings */}
            {showSettings && (
                <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)}></div>
            )}
        </div>
    );
};

export default FocusTimer;
