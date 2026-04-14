[![CodeFactor](https://www.codefactor.io/repository/github/yolkmonday/kirimi/badge)](https://www.codefactor.io/repository/github/yolkmonday/kirimi)
[![Npm package monthly downloads](https://badgen.net/npm/dm/kirimi)](https://npmjs.com/package/kirimi)

# Kirimi Node.js Client

Official Node.js client library for the Kirimi WhatsApp API. This library provides a simple and efficient way to send WhatsApp messages, handle OTP generation and validation, and manage WhatsApp communication from your Node.js applications.

[![NPM](https://nodei.co/npm/kirimi.png)](https://nodei.co/npm/kirimi/)

## 🚀 Features

- ✅ Send WhatsApp messages (text, media, file upload, fast mode)
- ✅ Send via WABA (Meta Cloud API)
- ✅ Generate and validate OTP codes (V1 + V2)
- ✅ Broadcast messages to multiple recipients
- ✅ Manage devices and contacts
- ✅ List deposits and packages
- ✅ Support for multiple package types (Free, Lite, Basic, Pro)
- ✅ Promise-based API with async/await support
- ✅ Comprehensive error handling
- ✅ TypeScript friendly with JSDoc annotations
- ✅ Health check monitoring

## 📦 Installation

Using npm:
```bash
npm install kirimi
```

Using yarn:
```bash
yarn add kirimi
```

## 🔧 Setup

Get your User Code and Secret Key from the [Kirimi Dashboard](https://console.kirimi.id/docs).

```js
const Kirimi = require('kirimi');
const client = new Kirimi("YOUR_USER_CODE", "YOUR_SECRET_KEY");
```

## 📖 API Reference

### Constructor

```js
const client = new Kirimi(userCode, secret);
```

**Parameters:**
- `userCode` (string): Your unique user code from Kirimi Dashboard
- `secret` (string): Your secret key for authentication

### Send Message

Send WhatsApp messages with optional media support.

```js
// Text message only
const result = await client.sendMessage('device_id', '628123456789', 'Hello World!');

// Message with media
const result = await client.sendMessage(
  'device_id', 
  '628123456789', 
  'Check out this image!',
  'https://example.com/image.jpg'
);
```

**Parameters:**
- `deviceId` (string): Your device ID
- `receiver` (string): Recipient's phone number (with country code)
- `message` (string): Message content (max 1200 characters)
- `mediaUrl` (string, optional): URL of media file to send

**Package Support:**
- **Free**: Text only (with watermark)
- **Lite/Basic/Pro**: Text + Media support

### Generate OTP

Generate and send a 6-digit OTP code to a WhatsApp number.

```js
const result = await client.generateOTP('device_id', '628123456789');
console.log(result);
// Output: { phone: "628123456789", message: "OTP berhasil dikirim", expires_in: "5 menit" }
```

**Parameters:**
- `deviceId` (string): Your device ID
- `phone` (string): Phone number to receive OTP

**Requirements:**
- Package must be Basic or Pro
- Device must be connected and not expired

### Validate OTP

Validate a previously sent OTP code.

```js
const result = await client.validateOTP('device_id', '628123456789', '123456');
console.log(result);
// Output: { phone: "628123456789", verified: true, verified_at: "2024-01-15T10:30:00.000Z" }
```

**Parameters:**
- `deviceId` (string): Your device ID
- `phone` (string): Phone number that received the OTP
- `otp` (string): 6-digit OTP code to validate

**Notes:**
- OTP expires after 5 minutes
- Each OTP can only be used once

### Send Message Fast

Send a message without the typing effect.

```js
const result = await client.sendMessageFast('device_id', '628123456789', 'Hello!');
// With media
const result = await client.sendMessageFast('device_id', '628123456789', 'See this', 'https://example.com/img.jpg');
```

### Send Message File

Send a file via multipart/form-data (max 50MB). Accepts `Buffer` or `fs.ReadStream`.

```js
const fs = require('fs');

// Using ReadStream
const result = await client.sendMessageFile(
  'device_id',
  '628123456789',
  fs.createReadStream('./document.pdf'),
  { message: 'Here is your file', fileName: 'document.pdf' }
);

// Using Buffer
const buf = fs.readFileSync('./image.png');
const result = await client.sendMessageFile('device_id', '628123456789', buf, { fileName: 'image.png' });
```

### Send WABA Message

Send a message via WhatsApp Business API (Meta Cloud API).

```js
const result = await client.sendWabaMessage('waba_device_id', '628123456789', 'Hello from WABA!');
```

### List Devices

```js
const devices = await client.listDevices();
```

### Device Status

```js
const status = await client.deviceStatus('device_id');
const enhanced = await client.deviceStatusEnhanced('device_id');
```

### User Info

```js
const info = await client.userInfo();
```

### Save Contact

```js
await client.saveContact('628123456789', { name: 'John Doe', email: 'john@example.com' });
```

### Generate OTP (with options)

```js
// Basic (backward compatible)
const result = await client.generateOTP('device_id', '628123456789');

// With options
const result = await client.generateOTP('device_id', '628123456789', {
  otpLength: 6,
  otpType: 'numeric',       // numeric | alphabetic | alphanumeric
  customOtpMessage: 'Your OTP: {{otp}}'
});
```

### Send OTP V2

Send OTP via WABA template or device (V2 API).

```js
const result = await client.sendOtpV2('628123456789', 'device_id', {
  method: 'device',         // device | waba
  appName: 'MyApp',
  customMessage: 'Your code: {{otp}}'
});
```

### Verify OTP V2

```js
const result = await client.verifyOtpV2('628123456789', '123456');
```

### Broadcast Message

Send a message to multiple recipients.

```js
// Array of phones
const result = await client.broadcastMessage(
  'device_id',
  ['628111111111', '628222222222', '628333333333'],
  'Hello everyone!',
  { delay: 3 }  // optional: delay in seconds between sends
);

// Comma-separated string also accepted
const result = await client.broadcastMessage('device_id', '628111111111,628222222222', 'Hi!');
```

### List Deposits

```js
const all = await client.listDeposits();
const paid = await client.listDeposits('paid');    // paid | unpaid | expired
```

### List Packages

```js
const packages = await client.listPackages();
```

### Health Check

Check the API service status.

```js
const status = await client.healthCheck();
console.log(status);
```

## 🎯 Quick Start

Check out the `example.js` file for a complete demonstration of all features:

```bash
# Set your credentials as environment variables
export KIRIMI_USER_CODE="your_user_code"
export KIRIMI_SECRET_KEY="your_secret_key"
export KIRIMI_DEVICE_ID="your_device_id"
export TEST_PHONE="628123456789"

# Run the example
node example.js
```

## 💡 Usage Examples

### Basic WhatsApp Messaging

```js
const Kirimi = require('kirimi');

async function sendWelcomeMessage() {
  const client = new Kirimi('your_user_code', 'your_secret');
  
  try {
    const result = await client.sendMessage(
      'your_device_id',
      '628123456789',
      'Welcome to our service! 🎉'
    );
    console.log('Message sent successfully:', result);
  } catch (error) {
    console.error('Failed to send message:', error.message);
  }
}

sendWelcomeMessage();
```

### OTP Verification Flow

```js
const Kirimi = require('kirimi');

class OTPService {
  constructor(userCode, secret) {
    this.client = new Kirimi(userCode, secret);
    this.deviceId = 'your_device_id';
  }

  async sendOTP(phoneNumber) {
    try {
      const result = await this.client.generateOTP(this.deviceId, phoneNumber);
      console.log('OTP sent:', result);
      return result;
    } catch (error) {
      console.error('Failed to send OTP:', error.message);
      throw error;
    }
  }

  async verifyOTP(phoneNumber, otpCode) {
    try {
      const result = await this.client.validateOTP(this.deviceId, phoneNumber, otpCode);
      console.log('OTP verified:', result);
      return result.verified;
    } catch (error) {
      console.error('Failed to verify OTP:', error.message);
      return false;
    }
  }
}

// Usage
const otpService = new OTPService('your_user_code', 'your_secret');

// Send OTP
await otpService.sendOTP('628123456789');

// Verify OTP (user provides the code)
const isValid = await otpService.verifyOTP('628123456789', '123456');
```

### Media Messaging

```js
async function sendImageMessage() {
  const client = new Kirimi('your_user_code', 'your_secret');
  
  try {
    const result = await client.sendMessage(
      'your_device_id',
      '628123456789',
      'Here is your requested document 📄',
      'https://example.com/document.pdf'
    );
    console.log('Media message sent:', result);
  } catch (error) {
    console.error('Failed to send media:', error.message);
  }
}
```

## 📋 Package Types & Features

| Package | ID | Features | OTP Support |
|---------|----|---------:|:-----------:|
| Free | 1 | Text only (with watermark) | ❌ |
| Lite | 2, 6, 9 | Text + Media | ❌ |
| Basic | 3, 7, 10 | Text + Media + OTP | ✅ |
| Pro | 4, 8, 11 | Text + Media + OTP | ✅ |

## ⚠️ Error Handling

The library provides comprehensive error handling. All methods throw descriptive errors:

```js
try {
  await client.sendMessage('device_id', 'invalid_number', 'Hello');
} catch (error) {
  if (error.message.includes('Parameter tidak lengkap')) {
    console.log('Missing required parameters');
  } else if (error.message.includes('device tidak terhubung')) {
    console.log('Device is not connected');
  } else if (error.message.includes('kuota habis')) {
    console.log('Quota exceeded');
  }
  // Handle other specific errors...
}
```

## 🔒 Security Notes

- Always keep your secret key secure and never expose it in client-side code
- Use environment variables to store credentials
- Validate phone numbers before sending messages
- Implement rate limiting in your application

```js
// Good practice: use environment variables
const client = new Kirimi(
  process.env.KIRIMI_USER_CODE,
  process.env.KIRIMI_SECRET_KEY
);
```

## 🚦 Rate Limits & Quotas

- Each message sent reduces your device quota (unless unlimited)
- OTP codes expire after 5 minutes
- Device must be in 'connected' status to send messages
- Check your dashboard for current quota and usage statistics

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

[MIT](https://github.com/yolkmonday/kirimi/blob/master/LICENSE)

## 👨‍💻 Author

**Ari Padrian** - [yolkmonday@gmail.com](mailto:yolkmonday@gmail.com)

## 📚 Additional Resources

- [Kirimi Dashboard](https://dash.kirimi.id)
- [API Documentation](https://dash.kirimi.id/docs)
- [Support](mailto:support@kirimi.id)

---

Made with ❤️ for the WhatsApp automation community



