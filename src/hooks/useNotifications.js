import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '../utils/logger';

import { getNotificationsByUser, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification, checkApproachingDeadlines } from '../firebase/firestore';
import { onSnapshot, query, collection, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { showSuccess, showError, showInfo } from '../utils/toast';

export const useNotifications = (user) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notificationSoundEnabled] = useState(true);
    const [browserPermission, setBrowserPermission] = useState('default');

    const previousNotificationIdsRef = useRef(new Set());
    const isInitialLoadRef = useRef(true);

    // Notification sound function
    const playNotificationSound = useCallback(async () => {
        if (!notificationSoundEnabled) return;

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const audioContext = new AudioContext();

            // Resume context if suspended (browser autoplay policy)
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Two-tone chime
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            logger.error('Error playing notification sound:', error);
        }
    }, [notificationSoundEnabled]);

    const loadNotifications = async () => {
        if (!user?.uid) return;
        try {
            logger.log('Loading notifications for user:', user.uid);
            const notificationsData = await getNotificationsByUser(user.uid);
            setNotifications(notificationsData);
            const unread = notificationsData.filter(n => !n.isRead).length;
            setUnreadCount(unread);
        } catch (err) {
            logger.error('Failed to load notifications:', err);
        }
    };

    // Real-time listener
    useEffect(() => {
        if (!user?.uid) return;

        // Reset refs when user changes
        previousNotificationIdsRef.current = new Set();
        isInitialLoadRef.current = true;

        logger.log('Setting up real-time notification listener for user:', user.uid);

        const notificationsQuery = query(
            collection(db, 'notifications'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );

        // Browser permission check on mount
        if ('Notification' in window) {
            setBrowserPermission(Notification.permission);
        }

        const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
            const notificationsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Sort in JavaScript
            notificationsData.sort((a, b) => {
                const aTime = a.createdAt?.toDate?.() || new Date(0);
                const bTime = b.createdAt?.toDate?.() || new Date(0);
                return bTime - aTime;
            });

            // Check if there are new notifications
            const currentNotificationIds = new Set(notificationsData.map(n => n.id));
            const previousIds = previousNotificationIdsRef.current;
            const newNotifications = notificationsData.filter(n => !previousIds.has(n.id));

            setNotifications(notificationsData);
            const unread = notificationsData.filter(n => !n.isRead).length;
            setUnreadCount(unread);

            // Mark that initial load is complete FIRST
            if (isInitialLoadRef.current) {
                previousNotificationIdsRef.current = currentNotificationIds;
                isInitialLoadRef.current = false;
                return;
            }

            // Show toast, sound, and browser notification for new notifications
            if (newNotifications.length > 0) {
                playNotificationSound();
                const latestNotification = newNotifications[0];
                showInfo(`🔔 ${latestNotification.title}`);
                
                // Browser notification
                if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
                    new Notification(latestNotification.title, {
                        body: latestNotification.message,
                        icon: '/favicon.ico'
                    });
                }

                previousNotificationIdsRef.current = currentNotificationIds;
            }
        }, (error) => {
            logger.error('Error in notifications listener:', error);
            loadNotifications();
        });

        return () => unsubscribe();
    }, [user?.uid, playNotificationSound]);

    // Check for approaching deadlines — scoped to the current user's team
    useEffect(() => {
        if (!user?.uid) return;
        const checkDeadlines = async () => {
            try {
                await checkApproachingDeadlines(user.uid);
            } catch (err) {
                // Silently handle permission errors (e.g. user has no team yet)
                if (err?.code !== 'permission-denied') {
                    logger.error('Failed to check approaching deadlines:', err);
                }
            }
        };

        checkDeadlines();
        const interval = setInterval(checkDeadlines, 30 * 60 * 1000);
        return () => clearInterval(interval);
    }, [user?.uid]);

    const markAsRead = async (notificationId) => {
        await markNotificationAsRead(notificationId);
        // State update handled by listener
    };

    const markAllAsRead = async () => {
        if (!user?.uid) return;
        await markAllNotificationsAsRead(user.uid);
    };

    const requestBrowserPermission = async () => {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            setBrowserPermission(permission);
            return permission;
        }
        return 'denied';
    };

    const removeNotification = async (notificationId) => {
        await deleteNotification(notificationId);
    };

    return {
        notifications,
        unreadCount,
        browserPermission,
        requestBrowserPermission,
        markAsRead,
        markAllAsRead,
        removeNotification,
        loadNotifications
    };
};
