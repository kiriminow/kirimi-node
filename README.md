# kirimi-node

Official Node.js SDK for the [Kirimi](https://kirimi.id) WhatsApp API.

- Zero dependencies — uses Node's native `fetch` and `FormData`
- Requires Node.js 18 or newer
- CommonJS

## Installation

```sh
npm install kirimi
```

## Quick Start

```js
const Kirimi = require('kirimi');

const kirimi = new Kirimi('YOUR_USER_CODE', 'YOUR_SECRET');

const data = await kirimi.sendMessage('YOUR_DEVICE_ID', '628111222333', 'Halo!');
console.log(data);
```

Methods resolve with the API's `data` payload and throw on failure.

## Constructor

```js
const kirimi = new Kirimi('USER_CODE', 'SECRET', {
  endpoint: 'https://api.kirimi.id', // optional
  timeout: 30000,                    // optional, ms
  fetch: customFetch,                // optional, for tests/proxies
});
```

Auth travels in the request body (`user_code` + `secret`), never a header. Phone numbers use
the country code without `+`, e.g. `628111222333`.

## Two send paths, don't mix them

- **QR Scan device** — unofficial, free-form text any time, supports groups. Can drop.
- **WABA (Meta Cloud API)** — official, stable. Business-initiated messages must use an
  approved template. Free-form replies only within the 24h window (`wabaReply`). No groups.
  Uses `wabaId`, never `deviceId`.

> A successful WABA call means Meta **accepted** the message, not that it was delivered. Watch
> for the `message.sent` / `message.ack` / `message.failed` webhook events.

## Methods

### WhatsApp (QR device)

```js
// sendMessage(deviceId, receiver, message, mediaUrl?, options?)
await kirimi.sendMessage('DEVICE', '628111222333', 'Halo', 'https://x/img.jpg', {
  fileName: 'img.jpg',
  enableTypingEffect: true,
  typingSpeedMs: 350,
  quotedMessageId: 'wamid.xxx',
});

// sendMessageFast(deviceId, receiver, message, mediaUrl?, options?) — no typing effect
await kirimi.sendMessageFast('DEVICE', '628111222333', 'Halo');

// sendMessageFile(deviceId, receiver, file, options?) — max 50 MB
await kirimi.sendMessageFile('DEVICE', '628111222333', buffer, {
  message: 'Caption',
  fileName: 'invoice.pdf',
});

// broadcastMessage(deviceId, numbers, message, options?) — numbers max 1000, label required
await kirimi.broadcastMessage('DEVICE', ['628111', '628222'], 'Promo!', {
  label: 'promo-juli',
  delay: 30,      // server clamps to 30–3600 seconds
  delayMin: 30,
  delayMax: 90,
  startedAt: '2026-03-01T10:00:00Z',
});
```

`file` accepts a `Blob`, `Buffer`, `Uint8Array`, or a `Readable` stream.

### WABA (Cloud API)

```js
// sendWabaMessage(wabaId, to, templateName, options?)
await kirimi.sendWabaMessage('WABA_ID', '628111222333', 'order_update', {
  variables: ['Budi', 'INV-001'],
  header: { type: 'document', link: 'https://x/invoice.pdf', filename: 'invoice.pdf' },
});

// wabaReply(wabaId, to, message) — free text within the 24h window
await kirimi.wabaReply('WABA_ID', '628111222333', { type: 'text', text: 'Halo' });

await kirimi.wabaConversations({ limit: 50, page: 1 }); // numbers still inside the window
await kirimi.wabaTemplatesSync('WABA_ID');              // refresh template status from Meta
await kirimi.wabaSendOtp('WABA_ID', '628111222333', 'otp_login');
await kirimi.wabaVerifyOtp('WABA_ID', '628111222333', '123456');
```

Reply `message` shapes:

```js
{ type: 'text', text: 'Halo' }
{ type: 'image', media_url: 'https://…', caption: 'Brosur' }  // also audio/video
{ type: 'document', media_url: 'https://…', filename: 'a.pdf' }
{ type: 'interactive', interactive: { /* Meta interactive object */ } }
```

### Devices

```js
await kirimi.createDevice({ packageId: 3, voucherCode: 'PROMO10' });
await kirimi.connectDevice({ deviceId: 'DEVICE' });
await kirimi.renewDevice({ deviceId: 'DEVICE', packageId: 3 });
await kirimi.listDevices({ page: 1, limit: 10 });
await kirimi.deviceStatus('DEVICE');
await kirimi.deviceStatusEnhanced('DEVICE');
```

### User

```js
const me = await kirimi.userInfo();
```

### Contacts

```js
await kirimi.saveContact({ nama: 'Budi', nomor: '628111222333', deviceId: 'DEVICE' });
await kirimi.saveContactsBulk({
  contacts: [{ nama: 'Budi', nomor: '628111222333' }], // max 1000
});
```

Existing numbers are skipped, not overwritten.

### OTP v2 (recommended)

`method` is `whatsapp` (alias `waba`), `device`, or `waba_user`.

```js
// Via the official Kirimi provider — Rp 595 per delivered OTP
await kirimi.sendOtpV2('628111222333', null, { method: 'whatsapp', appName: 'MyApp' });

// Via your own connected device — free
await kirimi.sendOtpV2('628111222333', 'DEVICE', {
  method: 'device',
  customMessage: 'Kode OTP kamu: {{otp}}',
});

// Via your own WABA + AUTHENTICATION template — free, Meta bills your WABA
await kirimi.sendOtpV2('628111222333', null, {
  method: 'waba_user',
  wabaId: 'WABA_ID',
  templateName: 'otp_login',
});

await kirimi.verifyOtpV2('628111222333', '123456');
```

`customMessage` must contain `{{otp}}` and be 10–500 characters.

### OTP v1 (legacy)

```js
await kirimi.generateOTP('DEVICE', '628111222333', {
  otpLength: 6,
  otpType: 'numeric',           // numeric | alphabetic | alphanumeric
  customOtpText: 'KODE',
  customOtpMessage: 'Kode kamu: {otp}',
});

await kirimi.validateOTP('DEVICE', '628111222333', '123456');
```

### OTP Reverse (customer-initiated)

```js
const data = await kirimi.otpReverseCreate({
  phone: '628111222333',
  deviceId: 'DEVICE',
  callbackUrl: 'https://example.com/kirimi-callback',
  customMessage: 'VERIFY {{token}} {{phone}}',
});
// Send data.message_text to the customer; they reply with it to your device.

await kirimi.otpReverseStatus({ token: data.token });
```

Status is `pending`, `verified`, `phone_mismatch`, or `expired`. The token is valid
10 minutes and single use. Kirimi POSTs to `callbackUrl` with the header
`x-kirimi-event: otp-reverse.verified`.

### Packages & Deposits

```js
await kirimi.listPackages();
await kirimi.createDeposit({ nominal: 50000 }); // min 100 IDR
await kirimi.depositStatus({ ref: 'REF' });
await kirimi.cancelDeposit({ ref: 'REF' });     // must still be unpaid
await kirimi.listDeposits({ page: 1, limit: 10, status: 'paid' });
```

Payment links are valid 24 hours; at most 2 unpaid deposits may exist at once.

### Health

```js
await kirimi.healthCheck();
```

## Error Handling

```js
const { KirimiApiError } = require('kirimi');

try {
  await kirimi.sendMessage('DEVICE', '628111222333', 'Halo');
} catch (err) {
  if (err instanceof KirimiApiError) {
    console.error(err.status, err.message, err.body);
  } else {
    console.error(err.message);
  }
}
```

| Status | Meaning |
|---|---|
| 400 | invalid or missing params |
| 401 | wrong `user_code` / `secret` |
| 402 | insufficient balance (`sendOtpV2` whatsapp) |
| 403 | feature not in package / subscription inactive |
| 404 | not found |
| 429 | rate limited |
| 500 | server error |
| 502 | number undeliverable |
| 503 | provider outage |

## License

MIT
