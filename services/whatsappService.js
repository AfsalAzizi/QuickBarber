const axios = require('axios');

const WHATSAPP_API_URL = `${process.env.META_GRAPH_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

/**
 * Send a text message via WhatsApp Business API
 * @param {String} to - Recipient phone number
 * @param {String} message - Message text
 * @returns {Object} - API response
 */
async function sendWhatsAppMessage(to, message) {
    try {
        const payload = {
            messaging_product: 'whatsapp',
            to: to,
            type: 'text',
            text: {
                body: message
            }
        };

        const response = await axios.post(WHATSAPP_API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('WhatsApp message sent successfully:', {
            to,
            messageId: response.data.messages[0].id
        });

        return response.data;
    } catch (error) {
        console.error('Error sending WhatsApp message:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Send a template message via WhatsApp Business API
 * @param {String} to - Recipient phone number
 * @param {String} templateName - Template name
 * @param {Array} parameters - Template parameters
 * @returns {Object} - API response
 */
async function sendTemplateMessage(to, templateName, parameters = []) {
    try {
        const payload = {
            messaging_product: 'whatsapp',
            to: to,
            type: 'template',
            template: {
                name: templateName,
                language: {
                    code: 'en'
                },
                components: parameters.length > 0 ? [{
                    type: 'body',
                    parameters: parameters.map(param => ({
                        type: 'text',
                        text: param
                    }))
                }] : []
            }
        };

        const response = await axios.post(WHATSAPP_API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('WhatsApp template message sent successfully:', {
            to,
            templateName,
            messageId: response.data.messages[0].id
        });

        return response.data;
    } catch (error) {
        console.error('Error sending WhatsApp template message:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Send an interactive button message
 * @param {String} to - Recipient phone number
 * @param {String} bodyText - Message body text
 * @param {Array} buttons - Array of button objects
 * @returns {Object} - API response
 */
async function sendButtonMessage(to, bodyText, buttons) {
    try {
        const payload = {
            messaging_product: 'whatsapp',
            to: to,
            type: 'interactive',
            interactive: {
                type: 'button',
                body: {
                    text: bodyText
                },
                action: {
                    buttons: buttons.map((button, index) => ({
                        type: 'reply',
                        reply: {
                            id: button.id || `btn_${index}`,
                            title: button.title
                        }
                    }))
                }
            }
        };

        const response = await axios.post(WHATSAPP_API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('WhatsApp button message sent successfully:', {
            to,
            messageId: response.data.messages[0].id
        });

        return response.data;
    } catch (error) {
        console.error('Error sending WhatsApp button message:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Send an interactive list message
 * @param {String} to - Recipient phone number
 * @param {String} bodyText - Message body text
 * @param {String} buttonText - Button text
 * @param {Array} sections - Array of list sections
 * @returns {Object} - API response
 */
async function sendListMessage(to, bodyText, buttonText, sections) {
    try {
        const payload = {
            messaging_product: 'whatsapp',
            to: to,
            type: 'interactive',
            interactive: {
                type: 'list',
                body: {
                    text: bodyText
                },
                action: {
                    button: buttonText,
                    sections: sections
                }
            }
        };

        const response = await axios.post(WHATSAPP_API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('WhatsApp list message sent successfully:', {
            to,
            messageId: response.data.messages[0].id
        });

        return response.data;
    } catch (error) {
        console.error('Error sending WhatsApp list message:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Mark a message as read
 * @param {String} messageId - Message ID to mark as read
 * @returns {Object} - API response
 */
async function markMessageAsRead(messageId) {
    try {
        const payload = {
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId
        };

        const response = await axios.post(WHATSAPP_API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Message marked as read:', messageId);
        return response.data;
    } catch (error) {
        console.error('Error marking message as read:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Get media URL from WhatsApp media ID
 * @param {String} mediaId - Media ID from WhatsApp
 * @returns {String} - Media URL
 */
async function getMediaUrl(mediaId) {
    try {
        const response = await axios.get(
            `${process.env.META_GRAPH_API_URL}/${mediaId}`,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`
                }
            }
        );

        return response.data.url;
    } catch (error) {
        console.error('Error getting media URL:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Download media from WhatsApp
 * @param {String} mediaUrl - Media URL from WhatsApp
 * @returns {Buffer} - Media data
 */
async function downloadMedia(mediaUrl) {
    try {
        const response = await axios.get(mediaUrl, {
            headers: {
                'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`
            },
            responseType: 'arraybuffer'
        });

        return Buffer.from(response.data);
    } catch (error) {
        console.error('Error downloading media:', error.response?.data || error.message);
        throw error;
    }
}

module.exports = {
    sendWhatsAppMessage,
    sendTemplateMessage,
    sendButtonMessage,
    sendListMessage,
    markMessageAsRead,
    getMediaUrl,
    downloadMedia
};
