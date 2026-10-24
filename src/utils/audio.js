import { logger } from './logger';
/**
 * Shared Audio Utility for synthetic alarm sounds using Web Audio API
 */

let audioContext = null;

const initAudio = () => {
    if (!audioContext) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
    }
    return audioContext;
};

export const resumeAudioContext = async () => {
    const ctx = initAudio();
    if (ctx.state === 'suspended') {
        await ctx.resume();
    }
    return ctx;
};

const playSoundPattern = (ctx, type) => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'beep') {
        // Classic Beep
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    } else if (type === 'chime') {
        // Gentle Chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.1); // C6
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2);
        osc.start(now);
        osc.stop(now + 2.0);
    } else if (type === 'digital') {
        // Digital Alarm
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1200, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.setValueAtTime(0.05, now + 0.1);
        gain.gain.linearRampToValueAtTime(0, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.2);
    }
};

/**
 * Play a specific alarm sound
 * @param {string} type - 'beep', 'chime', or 'digital'
 */
export const playAlarm = async (type = 'chime') => {
    try {
        const ctx = await resumeAudioContext();

        if (type === 'beep') {
            playSoundPattern(ctx, 'beep');
            setTimeout(() => playSoundPattern(ctx, 'beep'), 600);
            setTimeout(() => playSoundPattern(ctx, 'beep'), 1200);
        } else if (type === 'chime') {
            playSoundPattern(ctx, 'chime');
        } else if (type === 'digital') {
            playSoundPattern(ctx, 'digital');
            setTimeout(() => playSoundPattern(ctx, 'digital'), 200);
            setTimeout(() => playSoundPattern(ctx, 'digital'), 400);
        }
    } catch (error) {
        logger.error('Failed to play alarm sound:', error);
    }
};

/**
 * Preview a single pattern iteration
 * @param {string} type 
 */
export const previewSound = (type) => {
    try {
        const ctx = initAudio();
        playSoundPattern(ctx, type);
    } catch (error) {
        logger.error('Failed to preview sound:', error);
    }
};
