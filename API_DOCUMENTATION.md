# Kirimi Console API Documentation

## Base Information
- **Base URL**: `https://api.kirimi.id`
- **API Version**: v1
- **Content-Type**: `application/json`
- **Body Size Limit**: 5MB

## Authentication
Semua endpoint memerlukan parameter `secret` yang harus sesuai dengan secret user di database.

## Package Types
- **Free (ID: 1)**: Hanya text message dengan watermark
- **Lite (ID: 2, 6, 9)**: Text + Media
- **Basic (ID: 3, 7, 10)**: Text + Media + OTP
- **Pro (ID: 4, 8, 11)**: Text + Media + OTP

## Response Format
Semua response menggunakan format standar:
```json
{
  "success": boolean,
  "data": object,
  "message": string
}
```

## Endpoints

### 1. Generate OTP
**POST** `/v1/generate-otp`

Mengirim kode OTP 6 digit ke nomor WhatsApp yang ditentukan.

#### Request Body
```json
{
  "user_code": "string (required)",
  "device_id": "string (required)",
  "phone": "string (required)",
  "secret": "string (required)"
}
```

#### Response Success (200)
```json
{
  "success": true,
  "data": {
    "phone": "628123456789",
    "message": "OTP berhasil dikirim",
    "expires_in": "5 menit"
  },
  "message": "OTP berhasil digenerate dan dikirim"
}
```

#### Error Responses
- **400**: Parameter tidak lengkap, secret tidak valid, device expired, device tidak terhubung
- **403**: Fitur OTP hanya tersedia untuk paket Basic dan Pro
- **404**: User atau device tidak ditemukan
- **500**: Gagal mengirim OTP

#### Requirements
- Package harus Basic atau Pro (ID: 3, 4, 7, 8, 10, 11)
- Device status harus 'connected'
- Device belum expired
- Kuota tersedia (jika tidak unlimited)

---

### 2. Validate OTP
**POST** `/v1/validate-otp`

Memvalidasi kode OTP yang telah dikirim sebelumnya.

#### Request Body
```json
{
  "user_code": "string (required)",
  "device_id": "string (required)",
  "phone": "string (required)",
  "otp": "string (required)",
  "secret": "string (required)"
}
```

#### Response Success (200)
```json
{
  "success": true,
  "data": {
    "phone": "628123456789",
    "verified": true,
    "verified_at": "2024-01-15T10:30:00.000Z"
  },
  "message": "OTP berhasil divalidasi"
}
```

#### Error Responses
- **400**: Parameter tidak lengkap, secret tidak valid, OTP tidak valid atau expired
- **403**: Fitur OTP hanya tersedia untuk paket Basic dan Pro
- **404**: User atau device tidak ditemukan
- **500**: Error validasi OTP

#### Notes
- OTP berlaku selama 5 menit
- OTP hanya bisa digunakan sekali (one-time use)
- OTP akan otomatis dihapus setelah divalidasi atau expired

---

### 3. Send Message
**POST** `/v1/send-message`

Mengirim pesan WhatsApp dengan atau tanpa media.

#### Request Body
```json
{
  "user_code": "string (required)",
  "device_id": "string (required)",
  "receiver": "string (required)",
  "message": "string (required, max 1200 chars)",
  "secret": "string (required)",
  "media_url": "string (optional, valid URL)"
}
```

#### Response Success (200)
```json
{
  "success": true,
  "data": {
    "message_length": 25,
    "media_url": "https://example.com/image.jpg",
    "has_media": true,
    // ... additional response data from sendWAv4
  },
  "message": "Berhasil mengirim pesan dengan media"
}
```

#### Error Responses
- **400**: Parameter tidak lengkap, message terlalu panjang (>1200 karakter), secret tidak valid, device expired, kuota habis, device tidak terhubung, format media URL tidak valid
- **403**: Fitur media hanya tersedia untuk paket Lite, Basic, dan Pro
- **404**: User atau device tidak ditemukan
- **500**: Gagal kirim pesan

#### Features by Package
- **Free (ID: 1)**: Text only + watermark "Sent from *kirimi.id*"
- **Lite, Basic, Pro (ID: 2,3,4,6,7,8,9,10,11)**: Text + Media support

#### Notes
- Media URL harus berupa URL yang valid
- Kuota akan berkurang 1 setiap pengiriman (jika tidak unlimited)
- Statistik pengiriman akan dicatat otomatis

---


### 5. Health Check
**GET** `/`

Endpoint untuk mengecek status API.

#### Response
```json
{
  "success": true,
  "data": {},
  "message": "Kirimi API v1"
}
```

---

## Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "data": {},
  "message": "Parameter tidak boleh kosong"
}
```

#### 404 Not Found
```json
{
  "success": false,
  "data": 404,
  "message": "Page Not Found"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "data": {},
  "message": "Error: Gagal mengirim pesan"
}
```

### Invalid JSON Format
Jika request body bukan JSON yang valid:
```json
{
  "success": false,
  "data": {},
  "message": "Invalid JSON format"
}
```

## Rate Limiting & Quotas

- Setiap pengiriman pesan akan mengurangi kuota device (kecuali unlimited)
- Statistik pengiriman (sukses/gagal) dicatat per device per hari
- OTP memiliki expiry 5 menit dan auto-cleanup

## Security Notes

- Semua endpoint memerlukan validasi secret
- OTP disimpan dalam memory dengan expiry otomatis
- Device harus dalam status 'connected' untuk mengirim pesan
- Package restrictions diterapkan untuk fitur tertentu


### 9. Health Check
**Endpoint:** `GET /`

**Deskripsi:** Endpoint untuk mengecek status server.

**Response:**
```json
{
  "status": "OK",
  "message": "Kirimi Console API is running"
}
```

## 🔧 Server Configuration

- **Port**: 8800
- **Host**: 0.0.0.0 (all interfaces)
- **Body Parser Limit**: 5MB
- **CORS**: Enabled
- **Request Timeout**: Handled with middleware
- **JSON Error Handling**: Custom middleware untuk format error yang konsisten
- **404 Handler**: Custom middleware untuk endpoint yang tidak ditemukan