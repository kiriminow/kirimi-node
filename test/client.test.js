"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const Kirimi = require("../index.js");

const USER_CODE = "USER_CODE";
const SECRET = "SECRET";

/**
 * Build a client whose fetch is a stub that records every call and answers
 * with a canned `{ success, data, message }` envelope.
 */
function makeClient(response) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    const payload = response || { success: true, data: { ok: true }, message: "OK" };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const client = new Kirimi(USER_CODE, SECRET, {
    endpoint: "https://api.test",
    fetch,
  });
  return { client, calls };
}

/** Parse the JSON body of a recorded fetch call. */
function bodyOf(call) {
  return JSON.parse(call.init.body);
}

/** Assert a key is absent from the JSON body. */
function assertAbsent(body, key) {
  assert.ok(!Object.hasOwn(body, key), `expected body to NOT contain "${key}"`);
}

test("constructor rejects nothing and keeps auth private fields", async () => {
  const { client, calls } = makeClient();
  await client.userInfo();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.test/v1/user-info");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(bodyOf(calls[0]), { user_code: USER_CODE, secret: SECRET });
});

test("userInfo posts auth in the body, not headers", async () => {
  const { client, calls } = makeClient();
  await client.userInfo();
  const headers = calls[0].init.headers || {};
  assert.equal(headers.Authorization, undefined);
  assert.equal(bodyOf(calls[0]).user_code, USER_CODE);
});

test("returns resp.data, not the envelope", async () => {
  const { client } = makeClient({ success: true, data: { id: "abc" }, message: "OK" });
  const result = await client.userInfo();
  assert.deepEqual(result, { id: "abc" });
});

test("throws on success:false with the server message", async () => {
  const { client } = makeClient({ success: false, data: null, message: "Parameter tidak lengkap" });
  await assert.rejects(() => client.userInfo(), /Parameter tidak lengkap/);
});

test("throws an error exposing the HTTP status", async () => {
  const fetch = async () =>
    new Response(JSON.stringify({ success: false, data: null, message: "wrong secret" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  const client = new Kirimi(USER_CODE, SECRET, { endpoint: "https://api.test", fetch });
  await assert.rejects(
    () => client.userInfo(),
    (err) => {
      assert.equal(err.status, 401);
      assert.match(err.message, /wrong secret/);
      assert.equal(err.name, "KirimiApiError");
      return true;
    }
  );
});

test("omits undefined optional fields from the JSON body", async () => {
  const { client, calls } = makeClient();
  await client.sendMessage("DEV", "628123456789", "hi");
  const body = bodyOf(calls[0]);
  assertAbsent(body, "media_url");
  assertAbsent(body, "fileName");
  assertAbsent(body, "quotedMessageId");
  assertAbsent(body, "enableTypingEffect");
});

// ─── WhatsApp Unofficial ───────────────────────────────────────────────────

test("sendMessage sends receiver (not phone)", async () => {
  const { client, calls } = makeClient();
  await client.sendMessage("DEV", "628123456789", "halo");

  assert.equal(calls[0].url, "https://api.test/v1/send-message");
  const body = bodyOf(calls[0]);
  assert.equal(body.receiver, "628123456789");
  assertAbsent(body, "phone");
  assert.equal(body.device_id, "DEV");
  assert.equal(body.message, "halo");
  assert.equal(body.user_code, USER_CODE);
  assert.equal(body.secret, SECRET);
});

test("sendMessage forwards media and typing options", async () => {
  const { client, calls } = makeClient();
  await client.sendMessage("DEV", "628123456789", "halo", "https://x/y.jpg", {
    fileName: "y.jpg",
    enableTypingEffect: true,
    typingSpeedMs: 400,
    quotedMessageId: "QID",
  });
  const body = bodyOf(calls[0]);
  assert.equal(body.media_url, "https://x/y.jpg");
  assert.equal(body.fileName, "y.jpg");
  assert.equal(body.enableTypingEffect, true);
  assert.equal(body.typingSpeedMs, 400);
  assert.equal(body.quotedMessageId, "QID");
});

test("sendMessageFast sends receiver (not phone)", async () => {
  const { client, calls } = makeClient();
  await client.sendMessageFast("DEV", "628123456789", "fast");
  assert.equal(calls[0].url, "https://api.test/v1/send-message-fast");
  const body = bodyOf(calls[0]);
  assert.equal(body.receiver, "628123456789");
  assertAbsent(body, "phone");
  assertAbsent(body, "enableTypingEffect");
  assertAbsent(body, "typingSpeedMs");
});

test("sendMessageFile posts multipart with receiver (not phone)", async () => {
  const { client, calls } = makeClient();
  await client.sendMessageFile("DEV", "628123456789", Buffer.from("hello"), {
    message: "cap",
    fileName: "a.txt",
    quotedMessageId: "QID",
  });

  assert.equal(calls[0].url, "https://api.test/v1/send-message-file");
  const form = calls[0].init.body;
  assert.ok(form instanceof FormData);
  assert.equal(form.get("receiver"), "628123456789");
  assert.equal(form.get("phone"), null);
  assert.equal(form.get("device_id"), "DEV");
  assert.equal(form.get("user_code"), USER_CODE);
  assert.equal(form.get("secret"), SECRET);
  assert.equal(form.get("message"), "cap");
  assert.equal(form.get("fileName"), "a.txt");
  assert.equal(form.get("quotedMessageId"), "QID");
  assert.ok(form.get("file") instanceof Blob);
  assert.equal(calls[0].init.headers, undefined);
});

test("sendMessageFile accepts a Blob and a caption", async () => {
  const { client, calls } = makeClient();
  await client.sendMessageFile("DEV", "628", new Blob(["x"]), { caption: "legenda" });
  const form = calls[0].init.body;
  assert.equal(form.get("caption"), "legenda");
  assert.equal(form.get("fileName"), null);
});

test("broadcastMessage sends numbers as an Array and requires label", async () => {
  const { client, calls } = makeClient();
  await client.broadcastMessage(
    "DEV",
    ["628111111111", "628222222222"],
    "halo semua",
    { label: "promo-juli", delay: 30 }
  );

  assert.equal(calls[0].url, "https://api.test/v1/broadcast-message");
  const body = bodyOf(calls[0]);
  assert.ok(Array.isArray(body.numbers), "numbers must be an array");
  assert.deepEqual(body.numbers, ["628111111111", "628222222222"]);
  assertAbsent(body, "phones");
  assert.equal(body.label, "promo-juli");
  assert.equal(body.device_id, "DEV");
  assert.equal(body.delay, 30);
});

test("broadcastMessage splits a comma-separated string into an array", async () => {
  const { client, calls } = makeClient();
  await client.broadcastMessage("DEV", "628111111111, 628222222222", "hi", { label: "L" });
  const body = bodyOf(calls[0]);
  assert.ok(Array.isArray(body.numbers));
  assert.deepEqual(body.numbers, ["628111111111", "628222222222"]);
  assertAbsent(body, "phones");
});

test("broadcastMessage maps every documented option", async () => {
  const { client, calls } = makeClient();
  await client.broadcastMessage("DEV", ["6281"], "hi", {
    label: "L",
    delayMin: 30,
    delayMax: 120,
    mediaUrl: "https://x/m.jpg",
    fileName: "m.jpg",
    startedAt: "2026-01-01T00:00:00Z",
    enableTypingEffect: false,
    typingSpeedMs: 200,
  });
  const body = bodyOf(calls[0]);
  assert.equal(body.delayMin, 30);
  assert.equal(body.delayMax, 120);
  assert.equal(body.media_url, "https://x/m.jpg");
  assert.equal(body.fileName, "m.jpg");
  assert.equal(body.started_at, "2026-01-01T00:00:00Z");
  assert.equal(body.enableTypingEffect, false);
  assert.equal(body.typingSpeedMs, 200);
});

// ─── WABA ──────────────────────────────────────────────────────────────────

test("sendWabaMessage sends waba_id / to / template_name", async () => {
  const { client, calls } = makeClient();
  await client.sendWabaMessage("WABA1", "628123456789", "order_update", {
    variables: ["Ari", "INV-1"],
    header: { type: "text", text: "Halo" },
    buttons: [{ index: 0, text: "Buka", payload: "open" }],
  });

  assert.equal(calls[0].url, "https://api.test/v1/waba/send-message");
  const body = bodyOf(calls[0]);
  assert.equal(body.waba_id, "WABA1");
  assert.equal(body.to, "628123456789");
  assert.equal(body.template_name, "order_update");
  assert.deepEqual(body.variables, ["Ari", "INV-1"]);
  assert.deepEqual(body.header, { type: "text", text: "Halo" });
  assert.deepEqual(body.buttons, [{ index: 0, text: "Buka", payload: "open" }]);
  assertAbsent(body, "device_id");
  assertAbsent(body, "phone");
  assertAbsent(body, "message");
});

test("sendWabaMessage omits optional template params when not provided", async () => {
  const { client, calls } = makeClient();
  await client.sendWabaMessage("WABA1", "628", "tpl");
  const body = bodyOf(calls[0]);
  assertAbsent(body, "variables");
  assertAbsent(body, "header");
  assertAbsent(body, "buttons");
});

test("wabaReply sends waba_id / to / message object", async () => {
  const { client, calls } = makeClient();
  const message = { type: "text", text: "hai" };
  await client.wabaReply("WABA1", "628123456789", message);

  assert.equal(calls[0].url, "https://api.test/v1/waba/messages/reply");
  const body = bodyOf(calls[0]);
  assert.equal(body.waba_id, "WABA1");
  assert.equal(body.to, "628123456789");
  assert.deepEqual(body.message, message);
  assertAbsent(body, "phone");
  assertAbsent(body, "receiver");
});

test("wabaConversations sends limit / page", async () => {
  const { client, calls } = makeClient();
  await client.wabaConversations({ limit: 25, page: 2 });

  assert.equal(calls[0].url, "https://api.test/v1/waba/conversations");
  const body = bodyOf(calls[0]);
  assert.equal(body.limit, 25);
  assert.equal(body.page, 2);
});

test("wabaConversations with no args sends only auth", async () => {
  const { client, calls } = makeClient();
  await client.wabaConversations();
  const body = bodyOf(calls[0]);
  assertAbsent(body, "limit");
  assertAbsent(body, "page");
});

test("wabaTemplatesSync sends waba_id", async () => {
  const { client, calls } = makeClient();
  await client.wabaTemplatesSync("WABA1");
  assert.equal(calls[0].url, "https://api.test/v1/waba/templates/sync");
  assert.equal(bodyOf(calls[0]).waba_id, "WABA1");
});

test("wabaSendOtp sends waba_id / to / template_name", async () => {
  const { client, calls } = makeClient();
  await client.wabaSendOtp("WABA1", "628123456789", "otp_template");
  assert.equal(calls[0].url, "https://api.test/v1/waba/send-otp");
  const body = bodyOf(calls[0]);
  assert.equal(body.waba_id, "WABA1");
  assert.equal(body.to, "628123456789");
  assert.equal(body.template_name, "otp_template");
  assertAbsent(body, "phone");
});

test("wabaVerifyOtp sends otp_code", async () => {
  const { client, calls } = makeClient();
  await client.wabaVerifyOtp("WABA1", "628123456789", "123456");
  assert.equal(calls[0].url, "https://api.test/v1/waba/verify-otp");
  const body = bodyOf(calls[0]);
  assert.equal(body.waba_id, "WABA1");
  assert.equal(body.to, "628123456789");
  assert.equal(body.otp_code, "123456");
});

// ─── Devices ───────────────────────────────────────────────────────────────

test("createDevice sends package_id / voucher_code", async () => {
  const { client, calls } = makeClient();
  await client.createDevice({ packageId: 3, voucherCode: "DISC10" });

  assert.equal(calls[0].url, "https://api.test/v1/create-device");
  const body = bodyOf(calls[0]);
  assert.equal(body.package_id, 3);
  assert.equal(body.voucher_code, "DISC10");
  assertAbsent(body, "packageId");
});

test("createDevice works without a voucher", async () => {
  const { client, calls } = makeClient();
  await client.createDevice({ packageId: "3" });
  const body = bodyOf(calls[0]);
  assert.equal(body.package_id, "3");
  assertAbsent(body, "voucher_code");
});

test("connectDevice sends device_id", async () => {
  const { client, calls } = makeClient();
  await client.connectDevice({ deviceId: "DEV" });
  assert.equal(calls[0].url, "https://api.test/v1/connect-device");
  assert.equal(bodyOf(calls[0]).device_id, "DEV");
});

test("renewDevice sends device_id / package_id / voucher_code", async () => {
  const { client, calls } = makeClient();
  await client.renewDevice({ deviceId: "DEV", packageId: 4, voucherCode: "V" });
  assert.equal(calls[0].url, "https://api.test/v1/renew-device");
  const body = bodyOf(calls[0]);
  assert.equal(body.device_id, "DEV");
  assert.equal(body.package_id, 4);
  assert.equal(body.voucher_code, "V");
});

test("listDevices sends page / limit", async () => {
  const { client, calls } = makeClient();
  await client.listDevices({ page: 2, limit: 10 });
  assert.equal(calls[0].url, "https://api.test/v1/list-devices");
  const body = bodyOf(calls[0]);
  assert.equal(body.page, 2);
  assert.equal(body.limit, 10);
});

test("deviceStatus and deviceStatusEnhanced send device_id", async () => {
  const { client, calls } = makeClient();
  await client.deviceStatus("DEV");
  await client.deviceStatusEnhanced("DEV");
  assert.equal(calls[0].url, "https://api.test/v1/device-status");
  assert.equal(calls[1].url, "https://api.test/v1/device-status-enhanced");
  assert.equal(bodyOf(calls[0]).device_id, "DEV");
  assert.equal(bodyOf(calls[1]).device_id, "DEV");
});

// ─── Contacts ──────────────────────────────────────────────────────────────

test("saveContact sends nama / nomor (not name / phone / email)", async () => {
  const { client, calls } = makeClient();
  await client.saveContact({ nama: "John Doe", nomor: "628123456789", deviceId: "DEV" });

  assert.equal(calls[0].url, "https://api.test/v1/save-contact");
  const body = bodyOf(calls[0]);
  assert.equal(body.nama, "John Doe");
  assert.equal(body.nomor, "628123456789");
  assert.equal(body.device_id, "DEV");
  assertAbsent(body, "name");
  assertAbsent(body, "phone");
  assertAbsent(body, "email");
});

test("saveContact works without device_id", async () => {
  const { client, calls } = makeClient();
  await client.saveContact({ nama: "A", nomor: "6281" });
  const body = bodyOf(calls[0]);
  assert.equal(body.nama, "A");
  assert.equal(body.nomor, "6281");
  assertAbsent(body, "device_id");
});

test("saveContactsBulk sends contacts array with nama / nomor", async () => {
  const { client, calls } = makeClient();
  const contacts = [
    { nama: "A", nomor: "628111111111" },
    { nama: "B", nomor: "628222222222" },
  ];
  await client.saveContactsBulk({ contacts, deviceId: "DEV" });

  assert.equal(calls[0].url, "https://api.test/v1/save-contacts-bulk");
  const body = bodyOf(calls[0]);
  assert.ok(Array.isArray(body.contacts));
  assert.deepEqual(body.contacts, contacts);
  assert.deepEqual(Object.keys(body.contacts[0]), ["nama", "nomor"]);
  assert.equal(body.device_id, "DEV");
});

// ─── OTP v1 ────────────────────────────────────────────────────────────────

test("generateOTP sends snake_case otp_length / otp_type", async () => {
  const { client, calls } = makeClient();
  await client.generateOTP("DEV", "628123456789", {
    otpLength: 6,
    otpType: "numeric",
    customOtpText: "Kode",
    customOtpMessage: "Kode Anda: {otp}",
    enableTypingEffect: true,
    typingSpeedMs: 300,
  });

  assert.equal(calls[0].url, "https://api.test/v1/generate-otp");
  const body = bodyOf(calls[0]);
  assert.equal(body.otp_length, 6);
  assert.equal(body.otp_type, "numeric");
  assert.equal(body.customOtpText, "Kode");
  assert.equal(body.customOtpMessage, "Kode Anda: {otp}");
  assert.equal(body.enableTypingEffect, true);
  assert.equal(body.typingSpeedMs, 300);
  assert.equal(body.device_id, "DEV");
  assert.equal(body.phone, "628123456789");
  assertAbsent(body, "otpLength");
  assertAbsent(body, "otpType");
});

test("generateOTP with no options sends only required fields", async () => {
  const { client, calls } = makeClient();
  await client.generateOTP("DEV", "628123456789");
  const body = bodyOf(calls[0]);
  assert.deepEqual(body, {
    user_code: USER_CODE,
    secret: SECRET,
    device_id: "DEV",
    phone: "628123456789",
  });
});

test("validateOTP sends device_id / phone / otp", async () => {
  const { client, calls } = makeClient();
  await client.validateOTP("DEV", "628123456789", "123456");
  assert.equal(calls[0].url, "https://api.test/v1/validate-otp");
  const body = bodyOf(calls[0]);
  assert.equal(body.device_id, "DEV");
  assert.equal(body.phone, "628123456789");
  assert.equal(body.otp, "123456");
});

// ─── OTP v2 ────────────────────────────────────────────────────────────────

test("sendOtpV2 method=whatsapp sends phone + app_name only", async () => {
  const { client, calls } = makeClient();
  await client.sendOtpV2("628123456789", null, { method: "whatsapp", appName: "MyApp" });

  assert.equal(calls[0].url, "https://api.test/v2/otp/send");
  const body = bodyOf(calls[0]);
  assert.equal(body.method, "whatsapp");
  assert.equal(body.phone, "628123456789");
  assert.equal(body.app_name, "MyApp");
  assertAbsent(body, "device_id");
  assertAbsent(body, "waba_id");
  assertAbsent(body, "template_name");
  assertAbsent(body, "custom_message");
});

test("sendOtpV2 method=device sends device_id + custom_message", async () => {
  const { client, calls } = makeClient();
  await client.sendOtpV2("628123456789", "DEV", {
    method: "device",
    customMessage: "Kode Anda {{otp}}",
  });

  const body = bodyOf(calls[0]);
  assert.equal(body.method, "device");
  assert.equal(body.device_id, "DEV");
  assert.equal(body.custom_message, "Kode Anda {{otp}}");
  assertAbsent(body, "waba_id");
  assertAbsent(body, "template_name");
  assert.equal(body.phone, "628123456789");
});

test("sendOtpV2 method=waba_user sends waba_id + template_name", async () => {
  const { client, calls } = makeClient();
  await client.sendOtpV2("628123456789", null, {
    method: "waba_user",
    wabaId: "WABA1",
    templateName: "auth_otp",
  });

  const body = bodyOf(calls[0]);
  assert.equal(body.method, "waba_user");
  assert.equal(body.waba_id, "WABA1");
  assert.equal(body.template_name, "auth_otp");
  assertAbsent(body, "device_id");
  assertAbsent(body, "custom_message");
});

test("sendOtpV2 method=waba alias is forwarded verbatim", async () => {
  const { client, calls } = makeClient();
  await client.sendOtpV2("628123456789", "DEV", { method: "waba", appName: "X" });
  assert.equal(bodyOf(calls[0]).method, "waba");
});

test("verifyOtpV2 sends phone + otp_code", async () => {
  const { client, calls } = makeClient();
  await client.verifyOtpV2("628123456789", "123456");
  assert.equal(calls[0].url, "https://api.test/v2/otp/verify");
  const body = bodyOf(calls[0]);
  assert.equal(body.phone, "628123456789");
  assert.equal(body.otp_code, "123456");
});

// ─── OTP Reverse ───────────────────────────────────────────────────────────

test("otpReverseCreate sends every documented field", async () => {
  const { client, calls } = makeClient();
  await client.otpReverseCreate({
    phone: "628123456789",
    deviceId: "DEV",
    appName: "MyApp",
    callbackUrl: "https://my.app/cb",
    customMessage: "Kirim {{token}} ke {{phone}}",
    successMessage: "Berhasil",
    failureMessage: "Gagal",
  });

  assert.equal(calls[0].url, "https://api.test/v2/otp-reverse/create");
  const body = bodyOf(calls[0]);
  assert.equal(body.phone, "628123456789");
  assert.equal(body.device_id, "DEV");
  assert.equal(body.app_name, "MyApp");
  assert.equal(body.callback_url, "https://my.app/cb");
  assert.equal(body.custom_message, "Kirim {{token}} ke {{phone}}");
  assert.equal(body.success_message, "Berhasil");
  assert.equal(body.failure_message, "Gagal");
});

test("otpReverseCreate omits optionals when absent", async () => {
  const { client, calls } = makeClient();
  await client.otpReverseCreate({ phone: "6281", deviceId: "DEV" });
  const body = bodyOf(calls[0]);
  assert.equal(body.phone, "6281");
  assert.equal(body.device_id, "DEV");
  assertAbsent(body, "app_name");
  assertAbsent(body, "callback_url");
  assertAbsent(body, "custom_message");
  assertAbsent(body, "success_message");
  assertAbsent(body, "failure_message");
});

test("otpReverseStatus sends token", async () => {
  const { client, calls } = makeClient();
  await client.otpReverseStatus({ token: "01HGTOKEN" });
  assert.equal(calls[0].url, "https://api.test/v2/otp-reverse/status");
  assert.equal(bodyOf(calls[0]).token, "01HGTOKEN");
});

// ─── Packages & Deposits ───────────────────────────────────────────────────

test("listPackages posts only auth", async () => {
  const { client, calls } = makeClient();
  await client.listPackages();
  assert.equal(calls[0].url, "https://api.test/v1/list-packages");
  assert.deepEqual(bodyOf(calls[0]), { user_code: USER_CODE, secret: SECRET });
});

test("createDeposit sends nominal", async () => {
  const { client, calls } = makeClient();
  await client.createDeposit({ nominal: 50000 });
  assert.equal(calls[0].url, "https://api.test/v1/create-deposit");
  assert.equal(bodyOf(calls[0]).nominal, 50000);
});

test("depositStatus sends ref", async () => {
  const { client, calls } = makeClient();
  await client.depositStatus({ ref: "REF1" });
  assert.equal(calls[0].url, "https://api.test/v1/deposit-status");
  assert.equal(bodyOf(calls[0]).ref, "REF1");
});

test("cancelDeposit sends ref", async () => {
  const { client, calls } = makeClient();
  await client.cancelDeposit({ ref: "REF1" });
  assert.equal(calls[0].url, "https://api.test/v1/cancel-deposit");
  assert.equal(bodyOf(calls[0]).ref, "REF1");
});

test("listDeposits sends page / limit / status", async () => {
  const { client, calls } = makeClient();
  await client.listDeposits({ page: 1, limit: 10, status: "paid" });
  assert.equal(calls[0].url, "https://api.test/v1/list-deposits");
  const body = bodyOf(calls[0]);
  assert.equal(body.page, 1);
  assert.equal(body.limit, 10);
  assert.equal(body.status, "paid");
});

test("listDeposits accepts a bare status string (legacy signature)", async () => {
  const { client, calls } = makeClient();
  await client.listDeposits("unpaid");
  assert.equal(bodyOf(calls[0]).status, "unpaid");
});

// ─── Client construction ───────────────────────────────────────────────────

test("supports globalThis.fetch monkeypatching", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ success: true, data: { ok: 1 }, message: "OK" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const client = new Kirimi(USER_CODE, SECRET, { endpoint: "https://api.test" });
    const result = await client.userInfo();
    assert.deepEqual(result, { ok: 1 });
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test("default endpoint is api.kirimi.id", async () => {
  const calls = [];
  const client = new Kirimi(USER_CODE, SECRET, {
    fetch: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ success: true, data: {}, message: "OK" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  await client.userInfo();
  assert.equal(calls[0].url, "https://api.kirimi.id/v1/user-info");
});
