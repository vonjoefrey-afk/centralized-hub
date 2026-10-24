import React, { useState, useEffect, useRef } from 'react';
import { useNotifications } from '../../hooks/useNotifications';

/* ─── time-ago helper ─── */
const timeAgo = (date) => {
    if (!date) return '';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60)  return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const NotificationCenter = ({ user }) => {
    const [showDropdown, setShowDropdown] = useState(false);
    const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification } = useNotifications(user);

    const dropdownRef = useRef(null);
    const bellRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showDropdown &&
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target) &&
                !bellRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && showDropdown) setShowDropdown(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [showDropdown]);

    const handleNotificationClick = async (notification) => {
        if (!notification.isRead) await markAsRead(notification.id);
        setShowDropdown(false);
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        await removeNotification(id);
    };

    return (
        <div className="relative">
            {/* ── Bell Button ── */}
            <button
                ref={bellRef}
                onClick={() => setShowDropdown(!showDropdown)}
                className={`relative flex items-center justify-center h-9 w-9 rounded-2xl transition-all duration-200 focus:outline-none
                    text-gray-500 dark:text-gray-400
                    hover:bg-white/8 dark:hover:bg-white/8 hover:text-gray-700 dark:hover:text-gray-200
                    ${showDropdown ? 'bg-white/8 dark:bg-white/8 text-gray-700 dark:text-gray-200' : ''}`}
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
            >
                {/* Bell icon */}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>

                {/* Unread badge */}
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none shadow-sm">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* ── Dropdown Panel ── */}
            {showDropdown && (
                <div
                    ref={dropdownRef}
                    className="absolute right-0 mt-3 w-80 z-50 animate-in slide-in-down"
                    style={{ animationDuration: '150ms' }}
                >
                    <div className="rounded-2xl overflow-hidden border border-gray-200/60 dark:border-white/8 bg-white dark:bg-[#0f0f0f] shadow-xl shadow-black/10 dark:shadow-black/60">

                        {/* ── Header ── */}
                        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 dark:border-white/6">
                            <div className="flex items-center gap-2.5">
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</span>
                                {unreadCount > 0 && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-indigo-500/15 text-indigo-500 dark:text-indigo-400 rounded-full">
                                        {unreadCount} new
                                    </span>
                                )}
                            </div>
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                                >
                                    Mark all read
                                </button>
                            )}
                        </div>

                        {/* ── List ── */}
                        <div className="max-h-[420px] overflow-y-auto">
                            {notifications.length === 0 ? (
                                /* Empty state */
                                <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                                    <div className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-white/6 flex items-center justify-center mb-3">
                                        <svg className="w-5 h-5 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                                                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                        </svg>
                                    </div>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">All caught up!</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">No new notifications</p>
                                </div>
                            ) : (
                                notifications.map((notification, idx) => {
                                    const ts = notification.createdAt?.toDate?.();
                                    return (
                                        <div
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification)}
                                            className={`relative flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors duration-150
                                                ${idx < notifications.length - 1 ? 'border-b border-gray-100/60 dark:border-white/5' : ''}
                                                ${!notification.isRead
                                                    ? 'bg-indigo-50/40 dark:bg-indigo-500/5 hover:bg-indigo-50/70 dark:hover:bg-indigo-500/8'
                                                    : 'hover:bg-gray-50 dark:hover:bg-white/4'}`}
                                        >
                                            {/* Unread indicator stripe */}
                                            {!notification.isRead && (
                                                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-indigo-500 rounded-r-full" />
                                            )}

                                            {/* Dot / read indicator */}
                                            <div className="flex-shrink-0 mt-0.5">
                                                {!notification.isRead
                                                    ? <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1" />
                                                    : <div className="w-2 h-2 rounded-full bg-gray-200 dark:bg-white/10 mt-1" />}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate leading-snug">
                                                    {notification.title}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">
                                                    {notification.message}
                                                </p>
                                                {ts && (
                                                    <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1">
                                                        {timeAgo(ts)}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Delete */}
                                            <button
                                                onClick={(e) => handleDelete(e, notification.id)}
                                                className="flex-shrink-0 p-1 rounded-lg text-gray-300 dark:text-gray-700 hover:text-red-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors mt-0.5"
                                                aria-label="Dismiss"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {notifications.length > 0 && (
                            <div className="border-t border-gray-100 dark:border-white/6 px-4 py-2.5">
                                <p className="text-[10px] text-gray-400 dark:text-gray-600 text-center">
                                    {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;
