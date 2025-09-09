import axios, { AxiosResponse } from "axios";
import { config } from "../config/environment";

const WHATSAPP_API_URL = `${config.whatsappApiVersion}/${config.whatsappPhoneNumberId}/messages`;

export interface WhatsAppMessageResponse {
  messaging_product: string;
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
    message_status: string;
  }>;
}

export interface ButtonOption {
  id: string;
  title: string;
}

export interface ListSection {
  title: string;
  rows: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
}

/**
 * Send a text message via WhatsApp Business API
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<WhatsAppMessageResponse> {
  try {
    const payload = {
      messaging_product: "whatsapp",
      to: to,
      type: "text",
      text: {
        body: message,
      },
    };

    const response: AxiosResponse<WhatsAppMessageResponse> = await axios.post(
      WHATSAPP_API_URL,
      payload,
      {
        headers: {
          Authorization: `Bearer ${config.whatsappAccessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("WhatsApp message sent successfully:", {
      to,
      messageId: response.data.messages[0].id,
    });

    return response.data;
  } catch (error: any) {
    console.error(
      "Error sending WhatsApp message:",
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * Send a template message via WhatsApp Business API
 */
export async function sendTemplateMessage(
  to: string,
  templateName: string,
  parameters: string[] = []
): Promise<WhatsAppMessageResponse> {
  try {
    const payload = {
      messaging_product: "whatsapp",
      to: to,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: "en",
        },
        components:
          parameters.length > 0
            ? [
                {
                  type: "body",
                  parameters: parameters.map((param) => ({
                    type: "text",
                    text: param,
                  })),
                },
              ]
            : [],
      },
    };

    const response: AxiosResponse<WhatsAppMessageResponse> = await axios.post(
      WHATSAPP_API_URL,
      payload,
      {
        headers: {
          Authorization: `Bearer ${config.whatsappAccessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("WhatsApp template message sent successfully:", {
      to,
      templateName,
      messageId: response.data.messages[0].id,
    });

    return response.data;
  } catch (error: any) {
    console.error(
      "Error sending WhatsApp template message:",
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * Send an interactive button message
 */
export async function sendButtonMessage(
  to: string,
  bodyText: string,
  buttons: ButtonOption[]
): Promise<WhatsAppMessageResponse> {
  try {
    const payload = {
      messaging_product: "whatsapp",
      to: to,
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text: bodyText,
        },
        action: {
          buttons: buttons.map((button, index) => ({
            type: "reply",
            reply: {
              id: button.id || `btn_${index}`,
              title: button.title,
            },
          })),
        },
      },
    };

    const response: AxiosResponse<WhatsAppMessageResponse> = await axios.post(
      WHATSAPP_API_URL,
      payload,
      {
        headers: {
          Authorization: `Bearer ${config.whatsappAccessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("WhatsApp button message sent successfully:", {
      to,
      messageId: response.data.messages[0].id,
    });

    return response.data;
  } catch (error: any) {
    console.error(
      "Error sending WhatsApp button message:",
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * Send an interactive list message
 */
export async function sendListMessage(
  to: string,
  bodyText: string,
  buttonText: string,
  sections: ListSection[]
): Promise<WhatsAppMessageResponse> {
  try {
    const payload = {
      messaging_product: "whatsapp",
      to: to,
      type: "interactive",
      interactive: {
        type: "list",
        body: {
          text: bodyText,
        },
        action: {
          button: buttonText,
          sections: sections,
        },
      },
    };

    const response: AxiosResponse<WhatsAppMessageResponse> = await axios.post(
      WHATSAPP_API_URL,
      payload,
      {
        headers: {
          Authorization: `Bearer ${config.whatsappAccessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("WhatsApp list message sent successfully:", {
      to,
      messageId: response.data.messages[0].id,
    });

    return response.data;
  } catch (error: any) {
    console.error(
      "Error sending WhatsApp list message:",
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * Mark a message as read
 */
export async function markMessageAsRead(
  messageId: string
): Promise<WhatsAppMessageResponse> {
  try {
    const payload = {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    };

    const response: AxiosResponse<WhatsAppMessageResponse> = await axios.post(
      WHATSAPP_API_URL,
      payload,
      {
        headers: {
          Authorization: `Bearer ${config.whatsappAccessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Message marked as read:", messageId);
    return response.data;
  } catch (error: any) {
    console.error(
      "Error marking message as read:",
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * Get media URL from WhatsApp media ID
 */
export async function getMediaUrl(mediaId: string): Promise<string> {
  try {
    const response = await axios.get(
      `${config.whatsappApiVersion}/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${config.whatsappAccessToken}`,
        },
      }
    );

    return response.data.url;
  } catch (error: any) {
    console.error(
      "Error getting media URL:",
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * Download media from WhatsApp
 */
export async function downloadMedia(mediaUrl: string): Promise<Buffer> {
  try {
    const response = await axios.get(mediaUrl, {
      headers: {
        Authorization: `Bearer ${config.whatsappAccessToken}`,
      },
      responseType: "arraybuffer",
    });

    return Buffer.from(response.data);
  } catch (error: any) {
    console.error(
      "Error downloading media:",
      error.response?.data || error.message
    );
    throw error;
  }
}
