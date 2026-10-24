import { logger } from './logger';
/**
 * chatWebhook.js
 * Utility to send notifications to Google Chat via Webhook.
 */

/**
 * Sends a formatted SPII alert to a Google Chat webhook.
 * @param {string} webhookUrl - The URL of the Google Chat webhook.
 * @param {Object} log - The SPII log object.
 * @returns {Promise<Object>} - The response from the webhook.
 */
export const sendSpiiChatAlert = async (webhookUrl, log) => {
    if (!webhookUrl) {
        throw new Error('Google Chat Webhook URL is not configured.');
    }

    const detectionsList = log.detections
        .map(d => `• *${d.type}*: ${d.redacted}`)
        .join('\n');

    const message = {
        text: `🚨 *SPII DETECTION ALERT* 🚨\n\n` +
              `*User:* ${log.userDisplayName}\n` +
              `*Source:* ${log.sourceTab}\n` +
              `*Time:* ${log.timestamp?.toDate?.()?.toLocaleString() || new Date().toLocaleString()}\n\n` +
              `*Detected Information:*\n${detectionsList}\n\n` +
              `_This incident has been logged in the SPII Audit Center for review._`
    };

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
            },
            body: JSON.stringify(message),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to send alert: ${response.status} ${errorText}`);
        }

        return { success: true };
    } catch (error) {
        logger.error('Error sending Google Chat alert:', error);
        throw error;
    }
};
