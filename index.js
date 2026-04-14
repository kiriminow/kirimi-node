const rp = require("request-promise-native");
const FormData = require("form-data");

class Kirimi {
  /**
   * @param {string} user_code - User Code
   * @param {string} secret - Secret Key
   **/
  constructor(user_code, secret) {
    this._user_code = user_code;
    this._secret = secret;
    this._endpoint = "https://api.kirimi.id";
  }

  /**
   * Build common auth fields
   * @private
   */
  _auth() {
    return { user_code: this._user_code, secret: this._secret };
  }

  /**
   * Send WhatsApp message with optional media
   * @param {string} deviceId - Device ID
   * @param {string} to - Receiver phone number
   * @param {string} message - Message content (max 1200 chars)
   * @param {string} [mediaUrl] - Optional media URL
   * @returns {Promise<Object>} Response data
   */
  async sendMessage(deviceId, to, message, mediaUrl = null) {
    const body = {
      ...this._auth(),
      device_id: deviceId,
      phone: to,
      message: message,
    };

    if (mediaUrl) {
      body.media_url = mediaUrl;
    }

    const options = {
      method: "POST",
      uri: `${this._endpoint}/v1/send-message`,
      body: body,
      json: true,
    };

    try {
      const resp = await rp(options);
      if (resp.success && resp.data) {
        return resp.data;
      }
      throw new Error(resp.message || "Failed to send message");
    } catch (err) {
      throw new Error(`Send message failed: ${err.message}`);
    }
  }

  /**
   * Send WhatsApp message without typing effect (fast)
   * @param {string} deviceId - Device ID
   * @param {string} phone - Receiver phone number
   * @param {string} message - Message content
   * @param {string} [mediaUrl] - Optional media URL
   * @returns {Promise<Object>} Response data
   */
  async sendMessageFast(deviceId, phone, message, mediaUrl = null) {
    const body = {
      ...this._auth(),
      device_id: deviceId,
      phone: phone,
      message: message,
    };

    if (mediaUrl) {
      body.media_url = mediaUrl;
    }

    const options = {
      method: "POST",
      uri: `${this._endpoint}/v1/send-message-fast`,
      body: body,
      json: true,
    };

    try {
      const resp = await rp(options);
      if (resp.success && resp.data) {
        return resp.data;
      }
      throw new Error(resp.message || "Failed to send fast message");
    } catch (err) {
      throw new Error(`Send message fast failed: ${err.message}`);
    }
  }

  /**
   * Send WhatsApp message with file (multipart/form-data, max 50MB)
   * @param {string} deviceId - Device ID
   * @param {string} phone - Receiver phone number
   * @param {Buffer|import('fs').ReadStream} file - File content
   * @param {Object} [opts={}] - Additional options
   * @param {string} [opts.message] - Optional caption
   * @param {string} [opts.fileName] - Optional file name
   * @returns {Promise<Object>} Response data
   */
  async sendMessageFile(deviceId, phone, file, { message = null, fileName = null } = {}) {
    const form = new FormData();
    form.append("user_code", this._user_code);
    form.append("secret", this._secret);
    form.append("device_id", deviceId);
    form.append("phone", phone);
    if (message) form.append("message", message);
    if (fileName) {
      form.append("file", file, { filename: fileName });
    } else {
      form.append("file", file);
    }

    const options = {
      method: "POST",
      uri: `${this._endpoint}/v1/send-message-file`,
      body: form,
      headers: form.getHeaders(),
    };

    try {
      const rawResp = await rp(options);
      const resp = typeof rawResp === "string" ? JSON.parse(rawResp) : rawResp;
      if (resp.success && resp.data) {
        return resp.data;
      }
      throw new Error(resp.message || "Failed to send message file");
    } catch (err) {
      throw new Error(`Send message file failed: ${err.message}`);
    }
  }

  /**
   * Send message via WhatsApp Business API (WABA / Meta Cloud API)
   * @param {string} deviceId - Device ID (WABA device)
   * @param {string} phone - Receiver phone number
   * @param {string} message - Message content
   * @returns {Promise<Object>} Response data
   */
  async sendWabaMessage(deviceId, phone, message) {
    const options = {
      method: "POST",
      uri: `${this._endpoint}/v1/waba/send-message`,
      body: {
        ...this._auth(),
        device_id: deviceId,
        phone: phone,
        message: message,
      },
      json: true,
    };

    try {
      const resp = await rp(options);
      if (resp.success && resp.data) {
        return resp.data;
      }
      throw new Error(resp.message || "Failed to send WABA message");
    } catch (err) {
      throw new Error(`Send WABA message failed: ${err.message}`);
    }
  }

  /**
   * List all registered devices
   * @returns {Promise<Object>} Response data
   */
  async listDevices() {
    const options = {
      method: "POST",
      uri: `${this._endpoint}/v1/list-devices`,
      body: { ...this._auth() },
      json: true,
    };

    try {
      const resp = await rp(options);
      if (resp.success && resp.data) {
        return resp.data;
      }
      throw new Error(resp.message || "Failed to list devices");
    } catch (err) {
      throw new Error(`List devices failed: ${err.message}`);
    }
  }

  /**
   * Check device connection status
   * @param {string} deviceId - Device ID
   * @returns {Promise<Object>} Response data
   */
  async deviceStatus(deviceId) {
    const options = {
      method: "POST",
      uri: `${this._endpoint}/v1/device-status`,
      body: { ...this._auth(), device_id: deviceId },
      json: true,
    };

    try {
      const resp = await rp(options);
      if (resp.success && resp.data) {
        return resp.data;
      }
      throw new Error(resp.message || "Failed to get device status");
    } catch (err) {
      throw new Error(`Device status failed: ${err.message}`);
    }
  }

  /**
   * Check device status with enhanced details
   * @param {string} deviceId - Device ID
   * @returns {Promise<Object>} Response data
   */
  async deviceStatusEnhanced(deviceId) {
    const options = {
      method: "POST",
      uri: `${this._endpoint}/v1/device-status-enhanced`,
      body: { ...this._auth(), device_id: deviceId },
      json: true,
    };

    try {
      const resp = await rp(options);
      if (resp.success && resp.data) {
        return resp.data;
      }
      throw new Error(resp.message || "Failed to get enhanced device status");
    } catch (err) {
      throw new Error(`Device status enhanced failed: ${err.message}`);
    }
  }

  /**
   * Get current user account info
   * @returns {Promise<Object>} Response data
   */
  async userInfo() {
    const options = {
      method: "POST",
      uri: `${this._endpoint}/v1/user-info`,
      body: { ...this._auth() },
      json: true,
    };

    try {
      const resp = await rp(options);
      if (resp.success && resp.data) {
        return resp.data;
      }
      throw new Error(resp.message || "Failed to get user info");
    } catch (err) {
      throw new Error(`User info failed: ${err.message}`);
    }
  }

  /**
   * Save a contact
   * @param {string} phone - Phone number
   * @param {Object} [opts={}] - Optional contact fields
   * @param {string} [opts.name] - Contact name
   * @param {string} [opts.email] - Contact email
   * @returns {Promise<Object>} Response data
   */
  async saveContact(phone, { name = null, email = null } = {}) {
    const body = { ...this._auth(), phone: phone };
    if (name) body.name = name;
    if (email) body.email = email;

    const options = {
      method: "POST",
      uri: `${this._endpoint}/v1/save-contact`,
      body: body,
      json: true,
    };

    try {
      const resp = await rp(options);
      if (resp.success && resp.data) {
        return resp.data;
      }
      throw new Error(resp.message || "Failed to save contact");
    } catch (err) {
      throw new Error(`Save contact failed: ${err.message}`);
    }
  }

  /**
   * Generate and send OTP to WhatsApp number
   * @param {string} deviceId - Device ID
   * @param {string} phone - Phone number to send OTP
   * @param {Object} [options={}] - Optional OTP settings
   * @param {number} [options.otpLength] - OTP length
   * @param {string} [options.otpType] - OTP type: numeric | alphabetic | alphanumeric
   * @param {string} [options.customOtpMessage] - Custom OTP message template
   * @returns {Promise<Object>} Response data
   */
  async generateOTP(deviceId, phone, { otpLength = null, otpType = null, customOtpMessage = null } = {}) {
    const body = {
      ...this._auth(),
      device_id: deviceId,
      phone: phone,
    };

    if (otpLength !== null) body.otp_length = otpLength;
    if (otpType !== null) body.otp_type = otpType;
    if (customOtpMessage !== null) body.customOtpMessage = customOtpMessage;

    const reqOptions = {
      method: "POST",
      uri: `${this._endpoint}/v1/generate-otp`,
      body: body,
      json: true,
    };

    try {
      const resp = await rp(reqOptions);
      if (resp.success && resp.data) {
        return resp.data;
      }
      throw new Error(resp.message || "Failed to generate OTP");
    } catch (err) {
      throw new Error(`Generate OTP failed: ${err.message}`);
    }
  }

  /**
   * Validate OTP code
   * @param {string} deviceId - Device ID
   * @param {string} phone - Phone number that received OTP
   * @param {string} otp - OTP code to validate
   * @returns {Promise<Object>} Response data
   */
  async validateOTP(deviceId, phone, otp) {
    const options = {
      method: "POST",
      uri: `${this._endpoint}/v1/validate-otp`,
      body: {
        ...this._auth(),
        device_id: deviceId,
        phone: phone,
        otp: otp,
      },
      json: true,
    };

    try {
      const resp = await rp(options);
      if (resp.success && resp.data) {
        return resp.data;
      }
      throw new Error(resp.message || "Failed to validate OTP");
    } catch (err) {
      throw new Error(`Validate OTP failed: ${err.message}`);
    }
  }

  /**
   * Send OTP via WABA template or device (V2)
   * @param {string} phone - Destination phone number
   * @param {string} deviceId - Device ID
   * @param {Object} [opts={}] - Optional fields
   * @param {string} [opts.method] - Send method: device | waba
   * @param {string} [opts.appName] - Application name
   * @param {string} [opts.templateCode] - WABA template code
   * @param {string} [opts.customMessage] - Custom message (device method)
   * @returns {Promise<Object>} Response data
   */
  async sendOtpV2(phone, deviceId, { method = null, appName = null, templateCode = null, customMessage = null } = {}) {
    const body = { ...this._auth(), phone: phone, device_id: deviceId };
    if (method !== null) body.method = method;
    if (appName !== null) body.app_name = appName;
    if (templateCode !== null) body.template_code = templateCode;
    if (customMessage !== null) body.custom_message = customMessage;

    const options = {
      method: "POST",
      uri: `${this._endpoint}/v2/otp/send`,
      body: body,
      json: true,
    };

    try {
      const resp = await rp(options);
      if (resp.success && resp.data) {
        return resp.data;
      }
      throw new Error(resp.message || "Failed to send OTP v2");
    } catch (err) {
      throw new Error(`Send OTP v2 failed: ${err.message}`);
    }
  }

  /**
   * Verify OTP code (V2)
   * @param {string} phone - Phone number
   * @param {string} otpCode - OTP code to verify
   * @returns {Promise<Object>} Response data
   */
  async verifyOtpV2(phone, otpCode) {
    const options = {
      method: "POST",
      uri: `${this._endpoint}/v2/otp/verify`,
      body: {
        ...this._auth(),
        phone: phone,
        otp_code: otpCode,
      },
      json: true,
    };

    try {
      const resp = await rp(options);
      if (resp.success && resp.data) {
        return resp.data;
      }
      throw new Error(resp.message || "Failed to verify OTP v2");
    } catch (err) {
      throw new Error(`Verify OTP v2 failed: ${err.message}`);
    }
  }

  /**
   * Broadcast message to multiple recipients
   * @param {string} deviceId - Device ID
   * @param {string|string[]} phones - Phone numbers (comma-separated string or array)
   * @param {string} message - Message content
   * @param {Object} [opts={}] - Optional settings
   * @param {number} [opts.delay] - Delay between messages in seconds
   * @returns {Promise<Object>} Response data
   */
  async broadcastMessage(deviceId, phones, message, { delay = null } = {}) {
    const phonesStr = Array.isArray(phones) ? phones.join(",") : phones;
    const body = {
      ...this._auth(),
      device_id: deviceId,
      phones: phonesStr,
      message: message,
    };
    if (delay !== null) body.delay = delay;

    const options = {
      method: "POST",
      uri: `${this._endpoint}/v1/broadcast-message`,
      body: body,
      json: true,
    };

    try {
      const resp = await rp(options);
      if (resp.success && resp.data) {
        return resp.data;
      }
      throw new Error(resp.message || "Failed to broadcast message");
    } catch (err) {
      throw new Error(`Broadcast message failed: ${err.message}`);
    }
  }

  /**
   * List deposits
   * @param {string} [status] - Filter by status: "" | paid | unpaid | expired
   * @returns {Promise<Object>} Response data
   */
  async listDeposits(status = null) {
    const body = { ...this._auth() };
    if (status !== null) body.status = status;

    const options = {
      method: "POST",
      uri: `${this._endpoint}/v1/list-deposits`,
      body: body,
      json: true,
    };

    try {
      const resp = await rp(options);
      if (resp.success && resp.data) {
        return resp.data;
      }
      throw new Error(resp.message || "Failed to list deposits");
    } catch (err) {
      throw new Error(`List deposits failed: ${err.message}`);
    }
  }

  /**
   * List available packages
   * @returns {Promise<Object>} Response data
   */
  async listPackages() {
    const options = {
      method: "POST",
      uri: `${this._endpoint}/v1/list-packages`,
      body: { ...this._auth() },
      json: true,
    };

    try {
      const resp = await rp(options);
      if (resp.success && resp.data) {
        return resp.data;
      }
      throw new Error(resp.message || "Failed to list packages");
    } catch (err) {
      throw new Error(`List packages failed: ${err.message}`);
    }
  }

  /**
   * Check API health status
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    const options = {
      method: "GET",
      uri: `${this._endpoint}/`,
      json: true,
    };

    try {
      const resp = await rp(options);
      return resp;
    } catch (err) {
      throw new Error(`Health check failed: ${err.message}`);
    }
  }
}

module.exports = Kirimi;
