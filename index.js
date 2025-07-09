const crypto = require("crypto")
const rp = require("request-promise-native");

class Kirimi {
  /**
   * @param {string} user_code - User Code
   * @param {string} secret - Secret Key
   **/
  constructor(user_code, secret) {
    this._user_code = user_code;
    this._secret = secret;
    this._endpoint = "https://api.kirimi.id"
  }

  /**
   * Send WhatsApp message with optional media
   * @param {string} deviceId - Device ID
   * @param {string} to - Receiver phone number
   * @param {string} message - Message content (max 1200 chars)
   * @param {string} mediaUrl - Optional media URL
   * @returns {Promise<Object>} Response data
   */
  async sendMessage(deviceId, to, message, mediaUrl = null) {
    const body = {
      "user_code": this._user_code,
      "device_id": deviceId,
      "receiver": to,
      "message": message,
      "secret": this._secret
    };

    // Add media_url if provided
    if (mediaUrl) {
      body.media_url = mediaUrl;
    }

    const options = {
      method: 'POST',
      uri: `${this._endpoint}/v1/send-message`,
      body: body,
      json: true,
    };

    try {
      const resp = await rp(options);
      if (resp.success && resp.data) {
        return resp.data;
      }
      throw new Error(resp.message || 'Failed to send message');
    } catch (err) {
      throw new Error(`Send message failed: ${err.message}`);
    }
  }

  /**
   * Generate and send OTP to WhatsApp number
   * @param {string} deviceId - Device ID
   * @param {string} phone - Phone number to send OTP
   * @returns {Promise<Object>} Response data
   */
  async generateOTP(deviceId, phone) {
    const options = {
      method: 'POST',
      uri: `${this._endpoint}/v1/generate-otp`,
      body: {
        "user_code": this._user_code,
        "device_id": deviceId,
        "phone": phone,
        "secret": this._secret
      },
      json: true,
    };

    try {
      const resp = await rp(options);
      if (resp.success && resp.data) {
        return resp.data;
      }
      throw new Error(resp.message || 'Failed to generate OTP');
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
      method: 'POST',
      uri: `${this._endpoint}/v1/validate-otp`,
      body: {
        "user_code": this._user_code,
        "device_id": deviceId,
        "phone": phone,
        "otp": otp,
        "secret": this._secret
      },
      json: true,
    };

    try {
      const resp = await rp(options);
      if (resp.success && resp.data) {
        return resp.data;
      }
      throw new Error(resp.message || 'Failed to validate OTP');
    } catch (err) {
      throw new Error(`Validate OTP failed: ${err.message}`);
    }
  }

  /**
   * Check API health status
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    const options = {
      method: 'GET',
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
