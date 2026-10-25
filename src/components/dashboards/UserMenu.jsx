import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    ChevronDownIcon,
    Cog6ToothIcon,
    ArrowRightStartOnRectangleIcon,
    ArrowPathIcon,
    ShieldExclamationIcon,
    ArrowUturnLeftIcon,
    SunIcon,
    MoonIcon,
} from '@heroicons/react/24/outline';
import { useTheme } from '../../contexts/ThemeContext';

/* ─── gradient seed from first letter ─── */
const avatarGradient = (char = 'U') => {
    const map = {
        A: ['#6366f1','#818cf8'], B: ['#8b5cf6','#a78bfa'], C: ['#ec4899','#f472b6'],
        D: ['#f59e0b','#fbbf24'], E: ['#10b981','#34d399'], F: ['#3b82f6','#60a5fa'],
        G: ['#06b6d4','#22d3ee'], H: ['#6366f1','#a855f7'], I: ['#f97316','#fb923c'],
        J: ['#14b8a6','#2dd4bf'], K: ['#8b5cf6','#c084fc'], L: ['#3b82f6','#818cf8'],
        M: ['#ec4899','#f9a8d4'], N: ['#10b981','#6ee7b7'], O: ['#f59e0b','#fed7aa'],
        P: ['#6366f1','#818cf8'], Q: ['#ef4444','#f87171'], R: ['#06b6d4','#67e8f9'],
        S: ['#8b5cf6','#a78bfa'], T: ['#3b82f6','#93c5fd'], U: ['#6366f1','#818cf8'],
        V: ['#10b981','#34d399'], W: ['#f59e0b','#fcd34d'], X: ['#ec4899','#f472b6'],
        Y: ['#14b8a6','#2dd4bf'], Z: ['#6366f1','#a855f7'],
    };
    return map[char.toUpperCase()] || ['#6366f1', '#818cf8'];
};

const UserMenu = ({ user, onSignOut, onChangePassword, onRefresh }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { theme, toggleTheme } = useTheme();

    const firstChar = (user?.displayName || user?.email || 'U').charAt(0).toUpperCase();
    const [gradStart, gradEnd] = avatarGradient(firstChar);

    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={menuRef} data-user-menu>
            {/* ── Trigger Button ── */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`group flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-2xl transition-all duration-200 focus:outline-none
                    bg-transparent hover:bg-white/5 dark:hover:bg-white/5
                    ${isOpen ? 'bg-white/8 dark:bg-white/8' : ''}`}
                aria-label="User menu"
                aria-expanded={isOpen}
            >
                {/* Avatar */}
                <div
                    className="flex-shrink-0 h-8 w-8 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${gradStart}, ${gradEnd})` }}
                >
                    {firstChar}
                </div>
                {/* Name */}
                <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-[110px] leading-tight">
                    {user?.displayName || user?.email?.split('@')[0]}
                </span>
                {/* Chevron */}
                <ChevronDownIcon
                    className={`hidden sm:block h-3.5 w-3.5 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* ── Dropdown Panel ── */}
            {isOpen && (
                <div className="absolute right-0 mt-3 w-64 z-50 animate-in slide-in-down"
                    style={{ animationDuration: '150ms' }}>
                    {/* Glass card */}
                    <div className="rounded-2xl overflow-hidden border border-gray-200/60 dark:border-white/8 bg-white dark:bg-[#0f0f0f] shadow-xl shadow-black/10 dark:shadow-black/60">

                        {/* ── Profile Header ── */}
                        <div className="relative px-4 pt-4 pb-3 overflow-hidden">
                            {/* Subtle gradient accent behind avatar */}
                            <div
                                className="absolute inset-0 opacity-[0.06]"
                                style={{ background: `radial-gradient(ellipse at 30% 50%, ${gradStart}, transparent 70%)` }}
                            />
                            <div className="relative flex items-center gap-3">
                                <div
                                    className="flex-shrink-0 h-11 w-11 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-md"
                                    style={{ background: `linear-gradient(135deg, ${gradStart}, ${gradEnd})` }}
                                >
                                    {firstChar}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">
                                        {user?.displayName || 'User'}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-500 truncate mt-0.5">
                                        {user?.email}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 dark:border-white/6 mx-0" />

                        {/* ── Menu Items ── */}
                        <div className="py-1.5">

                            {/* Refresh */}
                            {onRefresh && (
                                <MenuItem
                                    icon={<ArrowPathIcon className="h-4 w-4" />}
                                    iconColor="text-gray-400 dark:text-gray-500"
                                    label="Refresh Data"
                                    onClick={() => { setIsOpen(false); onRefresh(); }}
                                />
                            )}

                            {/* Co-Admin switcher */}
                            {user?.isCoAdmin && user?.role !== 'admin' && (
                                <MenuItem
                                    icon={location.pathname.startsWith('/admin')
                                        ? <ArrowUturnLeftIcon className="h-4 w-4" />
                                        : <ShieldExclamationIcon className="h-4 w-4" />}
                                    iconColor="text-indigo-500"
                                    label={location.pathname.startsWith('/admin') ? 'Return to Member View' : 'Switch to Admin Board'}
                                    textColor="text-indigo-700 dark:text-indigo-400"
                                    bg="bg-indigo-50/40 dark:bg-indigo-500/5"
                                    onClick={() => {
                                        setIsOpen(false);
                                        if (location.pathname.startsWith('/admin')) {
                                            if (user.role === 'team_leader') navigate('/team-leader');
                                            else if (user.role === 'trainer') navigate('/trainer');
                                            else navigate('/team-member');
                                        } else {
                                            navigate('/admin');
                                        }
                                    }}
                                />
                            )}

                            {/* Change Password */}
                            <MenuItem
                                icon={<Cog6ToothIcon className="h-4 w-4" />}
                                iconColor="text-gray-400 dark:text-gray-500"
                                label="Change Password"
                                onClick={() => { setIsOpen(false); onChangePassword(); }}
                            />

                        </div>

                        <div className="border-t border-gray-100 dark:border-white/6" />

                        {/* ── Theme Toggle ── */}
                        <div className="py-1.5">
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleTheme(); }}
                                className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-150 group"
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`p-1 rounded-lg transition-colors ${theme === 'dark' ? 'bg-indigo-500/15 text-indigo-400' : 'bg-amber-100 text-amber-500'}`}>
                                        {theme === 'dark'
                                            ? <MoonIcon className="h-3.5 w-3.5" />
                                            : <SunIcon className="h-3.5 w-3.5" />}
                                    </span>
                                    <span className="font-medium">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                                </div>
                                {/* Toggle pill */}
                                <div className={`relative flex h-5.5 w-10 items-center rounded-full transition-all duration-300 ${theme === 'dark' ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                                    style={{ height: '22px', width: '40px' }}>
                                    <span
                                        className={`absolute inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0.5'}`}
                                        style={{ left: 0 }}
                                    />
                                </div>
                            </button>
                        </div>

                        <div className="border-t border-gray-100 dark:border-white/6" />

                        {/* ── Sign Out ── */}
                        <div className="py-1.5">
                            <MenuItem
                                icon={<ArrowRightStartOnRectangleIcon className="h-4 w-4" />}
                                iconColor="text-red-400"
                                label="Sign Out"
                                textColor="text-red-500 dark:text-red-400"
                                hoverBg="hover:bg-red-50 dark:hover:bg-red-500/8"
                                onClick={() => { setIsOpen(false); onSignOut(); }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/* ─── Reusable menu row ─── */
const MenuItem = ({
    icon, iconColor = 'text-gray-400', label,
    textColor = 'text-gray-700 dark:text-gray-300',
    hoverBg = 'hover:bg-gray-50 dark:hover:bg-white/5',
    bg = '',
    onClick,
}) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors duration-150 ${textColor} ${hoverBg} ${bg}`}
    >
        <span className={`flex-shrink-0 ${iconColor}`}>{icon}</span>
        <span>{label}</span>
    </button>
);

export default UserMenu;
