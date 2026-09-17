const DEFAULT_ENDPOINT = "https://api.kirimi.id";
const DEFAULT_TIMEOUT = 30000;

/**
 * Error thrown when the Kirimi API answers with a non-2xx HTTP status.
 * Exposes the HTTP status code via `err.status`.
 */
class KirimiApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.name = "KirimiApiError";
    this.status = status;
    this.body = body;
  }
}

/** Drop keys whose value is `undefined` so optional fields never reach the wire. */
function compact(body) {
  const out = {};
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/** Resolve `phone` -> `receiver` style aliases to the canonical field name. */
function alias(canonical, value) {
  return { [canonical]: value };
}

class Kirimi {
  /**
   * @param {string} user_code - User Code
   * @param {string} secret - Secret Key
   * @param {Object} [options]
   * @param {string} [options.endpoint] - API base URL, defaults to https://api.kirimi.id
   * @param {number} [options.timeout] - Request timeout in ms, defaults to 30000
   * @param {typeof fetch} [options.fetch] - Custom fetch implementation (testing / proxies)
   **/
  constructor(user_code, secret, { endpoint, timeout, fetch: fetchImpl } = {}) {
    this._user_code = user_code;
    this._secret = secret;
    this._endpoint = (endpoint || DEFAULT_ENDPOINT).replace(/\/$/, "");
    this._timeout = timeout || DEFAULT_TIMEOUT;
    this._fetch = fetchImpl || globalThis.fetch;
  }

  /**
   * Build common auth fields
   * @private
   */
  _auth() {
    return { user_code: this._user_code, secret: this._secret };
  }

  /**
   * Execute a JSON POST request and unwrap the response envelope.
   * @private
   */
  async _post(path, body) {
    return this._request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(compact(body)),
    });
  }

  /**
   * Execute a multipart/form-data POST request and unwrap the response envelope.
   * @private
   */
  async _postForm(path, form) {
    // Do not set Content-Type manually: fetch adds the multipart boundary.
    return this._request(path, { method: "POST", body: form });
  }

  /**
   * @private
   */
  async _request(path, init) {
    const url = `${this._endpoint}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this._timeout);

    let response;
    try {
      response = await this._fetch(url, { ...init, signal: controller.signal });
    } catch (err) {
      if (err && err.name === "AbortError") {
        throw new Error(`Request timed out after ${this._timeout}ms`);
      }
      throw new Error(`Network error: ${err && err.message ? err.message : err}`);
    } finally {
      clearTimeout(timer);
    }

    const contentType = response.headers.get("content-type") || "";
    let envelope;
    if (contentType.includes("application/json")) {
      envelope = await response.json();
    } else {
      const text = await response.text();
      envelope = { success: false, data: null, message: text };
    }

    if (!response.ok) {
      const message =
        envelope && typeof envelope.message === "string" && envelope.message
          ? envelope.message
          : `HTTP ${response.status}`;
      throw new KirimiApiError(response.status, message, envelope);
    }

    if (envelope && envelope.success && envelope.data !== undefined && envelope.data !== null) {
      return envelope.data;
    }

    throw new Error(
      (envelope && envelope.message) || `Request to ${path} failed`
    );
  }

  // ─── WhatsApp Unofficial ────────────────────────────────────────────────

  /**
   * Send WhatsApp message with optional media
   * @param {string} deviceId - Device ID
   * @param {string} to - Receiver phone number (sent as `receiver`)
   * @param {string} message - Message content (max 1200 chars)
   * @param {string} [mediaUrl] - Optional media URL
   * @param {Object} [opts={}] - Optional settings
   * @param {string} [opts.fileName] - Custom media file name
   * @param {boolean} [opts.enableTypingEffect] - Simulate typing before sending
   * @param {number} [opts.typingSpeedMs] - Typing speed in ms (100-800)
   * @param {string} [opts.quotedMessageId] - Message ID to quote
   * @returns {Promise<Object>} Response data
   */
  async sendMessage(deviceId, to, message, mediaUrl = null, opts = {}) {
    const body = {
      ...this._auth(),
      device_id: deviceId,
      ...alias("receiver", to),
      message: message,
    };

    if (mediaUrl) body.media_url = mediaUrl;
    if (opts.fileName !== undefined && opts.fileName !== null) body.fileName = opts.fileName;
    if (opts.enableTypingEffect !== undefined && opts.enableTypingEffect !== null) {
      body.enableTypingEffect = opts.enableTypingEffect;
    }
    if (opts.typingSpeedMs !== undefined && opts.typingSpeedMs !== null) {
      body.typingSpeedMs = opts.typingSpeedMs;
    }
    if (opts.quotedMessageId !== undefined && opts.quotedMessageId !== null) {
      body.quotedMessageId = opts.quotedMessageId;
    }

    return this._post("/v1/send-message", body);
  }

  /**
   * Send WhatsApp message without typing effect (fast)
   * @param {string} deviceId - Device ID
   * @param {string} to - Receiver phone number (sent as `receiver`)
   * @param {string} message - Message content
   * @param {string} [mediaUrl] - Optional media URL
   * @param {Object} [opts={}] - Optional settings
   * @param {string} [opts.fileName] - Custom media file name
   * @param {string} [opts.quotedMessageId] - Message ID to quote
   * @returns {Promise<Object>} Response data
   */
  async sendMessageFast(deviceId, to, message, mediaUrl = null, opts = {}) {
    const body = {
      ...this._auth(),
      device_id: deviceId,
      ...alias("receiver", to),
      message: message,
    };

    if (mediaUrl) body.media_url = mediaUrl;
    if (opts.fileName !== undefined && opts.fileName !== null) body.fileName = opts.fileName;
    if (opts.quotedMessageId !== undefined && opts.quotedMessageId !== null) {
      body.quotedMessageId = opts.quotedMessageId;
    }

    return this._post("/v1/send-message-fast", body);
  }

  /**
   * Send WhatsApp message with file (multipart/form-data, max 50MB)
   * @param {string} deviceId - Device ID
   * @param {string} to - Receiver phone number (sent as `receiver`)
   * @param {Buffer|Uint8Array|Blob|import('fs').ReadStream} file - File content
   * @param {Object} [opts={}] - Additional options
   * @param {string} [opts.message] - Optional caption
   * @param {string} [opts.caption] - Optional caption (alias of `message`)
   * @param {string} [opts.fileName] - Optional file name
   * @param {string} [opts.quotedMessageId] - Message ID to quote
   * @returns {Promise<Object>} Response data
   */
  async sendMessageFile(deviceId, to, file, { message = null, caption = null, fileName = null, quotedMessageId = null } = {}) {
    const form = new FormData();
    form.append("user_code", this._user_code);
    form.append("secret", this._secret);
    form.append("device_id", deviceId);
    form.append("receiver", to);
    if (message !== null) form.append("message", message);
    if (caption !== null) form.append("caption", caption);
    if (fileName !== null) form.append("fileName", fileName);

    const blob = await toBlob(file);
    form.append("file", blob, fileName || "file");
    if (quotedMessageId !== null) form.append("quotedMessageId", quotedMessageId);

    return this._postForm("/v1/send-message-file", form);
  }

  /**
   * Send message via WhatsApp Business API (WABA / Meta Cloud API)
   * @param {string} wabaId - WABA ID (not a device ID)
   * @param {string} to - Receiver phone number
   * @param {string} templateName - Approved Meta template name
   * @param {Object} [opts={}] - Optional template parameters
   * @param {string[]} [opts.variables] - Template body variables in order
   * @param {Object} [opts.header] - Header component (media or text)
   * @param {Array} [opts.buttons] - Template button parameters
   * @returns {Promise<Object>} Response data
   */
  async sendWabaMessage(wabaId, to, templateName, opts = {}) {
    const body = {
      ...this._auth(),
      waba_id: wabaId,
      ...alias("to", to),
      template_name: templateName,
    };

    if (opts.variables !== undefined && opts.variables !== null) body.variables = opts.variables;
    if (opts.header !== undefined && opts.header !== null) body.header = opts.header;
    if (opts.buttons !== undefined && opts.buttons !== null) body.buttons = opts.buttons;

    return this._post("/v1/waba/send-message", body);
  }

  /**
   * Send a free-form WABA reply (only within the 24h customer service window)
   * @param {string} wabaId - WABA ID
   * @param {string} to - Receiver phone number
   * @param {Object} message - Message object, e.g. { type: 'text', text: '...' }
   * @returns {Promise<Object>} Response data
   */
  async wabaReply(wabaId, to, message) {
    return this._post("/v1/waba/messages/reply", {
      ...this._auth(),
      waba_id: wabaId,
      ...alias("to", to),
      message: message,
    });
  }

  /**
   * List WABA conversations
   * @param {Object} [opts={}] - Pagination options
   * @param {number} [opts.limit] - Page size (1-200), default 50
   * @param {number} [opts.page] - Page number, default 1
   * @returns {Promise<Object>} Response data
   */
  async wabaConversations({ limit = null, page = null } = {}) {
    const body = { ...this._auth() };
    if (limit !== null) body.limit = limit;
    if (page !== null) body.page = page;

    return this._post("/v1/waba/conversations", body);
  }

  /**
   * Sync template status from Meta for a WABA
   * @param {string} wabaId - WABA ID
   * @returns {Promise<Object>} Response data
   */
  async wabaTemplatesSync(wabaId) {
    return this._post("/v1/waba/templates/sync", {
      ...this._auth(),
      waba_id: wabaId,
    });
  }

  /**
   * Send an OTP through your own WABA + AUTHENTICATION template
   * @param {string} wabaId - WABA ID
   * @param {string} to - Receiver phone number
   * @param {string} templateName - AUTHENTICATION template name
   * @returns {Promise<Object>} Response data
   */
  async wabaSendOtp(wabaId, to, templateName) {
    return this._post("/v1/waba/send-otp", {
      ...this._auth(),
      waba_id: wabaId,
      ...alias("to", to),
      template_name: templateName,
    });
  }

  /**
   * Verify an OTP previously sent through wabaSendOtp
   * @param {string} wabaId - WABA ID
   * @param {string} to - Receiver phone number
   * @param {string} otpCode - OTP code (4-8 digits)
   * @returns {Promise<Object>} Response data
   */
  async wabaVerifyOtp(wabaId, to, otpCode) {
    return this._post("/v1/waba/verify-otp", {
      ...this._auth(),
      waba_id: wabaId,
      ...alias("to", to),
      otp_code: otpCode,
    });
  }

  // ─── Devices ────────────────────────────────────────────────────────────

  /**
   * Create a new device
   * @param {Object} params
   * @param {number|string} params.packageId - Package ID
   * @param {string} [params.voucherCode] - Optional voucher code
   * @returns {Promise<Object>} Response data
   */
  async createDevice({ packageId, voucherCode } = {}) {
    const body = { ...this._auth(), package_id: packageId };
    if (voucherCode !== undefined && voucherCode !== null) body.voucher_code = voucherCode;

    return this._post("/v1/create-device", body);
  }

  /**
   * Connect a device and obtain its QR / session state
   * @param {Object} params
   * @param {string} params.deviceId - Device ID
   * @returns {Promise<Object>} Response data
   */
  async connectDevice({ deviceId } = {}) {
    return this._post("/v1/connect-device", {
      ...this._auth(),
      device_id: deviceId,
    });
  }

  /**
   * Renew a device subscription
   * @param {Object} params
   * @param {string} params.deviceId - Device ID
   * @param {number|string} params.packageId - Package ID
   * @param {string} [params.voucherCode] - Optional voucher code
   * @returns {Promise<Object>} Response data
   */
  async renewDevice({ deviceId, packageId, voucherCode } = {}) {
    const body = {
      ...this._auth(),
      device_id: deviceId,
      package_id: packageId,
    };
    if (voucherCode !== undefined && voucherCode !== null) body.voucher_code = voucherCode;

    return this._post("/v1/renew-device", body);
  }

  /**
   * List all registered devices
   * @param {Object} [opts={}] - Pagination options
   * @param {number} [opts.page] - Page number, default 1
   * @param {number} [opts.limit] - Page size, default 10
   * @returns {Promise<Object>} Response data
   */
  async listDevices({ page = null, limit = null } = {}) {
    const body = { ...this._auth() };
    if (page !== null) body.page = page;
    if (limit !== null) body.limit = limit;

    return this._post("/v1/list-devices", body);
  }

  /**
   * Check device connection status
   * @param {string} deviceId - Device ID
   * @returns {Promise<Object>} Response data
   */
  async deviceStatus(deviceId) {
    return this._post("/v1/device-status", {
      ...this._auth(),
      device_id: deviceId,
    });
  }

  /**
   * Check device status with enhanced details
   * @param {string} deviceId - Device ID
   * @returns {Promise<Object>} Response data
   */
  async deviceStatusEnhanced(deviceId) {
    return this._post("/v1/device-status-enhanced", {
      ...this._auth(),
      device_id: deviceId,
    });
  }

  // ─── User ───────────────────────────────────────────────────────────────

  /**
   * Get current user account info
   * @returns {Promise<Object>} Response data
   */
  async userInfo() {
    return this._post("/v1/user-info", this._auth());
  }

  // ─── Contacts ───────────────────────────────────────────────────────────

  /**
   * Save a contact. Existing numbers are skipped, not overwritten.
   * @param {Object} params
   * @param {string} params.nama - Contact name
   * @param {string} params.nomor - Contact phone number
   * @param {string} [params.deviceId] - Optional device ID
   * @returns {Promise<Object>} Response data
   */
  async saveContact({ nama, nomor, deviceId } = {}) {
    const body = { ...this._auth(), nama: nama, nomor: nomor };
    if (deviceId !== undefined && deviceId !== null) body.device_id = deviceId;

    return this._post("/v1/save-contact", body);
  }

  /**
   * Save up to 1000 contacts in a single request
   * @param {Object} params
   * @param {Array<{nama: string, nomor: string}>} params.contacts - Contacts to save
   * @param {string} [params.deviceId] - Optional device ID
   * @returns {Promise<Object>} Response data
   */
  async saveContactsBulk({ contacts, deviceId } = {}) {
    const body = { ...this._auth(), contacts: contacts };
    if (deviceId !== undefined && deviceId !== null) body.device_id = deviceId;

    return this._post("/v1/save-contacts-bulk", body);
  }

  // ─── OTP v1 ─────────────────────────────────────────────────────────────

  /**
   * Generate and send OTP to a WhatsApp number
   * @param {string} deviceId - Device ID
   * @param {string} phone - Phone number to send OTP
   * @param {Object} [options={}] - Optional OTP settings
   * @param {number} [options.otpLength] - OTP length (4-20), sent as `otp_length`
   * @param {string} [options.otpType] - OTP type: numeric | alphabetic | alphanumeric, sent as `otp_type`
   * @param {string} [options.customOtpText] - Custom OTP text (max 20 chars)
   * @param {string} [options.customOtpMessage] - Custom message template (must contain {otp})
   * @param {boolean} [options.enableTypingEffect] - Simulate typing before sending
   * @param {number} [options.typingSpeedMs] - Typing speed in ms (100-800)
   * @returns {Promise<Object>} Response data
   */
  async generateOTP(deviceId, phone, options = {}) {
    const {
      otpLength = null,
      otpType = null,
      customOtpText = null,
      customOtpMessage = null,
      enableTypingEffect = null,
      typingSpeedMs = null,
    } = options;

    const body = {
      ...this._auth(),
      device_id: deviceId,
      phone: phone,
    };

    if (otpLength !== null) body.otp_length = otpLength;
    if (otpType !== null) body.otp_type = otpType;
    if (customOtpText !== null) body.customOtpText = customOtpText;
    if (customOtpMessage !== null) body.customOtpMessage = customOtpMessage;
    if (enableTypingEffect !== null) body.enableTypingEffect = enableTypingEffect;
    if (typingSpeedMs !== null) body.typingSpeedMs = typingSpeedMs;

    return this._post("/v1/generate-otp", body);
  }

  /**
   * Validate OTP code
   * @param {string} deviceId - Device ID
   * @param {string} phone - Phone number that received OTP
   * @param {string} otp - OTP code to validate
   * @returns {Promise<Object>} Response data
   */
  async validateOTP(deviceId, phone, otp) {
    return this._post("/v1/validate-otp", {
      ...this._auth(),
      device_id: deviceId,
      phone: phone,
      otp: otp,
    });
  }

  // ─── OTP v2 ─────────────────────────────────────────────────────────────

  /**
   * Send OTP via the Kirimi provider, your own device, or your own WABA (V2)
   * @param {string} phone - Destination phone number
   * @param {string} [deviceId] - Device ID (required for `method: "device"`)
   * @param {Object} [opts={}] - Optional fields
   * @param {string} [opts.method] - whatsapp | waba | device | waba_user
   * @param {string} [opts.appName] - Application name shown in the message
   * @param {string} [opts.wabaId] - WABA ID (required for `waba_user`)
   * @param {string} [opts.templateName] - AUTHENTICATION template (required for `waba_user`)
   * @param {string} [opts.customMessage] - Custom message (required for `device`, must contain {{otp}})
   * @returns {Promise<Object>} Response data
   */
  async sendOtpV2(phone, deviceId = null, opts = {}) {
    const { method = null, appName = null, wabaId = null, templateName = null, customMessage = null } = opts;

    const body = { ...this._auth(), phone: phone };
    if (deviceId !== null) body.device_id = deviceId;
    if (method !== null) body.method = method;
    if (appName !== null) body.app_name = appName;
    if (wabaId !== null) body.waba_id = wabaId;
    if (templateName !== null) body.template_name = templateName;
    if (customMessage !== null) body.custom_message = customMessage;

    return this._post("/v2/otp/send", body);
  }

  /**
   * Verify OTP code (V2)
   * @param {string} phone - Phone number
   * @param {string} otpCode - OTP code to verify
   * @returns {Promise<Object>} Response data
   */
  async verifyOtpV2(phone, otpCode) {
    return this._post("/v2/otp/verify", {
      ...this._auth(),
      phone: phone,
      otp_code: otpCode,
    });
  }

  // ─── OTP Reverse ────────────────────────────────────────────────────────

  /**
   * Create a reverse OTP token
   * @param {Object} params
   * @param {string} params.phone - Customer phone number
   * @param {string} params.deviceId - Device that detects the incoming message
   * @param {string} [params.appName] - App name, default "Kirimi.id"
   * @param {string} [params.callbackUrl] - Callback URL when verified
   * @param {string} [params.customMessage] - Must contain {{token}} and {{phone}}
   * @param {string} [params.successMessage] - Message on success
   * @param {string} [params.failureMessage] - Message on failure
   * @returns {Promise<Object>} Response data
   */
  async otpReverseCreate({
    phone,
    deviceId,
    appName = null,
    callbackUrl = null,
    customMessage = null,
    successMessage = null,
    failureMessage = null,
  } = {}) {
    const body = {
      ...this._auth(),
      phone: phone,
      device_id: deviceId,
    };

    if (appName !== null) body.app_name = appName;
    if (callbackUrl !== null) body.callback_url = callbackUrl;
    if (customMessage !== null) body.custom_message = customMessage;
    if (successMessage !== null) body.success_message = successMessage;
    if (failureMessage !== null) body.failure_message = failureMessage;

    return this._post("/v2/otp-reverse/create", body);
  }

  /**
   * Check the status of a reverse OTP token
   * @param {Object} params
   * @param {string} params.token - Token returned by otpReverseCreate
   * @returns {Promise<Object>} Response data
   */
  async otpReverseStatus({ token } = {}) {
    return this._post("/v2/otp-reverse/status", {
      ...this._auth(),
      token: token,
    });
  }

  // ─── Broadcast ──────────────────────────────────────────────────────────

  /**
   * Broadcast message to multiple recipients
   * @param {string} deviceId - Device ID
   * @param {string|string[]} numbers - Phone numbers. Sent as the `numbers` array.
   * @param {string} message - Message content
   * @param {Object} [opts={}] - Optional settings
   * @param {string} opts.label - Broadcast label (required, max 100 chars)
   * @param {number} [opts.delay] - Delay between messages in seconds
   * @param {number} [opts.delayMin] - Lower bound of the random delay
   * @param {number} [opts.delayMax] - Upper bound of the random delay
   * @param {string} [opts.mediaUrl] - Optional media URL
   * @param {string} [opts.fileName] - Optional media file name
   * @param {string} [opts.startedAt] - Scheduled start time (ISO 8601)
   * @param {boolean} [opts.enableTypingEffect] - Simulate typing before sending
   * @param {number} [opts.typingSpeedMs] - Typing speed in ms (100-800)
   * @returns {Promise<Object>} Response data
   */
  async broadcastMessage(deviceId, numbers, message, opts = {}) {
    const list = Array.isArray(numbers) ? numbers : String(numbers).split(",").map((n) => n.trim()).filter(Boolean);

    const body = {
      ...this._auth(),
      device_id: deviceId,
      label: opts.label,
      numbers: list,
      message: message,
    };

    if (opts.delay !== undefined && opts.delay !== null) body.delay = opts.delay;
    if (opts.delayMin !== undefined && opts.delayMin !== null) body.delayMin = opts.delayMin;
    if (opts.delayMax !== undefined && opts.delayMax !== null) body.delayMax = opts.delayMax;
    if (opts.mediaUrl !== undefined && opts.mediaUrl !== null) body.media_url = opts.mediaUrl;
    if (opts.fileName !== undefined && opts.fileName !== null) body.fileName = opts.fileName;
    if (opts.startedAt !== undefined && opts.startedAt !== null) body.started_at = opts.startedAt;
    if (opts.enableTypingEffect !== undefined && opts.enableTypingEffect !== null) {
      body.enableTypingEffect = opts.enableTypingEffect;
    }
    if (opts.typingSpeedMs !== undefined && opts.typingSpeedMs !== null) {
      body.typingSpeedMs = opts.typingSpeedMs;
    }

    return this._post("/v1/broadcast-message", body);
  }

  // ─── Packages & Deposits ────────────────────────────────────────────────

  /**
   * List available packages
   * @returns {Promise<Object>} Response data
   */
  async listPackages() {
    return this._post("/v1/list-packages", this._auth());
  }

  /**
   * Create a deposit payment link
   * @param {Object} params
   * @param {number} params.nominal - Deposit amount in IDR (min 100)
   * @returns {Promise<Object>} Response data
   */
  async createDeposit({ nominal } = {}) {
    return this._post("/v1/create-deposit", {
      ...this._auth(),
      nominal: nominal,
    });
  }

  /**
   * Check a deposit status by reference
   * @param {Object} params
   * @param {string} params.ref - Deposit reference ID
   * @returns {Promise<Object>} Response data
   */
  async depositStatus({ ref } = {}) {
    return this._post("/v1/deposit-status", {
      ...this._auth(),
      ref: ref,
    });
  }

  /**
   * Cancel an unpaid deposit
   * @param {Object} params
   * @param {string} params.ref - Deposit reference ID
   * @returns {Promise<Object>} Response data
   */
  async cancelDeposit({ ref } = {}) {
    return this._post("/v1/cancel-deposit", {
      ...this._auth(),
      ref: ref,
    });
  }

  /**
   * List deposits
   * @param {Object} [opts={}] - Optional filters
   * @param {number} [opts.page] - Page number, default 1
   * @param {number} [opts.limit] - Page size, default 10
   * @param {string} [opts.status] - unpaid | paid | expired | cancelled
   * @returns {Promise<Object>} Response data
   */
  async listDeposits(opts = {}) {
    if (typeof opts === "string") opts = { status: opts };
    const { page = null, limit = null, status = null } = opts;

    const body = { ...this._auth() };
    if (page !== null) body.page = page;
    if (limit !== null) body.limit = limit;
    if (status !== null) body.status = status;

    return this._post("/v1/list-deposits", body);
  }

  /**
   * Check API health status
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this._timeout);
    try {
      const response = await this._fetch(`${this._endpoint}/`, {
        method: "GET",
        signal: controller.signal,
      });
      return await response.json();
    } catch (err) {
      throw new Error(`Health check failed: ${err && err.message ? err.message : err}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Normalise any accepted file input into a Blob for multipart upload. */
async function toBlob(file) {
  if (typeof Blob !== "undefined" && file instanceof Blob) return file;
  if (file instanceof Uint8Array) return new Blob([file]);
  if (typeof file === "string" || Buffer.isBuffer(file)) return new Blob([file]);
  if (file && typeof file.pipe === "function") {
    const chunks = [];
    for await (const chunk of file) chunks.push(chunk);
    return new Blob(chunks);
  }
  throw new Error("Unsupported file input: pass a Buffer, Uint8Array, Blob or ReadStream");
}

Kirimi.KirimiApiError = KirimiApiError;
Kirimi.default = Kirimi;

module.exports = Kirimi;
module.exports.KirimiApiError = KirimiApiError;
